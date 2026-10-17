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
  const cat = JSON.parse(document.getElementById('tama-catalog').textContent), cards = [...document.querySelectorAll(sel)];
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
  // /brindes/ é outro app (catálogo de brindes em quantidade), fora deste build
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
  ok(await page.$$eval('h1', h => h.length) === 1 && await page.$$eval('#hero .slide', s => s.length) === 4, 'home tem um único H1 com 4 slides');
  ok(await page.$$eval('#hero .slide .btn-line', a => a.map(x => x.getAttribute('href')).join()) === '/brindes-corporativos-premium/,/confeccoes-personalizadas/,/kits-corporativos/,/brindes-corporativos-premium/?categoria=escritorio#pecas', 'slides levam a rotas reais do site (curadoria, confecções, kits, escritório)');
  ok(await page.$$eval('.kits-home .kit-card', k => k.length === 5 && k.filter(x => x.classList.contains('big')).length === 2 && k.every(x => x.querySelector('img').alt.length > 20)), 'kits premium: dois destaques e três menores, com texto alternativo');
  ok(await page.$$eval('.kits-home .kit-occ a', a => a.length === 6 && a.every(x => /^\/brindes-corporativos-premium\/\?ocasiao=[a-z-]+#pecas$/.test(x.getAttribute('href')))), 'atalhos por ocasião continuam levando à curadoria filtrada');
  ok(await page.$$eval('#hero .slide-copy', s => s.every(x => !x.querySelector('.hero-meta'))) && await page.$$eval('.assurances li', l => l.length === 3), 'frases de confiança saem do banner e ficam na faixa abaixo do carrossel');
  ok(await page.$$eval('.home-prods .product.studio', c => c.length === 12 && c.every(x => x.querySelector('img').alt.length > 15 && x.querySelectorAll('.swatch').length >= 4)), 'destaques: 12 peças em estúdio claro, com texto alternativo e cores de referência');
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
  ok(await page.$eval('.home-prods .section-head a.link', a => a.getAttribute('href') === '/catalogo/' && /Acessar o catálogo completo/.test(a.textContent)), 'destaques levam ao catálogo completo');
  await page.$eval('.product.studio[data-slug="linha-polo"]', el => el.scrollIntoView({ block: 'center' }));
  await page.click('.product.studio[data-slug="linha-polo"] .swatch[data-color="Preto"]');
  ok(await page.$eval('.product.studio[data-slug="linha-polo"] .color-name', n => n.textContent === 'Preto'), 'cor de referência muda só o nome da cor (a foto não é recolorida)');
  await page.click('.pick[data-slug="linha-polo"]');
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
  await page.click(`${G} .product[data-slug="garrafa-termica"] .swatch[data-color="Azul"]`);
  ok(await page.$eval(`${G} .product[data-slug="garrafa-termica"] .color-name`, e => e.textContent === 'Azul'), 'troca de cor atualiza o nome da cor');
  await page.click(`${G} .pick[data-slug="garrafa-termica"]`);
  const sel = await page.evaluate(() => JSON.parse(localStorage.getItem('tama-selecao')));
  ok(sel.length === 1 && sel[0].s === 'garrafa-termica' && sel[0].c === 'Azul', 'peça entra na seleção com a cor escolhida');
  ok(await page.$eval('.site-header [data-sel-count]', e => !e.hidden && e.textContent === '1'), 'contador do cabeçalho mostra 1');
  await page.click('.site-header [data-open-drawer]');
  ok(await page.$eval('#drawer', d => d.open && d.textContent.includes('Garrafa térmica') && d.textContent.includes('Azul')), 'gaveta lista a peça com a cor');
  await page.keyboard.press('Escape');
  ok(!(await page.$eval('#drawer', d => d.open)), 'Esc fecha a gaveta');
  await page.$eval(`${G} .product[data-slug="bandeja-em-couro"]`, el => el.scrollIntoView({ block: 'center' }));
  await page.click(`${G} .product[data-slug="bandeja-em-couro"] .swatch[data-color="Café"]`);
  ok(await page.$eval(`${G} .product[data-slug="bandeja-em-couro"] .prod-media img`, i => (i.getAttribute('srcset') || '').includes('bandeja-couro~cafe')), 'trocar a cor mostra a foto do produto na cor escolhida');
  await page.$eval(`${G} [data-zoom="caneca-de-ceramica"]`, el => el.scrollIntoView({ block: 'center' }));
  await page.click(`${G} [data-zoom="caneca-de-ceramica"]`);
  ok(await page.$eval('#lightbox', d => d.open && d.querySelector('#lb-title').textContent === 'Caneca de cerâmica'), 'foto ampliada abre com a peça certa');
  await page.click('#lb-pick');
  ok((await page.evaluate(() => JSON.parse(localStorage.getItem('tama-selecao')).length)) === 2, 'selecionar pela foto ampliada adiciona a peça');
  await page.keyboard.press('Escape');

  console.log('Curadoria completa');
  await page.goto(BASE + '/brindes-corporativos-premium/', { waitUntil: 'networkidle0' });
  const visible = () => page.$$eval('#gift-grid .product, #idea-grid .idea', g => g.filter(x => !x.hidden && getComputedStyle(x).display !== 'none').length);
  ok(await visible() === 36, '36 peças sem filtro (19 com foto + 17 além do óbvio)');
  ok(await colorsHavePhoto(page, '#gift-grid .product'), 'toda cor mostrada na curadoria tem foto própria (nenhuma bolinha sem efeito)');
  await page.click('.chip[data-filter="cat"][data-value="alem"]');
  await page.click('.chip[data-filter="occ"][data-value="fim-de-ano"]');
  const n1 = await visible();
  ok(n1 === 9, `Além do óbvio + Fim de ano mostra 9 (${n1})`);
  ok(page.url().includes('categoria=alem') && page.url().includes('ocasiao=fim-de-ano'), 'filtros ficam na URL para compartilhar');
  await page.click('.chip[data-filter="cat"][data-value="bebidas"]');
  ok(await page.$eval('#gift-empty', e => !e.hidden), 'combinação sem resultados mostra estado vazio');
  await page.click('#gift-reset');
  ok(await visible() === 36, 'limpar filtros volta às 36 peças');
  // catálogo em estúdio (banco de imagens de produto): página própria, chamada a partir da curadoria
  ok(await page.$eval('a.btn[href="/catalogo/"]', a => /Acessar o catálogo completo/.test(a.textContent)), 'curadoria chama o catálogo completo');
  await page.goto(BASE + '/catalogo/', { waitUntil: 'networkidle0' });
  const catVisible = () => page.$$eval('#catalogo-grid .product', g => g.filter(x => !x.hidden && getComputedStyle(x).display !== 'none').length);   // conta o que está mesmo na tela
  ok(await page.$$eval('h1', h => h.length === 1 && /48 modelos/.test(h[0].textContent)), 'página do catálogo tem H1 com o total');
  ok(await catVisible() === 48 && await page.$$eval('#catalogo-grid .product img', i => i.every(x => x.alt.length > 15)), 'catálogo mostra os 48 modelos do banco, com texto alternativo');
  ok(await page.$$eval('#catalogo-grid .product[data-slug="cat-caneca"] .swatch', s => s.length === 5), 'caneca tem 5 cores com foto');
  ok(await colorsHavePhoto(page, '#catalogo-grid .product.studio'), 'toda cor mostrada no catálogo tem foto própria (nenhuma bolinha sem efeito)');
  await page.$eval('#catalogo-grid .product[data-slug="cat-caneca"]', el => el.scrollIntoView({ block: 'center' }));
  await page.click('#catalogo-grid .product[data-slug="cat-caneca"] .swatch[data-color="Verde"]');
  ok(await page.$eval('#catalogo-grid .product[data-slug="cat-caneca"] .prod-media img', i => (i.getAttribute('srcset') || '').includes('caneca~verde')), 'trocar a cor mostra a foto da caneca verde (variação gerada)');
  await page.click('#catalogo-grid .product[data-slug="cat-caneca"] .swatch[data-color="Branco"]');
  ok(await page.$$eval('#catalogo-grid .prod-meta', m => m.every(x => x.textContent === 'Material e técnica sob consulta')), 'material e técnica a confirmar não saem como especificação');
  await page.$eval('[data-rail-filter="catalogo-grid"][data-value="hotelaria-gastronomia"]', el => el.scrollIntoView({ block: 'center' }));
  await page.click('[data-rail-filter="catalogo-grid"][data-value="hotelaria-gastronomia"]');
  ok(await catVisible() === 5, 'filtro Hotelaria e gastronomia mostra 5 modelos');
  await page.click('[data-rail-filter="catalogo-grid"][data-value="todas"]');
  await page.$eval('#catalogo-grid .product[data-slug="cat-caneca"]', el => el.scrollIntoView({ block: 'center' }));
  await page.click('#catalogo-grid .pick[data-slug="cat-caneca"]');
  ok((await page.evaluate(() => JSON.parse(localStorage.getItem('tama-selecao')))).some(x => x.s === 'cat-caneca' && x.c === 'Branco'), 'modelo do catálogo entra na seleção com a cor da foto');
  await page.goto(BASE + '/catalogo/?categoria=vestuario', { waitUntil: 'networkidle0' });
  ok(await catVisible() === 7 && await page.$eval('[data-rail-filter="catalogo-grid"][data-value="vestuario"]', b => b.getAttribute('aria-pressed') === 'true'), '?categoria=vestuario abre o catálogo já filtrado (7 peças de vestuário)');
  await page.goto(BASE + '/brindes-corporativos/', { waitUntil: 'networkidle0' });
  ok(await page.$$eval('.studio-grid .product.studio', c => c.length === 8), 'brindes: 8 modelos em estúdio');
  ok(await colorsHavePhoto(page, '#rail-brindes .product'), 'trilho de brindes: toda cor mostrada tem foto própria');
  await page.goto(BASE + '/kits-corporativos/', { waitUntil: 'networkidle0' });
  ok(await page.$$eval('#kits .kit-card', k => k.length === 5 && k.every(x => x.querySelector('img').alt.length > 20)) && await page.$$eval('.studio-grid', g => g.length === 0), 'kits: os 5 kits premium logo após a abertura, sem bloco do catálogo');
  ok(!(await page.$('#rail-kits')) && await page.$eval('#comp-t', h => { const next = h.closest('section').nextElementSibling; return next && !!next.querySelector('#kit-m-t'); }), 'kits: depois de "Três camadas" vem direto "Como montamos o seu kit" (sem o bloco de peças)');
  ok(await page.$$eval('#site-nav a', a => a.map(x => x.textContent.trim()).join()) === 'Catálogo,Kits,Curadoria,Confecções,Sobre,Blog', 'menu sem Marcas e sem Projetos');
  ok(await page.$$eval('a[href^="/branding-identidade-visual/"], a[href^="/projetos/"]', a => a.length === 0), 'nenhum link para branding ou projetos');
  await page.goto(BASE + '/confeccoes-personalizadas/', { waitUntil: 'networkidle0' });
  ok(await page.$$eval('.studio-grid .product.studio', c => c.length === 7) && await page.$eval('.studio-grid', g => !!g.closest('section').querySelector('a[href="/catalogo/?categoria=vestuario"]')), 'confecções: 7 peças em estúdio com link para o catálogo filtrado');
  ok(await page.$$eval('#hero .slide', s => s.length === 4) && await page.$$eval('h1', h => h.length === 1 && /Uniformes corporativos/.test(h[0].textContent)), 'confecções abre com carrossel de 4 cenas e um único H1');
  ok(await page.$$eval('#hero .slide img', i => i.every(x => /TaMa/.test(x.alt) && x.alt.length > 40)), 'cenas de confecções com texto alternativo descritivo');
  ok(!(await page.$('.assurances')), 'confecções não repete a faixa de confiança da home');
  ok(await colorsHavePhoto(page, '#rail-conf .product'), 'trilho de confecções: toda cor mostrada tem foto própria');
  await page.goto(BASE + '/blog/o-que-colocar-no-kit-de-boas-vindas/', { waitUntil: 'networkidle0' });
  ok(await colorsHavePhoto(page, '#rail-post .product'), 'trilho do post do blog: toda cor mostrada tem foto própria');
  // tira só o modelo do catálogo da seleção: a seleção anterior segue para os testes do formulário
  await page.evaluate(() => localStorage.setItem('tama-selecao', JSON.stringify(JSON.parse(localStorage.getItem('tama-selecao')).filter(x => x.s !== 'cat-caneca'))));
  await page.goto(BASE + '/brindes-corporativos-premium/', { waitUntil: 'networkidle0' });
  await page.goto(BASE + '/brindes-corporativos-premium/?ocasiao=eventos#pecas', { waitUntil: 'networkidle0' });
  const n2 = await visible();
  ok(n2 === 16, `link de coleção (?ocasiao=eventos) já abre filtrado (${n2})`);
  await page.click('.idea .pick[data-slug="baralho-exclusivo"]');

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
  ok(selecao.includes('Garrafa térmica (Azul)') && selecao.includes('Baralho exclusivo'), 'campo enviado leva peças e cores');
  ok(await page.$$eval('input[name="tipo"]', l => l.map(i => i.value).join()) === 'brindes,kits,confeccoes,integrado', 'formulário sem o tipo branding');
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
      return req.respond(mode === 'ok' ? { status: 200, contentType: 'text/html', body: 'ok' } : { status: 500, contentType: 'text/plain', body: 'erro' });
    }
    req.continue();
  });
  await fill();
  await page.click('#submit-btn');
  await page.waitForSelector('#form-result:not([hidden])');
  ok(await page.$eval('#form-result', r => r.textContent.includes('Não conseguimos enviar')), 'falha do servidor mostra erro (nunca sucesso)');
  const decoded = new URLSearchParams(posted);
  ok(decoded.get('form-name') === 'proposta' && decoded.has('bot-field') && (decoded.get('selecao') || '').includes('Garrafa térmica (Azul)'), 'POST inclui form-name, honeypot e seleção');
  await page.click('[data-retry]');
  ok(await page.$eval('#proposal-form', f => !f.hidden), '"Tentar de novo" reabre o formulário com os dados');
  mode = 'ok';
  await page.waitForFunction(() => !document.getElementById('submit-btn').disabled);
  await page.click('#submit-btn');
  ok(await page.waitForFunction(() => document.querySelector('#form-result h2')?.textContent.includes('Recebemos'), { timeout: 8000 }).then(() => true, () => false), 'resposta 200 mostra "Recebemos o seu pedido"');
  ok(await page.evaluate(() => (localStorage.getItem('tama-selecao') || '[]') === '[]'), 'seleção é limpa após envio confirmado');
  const events = await page.evaluate(() => (window.dataLayer || []).map(e => e.event).filter(Boolean));
  ok(['form_start', 'form_submit_error', 'form_submit_success'].every(e => events.includes(e)), `eventos do formulário disparados (${[...new Set(events)].join(', ')})`);
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
  await bp.$eval('#rail-post .pick[data-slug="bandeja-em-couro"]', el => el.scrollIntoView({ block: 'center' }));
  await bp.click('#rail-post .pick[data-slug="bandeja-em-couro"]');
  ok(await bp.evaluate(() => JSON.parse(localStorage.getItem('tama-selecao') || '[]').some(x => x.s === 'bandeja-em-couro')), 'peça escolhida no artigo entra na seleção da proposta');
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
  ok(['value: fim-de-ano', 'value: bandeja-em-couro', "pattern:"].every(s => cfg.includes(s)) && !cfg.includes('heading-one'), 'editor só oferece temas e peças válidos, com limites de SEO e sem H1 no texto');
  ok(!sitemap.includes('/admin/'), 'editor fora do sitemap');
  await bp.close();
} finally {
  await browser.close();
}
console.log(`\n${pass} ok, ${fail} falhas`);
process.exit(fail ? 1 : 0);
