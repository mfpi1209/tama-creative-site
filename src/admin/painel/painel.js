/* Painel de SEO do blog TaMa Creative (/admin/painel/).
   Lê artigos (src/blog/) e pautas (src/pautas/) do repositório com o mesmo login do editor (/admin/):
   - produção: API do GitHub com o token que o Decap CMS guarda no navegador (localStorage "decap-cms-user");
   - localhost: servidor local do Decap (npx decap-server, porta 8081), quando não há login do GitHub.
   Os textos de checagem seguem blog.py (o que o build recusa = erro) e o painel de SEO de admin.js (recomendações = aviso). */
(function () {
  'use strict';

  var PROXY = 'http://localhost:8081/api/v1';
  var DIA = 86400000;
  var S = { site: null, arts: [], pautas: [], prs: [], fonte: '', carregado: null };
  var main = document.getElementById('main');
  var statusEl = document.getElementById('status');

  // ------------------------------------------------------------------ utilitários
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  var HOJE = iso(new Date());
  function dia(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function dias(s) { return Math.round((dia(s) - dia(HOJE)) / DIA); }
  function fmt(s) { if (!s) return '—'; var p = s.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function quando(s) {
    var n = dias(s);
    if (n === 0) return 'hoje';
    if (n === 1) return 'amanhã';
    if (n === -1) return 'ontem';
    return n > 0 ? 'em ' + n + ' dias' : 'há ' + (-n) + ' dias';
  }
  function tag(texto, cls) { return '<span class="tag ' + (cls || '') + '">' + esc(texto) + '</span>'; }
  function dataYaml(v) {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return v ? String(v).trim().slice(0, 10) : '';
  }
  function editor(col, slug) { return '/admin/#/collections/' + col + '/entries/' + encodeURIComponent(slug); }

  // ------------------------------------------------------------------ leitura dos arquivos
  function parseMd(text) {
    var m = String(text).match(/^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n([\s\S]*))?$/);
    if (!m) return { meta: {}, body: String(text), erro: 'sem front matter' };
    var meta;
    try { meta = window.jsyaml.load(m[1]) || {}; } catch (e) { return { meta: {}, body: m[2] || '', erro: 'front matter inválido' }; }
    return { meta: meta, body: m[2] || '' };
  }

  function usuario() {
    try { return JSON.parse(localStorage.getItem('decap-cms-user') || 'null'); } catch (e) { return null; }
  }

  function FonteGitHub(token, repo) {
    function api(path, raw) {
      return fetch('https://api.github.com' + path, {
        headers: { Authorization: 'token ' + token, Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json' },
        cache: 'no-store'
      }).then(function (r) {
        if (r.status === 401) throw new Error('login');
        if (r.status === 404) return null;
        if (!r.ok) throw new Error('GitHub respondeu ' + r.status + ' em ' + path);
        return raw ? r.text() : r.json();
      });
    }
    function arquivo(path, ref) { return api('/repos/' + repo + '/contents/' + path + '?ref=' + encodeURIComponent(ref), true); }
    function pasta(folder) {
      return api('/repos/' + repo + '/contents/' + folder + '?ref=main').then(function (list) {
        return Promise.all((list || []).filter(function (f) { return f.type === 'file' && /\.md$/.test(f.name) && !/^[_.]/.test(f.name); })
          .map(function (f) { return arquivo(f.path, 'main').then(function (t) { return { path: f.path, text: t }; }); }));
      });
    }
    return {
      nome: 'GitHub',
      carregar: function () {
        return Promise.all([pasta('src/blog'), pasta('src/pautas'), api('/repos/' + repo + '/pulls?state=open&per_page=100')]).then(function (r) {
          // Fluxo editorial do Decap: cada rascunho é um pull request da branch cms/<coleção>/<slug>, com o rótulo decap-cms/<status>.
          var prs = (r[2] || []).filter(function (p) { return /^cms\/(blog|pautas)\//.test(p.head.ref); }).map(function (p) {
            var parts = p.head.ref.split('/'), label = (p.labels || []).map(function (l) { return l.name; }).filter(function (n) { return /^decap-cms\//.test(n); })[0] || '';
            return { col: parts[1], slug: parts.slice(2).join('/'), ref: p.head.ref, status: label.replace('decap-cms/', '') || 'draft', url: p.html_url };
          });
          return Promise.all(prs.map(function (p) {
            var folder = p.col === 'blog' ? 'src/blog/' : 'src/pautas/';
            return arquivo(folder + p.slug + '.md', p.ref).then(function (t) { p.text = t; p.path = folder + p.slug + '.md'; return p; });
          })).then(function (prs2) { return { blog: r[0], pautas: r[1], prs: prs2.filter(function (p) { return p.text != null; }) }; });
        });
      }
    };
  }

  function FonteLocal() {
    function chamar(folder) {
      return fetch(PROXY, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'entriesByFolder', params: { branch: 'main', folder: folder, extension: 'md', depth: 1 } }) })
        .then(function (r) { if (!r.ok) throw new Error('servidor local respondeu ' + r.status); return r.json(); })
        .then(function (list) { return (list || []).map(function (e) { return { path: e.file.path, text: e.data }; }); });
    }
    return {
      nome: 'servidor local do Decap',
      carregar: function () {
        return Promise.all([chamar('src/blog'), chamar('src/pautas')]).then(function (r) { return { blog: r[0], pautas: r[1], prs: [] }; });
      }
    };
  }

  // ------------------------------------------------------------------ modelo: artigos
  var STATUS_FLUXO = { draft: 'Rascunho no editor', pending_review: 'Em revisão', pending_publish: 'Pronto para publicar' };

  function artigo(file, origem, pr) {
    var p = parseMd(file.text), m = p.meta, body = p.body;
    var nome = file.path.split('/').pop().replace(/\.md$/, '');
    var a = {
      path: file.path, slug: String(m.slug || nome.replace(/^\d{4}-\d{2}-\d{2}-/, '')), erroArquivo: p.erro || '',
      title: String(m.title || ''), description: String(m.description || '').trim(), kw: String(m.palavra_chave || ''),
      date: dataYaml(m.date), updated: dataYaml(m.updated) || dataYaml(m.date), tema: m.tema || '', servico: m.servico || '',
      ocasiao: m.ocasiao || '', capa_alt: String(m.capa_alt || ''), draft: m.draft === true,
      revisar_em: dataYaml(m.revisar_em), revisar_motivo: String(m.revisar_motivo || ''),
      relacionados: (m.relacionados || []).map(String), body: body, origem: origem, pr: pr || null
    };
    a.seo = String(m.seo_title || (a.title.length <= 49 ? a.title + ' | TaMa Creative' : a.title));
    a.estado = origem === 'fluxo' ? 'fluxo' : a.draft ? 'rascunho' : (a.date && a.date > HOJE) ? 'agendado' : 'publicado';
    var semNotas = body.replace(/^\[\^[^\]]+\]:.*$/gm, '');
    a.palavras = semNotas.replace(/[#*_>\[\]()|`-]/g, ' ').split(/\s+/).filter(Boolean).length;
    a.h2 = (body.match(/^##\s+\S/gm) || []).length;
    a.primeiro = body.split(/\n\s*\n/).filter(function (x) { return x.trim() && !/^#/.test(x.trim()); })[0] || '';
    a.links = (body.match(/\]\((\/[^)\s]*)\)/g) || []).map(function (l) { return l.slice(2, -1).split('#')[0].split('?')[0]; });
    a.fontes = (body.match(/^\[\^[^\]]+\]:/gm) || []).length;
    a.cta = /^\[\[cta/m.test(body);
    a.pendencia = /\[fonte\?\]|\bTODO\b/.test(body);
    return a;
  }

  function auditar(a) {
    var c = [], kw = norm(a.kw);
    function add(ok, nivel, texto) { c.push({ ok: ok, nivel: ok ? 'ok' : nivel, texto: texto }); }
    if (a.erroArquivo) add(false, 'erro', 'Arquivo: ' + a.erroArquivo);
    add(a.seo.length >= 20 && a.seo.length <= 65, a.seo.length > 70 ? 'erro' : 'aviso', 'Título no Google com ' + a.seo.length + ' caracteres (ideal 20 a 65; o build recusa acima de 70)');
    add(a.description.length >= 70 && a.description.length <= 160, 'erro', 'Descrição com ' + a.description.length + ' caracteres (70 a 160)');
    add(!!kw, 'aviso', 'Palavra-chave principal preenchida');
    if (kw) {
      add(norm(a.seo).indexOf(kw) !== -1, 'aviso', 'Palavra-chave no título do Google');
      add(norm(a.description).indexOf(kw) !== -1, 'aviso', 'Palavra-chave na descrição');
      add(norm(a.primeiro).indexOf(kw) !== -1, 'aviso', 'Palavra-chave no primeiro parágrafo');
    }
    add(a.h2 >= 3, 'aviso', a.h2 + ' seções com Título 2 (recomendado: 3 ou mais)');
    add(a.palavras >= 600, 'aviso', a.palavras + ' palavras (guias completos costumam passar de 600)');
    add(a.cta, 'aviso', 'Chamada para proposta no meio do texto');
    add(!!a.servico, 'aviso', 'Página de serviço escolhida');
    add(!!a.capa_alt, 'erro', 'Capa com descrição (texto alternativo)');
    add(!a.pendencia, 'erro', 'Sem [fonte?] ou TODO no texto');
    var internos = a.links.filter(function (l) { return l.indexOf('/blog/') !== 0; }).length;
    c.push({ ok: internos > 0, nivel: internos > 0 ? 'ok' : 'info', texto: internos ? internos + ' link(s) no texto para páginas do site' :
      'Nenhum link no texto para páginas do site (o botão do serviço no fim do artigo já existe; um link no meio do texto ajuda)' });
    if (a.tema === 'politicas') add(a.fontes > 0, 'aviso', a.fontes + ' nota(s) de fonte (assunto jurídico: cite a norma)');
    var recebidos = S.arts.filter(function (o) {
      return o !== a && o.estado === 'publicado' && (o.links.indexOf('/blog/' + a.slug + '/') !== -1 || o.relacionados.indexOf(a.slug) !== -1);
    }).length;
    c.push({ ok: recebidos > 0, nivel: recebidos > 0 ? 'ok' : 'info', texto: recebidos ? 'Citado por ' + recebidos + ' outro(s) artigo(s)' : 'Nenhum outro artigo cita este no texto ou em "Outros guias" (o site ainda mostra os do mesmo tema)' });
    var conflito = S.conflitos.filter(function (x) { return x.a.dono === 'a:' + a.slug || x.b.dono === 'a:' + a.slug; });
    conflito.forEach(function (x) {
      var outro = x.a.dono === 'a:' + a.slug ? x.b : x.a;
      add(false, x.nivel === 'alto' ? 'erro' : 'aviso', 'Disputa a busca com ' + outro.label + ' ("' + outro.consulta + '")');
    });
    if (a.estado === 'publicado' && dias(a.updated) < -365) add(false, 'aviso', 'Sem atualização há mais de um ano (' + fmt(a.updated) + ')');
    a.checks = c;
    a.erros = c.filter(function (x) { return x.nivel === 'erro'; }).length;
    a.avisos = c.filter(function (x) { return x.nivel === 'aviso'; }).length;
    var contam = c.filter(function (x) { return x.nivel !== 'info'; });
    a.nota = contam.filter(function (x) { return x.ok; }).length + '/' + contam.length;
  }

  // ------------------------------------------------------------------ modelo: pautas
  function pauta(file, pr) {
    var p = parseMd(file.text), m = p.meta;
    var slug = file.path.split('/').pop().replace(/\.md$/, '');
    return {
      slug: slug, titulo: String(m.titulo || slug), kw: String(m.palavra_chave || ''), secundarias: (m.secundarias || []).map(String),
      status: m.status || 'ideia', prioridade: m.prioridade || '', intencao: m.intencao || '', tema: m.tema || '', destino: m.destino || '',
      prazo: dataYaml(m.prazo), pico: (m.pico || []).map(String), fontes: m.precisa_fontes === true, responsavel: String(m.responsavel || ''),
      artigo: String(m.artigo || ''), obs: String(m.observacao || ''), pr: pr || null, erroArquivo: p.erro || ''
    };
  }

  // Artigo da pauta: o do campo "Artigo" ou, sem ele, o artigo com a mesma consulta-alvo (pauta ainda não ligada).
  function artigoDaPauta(p) {
    if (p.artigo) return S.arts.filter(function (a) { return a.slug === p.artigo; })[0] || null;
    var k = norm(p.kw);
    return (k && S.arts.filter(function (a) { return norm(a.kw) === k; })[0]) || null;
  }

  // ------------------------------------------------------------------ palavras-chave e canibalização
  var STOP = {};
  'a o as os e de da do das dos em no na nos nas para pra por com como que um uma uns umas sem ao aos sua seu suas seus mais'.split(' ').forEach(function (w) { STOP[w] = 1; });
  function termos(s) {
    var out = {};
    norm(s).split(/[^a-z0-9-]+/).forEach(function (t) {
      if (!t || STOP[t]) return;
      out[t.replace(/(oes|aes)$/, 'ao').replace(/s$/, '')] = 1;
    });
    return Object.keys(out);
  }
  function consultas() {
    var rows = [];
    S.site.paginas.forEach(function (p) {
      var label = 'a página ' + p.path, link = S.site.site + p.path;
      rows.push({ consulta: p.consulta, tipo: 'principal', dono: 'p:' + p.path, label: label, kind: 'Página', link: link, nome: p.path });
      p.secundarias.forEach(function (s) { rows.push({ consulta: s, tipo: 'secundária', dono: 'p:' + p.path, label: label, kind: 'Página', link: link, nome: p.path }); });
    });
    S.arts.forEach(function (a) {
      if (a.kw) rows.push({ consulta: a.kw, tipo: 'principal', dono: 'a:' + a.slug, label: 'o artigo "' + a.title + '"', kind: 'Artigo', link: editor('blog', a.slug), nome: a.title, estado: a.estado });
    });
    S.pautas.forEach(function (p) {
      if (p.status === 'descartada') return;
      var art = artigoDaPauta(p);
      var dono = art ? 'a:' + art.slug : 'u:' + p.slug;
      var base = { dono: dono, label: 'a pauta "' + p.titulo + '"', kind: 'Pauta', link: editor('pautas', p.slug), nome: p.titulo, estado: p.status };
      // a pauta do artigo com a mesma consulta é o próprio artigo: não repete a linha
      if (p.kw && !(art && norm(art.kw) === norm(p.kw))) rows.push(Object.assign({ consulta: p.kw, tipo: 'principal' }, base));
      p.secundarias.forEach(function (s) { rows.push(Object.assign({ consulta: s, tipo: 'secundária' }, base)); });
    });
    rows.forEach(function (r) { r.termos = termos(r.consulta); r.norm = norm(r.consulta); });
    return rows;
  }
  function conflitos(rows) {
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      for (var j = i + 1; j < rows.length; j++) {
        var a = rows[i], b = rows[j];
        if (a.dono === b.dono || (a.kind === 'Página' && b.kind === 'Página')) continue;
        var nivel = '';
        if (a.norm === b.norm) nivel = 'alto';
        else {
          var comum = a.termos.filter(function (t) { return b.termos.indexOf(t) !== -1; }).length;
          var menor = Math.min(a.termos.length, b.termos.length);
          if (menor >= 2 && comum / menor >= 0.75) nivel = (a.tipo === 'principal' && b.tipo === 'principal') ? 'alto' : 'medio';
        }
        if (nivel) out.push({ a: a, b: b, nivel: nivel });
      }
    }
    return out.sort(function (x, y) { return (x.nivel === 'alto' ? 0 : 1) - (y.nivel === 'alto' ? 0 : 1); });
  }

  // ------------------------------------------------------------------ carga
  function carregar() {
    statusEl.className = 'status';
    statusEl.textContent = 'Carregando artigos e pautas…';
    statusEl.hidden = false;
    var u = usuario(), local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    return fetch('/admin/painel/site.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (site) {
      S.site = site;
      var fonte = u && u.token && u.backendName !== 'proxy' ? FonteGitHub(u.token, site.repo) : local ? FonteLocal() : null;
      if (!fonte) throw new Error('login');
      S.fonte = fonte.nome;
      return fonte.carregar();
    }).then(function (d) {
      var prBlog = {}, prPauta = {};
      d.prs.forEach(function (p) { (p.col === 'blog' ? prBlog : prPauta)[p.slug] = p; });
      S.prs = d.prs;
      S.arts = d.blog.map(function (f) { var slug = f.path.split('/').pop().replace(/\.md$/, ''); return artigo(f, 'main', prBlog[slug]); });
      d.prs.filter(function (p) { return p.col === 'blog' && !S.arts.some(function (a) { return a.slug === p.slug; }); })
        .forEach(function (p) { S.arts.push(artigo(p, 'fluxo', p)); });
      S.pautas = d.pautas.map(function (f) { var slug = f.path.split('/').pop().replace(/\.md$/, ''); return pauta(prPauta[slug] || f, prPauta[slug]); });
      d.prs.filter(function (p) { return p.col === 'pautas' && !d.pautas.some(function (f) { return f.path === p.path; }); })
        .forEach(function (p) { S.pautas.push(pauta(p, p)); });
      S.arts.sort(function (x, y) { return (y.date || '').localeCompare(x.date || ''); });
      S.rows = consultas();
      S.conflitos = conflitos(S.rows);
      S.arts.forEach(auditar);
      S.carregado = new Date();
      statusEl.textContent = 'Fonte: ' + S.fonte + ' · ' + S.arts.length + ' artigo(s) e ' + S.pautas.length + ' pauta(s) · atualizado às ' +
        S.carregado.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + (S.prs.length ? ' · inclui ' + S.prs.length + ' rascunho(s) do fluxo editorial' : '');
      render();
    }).catch(function (e) {
      if (e.message === 'login') return semLogin();
      statusEl.className = 'status erro';
      statusEl.textContent = 'Não foi possível carregar: ' + e.message + '. Tente "Atualizar" ou entre de novo no editor.';
      if (local) statusEl.textContent += ' Em localhost, rode "npx decap-server" na pasta do projeto.';
    });
  }

  function semLogin() {
    statusEl.hidden = true;
    document.querySelectorAll('[role=tabpanel]').forEach(function (s) { s.hidden = true; });
    var sec = document.getElementById('sec-geral');
    sec.hidden = false;
    sec.innerHTML = '<div class="card login"><h2>Entre pelo editor</h2><p>O painel lê os artigos e as pautas do repositório privado com o seu login do GitHub. ' +
      'Entre no editor e depois volte para esta página.</p><a class="btn" href="/admin/">Entrar no editor</a></div>';
  }

  // ------------------------------------------------------------------ alertas (visão geral)
  function alertas() {
    var out = [];
    function push(nivel, texto, link, rotulo) { out.push({ nivel: nivel, texto: texto, link: link, rotulo: rotulo }); }
    S.arts.forEach(function (a) {
      if (a.revisar_em && dias(a.revisar_em) <= 30) push(dias(a.revisar_em) < 0 ? 'erro' : 'aviso', 'Revisar "' + a.title + '" ' + quando(a.revisar_em) + (a.revisar_motivo ? ': ' + a.revisar_motivo : ''), editor('blog', a.slug), 'Abrir artigo');
      if (a.erros) push('erro', '"' + a.title + '" tem ' + a.erros + ' item(ns) que o build recusa', '#auditoria', 'Ver auditoria');
    });
    S.pautas.forEach(function (p) {
      var ativa = ['publicada', 'descartada', 'espera'].indexOf(p.status) === -1;
      if (ativa && p.prazo && dias(p.prazo) <= 30) push(dias(p.prazo) < 0 ? 'erro' : 'aviso', 'Prazo da pauta "' + p.titulo + '" ' + quando(p.prazo), editor('pautas', p.slug), 'Abrir pauta');
      if (ativa && !p.prazo && proximoPico(p) !== null && proximoPico(p) <= 3) push('aviso', 'Pauta "' + p.titulo + '" tem pico de busca em ' + p.pico.join(', ') + ' e ainda não tem prazo', editor('pautas', p.slug), 'Definir prazo');
      var art = artigoDaPauta(p);
      if (art && !p.artigo) push('info', 'Ligue a pauta "' + p.titulo + '" ao artigo "' + art.title + '" (campo Artigo da pauta)', editor('pautas', p.slug), 'Abrir pauta');
      if (art && art.estado === 'publicado' && p.status !== 'publicada') push('info', 'O artigo da pauta "' + p.titulo + '" já está publicado: mude o status para Publicada', editor('pautas', p.slug), 'Abrir pauta');
      if (art && p.status === 'publicada' && art.estado !== 'publicado') push('aviso', 'Pauta "' + p.titulo + '" está como Publicada, mas o artigo ainda não está no ar', editor('pautas', p.slug), 'Abrir pauta');
      if (p.erroArquivo) push('erro', 'Pauta "' + p.slug + '": ' + p.erroArquivo, editor('pautas', p.slug), 'Abrir pauta');
    });
    S.conflitos.forEach(function (x) {
      push(x.nivel === 'alto' ? 'erro' : 'aviso', cap(x.a.label) + ' e ' + x.b.label + ' disputam buscas parecidas ("' + x.a.consulta + '" × "' + x.b.consulta + '")', '#palavras', 'Ver mapa');
    });
    temas().forEach(function (t) {
      if (t.pub === S.site.tema_min - 1) push('info', 'Falta 1 artigo publicado para o tema "' + t.label + '" ganhar página própria (/blog/tema/' + t.key + '/)', '#pautas', 'Ver pautas');
    });
    var ordem = { erro: 0, aviso: 1, info: 2 };
    return out.sort(function (x, y) { return ordem[x.nivel] - ordem[y.nivel]; });
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function proximoPico(p) {
    if (!p.pico.length) return null;
    var atual = new Date().getMonth(), min = null;
    p.pico.forEach(function (m) { var i = S.site.meses.indexOf(m); if (i < 0) return; var d = (i - atual + 12) % 12; if (min === null || d < min) min = d; });
    return min;
  }
  function temas() {
    return Object.keys(S.site.temas).map(function (k) {
      return {
        key: k, label: S.site.temas[k],
        pub: S.arts.filter(function (a) { return a.tema === k && a.estado === 'publicado'; }).length,
        fila: S.pautas.filter(function (p) { return p.tema === k && ['ideia', 'aprovada', 'escrevendo', 'revisao'].indexOf(p.status) !== -1; }).length
      };
    });
  }

  // ------------------------------------------------------------------ telas
  var NIVEL = { erro: 'Corrigir', aviso: 'Atenção', info: 'Dica', alto: 'Alto', medio: 'Médio' };

  function telaGeral(al) {
    var pub = S.arts.filter(function (a) { return a.estado === 'publicado'; }).length;
    var andamento = S.arts.length - pub;
    var ativas = S.pautas.filter(function (p) { return ['ideia', 'aprovada', 'escrevendo', 'revisao'].indexOf(p.status) !== -1; }).length;
    var h = '<div class="kpis">' +
      kpi(pub, 'artigos publicados') + kpi(andamento, 'rascunhos, agendados ou no fluxo') + kpi(ativas, 'pautas em andamento') +
      kpi(al.filter(function (x) { return x.nivel !== 'info'; }).length, 'pontos de atenção') + '</div>';
    h += '<div class="grid2"><div><h2>O que fazer agora</h2><div class="card">';
    h += al.length ? '<ul class="alerts">' + al.map(function (x) {
      return '<li>' + tag(NIVEL[x.nivel], x.nivel) + '<p>' + esc(x.texto) + (x.link ? ' · <a href="' + esc(x.link) + '">' + esc(x.rotulo) + '</a>' : '') + '</p></li>';
    }).join('') + '</ul>' : '<p class="muted">Nada pendente. Bom momento para escolher a próxima pauta.</p>';
    h += '</div>';
    if (S.prs.length) {
      h += '<h2 style="margin-top:28px">No fluxo do editor</h2><div class="card"><ul class="alerts">' + S.prs.map(function (p) {
        var nome = p.col === 'blog' ? (S.arts.filter(function (a) { return a.slug === p.slug; })[0] || {}).title : (S.pautas.filter(function (x) { return x.slug === p.slug; })[0] || {}).titulo;
        return '<li>' + tag(STATUS_FLUXO[p.status] || p.status, p.status === 'pending_publish' ? 'ok' : 'aviso') + '<p>' + (p.col === 'blog' ? 'Artigo' : 'Pauta') + ': ' + esc(nome || p.slug) +
          ' · <a href="/admin/#/workflow">Abrir fluxo</a></p></li>';
      }).join('') + '</ul></div>';
    }
    h += '</div><div><h2>Temas</h2><div class="card"><p class="small muted" style="margin:0 0 8px">A página do tema (/blog/tema/…) aparece com ' + S.site.tema_min + ' artigos publicados.</p><ul class="temas">' +
      temas().map(function (t) {
        var pct = Math.min(100, Math.round(t.pub / S.site.tema_min * 100));
        return '<li><div class="row"><span>' + esc(t.label) + '</span><span class="small muted">' + t.pub + '/' + S.site.tema_min + ' publicados' + (t.fila ? ' · ' + t.fila + ' na fila' : '') + '</span></div>' +
          '<div class="bar" role="img" aria-label="' + t.pub + ' de ' + S.site.tema_min + '"><i style="width:' + pct + '%"></i></div></li>';
      }).join('') + '</ul></div></div></div>';
    return h;
  }
  function kpi(n, label) { return '<div class="kpi"><b>' + n + '</b><span>' + esc(label) + '</span></div>'; }

  var COLUNAS = ['ideia', 'aprovada', 'escrevendo', 'revisao', 'espera', 'publicada', 'descartada'];
  var filtro = { tema: '', descartadas: false };

  function telaPautas() {
    var h = '<h2>Pautas</h2><p class="intro">Uma pauta por consulta de busca. Mude o status no editor; o painel mostra prazos, picos e o artigo ligado.</p>';
    h += '<div class="filters"><label>Tema <select id="f-tema"><option value="">Todos</option>' + Object.keys(S.site.temas).map(function (k) {
      return '<option value="' + k + '"' + (filtro.tema === k ? ' selected' : '') + '>' + esc(S.site.temas[k]) + '</option>';
    }).join('') + '</select></label><label><input type="checkbox" id="f-desc"' + (filtro.descartadas ? ' checked' : '') + '> Mostrar descartadas</label>' +
      '<a href="/admin/#/collections/pautas/new">+ Nova pauta</a></div>';
    var lista = S.pautas.filter(function (p) { return !filtro.tema || p.tema === filtro.tema; });
    var ordemP = { alta: 0, media: 1, baixa: 2, '': 3 };
    h += '<div class="board">' + COLUNAS.filter(function (c) { return c !== 'descartada' || filtro.descartadas; }).map(function (col) {
      var itens = lista.filter(function (p) { return p.status === col; }).sort(function (x, y) {
        return (ordemP[x.prioridade] - ordemP[y.prioridade]) || (x.prazo || '9999').localeCompare(y.prazo || '9999');
      });
      return '<div class="col"><h3>' + esc(S.site.status[col] || col) + ' (' + itens.length + ')</h3>' + itens.map(cardPauta).join('') + '</div>';
    }).join('') + '</div>';
    return h;
  }
  function cardPauta(p) {
    var chips = [];
    if (p.tema) chips.push(tag(S.site.temas[p.tema] || p.tema));
    if (p.prioridade) chips.push(tag('Prioridade ' + (S.site.prioridades[p.prioridade] || p.prioridade).toLowerCase(), p.prioridade === 'alta' ? 'aviso' : ''));
    if (p.prazo) chips.push(tag('Até ' + fmt(p.prazo), dias(p.prazo) < 0 && p.status !== 'publicada' ? 'erro' : ''));
    if (p.pico.length) chips.push(tag('Pico: ' + p.pico.join(', '), 'info'));
    if (p.fontes) chips.push(tag('Precisa de fontes'));
    if (p.pr) chips.push(tag(STATUS_FLUXO[p.pr.status] || 'No fluxo', 'aviso'));
    var art = artigoDaPauta(p);
    var acoes = ['<a href="' + editor('pautas', p.slug) + '">Abrir pauta</a>'];
    if (art) {
      acoes.push('<a href="' + editor('blog', art.slug) + '">Editar artigo</a>');
      if (art.estado === 'publicado') acoes.push('<a href="' + esc(S.site.site) + '/blog/' + esc(art.slug) + '/" target="_blank" rel="noopener">Ver no site</a>');
    } else if (['aprovada', 'escrevendo'].indexOf(p.status) !== -1) {
      var q = new URLSearchParams();
      q.set('title', p.titulo);
      if (p.kw) q.set('palavra_chave', p.kw);
      if (p.tema) q.set('tema', p.tema);
      if (p.destino) q.set('servico', p.destino);
      q.set('draft', 'true');
      acoes.push('<a href="/admin/#/collections/blog/new?' + q.toString() + '">Começar artigo</a>');
    }
    return '<article class="pauta"><h4>' + esc(p.titulo) + '</h4><p class="q">' + (p.kw ? '“' + esc(p.kw) + '”' : '<em>sem consulta-alvo</em>') +
      (p.responsavel ? ' · ' + esc(p.responsavel) : '') + '</p>' + (chips.length ? '<div class="chips">' + chips.join('') + '</div>' : '') +
      (p.obs ? '<p class="obs">' + esc(p.obs) + '</p>' : '') + '<div class="actions">' + acoes.join('') + '</div></article>';
  }

  function telaCalendario() {
    var hoje = new Date(), meses = [], atrasados = [];
    for (var i = 0; i < 12; i++) {
      var d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      meses.push({ ano: d.getFullYear(), mes: d.getMonth(), itens: [] });
    }
    function colocar(data, item) {
      if (data < HOJE) { atrasados.push(item); return; }
      var d = dia(data), m = meses.filter(function (x) { return x.ano === d.getFullYear() && x.mes === d.getMonth(); })[0];
      if (m) { item.data = data; m.itens.push(item); }
    }
    S.pautas.forEach(function (p) {
      if (p.status === 'descartada') return;
      if (p.prazo && p.status !== 'publicada' && p.status !== 'espera') colocar(p.prazo, { t: 'Prazo', cls: 'aviso', texto: p.titulo, link: editor('pautas', p.slug), quando: p.prazo });
      p.pico.forEach(function (nome) {
        var idx = S.site.meses.indexOf(nome);
        meses.forEach(function (m) {
          if (m.mes === idx) m.itens.push({ t: 'Pico', cls: 'info', texto: p.titulo + (p.status === 'publicada' ? ' (revise e atualize antes)' : ''), link: editor('pautas', p.slug), data: '' });
        });
      });
    });
    S.arts.forEach(function (a) {
      if (a.estado === 'agendado') colocar(a.date, { t: 'Publica', cls: 'ok', texto: a.title, link: editor('blog', a.slug), quando: a.date });
      if (a.revisar_em) colocar(a.revisar_em, { t: 'Revisar', cls: 'erro', texto: a.title + (a.revisar_motivo ? ': ' + a.revisar_motivo : ''), link: editor('blog', a.slug), quando: a.revisar_em });
    });
    var h = '<h2>Calendário</h2><p class="intro">Próximos 12 meses: prazos das pautas, publicações agendadas, revisões e meses de pico de busca. Datas vêm dos campos "Publicar até", "Data de publicação" e "Próxima revisão".</p>';
    if (atrasados.length) {
      h += '<div class="card" style="margin-bottom:16px"><h3>Atrasados</h3><ul class="alerts">' + atrasados.map(function (x) {
        return '<li>' + tag(x.t, 'erro') + '<p><a href="' + x.link + '">' + esc(x.texto) + '</a> · ' + fmt(x.quando) + ' (' + quando(x.quando) + ')</p></li>';
      }).join('') + '</ul></div>';
    }
    h += '<div class="months">' + meses.map(function (m, i) {
      m.itens.sort(function (x, y) { return (x.data || '0').localeCompare(y.data || '0'); });
      return '<div class="card month' + (i === 0 ? ' atual' : '') + '"><h3>' + S.site.meses[m.mes] + ' ' + m.ano + '</h3>' +
        (m.itens.length ? '<ul>' + m.itens.map(function (x) {
          return '<li>' + tag(x.t, x.cls) + '<span>' + (x.data ? dia(x.data).getDate() + ' · ' : '') + '<a href="' + x.link + '">' + esc(x.texto) + '</a></span></li>';
        }).join('') + '</ul>' : '<p class="small vazio">Nada marcado.</p>') + '</div>';
    }).join('') + '</div>';
    return h;
  }

  function telaPalavras() {
    var h = '<h2>Mapa de palavras-chave</h2><p class="intro">Cada consulta deve ter um dono só. O painel compara páginas do site (mapa de docs/SEO.md), artigos e pautas: ' +
      'mesma consulta = conflito alto; consultas com 75% ou mais dos termos em comum = conflito para revisar.</p>';
    if (S.conflitos.length) {
      h += '<h3 style="margin:0 0 8px">Conflitos (' + S.conflitos.length + ')</h3><div class="table-wrap" style="margin-bottom:24px"><table><thead><tr><th>Nível</th><th>Consulta</th><th>De</th><th>Consulta</th><th>De</th></tr></thead><tbody>' +
        S.conflitos.map(function (x) {
          return '<tr><td>' + tag(NIVEL[x.nivel], x.nivel) + '</td><td>' + esc(x.a.consulta) + '</td><td>' + dono(x.a) + '</td><td>' + esc(x.b.consulta) + '</td><td>' + dono(x.b) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    } else {
      h += '<p class="card">Nenhum conflito entre páginas, artigos e pautas.</p>';
    }
    var emConflito = {};
    S.conflitos.forEach(function (x) { emConflito[x.a.consulta + '|' + x.a.dono] = 1; emConflito[x.b.consulta + '|' + x.b.dono] = 1; });
    var rows = S.rows.slice().sort(function (x, y) { return x.norm.localeCompare(y.norm); });
    h += '<h3 style="margin:0 0 8px">Todas as consultas (' + rows.length + ')</h3><div class="table-wrap"><table><thead><tr><th>Consulta</th><th>Tipo</th><th>Dono</th><th>Situação</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td>' + esc(r.consulta) + '</td><td>' + esc(r.tipo) + '</td><td>' + dono(r) + '</td><td>' +
          (emConflito[r.consulta + '|' + r.dono] ? tag('Em conflito', 'erro') : tag('Única', 'ok')) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    return h;
  }
  function dono(r) {
    var estado = r.kind === 'Artigo' ? ({ publicado: 'publicado', rascunho: 'rascunho', agendado: 'agendado', fluxo: 'no fluxo' })[r.estado] :
      r.kind === 'Pauta' ? (S.site.status[r.estado] || r.estado).toLowerCase() : '';
    return esc(r.kind) + ': <a href="' + esc(r.link) + '"' + (r.kind === 'Página' ? ' target="_blank" rel="noopener"' : '') + '>' + esc(r.nome) + '</a>' + (estado ? ' <span class="small muted">(' + esc(estado) + ')</span>' : '');
  }

  var soPendencias = false;
  function telaAuditoria() {
    var h = '<h2>Auditoria de SEO</h2><p class="intro">Todos os artigos, inclusive rascunhos e os que estão no fluxo do editor. "Corrigir" é o que o build recusa; "Atenção" são as recomendações do painel de SEO do editor.</p>';
    h += '<div class="filters"><label><input type="checkbox" id="f-pend"' + (soPendencias ? ' checked' : '') + '> Só artigos com pendências</label></div>';
    var lista = S.arts.filter(function (a) { return !soPendencias || a.erros || a.avisos; });
    var ESTADO = { publicado: ['Publicado', 'ok'], rascunho: ['Rascunho', ''], agendado: ['Agendado', 'info'], fluxo: ['No fluxo do editor', 'aviso'] };
    h += lista.length ? lista.map(function (a) {
      var e = ESTADO[a.estado];
      return '<details class="card audit"><summary><div><h3>' + esc(a.title || a.slug) + '</h3><p class="meta">' + tag(e[0], e[1]) + ' ' +
        (a.pr && a.estado !== 'fluxo' ? tag('Edição: ' + (STATUS_FLUXO[a.pr.status] || 'no fluxo'), 'aviso') + ' ' : '') +
        esc(S.site.temas[a.tema] || 'sem tema') + ' · ' + fmt(a.date) + ' · ' + a.palavras + ' palavras' +
        (a.erros ? ' · ' + tag(a.erros + ' a corrigir', 'erro') : '') + (a.avisos ? ' ' + tag(a.avisos + ' de atenção', 'aviso') : '') + '</p></div>' +
        '<span class="score" title="itens atendidos">' + a.nota + '</span></summary>' +
        '<ul class="checks">' + a.checks.map(function (c) { return '<li class="' + c.nivel + '">' + esc(c.texto) + '</li>'; }).join('') + '</ul>' +
        '<div class="actions"><a href="' + editor('blog', a.slug) + '">Editar no editor</a>' +
        (a.estado === 'publicado' ? '<a href="' + esc(S.site.site) + '/blog/' + esc(a.slug) + '/" target="_blank" rel="noopener">Ver no site</a>' : '') + '</div></details>';
    }).join('') : '<p class="card">Nenhum artigo com pendências.</p>';
    return h;
  }

  function telaRevisoes() {
    var pubs = S.arts.filter(function (a) { return a.estado === 'publicado'; });
    pubs.sort(function (x, y) {
      if (x.revisar_em && y.revisar_em) return x.revisar_em.localeCompare(y.revisar_em);
      if (x.revisar_em || y.revisar_em) return x.revisar_em ? -1 : 1;
      return x.updated.localeCompare(y.updated);
    });
    var h = '<h2>Revisões</h2><p class="intro">Artigos publicados por ordem de revisão. Preencha "Próxima revisão" e "O que revisar" no artigo quando houver lei, valor ou dado que pode mudar. ' +
      'Depois de revisar, atualize "Atualizado em" e marque a próxima data.</p>';
    h += '<div class="table-wrap"><table><thead><tr><th>Artigo</th><th>Publicado</th><th>Atualizado</th><th>Próxima revisão</th><th>O que revisar</th></tr></thead><tbody>' +
      pubs.map(function (a) {
        var sit;
        if (a.revisar_em) {
          var n = dias(a.revisar_em);
          sit = fmt(a.revisar_em) + ' ' + tag(quando(a.revisar_em), n < 0 ? 'erro' : n <= 30 ? 'aviso' : 'ok');
        } else if (dias(a.updated) < -365) {
          sit = tag('Sem revisão há mais de 1 ano', 'aviso');
        } else {
          sit = '<span class="muted">sem data</span>' + (a.tema === 'politicas' ? ' ' + tag('Assunto jurídico: defina uma data', 'aviso') : '');
        }
        return '<tr><td><a href="' + editor('blog', a.slug) + '">' + esc(a.title) + '</a></td><td>' + fmt(a.date) + '</td><td>' + fmt(a.updated) + '</td><td>' + sit + '</td><td>' + esc(a.revisar_motivo || '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    return h;
  }

  // ------------------------------------------------------------------ abas
  var TABS = ['geral', 'pautas', 'calendario', 'palavras', 'auditoria', 'revisoes'];
  function abaAtual() { var t = location.hash.replace('#', ''); return TABS.indexOf(t) !== -1 ? t : 'geral'; }

  function render() {
    if (!S.carregado) return;
    var al = alertas(), atual = abaAtual();
    var telas = { geral: function () { return telaGeral(al); }, pautas: telaPautas, calendario: telaCalendario, palavras: telaPalavras, auditoria: telaAuditoria, revisoes: telaRevisoes };
    var contagem = {
      geral: al.filter(function (x) { return x.nivel === 'erro'; }).length,
      palavras: S.conflitos.length,
      auditoria: S.arts.filter(function (a) { return a.erros; }).length,
      revisoes: S.arts.filter(function (a) { return a.revisar_em && dias(a.revisar_em) < 0; }).length
    };
    TABS.forEach(function (t) {
      var btn = document.getElementById('tab-' + t), sec = document.getElementById('sec-' + t);
      btn.setAttribute('aria-selected', String(t === atual));
      btn.tabIndex = t === atual ? 0 : -1;
      var label = btn.textContent.replace(/\s*\d+$/, '');
      btn.innerHTML = esc(label) + (contagem[t] ? '<span class="count" aria-label="' + contagem[t] + ' pendências">' + contagem[t] + '</span>' : '');
      sec.hidden = t !== atual;
      if (t === atual) sec.innerHTML = telas[t]();
    });
    ligarFiltros();
  }

  function ligarFiltros() {
    var ft = document.getElementById('f-tema'), fd = document.getElementById('f-desc'), fp = document.getElementById('f-pend');
    if (ft) ft.onchange = function () { filtro.tema = ft.value; render(); };
    if (fd) fd.onchange = function () { filtro.descartadas = fd.checked; render(); };
    if (fp) fp.onchange = function () { soPendencias = fp.checked; render(); };
  }

  document.querySelector('.tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]');
    if (b) { history.replaceState(null, '', '#' + b.dataset.tab); render(); }
  });
  document.querySelector('.tabs').addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var i = TABS.indexOf(abaAtual()) + (e.key === 'ArrowRight' ? 1 : -1);
    var t = TABS[(i + TABS.length) % TABS.length];
    history.replaceState(null, '', '#' + t);
    render();
    document.getElementById('tab-' + t).focus();
  });
  window.addEventListener('hashchange', render);
  document.getElementById('recarregar').addEventListener('click', carregar);
  carregar();
})();
