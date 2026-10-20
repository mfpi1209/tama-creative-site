// Testes de fluxos críticos do site TaMa Creative.
// Uso: node tests/e2e.mjs [baseURL]   (padrão http://127.0.0.1:8099, servindo dist/)
// Requer puppeteer-core e um Edge/Chrome local (EDGE_PATH). Não envia nada para produção:
// o POST do formulário é interceptado e respondido localmente.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.argv[2] || 'http://127.0.0.1:8099';
const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = +process.env.E2E_PORT || 9335;
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
// toda bolinha de cor dos cards tem foto própria no JSON tama-catalog (campo v); card com uma cor só não troca a foto
const colorsHavePhoto = (page, sel) => page.evaluate(sel => {
  const el = document.getElementById('tama-catalog');   // dados do catálogo: arquivo em cache (window.TAMA_CAT) ou, antes, embutidos na página
  const cat = window.TAMA_CAT || (el ? JSON.parse(el.textContent) : {}), cards = [...document.querySelectorAll(sel)];
  return cards.length > 0 && cards.every(p => { const sw = [...p.querySelectorAll('.swatch')].map(b => b.dataset.color); const v = cat[p.dataset.slug].v || {}; return sw.length < 2 || sw.every(c => c in v); });
}, sel);

async function start() {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'tama-e2e-'));
  spawn(EDGE, [`--remote-debugging-port=${PORT}`, '--headless=new', '--no-first-run', '--disable-gpu', `--user-data-dir=${prof}`, 'about:blank'], { detached: true, stdio: 'ignore' }).unref();
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return puppeteer.connect({ browserWSEndpoint: (await r.json()).webSocketDebuggerUrl, defaultViewport: null }); } catch {}
    await sleep(500);
  }
  throw new Error('browser did not start');
}

const browser = await start();
try {
  const page = await browser.newPage();
  // Rolagem suave faz o clique automatizado cair na posição antiga do botão; o site respeita reduced-motion.
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  console.log('Navegação');
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  // temporada (site.config.json › temporada): o fim de ano abre o carrossel e ganha item no menu
  const SEASON = await page.$eval('html', h => h.dataset.temporada || '');
  const FIM = SEASON === 'fim-de-ano' ? 1 : 2;
  const links = await page.$$eval('a[href^="/"]', as => [...new Set(as.map(a => a.getAttribute('href').split('#')[0].split('?')[0]))]);
  const broken = [];
  for (const l of links) { const r = await fetch(BASE + l); await r.arrayBuffer(); if (r.status !== 200) broken.push(l + ' ' + r.status); }
  const catHref = await page.$eval('#sub-brindes', n => [...n.querySelectorAll('a')].map(a => [a.textContent.trim(), a.getAttribute('href')]).find(([t]) => t === 'Catálogo completo')?.[1]);
  ok(catHref === '/catalogo/', `menu Brindes › "Catálogo completo" abre /catalogo/ (${catHref})`);
  ok(await page.$eval('#site-nav .head-search', f => f.getAttribute('action') === '/catalogo/' && f.querySelector('input').name === 'q'), 'menu do celular tem a busca no catálogo (/catalogo/?q=)');
  ok(broken.length === 0, `${links.length} links internos respondem 200${broken.length ? ' — quebrados: ' + broken.join(', ') : ''}`);
  await page.evaluate(() => localStorage.setItem('tama-consent', 'denied'));   // o aviso de cookies (testado adiante) cobriria o fim do menu no celular
  await page.reload({ waitUntil: 'networkidle0' });
  await page.click('#menu-btn');
  ok(await page.$eval('#site-nav', n => n.classList.contains('is-open')), 'menu mobile abre');
  await page.click('[aria-controls="sub-brindes"]');
  ok(await page.$eval('[aria-controls="sub-brindes"]', b => b.getAttribute('aria-expanded') === 'true') && await page.$eval('#sub-brindes', d => getComputedStyle(d).display !== 'none' && d.querySelectorAll('.nav-list:not(.nav-list-pe) a').length >= 9), 'no celular, Brindes abre em acordeão com a lista dos tipos de peça');
  ok(await page.$$eval('#sub-brindes a', as => as.every(a => a.getBoundingClientRect().height >= 44 && a.getBoundingClientRect().right <= innerWidth && a.scrollWidth <= a.clientWidth + 1)) && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'celular: lista de Brindes com toque de 44px, texto sem vazar e sem rolagem lateral');
  await page.click('[aria-controls="sub-kits"]');
  ok(await page.$eval('[aria-controls="sub-brindes"]', b => b.getAttribute('aria-expanded') === 'false') && await page.$eval('#sub-kits', d => getComputedStyle(d).display !== 'none'), 'abrir outro grupo (Kits) fecha o anterior');
  await page.keyboard.press('Escape');
  ok(await page.$eval('[aria-controls="sub-kits"]', b => b.getAttribute('aria-expanded') === 'false' && document.activeElement === b) && await page.$eval('#site-nav', n => n.classList.contains('is-open')), 'Esc fecha primeiro o submenu (o foco volta ao botão), com o menu ainda aberto');
  await page.keyboard.press('Escape');
  ok(!(await page.$eval('#site-nav', n => n.classList.contains('is-open'))), 'Esc fecha o menu mobile');
  await page.goto('about:blank');
  await page.goto(BASE + '/#curadoria', { waitUntil: 'domcontentloaded' });
  ok(await page.waitForFunction(() => location.pathname === '/brindes-por-ocasiao/', { timeout: 8000 }).then(() => true, () => false), 'link antigo /#curadoria redireciona');

  console.log('Cookies');
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.removeItem('tama-consent'));
  await page.reload({ waitUntil: 'networkidle0' });
  ok(await page.$eval('#consent', b => !b.hidden && getComputedStyle(b).display !== 'none' && /Aceitar todos/.test(b.textContent) && /essenciais/.test(b.textContent)), 'primeira visita mostra o aviso de cookies (aceitar todos ou só os essenciais)');
  ok(await page.evaluate(() => !document.querySelector('script[src*="googletagmanager"]')), 'nenhum script de análise antes da escolha');
  await page.click('#consent [data-consent="denied"]');
  ok(await page.$eval('#consent', b => b.hidden && getComputedStyle(b).display === 'none') && await page.evaluate(() => localStorage.getItem('tama-consent')) === 'denied', '"Só os essenciais" fecha o aviso e guarda a escolha');
  await page.reload({ waitUntil: 'networkidle0' });
  ok(await page.$eval('#consent', b => b.hidden), 'a escolha vale nas próximas páginas (o aviso não volta)');
  await page.$eval('.site-footer [data-consent-open]', b => b.click());
  ok(await page.$eval('#consent', b => !b.hidden) && await page.evaluate(() => document.activeElement?.getAttribute('data-consent') === 'granted'), '"Cookies" no rodapé reabre o aviso com o foco no primeiro botão');
  await page.click('#consent [data-consent="denied"]');
  ok((await (await fetch(BASE + '/privacidade/')).text()).includes('id="cookies"'), 'política de privacidade explica os cookies');

  console.log('Carrossel da abertura');
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  ok(await page.$$eval('h1', h => h.length) === 1 && await page.$$eval('#hero .slide', s => s.length) === 6 && await page.$eval('[data-hero-count]', c => c.parentElement.textContent.replace(/\s+/g, ' ').trim() === '01 / 06') && await page.$$eval('#hero .dot', d => d.length === 6), 'home tem um único H1 com 6 slides (contador 01 / 06 e 6 pontos)');
  const slideHrefs = ['/catalogo/', '/brindes-de-fim-de-ano/', '/confeccoes-personalizadas/', '/kits-corporativos/', '/catalogo/?categoria=canetas-escritorio#catalogo', '/ativacoes-promocionais/'];
  if (FIM === 1) slideHrefs.unshift(slideHrefs.splice(1, 1)[0]);
  ok(await page.$$eval('#hero .slide .btn-line', a => a.map(x => x.getAttribute('href')).join()) === slideHrefs.join(), 'slides levam a rotas reais do site (catálogo, fim de ano, confecções, kits, escritório, ativações)');
  ok(await page.$eval(`#slide-${FIM}`, s => s.querySelector('.eyebrow').textContent === 'Fim de ano' && s.querySelector('p.slide-title').textContent.replace(/\s+/g, ' ') === 'Um brinde a quem fez parte do seu ano.' && s.querySelector('.btn-line').getAttribute('href') === '/brindes-de-fim-de-ano/' && s.querySelector('[data-track-label="hero-fim-de-ano"]').getAttribute('href') === '/solicitar-proposta/?tipo=kits' && /fictícia/.test(s.querySelector('img').alt)), `slide ${FIM} é o de fim de ano: leva a /brindes-de-fim-de-ano/ e ao pedido de kits, sem H1 e com a marca fictícia no texto alternativo`);
  ok(await page.$$eval('.kits-home .kit-card', k => k.length === 2 && k.every(x => x.classList.contains('big') && x.querySelector('img').alt.length > 20)) && await page.$eval('.kits-home a[href="/kits-corporativos/"]', a => /todos os kits/i.test(a.textContent)), 'home mostra 2 kits em destaque e leva a todos os kits');
  ok(await page.$$eval('.occ-faixa .occ-chips a', a => a.length === 6 && a.every(x => x.getAttribute('href') === '/brindes-de-fim-de-ano/' ? x.textContent.trim() === 'Fim de ano' : /^\/brindes-por-ocasiao\/\?ocasiao=[a-z-]+#pecas$/.test(x.getAttribute('href')))) && await page.$eval('.occ-faixa a[href="/brindes-por-ocasiao/"]', a => !!a), 'ocasiões em chips na home (fim de ano na página própria) e link para todas');
  ok(await page.$$eval('#hero .slide-copy', s => s.every(x => !x.querySelector('.hero-meta'))) && await page.$$eval('.garantias li', l => l.length === 3), 'frases de confiança saem do banner e ficam na faixa abaixo do carrossel');
  ok(await page.$$eval('.home-prods .product.studio', c => c.length === 8 && c.every(x => x.querySelector('img').alt.length > 15 && x.querySelectorAll('.swatch').length >= 4)), 'destaques: 8 peças em estúdio claro, com texto alternativo e cores com foto');
  ok(await page.$$eval('.home-prods .product.studio h3', h => h.slice(0, 4).map(x => x.textContent).join('|') === 'Polo masculina|Polo feminina|Camiseta masculina|Camiseta feminina'), 'polo e camiseta aparecem em pares masculina/feminina, lado a lado');
  ok(await page.$$eval('.home-prods .product.studio', c => [c[0], c[1], c[2], c[3]].map(x => { const i = x.querySelector('img'); return (i.currentSrc || i.getAttribute('srcset') || i.src).match(/([a-z0-9-]+~[a-z0-9-]+)\./)[1]; }).join('|') === 'polo~vermelho|polo-feminina~azul-royal|camiseta~branco|camiseta-feminina~preto'), 'a peça feminina ao lado vem em outra cor (azul royal × vermelho)');
  // nenhuma peça abre na mesma cor da vizinha (lado a lado ou logo abaixo), no computador e no celular
  for (const w of [1440, 390]) {
    await page.setViewport({ width: w, height: 900 });
    const rep = await page.$$eval('.home-prods .product.studio', cards => {
      const pos = cards.map(c => ({ r: c.getBoundingClientRect(), cor: c.querySelector('.color-name').textContent, n: c.querySelector('h3').textContent }));
      const out = [];
      pos.forEach((a, i) => pos.forEach((b, j) => {
        if (j <= i) return;
        const lado = Math.abs(a.r.top - b.r.top) < 5 && Math.abs(a.r.right - b.r.left) < 40;
        const baixo = Math.abs(a.r.left - b.r.left) < 5 && Math.abs(a.r.bottom - b.r.top) < 40;
        if ((lado || baixo) && a.cor === b.cor) out.push(`${a.n}/${b.n}: ${a.cor}`);
      }));
      return out;
    });
    ok(rep.length === 0, `destaques vizinhos abrem em cores diferentes em ${w} px${rep.length ? ' — ' + rep.join('; ') : ''}`);
  }
  await page.setViewport({ width: 1280, height: 900 });
  ok(await page.$eval('.home-prods .section-head a.link', a => a.getAttribute('href') === '/catalogo/' && /modelos do catálogo/.test(a.textContent)), 'destaques levam ao catálogo completo');
  await page.$eval('.product.studio[data-slug="polo-masculina"]', el => el.scrollIntoView({ block: 'center' }));
  await page.click('.product.studio[data-slug="polo-masculina"] .swatch[data-color="Preto"]');
  ok(await page.$eval('.product.studio[data-slug="polo-masculina"] .color-name', n => n.textContent === 'Preto'), 'cor de referência muda só o nome da cor (a foto não é recolorida)');
  await page.click('.pick[data-slug="polo-masculina"]');
  await page.goto(BASE + '/solicitar-proposta/', { waitUntil: 'networkidle0' });
  ok(await page.$eval('#f-selecao', i => i.value.includes('Polo masculina (Preto)')), 'destaque selecionado chega ao pedido de proposta com a cor');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('tama-consent', 'denied'); });
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await page.click('[data-hero-next]');
  ok(await page.$eval('#slide-2', s => s.classList.contains('is-active') && !s.hasAttribute('aria-hidden')), 'seta avança para o slide 2');
  ok(await page.$eval('#slide-1', s => s.hasAttribute('inert')), 'slide inativo fica inerte (fora do foco)');
  ok(await page.$eval('[data-hero-pause]', b => b.getAttribute('aria-pressed') === 'true'), 'com movimento reduzido, a troca automática começa pausada');
  ok(await page.$eval('[data-hero-count]', c => c.textContent === '02'), 'contador acompanha o slide (02 / 06)');
  if (FIM === 1) await page.click('[data-hero-prev]');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click(`#slide-${FIM} .btn-line`)]);
  ok(new URL(page.url()).pathname === '/brindes-de-fim-de-ano/' && /Um brinde a quem\s*fez parte do seu ano\./.test(await page.$eval('h1', h => h.textContent.replace(/\s+/g, ' '))), 'o slide de fim de ano leva a /brindes-de-fim-de-ano/');
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await page.click('[data-hero-next]');
  ok(await page.$$eval('#hero .slide', s => new Set(s.map(x => getComputedStyle(x).backgroundColor)).size === 4), 'cada slide tem o seu tom de fundo');
  ok(await page.$$eval('#hero .slide img', i => i[0].loading === 'eager' && i[0].getAttribute('fetchpriority') === 'high' && i.slice(1).every(x => x.loading === 'lazy')), 'só a primeira foto do carrossel é prioritária');
  ok(await page.$$eval('#hero .slide', s => s.every(x => { if (x.classList.contains('respiro')) return true; const c = x.querySelector('.slide-copy').getBoundingClientRect(), p = x.querySelector('.slide-photo').getBoundingClientRect(); return c.right <= p.left + p.width * 0.18; })), 'no computador o texto não invade a área nítida da foto');
  await page.click('[data-hero-pause]');
  ok(await page.$eval('#hero', h => !h.classList.contains('is-stopped') && h.classList.contains('is-held')), 'retomar a troca com o foco no carrossel mantém a pausa enquanto o foco estiver nele');
  await page.click('[data-hero-pause]');
  ok(await page.$eval('[data-hero-pause]', b => b.getAttribute('aria-pressed') === 'true' && b.getAttribute('aria-label') === 'Retomar troca automática'), 'botão de pausa alterna e atualiza o rótulo');
  // slide de fim de ano (fim-header): a taça solta começa em ~36% da largura da foto e a caixa termina em ~98%.
  // Mede onde essas faixas caem na tela (object-fit: cover + object-position) e onde termina o texto de fato.
  const fimFrame = () => page.$eval(`#slide-${FIM}`, s => {
    const ph = s.querySelector('.slide-photo').getBoundingClientRect(), img = s.querySelector('img'), r = img.getBoundingClientRect();
    const iw = +img.getAttribute('width'), ih = +img.getAttribute('height'), k = Math.max(r.width / iw, r.height / ih), sw = iw * k;
    const x0 = r.left - (sw - r.width) * parseFloat(getComputedStyle(img).objectPosition) / 100, at = f => x0 + f * sw;
    let texto = 0;
    for (const el of s.querySelector('.slide-copy').children) { const g = document.createRange(); g.selectNodeContents(el); for (const q of g.getClientRects()) texto = Math.max(texto, q.right); }
    const c = s.querySelector('.slide-copy').getBoundingClientRect();
    return { texto, taca: at(0.36), caixa: at(0.98), left: Math.max(ph.left, r.left), right: Math.min(ph.right, r.right, innerWidth), acima: ph.top >= c.bottom - 1 };
  });
  for (const w of [1440, 1280]) {
    await page.setViewport({ width: w, height: 900 });
    const f = await fimFrame();
    ok(f.texto <= f.taca && f.taca >= f.left && f.caixa <= f.right + 1, `fim de ano em ${w} px: taças e caixa inteiras na foto e o texto termina antes da taça (${Math.round(f.texto)} ≤ ${Math.round(f.taca)})`);
  }
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  ok(await page.$$eval('#hero .slide', s => s.every(x => x.querySelector('.slide-photo').getBoundingClientRect().top >= x.querySelector('.slide-copy').getBoundingClientRect().bottom - 1)), 'no celular o texto fica acima da foto, sem sobreposição');
  const fm = await fimFrame();
  ok(fm.acima && fm.taca >= fm.left && fm.caixa <= fm.right + 1, 'fim de ano no celular: a taça solta e a caixa aparecem inteiras abaixo do texto');
  for (const w of [320, 768, 1024, 1180, 1440]) {
    await page.setViewport({ width: w, height: 900 });
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `carrossel sem rolagem horizontal em ${w} px`);
  }
  await page.setViewport({ width: 1280, height: 900 });

  console.log('Vitrine, cores e seleção');
  // a vitrine das 21 peças fica na curadoria; a home mostra os destaques em estúdio claro
  await page.goto(BASE + '/brindes-por-ocasiao/', { waitUntil: 'networkidle0' });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('tama-consent', 'denied'); });
  await page.reload({ waitUntil: 'networkidle0' });
  const G = '#gift-grid';
  await page.$eval(`${G} .product[data-slug="garrafa-termica"]`, el => el.scrollIntoView({ block: 'center' }));
  await page.click(`${G} .product[data-slug="garrafa-termica"] .swatch[data-color="Azul royal"]`);
  ok(await page.$eval(`${G} .product[data-slug="garrafa-termica"] .color-name`, e => e.textContent === 'Azul royal'), 'troca de cor atualiza o nome da cor');
  await page.click(`${G} .pick[data-slug="garrafa-termica"]`);
  const sel = await page.evaluate(() => JSON.parse(localStorage.getItem('tama-selecao')));
  ok(sel.length === 1 && sel[0].s === 'garrafa-termica' && sel[0].c === 'Azul royal', 'peça entra na seleção com a cor escolhida');
  ok(await page.$eval('.site-header [data-sel-count]', e => !e.hidden && e.textContent === '1'), 'contador do cabeçalho mostra 1');
  await page.click('.site-header [data-open-drawer]');
  ok(await page.$eval('#drawer', d => d.open && d.textContent.includes('Garrafa térmica') && d.textContent.includes('Azul royal')), 'gaveta lista a peça com a cor');
  await page.keyboard.press('Escape');
  ok(!(await page.$eval('#drawer', d => d.open)), 'Esc fecha a gaveta');
  await page.$eval(`${G} .product[data-slug="agenda"]`, el => el.scrollIntoView({ block: 'center' }));
  await page.click(`${G} .product[data-slug="agenda"] .swatch[data-color="Café"]`);
  ok(await page.$eval(`${G} .product[data-slug="agenda"] .prod-media img`, i => (i.getAttribute('srcset') || '').includes('agenda-couro~cafe')), 'trocar a cor mostra a foto do produto na cor escolhida');
  await page.$eval(`${G} [data-zoom="caneca"]`, el => el.scrollIntoView({ block: 'center' }));
  await page.click(`${G} [data-zoom="caneca"]`);
  ok(await page.$eval('#lightbox', d => d.open && d.querySelector('#lb-title').textContent === 'Caneca'), 'foto ampliada abre com a peça certa');
  await page.click('#lb-pick');
  ok((await page.evaluate(() => JSON.parse(localStorage.getItem('tama-selecao')).length)) === 2, 'selecionar pela foto ampliada adiciona a peça');
  await page.keyboard.press('Escape');

  console.log('Ideias por ocasião (mesma base do catálogo)');
  await page.goto(BASE + '/brindes-por-ocasiao/', { waitUntil: 'networkidle0' });
  const visible = () => page.$$eval('#gift-grid .product, #idea-grid .idea', g => g.filter(x => !x.hidden && getComputedStyle(x).display !== 'none').length);
  const totalOcc = await page.$$eval('#gift-grid .product', g => g.length);
  ok(totalOcc >= 20 && await visible() === totalOcc, `todas as peças por ocasião aparecem sem filtro (${totalOcc})`);
  ok(await page.$$eval('#gift-grid .product', g => g.every(x => x.dataset.occ)) && !(await page.$('#idea-grid')), 'só modelos do catálogo, sem ideias sem foto');
  ok(await page.$$eval('#gift-grid .product img', i => new Set(i.map(x => (x.currentSrc || x.src).split('/').pop().split('.')[0])).size === i.length), 'por ocasião: cada peça tem a sua própria foto (nenhuma repetida)');
  ok(await colorsHavePhoto(page, '#gift-grid .product'), 'toda cor mostrada por ocasião tem foto própria (nenhuma bolinha sem efeito)');
  await page.click('.chip[data-filter="occ"][data-value="fim-de-ano"]');
  await page.click('.chip[data-filter="cat"][data-value="canetas-escritorio"]');
  const n1 = await visible(), e1 = await page.$$eval('#gift-grid .product', g => g.filter(x => x.dataset.cat === 'canetas-escritorio' && x.dataset.occ.split(' ').includes('fim-de-ano')).length);
  ok(n1 === e1 && n1 > 0, `Escritório + Fim de ano mostra só as peças marcadas (${n1})`);
  ok(page.url().includes('categoria=canetas-escritorio') && page.url().includes('ocasiao=fim-de-ano'), 'filtros ficam na URL para compartilhar');
  // uma combinação de ocasião + categoria sem nenhuma peça (calculada a partir dos cards: o catálogo cresce)
  const vazio = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#gift-grid .product')];
    const occs = [...document.querySelectorAll('.chip[data-filter="occ"]')].map(c => c.dataset.value).filter(v => v !== 'todas');
    const cats = [...document.querySelectorAll('.chip[data-filter="cat"]')].map(c => c.dataset.value).filter(v => v !== 'todas');
    for (const o of occs) for (const c of cats) if (!cards.some(x => x.dataset.cat === c && (x.dataset.occ || '').split(' ').includes(o))) return [o, c];
    return null;
  });
  if (vazio) {
    await page.click(`.chip[data-filter="occ"][data-value="${vazio[0]}"]`);
    await page.click(`.chip[data-filter="cat"][data-value="${vazio[1]}"]`);
  }
  ok(!!vazio && await page.$eval('#gift-empty', e => !e.hidden), `combinação sem resultados mostra estado vazio (${vazio && vazio.join(' + ')})`);
  await page.click('#gift-reset');
  ok(await visible() === totalOcc, 'limpar filtros volta a todas as peças');
  // catálogo em estúdio (banco de imagens de produto): página própria, chamada a partir da curadoria
  ok(await page.$eval('a.btn[href="/catalogo/"]', a => /Ver o catálogo/.test(a.textContent)), 'ideias por ocasião chamam o catálogo completo');
  await page.goto(BASE + '/catalogo/', { waitUntil: 'networkidle0' });
  const catVisible = () => page.$$eval('#catalogo-grid .product', g => g.filter(x => !x.hidden && getComputedStyle(x).display !== 'none').length);   // conta o que está mesmo na tela
  const catMatch = () => page.$$eval('#catalogo-grid .product', g => g.filter(x => !x.hidden).length);   // modelos que passam no filtro (com ou sem "Ver mais")
  const nModelos = +(await page.$eval('h1', h => (h.textContent.match(/(\d+) modelos/) || [])[1]));
  ok(await page.$$eval('h1', h => h.length === 1) && nModelos === 190, `página do catálogo tem H1 com o total de 190 modelos (${nModelos})`);
  // abertura da mesma família dos cabeçalhos com foto, sem foto: eyebrow, "78 modelos" + "para a sua marca." em itálico vinho, apoio e a busca logo abaixo
  ok(await page.evaluate(() => { const h = document.querySelector('.text-head.text-head-xl'); const q = document.getElementById('cat-q'); return !!h && h.querySelector('.eyebrow')?.textContent === 'Catálogo' && h.querySelector('h1 em')?.textContent === 'para a sua marca.' && !!h.querySelector('.lead') && !h.querySelector('img') && !!q && q.getBoundingClientRect().top >= h.getBoundingClientRect().bottom - 1 && q.getBoundingClientRect().top - h.getBoundingClientRect().bottom < 260; }), 'catálogo: abertura sem foto com "para a sua marca." em destaque e a busca logo abaixo');
  ok(await page.$$eval('#catalogo-grid .product[data-cat="garrafas-copos"]', g => g.length) === 62 && await page.$eval('input[name="categoria"][value="garrafas-copos"]', i => i.parentNode.querySelector('small').textContent === '62'), 'Garrafas e copos tem 62 modelos (11 + 13 de fim de ano + 38 da apresentação de 20/10)');
  // 12 modelos por vez: todos ficam no HTML (Google), "Ver mais" libera mais 12 e leva o foco ao primeiro novo
  const abrirTodos = async () => { while (await page.$eval('[data-cat-mais-box]', b => !b.hidden)) { await page.$eval('[data-cat-mais]', b => b.click()); await sleep(80); } };
  ok(await catVisible() === 12 && await page.$$eval('#catalogo-grid .product', (g, n) => g.length === n, nModelos)
     && await page.$eval('[data-cat-mais]', b => b.textContent === 'Ver mais 12 modelos') && await page.$eval('.cat-mais p', p => p.textContent.replace(/\s+/g, ' ').trim()) === `Mostrando 12 de ${nModelos} modelos`,
     'catálogo abre com 12 modelos, todos no HTML, e "Ver mais 12 modelos"');
  await page.$eval('[data-cat-mais]', b => b.click()); await sleep(150);
  ok(await catVisible() === 24 && await page.evaluate(() => { const c = document.activeElement.closest('.product'); return !!c && [...document.querySelectorAll('#catalogo-grid .product:not([hidden])')].indexOf(c) === 12; }), '"Ver mais" mostra mais 12 e leva o foco ao 13º modelo');
  await abrirTodos();
  ok(await catVisible() === nModelos && await page.$$eval('#catalogo-grid .product .prod-media > picture img', (i, n) => i.length === n && i.every(x => x.alt.length > 15), nModelos), 'catálogo mostra todos os modelos do banco, com texto alternativo');
  ok(await page.$$eval('#catalogo-grid .product[data-slug="caneca"] .swatch', s => s.length === 6), 'caneca tem 6 cores com foto');
  ok(await colorsHavePhoto(page, '#catalogo-grid .product.studio'), 'toda cor mostrada no catálogo tem foto própria (nenhuma bolinha sem efeito)');
  await page.$eval('#catalogo-grid .product[data-slug="caneca"]', el => el.scrollIntoView({ block: 'center' }));
  await page.click('#catalogo-grid .product[data-slug="caneca"] .swatch[data-color="Verde"]');
  ok(await page.$eval('#catalogo-grid .product[data-slug="caneca"] .prod-media img', i => (i.getAttribute('srcset') || '').includes('caneca~verde')), 'trocar a cor mostra a foto da caneca verde (variação gerada)');
  await page.click('#catalogo-grid .product[data-slug="caneca"] .swatch[data-color="Branco"]');
  ok(await page.$$eval('#catalogo-grid .prod-meta', m => m.every(x => x.textContent === 'Material e técnica sob consulta')), 'material e técnica a confirmar não saem como especificação');
  // desktop: busca acima da grade, filtro lateral (categoria e família de cor) e 3 colunas; o estado vai para a URL
  ok(await page.$eval('#cat-filtros', s => getComputedStyle(s).position === 'sticky') && await page.$$eval('#catalogo-grid .product', ps => new Set(ps.slice(0, 6).map(p => Math.round(p.getBoundingClientRect().left))).size === 3), 'desktop: filtro lateral fixo e grade de 3 colunas');
  await page.$eval('#cat-q', el => el.scrollIntoView({ block: 'center' }));
  await page.type('#cat-q', 'caneca');
  await sleep(400);
  const nBusca = await catMatch();
  ok(nBusca === 15 && /q=caneca/.test(await page.evaluate(() => location.search)), `busca "caneca" acha os 15 modelos com caneca no nome e grava ?q= na URL (${nBusca})`);
  await page.$eval('#cat-q', el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(400);
  await page.$eval('#cat-filtros input[name="categoria"][value="hotelaria-gastronomia"]', el => el.scrollIntoView({ block: 'center' }));
  await page.click('#cat-filtros input[name="categoria"][value="hotelaria-gastronomia"]'); await sleep(200);
  ok(await catVisible() === 5, 'categoria Hotelaria e gastronomia mostra 5 modelos');
  await page.$eval('#cat-filtros input[name="cor"][value="verde"]', el => el.scrollIntoView({ block: 'center' }));
  await page.click('#cat-filtros input[name="cor"][value="verde"]'); await sleep(200);
  const nVerde = await catVisible();
  ok(nVerde > 0 && nVerde < 5 && /categoria=hotelaria-gastronomia/.test(await page.evaluate(() => location.search)) && /cor=verde/.test(await page.evaluate(() => location.search)), `categoria + cor combinam e vão para a URL (${nVerde})`);
  ok(await page.$$eval('#catalogo-grid .product:not([hidden])', ps => ps.every(p => /Verde/.test(p.getAttribute('data-color') || p.querySelector('.color-name').textContent))), 'com filtro de cor, os cards mostram a peça na cor escolhida (ou já abrem nela)');
  // celular: uma foto por linha, filtros na gaveta
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(BASE + '/catalogo/?categoria=hotelaria-gastronomia&cor=verde', { waitUntil: 'networkidle0' });
  ok(await catVisible() === nVerde && await page.$eval('[data-cat-badge]', b => b.textContent === '2' && !b.hidden), 'link com filtros abre igual no celular; o botão mostra 2 filtros ativos');
  ok(await page.$eval('#catalogo-grid .product:not([hidden])', p => p.getBoundingClientRect().width > 330), 'celular: uma foto grande por linha');
  await page.$eval('[data-cat-open]', el => el.scrollIntoView({ block: 'center' }));
  await page.click('[data-cat-open]'); await sleep(400);
  ok(await page.$eval('#cat-filtros', s => s.classList.contains('is-open') && s.getAttribute('aria-modal') === 'true' && s.contains(document.activeElement)), 'botão Filtros abre a gaveta com o foco dentro');
  ok(await page.$eval('.cat-side-foot [data-cat-n]', e => e.textContent) === String(nVerde), 'o botão da gaveta mostra o total filtrado');
  await page.keyboard.press('Escape'); await sleep(300);
  ok(await page.$eval('#cat-filtros', s => !s.classList.contains('is-open')) && await page.evaluate(() => document.activeElement.hasAttribute('data-cat-open')), 'Esc fecha a gaveta e devolve o foco ao botão');
  await page.evaluate(() => document.getElementById('cat-form').reset()); await sleep(200);
  ok(await catVisible() === 12 && await page.$eval('[data-cat-mais-box]', b => !b.hidden), 'limpar filtros volta aos 12 primeiros modelos, com "Ver mais"');
  await page.setViewport({ width: 1280, height: 900 });
  await abrirTodos();
  ok((await page.evaluate(() => JSON.parse(localStorage.getItem('tama-selecao')))).some(x => x.s === 'caneca'), 'a caneca escolhida nas ideias por ocasião é o mesmo modelo do catálogo (um id só)');
  ok(await page.$eval('#catalogo-grid .pick[data-slug="caneca"]', b => b.getAttribute('aria-pressed') === 'true'), 'no catálogo a caneca já aparece selecionada');
  await page.$eval('#catalogo-grid .product[data-slug="cardapio"]', el => el.scrollIntoView({ block: 'center' }));
  await page.click('#catalogo-grid .pick[data-slug="cardapio"]');
  ok((await page.evaluate(() => JSON.parse(localStorage.getItem('tama-selecao')))).some(x => x.s === 'cardapio' && x.c), 'modelo do catálogo entra na seleção com a cor da foto');
  // página de cada modelo: o card leva até ela; galeria por cor, cor na URL e canonical sem a cor
  ok(await page.$eval('#catalogo-grid .product[data-slug="caneca"] .prod-link', a => a.getAttribute('href') === '/catalogo/caneca/') && await page.$eval('#catalogo-grid .product[data-slug="caneca"] a.prod-media', a => a.getAttribute('href') === '/catalogo/caneca/'), 'nome e foto do card levam à página do modelo');
  await page.goto(BASE + '/catalogo/caneca/?cor=verde', { waitUntil: 'networkidle0' });
  const pdp = await page.evaluate(() => ({ h1: document.querySelector('h1').textContent, cor: document.querySelector('.pdp .color-name').textContent, img: document.querySelector('.pdp-main img').getAttribute('srcset') || '', canon: document.querySelector('link[rel=canonical]').href, thumbs: document.querySelectorAll('.pdp-thumb').length, pressed: (document.querySelector('.pdp-thumb[aria-pressed="true"]') || {}).getAttribute && document.querySelector('.pdp-thumb[aria-pressed="true"]').getAttribute('data-thumb-color'), crumbs: [...document.querySelectorAll('.crumbs li')].map(l => l.textContent.trim()).join(' / ') }));
  ok(pdp.h1 === 'Caneca' && pdp.cor === 'Verde' && pdp.img.includes('caneca~verde') && pdp.pressed === 'Verde', '?cor=verde abre a página da caneca já na cor verde (foto, nome e miniatura)');
  ok(pdp.canon.endsWith('/catalogo/caneca/') && pdp.thumbs === 6 && pdp.crumbs === 'Início / Catálogo / Caneca', 'página do modelo: canonical sem a cor, 6 miniaturas e caminho');
  ok(await page.evaluate(() => { const r = document.querySelector('.pdp-resumo'); const u = document.querySelectorAll('.pdp-usos li'); return !!r && r.textContent.split(/\s+/).length >= 30 && u.length >= 2 && document.title.startsWith('Caneca personalizada'); }), 'página do modelo mostra o resumo e os usos do cadastro, com título "Caneca personalizada"');
  // vistas da cor (frente, verso, bordado) na polo: acompanham a cor escolhida
  await page.goto(BASE + '/catalogo/polo-masculina/?cor=azul-marinho', { waitUntil: 'networkidle0' });
  ok(await page.$$eval('.pdp-vista:not([hidden])', b => b.map(x => x.textContent).join()) === 'Frente,Verso,Bordado', 'polo: vistas Frente, Verso e Bordado');
  await page.click('.pdp-vista[data-vista="detalhe"]'); await sleep(300);
  ok(await page.$eval('.pdp-main img', i => (i.getAttribute('srcset') || '').includes('polo~azul-marinho-bordado')), 'vista Bordado mostra o close do bordado na cor escolhida');
  await page.click('.pdp .swatch[data-color="Branco"]'); await sleep(300);
  ok(await page.$$eval('.pdp-vista:not([hidden])', b => b.map(x => x.textContent).join()) === 'Frente,Verso' && await page.$eval('.pdp-main img', i => (i.getAttribute('srcset') || '').includes('polo~branco.')), 'trocar de cor volta para a frente e mostra só as vistas que existem');
  await page.goto(BASE + '/catalogo/caneca/?cor=verde', { waitUntil: 'networkidle0' });
  await page.click('.pdp-thumb[data-thumb-color="Azul royal"]'); await sleep(300);
  ok(await page.evaluate(() => location.search === '?cor=azul-royal' && document.querySelector('.pdp .color-name').textContent === 'Azul royal'), 'miniatura troca a cor e atualiza a URL');
  ok(await page.$eval('.pdp .pick', b => b.getAttribute('aria-pressed') === 'true') && (await page.evaluate(() => JSON.parse(localStorage.getItem('tama-selecao')))).some(x => x.s === 'caneca' && x.c === 'Azul royal'), 'na página do modelo, a peça já selecionada aparece marcada e a troca de cor vai para a seleção');
  ok(await page.$$eval('.studio-grid .product', ps => ps.length === 4 && ps.every(p => p.getAttribute('data-cat') === 'garrafas-copos')), 'página do modelo sugere 4 modelos da mesma categoria');
  // passos 2 e 3: a ocasião e a quantidade seguem com a peça para a seleção e para o link da proposta
  ok(await page.$$eval('.pdp-steps > li', l => l.length === 3) && await page.$$eval('#pdp-ocasiao option', o => o.length === 8), 'página do modelo: passos cor, ocasião (7 opções) e quantidade');
  await page.select('#pdp-ocasiao', 'Fim de ano');
  await page.click('.pdp-qty [data-qty="1"]'); await page.click('.pdp-qty [data-qty="1"]'); await sleep(200);
  const pdpSel = (await page.evaluate(() => JSON.parse(localStorage.getItem('tama-selecao')))).find(x => x.s === 'caneca');
  const pdpHref = await page.$eval('[data-pdp-proposta]', a => decodeURIComponent(a.getAttribute('href')));
  ok(pdpSel && pdpSel.o === 'Fim de ano' && pdpSel.q === 15 && pdpHref.includes('interesse=Caneca (Azul royal), para Fim de ano, cerca de 15 un.'), `ocasião e quantidade vão para a seleção e para "Solicitar proposta só desta peça" (${pdpHref})`);
  // modelo novo: bolsa listrada com a inicial T (cinco cores, todas com foto e a marca TaMa na etiqueta)
  await page.goto(BASE + '/catalogo/bolsa-listrada-com-inicial/', { waitUntil: 'networkidle0' });
  const bolsa = await page.evaluate(() => ({ h1: document.querySelector('h1').textContent, thumbs: [...document.querySelectorAll('.pdp-thumb')].map(t => t.getAttribute('data-thumb-color')).join(), alt: document.querySelector('.pdp-main img').alt, resumo: (document.querySelector('.pdp-resumo') || {}).textContent || '', crumbs: [...document.querySelectorAll('.crumbs li')].map(l => l.textContent.trim()).join(' / ') }));
  ok(bolsa.h1 === 'Bolsa listrada com inicial' && bolsa.thumbs === 'Laranja e azul,Amarelo e rosa,Azul e branco,Rosa e verde,Vermelho e rosa' && /letra T/.test(bolsa.alt) && /TaMa/.test(bolsa.alt) && bolsa.resumo.length > 100 && bolsa.crumbs.endsWith('Bolsa listrada com inicial'), `bolsa listrada com inicial: página própria com 5 cores, a letra T e a marca TaMa no texto alternativo (${bolsa.thumbs})`);
  ok(await page.$$eval('.studio-grid .product', ps => ps.length === 4 && ps.every(p => p.getAttribute('data-cat') === 'bolsas-embalagens')), 'bolsa listrada sugere modelos de bolsas e embalagens');
  await page.goto(BASE + '/catalogo/?categoria=vestuario', { waitUntil: 'networkidle0' });
  ok(await catMatch() === 13 && await page.$eval('input[name="categoria"][value="vestuario"]', i => i.checked), '?categoria=vestuario abre o catálogo já filtrado (13 peças de vestuário)');
  await page.goto(BASE + '/catalogo/?categoria=tecnologia', { waitUntil: 'networkidle0' });
  ok(await catVisible() === 12 && await catMatch() === 13 && await page.$eval('input[name="categoria"][value="tecnologia"]', i => i.checked && i.parentNode.querySelector('small').textContent === '13'), '?categoria=tecnologia abre o catálogo já filtrado (13 modelos de tecnologia, 12 na 1ª página, contador 13)');
  // tipo de peça pela URL (links dos painéis Brindes e Confecções): data-tipo dos cards, radio, etiqueta, contador e URL
  const TIPOS_BRINDE = ['agendas', 'canetas', 'canecas', 'copos', 'xicaras', 'tacas', 'squeezes', 'porta-vinho', 'mochilas'];
  await page.goto(BASE + '/catalogo/?tipo=canecas', { waitUntil: 'networkidle0' });
  const tCan = await page.$$eval('#catalogo-grid .product', g => ({ n: g.filter(x => !x.hidden).length, e: g.filter(x => x.dataset.tipo === 'canecas').length, fora: g.filter(x => !x.hidden && x.dataset.tipo !== 'canecas').length, sem: g.filter(x => !x.hasAttribute('data-tipo')).length }));
  ok(tCan.n >= 1 && tCan.n === tCan.e && tCan.fora === 0 && tCan.sem === 0, `?tipo=canecas mostra só as canecas (${tCan.n}); todo card do catálogo tem data-tipo`);
  ok(await page.$eval('#cat-filtros input[name="tipo"][value="canecas"]', i => i.checked && i.parentNode.querySelector('span').textContent === 'Canecas' && +i.parentNode.querySelector('small').textContent === document.querySelectorAll('#catalogo-grid .product[data-tipo="canecas"]').length)
     && await page.$eval('[data-cat-tipo]', b => !b.hidden && b.querySelector('[data-cat-tipo-name]').textContent === 'Canecas') && await page.$eval('#cat-count [data-cat-n]', e => +e.textContent) === tCan.n && await page.$eval('[data-cat-badge]', b => !b.hidden && b.textContent === '1'),
     '?tipo=canecas: radio marcado com rótulo e contagem, etiqueta "Tipo: Canecas", contador do total e 1 filtro no botão');
  await page.$eval('#cat-filtros input[name="tipo"][value="copos"]', el => el.scrollIntoView({ block: 'center' }));
  await page.click('#cat-filtros input[name="tipo"][value="copos"]'); await sleep(200);
  const tCop = await page.$$eval('#catalogo-grid .product', g => g.filter(x => !x.hidden).every(x => x.dataset.tipo === 'copos') && g.filter(x => !x.hidden).length);
  ok(tCop >= 1 && /tipo=copos/.test(await page.evaluate(() => location.search)) && await page.$eval('[data-cat-tipo-name]', e => e.textContent === 'Copos'), `marcar Copos filtra (${tCop}), grava ?tipo=copos e troca a etiqueta`);
  await page.$eval('#cat-filtros input[name="categoria"][value="garrafas-copos"]', el => el.scrollIntoView({ block: 'center' }));
  await page.click('#cat-filtros input[name="categoria"][value="garrafas-copos"]'); await sleep(200);
  ok(await catMatch() === tCop && /tipo=copos/.test(await page.evaluate(() => location.search)) && /categoria=garrafas-copos/.test(await page.evaluate(() => location.search)) && await page.$eval('[data-cat-badge]', b => b.textContent === '2'), 'tipo + categoria combinam, ficam na URL e contam 2 no botão Filtros');
  await page.$eval('[data-cat-tipo-clear]', el => el.scrollIntoView({ block: 'center' }));
  await page.click('[data-cat-tipo-clear]'); await sleep(200);
  ok(await page.$eval('[data-cat-tipo]', b => b.hidden) && !/tipo=/.test(await page.evaluate(() => location.search)) && /categoria=garrafas-copos/.test(await page.evaluate(() => location.search)) && await page.$eval('#cat-filtros input[name="tipo"][value=""]', i => i.checked) && await catMatch() === await page.$$eval('#catalogo-grid .product[data-cat="garrafas-copos"]', g => g.length), 'remover a etiqueta tira só o tipo (a categoria fica) e o radio volta para Todos');
  await page.goto(BASE + '/catalogo/?tipo=nao-existe', { waitUntil: 'networkidle0' });
  ok(await catMatch() === nModelos && await page.$eval('[data-cat-tipo]', b => b.hidden) && await page.$eval('#cat-filtros input[name="tipo"][value=""]', i => i.checked) && await page.$eval('[data-cat-badge]', b => b.hidden), 'tipo desconhecido na URL abre o catálogo sem filtro (radio em Todos)');
  // os tipos do menu têm modelo no catálogo; sem modelo, só os 9 tipos de brinde que esperam as fotos dos modelos novos
  const menuTipos = await page.$$eval('#sub-brindes .nav-list:not(.nav-list-pe) a, #sub-confeccoes .nav-list a', a => a.map(x => new URL(x.href).searchParams.get('tipo')));
  const tiposComModelo = await page.$$eval('#cat-filtros input[name="tipo"]', r => r.map(i => i.value).filter(Boolean));
  const tiposVazios = menuTipos.filter(t => !tiposComModelo.includes(t));
  ok(menuTipos.length >= 16 && tiposVazios.every(t => TIPOS_BRINDE.includes(t)), `links de tipo do menu (${menuTipos.length}) levam a modelos; sem modelo, só tipos de brinde (${tiposVazios.join(', ') || 'nenhum'})`);
  // ocasião pela URL (links da página de fim de ano): usa o data-occ dos cards, mostra a etiqueta e combina com a categoria
  await page.goto(BASE + '/catalogo/?ocasiao=fim-de-ano', { waitUntil: 'networkidle0' });
  const occFim = await page.$$eval('#catalogo-grid .product', g => ({ n: g.filter(x => !x.hidden).length, e: g.filter(x => (x.dataset.occ || '').split(' ').includes('fim-de-ano')).length, fora: g.filter(x => !x.hidden && !(x.dataset.occ || '').split(' ').includes('fim-de-ano')).length, slugs: g.filter(x => !x.hidden).map(x => x.dataset.slug).join() }));
  ok(occFim.n === occFim.e && occFim.fora === 0 && occFim.n >= 20 && await catMatch() === occFim.n, `?ocasiao=fim-de-ano mostra só os modelos de fim de ano (${occFim.n})`);
  ok(await page.$eval('#cat-filtros input[name="ocasiao"][value="fim-de-ano"]', i => i.checked) && await page.$eval('#cat-filtros input[name="ocasiao"][value=""]', i => !i.checked), '?ocasiao=fim-de-ano já abre com o radio Fim de ano marcado');
  ok(await page.$eval('[data-cat-occ]', b => !b.hidden && b.textContent.includes('Fim de ano')) && await page.$eval('[data-cat-badge]', b => !b.hidden && b.textContent === '1'), 'o filtro de ocasião aparece como etiqueta e conta no botão Filtros');
  await page.$eval('#cat-filtros input[name="categoria"][value="garrafas-copos"]', el => el.scrollIntoView({ block: 'center' }));
  await page.click('#cat-filtros input[name="categoria"][value="garrafas-copos"]'); await sleep(200);
  const occCat = await page.$$eval('#catalogo-grid .product', g => ({ n: g.filter(x => !x.hidden).length, e: g.filter(x => x.dataset.cat === 'garrafas-copos' && (x.dataset.occ || '').split(' ').includes('fim-de-ano')).length }));
  ok(occCat.n === occCat.e && occCat.n > 0 && occCat.n < occFim.n && /ocasiao=fim-de-ano/.test(await page.evaluate(() => location.search)) && /categoria=garrafas-copos/.test(await page.evaluate(() => location.search)), `ocasião + categoria combinam e ficam na URL (${occCat.n})`);
  await page.$eval('[data-cat-occ-clear]', el => el.scrollIntoView({ block: 'center' }));
  await page.click('[data-cat-occ-clear]'); await sleep(200);
  ok(await page.$eval('[data-cat-occ]', b => b.hidden) && !/ocasiao=/.test(await page.evaluate(() => location.search)) && await catMatch() === 62 && await page.$eval('#cat-filtros input[name="ocasiao"][value=""]', i => i.checked), 'remover a etiqueta tira só a ocasião (fica Garrafas e copos, 62 modelos) e o radio volta para Todas');
  await page.goto(BASE + '/catalogo/?ocasiao=nao-existe', { waitUntil: 'networkidle0' });
  ok(await catMatch() === nModelos && await page.$eval('[data-cat-occ]', b => b.hidden) && await page.$eval('#cat-filtros input[name="ocasiao"][value=""]', i => i.checked), 'ocasião desconhecida na URL abre o catálogo sem filtro (radio em Todas)');
  // ocasião no filtro lateral: Todas + as 7 ocasiões com contagem (Fim de ano logo depois de Todas), entre Categoria e Cor
  await page.goto(BASE + '/catalogo/', { waitUntil: 'networkidle0' });
  const occSide = await page.$$eval('#cat-filtros fieldset', fs => {
    const f = fs.find(x => x.querySelector('legend').textContent === 'Ocasião');
    const r = f ? [...f.querySelectorAll('input[name="ocasiao"]')] : [];
    const cards = [...document.querySelectorAll('#catalogo-grid .product')];
    return { ordem: fs.map(x => x.querySelector('legend').textContent).join(), vals: r.map(i => i.value).join(), todas: !!r[0] && r[0].value === '' && r[0].checked && r[0].parentNode.querySelector('span').textContent === 'Todas',
      contagem: r.slice(1).every(i => +i.parentNode.querySelector('small').textContent === cards.filter(c => (c.dataset.occ || '').split(' ').includes(i.value)).length && cards.length > 0) };
  });
  ok(occSide.ordem === 'Categoria,Tipo de peça,Ocasião,Cor' && occSide.vals.split(',').length === 8 && occSide.vals.startsWith(',fim-de-ano,') && occSide.todas && occSide.contagem, `filtro lateral tem Ocasião (Todas + 7, Fim de ano primeiro) com a contagem dos cards (${occSide.vals})`);
  await page.$eval('#cat-filtros input[name="ocasiao"][value="fim-de-ano"]', el => el.scrollIntoView({ block: 'center' }));
  await page.click('#cat-filtros input[name="ocasiao"][value="fim-de-ano"]'); await sleep(200);
  ok(await page.$$eval('#catalogo-grid .product', g => g.filter(x => !x.hidden).map(x => x.dataset.slug).join()) === occFim.slugs && /ocasiao=fim-de-ano/.test(await page.evaluate(() => location.search)) && await page.$eval('[data-cat-occ]', b => !b.hidden && b.textContent.includes('Fim de ano')), 'marcar Fim de ano mostra os mesmos modelos de ?ocasiao=fim-de-ano, grava a URL e mostra a etiqueta');
  await page.click('#cat-filtros input[name="cor"][value="verde"]'); await sleep(200);
  const occCor = await page.$$eval('#catalogo-grid .product', g => g.filter(x => !x.hidden).every(x => (x.dataset.occ || '').split(' ').includes('fim-de-ano') && (x.dataset.cores || '').split(' ').includes('verde')));
  ok(occCor && /ocasiao=fim-de-ano/.test(await page.evaluate(() => location.search)) && /cor=verde/.test(await page.evaluate(() => location.search)) && await page.$eval('[data-cat-badge]', b => b.textContent === '2'), 'ocasião + cor combinam, ficam na URL e contam 2 no botão Filtros');
  await page.click('#cat-filtros input[name="ocasiao"][value=""]'); await sleep(200);
  ok(!/ocasiao=/.test(await page.evaluate(() => location.search)) && /cor=verde/.test(await page.evaluate(() => location.search)) && await page.$eval('[data-cat-occ]', b => b.hidden), 'Todas tira só a ocasião (a cor fica)');
  await page.click('#cat-filtros input[name="ocasiao"][value="fim-de-ano"]'); await sleep(200);
  await page.$eval('#cat-filtros .cat-clear', el => el.scrollIntoView({ block: 'center' }));
  await page.click('#cat-filtros .cat-clear'); await sleep(200);
  ok(await catMatch() === nModelos && !/ocasiao=|cor=/.test(await page.evaluate(() => location.search)) && await page.$eval('[data-cat-occ]', b => b.hidden) && await page.$eval('#cat-filtros input[name="ocasiao"][value=""]', i => i.checked) && await page.$eval('[data-cat-badge]', b => b.hidden), `Limpar filtros tira a ocasião e volta aos ${nModelos} modelos`);
  // celular: a ocasião aparece na gaveta e conta no botão
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(BASE + '/catalogo/?ocasiao=fim-de-ano&categoria=garrafas-copos', { waitUntil: 'networkidle0' });
  ok(await page.$eval('[data-cat-badge]', b => !b.hidden && b.textContent === '2'), 'celular: ocasião + categoria contam 2 no botão Filtros');
  await page.$eval('[data-cat-open]', el => el.scrollIntoView({ block: 'center' }));
  await page.click('[data-cat-open]'); await sleep(400);
  await page.$eval('#cat-filtros input[name="ocasiao"][value="eventos"]', el => el.scrollIntoView({ block: 'center' }));
  await page.click('#cat-filtros input[name="ocasiao"][value="eventos"]'); await sleep(200);
  const nEv = await catMatch();
  ok(await page.$eval('#cat-filtros', s => s.classList.contains('is-open')) && /ocasiao=eventos/.test(await page.evaluate(() => location.search)) && await page.$eval('.cat-side-foot [data-cat-n]', e => +e.textContent) === nEv && await page.$eval('[data-cat-occ-name]', e => e.textContent === 'Eventos'), `celular: trocar a ocasião na gaveta atualiza a URL, a etiqueta e o total do botão (${nEv})`);
  await page.keyboard.press('Escape'); await sleep(300);
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(BASE + '/brindes-corporativos/', { waitUntil: 'networkidle0' });
  ok(await page.$$eval('.studio-grid .product.studio', c => c.length === 12) && await page.$$eval('.studio-grid', g => g.length === 1), 'brindes: uma grade só, com 12 modelos do catálogo');
  ok(await page.$$eval('.atalhos-list a', a => a.length === 5 && a.some(x => x.getAttribute('href') === '/catalogo/?categoria=tecnologia')), 'brindes: 5 atalhos para o catálogo, um deles Tecnologia');
  ok(await colorsHavePhoto(page, '.studio-grid .product'), 'brindes: toda cor mostrada tem foto própria');
  await page.goto(BASE + '/kits-corporativos/', { waitUntil: 'networkidle0' });
  const topoKits = await page.$eval('.foto-hero-photo img', i => ({ src: i.currentSrc || i.src, alt: i.alt, eager: i.loading === 'eager' }));
  const preloadKits = await page.$eval('link[rel="preload"][as="image"]', l => l.getAttribute('imagesrcset') || '');
  ok(topoKits.eager && /kits-header(-v3)?\./.test(topoKits.src) && preloadKits.includes(topoKits.src.match(/kits-header(-v3)?\./)?.[0]) && (/kits-header-v3\./.test(topoKits.src) ? /boas-vindas/.test(topoKits.alt) && /fictícia Lume/.test(topoKits.alt) && /power bank/.test(topoKits.alt) && /caixa de som/.test(topoKits.alt) : /fictícias/.test(topoKits.alt)),
     `kits: abertura com o kit de boas-vindas da marca fictícia Lume (ou a foto anterior enquanto a nova não existe), prioritária e com preload da mesma imagem (${topoKits.src.match(/kits-header(-v3)?/)?.[0]})`);
  // /kits-corporativos/ por tipo de kit: uma seção com âncora para cada tipo (o menu aponta para elas). Os kits novos da
  // apresentação de 20/10 só aparecem quando a foto existe em img/v2/; os demais têm de estar sempre no seu tipo.
  const KIT_TIPOS = { 'kits-escritorio': ['kit-escritorio', 'kit-pratico'], 'kits-cozinha': ['kit-cozinha', 'mesa-de-descobertas', 'gelato-experience', 'kit-petiscos'], 'kits-boas-vindas': ['kit-boas-vindas-tech', 'kit-conectado', 'kit-pratico'], 'kits-executivo': ['kit-executivo-verde', 'em-movimento'], 'kits-pausa': ['pausa-e-inspiracao', 'kit-cafe'], 'kits-agradecimento': ['kit-agradecimento'], 'kits-fim-de-ano': ['kit-brinde', 'kit-coquetel', 'kit-caipirinha', 'kit-gin', 'kit-vinho'] };
  const KITS_NOVOS = ['kit-boas-vindas-tech', 'kit-cozinha', 'kit-agradecimento', 'kit-caipirinha', 'kit-gin', 'kit-vinho'];
  const tiposKit = await page.evaluate(ids => ids.map(id => { const s = document.getElementById(id); return s && { id, h2: s.querySelector('.section-head h2')?.textContent.trim() || '', linha: s.querySelector('.section-head p')?.textContent.trim() || '', slugs: [...s.querySelectorAll('.kit-card a[data-track-label^="kit-"]')].map(a => a.dataset.trackLabel.slice(4)), vazio: !!s.querySelector('.kit-vazio a[href^="/solicitar-proposta/?tipo=kits"]') }; }), Object.keys(KIT_TIPOS));
  ok(tiposKit.every(Boolean) && await page.$$eval('#kits .kit-tipos a', (a, ids) => a.map(x => x.getAttribute('href')).join() === ids.map(i => '#' + i).join(), Object.keys(KIT_TIPOS)) && await page.$$eval('.studio-grid', g => g.length === 0),
     'kits: atalhos e uma seção com âncora para cada um dos 7 tipos (escritório, cozinha, boas-vindas, executivo, pausa, agradecimento, fim de ano), sem bloco do catálogo');
  ok(tiposKit.every(t => t && t.h2 && t.linha.length > 20 && t.slugs.every(s => KIT_TIPOS[t.id].includes(s)) && KIT_TIPOS[t.id].every(s => KITS_NOVOS.includes(s) || t.slugs.includes(s)) && (t.slugs.length > 0 || (t.vazio && KIT_TIPOS[t.id].every(s => KITS_NOVOS.includes(s))))),
     `kits: cada tipo com título, uma linha de texto e os seus kits; só kit novo sem foto pode faltar (${tiposKit.map(t => t && t.id.replace('kits-', '') + ' ' + t.slugs.length).join(', ')})`);
  const novosNaPagina = KITS_NOVOS.filter(s => tiposKit.some(t => t && t.slugs.includes(s)));
  console.log(`  · kits novos com foto: ${novosNaPagina.length} de ${KITS_NOVOS.length}${novosNaPagina.length < KITS_NOVOS.length ? ' (os demais aguardam a foto em img/v2/)' : ''}`);
  for (const id of Object.keys(KIT_TIPOS)) { await page.$eval('#' + id, e => e.scrollIntoView()); await page.$$eval(`#${id} img`, i => Promise.all(i.map(x => x.complete ? 0 : new Promise(r => { x.onload = x.onerror = r; })))); }
  const kitsPag = await page.$$eval('.kits-tipo .kit-card', k => k.map(x => { const im = x.querySelector('img'); return { n: x.querySelector('.eyebrow').textContent, h: x.querySelector('h3').textContent, img: im.currentSrc || im.src, ok: im.complete && im.naturalWidth > 0, alt: im.alt, href: x.querySelector('a').getAttribute('href') }; }));
  ok(kitsPag.length >= 13 && kitsPag.every(k => k.ok && /\/img\/(kitp-[a-z-]+?(-v[23])?|kits-header-v3)\./.test(k.img) && k.alt.length > 30 && !/mercedes|apple|airpods|agrocete|rc business|bayer|loja agro|alibaba|bambu|inox|madeira|couro|kraft/i.test(k.alt) && k.href === '/solicitar-proposta/?tipo=kits&interesse=' + encodeURIComponent(/^Kit /.test(k.h) ? k.h : 'Kit ' + k.h)),
     `kits: ${kitsPag.length} cards com foto carregada, texto alternativo sem marcas de terceiros nem material afirmado e "Solicitar proposta deste kit" com o interesse`);
  const ordemKits = [...new Set(kitsPag.map(k => k.h))];
  ok(ordemKits.every((h, i) => kitsPag.filter(k => k.h === h).every(k => k.n === 'Kit ' + String(i + 1).padStart(2, '0'))) && kitsPag.filter(k => k.h === 'Kit Prático').length === 2,
     `kits: numeração seguida (Kit 01 a Kit ${String(ordemKits.length).padStart(2, '0')}); o Kit Prático, em escritório e boas-vindas, tem o mesmo número nos dois`);
  ok(kitsPag.filter(k => ['Kit Boas-vindas Conectado', 'Kit Cozinha', 'Kit de Agradecimento', 'Kit Caipirinha', 'Kit Gin', 'Kit Vinho'].includes(k.h)).every(k => /Marca fictícia (Lume|Brasa|Aura|Vila|Noa|Terra); caixa /.test(k.alt)) && kitsPag.filter(k => /^Kit (Caipirinha|Gin|Vinho)$/.test(k.h)).every(k => /Sem bebida/.test(k.alt)),
     'kits novos: texto alternativo com a marca fictícia e a cor da caixa; os de drinque e de vinho dizem "sem bebida"');
  const fotosV3 = kitsPag.filter(k => /^(Gelato Experience|Mesa de Descobertas)$/.test(k.h));
  ok(fotosV3.length === 2 && fotosV3.every(k => /kitp-(gelato-experience|mesa-de-descobertas)-v[23]\./.test(k.img) && /Marca fictícia (Nexo|Elo)/.test(k.alt)), `kits: Gelato Experience (Nexo) e Mesa de Descobertas (Elo) com a foto nova, ou a v2 enquanto ela não existe (${fotosV3.map(k => k.img.match(/-v\d/)?.[0]).join(' ')})`);
  ok(!(await page.$('#tipos-t')) && !(await page.evaluate(() => document.body.textContent.includes('Um kit para cada relação'))), 'kits: sem a seção repetida "Um kit para cada relação" (os tipos de kit já estão nas seções do menu)');
  ok(!(await page.$('#rail-kits')) && await page.$eval('#comp-t', h => { const next = h.closest('section').nextElementSibling; return next && !!next.querySelector('#kit-m-t'); }), 'kits: depois de "Três camadas" vem direto "Como montamos o seu kit" (sem o bloco de peças)');
  // menu da apresentação de 20/10 (build.py: nav_menu): Brindes ▾ (tipos), Kits ▾, Confecções ▾, Ativações ▾, Sobre e Blog
  ok(await page.$$eval('#site-nav > .nav-link, #site-nav > .nav-group > .nav-toggle', a => a.map(x => x.textContent.trim()).join()) === 'Brindes,Kits,Confecções,Ativações,Sobre,Blog', 'menu com Brindes, Kits, Confecções, Ativações, Sobre e Blog');
  const menuP = await page.evaluate(() => {
    const hrefs = sel => [...document.querySelectorAll(sel)].map(a => a.getAttribute('href'));
    return { tipos: hrefs('#sub-brindes .nav-list:not(.nav-list-pe) a'), fotos: document.querySelectorAll('#sub-brindes img').length, pe: hrefs('#sub-brindes .nav-list-pe a, #sub-brindes .nav-sub-all'),
      fim: document.querySelector('#sub-brindes .nav-list-pe a[href="/brindes-de-fim-de-ano/"]')?.textContent.replace(/\s+/g, ' ').trim() || '',
      kits: hrefs('#sub-kits .nav-list a'), kitsAll: hrefs('#sub-kits .nav-sub-all'), conf: hrefs('#sub-confeccoes .nav-list a'), confAll: hrefs('#sub-confeccoes .nav-sub-all'),
      ativ: hrefs('#sub-ativacoes .nav-list a'), ativAll: hrefs('#sub-ativacoes .nav-sub-all') };
  });
  const tipoHref = h => /^\/catalogo\/\?tipo=[a-z-]+#catalogo$/.test(h);
  ok(menuP.tipos.length >= 9 && menuP.tipos.every(tipoHref) && TIPOS_BRINDE.concat('tecnologia').every(k => menuP.tipos.includes(`/catalogo/?tipo=${k}#catalogo`)) && menuP.fotos === 0,
     `menuP Brindes: lista (sem fotos, como os outros menus) com os 9 tipos de brinde e Tecnologia levando ao catálogo filtrado (${menuP.tipos.length} tipos)`);
  ok(['/brindes-corporativos/', '/hotelaria-e-gastronomia/', '/brindes-por-ocasiao/'].every(h => menuP.pe.includes(h)) && menuP.pe.at(-1) === '/catalogo/' && (SEASON === 'fim-de-ano' ? menuP.fim === 'Fim de ano temporada' : !menuP.fim),
     `menuP Brindes: pé com Brindes corporativos, Hotelaria e gastronomia, Por ocasião${SEASON === 'fim-de-ano' ? ', Fim de ano em destaque' : ''} e Catálogo completo`);
  ok(menuP.kits.length === 7 && menuP.kits.join() === ['escritorio', 'cozinha', 'boas-vindas', 'executivo', 'pausa', 'agradecimento', 'fim-de-ano'].map(k => '/kits-corporativos/#kits-' + k).join() && menuP.kitsAll.join() === '/kits-corporativos/',
     'menuP Kits: 7 links de tipo de kit (âncoras de /kits-corporativos/) e "Ver todos os kits"');
  ok(menuP.conf.length >= 7 && menuP.conf.every(tipoHref) && menuP.confAll.join() === '/confeccoes-personalizadas/', `menuP Confecções: ${menuP.conf.length} tipos de peça no catálogo filtrado e "Uniformes e confecções"`);
  ok(menuP.ativ.join() === '/ativacoes-promocionais/#fmt-buffet,/ativacoes-promocionais/#fmt-decoracao' && menuP.ativAll.join() === '/ativacoes-promocionais/', 'menuP Ativações: Buffet completo, Decoração e "Conhecer ativações"');
  const semAncora = [];
  for (const [u, hs] of [['/kits-corporativos/', menuP.kits], ['/ativacoes-promocionais/', menuP.ativ]]) { const html = await (await fetch(BASE + u)).text(); hs.forEach(h => { if (!html.includes(`id="${h.split('#')[1]}"`)) semAncora.push(h); }); }
  ok(semAncora.length === 0, `os links dos painéis Kits e Ativações caem em âncoras que existem${semAncora.length ? ' — faltam: ' + semAncora.join(', ') : ''}`);
  // página certa marcada: o botão do grupo com aria-current="true" e o link da página com aria-current="page"
  const navAtual = u => page.evaluate(async u => { const d = new DOMParser().parseFromString(await (await fetch(u)).text(), 'text/html'); return [...d.querySelectorAll('#site-nav [aria-current]')].map(x => x.getAttribute('aria-controls') || x.getAttribute('href')).join(); }, BASE + u);
  const atuais = { '/kits-corporativos/': 'sub-kits,/kits-corporativos/', '/confeccoes-personalizadas/': 'sub-confeccoes,/confeccoes-personalizadas/', '/catalogo/polo-masculina/': 'sub-confeccoes',
    '/catalogo/caneca/': 'sub-brindes', '/catalogo/': 'sub-brindes,/catalogo/', '/brindes-corporativos/': 'sub-brindes,/brindes-corporativos/', '/hotelaria-e-gastronomia/': 'sub-brindes,/hotelaria-e-gastronomia/',
    '/brindes-de-fim-de-ano/': SEASON === 'fim-de-ano' ? 'sub-brindes,/brindes-de-fim-de-ano/' : 'sub-brindes', '/ativacoes-promocionais/': 'sub-ativacoes,/ativacoes-promocionais/', '/sobre/': '/sobre/', '/': '' };
  const marcaErrada = [];
  for (const [u, esperado] of Object.entries(atuais)) { const r = await navAtual(u); if (r !== esperado) marcaErrada.push(`${u} → ${r || 'nada'}`); }
  ok(marcaErrada.length === 0, `o menu marca (aria-current) o grupo e o link da página certa${marcaErrada.length ? ' — ' + marcaErrada.join('; ') : ''}`);
  // computador: os quatro painéis abrem inteiros na tela e legíveis de 1240 a 1440 px; Brindes em 5 colunas
  for (const [w, h] of [[1240, 768], [1440, 900]]) {
    await page.setViewport({ width: w, height: h }); await page.evaluate(() => scrollTo(0, 0)); await sleep(100);
    const fora = [];
    for (const k of ['brindes', 'kits', 'confeccoes', 'ativacoes']) {
      await page.click(`[aria-controls="sub-${k}"]`); await sleep(100);
      const r = await page.$eval(`#sub-${k}`, d => { const b = d.getBoundingClientRect(), as = [...d.querySelectorAll('a')];
        return { vis: getComputedStyle(d).display !== 'none' && b.height > 0, l: Math.round(b.left), r: Math.round(b.right), b: Math.round(b.bottom), lista: !!d.closest('.nav-drop') && !d.querySelector('img'),
          leg: as.every(a => parseFloat(getComputedStyle(a).fontSize) >= 14 && a.scrollWidth <= a.clientWidth + 1 && a.getBoundingClientRect().right <= b.right + 1) }; });
      if (!r.vis || r.l < 0 || r.r > w || r.b > h || !r.leg || !r.lista) fora.push(`${k} ${JSON.stringify(r)}`);
      await page.keyboard.press('Escape'); await sleep(50);
    }
    ok(fora.length === 0 && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${w} px: os quatro painéis do menu abrem inteiros na tela e legíveis (todos em lista)${fora.length ? ' — ' + fora.join('; ') : ''}`);
  }
  await page.setViewport({ width: 1280, height: 900 });
  ok(await page.$eval('.header-row .head-search', f => f.getAttribute('action') === '/catalogo/' && f.querySelector('input[name="q"]')), 'busca no catálogo na linha de cima do cabeçalho');
  ok(await page.$$eval('.site-footer .footer-links', ls => ls[0] && [...ls[0].querySelectorAll('a')].map(x => x.textContent.trim()).join() === 'Brindes corporativos,Uniformes e confecções,Kits corporativos,Ativações promocionais,Hotelaria e gastronomia') && await page.$eval('.site-footer a[href="/blog/"]', a => a.textContent === 'Conteúdos'), 'rodapé repete as cinco áreas com os nomes do menu e chama o blog de "Conteúdos", como o menu');
  ok(await page.$$eval('.foto-hero figcaption, .entrega-foto figcaption', f => f.length >= 1 && f.every(x => x.textContent === 'Imagem ilustrativa • Marca fictícia')) && await page.$$eval('.kits-page .note', n => n.length === 1 && /^Imagens? ilustrativas?: (a marca TaMa e marcas fictícias aparecem|a marca (TaMa aparece|é fictícia e aparece)) como exemplo; no seu projeto, entra a marca da sua empresa\./.test(n[0].textContent)), 'kits: legenda padrão da marca fictícia no cabeçalho e uma nota padrão (marca TaMa e marcas fictícias como exemplo) depois dos tipos de kit');
  ok(await page.$$eval('a[href^="/branding-identidade-visual/"], a[href^="/projetos/"]', a => a.length === 0), 'nenhum link para branding ou projetos');
  await page.goto(BASE + '/confeccoes-personalizadas/', { waitUntil: 'networkidle0' });
  ok(await page.$$eval('.studio-grid .product.studio', c => c.length === 10) && await page.$eval('.studio-grid', g => !!g.closest('section').querySelector('a[href="/catalogo/?categoria=vestuario"]')), 'confecções: 10 peças em estúdio com link para o catálogo filtrado');
  ok(await page.$$eval('h1', h => h.length === 1 && /A identidade da sua marca também se veste/.test(h[0].textContent.replace(/\s+/g, ' '))) && await page.$eval('.foto-hero-photo img', i => i.loading === 'eager' && i.alt.length > 40) && await page.$$eval('.atalhos-list a', a => a.length === 4), 'confecções abre com a foto da equipe, um único H1 e os atalhos para as peças');
  ok(await page.$$eval('#hero .slide img', i => i.every(x => /TaMa/.test(x.alt) && x.alt.length > 40)), 'cenas de confecções com texto alternativo descritivo');
  ok(!(await page.$('.garantias')), 'confecções não repete a faixa de confiança da home');
  ok(!(await page.$('#rail-conf')) && !(await page.$('#pecas-c-t')), 'confecções: sem o bloco "Do uniforme do dia a dia à peça do evento"');
  ok(await colorsHavePhoto(page, '.studio-grid .product.studio'), 'confecções: toda cor mostrada nas peças em estúdio tem foto própria');
  await page.goto(BASE + '/blog/o-que-colocar-no-kit-de-boas-vindas/', { waitUntil: 'networkidle0' });
  ok(await colorsHavePhoto(page, '#rail-post .product'), 'trilho do post do blog: toda cor mostrada tem foto própria');
  // tira só o modelo do catálogo da seleção: a seleção anterior segue para os testes do formulário
  await page.evaluate(() => localStorage.setItem('tama-selecao', JSON.stringify(JSON.parse(localStorage.getItem('tama-selecao')).filter(x => x.s !== 'cardapio'))));
  await page.goto(BASE + '/brindes-por-ocasiao/', { waitUntil: 'networkidle0' });
  await page.goto(BASE + '/brindes-por-ocasiao/?ocasiao=eventos#pecas', { waitUntil: 'networkidle0' });
  const n2 = await visible(), e2 = await page.$$eval('#gift-grid .product', g => g.filter(x => x.dataset.occ.split(' ').includes('eventos')).length);
  ok(n2 === e2 && n2 > 0, `link de coleção (?ocasiao=eventos) já abre filtrado (${n2})`);
  await page.$eval('#gift-grid .pick[data-slug="taca-de-gin"]', el => el.scrollIntoView({ block: 'center' }));
  await page.click('#gift-grid .pick[data-slug="taca-de-gin"]');

  console.log('Processo (Do briefing à entrega)');
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  const proc = await page.$eval('section.process-strip', s => ({
    steps: [...s.querySelectorAll('ol.process-line > li')].map(li => li.textContent.replace(/^\s*\d+\s*/, '').trim()),
    decor: [...s.querySelectorAll('.proc-n')].map(e => e.getAttribute('aria-hidden')),
    link: s.querySelector('a[href^="/sobre/"]')?.getAttribute('href'),
  }));
  ok(proc.steps.join(',') === 'Briefing,Curadoria,Proposta,Aprovação,Produção,Entrega', 'home resume as 6 etapas numa linha (lista ordenada)');
  ok(proc.decor.length === 6 && proc.decor.every(v => v === 'true'), 'números das etapas são decorativos (aria-hidden)');
  ok(!!proc.link, 'faixa do processo leva a "Como trabalhamos"');
  // Seção padrão (process_section): as mesmas 6 etapas, com os mesmos nomes e na mesma ordem, em todas as páginas de frente,
  // no fim de ano e em /sobre/; nada do formato antigo (ol.steps com 4 etapas) pode sobrar.
  const ETAPAS = 'Briefing,Curadoria,Proposta,Aprovação,Produção,Entrega';
  for (const path of ['/brindes-corporativos/', '/kits-corporativos/', '/confeccoes-personalizadas/', '/ativacoes-promocionais/', '/hotelaria-e-gastronomia/', '/brindes-de-fim-de-ano/', '/sobre/']) {
    await page.goto(BASE + path, { waitUntil: 'networkidle0' });
    const p = await page.evaluate(() => ({
      secoes: document.querySelectorAll('section.process-section').length,
      listas: document.querySelectorAll('ol.process-steps').length,
      nomes: [...document.querySelectorAll('.process-step h3')].map(h => h.textContent.trim()).join(','),
      icones: document.querySelectorAll('.process-step .process-icon').length,
      antigo: document.querySelectorAll('.steps, .step').length,
      head: !!document.querySelector('section.process-section .section-head .eyebrow') && !!document.querySelector('section.process-section h2.section-title'),
      antesFaq: (() => { const s = document.querySelector('section.process-section'); let n = s?.nextElementSibling; while (n && !n.matches('section')) n = n.nextElementSibling; return !!n?.querySelector('.faq-list'); })(),
    }));
    ok(p.secoes === 1 && p.listas === 1 && p.nomes === ETAPAS && p.icones === 6 && p.antigo === 0 && p.head, `${path}: uma seção padrão com as 6 etapas (${p.nomes.split(',').length}) na mesma ordem, com ícones e sem o formato antigo`);
    if (path !== '/sobre/') ok(p.antesFaq, `${path}: o passo a passo vem logo antes das perguntas`);
  }
  ok(await page.$eval('#como-t', h => !!h.closest('section.process-section')), '/sobre/#como-t (link da home) cai na seção do passo a passo');
  ok(await page.$eval('#sustenta-t', h => /O que sustenta cada projeto/.test(h.textContent) && h.closest('section').querySelectorAll('.col').length === 3), '/sobre/ mantém os pilares em "O que sustenta cada projeto"');

  console.log('Formulário');
  await page.goto(BASE + '/solicitar-proposta/?tipo=kits', { waitUntil: 'networkidle0' });
  ok(await page.$eval('input[name="tipo"][value="kits"]', i => i.checked), 'tipo pré-selecionado pela URL (?tipo=kits)');
  ok(await page.$eval('#picked-list', l => l.children.length === 3), 'as 3 peças selecionadas aparecem no formulário');
  const selecao = await page.$eval('#f-selecao', i => i.value);
  ok(selecao.includes('Garrafa térmica (Azul royal)') && selecao.includes('Taça de gin'), 'campo enviado leva peças e cores');
  ok(await page.$$eval('input[name="tipo"]', l => l.map(i => i.value).join()) === 'brindes,kits,confeccoes,ativacoes,hotelaria,integrado', 'formulário com as frentes atuais (sem branding)');
  ok(await page.$eval('input[name="tipo"][value="ativacoes"]', i => i.parentNode.textContent.trim() === 'Ativações promocionais, buffet ou decoração para evento'), 'tipo Ativações cita "buffet ou decoração para evento" (a chave continua ativacoes)');
  ok(await page.$eval('#form-result', r => r.getBoundingClientRect().height === 0), 'nenhuma caixa vazia sob "Enviar pedido"');
  ok(/^[0-9a-f-]{36}$/.test(await page.$eval('#f-pedido-id', i => i.value)), 'pedido tem identificador para nova tentativa sem duplicar');
  await page.click('input[name="tipo"][value="kits"]');
  ok(await page.$eval('#f-qtd', i => !i.disabled && !i.closest('[data-show-for]').hidden), 'kits mostra quantidade e data');
  await page.click('input[name="tipo"][value="kits"]');
  await page.click('#submit-btn');
  const errs = await page.$$eval('.field-error', e => e.filter(x => x.textContent.trim()).length);
  ok(errs >= 3, `envio vazio mostra erros por campo (${errs})`);
  ok(await page.$eval('#form-result', r => r.hidden), 'nenhuma mensagem de sucesso sem envio');

  async function fill() {
    for (const [s, v] of [['#f-nome', 'Teste Automatizado'], ['#f-contato', 'teste@example.com'], ['#f-objetivo', 'Kit de boas-vindas para 30 pessoas em março.']]) {
      await page.$eval(s, i => (i.value = ''));
      await page.type(s, v);
    }
    if (!(await page.$eval('#f-consent', i => i.checked))) await page.click('#f-consent');
  }
  await page.setRequestInterception(true);
  let mode = 'fail', posted = '';
  page.on('request', req => {
    if (req.method() === 'POST' && ['/', '/api/proposta'].includes(new URL(req.url()).pathname)) {
      posted = req.postData() || '';
      const id = new URLSearchParams(posted).get('pedido_id');
      // contrato do n8n (docs/PROPOSTAS.md): só {"gravado": true, "pedido_id": <o enviado>} confirma o pedido
      if (mode === 'ok') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, gravado: true, pedido_id: id }) });
      if (mode === 'html') return req.respond({ status: 200, contentType: 'text/html', body: 'ok' });
      return req.respond({ status: 500, contentType: 'text/plain', body: 'erro' });
    }
    req.continue();
  });
  await fill();
  await page.click('#submit-btn');
  await page.waitForSelector('#form-result:not([hidden])');
  ok(await page.$eval('#form-result', r => r.textContent.includes('Não conseguimos confirmar')), 'falha do servidor mostra erro (nunca sucesso)');
  const decoded = new URLSearchParams(posted);
  ok(decoded.get('form-name') === 'proposta' && decoded.has('bot-field') && (decoded.get('selecao') || '').includes('Garrafa térmica (Azul royal)'), 'POST inclui form-name, honeypot e seleção');
  await page.click('[data-retry]');
  ok(await page.$eval('#proposal-form', f => !f.hidden), '"Tentar de novo" reabre o formulário com os dados');
  mode = 'html';
  await page.waitForFunction(() => !document.getElementById('submit-btn').disabled);
  await page.click('#submit-btn');
  await page.waitForSelector('#form-result:not([hidden])');
  ok(await page.$eval('#form-result', r => r.textContent.includes('Não conseguimos confirmar')), 'HTTP 200 sem confirmação de gravação mostra erro (nunca sucesso)');
  await page.click('[data-retry]');
  const idAntes = new URLSearchParams(posted).get('pedido_id');
  mode = 'ok';
  await page.waitForFunction(() => !document.getElementById('submit-btn').disabled);
  await page.click('#submit-btn');
  ok(await page.waitForFunction(() => document.querySelector('#form-result h2')?.textContent.includes('Recebemos'), { timeout: 8000 }).then(() => true, () => false), 'resposta 200 mostra "Recebemos o seu pedido"');
  ok(new URLSearchParams(posted).get('pedido_id') === idAntes, 'nova tentativa reenvia o mesmo identificador (o n8n não duplica)');
  ok(await page.$eval('#proposal-form', f => getComputedStyle(f).display === 'none'), 'depois da confirmação o formulário some (sem "Enviar pedido" ativo)');
  ok(await page.evaluate(() => (localStorage.getItem('tama-selecao') || '[]') === '[]'), 'seleção é limpa após envio confirmado');
  const events = await page.evaluate(() => (window.dataLayer || []).map(e => e.event).filter(Boolean));
  ok(['form_start', 'proposta_falha', 'proposta_gravada'].every(e => events.includes(e)), `eventos do formulário disparados (${[...new Set(events)].join(', ')})`);
  console.log('Frentes novas, seleção antiga e selo');
  const fp = await browser.newPage();
  await fp.setViewport({ width: 1280, height: 900 });
  for (const [path, tipo] of [['/ativacoes-promocionais/', 'ativacoes'], ['/hotelaria-e-gastronomia/', 'hotelaria']]) {
    await fp.goto(BASE + path, { waitUntil: 'networkidle0' });
    ok(await fp.$$eval('h1', h => h.length === 1) && await fp.$$eval(`a[href="/solicitar-proposta/?tipo=${tipo}"]`, a => a.length >= 2) && await fp.$$eval('.studio-grid .product.studio', c => c.length >= 6),
       `${path}: um H1, CTA com o tipo ${tipo} e peças do catálogo`);
  }
  ok(await fp.$$eval('.studio-grid .product', c => ['cardapio', 'porta-contas', 'dolma', 'avental'].every(s => c.some(x => x.dataset.slug === s))), 'hotelaria reúne cardápio, porta-contas, dólmã e avental da mesma base');
  // ativações: Buffet completo e Decoração entre os formatos, nos atalhos e nas perguntas; as cenas só entram com foto
  await fp.goto(BASE + '/ativacoes-promocionais/', { waitUntil: 'networkidle0' });
  const ativ = await fp.evaluate(() => ({
    fmts: ['fmt-degustacao', 'fmt-feiras', 'fmt-promocao', 'fmt-buffet', 'fmt-decoracao'].every(id => document.getElementById(id)?.closest('#formatos')),
    atalhos: [...document.querySelectorAll('.atalhos .atalhos-list a')].map(a => a.getAttribute('href')),
    alvos: [...document.querySelectorAll('.atalhos .atalhos-list a')].every(a => document.querySelector(a.getAttribute('href'))),
    textos: ['fmt-buffet', 'fmt-decoracao'].map(id => document.querySelector('#' + id + ' p')?.textContent || ''),
    links: ['fmt-buffet', 'fmt-decoracao'].map(id => document.querySelector('#' + id + ' a')?.getAttribute('href') || ''),
    faq: [...document.querySelectorAll('.faq-list details')].some(d => /buffet/i.test(d.textContent) && /decoração/i.test(d.textContent) && /parceiros especializados/.test(d.textContent)),
    cenas: [...document.querySelectorAll('#formatos .ativ-cenas figure')].map(f => [f.querySelector('img')?.alt || '', f.querySelector('figcaption')?.textContent || '']),
  }));
  ok(ativ.fmts && ativ.alvos && ['#fmt-promocao', '#fmt-buffet', '#fmt-decoracao'].every(h => ativ.atalhos.includes(h)), `ativações: Buffet completo (#fmt-buffet) e Decoração (#fmt-decoracao) em "Onde a ativação acontece" e nos atalhos, que levam às seções (${ativ.atalhos.join(' ')})`);
  ok(ativ.textos.every(t => /parceiros especializados/.test(t) && !/R\$|\d|pessoas|convidados|cardápio|capacidade/i.test(t)) && ativ.faq, 'ativações: buffet e decoração coordenados com parceiros especializados, sem cardápio, capacidade, número de pessoas nem preço, e citados nas perguntas');
  ok(ativ.cenas.length <= 2 && ativ.cenas.every(([alt, leg]) => /marca fictícia (Solar|Oliva)/.test(alt) && leg === 'Cena ilustrativa · marca fictícia'), `ativações: faixa com as cenas de buffet e decoração (${ativ.cenas.length} de 2 com foto), legenda "Cena ilustrativa · marca fictícia"`);
  const ATIV_EVENTO = '/solicitar-proposta/?tipo=ativacoes&interesse=' + encodeURIComponent('Buffet ou decoração para evento');
  ok(ativ.links.every(h => h === ATIV_EVENTO), 'ativações: buffet e decoração levam ao pedido com tipo=ativacoes e o interesse "Buffet ou decoração para evento"');
  for (const [p, w] of [['/ativacoes-promocionais/', 320], ['/kits-corporativos/', 320], ['/kits-corporativos/', 1024]]) {
    await fp.setViewport({ width: w, height: 800 }); await fp.goto(BASE + p, { waitUntil: 'networkidle0' });
    ok(await fp.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${p}: sem rolagem horizontal em ${w} px`);
  }
  await fp.setViewport({ width: 1280, height: 900 });
  await fp.goto(BASE + ATIV_EVENTO, { waitUntil: 'networkidle0' });
  ok(await fp.$eval('input[name="tipo"][value="ativacoes"]', i => i.checked) && await fp.$eval('#f-interesse', i => i.value === 'Buffet ou decoração para evento') && await fp.$eval('#interest-note', n => !n.hidden),
     'pedido vindo de buffet ou decoração abre com Ativações marcado e o interesse no formulário');
  await fp.goto(BASE + '/brindes-de-fim-de-ano/', { waitUntil: 'networkidle0' });
  ok(await fp.$$eval('h1', h => h.length === 1 && /Um brinde a quem\s*fez parte do seu ano\./.test(h[0].textContent.replace(/\s+/g, ' '))) && await fp.$eval('.foto-hero-photo img', i => i.loading === 'eager' && /fim-header/.test(i.currentSrc) && i.alt.length > 20), 'fim de ano: H1 "Um brinde a quem fez parte do seu ano." e a foto em alta na abertura');
  ok(await fp.$$eval('.foto-hero .actions a', a => a.map(x => x.getAttribute('href')).join() === '/solicitar-proposta/?tipo=kits,#brindar' && a[0].classList.contains('btn-wine')), 'fim de ano: botão principal é a proposta (tipo=kits); "Explorar os presentes" (#brindar) é secundário');
  ok(await fp.$$eval('.atalhos.lado .atalhos-list a', a => a.map(x => x.getAttribute('href')).join() === '#brindar,#kits-fim-de-ano,#personalizacao' && a.every(x => document.querySelector(x.getAttribute('href')))), 'fim de ano: atalhos "Escolha como brindar." levam às seções da página');
  ok(await fp.$$eval('#brindar .product.studio', c => c.length === 8 && c.every(x => (x.dataset.occ || '').split(' ').includes('fim-de-ano'))) && await fp.$eval('#brindar a[href="/catalogo/?ocasiao=fim-de-ano"]', a => /fim de ano no catálogo/.test(a.textContent)), 'fim de ano: 8 taças e copos em #brindar, com link para o catálogo filtrado');
  ok(await fp.$$eval('.kit-card', k => k.length === 7 && k.filter(x => x.classList.contains('big')).length === 4 && k.slice(0, 4).every(x => x.classList.contains('big')) && k.every(x => x.querySelector('img').alt.length > 20)) && await fp.$$eval('.kit-card a', a => a.map(x => x.getAttribute('href')).join() === ['Brinde', 'Coquetel', 'Caipirinha', 'Gin', 'Vinho', 'Caf%C3%A9', 'Petiscos'].map(n => '/solicitar-proposta/?tipo=kits&interesse=Kit%20' + n).join()), 'fim de ano: Kit Brinde, Coquetel, Caipirinha, Gin, Vinho, Café e Petiscos (4 em destaque), com "Solicitar proposta deste kit" no pedido');
  ok(await fp.$$eval('.kit-card', k => ['Caipirinha', 'Gin', 'Vinho'].every(n => k.some(x => x.querySelector('h3').textContent === 'Kit ' + n && /Sem bebida/.test(x.textContent)))), 'fim de ano: os kits Caipirinha, Gin e Vinho dizem "Sem bebida" (só acessórios)');
  ok(await fp.$$eval('#presentear .product.studio', c => c.map(x => x.dataset.slug).join() === 'agenda,caneta-executiva-com-estojo,vela,caixa-para-presente'), 'fim de ano: 4 peças em "Para presentear"');
  ok(await fp.$$eval('#personalizacao .process-step', s => s.length === 6) && await fp.$$eval('.faq-list details', d => d.length === 4) && await fp.$$eval('a[href="/solicitar-proposta/?tipo=kits"]', a => a.length >= 2), 'fim de ano: as 6 etapas em #personalizacao, 4 perguntas e CTA final com tipo=kits');
  ok(await colorsHavePhoto(fp, '.studio-grid .product'), 'fim de ano: toda cor mostrada tem foto própria');
  await fp.goto(BASE + '/', { waitUntil: 'networkidle0' });
  ok(await fp.$eval('.occ-faixa a[href="/brindes-de-fim-de-ano/"]', a => a.textContent.trim() === 'Fim de ano'), 'na home, o chip Fim de ano leva à página própria');
  ok(await fp.$eval('.site-footer a[href="/brindes-de-fim-de-ano/"]', a => a.textContent === 'Brindes de fim de ano'), 'rodapé lista "Brindes de fim de ano" nas soluções');
  await fp.goto(BASE + '/', { waitUntil: 'networkidle0' });
  ok(await fp.$$eval('.frentes-grid .frente-card', a => a.map(x => x.getAttribute('href')).join() === '/brindes-corporativos/,/confeccoes-personalizadas/,/kits-corporativos/,/ativacoes-promocionais/,/hotelaria-e-gastronomia/'), 'home apresenta as cinco áreas da TaMa');
  ok(await fp.$eval('h1', h => /brindes, uniformes, kits, ativações e hotelaria/i.test(h.textContent)), 'H1 da home diz o que a TaMa oferece (as cinco áreas, como na assinatura)');
  ok(await fp.$eval('.site-footer .footer-brand p', p => /^Brindes, uniformes, kits, ativações e hotelaria para empresas\./.test(p.textContent)) && await fp.$$eval('.announce li', l => l.map(x => x.textContent).join() === 'Atendimento consultivo,Arte aprovada antes da produção,Coordenação do pedido à entrega'), 'assinatura do rodapé com as cinco áreas e barra do topo com os três compromissos');
  ok(await fp.$$eval('.kit-card a[href*="tipo=kits"]', a => a.length === 2 && a.every(x => x.href.includes('interesse=') && /^Solicitar proposta deste kit/.test(x.textContent.trim()))), 'cada kit da home tem "Solicitar proposta deste kit" com o interesse no pedido');
  ok(await fp.$$eval('.end-cta', s => s.length === 1 && s[0].querySelector('.eyebrow').textContent === 'Próximo passo' && /\?$/.test(s[0].querySelector('h2').textContent) && s[0].querySelectorAll('.actions a').length === 2 && /^Solicitar proposta/.test(s[0].querySelector('.actions a').textContent.trim())), 'fechamento padrão: eyebrow, título em pergunta e dois botões (Solicitar proposta + WhatsApp)');
  await fp.evaluate(() => localStorage.setItem('tama-selecao', JSON.stringify([{ s: 'linha-polo', c: 'Preto' }, { s: 'caneca-de-ceramica', c: null }, { s: 'baralho-exclusivo', c: null }])));
  await fp.goto(BASE + '/solicitar-proposta/', { waitUntil: 'networkidle0' });
  ok(await fp.$eval('#f-selecao', i => i.value === 'Polo masculina (Preto); Caneca (Vermelho)'), 'seleção salva com slugs antigos vira os modelos atuais, com a cor de abertura (ideia retirada sai)');
  await fp.evaluate(() => { localStorage.clear(); localStorage.setItem('tama-consent', 'denied'); });
  const selo = await (await fetch(BASE + '/sobre/')).text();
  ok(!/MARCAS/.test(selo) && (await fetch(BASE + '/favicon.svg').then(async r => (await r.arrayBuffer(), r.ok))), 'selo sem "MARCAS" no HTML');
  // Sobre: abertura com foto no padrão das páginas de área
  await fp.goto(BASE + '/sobre/', { waitUntil: 'networkidle0' });
  const sobre = await fp.evaluate(() => {
    const img = document.querySelector('.foto-hero-photo img');
    return { h1s: document.querySelectorAll('h1').length, h1: document.querySelector('h1').textContent.replace(/\s+/g, ' ').trim(), eyebrow: document.querySelector('.foto-hero .eyebrow')?.textContent,
      eager: img?.loading, src: img?.currentSrc || '', alt: img?.alt || '', legenda: document.querySelector('.foto-hero-photo figcaption')?.textContent || '',
      btns: [...document.querySelectorAll('.foto-hero .actions a')].map(a => a.getAttribute('href')).join(), alvo: !!document.getElementById('como-t'),
      preload: document.querySelector('link[rel="preload"][as="image"]')?.getAttribute('imagesrcset') || '', crumbs: [...document.querySelectorAll('.foto-hero .crumbs li')].map(l => l.textContent.trim()).join(' / ') };
  });
  ok(sobre.h1s === 1 && sobre.h1 === 'A marca do cliente em cada escolha.' && sobre.eyebrow === 'Sobre a TaMa' && sobre.crumbs === 'Início / Sobre', `sobre: um H1 em duas partes (${sobre.h1})`);
  ok(sobre.eager === 'eager' && /sobre-header/.test(sobre.src) && /sobre-header/.test(sobre.preload) && /fictícia/.test(sobre.alt) && /Marcas fictícias/.test(sobre.legenda), 'sobre: foto de bastidor em alta, prioritária, com marcas fictícias no texto alternativo e na legenda');
  ok(sobre.btns === '/solicitar-proposta/,#como-t' && sobre.alvo, 'sobre: proposta como botão principal e "Como trabalhamos" levando à seção da página');
  await fp.close();
  console.log('Blog');
  const bp = await browser.newPage();
  await bp.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await bp.setViewport({ width: 1280, height: 900 });
  await bp.goto(BASE + '/blog/', { waitUntil: 'networkidle0' });
  const idx = await bp.evaluate(() => ({
    h1: document.querySelectorAll('h1').length,
    feature: document.querySelector('.post-feature h2 a')?.getAttribute('href'),
    posts: [...document.querySelectorAll('.post-feature h2 a, .post-card h3 a')].map(a => a.getAttribute('href')),
    navCurrent: document.querySelector('.site-nav a[aria-current="page"]')?.getAttribute('href'),
    footer: !!document.querySelector('.site-footer a[href="/blog/"]'),
    rss: document.querySelector('link[rel="alternate"][type="application/rss+xml"]')?.getAttribute('href'),
    ld: JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'].map(x => x['@type']),
  }));
  ok(idx.h1 === 1 && idx.posts.length === 14, `/blog/ tem um H1 e lista 14 artigos (${idx.posts.length})`);
  // abertura no padrão das páginas de área (foto_hero): eyebrow, título em duas partes, foto eager à direita e dois botões
  const abre = await bp.evaluate(() => {
    const img = document.querySelector('.foto-hero-photo img');
    const posts = (JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'].find(x => x['@type'] === 'Blog') || {}).blogPost || [];
    const recente = posts.slice().sort((a, b) => b.datePublished.localeCompare(a.datePublished))[0];
    return { eyebrow: document.querySelector('.foto-hero .eyebrow')?.textContent, h1: document.querySelector('h1').textContent.replace(/\s+/g, ' ').trim(),
      em: document.querySelector('h1 em')?.textContent, eager: img?.loading, src: img?.currentSrc || '', alt: img?.alt || '',
      legenda: document.querySelector('.foto-hero-photo figcaption')?.textContent || '',
      btns: [...document.querySelectorAll('.foto-hero .actions a')].map(a => [a.textContent.replace(/\s+/g, ' ').trim(), a.getAttribute('href'), a.classList.contains('btn-wine')]),
      recente: recente ? new URL(recente.url).pathname : '', preload: document.querySelector('link[rel="preload"][as="image"]')?.getAttribute('imagesrcset') || '',
      crumbs: [...document.querySelectorAll('.foto-hero .crumbs li')].map(l => l.textContent.trim()).join(' / ') };
  });
  ok(abre.eyebrow === 'Conteúdos' && abre.h1 === 'Guias para presentear em nome da sua marca.' && abre.em === 'em nome da sua marca.' && abre.crumbs === 'Início / Blog', `/blog/ abre com "Conteúdos" e o título em duas partes (${abre.h1})`);
  ok(abre.eager === 'eager' && /blog-header/.test(abre.src) && /blog-header/.test(abre.preload) && /fictícia/.test(abre.alt) && /Marcas fictícias/.test(abre.legenda), '/blog/: foto da abertura em alta, prioritária (eager + preload), com marcas fictícias no texto alternativo e na legenda');
  ok(abre.btns.length === 2 && abre.btns[0][0].startsWith('Ler o guia mais recente') && abre.btns[0][1] === abre.recente && abre.btns[0][2] && abre.btns[1][0] === 'Solicitar proposta' && abre.btns[1][1] === '/solicitar-proposta/' && !abre.btns[1][2], `/blog/: "Ler o guia mais recente" leva ao artigo mais recente (${abre.recente}) e "Solicitar proposta" é o botão secundário`);
  ok(idx.feature === '/blog/brindes-de-fim-de-ano-para-clientes/' && new Set(idx.posts).size === idx.posts.length, 'guia de fim de ano para clientes em destaque, sem repetir na grade');
  const filtro = await bp.evaluate(() => {
    const bts = [...document.querySelectorAll('[data-blog-filters] [data-cat]')];
    const kits = bts.find(b => b.dataset.cat === 'kits-e-boas-vindas'); kits.click();
    const vis = [...document.querySelectorAll('[data-blog-grid] .post-card')].filter(c => !c.hidden).map(c => c.dataset.cat);
    bts[0].click();
    return { n: bts.length, shown: !document.querySelector('[data-blog-filters]').hidden, pressed: kits.getAttribute('aria-pressed'), vis };
  });
  ok(filtro.shown && filtro.n === 5 && filtro.vis.length === 2 && filtro.vis.every(c => c === 'kits-e-boas-vindas'), 'filtros por categoria (Todos + 4) mostram só os guias da categoria');
  ok(idx.navCurrent === '/blog/' && idx.footer, 'Blog no menu (página atual marcada) e no rodapé');
  ok(idx.rss === '/blog/feed.xml' && idx.ld.includes('Blog') && idx.ld.includes('CollectionPage'), 'índice com RSS e JSON-LD Blog + CollectionPage');
  const blogBroken = [];
  for (const post of idx.posts) {
    await bp.goto(BASE + post, { waitUntil: 'networkidle0' });
    const a = await bp.evaluate(() => {
      const g = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'];
      const bpst = g.find(x => x['@type'] === 'BlogPosting') || {};
      const bc = g.find(x => x['@type'] === 'BreadcrumbList') || { itemListElement: [] };
      return {
        h1: document.querySelectorAll('h1').length,
        ogType: document.querySelector('meta[property="og:type"]')?.content,
        ogImage: document.querySelector('meta[property="og:image"]')?.content,
        canonical: document.querySelector('link[rel="canonical"]')?.href,
        ld: { headline: bpst.headline, date: bpst.datePublished, author: bpst.author?.['@id'], publisher: bpst.publisher?.['@id'], crumbs: bc.itemListElement.length },
        proposta: [...document.querySelectorAll('a[href^="/solicitar-proposta/"]')].map(x => x.getAttribute('href')),
        tocOk: [...document.querySelectorAll('.post-toc a')].every(x => document.getElementById(x.getAttribute('href').slice(1))),
        links: [...new Set([...document.querySelectorAll('main a[href^="/"]')].map(x => x.getAttribute('href').split('#')[0].split('?')[0]))],
        curadoria: [...document.querySelectorAll('main a[href*="?ocasiao="]')].map(x => x.getAttribute('href')),
        sources: [...document.querySelectorAll('.prose a[href^="https://"]')].filter(x => /gov\.br/.test(x.href)).length,
        vitrine: !!document.querySelector('#rail-post, .post-author .btn, .end-cta'),
        pecas: !!document.querySelector('#rail-post'),
        caption: document.querySelector('.post-cover figcaption')?.textContent || '',
      };
    });
    const path = new URL(a.canonical).pathname;
    ok(a.h1 === 1 && path === post && a.ogType === 'article', `${post}: um H1, canonical e og:type=article`);
    ok(a.ld.headline && a.ld.date && a.ld.author?.endsWith('/#org') && a.ld.publisher?.endsWith('/#org') && a.ld.crumbs === 3, `${post}: BlogPosting (autor TaMa Creative) + BreadcrumbList`);
    if (post.includes('compliance')) ok(!a.vitrine && !a.proposta.some(h => h.includes('?tipo=')) && a.tocOk, `${post}: só editorial (sem vitrine nem chamadas de proposta) e sumário com âncoras válidas`);
    else ok(a.proposta.some(h => h.includes('?tipo=')) && a.tocOk, `${post}: CTA para a proposta com tipo e sumário com âncoras válidas`);
    ok(a.caption.startsWith('Imagem ilustrativa'), `${post}: capa identificada como imagem ilustrativa`);
    ok((await fetch(BASE + new URL(a.ogImage).pathname).then(async r => (await r.arrayBuffer(), r))).status === 200, `${post}: imagem de compartilhamento própria`);
    if (post.includes('compliance')) ok(a.sources >= 3, `${post}: fontes oficiais citadas no texto (${a.sources})`);
    else if (a.pecas) ok(a.curadoria.length > 0 || a.links.includes('/brindes-de-fim-de-ano/'), `${post}: artigo com peças do catálogo leva às ideias da ocasião (fim de ano: página própria)`);
    for (const l of a.links) { const r = await fetch(BASE + l); await r.arrayBuffer(); if (r.status !== 200) blogBroken.push(post + ' → ' + l + ' ' + r.status); }
  }
  ok(blogBroken.length === 0, `links internos dos artigos respondem 200${blogBroken.length ? ' — ' + blogBroken.join(', ') : ''}`);
  await bp.evaluate(() => { localStorage.clear(); localStorage.setItem('tama-consent', 'denied'); });
  await bp.goto(BASE + '/blog/brindes-de-fim-de-ano-para-clientes/', { waitUntil: 'networkidle0' });
  await bp.$eval('#rail-post .pick[data-slug="caneta-executiva-com-estojo"]', el => el.scrollIntoView({ block: 'center' }));
  await bp.click('#rail-post .pick[data-slug="caneta-executiva-com-estojo"]');
  ok(await bp.evaluate(() => JSON.parse(localStorage.getItem('tama-selecao') || '[]').some(x => x.s === 'caneta-executiva-com-estojo')), 'peça escolhida no artigo entra na seleção da proposta');
  await bp.evaluate(() => { localStorage.clear(); localStorage.setItem('tama-consent', 'denied'); });
  const feed = await (await fetch(BASE + '/blog/feed.xml')).text();
  const items = [...feed.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)].map(m => new URL(m[1]).pathname);
  ok(items.length === 14 && items.every(p => idx.posts.includes(p)), `RSS com os 14 artigos (${items.length})`);
  const sitemap = await (await fetch(BASE + '/sitemap.xml')).text();
  ok(['/blog/', ...idx.posts].every(p => sitemap.includes(p + '</loc>')), 'sitemap inclui o blog e os artigos');

  console.log('Editor do blog (/admin/)');
  const admHtml = await (await fetch(BASE + '/admin/')).text();
  const cfg = await (await fetch(BASE + '/admin/config.yml')).text();
  const vendor = admHtml.match(/src="(\/admin\/vendor\/[^"]+)"/)?.[1];
  ok(admHtml.includes('noindex') && vendor && (await fetch(BASE + vendor)).status === 200, 'editor publicado com noindex e Decap servido pelo próprio site');
  ok(['publish_mode: editorial_workflow', 'folder: src/blog', 'media_folder: img/blog', 'name: github'].every(s => cfg.includes(s)), 'config do editor: GitHub, fluxo editorial, pasta do blog e mídia em img/blog');
  ok(['value: fim-de-ano', 'value: caneta-executiva-com-estojo', "pattern:"].every(s => cfg.includes(s)) && !cfg.includes('heading-one'), 'editor só oferece temas e peças válidos, com limites de SEO e sem H1 no texto');
  ok(!sitemap.includes('/admin/'), 'editor fora do sitemap');
  ok(['name: pautas', 'folder: src/pautas', 'name: revisar_em'].every(s => cfg.includes(s)), 'editor com a coleção de pautas e a data de revisão do artigo');
  const painel = await (await fetch(BASE + '/admin/painel/')).text();
  const painelDados = await (await fetch(BASE + '/admin/painel/site.json')).json();
  ok(admHtml.includes('href="/admin/painel/"') && painel.includes('noindex') && !painel.includes('palavra_chave'), 'Painel de SEO ligado ao editor, com noindex e sem dados na página');
  ok(painelDados.paginas.length >= 8 && painelDados.temas['brindes-e-presentes'] && !JSON.stringify(painelDados).includes('src/pautas'), 'dados públicos do painel: só páginas do site e opções, sem pautas');
  ok((await fetch(BASE + '/pautas/')).status === 404 && (await fetch(BASE + '/src/pautas/')).status === 404, 'pautas não são publicadas');
  ok(['file: src/data/produtos.json', 'widget: color', 'media_folder: /img/produtos', 'value: confirmado', 'value: a_confirmar', 'file: src/data/modelos.json', 'name: resumo', 'name: usos', 'value: tecnologia'].every(x => cfg.includes(x)), 'editor tem o catálogo: foto, cor, material e técnica com situação');
  const rob = await (await fetch(BASE + '/robots.txt')).text();
  ok(rob.includes('Disallow: /admin/') && !rob.includes('/brindes/'), 'robots.txt sem o app /brindes/ e com o editor fora da busca');

  console.log('Aberturas e cabeçalho do site');
  // ocasiões: abertura com foto que troca com a ocasião escolhida (um H1 só, foto em alta, marca fictícia)
  await bp.goto(BASE + '/brindes-por-ocasiao/?ocasiao=eventos', { waitUntil: 'networkidle0' });
  ok(await bp.evaluate(() => document.querySelectorAll('h1').length === 1 && /Sua marca/.test(document.querySelector('.foto-hero h1').textContent) && /ocasiao-eventos/.test(document.querySelector('.foto-hero-photo img').getAttribute('srcset') || '') && document.querySelectorAll('template[data-occ-hero]').length === 7),
     '/brindes-por-ocasiao/: abertura com foto por ocasião (eventos) e um H1 só');
  await bp.click('.chip[data-filter="occ"][data-value="todas"]'); await sleep(200);
  ok(await bp.evaluate(() => /Cada ocasião/.test(document.querySelector('.foto-hero h1').textContent)), '/brindes-por-ocasiao/: "Todas" volta à abertura geral');
  ok(!(await bp.$('.brand-note')), '/brindes-por-ocasiao/: sem o bloco antigo "Sua marca é a protagonista"');
  // páginas sem foto de abertura usam o mesmo cabeçalho de texto (text_head): eyebrow + um H1 + apoio no mesmo bloco
  for (const p of ['/solicitar-proposta/', '/obrigado/', '/privacidade/', '/404.html', idx.posts[0]]) {
    await bp.goto(BASE + p, { waitUntil: 'networkidle0' });
    const t = await bp.evaluate(() => { const c = document.querySelector('.text-head-copy'); return { h1s: document.querySelectorAll('h1').length, bloco: !!c, ordem: !!c && !!c.querySelector('.eyebrow') && c.querySelector('.eyebrow').compareDocumentPosition(c.querySelector('h1')) === 4 && !!c.querySelector('.lead'), foto: !!document.querySelector('.foto-hero, .text-head img') }; });
    ok(t.h1s === 1 && t.bloco && t.ordem && !t.foto, `${p}: cabeçalho de texto padrão (eyebrow, H1 único e apoio), sem foto`);
  }
  // a barra verde (temporada + 3 compromissos) e o cabeçalho aparecem iguais em todas as páginas, inclusive no blog
  let barra = null, diff = [];
  for (const p of ['/', '/blog/', idx.posts[0], '/sobre/', '/catalogo/', '/solicitar-proposta/', '/brindes-corporativos/', '/404.html']) {
    await bp.goto(BASE + p, { waitUntil: 'networkidle0' });
    const b = await bp.evaluate(() => { const a = document.querySelector('body > .announce'), h = document.querySelector('body > .site-header'); return a && h && getComputedStyle(a).display !== 'none' ? [a.querySelector('.wrap > p, .wrap > .announce-season')?.textContent.replace(/\s+/g, ' ').trim(), [...a.querySelectorAll('ul li')].map(l => l.textContent.trim()).join('|'), getComputedStyle(a).backgroundColor, !!h.querySelector('.brand') && !!h.querySelector('#site-nav') && !!h.querySelector('#menu-btn')].join('§') : null; });
    if (barra === null) barra = b;
    if (b !== barra) diff.push(p);
  }
  ok(barra && barra.includes('Atendimento consultivo|Arte aprovada antes da produção|Coordenação do pedido à entrega') && diff.length === 0, `barra do topo (3 compromissos) e cabeçalho iguais em todas as páginas, inclusive no blog${diff.length ? ' — diferem: ' + diff.join(', ') : ''}`);
  await bp.close();
} finally {
  await browser.close();
}
console.log(`\n${pass} ok, ${fail} falhas`);
process.exit(fail ? 1 : 0);
