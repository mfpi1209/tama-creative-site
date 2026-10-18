/* TaMa Creative — comportamento do site (sem dependências). */
(function () {
  'use strict';
  function readJSON(id) { try { return JSON.parse(document.getElementById(id).textContent); } catch (e) { return {}; } }
  var CFG = readJSON('tama-config');
  var CAT = window.TAMA_CAT || {};   // /assets/catalogo.<hash>.js, carregado antes deste arquivo
  var ALIAS = window.TAMA_ALIAS || {};   // slugs antigos (home, curadoria, catálogo) -> id atual do modelo
  var STORE_KEY = 'tama-selecao';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Analytics: dataLayer sempre; GA4 só com ID configurado e consentimento ---------- */
  window.dataLayer = window.dataLayer || [];
  function track(name, params) {
    window.dataLayer.push(Object.assign({ event: name }, params || {}));
    if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
  }
  window.tamaTrack = track;
  function loadGA() {
    if (!CFG.ga4 || window.gtag) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(CFG.ga4);
    document.head.appendChild(s);
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('js', new Date());
    window.gtag('config', CFG.ga4, { anonymize_ip: true });
  }
  function store(key, val) { try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { return null; } }
  var consentBox = document.getElementById('consent');
  if (consentBox) {
    var c = store('tama-consent');
    if (c === 'granted') loadGA(); else if (c !== 'denied') consentBox.hidden = false;
    consentBox.addEventListener('click', function (e) {
      var b = e.target.closest('[data-consent]');
      if (!b) return;
      var v = b.getAttribute('data-consent');
      store('tama-consent', v);
      consentBox.hidden = true;
      var main = document.getElementById('conteudo'); if (main) main.focus({ preventScroll: true });   // o botão clicado sumiu: o foco não se perde
      if (v === 'granted') loadGA();
      else if (typeof window.gtag === 'function') window.gtag('consent', 'update', { analytics_storage: 'denied' });
    });
    // rodapé e política de privacidade: "Cookies" reabre o aviso para mudar a escolha
    document.addEventListener('click', function (e) {
      if (!e.target.closest('[data-consent-open]')) return;
      consentBox.hidden = false;
      var first = consentBox.querySelector('[data-consent]'); if (first) first.focus();
    });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-track]');
    if (!t) return;
    var p = { label: t.getAttribute('data-track-label') || t.textContent.trim().slice(0, 60), page: location.pathname };
    if (t.getAttribute('data-interesse')) p.interesse = t.getAttribute('data-interesse');
    track(t.getAttribute('data-track'), p);
  });

  /* ---------- Origem da visita (só nesta sessão do navegador): primeira página, site de referência e UTMs ----------
     Vai junto com o pedido de proposta para saber o que gera pedidos. Nada pessoal; não é enviado ao analytics. */
  function sget(k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function sset(k, v) { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var origem = sget('tama-origem') || {};
  if (!origem.primeira_pagina) {
    origem.primeira_pagina = location.pathname;
    try { var ref = document.referrer ? new URL(document.referrer) : null; if (ref && ref.host !== location.host) origem.referencia = ref.host; } catch (e) {}
  }
  var query = new URLSearchParams(location.search);
  var UTMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  if (UTMS.some(function (k) { return query.get(k); })) UTMS.forEach(function (k) { origem[k] = (query.get(k) || '').slice(0, 100); });   // campanha nova substitui o conjunto inteiro
  sset('tama-origem', origem);
  var paginaAnterior = sget('tama-ultima-pagina');
  if (location.pathname !== '/solicitar-proposta/') sset('tama-ultima-pagina', location.pathname);

  /* ---------- WhatsApp com o contexto da página e da seleção ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="https://wa.me/"]');
    if (!a || a.hasAttribute('data-wa-summary') || !CFG.whatsapp) return;
    var assunto = a.getAttribute('data-interesse') || document.body.getAttribute('data-assunto') || 'um projeto';
    var pf = document.getElementById('proposal-form');   // no formulário: o interesse ou o tipo marcado
    if (pf && !a.getAttribute('data-interesse')) {
      var ti = pf.querySelector('input[name="tipo"]:checked');
      assunto = (pf.interesse && pf.interesse.value) || (ti ? ti.parentNode.textContent.trim().toLowerCase() : assunto);
    }
    var msg = 'Olá, TaMa! Vim pelo site e gostaria de conversar sobre ' + assunto + '.';
    var sel = getSel();
    if (sel.length) msg += '\nPeças que selecionei: ' + sel.map(label).join('; ') + '.';
    a.href = 'https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(msg);
  }, true);
  var service = document.body.getAttribute('data-service');
  if (service) track('view_service', { service: service });

  /* ---------- Toast ---------- */
  var toastEl = document.getElementById('toast'), toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('open');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('open'); }, 2400);
  }

  /* ---------- Navegação ---------- */
  var menuBtn = document.getElementById('menu-btn');
  var nav = document.getElementById('site-nav');
  function setMenu(open) {
    if (!menuBtn) return;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    nav.classList.toggle('is-open', open);
    document.documentElement.classList.toggle('menu-open', open);   // trava a rolagem do fundo enquanto o menu está aberto
    // altura do menu = da base do cabeçalho até o fim da tela (a faixa do topo varia: temporada, tamanho de fonte)
    if (open) nav.style.maxHeight = Math.max(200, window.innerHeight - nav.getBoundingClientRect().top) + 'px'; else nav.style.maxHeight = '';
  }
  if (menuBtn) menuBtn.addEventListener('click', function () {
    var abrir = menuBtn.getAttribute('aria-expanded') !== 'true';
    setMenu(abrir);
    if (abrir) { var l = nav.querySelector('a'); if (l) l.focus(); }   // os links vêm antes do botão no HTML: o foco vai para eles
  });
  // menu do celular aberto: se o foco sair do menu e do botão (Tab depois do último link), o menu fecha
  if (nav) nav.addEventListener('focusout', function (e) {
    if (nav.classList.contains('is-open') && e.relatedTarget && !nav.contains(e.relatedTarget) && e.relatedTarget !== menuBtn) setMenu(false);
  });
  /* submenus (Soluções, Ocasiões, Catálogo, Contato): botão com aria-expanded; um aberto por vez */
  var desk = window.matchMedia ? window.matchMedia('(min-width: 1240px)') : { matches: true };
  var toggles = [].slice.call(document.querySelectorAll('[data-nav-toggle]'));
  function setSub(btn, open) { btn.setAttribute('aria-expanded', String(open)); btn.parentElement.classList.toggle('is-open', open); }
  function closeSubs(except) { toggles.forEach(function (t) { if (t !== except) setSub(t, false); }); }
  toggles.forEach(function (t) {
    t.addEventListener('click', function () { var open = t.getAttribute('aria-expanded') !== 'true'; closeSubs(t); setSub(t, open); });
  });
  // no computador, passar o mouse em outro grupo fecha o que foi aberto por clique (nunca dois painéis juntos)
  toggles.forEach(function (t) { t.parentElement.addEventListener('mouseenter', function () { if (desk.matches) closeSubs(t); }); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var aberto = toggles.filter(function (t) { return t.getAttribute('aria-expanded') === 'true'; })[0];
    if (aberto) { setSub(aberto, false); aberto.focus(); return; }   // Esc fecha primeiro o submenu, depois o menu do celular
    if (nav && nav.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); }
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.nav-group')) closeSubs(); });
  // Tab para fora de um submenu aberto fecha o submenu, só no computador: no celular (acordeão) fechar no foco
  // encolhe o grupo de cima antes do toque terminar, e o toque cai fora do botão seguinte
  if (nav) nav.addEventListener('focusout', function (e) { var g = e.target.closest('.nav-group'); if (desk.matches && g && e.relatedTarget && !g.contains(e.relatedTarget)) closeSubs(); });
  // toque fora do menu (no fundo da página) fecha o menu do celular
  document.addEventListener('click', function (e) {
    if (nav && nav.classList.contains('is-open') && !nav.contains(e.target) && !menuBtn.contains(e.target)) setMenu(false);
  });
  // ao passar para a largura de computador, o menu do celular não fica aberto por trás
  if (window.matchMedia) { var mqDesk = window.matchMedia('(min-width: 1240px)'); var fecha = function () { if (mqDesk.matches) setMenu(false); }; if (mqDesk.addEventListener) mqDesk.addEventListener('change', fecha); }
  // âncoras da home antiga: #brindes e #marcas vão para o mesmo destino que /brindes e /marcas no deploy/nginx.conf
  var legacy = { brindes: '/brindes-corporativos/', curadoria: '/brindes-por-ocasiao/', ocasioes: '/brindes-por-ocasiao/', confeccoes: '/confeccoes-personalizadas/', marcas: '/catalogo/', sobre: '/sobre/', contato: '/solicitar-proposta/', colecoes: '/brindes-por-ocasiao/' };
  function legacyRedirect() { var h = location.hash.replace('#', ''); if (location.pathname === '/' && legacy[h]) location.replace(legacy[h]); }
  legacyRedirect();
  window.addEventListener('hashchange', legacyRedirect);
  // âncora com slug antigo (#linha-polo, #caneca-de-ceramica): leva ao card atual
  (function () { var h = location.hash.replace('#', ''), el = ALIAS[h] && document.getElementById(ALIAS[h]); if (el) { history.replaceState(null, '', '#' + ALIAS[h]); el.scrollIntoView(); } })();

  /* ---------- Seleção (peça + cor de referência) ---------- */
  var lbSlug = null;
  function getSel() {
    var raw;
    try { raw = JSON.parse(store(STORE_KEY) || '[]'); } catch (e) { raw = []; }
    var vistos = {};
    return (Array.isArray(raw) ? raw : []).map(function (x) {
      x = typeof x === 'string' ? { s: x, c: null } : x;
      if (x && ALIAS[x.s]) x = { s: ALIAS[x.s], c: x.c };   // seleção salva antes da base única
      return x;
    }).filter(function (x) {
      if (!x || !CAT[x.s] || vistos[x.s]) return false;
      vistos[x.s] = true;
      if (CAT[x.s].c.length && !CAT[x.s].c.some(function (c) { return c[0] === x.c; })) x.c = CAT[x.s].c[0][0];   // sem cor ou cor que deixou de existir: a da foto-base
      return true;
    });
  }
  function setSel(list) { store(STORE_KEY, JSON.stringify(list)); render(); }
  function find(sel, slug) { for (var i = 0; i < sel.length; i++) if (sel[i].s === slug) return i; return -1; }
  function label(x) { return CAT[x.s].n + (x.c ? ' (' + x.c + ')' : ''); }
  function firstColor(slug) { return (CAT[slug].c[0] || [])[0] || null; }
  function cardColor(slug) {
    var card = document.querySelector('.product[data-slug="' + slug + '"]');
    return (card && card.getAttribute('data-color')) || firstColor(slug);
  }
  function toggle(slug) {
    var sel = getSel(), i = find(sel, slug);
    if (i === -1) {
      sel.push({ s: slug, c: CAT[slug].c.length ? cardColor(slug) : null });
      toast('Adicionado à sua seleção');
      track('select_product', { item: slug });
    } else {
      sel.splice(i, 1);
      toast('Removido da seleção');
    }
    setSel(sel);
  }
  function variant(slug, color) {
    var c = CAT[slug];
    return c && c.v ? c.v[color] : null;   // [stem, widths, alt]
  }
  function srcset(v, ext) {
    return v[1].map(function (w) { return '/img/' + v[0] + '-' + w + '.' + ext + ' ' + w + 'w'; }).join(', ');
  }
  function swapPicture(pic, v) {
    pic.querySelectorAll('source').forEach(function (s) {
      var ext = (s.getAttribute('type') || '').split('/')[1];
      if (ext) s.setAttribute('srcset', srcset(v, ext));
    });
    var img = pic.querySelector('img');
    if (img) {
      var fb = v[1].filter(function (w) { return w >= 640; })[0] || v[1][v[1].length - 1];
      img.setAttribute('srcset', srcset(v, 'jpg'));
      img.setAttribute('src', '/img/' + v[0] + '-' + fb + '.jpg');
      img.setAttribute('alt', v[2]);
    }
  }
  function paintColor(slug, color) {
    var v = variant(slug, color);
    document.querySelectorAll('.product[data-slug="' + slug + '"]').forEach(function (card) {
      card.setAttribute('data-color', color);
      card.querySelectorAll('.swatch').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-color') === color)); });
      var n = card.querySelector('.color-name'); if (n) n.textContent = color;
      var pic = card.querySelector('.prod-media picture');
      if (v && pic) swapPicture(pic, v);   // show the product in the chosen colour
      var alt = card.querySelector('.prod-media .prod-alt'), vv = CAT[slug] && CAT[slug].vv;
      if (alt && vv) { if (vv[color]) { swapPicture(alt.querySelector('picture'), vv[color]); alt.hidden = false; } else { alt.hidden = true; } }   // verso da mesma cor no hover
    });
  }
  function setColor(slug, color) {
    paintColor(slug, color);
    var sel = getSel(), i = find(sel, slug);
    if (i !== -1) { sel[i].c = color; setSel(sel); } else if (lbSlug) { syncLightbox(); }
    track('select_color', { item: slug, color: color });
  }
  function thumb(x) {
    var v = x.c ? variant(x.s, x.c) : null;
    if (CAT[x.s].i) { var img = document.createElement('img'); img.src = v ? '/img/' + v[0] + '-' + v[1][0] + '.webp' : CAT[x.s].i; img.alt = ''; img.width = 52; img.height = 48; img.loading = 'lazy'; return img; }
    var ph = document.createElement('span'); ph.className = 'ph'; ph.setAttribute('aria-hidden', 'true'); ph.textContent = '✦'; return ph;
  }
  function fillList(ul, sel) {
    ul.textContent = '';
    sel.forEach(function (x) {
      var li = document.createElement('li');
      li.appendChild(thumb(x));
      var info = document.createElement('div');
      var st = document.createElement('strong'); st.textContent = CAT[x.s].n; info.appendChild(st);
      var sm = document.createElement('small'); sm.textContent = x.c ? 'Cor de referência: ' + x.c : 'Ideia além do óbvio'; info.appendChild(sm);
      li.appendChild(info);
      var rm = document.createElement('button'); rm.type = 'button'; rm.textContent = 'Remover';
      rm.setAttribute('aria-label', 'Remover ' + CAT[x.s].n + ' da seleção');
      rm.addEventListener('click', function () { var s = getSel(), i = find(s, x.s); if (i !== -1) { s.splice(i, 1); setSel(s); } });
      li.appendChild(rm);
      ul.appendChild(li);
    });
  }
  function render() {
    var sel = getSel(), n = sel.length;
    document.querySelectorAll('[data-sel-count]').forEach(function (el) { el.textContent = n; el.hidden = n === 0; });
    document.querySelectorAll('[data-sel-count-text]').forEach(function (el) { el.textContent = n + (n === 1 ? ' peça' : ' peças'); });
    document.querySelectorAll('.float-bag').forEach(function (b) { b.hidden = n === 0 || location.pathname === '/solicitar-proposta/'; });
    document.querySelectorAll('.pick[data-slug]').forEach(function (b) { b.setAttribute('aria-pressed', String(find(sel, b.getAttribute('data-slug')) !== -1)); });
    sel.forEach(function (x) { if (x.c) paintColor(x.s, x.c); });
    var dl = document.getElementById('drawer-list');
    if (dl) { fillList(dl, sel); document.getElementById('drawer-empty').hidden = n > 0; }
    var pl = document.getElementById('picked-list');
    if (pl) {
      fillList(pl, sel);
      document.getElementById('picked-wrap').hidden = n === 0;
      document.getElementById('f-selecao').value = sel.map(label).join('; ');
    }
    if (lbSlug) syncLightbox();
  }

  /* ---------- Diálogos (gaveta e foto ampliada) ---------- */
  function openDialog(id) {
    var d = document.getElementById(id);
    if (!d || d.open) return;
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  }
  document.querySelectorAll('dialog').forEach(function (d) {
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    d.addEventListener('close', function () { if (d.id === 'lightbox') lbSlug = null; });
  });
  function syncLightbox() {
    document.getElementById('lb-pick').setAttribute('aria-pressed', String(find(getSel(), lbSlug) !== -1));
    var lbCard = document.querySelector('.product[data-slug="' + lbSlug + '"]');
    if (lbCard) {
      var lbImg = document.getElementById('lb-img'), src = lbCard.querySelector('source[type="image/webp"]'), ci = lbCard.querySelector('.prod-media img');
      if (src && lbImg.getAttribute('srcset') !== src.getAttribute('srcset')) lbImg.srcset = src.getAttribute('srcset');
      if (ci) lbImg.alt = ci.alt;
    }
    var color = cardColor(lbSlug);
    document.querySelectorAll('#lb-swatches .swatch').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-color') === color)); });
  }
  function openLightbox(slug) {
    var card = document.querySelector('.product[data-slug="' + slug + '"]');
    if (!card) return;
    lbSlug = slug;
    var img = document.getElementById('lb-img');
    img.srcset = card.querySelector('source[type="image/webp"]').getAttribute('srcset');
    img.sizes = '(max-width: 760px) 90vw, 480px';
    img.src = CAT[slug].i;
    img.alt = card.querySelector('.prod-media img').alt;
    document.getElementById('lb-title').textContent = CAT[slug].n;
    document.getElementById('lb-desc').textContent = card.querySelector('.prod-desc').textContent;
    document.getElementById('lb-meta').textContent = card.querySelector('.prod-meta').textContent;
    var sw = document.getElementById('lb-swatches');
    sw.textContent = '';
    sw.appendChild(card.querySelector('.swatches').cloneNode(true));
    syncLightbox();
    openDialog('lightbox');
    track('zoom_product', { item: slug });
  }

  /* ---------- Cliques: cores, seleção, gaveta, foto ---------- */
  document.addEventListener('click', function (e) {
    var sw = e.target.closest('.swatch[data-color]');
    if (sw) {
      var holder = sw.closest('.product[data-slug]');
      var slug = holder ? holder.getAttribute('data-slug') : (sw.closest('#lightbox') ? lbSlug : null);
      if (slug) { setColor(slug, sw.getAttribute('data-color')); toast('Cor de referência: ' + sw.getAttribute('data-color')); }
      return;
    }
    var p = e.target.closest('.pick[data-slug]');
    if (p) { toggle(p.getAttribute('data-slug')); return; }
    if (e.target.closest('#lb-pick') && lbSlug) { toggle(lbSlug); return; }
    if (e.target.closest('[data-clear-selection]')) { setSel([]); toast('Seleção limpa'); return; }
    if (e.target.closest('[data-open-drawer]')) { openDialog('drawer'); track('open_selection', {}); return; }
    var z = e.target.closest('[data-zoom]');
    if (z) { openLightbox(z.getAttribute('data-zoom')); return; }
    var cl = e.target.closest('[data-close-dialog]');
    if (cl) { cl.closest('dialog').close(); }
  });

  /* ---------- Trilhos com rolagem (peças e coleções) ---------- */
  document.addEventListener('click', function (e) {
    var prev = e.target.closest('[data-rail-prev]'), next = e.target.closest('[data-rail-next]');
    var b = prev || next;
    if (!b) return;
    var rail = document.getElementById(b.getAttribute(prev ? 'data-rail-prev' : 'data-rail-next'));
    if (rail) rail.scrollBy({ left: (prev ? -1 : 1) * rail.clientWidth * 0.85, behavior: reduceMotion ? 'auto' : 'smooth' });
  });
  document.querySelectorAll('[data-rail-filter]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var id = chip.getAttribute('data-rail-filter'), v = chip.getAttribute('data-value');
      document.querySelectorAll('[data-rail-filter="' + id + '"]').forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
      var rail = document.getElementById(id);
      rail.querySelectorAll('.product').forEach(function (p) { p.hidden = v !== 'todas' && p.getAttribute('data-cat') !== v; });
      rail.scrollLeft = 0;
    });
  });
  /* ---------- Catálogo: busca, filtro lateral (gaveta no celular) e estado na URL ---------- */
  var catBox = document.querySelector('[data-catalogo]');
  if (catBox) {
    var catForm = document.getElementById('cat-form'), catQ = document.getElementById('cat-q');
    var catCards = [].slice.call(catBox.querySelectorAll('#catalogo-grid .product'));
    var catSide = document.getElementById('cat-filtros'), catScrim = catBox.querySelector('.cat-scrim'), catOpener = catBox.querySelector('[data-cat-open]');
    var catFAM = {}, catOCC = {};
    try { catFAM = JSON.parse(catBox.getAttribute('data-familias')); } catch (e) {}
    try { catOCC = JSON.parse(catBox.getAttribute('data-ocasioes')) || {}; } catch (e) {}
    // ocasião: radio na lateral (name="ocasiao"), espelhado na etiqueta removível acima da grade e em ?ocasiao= na URL
    var catOccBox = catBox.querySelector('[data-cat-occ]');
    var catSetOcc = function (k) {   // k já validado contra catOCC; sem radio para k (ou k vazio), volta para "Todas"
      var r = (k && catForm.querySelector('input[name="ocasiao"][value="' + k + '"]')) || catForm.querySelector('input[name="ocasiao"][value=""]');
      if (r) r.checked = true;
    };
    var catNorm = function (s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
    var catState = function () {
      var c = catForm.querySelector('input[name="categoria"]:checked'), o = catForm.querySelector('input[name="ocasiao"]:checked');
      return { q: catNorm(catQ.value), cat: c ? c.value : '', occ: o && catOCC.hasOwnProperty(o.value) ? o.value : '', cores: [].map.call(catForm.querySelectorAll('input[name="cor"]:checked'), function (i) { return i.value; }) };
    };
    // mostra 12 modelos por vez (todos continuam no HTML, para o Google e para quem está sem JavaScript); "Ver mais"
    // libera mais 12. Ao mudar busca ou filtro, volta a 12. O quanto já foi aberto fica no histórico (voltar da página
    // do produto devolve a mesma lista).
    var CAT_PAG = 12, catLimite = (history.state && history.state.catLimite) || CAT_PAG;
    var catMaisBox = catBox.querySelector('[data-cat-mais-box]'), catMais = catBox.querySelector('[data-cat-mais]');
    var catApply = function (push) {
      var st = catState(), n = 0, words = st.q ? st.q.split(' ') : [];
      catCards.forEach(function (p) {
        var hay = p.getAttribute('data-busca') || '', fams = (p.getAttribute('data-cores') || '').split(' ');
        var ok = (!st.cat || p.getAttribute('data-cat') === st.cat)
          && (!st.occ || (' ' + (p.getAttribute('data-occ') || '') + ' ').indexOf(' ' + st.occ + ' ') !== -1)
          && words.every(function (w) { return hay.indexOf(w) !== -1; })
          && (!st.cores.length || st.cores.some(function (f) { return fams.indexOf(f) !== -1; }));
        p.hidden = !ok;
        p.classList.toggle('cat-fora', ok && n >= catLimite);
        if (ok) n++;
        // com filtro de cor, o card já mostra a peça numa cor da família escolhida
        if (ok && st.cores.length) {
          var sw = [].filter.call(p.querySelectorAll('.swatch'), function (b) { return st.cores.indexOf(catFAM[b.getAttribute('data-color')]) !== -1; })[0];
          if (sw && sw.getAttribute('aria-pressed') !== 'true') paintColor(p.getAttribute('data-slug'), sw.getAttribute('data-color'));
        }
      });
      catBox.querySelectorAll('[data-cat-n]').forEach(function (el) { el.textContent = n; });
      document.getElementById('cat-count').lastChild.textContent = n === 1 ? ' modelo' : ' modelos';
      document.getElementById('cat-vazio').hidden = n > 0;
      catOccBox.hidden = !st.occ;
      catOccBox.querySelector('[data-cat-occ-name]').textContent = st.occ ? catOCC[st.occ] : '';
      var vistos = Math.min(n, catLimite), resto = n - vistos;
      catMaisBox.hidden = resto <= 0;
      catBox.querySelector('[data-cat-vistos]').textContent = vistos;
      catBox.querySelector('[data-cat-total]').textContent = n;
      catMais.textContent = 'Ver mais ' + Math.min(CAT_PAG, resto) + (Math.min(CAT_PAG, resto) === 1 ? ' modelo' : ' modelos');
      var active = (st.cat ? 1 : 0) + (st.occ ? 1 : 0) + st.cores.length, badge = catBox.querySelector('[data-cat-badge]');
      badge.hidden = !active; badge.textContent = active;
      if (push) {
        var u = new URLSearchParams();
        if (catQ.value.trim()) u.set('q', catQ.value.trim());
        if (st.cat) u.set('categoria', st.cat);
        if (st.occ) u.set('ocasiao', st.occ);
        if (st.cores.length) u.set('cor', st.cores.join(','));
        history.replaceState({ catLimite: catLimite }, '', location.pathname + (u.toString() ? '?' + u : '') + '#catalogo');
      }
    };
    var catTimerQ;
    catQ.addEventListener('input', function () { clearTimeout(catTimerQ); catTimerQ = setTimeout(function () { catLimite = CAT_PAG; catApply(true); }, 150); });
    catForm.addEventListener('change', function () { catLimite = CAT_PAG; catApply(true); });
    catForm.addEventListener('submit', function (e) { e.preventDefault(); catQ.blur(); });
    catForm.addEventListener('reset', function () { setTimeout(function () { catLimite = CAT_PAG; catApply(true); }, 0); });   // o reset volta os radios para "Todas"
    // remover a ocasião: a etiqueta some (e o radio volta para "Todas"), então o foco vai para o total de modelos
    catOccBox.querySelector('[data-cat-occ-clear]').addEventListener('click', function () {
      catSetOcc(''); catLimite = CAT_PAG; catApply(true);
      var cc = document.getElementById('cat-count'); cc.setAttribute('tabindex', '-1'); cc.focus({ preventScroll: true });
    });
    catMais.addEventListener('click', function () {
      var antes = catLimite;
      catLimite += CAT_PAG;
      catApply(false);
      history.replaceState({ catLimite: catLimite }, '', location.href);
      // o foco vai para o primeiro modelo que apareceu (teclado e leitor de tela continuam de onde pararam)
      var novo = catCards.filter(function (p) { return !p.hidden; })[antes];
      var alvo = novo && (novo.querySelector('.prod-link, a[href]') || novo);
      if (alvo) alvo.focus({ preventScroll: true });
    });
    // URL de entrada: ?categoria=vestuario&cor=azul,verde&q=caneca&ocasiao=fim-de-ano (links internos e compartilhamento)
    var catParams = new URLSearchParams(location.search);
    var catPo = catParams.get('ocasiao') || '';
    catSetOcc(catOCC.hasOwnProperty(catPo) ? catPo : '');   // ocasião desconhecida abre sem filtro ("Todas")
    if (catParams.get('q')) catQ.value = catParams.get('q');
    var catPc = catForm.querySelector('input[name="categoria"][value="' + (catParams.get('categoria') || '').replace(/[^a-z-]/g, '') + '"]');
    if (catPc) catPc.checked = true;
    (catParams.get('cor') || '').split(',').forEach(function (f) { var i = catForm.querySelector('input[name="cor"][value="' + f.replace(/[^a-z-]/g, '') + '"]'); if (i) i.checked = true; });
    catApply(false);
    // gaveta de filtros (celular e tablet)
    var catOpenSide = function (open) {
      catSide.classList.toggle('is-open', open);
      catScrim.hidden = !open;
      catOpener.setAttribute('aria-expanded', String(open));
      document.documentElement.classList.toggle('cat-lock', open);
      if (open) { catSide.setAttribute('role', 'dialog'); catSide.setAttribute('aria-modal', 'true'); var f = catSide.querySelector('input:checked') || catSide.querySelector('input'); if (f) f.focus(); }
      else { catSide.removeAttribute('role'); catSide.removeAttribute('aria-modal'); catOpener.focus(); }
    };
    catOpener.addEventListener('click', function () { catOpenSide(true); });
    catBox.querySelectorAll('[data-cat-close]').forEach(function (b) { b.addEventListener('click', function () { catOpenSide(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && catSide.classList.contains('is-open')) catOpenSide(false); });
    // celular: uma ou duas fotos por linha (lembrado neste navegador)
    var catGrid = document.getElementById('catalogo-grid');
    var catSetCols = function (n) {
      catGrid.classList.toggle('cols-2', n === '2');
      catBox.querySelectorAll('[data-cat-cols]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-cat-cols') === n)); });
    };
    catBox.querySelectorAll('[data-cat-cols]').forEach(function (b) { b.addEventListener('click', function () { catSetCols(b.getAttribute('data-cat-cols')); store('tama-cat-cols', b.getAttribute('data-cat-cols')); }); });
    if (store('tama-cat-cols') === '2') catSetCols('2');
  }

  /* ---------- Página do produto: miniaturas, cor na URL (?cor=) e zoom ao passar o mouse ---------- */
  var pdp = document.querySelector('[data-pdp]');
  if (pdp) {
    var pdpSlug = pdp.getAttribute('data-slug'), pdpPic = pdp.querySelector('.pdp-main picture');
    var pdpSlugCor = function (s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
    var pdpVistas = {};
    try { pdpVistas = JSON.parse(pdp.getAttribute('data-vistas')) || {}; } catch (e) {}
    var pdpCorAtual = function () { return pdp.getAttribute('data-color') || Object.keys(pdpVistas)[0]; };
    // faixa Frente · Verso · Bordado: mostra as vistas da cor escolhida; ao trocar de cor, volta para a frente
    var pdpVistasSync = function () {
      var v = pdpVistas[pdpCorAtual()] || {};
      pdp.querySelectorAll('.pdp-vista').forEach(function (b) {
        var k = b.getAttribute('data-vista'), d = v[k];
        b.hidden = !d;
        if (d) b.querySelector('img').src = '/img/' + d[0] + '-' + d[1][0] + '.webp';
        b.setAttribute('aria-pressed', String(k === 'frente'));
      });
    };
    pdp.querySelectorAll('.pdp-vista').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = (pdpVistas[pdpCorAtual()] || {})[b.getAttribute('data-vista')];
        if (!d) return;
        swapPicture(pdpPic, d);
        pdp.querySelectorAll('.pdp-vista').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
      });
    });
    var pdpSync = function (push) {
      var cor = pdp.getAttribute('data-color');
      pdpVistasSync();
      pdp.querySelectorAll('.pdp-thumb').forEach(function (t) { t.setAttribute('aria-pressed', String(!!cor && t.getAttribute('data-thumb-color') === cor)); });
      if (push && cor) history.replaceState(null, '', location.pathname + '?cor=' + pdpSlugCor(cor));
    };
    // trocar a cor (bolinha ou miniatura) atualiza miniaturas e URL; o resto (foto, nome da cor, seleção) já é feito por paintColor/setColor
    new MutationObserver(function () { pdpSync(true); }).observe(pdp, { attributes: true, attributeFilter: ['data-color'] });
    pdp.querySelectorAll('.pdp-thumb').forEach(function (t) {
      t.addEventListener('click', function () {
        var cor = t.getAttribute('data-thumb-color');
        if (cor) { setColor(pdpSlug, cor); return; }
        var v; try { v = JSON.parse(t.getAttribute('data-v')); } catch (e) { return; }
        swapPicture(pdpPic, v);   // grupo, verso ou detalhe: troca só a foto
        pdp.querySelectorAll('.pdp-thumb').forEach(function (o) { o.setAttribute('aria-pressed', String(o === t)); });
      });
    });
    var pdpCor = new URLSearchParams(location.search).get('cor');
    var pdpSw = pdpCor && [].filter.call(pdp.querySelectorAll('.swatch'), function (b) { return pdpSlugCor(b.getAttribute('data-color')) === pdpCor; })[0];
    // a cor do link vale mais que a cor guardada na seleção (render() pinta a seleção logo depois deste trecho)
    setTimeout(function () { if (pdpSw) paintColor(pdpSlug, pdpSw.getAttribute('data-color')); pdpSync(false); }, 0);
    // zoom: com mouse, a foto amplia 2x seguindo o cursor (no toque, o "+" abre a foto ampliada)
    var zoomBox = pdp.querySelector('[data-hover-zoom]');
    if (zoomBox && window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      zoomBox.addEventListener('mousemove', function (e) {
        var r = zoomBox.getBoundingClientRect();
        zoomBox.style.setProperty('--zx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        zoomBox.style.setProperty('--zy', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
        zoomBox.classList.add('is-zoom');
      });
      zoomBox.addEventListener('mouseleave', function () { zoomBox.classList.remove('is-zoom'); });
    }
  }

  /* ---------- Carrossel da abertura ---------- */
  var hero = document.getElementById('hero');
  if (hero) {
    var slides = hero.querySelectorAll('.slide'), dots = hero.querySelectorAll('.dot');
    var pauseBtn = hero.querySelector('[data-hero-pause]'), count = hero.querySelector('[data-hero-count]');
    // A troca automática conta o tempo que falta: ao pausar (hover, foco, aba oculta ou botão) o progresso do ponto
    // ativo congela e, ao voltar, continua de onde parou.
    var DUR = 7000, idx = 0, timer = null, userPaused = !!reduceMotion, hover = false, focused = false, hidden = false;
    var left = DUR, startedAt = 0;
    hero.style.setProperty('--hero-dur', DUR / 1000 + 's');
    var go = function (n) {
      idx = (n + slides.length) % slides.length;
      hero.classList.add('is-live');
      slides.forEach(function (s, i) {
        var on = i === idx;
        s.classList.toggle('is-active', on);
        if (on) { s.removeAttribute('aria-hidden'); s.removeAttribute('inert'); } else { s.setAttribute('aria-hidden', 'true'); s.setAttribute('inert', ''); }
      });
      dots.forEach(function (d) { d.removeAttribute('aria-current'); });
      void hero.offsetWidth;   // reinicia a barra de progresso mesmo quando o ponto ativo é o mesmo
      dots[idx].setAttribute('aria-current', 'true');
      count.textContent = (idx < 9 ? '0' : '') + (idx + 1);
      left = DUR; startedAt = 0;
    };
    var schedule = function () {
      clearTimeout(timer);
      if (startedAt) { left = Math.max(0, left - (Date.now() - startedAt)); startedAt = 0; }
      var held = hover || focused || hidden;
      hero.classList.toggle('is-stopped', userPaused);
      hero.classList.toggle('is-held', held);
      if (userPaused || held) return;
      startedAt = Date.now();
      timer = setTimeout(function () { go(idx + 1); schedule(); }, left);
    };
    var syncPause = function () {
      pauseBtn.setAttribute('aria-pressed', String(userPaused));
      pauseBtn.setAttribute('aria-label', userPaused ? 'Retomar troca automática' : 'Pausar troca automática');
    };
    var step = function (n) { go(n); schedule(); };
    hero.querySelector('[data-hero-prev]').addEventListener('click', function () { step(idx - 1); });
    hero.querySelector('[data-hero-next]').addEventListener('click', function () { step(idx + 1); });
    dots.forEach(function (d) { d.addEventListener('click', function () { step(+d.getAttribute('data-slide')); }); });
    pauseBtn.addEventListener('click', function () { userPaused = !userPaused; syncPause(); schedule(); });
    hero.addEventListener('mouseenter', function () { hover = true; schedule(); });
    hero.addEventListener('mouseleave', function () { hover = false; schedule(); });
    hero.addEventListener('focusin', function () { focused = true; schedule(); });
    hero.addEventListener('focusout', function (e) { if (!hero.contains(e.relatedTarget)) { focused = false; schedule(); } });
    hero.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') step(idx + 1);
      if (e.key === 'ArrowLeft') step(idx - 1);
    });
    var tx = null;
    hero.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
    hero.addEventListener('touchend', function (e) {
      if (tx === null) return;
      var dx = e.changedTouches[0].clientX - tx;
      if (Math.abs(dx) > 50) step(idx + (dx < 0 ? 1 : -1));
      tx = null;
    });
    document.addEventListener('visibilitychange', function () { hidden = document.hidden; schedule(); });
    syncPause();
    schedule();
  }

  /* ---------- Filtros da curadoria (com ?ocasiao= e ?categoria= na URL) ---------- */
  var grid = document.getElementById('gift-grid');
  if (grid) {
    var params = new URLSearchParams(location.search);
    // categorias antigas que ainda circulam em links: abrem a categoria atual equivalente
    var ANTIGOS = { cat: { escritorio: 'canetas-escritorio', bebidas: 'garrafas-copos', casa: 'casa-bem-estar', bolsas: 'bolsas-embalagens', embalagem: 'bolsas-embalagens' }, occ: {} };
    var valido = function (f, v) {
      if (v && Object.prototype.hasOwnProperty.call(ANTIGOS[f], v)) v = ANTIGOS[f][v];
      return v && document.querySelector('.chip[data-filter="' + f + '"][data-value="' + v.replace(/[^a-z-]/g, '') + '"]') ? v : 'todas';
    };
    var state = { cat: valido('cat', params.get('categoria')), occ: valido('occ', params.get('ocasiao')) };   // valores desconhecidos abrem sem filtro
    var cards = document.querySelectorAll('#gift-grid .product, #idea-grid .idea');
    var countEl = document.getElementById('gift-count'), emptyEl = document.getElementById('gift-empty');
    var alemHead = document.getElementById('alem-head');
    var apply = function () {
      var n = 0, nAlem = 0;
      cards.forEach(function (g) {
        var cat = g.getAttribute('data-cat');
        var okCat = state.cat === 'todas' || cat === state.cat;
        var okOcc = state.occ === 'todas' || (' ' + g.getAttribute('data-occ') + ' ').indexOf(' ' + state.occ + ' ') !== -1;
        g.hidden = !(okCat && okOcc);
        if (!g.hidden) { n++; if (cat === 'alem') nAlem++; }
      });
      if (alemHead) alemHead.hidden = nAlem === 0;
      countEl.textContent = n + (n === 1 ? ' peça' : ' peças');
      emptyEl.hidden = n !== 0;
      document.querySelectorAll('.chip[data-filter]').forEach(function (c) {
        c.setAttribute('aria-pressed', String(c.getAttribute('data-value') === state[c.getAttribute('data-filter')]));
      });
    };
    document.querySelectorAll('.chip[data-filter]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        state[chip.getAttribute('data-filter')] = chip.getAttribute('data-value');
        apply();
        var q = new URLSearchParams();
        if (state.cat !== 'todas') q.set('categoria', state.cat);
        if (state.occ !== 'todas') q.set('ocasiao', state.occ);
        history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + '#pecas');
        track('filter_curadoria', { filter: chip.getAttribute('data-filter'), value: chip.getAttribute('data-value') });
      });
    });
    document.getElementById('gift-reset').addEventListener('click', function () { state.cat = 'todas'; state.occ = 'todas'; apply(); history.replaceState(null, '', location.pathname + '#pecas'); });
    apply();
  }

  render();
  // voltar pelo navegador (bfcache) ou outra aba mudou a seleção: atualiza contador, botões e o campo do pedido
  window.addEventListener('pageshow', function (e) { if (e.persisted) render(); });
  window.addEventListener('storage', function (e) { if (e.key === STORE_KEY) render(); });

  /* Blog: filtros da listagem por categoria (sem JavaScript, todos os guias continuam visíveis) */
  var blogFilters = document.querySelector('[data-blog-filters]');
  if (blogFilters) {
    var blogCards = Array.prototype.slice.call(document.querySelectorAll('[data-blog-grid] .post-card'));
    var blogEmpty = document.querySelector('[data-blog-empty]');
    var blogStatus = document.querySelector('[data-blog-status]');
    var applyBlogFilter = function (cat, label) {
      var shown = 0;
      blogCards.forEach(function (c) { var on = !cat || c.getAttribute('data-cat') === cat; c.hidden = !on; if (on) shown++; });
      blogFilters.querySelectorAll('[data-cat]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-cat') === cat)); });
      if (blogEmpty) blogEmpty.hidden = shown > 0;
      if (blogStatus) blogStatus.textContent = shown + (shown === 1 ? ' guia' : ' guias') + (cat ? ' em ' + label : '');
    };
    blogFilters.hidden = false;
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-blog-filters] [data-cat], [data-blog-empty] [data-cat]');
      if (!b) return;
      var cat = b.getAttribute('data-cat');
      applyBlogFilter(cat, b.textContent.trim());
      // no celular os filtros rolam de lado: mantém o escolhido à vista
      var on = blogFilters.querySelector('[aria-pressed="true"]');
      if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      track('filter_blog', { value: cat || 'todos' });
    });
  }

  /* Blog: o sumário do artigo começa fechado no celular (no desktop fica aberto ao lado do texto) */
  var postToc = document.querySelector('details[data-post-toc]');
  if (postToc && window.matchMedia && window.matchMedia('(max-width: 980px)').matches) postToc.open = false;

  /* ---------- Formulário de proposta ---------- */
  var form = document.getElementById('proposal-form');
  if (!form) return;
  var started = false;
  form.addEventListener('focusin', function () { if (!started) { started = true; track('form_start', {}); } });
  var conditional = form.querySelectorAll('[data-show-for]');
  var syncType = function () {
    var checked = form.querySelector('input[name="tipo"]:checked');
    var v = checked ? checked.value : '';
    conditional.forEach(function (el) {
      var show = !v || el.getAttribute('data-show-for').split(' ').indexOf(v) !== -1;
      el.hidden = !show;
      el.querySelectorAll('input, select, textarea').forEach(function (i) { i.disabled = !show; });
    });
  };
  form.addEventListener('change', function (e) { if (e.target.name === 'tipo') syncType(); });
  var pre = query.get('tipo');
  if (pre) { var r = form.querySelector('input[name="tipo"][value="' + pre.replace(/[^a-z]/g, '') + '"]'); if (r) r.checked = true; }
  syncType();

  // Identificador do pedido: o mesmo em cada nova tentativa (o n8n não duplica um pedido já gravado);
  // um novo só depois de um envio confirmado.
  function novoId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var a = new Uint8Array(16); crypto.getRandomValues(a); a[6] = (a[6] & 15) | 64; a[8] = (a[8] & 63) | 128;
    var h = [].map.call(a, function (b) { return (b + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  var pedidoId = sget('tama-pedido-id') || novoId();
  sset('tama-pedido-id', pedidoId);
  // assinatura do conteúdo: se a pessoa mudar o pedido depois de uma falha (ou fizer outro na mesma aba), ele ganha um
  // número novo; reenvio sem mudança mantém o número (o n8n reconhece e não duplica)
  var assinatura = function () { var fd = new FormData(form); fd.delete('pedido_id'); return new URLSearchParams(fd).toString(); };
  var setField = function (name, v) { if (form[name]) form[name].value = v || ''; };
  setField('pedido_id', pedidoId);
  var interesse = (query.get('interesse') || '').slice(0, 120);
  setField('interesse', interesse);
  if (interesse) { var note = document.getElementById('interest-note'); note.textContent = 'Interesse: ' + interesse; note.hidden = false; }
  var origemPagina = paginaAnterior || '';
  // vindo de uma página de frente (ex.: "Montar pedido com a seleção" na Hotelaria), o tipo já vem marcado
  var tipoPorPagina = { '/brindes-corporativos/': 'brindes', '/brindes-por-ocasiao/': 'brindes', '/kits-corporativos/': 'kits', '/confeccoes-personalizadas/': 'confeccoes', '/ativacoes-promocionais/': 'ativacoes', '/hotelaria-e-gastronomia/': 'hotelaria', '/brindes-de-fim-de-ano/': 'kits' };
  if (!form.querySelector('input[name="tipo"]:checked') && tipoPorPagina[origemPagina]) {
    var rt = form.querySelector('input[name="tipo"][value="' + tipoPorPagina[origemPagina] + '"]'); if (rt) { rt.checked = true; syncType(); }
  }
  if (!origemPagina) { try { var rf = document.referrer ? new URL(document.referrer) : null; if (rf && rf.host === location.host) origemPagina = rf.pathname; } catch (e) {} }
  setField('origem_pagina', origemPagina);
  ['primeira_pagina', 'referencia', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (k) { setField(k, origem[k]); });

  var setError = function (id, msg) {
    var el = document.getElementById(id), err = document.getElementById(id + '-error');
    if (el) el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (err) err.textContent = msg || '';
    return !msg;
  };
  var validate = function () {
    var ok = true, first = null;
    var check = function (id, msg) { if (!setError(id, msg) && msg) { ok = false; if (!first) first = id; } };
    var contato = form.contato.value.trim(), digits = contato.replace(/\D/g, '');
    var isMail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contato);
    check('f-nome', form.nome.value.trim().length < 2 ? 'Informe seu nome.' : '');
    check('f-contato', !contato ? 'Informe um e-mail ou WhatsApp para resposta.' : (!isMail && digits.length < 10 ? 'Confira o contato: use um e-mail válido ou um telefone com DDD.' : ''));
    check('f-tipo', !form.querySelector('input[name="tipo"]:checked') ? 'Escolha o tipo de projeto.' : '');
    check('f-objetivo', form.objetivo.value.trim().length < 10 ? 'Conte em poucas palavras o objetivo da ação.' : '');
    check('f-consent', !form.consentimento.checked ? 'É preciso concordar com o uso dos dados para receber a proposta.' : '');
    if (first) {
      var f = document.getElementById(first), target = f.matches('fieldset') ? f.querySelector('input') : f;
      f.scrollIntoView({ block: 'center' });
      target.focus({ preventScroll: true });
    }
    return ok;
  };
  form.addEventListener('input', function (e) { if (e.target.getAttribute('aria-invalid') === 'true') setError(e.target.id, ''); });

  var summaryText = function () {
    var fd = new FormData(form), tipo = form.querySelector('input[name="tipo"]:checked');
    var lines = ['Pedido de proposta · TaMa Creative', 'Número do pedido: ' + pedidoId.slice(0, 8).toUpperCase(), '', 'Nome: ' + (fd.get('nome') || ''), 'Empresa: ' + (fd.get('empresa') || '—'), 'Contato: ' + (fd.get('contato') || ''), 'Tipo de projeto: ' + (tipo ? tipo.parentNode.textContent.trim() : '—')];
    if (fd.get('interesse')) lines.push('Interesse: ' + fd.get('interesse'));
    if (fd.get('quantidade')) lines.push('Quantidade: ' + fd.get('quantidade'));
    if (fd.get('data')) { var p = String(fd.get('data')).split('-'); lines.push('Data desejada: ' + p[2] + '/' + p[1] + '/' + p[0]); }
    if (fd.get('orcamento')) lines.push('Orçamento: ' + fd.get('orcamento'));
    if (fd.get('selecao')) lines.push('Peças de interesse: ' + fd.get('selecao'));
    lines.push('', 'Objetivo:', String(fd.get('objetivo') || ''));
    return lines.join('\n');
  };
  var result = document.getElementById('form-result'), statusEl = document.getElementById('form-status'), submitBtn = document.getElementById('submit-btn');
  var showResult = function (kind) {
    result.textContent = '';
    result.appendChild(document.getElementById('tpl-' + kind).content.cloneNode(true));
    result.className = 'result' + (kind === 'ok' ? ' ok' : '');
    result.hidden = false;
    var box = result.querySelector('textarea'); if (box) box.value = summaryText();
    var ref = result.querySelector('[data-pedido-ref]'); if (ref) ref.textContent = pedidoId.slice(0, 8).toUpperCase();
    var wa = result.querySelector('[data-wa-summary]');
    if (wa && CFG.whatsapp) wa.href = 'https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(summaryText());
    var h = result.querySelector('h2');
    h.setAttribute('tabindex', '-1');
    result.scrollIntoView({ block: 'start' });
    h.focus({ preventScroll: true });
  };
  result.addEventListener('click', function (e) {
    if (e.target.closest('[data-copy]')) {
      var box = result.querySelector('textarea'), msg = result.querySelector('[data-copy-status]');
      var fallback = function () { box.focus(); box.select(); msg.textContent = 'Texto selecionado. Use Ctrl+C para copiar.'; };
      try { navigator.clipboard.writeText(box.value).then(function () { msg.textContent = 'Resumo copiado.'; }, fallback); } catch (err) { fallback(); }
    }
    if (e.target.closest('[data-retry]')) {
      result.hidden = true; form.hidden = false;
      submitBtn.scrollIntoView({ block: 'center' });
      submitBtn.focus({ preventScroll: true });
    }
  });
  // Só mostra "Recebemos o seu pedido" quando o n8n confirma que GRAVOU este pedido: {"gravado": true, "pedido_id": <o enviado>}.
  // HTTP 200 sem essa confirmação, erro, timeout ou falha de rede mostram o estado de erro (com nova tentativa sem duplicar).
  var sending = false;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    if (!validate()) { statusEl.textContent = 'Revise os campos destacados.'; return; }
    sending = true;
    statusEl.textContent = 'Enviando…';
    submitBtn.disabled = true;
    submitBtn.setAttribute('aria-busy', 'true');
    var sig = assinatura(), ultimo = sget('tama-pedido-sig');
    if (ultimo && ultimo !== sig) { pedidoId = novoId(); sset('tama-pedido-id', pedidoId); form.pedido_id.value = pedidoId; }
    sset('tama-pedido-sig', sig);
    var body = new URLSearchParams(new FormData(form)).toString();
    var controller = 'AbortController' in window ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 20000) : null;
    var tipoAtual = (form.querySelector('input[name="tipo"]:checked') || {}).value || '';
    fetch(form.getAttribute('data-endpoint') || '/api/proposta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json', 'X-TaMa-Envio': 'fetch' },
      body: body, signal: controller ? controller.signal : undefined
    })
      .then(function (r) {
        if (!r.ok) throw new Error('http_' + r.status);
        return r.json().catch(function () { throw new Error('resposta_invalida'); });
      })
      .then(function (d) {
        if (!d || d.gravado !== true || d.pedido_id !== pedidoId) throw new Error('nao_confirmado');
        statusEl.textContent = '';
        form.hidden = true;
        showResult('ok');
        track('proposta_gravada', { tipo: tipoAtual, pecas: getSel().length, duplicado: !!d.duplicado });   // origem e UTMs ficam só no pedido
        setSel([]);
        sset('tama-pedido-id', null); sset('tama-pedido-sig', null);   // o próximo pedido nesta sessão ganha outro número
      })
      .catch(function (err) {
        var motivo = err && err.name === 'AbortError' ? 'tempo_esgotado' : (err instanceof TypeError ? 'rede' : String((err && err.message) || err).slice(0, 40));
        statusEl.textContent = '';
        form.hidden = true;
        showResult('error');
        track('proposta_falha', { tipo: tipoAtual, motivo: motivo });
      })
      .then(function () { if (timer) clearTimeout(timer); sending = false; submitBtn.disabled = false; submitBtn.removeAttribute('aria-busy'); });
  });
})();
