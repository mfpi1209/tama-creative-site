/* TaMa Creative — comportamento do site (sem dependências). */
(function () {
  'use strict';
  function readJSON(id) { try { return JSON.parse(document.getElementById(id).textContent); } catch (e) { return {}; } }
  var CFG = readJSON('tama-config');
  var CAT = readJSON('tama-catalog');
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
    window.gtag('js', new Date());
    window.gtag('config', CFG.ga4, { anonymize_ip: true });
  }
  function store(key, val) { try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { return null; } }
  var consentBox = document.getElementById('consent');
  if (CFG.ga4 && consentBox) {
    var c = store('tama-consent');
    if (c === 'granted') loadGA(); else if (c !== 'denied') consentBox.hidden = false;
    consentBox.addEventListener('click', function (e) {
      var b = e.target.closest('[data-consent]');
      if (!b) return;
      store('tama-consent', b.getAttribute('data-consent'));
      consentBox.hidden = true;
      if (b.getAttribute('data-consent') === 'granted') loadGA();
    });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-track]');
    if (t) track(t.getAttribute('data-track'), { label: t.getAttribute('data-track-label') || t.textContent.trim().slice(0, 60), page: location.pathname });
  });
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
  }
  if (menuBtn) menuBtn.addEventListener('click', function () { setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav && nav.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); }
  });
  var legacy = { brindes: '/brindes-corporativos/', curadoria: '/brindes-corporativos-premium/', confeccoes: '/confeccoes-personalizadas/', marcas: '/catalogo/', sobre: '/sobre/', contato: '/solicitar-proposta/', colecoes: '/brindes-corporativos-premium/' };
  function legacyRedirect() { var h = location.hash.replace('#', ''); if (location.pathname === '/' && legacy[h]) location.replace(legacy[h]); }
  legacyRedirect();
  window.addEventListener('hashchange', legacyRedirect);

  /* ---------- Seleção (peça + cor de referência) ---------- */
  var lbSlug = null;
  function getSel() {
    var raw;
    try { raw = JSON.parse(store(STORE_KEY) || '[]'); } catch (e) { raw = []; }
    return (Array.isArray(raw) ? raw : []).map(function (x) { return typeof x === 'string' ? { s: x, c: null } : x; }).filter(function (x) { return x && CAT[x.s]; });
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
  // catálogo da curadoria: ?categoria= na URL já abre filtrado (ex.: link "Ver no catálogo" das confecções)
  var catParam = new URLSearchParams(location.search).get('categoria');
  if (catParam) document.querySelectorAll('[data-rail-filter="catalogo-grid"]').forEach(function (c) { if (c.getAttribute('data-value') === catParam) c.click(); });

  /* ---------- Carrossel da abertura ---------- */
  var hero = document.getElementById('hero');
  if (hero) {
    var slides = hero.querySelectorAll('.slide'), dots = hero.querySelectorAll('.dot');
    var pauseBtn = hero.querySelector('[data-hero-pause]');
    var idx = 0, timer = null, userPaused = !!reduceMotion, hover = false;
    var go = function (n) {
      idx = (n + slides.length) % slides.length;
      slides.forEach(function (s, i) {
        var on = i === idx;
        s.classList.toggle('is-active', on);
        if (on) { s.removeAttribute('aria-hidden'); s.removeAttribute('inert'); } else { s.setAttribute('aria-hidden', 'true'); s.setAttribute('inert', ''); }
      });
      dots.forEach(function (d, i) { if (i === idx) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
    };
    var schedule = function () {
      clearInterval(timer);
      if (!userPaused && !hover) timer = setInterval(function () { go(idx + 1); }, 7000);
    };
    var syncPause = function () {
      pauseBtn.setAttribute('aria-pressed', String(userPaused));
      pauseBtn.setAttribute('aria-label', userPaused ? 'Retomar troca automática' : 'Pausar troca automática');
    };
    hero.querySelector('[data-hero-prev]').addEventListener('click', function () { go(idx - 1); schedule(); });
    hero.querySelector('[data-hero-next]').addEventListener('click', function () { go(idx + 1); schedule(); });
    dots.forEach(function (d) { d.addEventListener('click', function () { go(+d.getAttribute('data-slide')); schedule(); }); });
    pauseBtn.addEventListener('click', function () { userPaused = !userPaused; syncPause(); schedule(); });
    hero.addEventListener('mouseenter', function () { hover = true; schedule(); });
    hero.addEventListener('mouseleave', function () { hover = false; schedule(); });
    hero.addEventListener('focusin', function () { hover = true; schedule(); });
    hero.addEventListener('focusout', function () { hover = false; schedule(); });
    hero.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { go(idx + 1); schedule(); }
      if (e.key === 'ArrowLeft') { go(idx - 1); schedule(); }
    });
    var tx = null;
    hero.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
    hero.addEventListener('touchend', function (e) {
      if (tx === null) return;
      var dx = e.changedTouches[0].clientX - tx;
      if (Math.abs(dx) > 50) { go(idx + (dx < 0 ? 1 : -1)); schedule(); }
      tx = null;
    });
    document.addEventListener('visibilitychange', function () { hover = document.hidden; schedule(); });
    syncPause();
    schedule();
  }

  /* ---------- Filtros da curadoria (com ?ocasiao= e ?categoria= na URL) ---------- */
  var grid = document.getElementById('gift-grid');
  if (grid) {
    var params = new URLSearchParams(location.search);
    var state = { cat: params.get('categoria') || 'todas', occ: params.get('ocasiao') || 'todas' };
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
      alemHead.hidden = nAlem === 0;
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
  var pre = new URLSearchParams(location.search).get('tipo');
  if (pre) { var r = form.querySelector('input[name="tipo"][value="' + pre.replace(/[^a-z]/g, '') + '"]'); if (r) r.checked = true; }
  syncType();

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
    var lines = ['Pedido de proposta · TaMa Creative', '', 'Nome: ' + (fd.get('nome') || ''), 'Empresa: ' + (fd.get('empresa') || '—'), 'Contato: ' + (fd.get('contato') || ''), 'Tipo de projeto: ' + (tipo ? tipo.parentNode.textContent.trim() : '—')];
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
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) { statusEl.textContent = 'Revise os campos destacados.'; return; }
    statusEl.textContent = 'Enviando…';
    submitBtn.disabled = true;
    var body = new URLSearchParams(new FormData(form)).toString();
    var controller = 'AbortController' in window ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 15000) : null;
    fetch(form.getAttribute('data-endpoint') || '/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body, signal: controller ? controller.signal : undefined })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        statusEl.textContent = '';
        form.hidden = true;
        showResult('ok');
        track('form_submit_success', { tipo: (form.querySelector('input[name="tipo"]:checked') || {}).value || '', pecas: getSel().length });
        setSel([]);
      })
      .catch(function (err) {
        statusEl.textContent = '';
        form.hidden = true;
        showResult('error');
        track('form_submit_error', { reason: String((err && err.message) || err).slice(0, 80) });
      })
      .then(function () { if (timer) clearTimeout(timer); submitBtn.disabled = false; });
  });
})();
