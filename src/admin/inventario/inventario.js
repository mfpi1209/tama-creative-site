/* Inventário de produtos e kits (/admin/inventario/). Ver docs/INVENTARIO.md.
   Lê src/data/produtos.json, modelos.json, selecoes.json e kits.json do repositório e grava as alterações de volta:
   - produção: login com usuário e senha no serviço admin-api (/api/admin/, deploy/admin-api/), que grava no GitHub
     com um token guardado no servidor; cada publicação é um pull request (branch inventario/…) que entra na main na
     hora ("Publicar") ou fica como rascunho;
   - equipe técnica: API do GitHub com o token que o Decap CMS guarda no navegador (localStorage "decap-cms-user");
   - localhost: servidor local (python tools/admin_local.py, porta 8081), que grava direto nos arquivos.
   As alterações ficam numa lista de operações, guardada no navegador até publicar. Na hora de publicar, os arquivos são
   lidos de novo e as operações aplicadas por cima: o que outra pessoa publicou nesse meio-tempo não se perde.
   As regras de validação seguem build.py (preparar_produtos, preparar_modelos, preparar_kits): o que o build recusa
   aparece aqui como erro e bloqueia a publicação. */
(function () {
  'use strict';

  var ARQ = { produtos: 'src/data/produtos.json', modelos: 'src/data/modelos.json', selecoes: 'src/data/selecoes.json', kits: 'src/data/kits.json' };
  var VISIVEL = { aprovada: 1, revisao: 1 };
  var SIT = {   // situação de cada foto (campo aprovacao), com o rótulo que a TaMa vê
    aprovada: { rotulo: 'No site', cls: 'site', ajuda: 'Aparece no site.' },
    revisao: { rotulo: 'Novo', cls: 'novo', ajuda: 'Já aparece no site, aguardando a sua aprovação.' },
    substituir: { rotulo: 'Trocar foto', cls: 'trocar', ajuda: 'Fora do site até chegar a foto nova.' },
    retirada: { rotulo: 'Fora do site', cls: 'fora', ajuda: 'Não aparece no site.' }
  };
  var RASCUNHO = 'tama-inventario-rascunho';
  var POR_PAGINA = 60;

  var S = { op: null, fonte: null, base: null, atual: null, ops: [], arquivos: {}, tab: 'resumo', aberto: null,
    filtro: { q: '', cat: '', sit: '' }, kfiltro: { q: '', sit: '' }, limite: POR_PAGINA, carregando: false };
  var $ = function (id) { return document.getElementById(id); };
  var statusEl = $('status');

  // ------------------------------------------------------------------ utilitários
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function slug(s) { return norm(s).replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean).join('-'); }   // = color_slug do build
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function hoje() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function hojeBR() { return hoje().split('-').reverse().join('/'); }
  function json(o) { return JSON.stringify(o, null, 1) + '\n'; }   // mesmo formato do tools/produtos.py (indent=1)
  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }
  function mesclar(alvo, campos) {
    Object.keys(campos).forEach(function (k) {
      var v = campos[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && alvo[k] && typeof alvo[k] === 'object') mesclar(alvo[k], v);
      else if (v === null) delete alvo[k];
      else alvo[k] = clone(v);
    });
    return alvo;
  }
  function b64(buf) {
    var s = '', u = new Uint8Array(buf), i;
    for (i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function aviso(texto, tipo) { statusEl.className = 'status' + (tipo ? ' ' + tipo : ''); statusEl.innerHTML = texto; statusEl.hidden = !texto; }

  // ------------------------------------------------------------------ fontes (GitHub ou servidor local)
  function usuario() { try { return JSON.parse(localStorage.getItem('decap-cms-user') || 'null'); } catch (e) { return null; } }
  function local() { return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname); }

  function FonteGitHub(token, repo, branch) {
    function api(metodo, path, corpo, raw) {
      return fetch('https://api.github.com' + path, {
        method: metodo, cache: 'no-store',
        headers: { Authorization: 'token ' + token, Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: corpo ? JSON.stringify(corpo) : undefined
      }).then(function (r) {
        if (r.status === 401) throw new Error('login');
        if (r.status === 404 && metodo === 'GET') return null;
        if (!r.ok) return r.text().then(function (t) { throw new Error('GitHub respondeu ' + r.status + ' (' + path + '): ' + t.slice(0, 200)); });
        if (r.status === 204) return null;
        return raw ? r.text() : r.json();
      });
    }
    return {
      nome: 'GitHub · ' + repo,
      ler: function (path) { return api('GET', '/repos/' + repo + '/contents/' + path + '?ref=' + encodeURIComponent(branch), null, true); },
      // um commit com todos os arquivos, numa branch nova e num pull request; publicar = juntar na main na hora
      salvar: function (arquivos, mensagem, publicar) {
        var nomeBranch = 'inventario/' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14), base, pr;
        return api('GET', '/repos/' + repo + '/git/ref/heads/' + branch).then(function (ref) {
          base = ref.object.sha;
          return api('GET', '/repos/' + repo + '/git/commits/' + base);
        }).then(function (commit) {
          return Promise.all(arquivos.map(function (a) {
            return api('POST', '/repos/' + repo + '/git/blobs', a.b64 != null ? { content: a.b64, encoding: 'base64' } : { content: a.texto, encoding: 'utf-8' })
              .then(function (blob) { return { path: a.path, mode: '100644', type: 'blob', sha: blob.sha }; });
          })).then(function (arvore) { return api('POST', '/repos/' + repo + '/git/trees', { base_tree: commit.tree.sha, tree: arvore }); });
        }).then(function (tree) {
          return api('POST', '/repos/' + repo + '/git/commits', { message: mensagem, tree: tree.sha, parents: [base] });
        }).then(function (novo) {
          return api('POST', '/repos/' + repo + '/git/refs', { ref: 'refs/heads/' + nomeBranch, sha: novo.sha });
        }).then(function () {
          return api('POST', '/repos/' + repo + '/pulls', { title: mensagem.split('\n')[0], head: nomeBranch, base: branch,
            body: mensagem + '\n\nEnviado pelo Inventário (/admin/inventario/).' });
        }).then(function (p) {
          pr = p;
          if (!publicar) return { url: pr.html_url, publicado: false };
          return api('PUT', '/repos/' + repo + '/pulls/' + pr.number + '/merge', { merge_method: 'squash', commit_title: mensagem.split('\n')[0] + ' (#' + pr.number + ')' })
            .then(function () { return api('DELETE', '/repos/' + repo + '/git/refs/heads/' + nomeBranch).catch(function () {}); })
            .then(function () { return { url: pr.html_url, publicado: true }; });
        });
      },
      rascunhos: function () {
        return api('GET', '/repos/' + repo + '/pulls?state=open&per_page=50').then(function (l) {
          return (l || []).filter(function (p) { return /^inventario\//.test(p.head.ref); })
            .map(function (p) { return { n: p.number, titulo: p.title, url: p.html_url, ref: p.head.ref, data: p.created_at }; });
        });
      },
      publicarRascunho: function (r) {
        return api('PUT', '/repos/' + repo + '/pulls/' + r.n + '/merge', { merge_method: 'squash', commit_title: r.titulo + ' (#' + r.n + ')' })
          .then(function () { return api('DELETE', '/repos/' + repo + '/git/refs/heads/' + r.ref).catch(function () {}); });
      },
      descartarRascunho: function (r) {
        return api('PATCH', '/repos/' + repo + '/pulls/' + r.n, { state: 'closed' })
          .then(function () { return api('DELETE', '/repos/' + repo + '/git/refs/heads/' + r.ref).catch(function () {}); });
      }
    };
  }

  // serviço com usuário e senha (deploy/admin-api/server.py): mesma interface das outras fontes
  var API_ADMIN = '/api/admin';
  function chamarApi(metodo, rota, corpo) {
    return fetch(API_ADMIN + rota, { method: metodo, credentials: 'same-origin', cache: 'no-store',
      headers: corpo ? { 'Content-Type': 'application/json' } : {}, body: corpo ? JSON.stringify(corpo) : undefined })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (r.status === 401 && rota !== '/login') throw new Error('login');
          if (!r.ok) throw new Error(d.erro || ('o servidor respondeu ' + r.status));
          return d;
        });
      });
  }
  function FonteServidor(usuario) {
    return {
      nome: 'conectado como ' + usuario, servidor: true,
      ler: function (path) { return chamarApi('POST', '/ler', { path: path }).then(function (d) { return d.texto; }); },
      salvar: function (arquivos, mensagem, publicar) { return chamarApi('POST', '/salvar', { arquivos: arquivos, mensagem: mensagem, publicar: publicar }); },
      rascunhos: function () { return chamarApi('GET', '/rascunhos'); },
      publicarRascunho: function (r) { return chamarApi('POST', '/rascunhos/publicar', { n: r.n }); },
      descartarRascunho: function (r) { return chamarApi('POST', '/rascunhos/descartar', { n: r.n }); }
    };
  }

  function FonteLocal(url) {
    function chamar(action, params) {
      return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: action, params: params }) })
        .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error('servidor local respondeu ' + r.status + ': ' + t.slice(0, 200)); }); return r.json(); });
    }
    return {
      nome: 'servidor local (grava direto nos arquivos)', local: true,
      ler: function (path) { return chamar('getEntry', { branch: 'main', path: path }).then(function (e) { return e && e.data; }); },
      salvar: function (arquivos, mensagem) {
        return chamar('persistEntry', { branch: 'main', options: { commitMessage: mensagem }, entry: { slug: 'inventario',
          dataFiles: arquivos.filter(function (a) { return a.b64 == null; }).map(function (a) { return { path: a.path, raw: a.texto, slug: 'inventario' }; }),
          assets: arquivos.filter(function (a) { return a.b64 != null; }).map(function (a) { return { path: a.path, content: a.b64, encoding: 'base64' }; }) } })
          .then(function () { return { url: '', publicado: true }; });
      },
      rascunhos: function () { return Promise.resolve([]); }
    };
  }

  // ------------------------------------------------------------------ dados: leitura e operações
  function lerTudo() {
    var f = S.fonte;
    return Promise.all([f.ler(ARQ.produtos), f.ler(ARQ.modelos), f.ler(ARQ.selecoes), f.ler(ARQ.kits)]).then(function (t) {
      if (!t[0]) throw new Error('não encontrei ' + ARQ.produtos + ' no repositório');
      return { produtos: JSON.parse(t[0]), modelos: t[1] ? JSON.parse(t[1]) : { modelos: [] }, selecoes: t[2] ? JSON.parse(t[2]) : {},
        kits: t[3] ? JSON.parse(t[3]) : { kits: [], home: [], fim_de_ano: [], tipos: [] } };
    });
  }

  /* Operações (S.ops): cada uma com chave (a mesma chave substitui a anterior, campos são mesclados) e alvo
     ("modelo:<produto>" ou "kit:<slug>", para desfazer tudo de um item de uma vez). */
  function registrar(op, adiar) {   // adiar: várias operações seguidas; quem chama faz recalcular() no fim
    var i = S.ops.findIndex(function (o) { return o.chave === op.chave; });
    if (i >= 0 && op.campos && S.ops[i].campos) { mesclar(S.ops[i].campos, op.campos); }
    else if (i >= 0) { S.ops[i] = op; }
    else { S.ops.push(op); }
    if (!adiar) recalcular();
  }

  function aplicar(base, ops) {
    var D = clone(base), conflitos = [];
    var imgs = D.produtos.imagens, mods = D.modelos.modelos = D.modelos.modelos || [], sel = D.selecoes, kits = D.kits;
    function foto(id) { return imgs.find(function (i) { return i.id === id; }); }
    function kit(s) { return (kits.kits || []).find(function (k) { return k.slug === s; }); }
    ops.forEach(function (o) {
      if (o.t === 'foto_nova') {
        if (foto(o.entrada.id)) conflitos.push('já existe uma foto com o identificador ' + o.entrada.id);
        else imgs.push(clone(o.entrada));
      } else if (o.t === 'foto') {
        var f = foto(o.id);
        if (f) mesclar(f, o.campos); else conflitos.push('foto ' + o.id + ' não existe mais');
      } else if (o.t === 'prod') {
        imgs.forEach(function (i) { if (i.produto === o.produto) mesclar(i, o.campos); });
      } else if (o.t === 'modelo') {
        var m = mods.find(function (x) { return x.produto === o.produto; });
        if (!m) {   // entra na ordem alfabética, sem mexer na ordem das entradas existentes (como tools/ do lote)
          m = { produto: o.produto, genero: '', resumo: '', usos: [], medidas: { valor: '', status: 'a_confirmar' } };
          var pos = mods.findIndex(function (x) { return norm(x.produto) > norm(o.produto); });
          mods.splice(pos < 0 ? mods.length : pos, 0, m);
        }
        mesclar(m, o.campos);
        ['nome', 'titulo_seo', 'descricao_seo'].forEach(function (k) { if (m[k] === '') delete m[k]; });
      } else if (o.t === 'sel') {
        sel[o.chave2] = sel[o.chave2] || {};
        if (o.valor == null) delete sel[o.chave2][o.slug]; else sel[o.chave2][o.slug] = clone(o.valor);
        if (o.chave2 === 'foto_base') { var ord = {}; Object.keys(sel.foto_base).sort().forEach(function (k) { ord[k] = sel.foto_base[k]; }); sel.foto_base = ord; }
      } else if (o.t === 'prioridade') {
        sel.prioridade = sel.prioridade || [];
        if (sel.prioridade.indexOf(o.slug) < 0) sel.prioridade.push(o.slug);
      } else if (o.t === 'kit_novo') {
        if (kit(o.kit.slug)) conflitos.push('já existe um kit com o slug ' + o.kit.slug);
        else kits.kits.push(clone(o.kit));
      } else if (o.t === 'kit') {
        var k = kit(o.slug);
        if (k) mesclar(k, o.campos); else conflitos.push('kit ' + o.slug + ' não existe mais');
      } else if (o.t === 'kit_lista') {
        var lista = o.lista === 'tipo' ? ((kits.tipos || []).find(function (t) { return t.ancora === o.ancora; }) || {}).kits : (kits[o.lista] = kits[o.lista] || []);
        if (!lista) return;
        var pos = lista.indexOf(o.slug);
        if (o.dentro && pos < 0) lista.push(o.slug);
        if (!o.dentro && pos >= 0) lista.splice(pos, 1);
      }
    });
    imgs.sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    D.conflitos = conflitos;
    return D;
  }

  // ------------------------------------------------------------------ visão por modelo e por kit
  function modelosDe(D) {
    var grupos = {}, nomes = {}, sel = D.selecoes || {};
    (D.modelos.modelos || []).forEach(function (m) { nomes[m.produto] = m; });
    D.produtos.imagens.forEach(function (i) { (grupos[i.produto] = grupos[i.produto] || []).push(i); });
    return Object.keys(grupos).map(function (p) {
      var fotos = grupos[p], s = slug(p), vis = fotos.filter(function (i) { return VISIVEL[i.aprovacao]; });
      var frente = vis.filter(function (i) { return (i.vista || 'frente') === 'frente'; });
      var baseId = (sel.foto_base || {})[s];
      var base = fotos.find(function (i) { return i.id === baseId; }) || frente[0] || fotos[0];
      var info = nomes[p] || null;
      return { produto: p, slug: s, nome: (info && info.nome) || p, fotos: fotos, visiveis: vis, base: base, categoria: base.categoria,
        noSite: frente.length > 0, novo: vis.some(function (i) { return i.aprovacao === 'revisao'; }),
        // produto novo: todas as fotos visíveis ainda a aprovar; existente com cores novas: só algumas
        produtoNovo: vis.length > 0 && vis.every(function (i) { return i.aprovacao === 'revisao'; }),
        trocar: fotos.some(function (i) { return i.aprovacao === 'substituir'; }), info: info,
        ocasioes: (sel.ocasioes_por_modelo || {})[s] || [] };
    }).sort(function (a, b) { return norm(a.nome) < norm(b.nome) ? -1 : 1; });
  }

  function situacaoModelo(m) {
    if (!m.noSite) return { rotulo: 'Fora do site', cls: 'fora' };
    if (m.produtoNovo) return { rotulo: 'Produto novo', cls: 'novo' };
    if (m.novo) return { rotulo: 'Cores novas', cls: 'novo' };
    return { rotulo: 'No site', cls: 'site' };
  }

  function imagemProduto(f) {
    if (S.arquivos[(f.arquivo || '').replace(/^\//, '')]) return S.arquivos[f.arquivo.replace(/^\//, '')].url;
    return (S.op.imagens || {})[f.id] || f.arquivo || ('/img/produtos/' + f.id + '.webp');
  }
  function imagemKit(k) {
    var arq = Object.keys(S.arquivos).find(function (p) { return S.arquivos[p].nome === k.foto; });
    if (arq) return S.arquivos[arq].url;
    var im = S.op.imagens || {};
    return im[k.foto] || im[k.foto_anterior] || im['kitp-' + k.slug] || '';
  }

  // mudanças por item: compara o que está publicado (S.base) com o resultado das operações (S.atual)
  function mudancas() {
    var out = [], antes = {}, depois = {};
    modelosDe(S.base).forEach(function (m) { antes[m.produto] = m; });
    modelosDe(S.atual).forEach(function (m) { depois[m.produto] = m; });
    Object.keys(depois).forEach(function (p) {
      var a = antes[p], d = depois[p], alvo = 'modelo:' + p, tocado = S.ops.some(function (o) { return o.alvo === alvo; });
      if (!tocado) return;
      var tipo, texto;
      if (!a) { tipo = 'entra'; texto = 'Produto novo: ' + d.nome + ' (' + plural(d.fotos.length, 'foto', 'fotos') + ')'; }
      else if (a.noSite && !d.noSite) { tipo = 'sai'; texto = 'Sai do site: ' + d.nome; }
      else if (!a.noSite && d.noSite) { tipo = 'entra'; texto = 'Volta ao site: ' + d.nome; }
      else {
        tipo = 'alterado';
        var det = [], novas = d.fotos.length - a.fotos.length, ai = {};
        a.fotos.forEach(function (f) { ai[f.id] = f; });
        if (novas > 0) det.push(plural(novas, 'cor/foto nova', 'cores/fotos novas'));
        var entra = 0, sai = 0, aprov = 0, edit = 0;
        d.fotos.forEach(function (f) {
          var o = ai[f.id]; if (!o) return;
          if (!VISIVEL[o.aprovacao] && VISIVEL[f.aprovacao]) entra++;
          else if (VISIVEL[o.aprovacao] && !VISIVEL[f.aprovacao]) sai++;
          else if (o.aprovacao === 'revisao' && f.aprovacao === 'aprovada') aprov++;
          else if (JSON.stringify(o) !== JSON.stringify(f)) edit++;
        });
        if (entra) det.push(plural(entra, 'cor volta ao site', 'cores voltam ao site'));
        if (sai) det.push(plural(sai, 'cor sai do site', 'cores saem do site'));
        if (aprov) det.push(plural(aprov, 'foto aprovada', 'fotos aprovadas'));
        if (edit) det.push(plural(edit, 'foto editada', 'fotos editadas'));
        if (JSON.stringify(a.info) !== JSON.stringify(d.info) || JSON.stringify(a.ocasioes) !== JSON.stringify(d.ocasioes) || a.base.id !== d.base.id) det.push('textos e destaques');
        if (sai && !entra && !novas) tipo = 'sai';
        else if ((entra || novas) && !sai) tipo = 'entra';
        texto = d.nome + ': ' + (det.join(', ') || 'alterado');
      }
      out.push({ alvo: alvo, tipo: tipo, texto: texto, img: imagemProduto(d.base), abrir: function () { abrirModelo(p); } });
    });
    var ka = {}; (S.base.kits.kits || []).forEach(function (k) { ka[k.slug] = k; });
    (S.atual.kits.kits || []).forEach(function (k) {
      var alvo = 'kit:' + k.slug; if (!S.ops.some(function (o) { return o.alvo === alvo; })) return;
      var a = ka[k.slug], tipo, texto, fora = function (x) { return x.situacao === 'fora'; };
      if (!a) { tipo = 'entra'; texto = 'Kit novo: ' + k.nome; }
      else if (!fora(a) && fora(k)) { tipo = 'sai'; texto = 'Kit sai do site: ' + k.nome; }
      else if (fora(a) && !fora(k)) { tipo = 'entra'; texto = 'Kit volta ao site: ' + k.nome; }
      else { tipo = 'alterado'; texto = 'Kit alterado: ' + k.nome; }
      out.push({ alvo: alvo, tipo: tipo, texto: texto, img: imagemKit(k), abrir: function () { abrirKit(k.slug); } });
    });
    return out;
  }

  // ------------------------------------------------------------------ validação (mesmas regras do build)
  function validar(D) {
    var erros = (D.conflitos || []).slice(), spec = new RegExp(S.op.spec_re, 'i'), ids = {};
    var cats = S.op.categorias || {};
    D.produtos.imagens.forEach(function (i) {
      var nome = (i.produto || '?') + ' · ' + ((i.cor || {}).nome || '?');
      if (ids[i.id]) erros.push(nome + ': identificador repetido (' + i.id + ')');
      ids[i.id] = 1;
      if (!cats[i.categoria]) erros.push(nome + ': escolha a categoria');
      if (i.vista !== 'grupo' && !/^#[0-9A-Fa-f]{6}$/.test((i.cor || {}).hex || '')) erros.push(nome + ': cor sem código (#RRGGBB)');
      if (!(i.produto && (i.cor || {}).nome && i.alt)) erros.push(nome + ': nome do produto, nome da cor e descrição da foto são obrigatórios');
      if ((i.material || {}).status !== 'confirmado') {
        ['produto', 'modelo', 'alt'].forEach(function (c) {
          var m = spec.exec(i[c] || '');
          if (m) erros.push(nome + ': "' + m[0] + '" em ' + ({ produto: 'nome', modelo: 'descrição do modelo', alt: 'descrição da foto' })[c] + ' (material não confirmado: tire a palavra ou confirme o material)');
        });
      }
    });
    (D.modelos.modelos || []).forEach(function (m) {
      if ((m.titulo_seo || '').length > 65) erros.push(m.produto + ': título no Google com mais de 65 caracteres');
      var d = m.descricao_seo || '';
      if (d && (d.length < 70 || d.length > 160)) erros.push(m.produto + ': descrição no Google precisa ter de 70 a 160 caracteres (tem ' + d.length + ')');
      if ((m.resumo || '').length > 700) erros.push(m.produto + ': resumo com mais de 700 caracteres');
    });
    var kv = {};
    (D.kits.kits || []).forEach(function (k) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(k.slug || '')) erros.push('Kit ' + (k.nome || '?') + ': identificador inválido');
      if (kv[k.slug]) erros.push('Kit ' + k.nome + ': identificador repetido');
      kv[k.slug] = 1;
      if (!(k.nome && k.descricao)) erros.push('Kit ' + (k.nome || k.slug) + ': nome e descrição são obrigatórios');
    });
    return erros;
  }

  // ------------------------------------------------------------------ fotos: preparo no navegador
  /* Redimensiona (lado maior até `max`), grava em WebP (PNG nos navegadores que não gravam WebP) e calcula o hash.
     Devolve { blob, url, b64, ext, largura, altura, bytes, sha256, avisos }. */
  function prepararFoto(file, max, quadrada) {
    return new Promise(function (ok, falha) {
      if (!/^image\//.test(file.type)) return falha(new Error('o arquivo não é uma imagem'));
      var img = new Image(), u = URL.createObjectURL(file);
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h)), avisos = [];
        if (Math.max(w, h) < 800) avisos.push('Foto pequena (' + w + '×' + h + ' px): use pelo menos 1000 px para ficar nítida.');
        if (quadrada && Math.abs(w - h) / Math.max(w, h) > .08) avisos.push('A foto não é quadrada (' + w + '×' + h + '): no catálogo ela aparece com bordas claras.');
        var c = document.createElement('canvas');
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#F6F2EC'; ctx.fillRect(0, 0, c.width, c.height);   // fundo claro do banco onde a foto tiver transparência
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        c.toBlob(function (blob) {
          if (!blob) return falha(new Error('não consegui converter a foto'));
          var ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/jpeg' ? 'jpg' : 'png';
          blob.arrayBuffer().then(function (buf) {
            return crypto.subtle.digest('SHA-256', buf).then(function (h) {
              ok({ blob: blob, url: URL.createObjectURL(blob), b64: b64(buf), ext: ext, largura: c.width, altura: c.height, bytes: buf.byteLength,
                sha256: Array.from(new Uint8Array(h)).map(function (x) { return x.toString(16).padStart(2, '0'); }).join(''), avisos: avisos });
            });
          }).catch(falha);
        }, 'image/webp', 0.92);
      };
      img.onerror = function () { URL.revokeObjectURL(u); falha(new Error('não consegui abrir a imagem')); };
      img.src = u;
    });
  }

  function guardarArquivo(path, foto, nome) {
    S.arquivos[path] = { b64: foto.b64, url: foto.url, nome: nome || '' };
  }

  // ------------------------------------------------------------------ rascunho no navegador
  function salvarRascunho() {
    try {
      if (!S.ops.length) { localStorage.removeItem(RASCUNHO); return; }
      var arqs = {}; Object.keys(S.arquivos).forEach(function (p) { arqs[p] = { b64: S.arquivos[p].b64, nome: S.arquivos[p].nome }; });
      localStorage.setItem(RASCUNHO, JSON.stringify({ ops: S.ops, arquivos: arqs, em: new Date().toISOString() }));
    } catch (e) {
      aviso('As alterações com fotos ficaram grandes demais para guardar no navegador: publique ou salve como rascunho antes de fechar esta página.', 'erro');
    }
  }
  function lerRascunho() {
    try {
      var r = JSON.parse(localStorage.getItem(RASCUNHO) || 'null');
      if (!r || !r.ops) return;
      S.ops = r.ops;
      Object.keys(r.arquivos || {}).forEach(function (p) {
        var a = r.arquivos[p], bin = atob(a.b64), u = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        var tipo = /\.png$/.test(p) ? 'image/png' : /\.jpe?g$/.test(p) ? 'image/jpeg' : 'image/webp';
        S.arquivos[p] = { b64: a.b64, nome: a.nome, url: URL.createObjectURL(new Blob([u], { type: tipo })) };
      });
    } catch (e) { /* rascunho ilegível: começa do zero */ }
  }

  // ------------------------------------------------------------------ desenho
  function recalcular() {
    S.atual = aplicar(S.base, S.ops);
    salvarRascunho();
    var n = mudancas().length;
    $('barra').hidden = !n;
    $('barra-texto').textContent = n ? plural(n, 'alteração não publicada', 'alterações não publicadas') : '';
    $('n-alt').hidden = !n; $('n-alt').textContent = n;
    desenhar();
  }

  function mostrarTab(tab) {
    S.tab = tab;
    document.querySelectorAll('.tabs [role="tab"]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === tab)); });
    ['resumo', 'produtos', 'kits', 'alteracoes'].forEach(function (t) { $('sec-' + t).hidden = t !== tab; });
    try { history.replaceState(null, '', '#' + tab); } catch (e) { /* sem histórico */ }
    desenhar();
  }

  function desenhar() {
    if (!S.atual) return;
    ({ resumo: desenharResumo, produtos: desenharProdutos, kits: desenharKits, alteracoes: desenharAlteracoes })[S.tab]();
    if (S.aberto) redesenharGaveta();
  }

  /* A gaveta é redesenhada depois do evento (change dispara antes de o foco ir para o próximo campo): o foco e o
     cursor voltam para o campo em que a pessoa está. */
  function redesenharGaveta() {
    clearTimeout(S.tg);
    S.tg = setTimeout(function () {
      var a = document.activeElement, id = a && a.id, pos = a && a.selectionStart;
      if (!S.aberto) return;
      S.aberto();
      var b = id && $(id);
      if (b && b !== document.activeElement) { b.focus(); try { if (pos != null) b.setSelectionRange(pos, pos); } catch (e) { /* campo sem cursor */ } }
    }, 0);
  }

  function etiqueta(sit) { return '<span class="tag ' + sit.cls + '">' + esc(sit.rotulo) + '</span>'; }

  function desenharResumo() {
    var ms = modelosDe(S.atual), cats = S.op.categorias || {};
    var noSite = ms.filter(function (m) { return m.noSite; }), novos = ms.filter(function (m) { return m.noSite && m.novo; }), fora = ms.filter(function (m) { return !m.noSite; });
    var prodNovos = novos.filter(function (m) { return m.produtoNovo; }).length, comCores = novos.length - prodNovos;
    var fotos = S.atual.produtos.imagens, fotosNovas = fotos.filter(function (i) { return i.aprovacao === 'revisao'; }).length;
    var kits = S.atual.kits.kits || [], kitsSite = kits.filter(function (k) { return k.situacao !== 'fora'; }).length,
      kitsNovos = kits.filter(function (k) { return k.situacao !== 'fora' && k.novo; }).length;
    var mud = mudancas(), entra = mud.filter(function (m) { return m.tipo === 'entra'; }), sai = mud.filter(function (m) { return m.tipo === 'sai'; });
    var linhas = Object.keys(cats).map(function (c) {
      var d = ms.filter(function (m) { return m.categoria === c; });
      if (!d.length) return '';
      var n = function (f) { return d.filter(f).length; };
      return '<tr><td><button type="button" class="link-btn" data-cat="' + c + '">' + esc(cats[c]) + '</button></td>' +
        '<td class="num">' + n(function (m) { return m.noSite && !m.novo; }) + '</td><td class="num">' + n(function (m) { return m.noSite && m.novo && !m.produtoNovo; }) + '</td>' +
        '<td class="num">' + n(function (m) { return m.produtoNovo; }) + '</td>' +
        '<td class="num">' + n(function (m) { return !m.noSite; }) + '</td><td class="num">' + d.length + '</td></tr>';
    }).join('');
    function lista(itens, vazio) {
      if (!itens.length) return '<p class="muted small">' + vazio + '</p>';
      return '<ul class="lista">' + itens.slice(0, 12).map(function (m, i) {
        return '<li><img src="' + esc(m.img) + '" alt="" loading="lazy"><span class="txt">' + esc(m.texto) + '</span><button type="button" class="btn btn-line btn-sm" data-mud="' + i + '">Abrir</button></li>';
      }).join('') + '</ul>' + (itens.length > 12 ? '<p class="small muted">e mais ' + (itens.length - 12) + ' na aba Alterações.</p>' : '');
    }
    var sec = $('sec-resumo');
    sec.innerHTML = '<h2>Resumo do inventário</h2><p class="intro">O que existe hoje no site, o que é novo e aguarda a sua aprovação e o que está fora. ' +
      'Clique num número para ver a lista. Nada muda no site até você clicar em <b>Publicar</b>.</p>' +
      '<div class="kpis">' +
      '<button type="button" class="kpi" data-sit="site"><b>' + noSite.length + '</b><span>modelos no site (' + plural(kitsSite, 'kit', 'kits') + ')</span></button>' +
      '<button type="button" class="kpi" data-sit="produto-novo"><b>' + prodNovos + '</b><span>produtos novos, aguardando aprovação</span></button>' +
      '<button type="button" class="kpi" data-sit="cores-novas"><b>' + comCores + '</b><span>produtos existentes com cores novas (' + plural(fotosNovas, 'foto nova', 'fotos novas') + ' no total)</span></button>' +
      (kitsNovos ? '<button type="button" class="kpi" data-kits-novos><b>' + kitsNovos + '</b><span>kits novos aguardando aprovação</span></button>' : '') +
      '<button type="button" class="kpi" data-sit="fora"><b>' + fora.length + '</b><span>modelos fora do site</span></button>' +
      '<button type="button" class="kpi" data-ir="alteracoes"><b>' + mud.length + '</b><span>alterações não publicadas</span></button></div>' +
      '<div class="grid2"><div><h3>Existentes × novos, por categoria</h3><div class="table-wrap"><table><thead><tr><th>Categoria</th><th class="num">Existentes</th><th class="num">Existentes com cores novas</th><th class="num">Produtos novos</th><th class="num">Fora do site</th><th class="num">Total</th></tr></thead><tbody>' +
      linhas + '</tbody></table></div>' +
      (novos.length ? '<div class="card" style="margin-top:16px"><h3>Novos aguardando aprovação</h3><p class="small muted">Já aparecem no site com a etiqueta interna "Novo". Confira as fotos e aprove, ou tire do site.</p>' +
        '<div class="rodape-gaveta" style="justify-content:flex-start"><button type="button" class="btn btn-line" data-sit="novo">Ver os ' + novos.length + ' novos</button>' +
        '<button type="button" class="btn btn-ok" id="aprovar-todos">Aprovar todos os novos</button></div></div>' : '') +
      '</div><div><div class="card"><h3>Entra no site</h3>' + lista(entra, 'Nada entrando ainda. Produtos novos, cores novas e itens que voltam aparecem aqui.') + '</div>' +
      '<div class="card"><h3>Sai do site</h3>' + lista(sai, 'Nada saindo. Para tirar um produto, abra-o e clique em "Tirar do site".') + '</div></div></div>';
    sec.querySelectorAll('[data-mud]').forEach(function (b) {
      var item = (b.closest('.card').querySelector('h3').textContent === 'Entra no site' ? entra : sai)[+b.dataset.mud];
      b.onclick = item.abrir;
    });
    var at = $('aprovar-todos');
    if (at) at.onclick = function () {
      if (!confirm('Aprovar as ' + fotosNovas + ' fotos novas? Elas continuam no site, agora como aprovadas.')) return;
      S.atual.produtos.imagens.forEach(function (i) {
        if (i.aprovacao === 'revisao') registrar({ chave: 'foto:' + i.id, alvo: 'modelo:' + i.produto, t: 'foto', id: i.id, campos: { aprovacao: 'aprovada' } }, true);
      });
      recalcular();
    };
  }

  function filtrar(ms) {
    var f = S.filtro, q = norm(f.q);
    return ms.filter(function (m) {
      if (f.cat && m.categoria !== f.cat) return false;
      if (f.sit === 'site' && !m.noSite) return false;
      if (f.sit === 'novo' && !(m.noSite && m.novo)) return false;
      if (f.sit === 'produto-novo' && !m.produtoNovo) return false;
      if (f.sit === 'cores-novas' && !(m.noSite && m.novo && !m.produtoNovo)) return false;
      if (f.sit === 'existente' && !(m.noSite && !m.produtoNovo)) return false;
      if (f.sit === 'fora' && m.noSite) return false;
      if (f.sit === 'pendente' && !S.ops.some(function (o) { return o.alvo === 'modelo:' + m.produto; })) return false;
      if (q && norm(m.nome + ' ' + m.produto + ' ' + m.fotos.map(function (i) { return i.cor.nome; }).join(' ')).indexOf(q) < 0) return false;
      return true;
    });
  }

  function desenharProdutos() {
    var sec = $('sec-produtos'), ms = modelosDe(S.atual), lista = filtrar(ms), f = S.filtro, cats = S.op.categorias || {};
    var conta = function (sit) { var g = S.filtro.sit; S.filtro.sit = sit; var n = filtrar(ms).length; S.filtro.sit = g; return n; };
    var chips = [['', 'Todos'], ['existente', 'Existentes'], ['produto-novo', 'Produtos novos'], ['cores-novas', 'Cores novas'], ['fora', 'Fora do site'], ['pendente', 'Com alteração']].map(function (c) {
      return '<button type="button" class="chip" data-sit-f="' + c[0] + '" aria-pressed="' + (f.sit === c[0]) + '">' + c[1] + '<span class="n">' + conta(c[0]) + '</span></button>';
    }).join('');
    var foco = document.activeElement && document.activeElement.id === 'busca-p';
    sec.innerHTML = '<h2>Produtos</h2><p class="intro">Cada card é um modelo do catálogo com as suas cores. Clique para editar textos, trocar ou enviar fotos, aprovar, tirar do site ou trazer de volta.</p>' +
      '<div class="filtros"><div class="campo"><label for="busca-p">Buscar</label><input id="busca-p" type="search" placeholder="nome ou cor" value="' + esc(f.q) + '"></div>' +
      '<div class="campo"><label for="cat-p">Categoria</label><select id="cat-p"><option value="">Todas</option>' +
      Object.keys(cats).map(function (c) { return '<option value="' + c + '"' + (f.cat === c ? ' selected' : '') + '>' + esc(cats[c]) + '</option>'; }).join('') + '</select></div>' +
      '<div class="acoes-topo"><button type="button" class="btn" id="novo-produto">+ Novo produto</button></div></div>' +
      '<div class="chips" style="margin:0 0 16px">' + chips + '</div>' +
      (lista.length ? '<div class="grade">' + lista.slice(0, S.limite).map(cardModelo).join('') + '</div>' +
        (lista.length > S.limite ? '<p class="mais"><button type="button" class="btn btn-line" id="mais-p">Mostrar mais (' + (lista.length - S.limite) + ')</button></p>' : '')
        : '<p class="vazio">Nenhum produto com esse filtro.</p>');
    var busca = $('busca-p');
    busca.oninput = function () { S.filtro.q = busca.value; S.limite = POR_PAGINA; desenharProdutos(); };
    if (foco) { busca.focus(); busca.setSelectionRange(busca.value.length, busca.value.length); }
    $('cat-p').onchange = function () { S.filtro.cat = this.value; S.limite = POR_PAGINA; desenharProdutos(); };
    sec.querySelectorAll('[data-sit-f]').forEach(function (b) { b.onclick = function () { S.filtro.sit = b.dataset.sitF; S.limite = POR_PAGINA; desenharProdutos(); }; });
    sec.querySelectorAll('[data-produto]').forEach(function (b) { b.onclick = function () { abrirModelo(b.dataset.produto); }; });
    $('novo-produto').onclick = novoProduto;
    if ($('mais-p')) $('mais-p').onclick = function () { S.limite += POR_PAGINA; desenharProdutos(); };
  }

  function cardModelo(m) {
    var sit = situacaoModelo(m), pend = S.ops.some(function (o) { return o.alvo === 'modelo:' + m.produto; });
    var cores = m.fotos.filter(function (i) { return (i.vista || 'frente') === 'frente'; });
    return '<button type="button" class="item' + (m.noSite ? '' : ' fora') + (pend ? ' pendente' : '') + '" data-produto="' + esc(m.produto) + '">' +
      '<span class="foto"><img src="' + esc(imagemProduto(m.base)) + '" alt="" loading="lazy"></span>' +
      '<span class="info"><span class="nome">' + esc(m.nome) + '</span>' +
      '<span class="meta">' + esc((S.op.categorias || {})[m.categoria] || m.categoria) + ' · ' + plural(cores.length, 'cor', 'cores') + '</span>' +
      '<span class="bolinhas">' + cores.slice(0, 14).map(function (i) { return '<i style="background:' + esc(i.cor.hex) + (VISIVEL[i.aprovacao] ? '' : ';opacity:.3') + '" title="' + esc(i.cor.nome) + '"></i>'; }).join('') + '</span>' +
      '<span class="tags">' + etiqueta(sit) + (m.trocar ? etiqueta({ rotulo: 'Trocar foto', cls: 'trocar' }) : '') + (pend ? etiqueta({ rotulo: 'Alterado', cls: 'alterado' }) : '') + '</span></span></button>';
  }

  // ------------------------------------------------------------------ gaveta
  function abrirGaveta(titulo, desenho) {
    $('gaveta-titulo').textContent = titulo;
    $('gaveta').hidden = false; $('veu').hidden = false;
    document.body.style.overflow = 'hidden';
    S.aberto = desenho;
    desenho();
    setTimeout(function () { var f = $('gaveta').querySelector('input, select, textarea, button:not(.fechar)'); if (f) f.focus(); }, 30);
  }
  function fecharGaveta() {
    $('gaveta').hidden = true; $('veu').hidden = true; document.body.style.overflow = '';
    S.aberto = null; desenhar();
  }

  function campo(id, rotulo, html, dica) {
    return '<div class="campo"><label for="' + id + '">' + rotulo + '</label>' + html + (dica ? '<p class="dica">' + dica + '</p>' : '') + '</div>';
  }
  function texto(id, valor, extra) { return '<input id="' + id + '" type="text" value="' + esc(valor) + '"' + (extra || '') + '>'; }
  function upload(id, rotulo) { return '<label class="upload" style="margin:0"><input id="' + id + '" type="file" accept="image/*"><span>' + rotulo + '</span></label>'; }

  /* Gaveta de um modelo: situação, textos do modelo (modelos.json), ocasiões e foto principal (selecoes.json) e as
     fotos/cores (produtos.json). Cada campo grava uma operação ao sair do campo (change). */
  function abrirModelo(produto) {
    var scroll = 0;
    abrirGaveta('Produto', function desenho() {
      var m = modelosDe(S.atual).find(function (x) { return x.produto === produto; });
      var corpo = $('gaveta-corpo');
      if (!m) { corpo.innerHTML = '<p class="vazio">Este produto não existe mais.</p>'; return; }
      scroll = corpo.scrollTop;
      $('gaveta-titulo').textContent = m.nome;
      var info = m.info || {}, cats = S.op.categorias || {}, occ = S.op.ocasioes || {}, alvo = 'modelo:' + produto;
      var sit = situacaoModelo(m), med = info.medidas || { valor: '', status: 'a_confirmar' };
      var html = '<div class="bloco"><div class="situacao"><p>' + etiqueta(sit) + ' ' +
        (m.noSite ? (m.produtoNovo ? 'Produto novo: já aparece no site, aguardando a sua aprovação.' : m.novo ? 'Aparece no site; tem cores novas aguardando a sua aprovação.' : 'Aparece no site.') : 'Não aparece no site. Textos e fotos ficam guardados para quando voltar.') + '</p>' +
        (m.noSite ? (m.novo ? '<button type="button" class="btn btn-ok btn-sm" id="m-aprovar">Aprovar fotos novas</button>' : '') + '<button type="button" class="btn btn-sai btn-sm" id="m-tirar">Tirar do site</button>'
          : '<button type="button" class="btn btn-ok btn-sm" id="m-voltar">Voltar ao site</button>') +
        (S.ops.some(function (o) { return o.alvo === alvo; }) ? '<button type="button" class="link-btn small" id="m-desfazer">Desfazer alterações deste produto</button>' : '') +
        '</div><p class="small muted" style="margin:8px 0 0">Página: <a href="/catalogo/' + m.slug + '/" target="_blank" rel="noopener">/catalogo/' + m.slug + '/</a></p></div>';
      html += '<div class="bloco"><h3>Textos do produto</h3>' +
        campo('m-nome', 'Nome no site', texto('m-nome', info.nome || ''), 'Vazio: usa "' + esc(produto) + '" (nome do banco de imagens, que define o endereço da página).') +
        '<div class="linha">' + campo('m-cat', 'Categoria', '<select id="m-cat">' + Object.keys(cats).map(function (c) { return '<option value="' + c + '"' + (m.categoria === c ? ' selected' : '') + '>' + esc(cats[c]) + '</option>'; }).join('') + '</select>') +
        campo('m-gen', 'Gênero do nome', '<select id="m-gen"><option value="">—</option><option value="f"' + (info.genero === 'f' ? ' selected' : '') + '>feminino (personalizada)</option><option value="m"' + (info.genero === 'm' ? ' selected' : '') + '>masculino (personalizado)</option></select>') + '</div>' +
        campo('m-desc', 'Descrição curta do modelo', texto('m-desc', m.base.modelo || ''), 'Formato da peça, sem material (ex.: "Tampa de rosca e mosquetão"). Vale para todas as cores.') +
        campo('m-resumo', 'Resumo (página do produto)', '<textarea id="m-resumo">' + esc(info.resumo || '') + '</textarea>', 'Duas ou três frases. Sem material, capacidade, preço ou prazo.') +
        campo('m-usos', 'Ideal para', texto('m-usos', (info.usos || []).join(', ')), 'Até 4 usos, separados por vírgula.') +
        '<div class="linha">' + campo('m-med', 'Medidas', texto('m-med', med.valor || '')) +
        campo('m-med-s', 'Situação das medidas', '<select id="m-med-s"><option value="a_confirmar">A confirmar (não aparece)</option><option value="confirmado"' + (med.status === 'confirmado' ? ' selected' : '') + '>Confirmado (aparece no site)</option></select>') + '</div>' +
        '<div class="campo"><label>Ocasiões</label><div class="checks">' + Object.keys(occ).map(function (k) {
          return '<label><input type="checkbox" data-occ="' + k + '"' + (m.ocasioes.indexOf(k) >= 0 ? ' checked' : '') + '> ' + esc(occ[k]) + '</label>';
        }).join('') + '</div><p class="dica">Em quais ocasiões o produto aparece em /brindes-por-ocasiao/.</p></div>' +
        '<details><summary class="small">Google (opcional)</summary><div style="margin-top:10px">' +
        campo('m-tit', 'Título no Google', texto('m-tit', info.titulo_seo || '', ' maxlength="65"'), 'Até 65 caracteres. Vazio: o site gera.') +
        campo('m-dseo', 'Descrição no Google', '<textarea id="m-dseo" maxlength="160">' + esc(info.descricao_seo || '') + '</textarea>', 'De 70 a 160 caracteres. Vazio: o site gera.') + '</div></details></div>';
      html += '<div class="bloco"><h3>Fotos e cores</h3><p class="small muted">A foto marcada como principal abre o card no catálogo. "Fora do site" esconde só aquela cor.</p><div class="fotos">' +
        m.fotos.map(function (f) { return fotoEditor(f, m); }).join('') + '</div>' +
        '<h3 style="margin-top:18px">Adicionar cor</h3>' + formCor('nc', m) + '</div>';
      corpo.innerHTML = html;
      corpo.scrollTop = scroll;

      function opModelo(campos) { registrar({ chave: 'modelo:' + produto, alvo: alvo, t: 'modelo', produto: produto, campos: campos }); }
      function opProd(campos) { registrar({ chave: 'prod:' + produto, alvo: alvo, t: 'prod', produto: produto, campos: campos }); }
      function todas(aprov, filtro) {
        m.fotos.forEach(function (f) { if (filtro(f)) registrar({ chave: 'foto:' + f.id, alvo: alvo, t: 'foto', id: f.id, campos: { aprovacao: aprov } }, true); });
        recalcular();
      }
      if ($('m-tirar')) $('m-tirar').onclick = function () {
        if (confirm('Tirar "' + m.nome + '" do site? Todas as cores saem; textos e fotos ficam guardados.')) todas('retirada', function (f) { return VISIVEL[f.aprovacao]; });
      };
      if ($('m-voltar')) $('m-voltar').onclick = function () { todas('aprovada', function (f) { return f.aprovacao === 'retirada'; }); };
      if ($('m-aprovar')) $('m-aprovar').onclick = function () { todas('aprovada', function (f) { return f.aprovacao === 'revisao'; }); };
      if ($('m-desfazer')) $('m-desfazer').onclick = function () { desfazer(alvo); };
      $('m-nome').onchange = function () { opModelo({ nome: this.value.trim() }); };
      $('m-cat').onchange = function () { opProd({ categoria: this.value }); };
      $('m-gen').onchange = function () { opModelo({ genero: this.value }); };
      $('m-desc').onchange = function () { opProd({ modelo: this.value.trim() }); };
      $('m-resumo').onchange = function () { opModelo({ resumo: this.value.trim() }); };
      $('m-usos').onchange = function () { opModelo({ usos: this.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 4) }); };
      $('m-med').onchange = function () { opModelo({ medidas: { valor: this.value.trim() } }); };
      $('m-med-s').onchange = function () { opModelo({ medidas: { status: this.value } }); };
      $('m-tit').onchange = function () { opModelo({ titulo_seo: this.value.trim() }); };
      $('m-dseo').onchange = function () { opModelo({ descricao_seo: this.value.trim() }); };
      corpo.querySelectorAll('[data-occ]').forEach(function (c) {
        c.onchange = function () {
          var l = Array.prototype.filter.call(corpo.querySelectorAll('[data-occ]'), function (x) { return x.checked; }).map(function (x) { return x.dataset.occ; });
          registrar({ chave: 'sel:ocasioes:' + m.slug, alvo: alvo, t: 'sel', chave2: 'ocasioes_por_modelo', slug: m.slug, valor: l.length ? l : null });
        };
      });
      m.fotos.forEach(function (f) { ligarFoto(f, m, alvo); });
      ligarFormCor('nc', m, alvo);
    });
  }

  function fotoEditor(f, m) {
    var id = 'f-' + slug(f.id), sit = SIT[f.aprovacao] || SIT.revisao, mat = f.material || {}, tec = f.tecnica || {};
    var principal = m.base && m.base.id === f.id;
    return '<div class="fotoed' + (VISIVEL[f.aprovacao] ? '' : ' fora') + '" data-foto="' + esc(f.id) + '">' +
      '<div class="lado"><img class="previa" src="' + esc(imagemProduto(f)) + '" alt="' + esc(f.alt) + '" loading="lazy">' + upload(id + '-arq', 'Trocar foto') + '</div>' +
      '<div class="campos"><div class="topo-foto">' + etiqueta(sit) + (f.vista && f.vista !== 'frente' ? etiqueta({ rotulo: ({ grupo: 'Foto de grupo', verso: 'Verso', detalhe: 'Detalhe' })[f.vista] || f.vista, cls: '' }) : '') +
      (principal ? '<span class="tag site">Foto principal</span>' : (VISIVEL[f.aprovacao] && (f.vista || 'frente') === 'frente' ? '<button type="button" class="link-btn small" id="' + id + '-base">Usar como principal</button>' : '')) + '</div>' +
      '<div class="linha">' + campo(id + '-sit', 'Situação', '<select id="' + id + '-sit">' + Object.keys(SIT).map(function (k) { return '<option value="' + k + '"' + (f.aprovacao === k ? ' selected' : '') + '>' + SIT[k].rotulo + ' — ' + SIT[k].ajuda + '</option>'; }).join('') + '</select>') +
      '<div class="linha-cor">' + campo(id + '-cor', 'Nome da cor', texto(id + '-cor', f.cor.nome)) + '<input type="color" id="' + id + '-hex" value="' + esc(/^#[0-9a-f]{6}$/i.test(f.cor.hex) ? f.cor.hex : '#cccccc') + '" aria-label="Cor da bolinha" style="margin-bottom:14px"></div></div>' +
      campo(id + '-alt', 'Descrição da foto (texto alternativo)', texto(id + '-alt', f.alt), 'O que a foto mostra e onde está a marca. Sem material.') +
      '<div class="linha">' + campo(id + '-mat', 'Material', texto(id + '-mat', mat.valor || '', ' placeholder="ex.: inox"') + '<label class="small" style="font-weight:500;margin-top:4px"><input type="checkbox" id="' + id + '-matok"' + (mat.status === 'confirmado' ? ' checked' : '') + '> confirmado (aparece no site)</label>') +
      campo(id + '-tec', 'Técnica de personalização', texto(id + '-tec', tec.valor || '', ' placeholder="ex.: gravação a laser"') + '<label class="small" style="font-weight:500;margin-top:4px"><input type="checkbox" id="' + id + '-tecok"' + (tec.status === 'confirmado' ? ' checked' : '') + '> confirmada</label>') + '</div>' +
      '<p class="small muted" style="margin:0">' + esc(f.id) + (f.origem ? ' · ' + esc(f.origem.slice(0, 90)) + (f.origem.length > 90 ? '…' : '') : '') + '</p></div></div>';
  }

  function ligarFoto(f, m, alvo) {
    var id = 'f-' + slug(f.id), op = function (campos) { registrar({ chave: 'foto:' + f.id, alvo: alvo, t: 'foto', id: f.id, campos: campos }); };
    $(id + '-sit').onchange = function () { op({ aprovacao: this.value }); };
    $(id + '-cor').onchange = function () { op({ cor: { nome: this.value.trim() } }); };
    $(id + '-hex').onchange = function () { op({ cor: { hex: this.value.toUpperCase() } }); };
    $(id + '-alt').onchange = function () { op({ alt: this.value.trim() }); };
    $(id + '-mat').onchange = function () { op({ material: { valor: this.value.trim() } }); };
    $(id + '-matok').onchange = function () { op({ material: { status: this.checked ? 'confirmado' : 'a_confirmar' } }); };
    $(id + '-tec').onchange = function () { op({ tecnica: { valor: this.value.trim() } }); };
    $(id + '-tecok').onchange = function () { op({ tecnica: { status: this.checked ? 'confirmado' : 'a_confirmar' } }); };
    if ($(id + '-base')) $(id + '-base').onclick = function () { registrar({ chave: 'sel:base:' + m.slug, alvo: alvo, t: 'sel', chave2: 'foto_base', slug: m.slug, valor: f.id }); };
    $(id + '-arq').onchange = function () {
      var file = this.files[0]; if (!file) return;
      prepararFoto(file, 1254, true).then(function (foto) {
        if (foto.avisos.length && !confirm(foto.avisos.join('\n') + '\n\nUsar mesmo assim?')) return;
        var path = 'img/produtos/' + f.id + '.' + foto.ext;
        guardarArquivo(path, foto, f.id);
        op({ arquivo: '/' + path, largura: foto.largura, altura: foto.altura, bytes: foto.bytes, sha256: foto.sha256, mestre: null, atualizado_em: hoje(),
          origem: 'Foto enviada pelo Inventário (/admin/inventario/) em ' + hojeBR() + '.', aprovacao: f.aprovacao === 'substituir' ? 'aprovada' : f.aprovacao });
      }).catch(function (e) { alert('Não consegui usar essa foto: ' + e.message); });
    };
  }

  function formCor(p, m) {
    return '<div class="linha"><div class="linha-cor">' + campo(p + '-cor', 'Nome da cor', texto(p + '-cor', '', ' placeholder="ex.: Azul royal"')) +
      '<input type="color" id="' + p + '-hex" value="#1F4FB8" aria-label="Cor da bolinha" style="margin-bottom:14px"></div>' +
      campo(p + '-sit', 'Situação', '<select id="' + p + '-sit"><option value="revisao">Novo (aparece no site, a aprovar)</option><option value="aprovada">No site (aprovada)</option><option value="retirada">Fora do site por enquanto</option></select>') + '</div>' +
      campo(p + '-alt', 'Descrição da foto', texto(p + '-alt', '', ' placeholder="' + esc(m ? m.nome + ' azul royal, com a marca TaMa em branco.' : '') + '"'), 'Vazio: "' + esc(m ? m.nome : 'Produto') + ' <cor>, com a marca TaMa." Sem material.') +
      '<div class="solta" id="' + p + '-solta"><p style="margin:0 0 8px">Arraste a foto aqui ou</p>' + upload(p + '-arq', 'Escolher foto') +
      '<p class="dica">Quadrada, fundo claro, de preferência 1254 px. Formatos JPG, PNG ou WebP.</p><ul class="avisos" id="' + p + '-avisos" hidden></ul></div>' +
      '<p class="rodape-gaveta" style="margin-top:12px"><button type="button" class="btn" id="' + p + '-ok" disabled>Adicionar cor</button></p>';
  }

  function ligarFormCor(p, m, alvo, aoCriar) {
    var foto = null, solta = $(p + '-solta');
    function usar(file) {
      prepararFoto(file, 1254, true).then(function (f) {
        foto = f;
        solta.querySelector('img') && solta.removeChild(solta.querySelector('img'));
        var img = document.createElement('img'); img.src = f.url; img.alt = ''; solta.insertBefore(img, solta.firstChild);
        var av = $(p + '-avisos'); av.hidden = !f.avisos.length; av.innerHTML = f.avisos.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('');
        $(p + '-ok').disabled = false;
      }).catch(function (e) { alert('Não consegui usar essa foto: ' + e.message); });
    }
    $(p + '-arq').onchange = function () { if (this.files[0]) usar(this.files[0]); };
    solta.ondragover = function (e) { e.preventDefault(); solta.classList.add('sobre'); };
    solta.ondragleave = function () { solta.classList.remove('sobre'); };
    solta.ondrop = function (e) { e.preventDefault(); solta.classList.remove('sobre'); if (e.dataTransfer.files[0]) usar(e.dataTransfer.files[0]); };
    $(p + '-ok').onclick = function () {
      var cor = $(p + '-cor').value.trim();
      if (!cor) { alert('Escreva o nome da cor.'); $(p + '-cor').focus(); return; }
      if (!foto) { alert('Escolha a foto.'); return; }
      var ent = aoCriar ? aoCriar(cor) : null;
      var mm = ent ? ent.modelo : m;
      if (!mm) return;
      // mesmo prefixo das fotos que o produto já tem (ex.: agenda-diaria~verde), para o banco continuar agrupado por nome de arquivo
      var id = (mm.base && mm.base.id ? mm.base.id.split('~')[0] : slug(mm.produto)) + '~' + slug(cor);
      if (S.atual.produtos.imagens.some(function (i) { return i.id === id; })) { alert('Esse produto já tem a cor "' + cor + '". Use outro nome ou troque a foto da cor existente.'); return; }
      var path = 'img/produtos/' + id + '.' + foto.ext;
      guardarArquivo(path, foto, id);
      var alt = $(p + '-alt').value.trim() || (mm.nome + ' ' + cor.toLowerCase() + ', com a marca TaMa.');
      registrar({ chave: 'nova:' + id, alvo: 'modelo:' + mm.produto, t: 'foto_nova', entrada: {
        id: id, produto: mm.produto, categoria: mm.categoria, modelo: mm.descricao != null ? mm.descricao : ((mm.base || {}).modelo || ''),
        cor: { nome: cor, hex: $(p + '-hex').value.toUpperCase() },
        material: { valor: '', status: 'a_confirmar' }, tecnica: { valor: '', status: 'a_confirmar' }, fornecedor: null, sku: null, estoque: null,
        alt: alt, uso: ['catalogo'], ilustrativa: true, aprovacao: $(p + '-sit').value,
        origem: 'Foto enviada pelo Inventário (/admin/inventario/) em ' + hojeBR() + '.', substitui: null, observacao: '',
        arquivo: '/' + path, mestre: null, largura: foto.largura, altura: foto.altura, sha256: foto.sha256, bytes: foto.bytes, atualizado_em: hoje() } });
      if (ent && ent.depois) ent.depois(id);
    };
  }

  function novoProduto() {
    abrirGaveta('Novo produto', function () {
      if ($('np-nome')) return;   // o formulário não é redesenhado enquanto se preenche
      var cats = S.op.categorias || {}, occ = S.op.ocasioes || {};
      $('gaveta-corpo').innerHTML = '<div class="bloco"><h3>Produto</h3>' +
        campo('np-nome', 'Nome do produto', texto('np-nome', '', ' placeholder="ex.: Caneca esmaltada"'), 'Define o endereço da página (/catalogo/caneca-esmaltada/). Sem material nem capacidade.') +
        '<div class="linha">' + campo('np-cat', 'Categoria', '<select id="np-cat">' + Object.keys(cats).map(function (c) { return '<option value="' + c + '">' + esc(cats[c]) + '</option>'; }).join('') + '</select>') +
        campo('np-gen', 'Gênero do nome', '<select id="np-gen"><option value="f">feminino (personalizada)</option><option value="m">masculino (personalizado)</option></select>') + '</div>' +
        campo('np-desc', 'Descrição curta do modelo', texto('np-desc', '', ' placeholder="ex.: Borda contrastante e alça"')) +
        campo('np-resumo', 'Resumo', '<textarea id="np-resumo" placeholder="Para que serve, quem recebe e em que ações combina."></textarea>') +
        campo('np-usos', 'Ideal para', texto('np-usos', '', ' placeholder="Kits de boas-vindas, Eventos, Fim de ano"')) +
        '<div class="campo"><label>Ocasiões</label><div class="checks">' + Object.keys(occ).map(function (k) { return '<label><input type="checkbox" data-npocc="' + k + '"> ' + esc(occ[k]) + '</label>'; }).join('') + '</div></div></div>' +
        '<div class="bloco"><h3>Primeira cor e foto</h3>' + formCor('np', null) + '</div>';
      $('np-ok').textContent = 'Criar produto';
      ligarFormCor('np', null, null, function () {
        var nome = $('np-nome').value.trim(), s = slug(nome);
        if (!nome) { alert('Escreva o nome do produto.'); $('np-nome').focus(); return null; }
        if (modelosDe(S.atual).some(function (x) { return x.slug === s; })) { alert('Já existe um produto com esse nome. Abra-o e adicione a cor por lá.'); return null; }
        var spec = new RegExp(S.op.spec_re, 'i'), achou = spec.exec(nome + ' ' + $('np-desc').value);
        if (achou && !confirm('"' + achou[0] + '" é material ou capacidade e o site não aceita enquanto o material não for confirmado. Continuar mesmo assim (vai aparecer como erro)?')) return null;
        var modelo = { produto: nome, nome: nome, categoria: $('np-cat').value, descricao: $('np-desc').value.trim() };
        return { modelo: modelo, depois: function (id) {
          var alvo = 'modelo:' + nome;
          registrar({ chave: 'modelo:' + nome, alvo: alvo, t: 'modelo', produto: nome, campos: { genero: $('np-gen').value, resumo: $('np-resumo').value.trim(),
            usos: $('np-usos').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 4) } });
          var l = Array.prototype.filter.call(document.querySelectorAll('[data-npocc]'), function (x) { return x.checked; }).map(function (x) { return x.dataset.npocc; });
          if (l.length) registrar({ chave: 'sel:ocasioes:' + s, alvo: alvo, t: 'sel', chave2: 'ocasioes_por_modelo', slug: s, valor: l });
          registrar({ chave: 'sel:base:' + s, alvo: alvo, t: 'sel', chave2: 'foto_base', slug: s, valor: id });
          registrar({ chave: 'prio:' + s, alvo: alvo, t: 'prioridade', slug: s });
          abrirModelo(nome);
        } };
      });
    });
  }

  // ------------------------------------------------------------------ kits
  function kitsDe(D) {
    var k = D.kits, tipos = k.tipos || [];
    return (k.kits || []).map(function (x) {
      return { kit: x, noSite: x.situacao !== 'fora', novo: !!x.novo, home: (k.home || []).indexOf(x.slug) >= 0, fim: (k.fim_de_ano || []).indexOf(x.slug) >= 0,
        tipos: tipos.filter(function (t) { return (t.kits || []).indexOf(x.slug) >= 0; }) };
    });
  }

  function desenharKits() {
    var sec = $('sec-kits'), f = S.kfiltro, q = norm(f.q), todos = kitsDe(S.atual);
    var lista = todos.filter(function (x) {
      if (f.sit === 'site' && !x.noSite) return false;
      if (f.sit === 'fora' && x.noSite) return false;
      if (f.sit === 'novo' && !(x.noSite && x.novo)) return false;
      if (q && norm(x.kit.nome + ' ' + x.kit.descricao).indexOf(q) < 0) return false;
      return true;
    });
    var foco = document.activeElement && document.activeElement.id === 'busca-k';
    var chips = [['', 'Todos'], ['site', 'No site'], ['novo', 'Novos'], ['fora', 'Fora do site']].map(function (c) {
      return '<button type="button" class="chip" data-ksit="' + c[0] + '" aria-pressed="' + (f.sit === c[0]) + '">' + c[1] + '</button>';
    }).join('');
    sec.innerHTML = '<h2>Kits</h2><p class="intro">Os kits da home, de /kits-corporativos/ (por tipo) e da página de fim de ano. Clique para editar texto e foto, escolher onde o kit aparece ou tirá-lo do site.</p>' +
      '<div class="filtros"><div class="campo"><label for="busca-k">Buscar</label><input id="busca-k" type="search" value="' + esc(f.q) + '"></div>' +
      '<div class="acoes-topo"><button type="button" class="btn" id="novo-kit">+ Novo kit</button></div></div><div class="chips" style="margin:0 0 16px">' + chips + '</div>' +
      (lista.length ? '<div class="grade kits">' + lista.map(function (x) {
        var k = x.kit, pend = S.ops.some(function (o) { return o.alvo === 'kit:' + k.slug; });
        return '<button type="button" class="item' + (x.noSite ? '' : ' fora') + (pend ? ' pendente' : '') + '" data-kit="' + esc(k.slug) + '"><span class="foto">' +
          (imagemKit(k) ? '<img src="' + esc(imagemKit(k)) + '" alt="" loading="lazy">' : '<span class="small muted">sem foto</span>') + '</span>' +
          '<span class="info"><span class="nome">' + esc(k.nome) + '</span><span class="meta">' + esc(x.tipos.map(function (t) { return t.titulo; }).join(' · ') || 'sem tipo') + '</span>' +
          '<span class="tags">' + etiqueta(!x.noSite ? { rotulo: 'Fora do site', cls: 'fora' } : x.novo ? { rotulo: 'Novo', cls: 'novo' } : { rotulo: 'No site', cls: 'site' }) +
          (x.home ? etiqueta({ rotulo: 'Home', cls: '' }) : '') + (x.fim ? etiqueta({ rotulo: 'Fim de ano', cls: '' }) : '') + (pend ? etiqueta({ rotulo: 'Alterado', cls: 'alterado' }) : '') + '</span></span></button>';
      }).join('') + '</div>' : '<p class="vazio">Nenhum kit com esse filtro.</p>');
    var busca = $('busca-k');
    busca.oninput = function () { S.kfiltro.q = busca.value; desenharKits(); };
    if (foco) { busca.focus(); busca.setSelectionRange(busca.value.length, busca.value.length); }
    sec.querySelectorAll('[data-ksit]').forEach(function (b) { b.onclick = function () { S.kfiltro.sit = b.dataset.ksit; desenharKits(); }; });
    sec.querySelectorAll('[data-kit]').forEach(function (b) { b.onclick = function () { abrirKit(b.dataset.kit); }; });
    $('novo-kit').onclick = novoKit;
  }

  function abrirKit(s) {
    abrirGaveta('Kit', function () {
      var x = kitsDe(S.atual).find(function (y) { return y.kit.slug === s; }), corpo = $('gaveta-corpo');
      if (!x) { corpo.innerHTML = '<p class="vazio">Este kit não existe mais.</p>'; return; }
      var k = x.kit, alvo = 'kit:' + s, scroll = corpo.scrollTop, img = imagemKit(k);
      $('gaveta-titulo').textContent = k.nome;
      corpo.innerHTML = '<div class="bloco"><div class="situacao"><p>' + etiqueta(!x.noSite ? { rotulo: 'Fora do site', cls: 'fora' } : x.novo ? { rotulo: 'Novo', cls: 'novo' } : { rotulo: 'No site', cls: 'site' }) + ' ' +
        (x.noSite ? (x.novo ? 'Kit novo: já aparece nas páginas marcadas abaixo, aguardando a sua aprovação.' : 'Aparece nas páginas marcadas abaixo.') : 'Não aparece em nenhuma página; os dados ficam guardados.') + '</p>' +
        (x.noSite && x.novo ? '<button type="button" class="btn btn-ok btn-sm" id="k-aprovar">Aprovar kit</button>' : '') +
        (x.noSite ? '<button type="button" class="btn btn-sai btn-sm" id="k-tirar">Tirar do site</button>' : '<button type="button" class="btn btn-ok btn-sm" id="k-voltar">Voltar ao site</button>') +
        (S.ops.some(function (o) { return o.alvo === alvo; }) ? '<button type="button" class="link-btn small" id="k-desfazer">Desfazer alterações deste kit</button>' : '') + '</div></div>' +
        '<div class="bloco"><h3>Foto</h3><div class="solta" id="k-solta">' + (img ? '<img src="' + esc(img) + '" alt="">' : '') +
        upload('k-arq', 'Trocar foto') + '<p class="dica">Horizontal (3:2), de preferência 1920 px de largura. Use a marca TaMa ou uma marca fictícia.</p></div>' +
        '<div class="linha" style="margin-top:12px">' + campo('k-marca', 'Marca na foto', texto('k-marca', k.marca_ficticia || '', ' placeholder="vazio = marca TaMa"'), 'Nome da marca fictícia, se a foto não mostra a TaMa.') +
        campo('k-caixa', 'Cor da caixa na foto', texto('k-caixa', k.cor_caixa || '', ' placeholder="ex.: caixa preta com berço"')) + '</div></div>' +
        '<div class="bloco"><h3>Textos</h3>' + campo('k-nome', 'Nome do kit', texto('k-nome', k.nome)) +
        campo('k-desc', 'Descrição', '<textarea id="k-desc">' + esc(k.descricao) + '</textarea>', 'Peças e caixa, sem material. Kits de bebida: só acessórios.') + '</div>' +
        '<div class="bloco"><h3>Onde aparece</h3><div class="checks" style="margin-bottom:12px"><label><input type="checkbox" id="k-home"' + (x.home ? ' checked' : '') + '> Home</label>' +
        '<label><input type="checkbox" id="k-fim"' + (x.fim ? ' checked' : '') + '> Página de fim de ano</label></div>' +
        '<label>Tipos em /kits-corporativos/</label><div class="checks">' + (S.atual.kits.tipos || []).map(function (t) {
          return '<label><input type="checkbox" data-tipo="' + esc(t.ancora) + '"' + ((t.kits || []).indexOf(s) >= 0 ? ' checked' : '') + '> ' + esc(t.titulo) + '</label>';
        }).join('') + '</div><p class="dica">A home mostra os dois primeiros kits marcados como destaque.</p></div>';
      corpo.scrollTop = scroll;
      function op(campos) { registrar({ chave: 'kit:' + s, alvo: alvo, t: 'kit', slug: s, campos: campos }); }
      function lista(nome, dentro, ancora) { registrar({ chave: 'kitl:' + s + ':' + nome + ':' + (ancora || ''), alvo: alvo, t: 'kit_lista', slug: s, lista: nome, ancora: ancora, dentro: dentro }); }
      if ($('k-tirar')) $('k-tirar').onclick = function () { if (confirm('Tirar "' + k.nome + '" do site?')) op({ situacao: 'fora' }); };
      if ($('k-voltar')) $('k-voltar').onclick = function () { op({ situacao: 'no_site' }); };
      if ($('k-aprovar')) $('k-aprovar').onclick = function () { op({ novo: null }); };
      if ($('k-desfazer')) $('k-desfazer').onclick = function () { desfazer(alvo); };
      $('k-nome').onchange = function () { op({ nome: this.value.trim() }); };
      $('k-desc').onchange = function () { op({ descricao: this.value.trim() }); };
      $('k-marca').onchange = function () { op({ marca_ficticia: this.value.trim() }); };
      $('k-caixa').onchange = function () { op({ cor_caixa: this.value.trim() }); };
      $('k-home').onchange = function () { lista('home', this.checked); };
      $('k-fim').onchange = function () { lista('fim_de_ano', this.checked); };
      corpo.querySelectorAll('[data-tipo]').forEach(function (c) { c.onchange = function () { lista('tipo', c.checked, c.dataset.tipo); }; });
      $('k-arq').onchange = function () {
        var file = this.files[0]; if (!file) return;
        prepararFoto(file, 1920, false).then(function (foto) {
          if (foto.avisos.length && !confirm(foto.avisos.join('\n') + '\n\nUsar mesmo assim?')) return;
          var nome = 'kit-' + s + '-' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
          guardarArquivo('img/v2/' + nome + '.' + foto.ext, foto, nome);
          op({ foto: nome, foto_anterior: k.foto || null });
        }).catch(function (e) { alert('Não consegui usar essa foto: ' + e.message); });
      };
    });
  }

  function novoKit() {
    abrirGaveta('Novo kit', function () {
      if ($('nk-nome')) return;
      $('gaveta-corpo').innerHTML = '<div class="bloco">' + campo('nk-nome', 'Nome do kit', texto('nk-nome', '', ' placeholder="ex.: Kit Churrasco"')) +
        campo('nk-desc', 'Descrição', '<textarea id="nk-desc" placeholder="Peças e caixa, sem material."></textarea>') +
        '<div class="linha">' + campo('nk-marca', 'Marca na foto', texto('nk-marca', '', ' placeholder="vazio = marca TaMa"')) + campo('nk-caixa', 'Cor da caixa na foto', texto('nk-caixa', '')) + '</div>' +
        '<div class="solta" id="nk-solta"><p style="margin:0 0 8px">Foto do kit</p>' + upload('nk-arq', 'Escolher foto') + '<p class="dica">Horizontal (3:2), de preferência 1920 px.</p></div>' +
        '<p class="rodape-gaveta" style="margin-top:12px"><button type="button" class="btn" id="nk-ok" disabled>Criar kit</button></p></div>';
      var foto = null;
      $('nk-arq').onchange = function () {
        var file = this.files[0]; if (!file) return;
        prepararFoto(file, 1920, false).then(function (f) {
          foto = f; var solta = $('nk-solta'), im = solta.querySelector('img') || solta.insertBefore(document.createElement('img'), solta.firstChild);
          im.src = f.url; im.alt = ''; $('nk-ok').disabled = false;
        }).catch(function (e) { alert('Não consegui usar essa foto: ' + e.message); });
      };
      $('nk-ok').onclick = function () {
        var nome = $('nk-nome').value.trim(), desc = $('nk-desc').value.trim(), s = slug(nome);
        if (!nome || !desc) { alert('Preencha o nome e a descrição.'); return; }
        if ((S.atual.kits.kits || []).some(function (k) { return k.slug === s; })) { alert('Já existe um kit com esse nome.'); return; }
        var arq = 'kit-' + s + '-' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
        guardarArquivo('img/v2/' + arq + '.' + foto.ext, foto, arq);
        registrar({ chave: 'kitnovo:' + s, alvo: 'kit:' + s, t: 'kit_novo', kit: { slug: s, nome: nome, descricao: desc, foto: arq,
          marca_ficticia: $('nk-marca').value.trim(), cor_caixa: $('nk-caixa').value.trim(), situacao: 'no_site', novo: true } });
        abrirKit(s);
      };
    });
  }

  // ------------------------------------------------------------------ alterações e publicação
  function desfazer(alvo) {
    S.ops = S.ops.filter(function (o) {
      if (o.alvo !== alvo) return true;
      Object.keys(S.arquivos).forEach(function (p) {
        if ((o.t === 'foto_nova' && o.entrada.arquivo === '/' + p) || (o.t === 'foto' && o.campos.arquivo === '/' + p) ||
            (o.t === 'kit' && o.campos.foto && S.arquivos[p].nome === o.campos.foto) || (o.t === 'kit_novo' && S.arquivos[p].nome === o.kit.foto)) delete S.arquivos[p];
      });
      return false;
    });
    recalcular();
  }

  function desenharAlteracoes() {
    var sec = $('sec-alteracoes'), mud = mudancas(), erros = validar(S.atual);
    var icone = { entra: { rotulo: 'Entra', cls: 'entra' }, sai: { rotulo: 'Sai', cls: 'sai' }, alterado: { rotulo: 'Alterado', cls: 'alterado' } };
    sec.innerHTML = '<h2>Alterações</h2><p class="intro">O que muda no site quando você publicar. Cada item pode ser aberto ou desfeito. ' +
      'Ao publicar, o site é gerado e testado automaticamente; com algum erro, nada vai ao ar e o motivo aparece aqui ou no GitHub (aba Actions).</p>' +
      (mud.length ? '<div class="grid2"><div class="card"><ul class="mudancas">' + mud.map(function (m, i) {
        return '<li>' + etiqueta(icone[m.tipo]) + '<p><button type="button" class="link-btn" data-abrir="' + i + '">' + esc(m.texto) + '</button></p><button type="button" class="btn btn-line btn-sm" data-desfazer="' + i + '">Desfazer</button></li>';
      }).join('') + '</ul></div><div class="card publicar"><h3>Publicar</h3>' +
        (erros.length ? '<ul class="erros">' + erros.slice(0, 30).map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + (erros.length > 30 ? '<li>e mais ' + (erros.length - 30) + '</li>' : '') + '</ul>' : '') +
        campo('pub-msg', 'O que mudou (opcional)', '<textarea id="pub-msg" placeholder="ex.: entram as canecas novas; sai o boné aba reta"></textarea>') +
        '<div class="botoes"><button type="button" class="btn" id="pub-ok"' + (erros.length ? ' disabled' : '') + '>Publicar no site</button>' +
        (!S.fonte.local ? '<button type="button" class="btn btn-line" id="pub-rasc"' + (erros.length ? ' disabled' : '') + '>Salvar como rascunho</button>' : '') +
        '<button type="button" class="btn btn-sai" id="pub-descartar">Descartar tudo</button></div>' +
        '<p class="small muted">Rascunho: fica guardado para revisão (pull request) e pode ser publicado depois, nesta tela ou no GitHub.</p></div></div>'
        : '<p class="vazio">Nenhuma alteração por enquanto. Edite produtos e kits nas outras abas; tudo aparece aqui antes de ir ao ar.</p>') +
      '<div class="card" id="rascunhos" style="margin-top:20px" hidden></div>';
    sec.querySelectorAll('[data-abrir]').forEach(function (b) { b.onclick = mud[+b.dataset.abrir].abrir; });
    sec.querySelectorAll('[data-desfazer]').forEach(function (b) { b.onclick = function () { desfazer(mud[+b.dataset.desfazer].alvo); }; });
    if ($('pub-ok')) $('pub-ok').onclick = function () { publicar(true); };
    if ($('pub-rasc')) $('pub-rasc').onclick = function () { publicar(false); };
    if ($('pub-descartar')) $('pub-descartar').onclick = function () {
      if (!confirm('Descartar todas as alterações não publicadas?')) return;
      S.ops = []; S.arquivos = {}; recalcular();
    };
    listarRascunhos();
  }

  function listarRascunhos() {
    if (!S.fonte.rascunhos) return;
    S.fonte.rascunhos().then(function (l) {
      var box = $('rascunhos'); if (!box || !l.length) return;
      box.hidden = false;
      box.innerHTML = '<h3>Rascunhos salvos</h3><ul class="mudancas">' + l.map(function (r, i) {
        return '<li><span class="tag novo">Rascunho</span><p><a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.titulo) + '</a> <span class="small muted">' + esc(r.data.slice(0, 10).split('-').reverse().join('/')) + '</span></p>' +
          '<span><button type="button" class="btn btn-sm" data-rpub="' + i + '">Publicar</button> <button type="button" class="btn btn-line btn-sm" data-rdel="' + i + '">Descartar</button></span></li>';
      }).join('') + '</ul>';
      box.querySelectorAll('[data-rpub]').forEach(function (b) { b.onclick = function () {
        if (!confirm('Publicar o rascunho "' + l[+b.dataset.rpub].titulo + '"?')) return;
        S.fonte.publicarRascunho(l[+b.dataset.rpub]).then(function () { aviso('Rascunho publicado. O site é atualizado em alguns minutos.', 'ok'); return carregar(); })
          .catch(function (e) { aviso('Não consegui publicar o rascunho: ' + esc(e.message), 'erro'); });
      }; });
      box.querySelectorAll('[data-rdel]').forEach(function (b) { b.onclick = function () {
        if (!confirm('Descartar o rascunho "' + l[+b.dataset.rdel].titulo + '"?')) return;
        S.fonte.descartarRascunho(l[+b.dataset.rdel]).then(listarRascunhos).catch(function (e) { aviso('Não consegui descartar: ' + esc(e.message), 'erro'); });
      }; });
    }).catch(function () { /* sem acesso aos pull requests: a lista fica escondida */ });
  }

  function publicar(agora) {
    var mud = mudancas();
    if (!mud.length) return;
    var botoes = document.querySelectorAll('#pub-ok, #pub-rasc, #barra-publicar');
    botoes.forEach(function (b) { b.disabled = true; });
    aviso('Lendo a versão mais recente e aplicando as suas alterações…');
    var titulo = 'Inventário: ' + plural(mud.length, 'alteração', 'alterações') + ' (' + hojeBR() + ')';
    var extra = ($('pub-msg') && $('pub-msg').value.trim()) || '';
    var mensagem = titulo + '\n\n' + (extra ? extra + '\n\n' : '') + mud.map(function (m) { return '- ' + ({ entra: 'Entra', sai: 'Sai', alterado: 'Alterado' })[m.tipo] + ': ' + m.texto; }).join('\n');
    lerTudo().then(function (fresco) {
      var D = aplicar(fresco, S.ops), erros = validar(D);
      if (erros.length) throw new Error('a versão publicada mudou e agora há erros: ' + erros.slice(0, 5).join('; '));
      var tipos = {}; S.ops.forEach(function (o) { tipos[o.t] = 1; });
      var arquivos = [];
      if (tipos.foto || tipos.foto_nova || tipos.prod) arquivos.push({ path: ARQ.produtos, texto: json(D.produtos) });
      if (tipos.modelo) arquivos.push({ path: ARQ.modelos, texto: json(D.modelos) });
      if (tipos.sel || tipos.prioridade) arquivos.push({ path: ARQ.selecoes, texto: json(D.selecoes) });
      if (tipos.kit || tipos.kit_novo || tipos.kit_lista) arquivos.push({ path: ARQ.kits, texto: json(D.kits) });
      Object.keys(S.arquivos).forEach(function (p) { arquivos.push({ path: p, b64: S.arquivos[p].b64 }); });
      aviso('Enviando ' + plural(arquivos.length, 'arquivo', 'arquivos') + '…');
      return S.fonte.salvar(arquivos, mensagem, agora);
    }).then(function (r) {
      S.ops = []; S.arquivos = {}; salvarRascunho();
      var msg = r.publicado ? (S.fonte.local ? 'Gravado nos arquivos locais. Rode o build para ver no site local.' :
        'Publicado. O site é gerado e testado em alguns minutos e vai ao ar no próximo Deploy (automático, se o webhook do Easypanel estiver ligado).')
        : 'Rascunho salvo para revisão.';
      return carregar().then(function () { aviso(msg + (r.url ? ' <a href="' + esc(r.url) + '" target="_blank" rel="noopener">Ver no GitHub</a>' : ''), 'ok'); });
    }).catch(function (e) {
      aviso(e.message === 'login' ? (S.fonte.servidor ? 'A sessão expirou. <a href="">Entre de novo</a>: as alterações ficam guardadas neste navegador.'
        : 'O login expirou: entre de novo em <a href="/admin/">/admin/</a> e volte aqui (as alterações ficam guardadas).') : 'Não consegui publicar: ' + esc(e.message) + '. As alterações continuam guardadas.', 'erro');
      botoes.forEach(function (b) { b.disabled = false; });
    });
  }

  // ------------------------------------------------------------------ início
  function carregar() {
    S.carregando = true;
    return lerTudo().then(function (D) {
      S.base = D; S.carregando = false;
      recalcular();
      if (!statusEl.classList.contains('ok')) aviso('');
    });
  }

  function iniciar() {
    document.querySelectorAll('.tabs [role="tab"]').forEach(function (b) { b.onclick = function () { mostrarTab(b.dataset.tab); }; });
    document.addEventListener('click', function (e) {
      var ir = e.target.closest('[data-ir]'); if (ir) { fecharGaveta(); mostrarTab(ir.dataset.ir); }
      var sit = e.target.closest('[data-sit]'); if (sit) { S.filtro = { q: '', cat: '', sit: sit.dataset.sit }; mostrarTab('produtos'); }
      var kn = e.target.closest('[data-kits-novos]'); if (kn) { S.kfiltro = { q: '', sit: 'novo' }; mostrarTab('kits'); }
      var cat = e.target.closest('[data-cat]'); if (cat) { S.filtro = { q: '', cat: cat.dataset.cat, sit: '' }; mostrarTab('produtos'); }
    });
    $('gaveta-fechar').onclick = fecharGaveta; $('veu').onclick = fecharGaveta;
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('gaveta').hidden) fecharGaveta(); });
    $('barra-publicar').onclick = function () { fecharGaveta(); mostrarTab('alteracoes'); };
    window.addEventListener('beforeunload', function (e) { if (S.ops.length && Object.keys(S.arquivos).length) { e.preventDefault(); e.returnValue = ''; } });

    fetch('/admin/inventario/opcoes.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('opcoes.json ' + r.status); return r.json(); }).then(function (op) {
      S.op = op;
      // 1º: sessão no serviço de usuário e senha; sem o serviço (404/erro de rede), login do GitHub ou servidor local
      return fetch(API_ADMIN + '/eu', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) {
        if (r.ok) return r.json().then(function (d) { return { usuario: d.usuario }; });
        return { semSessao: r.status === 401 };
      }, function () { return {}; });
    }).then(function (sess) {
      if (!sess) return;
      var u = usuario();
      if (sess.usuario) S.fonte = FonteServidor(sess.usuario);
      else if (sess.semSessao && !(u && u.token)) return telaLogin();
      else if (u && u.token) S.fonte = FonteGitHub(u.token, S.op.repo, S.op.branch || 'main');
      else if (local()) S.fonte = FonteLocal(S.op.decap_local || 'http://localhost:8081/api/v1');
      else return telaLogin(true);
      return abrirInventario(u);
    }).catch(function (e) {
      aviso(e.message === 'login' ? (S.fonte && S.fonte.servidor ? 'A sessão expirou. <a href="">Entre de novo</a>.' : 'O login do editor expirou. <a href="/admin/">Entre de novo</a> e volte aqui.') :
        local() && /fetch|Failed|NetworkError|servidor local/.test(e.message) ? 'Servidor local não encontrado: rode <code>python tools/admin_local.py</code> na pasta do site e recarregue.' :
        'Não consegui carregar o inventário: ' + esc(e.message), 'erro');
    });
  }

  function abrirInventario(u) {
    document.querySelector('.tabs').hidden = false;
    $('fonte').innerHTML = esc(S.fonte.nome + (u && u.login && !S.fonte.servidor ? ' · ' + u.login : '')) +
      (S.fonte.servidor ? ' · <button type="button" class="link-btn" id="sair">Sair</button>' : '');
    if ($('sair')) $('sair').onclick = function () {
      if (S.ops.length && !confirm('Você tem alterações não publicadas. Elas ficam guardadas neste navegador. Sair mesmo assim?')) return;
      chamarApi('POST', '/sair', {}).catch(function () {}).then(function () { location.reload(); });
    };
    lerRascunho();
    var tab = (location.hash || '').replace('#', '');
    S.tab = { resumo: 1, produtos: 1, kits: 1, alteracoes: 1 }[tab] ? tab : 'resumo';
    return carregar().then(function () {
      mostrarTab(S.tab);
      if (S.ops.length) aviso('Você tem ' + plural(mudancas().length, 'alteração guardada', 'alterações guardadas') + ' neste navegador, ainda não publicadas.', '');
    });
  }

  // Login com usuário e senha (serviço admin-api). semServico: a página está no ar sem o serviço configurado.
  function telaLogin(semServico) {
    aviso('');
    document.querySelector('.tabs').hidden = true;
    var sec = $('sec-resumo');
    sec.hidden = false;
    if (semServico) {
      sec.innerHTML = '<div class="card login"><h2>Entrar no inventário</h2><p>O acesso com usuário e senha ainda não está ligado neste endereço.</p>' +
        '<p class="small muted">Equipe técnica: confira o app admin-api no Easypanel (docs/INVENTARIO.md) ou entre pelo <a href="/admin/">editor com o GitHub</a>.</p></div>';
      return;
    }
    sec.innerHTML = '<form class="card login" id="form-login" novalidate><h2>Entrar no inventário</h2>' +
      '<p class="muted">Use o usuário e a senha da TaMa.</p>' +
      campo('l-usuario', 'Usuário', '<input id="l-usuario" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required>') +
      campo('l-senha', 'Senha', '<input id="l-senha" name="password" type="password" autocomplete="current-password" required>') +
      '<p class="erro-campo" id="l-erro" role="alert" hidden></p>' +
      '<button type="submit" class="btn" id="l-ok">Entrar</button>' +
      '<p class="small muted" style="margin-top:14px">Esqueceu a senha? Peça uma nova a quem administra o site.</p></form>';
    var f = $('form-login');
    $('l-usuario').focus();
    f.onsubmit = function (e) {
      e.preventDefault();
      var u = $('l-usuario').value.trim(), s = $('l-senha').value, erro = $('l-erro');
      erro.hidden = true;
      if (!u || !s) { erro.textContent = 'Preencha o usuário e a senha.'; erro.hidden = false; return; }
      $('l-ok').disabled = true;
      chamarApi('POST', '/login', { usuario: u, senha: s }).then(function (d) {
        $('l-senha').value = '';
        S.fonte = FonteServidor(d.usuario);
        sec.innerHTML = '';
        return abrirInventario(null);
      }).catch(function (err) {
        erro.textContent = err.message === 'login' ? 'Usuário ou senha incorretos.' : err.message;
        erro.hidden = false; $('l-ok').disabled = false; $('l-senha').select();
      });
    };
  }

  window.TAMA_INVENTARIO = { aplicar: aplicar, validar: validar, slug: slug, estado: function () { return S; } };   // usado nos testes (tests/e2e.mjs)
  iniciar();
})();
