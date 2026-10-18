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
  const links = await page.$$eval('a[href^="/"]', as => [...new Set(as.map(a => a.getAttribute('href').split('#')[0].split('?')[0]))]);
  const broken = [];
  for (const l of links) { const r = await fetch(BASE + l); if (r.status !== 200) broken.push(l + ' ' + r.status); }
  const catHref = await page.$eval('#site-nav', n => [...n.querySelectorAll('a')].map(a => [a.textContent.trim(), a.getAttribute('href')]).find(([t]) => t === 'Catálogo')?.[1]);
  ok(catHref === '/catalogo/', `menu "Catálogo" abre /catalogo/ (${catHref})`);
  ok(broken.length === 0, `${links.length} links internos respondem 200${broken.length ? ' — quebrados: ' + broken.join(', ') : ''}`);
  await page.click('#menu-btn');
  ok(await page.$eval('#site-nav', n => n.classList.contains('is-open')), 'menu mobile abre');
  await page.keyboard.press('Escape');
  ok(!(await page.$eval('#site-nav', n => n.classList.contains('is-open'))), 'Esc fecha o menu mobile');
  await page.goto('about:blank');
  await page.goto(BASE + '/#curadoria', { waitUntil: 'domcontentloaded' });
  ok(await page.waitForFunction(() => location.pathname === '/brindes-corporativos-premium/', { timeout: 8000 }).then(() => true, () => false), 'link antigo /#curadoria redireciona');

  console.log('Carrossel da abertura');
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  ok(await page.$$eval('h1', h => h.length) === 1 && await page.$$eval('#hero .slide', s => s.length) === 5, 'home tem um único H1 com 5 slides');
  ok(await page.$$eval('#hero .slide .btn-line', a => a.map(x => x.getAttribute('href')).join()) === '/catalogo/,/confeccoes-personalizadas/,/kits-corporativos/,/catalogo/?categoria=canetas-escritorio#catalogo,/ativacoes-promocionais/', 'slides levam a rotas reais do site (catálogo, confecções, kits, escritório, ativações)');
  ok(await page.$$eval('.kits-home .kit-card', k => k.length === 5 && k.filter(x => x.classList.contains('big')).length === 2 && k.every(x => x.querySelector('img').alt.length > 20)), 'kits premium: dois destaques e três menores, com texto alternativo');
  ok(await page.$$eval('.kits-home .kit-occ a', a => a.length === 6 && a.every(x => /^\/brindes-corporativos-premium\/\?ocasiao=[a-z-]+#pecas$/.test(x.getAttribute('href')))), 'atalhos por ocasião levam às ideias filtradas');
  ok(await page.$$eval('#hero .slide-copy', s => s.every(x => !x.querySelector('.hero-meta'))) && await page.$$eval('.assurances li', l => l.length === 3), 'frases de confiança saem do banner e ficam na faixa abaixo do carrossel');
  ok(await page.$$eval('.home-prods .product.studio', c => c.length === 8 && c.every(x => x.querySelector('img').alt.length > 15 && x.querySelectorAll('.swatch').length >= 4)), 'destaques: 8 peças em estúdio claro, com texto alternativo e cores com foto');
  ok(await page.$$eval('.home-prods .product.studio h3', h => h.slice(0, 4).map(x => x.textContent).join('|') === 'Polo masculina|Polo feminina|Camiseta masculina|Camiseta feminina'), 'polo e camiseta aparecem em pares masculina/feminina, lado a lado');
  ok(await page.$$eval('.home-prods .product.studio', c => [c[0], c[1], c[2], c[3]].map(x => x.querySelector('img').currentSrc.split('/').pop().split('.')[0]).join('|') === 'polo~vermelho|polo-feminina~azul-royal|camiseta~branco|camiseta-feminina~preto'), 'a peça feminina ao lado vem em outra cor (azul royal × vermelho)');
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
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await page.click('[data-hero-next]');
  ok(await page.$eval('#slide-2', s => s.classList.contains('is-active') && !s.hasAttribute('aria-hidden')), 'seta avança para o slide 2');
  ok(await page.$eval('#slide-1', s => s.hasAttribute('inert')), 'slide inativo fica inerte (fora do foco)');
  ok(await page.$eval('[data-hero-pause]', b => b.getAttribute('aria-pressed') === 'true'), 'com movimento reduzido, a troca automática começa pausada');
  ok(await page.$eval('[data-hero-count]', c => c.textContent === '02'), 'contador acompanha o slide (02 / 04)');
  ok(await page.$$eval('#hero .slide', s => new Set(s.map(x => getComputedStyle(x).backgroundColor)).size === 4), 'cada slide tem o seu tom de fundo');
  ok(await page.$$eval('#hero .slide img', i => i[0].loading === 'eager' && i[0].getAttribute('fetchpriority') === 'high' && i.slice(1).every(x => x.loading === 'lazy')), 'só a primeira foto do carrossel é prioritária');
  ok(await page.$$eval('#hero .slide', s => s.every(x => { const c = x.querySelector('.slide-copy').getBoundingClientRect(), p = x.querySelector('.slide-photo').getBoundingClientRect(); return c.right <= p.left + p.width * 0.18; })), 'no computador o texto não invade a área nítida da foto');
  await page.click('[data-hero-pause]');
  ok(await page.$eval('#hero', h => !h.classList.contains('is-stopped') && h.classList.contains('is-held')), 'retomar a troca com o foco no carrossel mantém a pausa enquanto o foco estiver nele');
  await page.click('[data-hero-pause]');
  ok(await page.$eval('[data-hero-pause]', b => b.getAttribute('aria-pressed') === 'true' && b.getAttribute('aria-label') === 'Retomar troca automática'), 'botão de pausa alterna e atualiza o rótulo');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  ok(await page.$$eval('#hero .slide', s => s.every(x => x.querySelector('.slide-photo').getBoundingClientRect().top >= x.querySelector('.slide-copy').getBoundingClientRect().bottom - 1)), 'no celular o texto fica acima da foto, sem sobreposição');
  for (const w of [320, 768, 1024, 1180, 1440]) {
    await page.setViewport({ width: w, height: 900 });
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `carrossel sem rolagem horizontal em ${w} px`);
  }
  await page.setViewport({ width: 1280, height: 900 });

  console.log('Vitrine, cores e seleção');
  // a vitrine das 21 peças fica na curadoria; a home mostra os destaques em estúdio claro
  await page.goto(BASE + '/brindes-corporativos-premium/', { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
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
  await page.goto(BASE + '/brindes-corporativos-premium/', { waitUntil: 'networkidle0' });
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
  await page.click('.chip[data-filter="occ"][data-value="lancamentos"]');
  await page.click('.chip[data-filter="cat"][data-value="vestuario"]');
  ok(await page.$eval('#gift-empty', e => !e.hidden), 'combinação sem resultados mostra estado vazio');
  await page.click('#gift-reset');
  ok(await visible() === totalOcc, 'limpar filtros volta a todas as peças');
  // catálogo em estúdio (banco de imagens de produto): página própria, chamada a partir da curadoria
  ok(await page.$eval('a.btn[href="/catalogo/"]', a => /Ver o catálogo/.test(a.textContent)), 'ideias por ocasião chamam o catálogo completo');
  await page.goto(BASE + '/catalogo/', { waitUntil: 'networkidle0' });
  const catVisible = () => page.$$eval('#catalogo-grid .product', g => g.filter(x => !x.hidden && getComputedStyle(x).display !== 'none').length);   // conta o que está mesmo na tela
  const nModelos = +(await page.$eval('h1', h => (h.textContent.match(/(\d+) modelos/) || [])[1]));
  ok(await page.$$eval('h1', h => h.length === 1) && nModelos >= 51, `página do catálogo tem H1 com o total (${nModelos})`);
  ok(await catVisible() === nModelos && await page.$$eval('#catalogo-grid .product .prod-media > picture img', (i, n) => i.length === n && i.every(x => x.alt.length > 15), nModelos), 'catálogo mostra todos os modelos do banco, com texto alternativo');
  ok(await page.$$eval('#catalogo-grid .product[data-slug="caneca"] .swatch', s => s.length === 5), 'caneca tem 5 cores com foto');
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
  ok(await catVisible() === 1 && /q=caneca/.test(await page.evaluate(() => location.search)), 'busca "caneca" mostra 1 modelo e grava ?q= na URL');
  await page.$eval('#cat-q', el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(400);
  await page.$eval('#cat-filtros input[name="categoria"][value="hotelaria-gastronomia"]', el => el.scrollIntoView({ block: 'center' }));
  await page.click('#cat-filtros input[name="categoria"][value="hotelaria-gastronomia"]'); await sleep(200);
  ok(await catVisible() === 5, 'categoria Hotelaria e gastronomia mostra 5 modelos');
  await page.$eval('#cat-filtros input[name="cor"][value="verde"]', el => el.scrollIntoView({ block: 'center' }));
  await page.click('#cat-filtros input[name="cor"][value="verde"]'); await sleep(200);
  const nVerde = await catVisible();
  ok(nVerde > 0 && nVerde < 5 && /categoria=hotelaria-gastronomia/.test(await page.evaluate(() => location.search)) && /cor=verde/.test(await page.evaluate(() => location.search)), `categoria + cor combinam e vão para a URL (${nVerde})`);
  ok(await page.$$eval('#catalogo-grid .product:not([hidden])', ps => ps.every(p => /Verde/.test(p.getAttribute('data-color') || ''))), 'com filtro de cor, os cards mostram a peça na cor escolhida');
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
  ok(await catVisible() === nModelos, `limpar filtros volta aos ${nModelos} modelos`);
  await page.setViewport({ width: 1280, height: 900 });
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
  ok(pdp.canon.endsWith('/catalogo/caneca/') && pdp.thumbs === 5 && pdp.crumbs === 'Início / Catálogo / Caneca', 'página do modelo: canonical sem a cor, 5 miniaturas e caminho');
  ok(await page.evaluate(() => { const r = document.querySelector('.pdp-resumo'); const u = document.querySelectorAll('.pdp-usos li'); return !!r && r.textContent.split(/\s+/).length >= 30 && u.length >= 2 && document.title.startsWith('Caneca personalizada'); }), 'página do modelo mostra o resumo e os usos do cadastro, com título "Caneca personalizada"');
  // vistas da cor (frente, verso, bordado) na polo: acompanham a cor escolhida
  await page.goto(BASE + '/catalogo/polo-masculina/?cor=azul-marinho', { waitUntil: 'networkidle0' });
  ok(await page.$$eval('.pdp-vista:not([hidden])', b => b.map(x => x.textContent).join()) === 'Frente,Verso,Bordado', 'polo: vistas Frente, Verso e Bordado');
  await page.click('.pdp-vista[data-vista="detalhe"]'); await sleep(300);
  ok(await page.$eval('.pdp-main img', i => (i.getAttribute('srcset') || '').includes('polo~azul-marinho-bordado')), 'vista Bordado mostra o close do bordado na cor escolhida');
  await page.click('.pdp-thumb[data-thumb-color="Branco"]'); await sleep(300);
  ok(await page.$$eval('.pdp-vista:not([hidden])', b => b.map(x => x.textContent).join()) === 'Frente,Verso' && await page.$eval('.pdp-main img', i => (i.getAttribute('srcset') || '').includes('polo~branco.')), 'trocar de cor volta para a frente e mostra só as vistas que existem');
  await page.goto(BASE + '/catalogo/caneca/?cor=verde', { waitUntil: 'networkidle0' });
  await page.click('.pdp-thumb[data-thumb-color="Azul royal"]'); await sleep(300);
  ok(await page.evaluate(() => location.search === '?cor=azul-royal' && document.querySelector('.pdp .color-name').textContent === 'Azul royal'), 'miniatura troca a cor e atualiza a URL');
  ok(await page.$eval('.pdp .pick', b => b.getAttribute('aria-pressed') === 'true') && (await page.evaluate(() => JSON.parse(localStorage.getItem('tama-selecao')))).some(x => x.s === 'caneca' && x.c === 'Azul royal'), 'na página do modelo, a peça já selecionada aparece marcada e a troca de cor vai para a seleção');
  ok(await page.$$eval('.studio-grid .product', ps => ps.length === 4 && ps.every(p => p.getAttribute('data-cat') === 'garrafas-copos')), 'página do modelo sugere 4 modelos da mesma categoria');
  await page.goto(BASE + '/catalogo/?categoria=vestuario', { waitUntil: 'networkidle0' });
  ok(await catVisible() === 9 && await page.$eval('input[name="categoria"][value="vestuario"]', i => i.checked), '?categoria=vestuario abre o catálogo já filtrado (9 peças de vestuário)');
  await page.goto(BASE + '/brindes-corporativos/', { waitUntil: 'networkidle0' });
  ok(await page.$$eval('.studio-grid .product.studio', c => c.length === 12) && await page.$$eval('.studio-grid', g => g.length === 1), 'brindes: uma grade só, com 12 modelos do catálogo');
  ok(await colorsHavePhoto(page, '.studio-grid .product'), 'brindes: toda cor mostrada tem foto própria');
  await page.goto(BASE + '/kits-corporativos/', { waitUntil: 'networkidle0' });
  ok(await page.$$eval('#kits .kit-card', k => k.length === 5 && k.every(x => x.querySelector('img').alt.length > 20)) && await page.$$eval('.studio-grid', g => g.length === 0), 'kits: os 5 kits premium logo após a abertura, sem bloco do catálogo');
  ok(!(await page.$('#rail-kits')) && await page.$eval('#comp-t', h => { const next = h.closest('section').nextElementSibling; return next && !!next.querySelector('#kit-m-t'); }), 'kits: depois de "Três camadas" vem direto "Como montamos o seu kit" (sem o bloco de peças)');
  ok(await page.$$eval('#site-nav a.nav-link', a => a.map(x => x.textContent.trim()).join()) === 'Brindes,Confecções,Kits,Ativações,Hotelaria,Catálogo,Sobre,Blog', 'menu com as frentes atuais (sem Marcas e sem Projetos)');
  ok(await page.$$eval('a[href^="/branding-identidade-visual/"], a[href^="/projetos/"]', a => a.length === 0), 'nenhum link para branding ou projetos');
  await page.goto(BASE + '/confeccoes-personalizadas/', { waitUntil: 'networkidle0' });
  ok(await page.$$eval('.studio-grid .product.studio', c => c.length === 8) && await page.$eval('.studio-grid', g => !!g.closest('section').querySelector('a[href="/catalogo/?categoria=vestuario"]')), 'confecções: 8 peças em estúdio com link para o catálogo filtrado');
  ok(await page.$$eval('#hero .slide', s => s.length === 4) && await page.$$eval('h1', h => h.length === 1 && /Uniformes corporativos/.test(h[0].textContent)), 'confecções abre com carrossel de 4 cenas e um único H1');
  ok(await page.$$eval('#hero .slide img', i => i.every(x => /TaMa/.test(x.alt) && x.alt.length > 40)), 'cenas de confecções com texto alternativo descritivo');
  ok(!(await page.$('.assurances')), 'confecções não repete a faixa de confiança da home');
  ok(!(await page.$('#rail-conf')) && !(await page.$('#pecas-c-t')), 'confecções: sem o bloco "Do uniforme do dia a dia à peça do evento"');
  ok(await colorsHavePhoto(page, '.studio-grid .product.studio'), 'confecções: toda cor mostrada nas peças em estúdio tem foto própria');
  await page.goto(BASE + '/blog/o-que-colocar-no-kit-de-boas-vindas/', { waitUntil: 'networkidle0' });
  ok(await colorsHavePhoto(page, '#rail-post .product'), 'trilho do post do blog: toda cor mostrada tem foto própria');
  // tira só o modelo do catálogo da seleção: a seleção anterior segue para os testes do formulário
  await page.evaluate(() => localStorage.setItem('tama-selecao', JSON.stringify(JSON.parse(localStorage.getItem('tama-selecao')).filter(x => x.s !== 'cardapio'))));
  await page.goto(BASE + '/brindes-corporativos-premium/', { waitUntil: 'networkidle0' });
  await page.goto(BASE + '/brindes-corporativos-premium/?ocasiao=eventos#pecas', { waitUntil: 'networkidle0' });
  const n2 = await visible(), e2 = await page.$$eval('#gift-grid .product', g => g.filter(x => x.dataset.occ.split(' ').includes('eventos')).length);
  ok(n2 === e2 && n2 > 0, `link de coleção (?ocasiao=eventos) já abre filtrado (${n2})`);
  await page.$eval('#gift-grid .pick[data-slug="taca-de-gin"]', el => el.scrollIntoView({ block: 'center' }));
  await page.click('#gift-grid .pick[data-slug="taca-de-gin"]');

  console.log('Processo (Do briefing à entrega)');
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  const proc = await page.$eval('section.process', s => ({
    steps: [...s.querySelectorAll('ol.process-steps > li')].map(li => li.querySelector('h3')?.textContent),
    decor: [...s.querySelectorAll('.process-num, .process-icon')].map(e => e.getAttribute('aria-hidden')),
    cta: (a => a && { href: a.getAttribute('href'), track: a.dataset.track, label: a.dataset.trackLabel })(s.querySelector('.process-cta a')),
  }));
  ok(proc.steps.join(',') === 'Briefing,Curadoria,Proposta,Aprovação,Produção,Entrega', 'home lista as 6 etapas em lista ordenada');
  ok(proc.decor.length === 12 && proc.decor.every(v => v === 'true'), 'números e ícones das etapas são decorativos (aria-hidden)');
  ok(proc.cta?.href === '/solicitar-proposta/' && proc.cta.track === 'cta_solicitar_proposta' && proc.cta.label === 'process', 'chamada final do processo leva à proposta com rastreamento');
  await page.goto(BASE + '/kits-corporativos/', { waitUntil: 'networkidle0' });
  ok(await page.$$eval('ol.process-steps.light > li', l => l.length) === 6, 'kits usa as mesmas 6 etapas');

  console.log('Formulário');
  await page.goto(BASE + '/solicitar-proposta/?tipo=kits', { waitUntil: 'networkidle0' });
  ok(await page.$eval('input[name="tipo"][value="kits"]', i => i.checked), 'tipo pré-selecionado pela URL (?tipo=kits)');
  ok(await page.$eval('#picked-list', l => l.children.length === 3), 'as 3 peças selecionadas aparecem no formulário');
  const selecao = await page.$eval('#f-selecao', i => i.value);
  ok(selecao.includes('Garrafa térmica (Azul royal)') && selecao.includes('Taça de gin'), 'campo enviado leva peças e cores');
  ok(await page.$$eval('input[name="tipo"]', l => l.map(i => i.value).join()) === 'brindes,kits,confeccoes,ativacoes,hotelaria,integrado', 'formulário com as frentes atuais (sem branding)');
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
  await fp.goto(BASE + '/', { waitUntil: 'networkidle0' });
  ok(await fp.$$eval('.service-grid .service-card', a => a.map(x => x.getAttribute('href')).join() === '/brindes-corporativos/,/confeccoes-personalizadas/,/kits-corporativos/,/ativacoes-promocionais/,/hotelaria-e-gastronomia/'), 'home apresenta as cinco frentes');
  ok(await fp.$eval('h1', h => /Brindes, confecções e ativações/.test(h.textContent)), 'H1 da home diz o que a TaMa oferece');
  ok(await fp.$$eval('.kit-card a[href*="tipo=kits"]', a => a.length === 5 && a.every(x => x.href.includes('interesse='))), 'cada kit tem "Quero este kit" com o interesse no pedido');
  await fp.evaluate(() => localStorage.setItem('tama-selecao', JSON.stringify([{ s: 'linha-polo', c: 'Preto' }, { s: 'caneca-de-ceramica', c: null }, { s: 'baralho-exclusivo', c: null }])));
  await fp.goto(BASE + '/solicitar-proposta/', { waitUntil: 'networkidle0' });
  ok(await fp.$eval('#f-selecao', i => i.value === 'Polo masculina (Preto); Caneca (Branco)'), 'seleção salva com slugs antigos vira os modelos atuais (ideia retirada sai)');
  await fp.evaluate(() => localStorage.clear());
  const selo = await (await fetch(BASE + '/sobre/')).text();
  ok(!/MARCAS/.test(selo) && (await (await fetch(BASE + '/favicon.svg')).ok), 'selo sem "MARCAS" no HTML');
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
  ok(idx.h1 === 1 && idx.posts.length === 4, `/blog/ tem um H1 e lista 4 artigos (${idx.posts.length})`);
  ok(idx.feature === '/blog/brindes-de-fim-de-ano-para-clientes/', 'guia de fim de ano para clientes em destaque');
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
        sources: [...document.querySelectorAll('.sources a[href^="https://"]')].length,
      };
    });
    const path = new URL(a.canonical).pathname;
    ok(a.h1 === 1 && path === post && a.ogType === 'article', `${post}: um H1, canonical e og:type=article`);
    ok(a.ld.headline && a.ld.date && a.ld.author?.endsWith('/#org') && a.ld.publisher?.endsWith('/#org') && a.ld.crumbs === 3, `${post}: BlogPosting (autor TaMa Creative) + BreadcrumbList`);
    ok(a.proposta.some(h => h.includes('?tipo=')) && a.tocOk, `${post}: CTA para a proposta com tipo e sumário com âncoras válidas`);
    ok((await fetch(BASE + new URL(a.ogImage).pathname)).status === 200, `${post}: imagem de compartilhamento própria`);
    if (post.includes('compliance')) ok(a.sources >= 10, `${post}: seção Fontes com links oficiais (${a.sources})`);
    else ok(a.curadoria.length > 0, `${post}: link para a curadoria filtrada por ocasião`);
    for (const l of a.links) { const r = await fetch(BASE + l); if (r.status !== 200) blogBroken.push(post + ' → ' + l + ' ' + r.status); }
  }
  ok(blogBroken.length === 0, `links internos dos artigos respondem 200${blogBroken.length ? ' — ' + blogBroken.join(', ') : ''}`);
  await bp.evaluate(() => localStorage.clear());
  await bp.goto(BASE + '/blog/brindes-de-fim-de-ano-para-clientes/', { waitUntil: 'networkidle0' });
  await bp.$eval('#rail-post .pick[data-slug="caneta-executiva-com-estojo"]', el => el.scrollIntoView({ block: 'center' }));
  await bp.click('#rail-post .pick[data-slug="caneta-executiva-com-estojo"]');
  ok(await bp.evaluate(() => JSON.parse(localStorage.getItem('tama-selecao') || '[]').some(x => x.s === 'caneta-executiva-com-estojo')), 'peça escolhida no artigo entra na seleção da proposta');
  await bp.evaluate(() => localStorage.clear());
  const feed = await (await fetch(BASE + '/blog/feed.xml')).text();
  const items = [...feed.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)].map(m => new URL(m[1]).pathname);
  ok(items.length === 4 && items.every(p => idx.posts.includes(p)), `RSS com os 4 artigos (${items.length})`);
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
  ok(['file: src/data/produtos.json', 'widget: color', 'media_folder: /img/produtos', 'value: confirmado', 'value: a_confirmar', 'file: src/data/modelos.json', 'name: resumo', 'name: usos'].every(x => cfg.includes(x)), 'editor tem o catálogo: foto, cor, material e técnica com situação');
  const rob = await (await fetch(BASE + '/robots.txt')).text();
  ok(rob.includes('Disallow: /admin/') && !rob.includes('/brindes/'), 'robots.txt sem o app /brindes/ e com o editor fora da busca');
  await bp.close();
} finally {
  await browser.close();
}
console.log(`\n${pass} ok, ${fail} falhas`);
process.exit(fail ? 1 : 0);
