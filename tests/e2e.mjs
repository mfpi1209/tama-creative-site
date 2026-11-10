// Testes de fluxos críticos do site TaMa Creative.
// Uso: node tests/e2e.mjs [baseURL]   (padrão http://127.0.0.1:8099, servindo dist/)
// O site testado é gerado com os dados de teste: TAMA_DADOS=tests/fixtures/dados python build.py (cópia fixa do
// catálogo e dos kits). Assim a edição de conteúdo pelo cliente (/admin/inventario/) não quebra os testes de fluxo;
// o site publicado é gerado depois com src/data/ (ver .github/workflows/deploy.yml).
// Requer puppeteer-core e um Edge/Chrome local (EDGE_PATH). Não envia nada para produção:
// o POST do formulário é interceptado e respondido localmente.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.argv[2] || 'http://127.0.0.1:8099';
const RAIZ = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const DADOS = path.join(RAIZ, process.env.TAMA_DADOS || 'tests/fixtures/dados');   // os mesmos dados do build testado
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
  const catHref = await page.$eval('#sub-brindes', n => [...n.querySelectorAll('a')].map(a => [a.textContent.trim(), a.getAttribute('href')]).find(([t]) => t.startsWith('Catálogo completo'))?.[1]);
  ok(catHref === '/catalogo/', `menu Brindes › "Catálogo completo" abre /catalogo/ (${catHref})`);
  ok(await page.$eval('#site-nav .head-search', f => f.getAttribute('action') === '/catalogo/' && f.querySelector('input').name === 'q'), 'menu do celular tem a busca no catálogo (/catalogo/?q=)');
  ok(broken.length === 0, `${links.length} links internos respondem 200${broken.length ? ' — quebrados: ' + broken.join(', ') : ''}`);
  await page.evaluate(() => localStorage.setItem('tama-consent', 'denied'));   // o aviso de cookies (testado adiante) cobriria o fim do menu no celular
  await page.reload({ waitUntil: 'networkidle0' });
  await page.click('#menu-btn');
  ok(await page.$eval('#site-nav', n => n.classList.contains('is-open')), 'menu mobile abre');
  await page.click('[aria-controls="sub-brindes"]');
  ok(await page.$eval('[aria-controls="sub-brindes"]', b => b.getAttribute('aria-expanded') === 'true') && await page.$eval('#sub-brindes', d => getComputedStyle(d).display !== 'none' && d.querySelectorAll('.nav-col-tipos .nav-list a').length >= 12), 'no celular, Brindes abre em acordeão com os tipos de brinde e as páginas de brindes');
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

  console.log('Home (redesenho de 11/2026)');
  {
    const home = await (await fetch(BASE + '/')).text(), redir = await (await fetch(BASE + '/_redirects')).text();
    const ordem = ['class="ms-hero', 'class="tm-assure', 'class="section tm-gallery', 'class="section tm-fronts', 'class="section ivory tm-kits2', 'process-section', 'class="t-faq', 'class="site-footer fp'].map(k => home.indexOf(k));
    ok(ordem.every((p, i) => p > 0 && (i === 0 || p > ordem[i - 1])) && !/name="robots" content="noindex/.test(home)
      && (home.match(/class="tm-front[ "]/g) || []).length === 5 && (home.match(/<details class="t-faq-item"/g) || []).length === 6 && (home.match(/class="process-step"/g) || []).length === 6,
      'home: abertura em cenas, garantias, galeria de coleções, 5 frentes, kits, processo em 6 passos, 6 perguntas (com leituras) e chamada final, nessa ordem');
    ok(/^\/v2\/\s+\/\s+301/m.test(redir), '/v2/ (endereço da proposta) redireciona para a home');
    // vídeo do banner (src/video/banner-kit.*): só na temporada, por cima da foto, com pôster e sem som
    const temVideo = (await fetch(BASE + '/')).ok && home.includes('class="t-hero-video"');
    // o banner em vídeo é da abertura anterior (t-hero); a home do redesenho abre com a cena do produto (ms-hero), sem vídeo
    if (!home.includes('class="t-hero"')) ok(!temVideo, 'home do redesenho: abertura com a cena do produto, sem o banner em vídeo da home anterior');
    else ok(SEASON === 'fim-de-ano' ? (temVideo && /<video class="t-hero-video" autoplay muted loop playsinline[^>]*poster="\/img\/hero\.[^"]+"/.test(home) && (home.match(/<source src="\/video\/banner-kit\.[a-f0-9]{8}\.(webm|mp4)"/g) || []).length === 2 && home.includes('<picture') && /Vídeo ilustrativo/.test(home)) : !temVideo,
       SEASON === 'fim-de-ano' ? 'banner: vídeo em loop, sem som, com pôster e a foto como reserva (webm e mp4 com hash)' : 'banner fora da temporada: só a foto, sem vídeo');
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
    const hero = await page.evaluate(() => ({ h1s: document.querySelectorAll('h1').length, h1: document.querySelector('.ms-hero h1')?.textContent.replace(/\s+/g, ' ').trim(),
      ctas: [...document.querySelectorAll('.ms-copy .actions a')].map(a => a.getAttribute('href').split('?')[0]), cenas: document.querySelectorAll('.ms-scene').length,
      ativa: [...document.querySelectorAll('.ms-scene')].map(s => s.getAttribute('aria-hidden')).join() }));
    const heroImg = await page.$eval('.ms-scene.is-active img', i => ({ eager: i.loading === 'eager', alta: i.getAttribute('fetchpriority') === 'high', alt: i.alt, w: +i.getAttribute('width'), h: +i.getAttribute('height'), src: i.currentSrc }));
    ok(hero.h1s === 1 && hero.h1 === 'Uma ideia. Muitas formas de marcar.' && hero.ctas.join() === '/solicitar-proposta/,/catalogo/' && hero.cenas === 6 && hero.ativa === 'false,true,true,true,true,true'
      && heroImg.eager && heroImg.alta && heroImg.w > 0 && heroImg.h > 0 && /recorte-garrafa-termica~/.test(heroImg.src) && /^Garrafa térmica na cor /.test(heroImg.alt),
      `home: um único H1, proposta e catálogo, 6 cenas com a garrafa real (recorte) carregada com prioridade e medidas declaradas ("${heroImg.alt}")`);
    // a apresentação respeita movimento reduzido (os testes rodam com reduce): começa pausada
    ok(await page.$eval('[data-ms-stage]', s => s.classList.contains('is-paused')) && !(await page.$('.ms-choice, [data-ms-pause]')), 'home: com movimento reduzido, a apresentação começa pausada; sem fileira de botões nem play/pause');
    const coresIniciais = await page.$$eval('.ms-scene img', i => i.map(x => x.alt.match(/na cor (.+?), com/)?.[1]));
    ok(coresIniciais.length === 6 && new Set(coresIniciais).size === 6, `home: cada peça abre numa cor diferente (${coresIniciais.join(', ')})`);
    // troca de cor da garrafa: foto real da cor, botão marcado, texto alternativo e link do produto
    const cores = await page.$$eval('[data-ms-swatches="0"] button', b => b.map(x => x.dataset.cor));
    const alvo = cores.find(c => c !== cores[0]);
    await page.click(`[data-ms-swatches="0"] button[data-cor="${alvo}"]`); await sleep(400);
    const depois = await page.evaluate(() => ({ src: document.querySelector('.ms-garrafa img').currentSrc, alt: document.querySelector('.ms-garrafa img').alt,
      pressed: [...document.querySelectorAll('[data-ms-swatches="0"] button[aria-pressed="true"]')].map(b => b.dataset.cor), link: document.querySelector('[data-ms-link]').getAttribute('href') }));
    const slugAlvo = alvo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    ok(cores.length >= 4 && depois.pressed.join() === alvo && depois.src.includes(`garrafa-termica~${slugAlvo}`) && depois.alt.includes(alvo.toLowerCase()) && depois.link === `/catalogo/garrafa-termica/?cor=${slugAlvo}`,
      `home: escolher ${alvo} troca a foto pela foto real dessa cor, o botão marcado, o texto alternativo e o link do produto (${cores.length} cores)`);
    ok(await page.$$eval('.tm-fronts-grid .tm-front-a', a => a.map(x => x.getAttribute('href')).join() === '/brindes-corporativos/,/confeccoes-personalizadas/,/kits-corporativos/,/eventos-corporativos/,/hotelaria-e-gastronomia/'),
       'home apresenta as cinco áreas (brindes, confecções, kits, eventos, hotelaria)');
    const gal = await page.evaluate(() => ({ itens: [...document.querySelectorAll('.tm-strip-a')].map(a => a.getAttribute('href')), recortes: document.querySelectorAll('.tm-strips img[src*="/recorte-"]').length,
      fotos: [...document.querySelectorAll('.tm-strip-img')].filter(i => /\/img\/(blog-capa|galeria)-/.test(i.currentSrc || i.src)).length, abertas: document.querySelectorAll('.tm-strip[data-on]').length,
      nomes: [...document.querySelectorAll('.tm-strip-name')].map(n => n.textContent) }));
    ok(gal.itens.length >= 5 && gal.itens.every(h => /^\/catalogo\/\?categoria=[a-z-]+#catalogo$/.test(h)) && gal.recortes === 0 && gal.fotos >= 5 && gal.abertas === 1 && gal.nomes.every(Boolean),
      `home: galeria de coleções em faixas com ${gal.itens.length} categorias (fotos ambientadas, sem repetir os recortes da abertura), uma aberta, levando ao catálogo filtrado`);
    const fr = await page.evaluate(() => ({ arcos: document.querySelectorAll('.tm-fronts-grid .tm-front-media img').length, pontos: document.querySelectorAll('.tm-front-dot').length,
      linha: getComputedStyle(document.querySelector('.tm-front-frame'), '::before').transform, cta: document.querySelector('.tm-fronts-foot a')?.getAttribute('href') }));
    ok(fr.arcos === 5 && fr.pontos === 5 && (fr.linha === 'none' || fr.linha === 'matrix(1, 0, 0, 1, 0, 0)') && fr.cta === '/solicitar-proposta/', 'home: cinco frentes em arcos com a linha que atravessa já desenhada (reduzir movimento), um ponto por frente e o pedido de proposta no rodapé da seção');
    await page.focus('.tm-strip:nth-child(3) .tm-strip-a'); await sleep(200);
    ok(await page.$$eval('.tm-strip', l => l.map(x => x.hasAttribute('data-on')).join() === l.map((x, i) => i === 2).join()), 'home: a faixa em foco (teclado) abre e as outras fecham');
    ok(await page.$$eval('.tm-kit-a', a => a.length >= 1 && a.length <= 3 && a.every(x => /^\/solicitar-proposta\/\?tipo=kits&interesse=/.test(x.getAttribute('href')) && x.querySelector('img')?.alt.length > 20)) && !(await page.$('.tm-products')),
       'home: até 3 kits soltos, cada um levando ao pedido com o kit como interesse; sem a grade densa de produtos');
    for (const w of [320, 360, 390, 768, 1024, 1180, 1440]) {
      await page.setViewport({ width: w, height: 900 });
      ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `home sem rolagem horizontal em ${w} px`);
    }
    await page.setViewport({ width: 1280, height: 900 });
  }
  console.log('Vitrine, cores e seleção');
  // a vitrine das 21 peças fica na curadoria; a home mostra os destaques em estúdio claro
  await page.goto(BASE + '/brindes-por-ocasiao/', { waitUntil: 'networkidle0' });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('tama-consent', 'denied'); });
  await page.reload({ waitUntil: 'networkidle0' });
  const G = '#gift-grid';
  // 12 peças por vez: "Ver mais" até a garrafa térmica aparecer
  for (let i = 0; i < 20 && await page.$eval(`${G} .product[data-slug="garrafa-termica"]`, el => el.classList.contains('cat-fora')); i++) await page.click('[data-gift-mais]');
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
  // visible: peças que passam no filtro (as além das 12 primeiras ficam para o "Ver mais", mas contam)
  const visible = () => page.$$eval('#gift-grid .product, #idea-grid .idea', g => g.filter(x => !x.hidden).length);
  const totalOcc = await page.$$eval('#gift-grid .product', g => g.length);
  ok(totalOcc >= 20 && await visible() === totalOcc, `todas as peças por ocasião passam sem filtro (${totalOcc})`);
  const naTela = () => page.$$eval('#gift-grid .product', g => g.filter(x => !x.hidden && getComputedStyle(x).display !== 'none').length);
  ok(await naTela() === 12 && await page.$eval('[data-gift-mais-box]', b => !b.hidden && /de \d+ peças/.test(b.textContent)), 'por ocasião: 12 peças na tela e "Ver mais" com o total');
  await page.click('[data-gift-mais]');
  ok(await naTela() === Math.min(24, totalOcc), `"Ver mais" mostra mais 12 (${Math.min(24, totalOcc)})`);
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
  if (nModelos !== 190) console.log('  ! o site testado parece gerado com os dados reais: gere com TAMA_DADOS=tests/fixtures/dados python build.py');
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
  ok(await page.$$eval('.pdp-steps > li', l => l.length === 3) && await page.$$eval('#pdp-ocasiao option', o => o.length === 6), 'página do modelo: passos cor, ocasião (5 opções, sem reconhecimento e lançamentos) e quantidade');
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
  const TIPOS_BRINDE = ['agendas', 'cadernos', 'canetas', 'canecas', 'copos', 'xicaras', 'tacas', 'squeezes', 'garrafas', 'porta-vinho', 'mochilas', 'ecobags'];
  // tipos desdobrados no menu (pedido de 02/11): cada um filtra só o seu tipo de peça (data-tipo do card = chave do link)
  for (const [k, rx] of [['agendas', /^agendas?\b/], ['cadernos', /^(caderno|caderneta|bloco)s?\b/], ['squeezes', /^squeezes?\b/], ['garrafas', /^garrafas?\b/], ['mochilas', /^mochilas?\b/], ['ecobags', /^(ecobags?|sacola-de-alca-longa)\b/]]) {
    await page.goto(BASE + `/catalogo/?tipo=${k}`, { waitUntil: 'networkidle0' });
    const t = await page.$$eval('#catalogo-grid .product', (g, k) => ({ n: g.filter(x => !x.hidden).length, e: g.filter(x => x.dataset.tipo === k).length, fora: g.filter(x => !x.hidden && x.dataset.tipo !== k).length, nomes: g.filter(x => x.dataset.tipo === k).map(x => x.dataset.slug) }), k);
    ok(t.n >= 1 && t.n === t.e && t.fora === 0 && t.nomes.every(n => rx.test(n)) && await page.$eval(`#cat-filtros input[name="tipo"][value="${k}"]`, i => i.checked), `?tipo=${k} mostra só ${k} (${t.e}: ${t.nomes.slice(0, 3).join(', ')}…)`);
  }
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
  // os tipos do menu têm modelo no catálogo; sem modelo, só os 12 tipos de brinde que esperam as fotos dos modelos novos
  const menuTipos = await page.$$eval('#sub-brindes .nav-col-tipos a, #sub-confeccoes .nav-col-conf a', a => a.map(x => new URL(x.href).searchParams.get('tipo')));
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
  const occSide = await page.$$eval('#cat-filtros details.cat-grp', fs => {
    const f = fs.find(x => x.querySelector('summary').textContent.trim() === 'Ocasião');
    const r = f ? [...f.querySelectorAll('input[name="ocasiao"]')] : [];
    const cards = [...document.querySelectorAll('#catalogo-grid .product')];
    return { ordem: fs.map(x => x.querySelector('summary').textContent.trim()).join(), vals: r.map(i => i.value).join(), todas: !!r[0] && r[0].value === '' && r[0].checked && r[0].parentNode.querySelector('span').textContent === 'Todas',
      contagem: r.slice(1).every(i => +i.parentNode.querySelector('small').textContent === cards.filter(c => (c.dataset.occ || '').split(' ').includes(i.value)).length && cards.length > 0) };
  });
  ok(occSide.ordem === 'Categoria,Tipo de peça,Ocasião,Cor' && occSide.vals.split(',').length === 6 && !/reconhecimento|lancamentos/.test(occSide.vals) && occSide.vals.startsWith(',fim-de-ano,') && occSide.todas && occSide.contagem, `filtro lateral tem Ocasião (Todas + 5, Fim de ano primeiro, sem reconhecimento e lançamentos) com a contagem dos cards (${occSide.vals})`);
  // o grupo Ocasião abre recolhido: o visitante abre pelo título antes de marcar
  ok(await page.$eval('#cat-filtros details[data-cat-grp="ocasiao"]', d => !d.open), 'grupo Ocasião começa recolhido (sem filtro ativo)');
  await page.click('#cat-filtros details[data-cat-grp="ocasiao"] summary'); await sleep(150);
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
  // /kits-corporativos/: grade única (cada kit uma vez) com filtro por contexto; as âncoras dos 6 contextos (usadas no
  // menu) continuam e abrem a grade já filtrada. Os kits novos só aparecem quando a foto existe em img/v2/.
  const KIT_TIPOS = { 'kits-escritorio': ['kit-escritorio', 'kit-pratico'], 'kits-cozinha': ['kit-cozinha', 'mesa-de-descobertas', 'gelato-experience', 'kit-petiscos'], 'kits-boas-vindas': ['kit-boas-vindas-tech', 'kit-conectado', 'kit-pratico'], 'kits-executivo': ['kit-executivo-verde', 'em-movimento'], 'kits-pausa': ['pausa-e-inspiracao', 'kit-cafe'], 'kits-fim-de-ano': ['kit-brinde', 'kit-coquetel', 'kit-caipirinha', 'kit-gin', 'kit-vinho', 'kit-agradecimento'] };
  const KITS_NOVOS = ['kit-boas-vindas-tech', 'kit-cozinha', 'kit-agradecimento', 'kit-caipirinha', 'kit-gin', 'kit-vinho'];
  const grade = await page.evaluate(() => ({
    ancoras: [...document.querySelectorAll('.kits-grade [data-kit-ancora]')].map(a => [a.id, a.dataset.kitAncora]),
    chips: [...document.querySelectorAll('[data-kit-filtro]')].map(c => c.dataset.kitFiltro),
    cards: [...document.querySelectorAll('.kit-grid-unica .kit-card')].map(k => ({ slug: k.querySelector('a[data-track-label^="kit-"]')?.dataset.trackLabel.slice(4), ctx: k.dataset.ctx.split(' '), h: k.querySelector('h3').textContent })),
    secoesAntigas: document.querySelectorAll('.kits-tipo').length, catalogo: document.querySelectorAll('.studio-grid').length,
  }));
  const slugsGrade = grade.cards.map(c => c.slug);
  ok(Object.keys(KIT_TIPOS).every(id => grade.ancoras.some(([a, d]) => a === id && d === id)) && grade.ancoras.some(([a, d]) => a === 'kits-agradecimento' && d === 'kits-fim-de-ano')
    && grade.chips[0] === '' && grade.secoesAntigas === 0 && grade.catalogo === 0 && new Set(slugsGrade).size === slugsGrade.length,
    `kits: grade única sem repetição (${slugsGrade.length} kits), filtro "Todos" + contextos, âncoras dos 6 contextos e a antiga #kits-agradecimento (→ fim de ano)`);
  ok(Object.entries(KIT_TIPOS).every(([id, slugs]) => grade.cards.filter(c => c.ctx.includes(id)).every(c => slugs.includes(c.slug)) && slugs.every(s => KITS_NOVOS.includes(s) || grade.cards.some(c => c.slug === s && c.ctx.includes(id))))
    && grade.cards.find(c => c.slug === 'kit-pratico')?.ctx.join() === 'kits-escritorio,kits-boas-vindas',
    'kits: cada kit marcado com os seus contextos; o Kit Prático aparece uma vez, em escritório e boas-vindas; só kit novo sem foto pode faltar');
  const novosNaPagina = KITS_NOVOS.filter(s => slugsGrade.includes(s));
  console.log(`  · kits novos com foto: ${novosNaPagina.length} de ${KITS_NOVOS.length}${novosNaPagina.length < KITS_NOVOS.length ? ' (os demais aguardam a foto em img/v2/)' : ''}`);
  await page.click('[data-kit-filtro="kits-cozinha"]'); await sleep(150);
  const filtrado = await page.evaluate(() => ({ vis: [...document.querySelectorAll('.kit-grid-unica .kit-card')].filter(k => !k.hidden).map(k => k.dataset.ctx), hash: location.hash, status: document.querySelector('[data-kit-status]').textContent }));
  ok(filtrado.vis.length > 0 && filtrado.vis.every(c => c.split(' ').includes('kits-cozinha')) && filtrado.hash === '#kits-cozinha' && new RegExp('^' + filtrado.vis.length + ' kits?$').test(filtrado.status),
    `kits: o filtro Kit cozinha mostra só os kits de cozinha (${filtrado.vis.length}), grava #kits-cozinha e avisa o total`);
  await page.goto(BASE + '/kits-corporativos/#kits-agradecimento', { waitUntil: 'networkidle0' }); await sleep(150);
  ok(await page.evaluate(() => document.querySelector('[data-kit-filtro][aria-pressed="true"]')?.dataset.kitFiltro === 'kits-fim-de-ano' && [...document.querySelectorAll('.kit-grid-unica .kit-card')].filter(k => !k.hidden).every(k => k.dataset.ctx.includes('kits-fim-de-ano'))),
    'kits: o link antigo #kits-agradecimento abre a grade filtrada em Kit fim de ano');
  await page.goto(BASE + '/kits-corporativos/', { waitUntil: 'networkidle0' });
  await page.$eval('.kit-grid-unica', e => e.scrollIntoView()); await page.$$eval('.kit-grid-unica img', i => Promise.all(i.map(x => { x.loading = 'eager'; return x.complete ? 0 : new Promise(r => { x.onload = x.onerror = r; }); })));
  const kitsPag = await page.$$eval('.kit-grid-unica .kit-card', k => k.map(x => { const im = x.querySelector('img'); return { n: x.querySelector('.eyebrow').textContent, h: x.querySelector('h3').textContent, img: im.currentSrc || im.src, ok: im.complete && im.naturalWidth > 0, alt: im.alt, href: x.querySelector('a').getAttribute('href') }; }));
  ok(kitsPag.length >= 9 && kitsPag.every(k => k.ok && /\/img\/(kitp-[a-z-]+?(-v[23])?|kits-header-v3)\./.test(k.img) && k.alt.length > 30 && !/mercedes|apple|airpods|agrocete|rc business|bayer|loja agro|alibaba|bambu|inox|madeira|couro|kraft/i.test(k.alt) && k.href === '/solicitar-proposta/?tipo=kits&interesse=' + encodeURIComponent(/^Kit /.test(k.h) ? k.h : 'Kit ' + k.h) && !/^Kit \d+$/.test(k.n)),
     `kits: ${kitsPag.length} cards com foto carregada, contexto no lugar do número, texto alternativo sem marcas de terceiros nem material afirmado e "Solicitar proposta deste kit" com o interesse`);
  ok(kitsPag.filter(k => ['Kit Boas-vindas Conectado', 'Kit Cozinha', 'Kit de Agradecimento', 'Kit Caipirinha', 'Kit Gin', 'Kit Vinho'].includes(k.h)).every(k => /Marca fictícia (Lume|Brasa|Aura|Vila|Noa|Terra); caixa /.test(k.alt)) && kitsPag.filter(k => /^Kit (Caipirinha|Gin|Vinho)$/.test(k.h)).every(k => /Sem bebida/.test(k.alt)),
     'kits novos: texto alternativo com a marca fictícia e a cor da caixa; os de drinque e de vinho dizem "sem bebida"');
  const fotosV3 = kitsPag.filter(k => /^(Gelato Experience|Mesa de Descobertas)$/.test(k.h));
  ok(fotosV3.every(k => /kitp-(gelato-experience|mesa-de-descobertas)-v[23]\./.test(k.img) && /Marca fictícia (Nexo|Elo)/.test(k.alt)), `kits: Gelato Experience (Nexo) e Mesa de Descobertas (Elo), quando no site, com a foto nova ou a v2 (${fotosV3.map(k => k.img.match(/-v\d/)?.[0]).join(' ') || 'fora do site'})`);
  ok(!(await page.$('#tipos-t')) && !(await page.evaluate(() => document.body.textContent.includes('Um kit para cada relação'))), 'kits: sem a seção repetida "Um kit para cada relação"');
  ok(!(await page.$('#rail-kits')) && await page.$eval('#comp-t', h => { const next = h.closest('section').nextElementSibling; return next && next.matches('.process-strip'); }), 'kits: depois de "Três camadas" vem a faixa compacta do passo a passo (sem o bloco de peças)');
  // menu na ordem do site publicado (build.py: nav_menu): Brindes ▾, Kits ▾, Confecções ▾, Eventos corporativos ▾, Sobre e Blog
  ok(await page.$$eval('#site-nav .nav-links > .nav-link, #site-nav .nav-links > .nav-group > .nav-toggle', a => a.map(x => x.textContent.trim()).join()) === 'Brindes,Kits,Confecções,Eventos corporativos,Sobre,Blog', 'menu com Brindes, Kits, Confecções, Eventos corporativos, Sobre e Blog (como no site publicado)');
  const menuP = await page.evaluate(() => {
    const hrefs = sel => [...document.querySelectorAll(sel)].map(a => a.getAttribute('href'));
    return { tipos: hrefs('#sub-brindes .nav-col-tipos a'), fotos: document.querySelectorAll('#site-nav img').length,
      mais: hrefs('#sub-brindes .nav-col-mais a'), all: hrefs('#sub-brindes .nav-sub-all'), conf: hrefs('#sub-confeccoes .nav-col-conf a'), confAll: hrefs('#sub-confeccoes .nav-sub-all'),
      kits: hrefs('#sub-kits .nav-list a'), kitsAll: hrefs('#sub-kits .nav-sub-all'), ev: hrefs('#sub-eventos a'), blog: hrefs('#site-nav .nav-links > a.nav-link'),
      fim: document.querySelector('#sub-brindes a[href="/brindes-de-fim-de-ano/"]')?.textContent.replace(/\s+/g, ' ').trim() || '' };
  });
  const tipoHref = h => /^\/catalogo\/\?tipo=[a-z-]+#catalogo$/.test(h);
  ok(menuP.tipos.length >= 12 && menuP.tipos.every(tipoHref) && TIPOS_BRINDE.concat('tecnologia').filter(k => menuP.tipos.includes(`/catalogo/?tipo=${k}#catalogo`)).length >= 12 && menuP.fotos === 0,
     `menu Brindes: tipos de brinde (e Tecnologia) levando ao catálogo filtrado, sem fotos (${menuP.tipos.length} tipos)`);
  ok(menuP.mais.join() === '/brindes-corporativos/,/hotelaria-e-gastronomia/,/brindes-por-ocasiao/,/brindes-de-fim-de-ano/' && menuP.all.join() === '/catalogo/' && (SEASON === 'fim-de-ano' ? menuP.fim === 'Fim de ano temporada' : menuP.fim === 'Fim de ano'),
     'menu Brindes: Brindes corporativos, Hotelaria, Por ocasião, Fim de ano (destaque na temporada) e "Catálogo completo"');
  ok(menuP.kits.length === 6 && menuP.kits.join() === ['escritorio', 'cozinha', 'boas-vindas', 'executivo', 'pausa', 'fim-de-ano'].map(k => '/kits-corporativos/#kits-' + k).join() && menuP.kitsAll.join() === '/kits-corporativos/',
     'menu Kits: 6 links de tipo de kit (âncoras de /kits-corporativos/) e "Ver todos os kits"');
  ok(menuP.conf.length >= 7 && menuP.conf.every(tipoHref) && menuP.confAll.join() === '/confeccoes-personalizadas/', `menu Confecções: ${menuP.conf.length} peças de vestuário e "Uniformes e confecções"`);
  ok(menuP.ev.join() === '/eventos-corporativos/#fmt-buffet,/eventos-corporativos/' && menuP.blog.join() === '/sobre/,/blog/', 'menu Eventos corporativos (Buffet e decoração e a página) e os links Sobre e Blog');
  const semAncora = [];
  for (const [u, hs] of [['/kits-corporativos/', menuP.kits], ['/eventos-corporativos/', menuP.ev.filter(h => h.includes('#'))]]) { const html = await (await fetch(BASE + u)).text(); hs.forEach(h => { if (!html.includes(`id="${h.split('#')[1]}"`)) semAncora.push(h); }); }
  ok(semAncora.length === 0, `os links do painel Kits caem em âncoras que existem${semAncora.length ? ' — faltam: ' + semAncora.join(', ') : ''}`);
  // página certa marcada: o botão do grupo com aria-current="true" e o link da página com aria-current="page"
  const navAtual = u => page.evaluate(async u => { const d = new DOMParser().parseFromString(await (await fetch(u)).text(), 'text/html'); return [...d.querySelectorAll('#site-nav [aria-current]')].map(x => x.getAttribute('aria-controls') || x.getAttribute('href')).join(); }, BASE + u);
  const atuais = { '/kits-corporativos/': 'sub-kits,/kits-corporativos/', '/confeccoes-personalizadas/': 'sub-confeccoes,/confeccoes-personalizadas/', '/catalogo/polo-masculina/': 'sub-brindes',
    '/catalogo/caneca/': 'sub-brindes', '/catalogo/': 'sub-brindes,/catalogo/', '/brindes-corporativos/': 'sub-brindes,/brindes-corporativos/', '/hotelaria-e-gastronomia/': 'sub-brindes,/hotelaria-e-gastronomia/',
    '/brindes-de-fim-de-ano/': 'sub-brindes,/brindes-de-fim-de-ano/', '/eventos-corporativos/': 'sub-eventos,/eventos-corporativos/', '/blog/': '/blog/', '/sobre/': '/sobre/', '/': '' };
  const marcaErrada = [];
  for (const [u, esperado] of Object.entries(atuais)) { const r = await navAtual(u); if (r !== esperado) marcaErrada.push(`${u} → ${r || 'nada'}`); }
  ok(marcaErrada.length === 0, `o menu marca (aria-current) o grupo e o link da página certa${marcaErrada.length ? ' — ' + marcaErrada.join('; ') : ''}`);
  // computador: os quatro painéis (Brindes, Kits, Confecções, Eventos) abrem inteiros na tela e legíveis de 1024 a 1440 px
  for (const [w, h] of [[1024, 768], [1440, 900]]) {
    await page.setViewport({ width: w, height: h }); await page.evaluate(() => scrollTo(0, 0)); await sleep(100);
    const fora = [];
    for (const k of ['brindes', 'kits', 'confeccoes', 'eventos']) {
      await page.click(`[aria-controls="sub-${k}"]`); await sleep(100);
      const r = await page.$eval(`#sub-${k}`, d => { const b = d.getBoundingClientRect(), as = [...d.querySelectorAll('a')];
        return { vis: getComputedStyle(d).display !== 'none' && b.height > 0, l: Math.round(b.left), r: Math.round(b.right), b: Math.round(b.bottom),
          leg: as.every(a => parseFloat(getComputedStyle(a).fontSize) >= 14 && a.scrollWidth <= a.clientWidth + 1 && a.getBoundingClientRect().right <= b.right + 1) }; });
      if (!r.vis || r.l < 0 || r.r > w || r.b > h || !r.leg) fora.push(`${k} ${JSON.stringify(r)}`);
      await page.keyboard.press('Escape'); await sleep(50);
    }
    ok(fora.length === 0 && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${w} px: os quatro painéis do menu abrem inteiros na tela e legíveis${fora.length ? ' — ' + fora.join('; ') : ''}`);
  }
  await page.setViewport({ width: 1280, height: 900 });
  // busca: botão de lupa abre o campo, o foco vai para ele e Esc devolve o foco ao botão
  await page.click('[aria-controls="sub-busca"]'); await sleep(150);
  ok(await page.evaluate(() => document.activeElement?.id === 'busca-topo') && await page.$eval('.header-row .head-search', f => f.getAttribute('action') === '/catalogo/' && f.querySelector('input[name="q"]')), 'busca do cabeçalho: abre pela lupa com o foco no campo (/catalogo/?q=)');
  await page.keyboard.press('Escape');
  ok(await page.$eval('[aria-controls="sub-busca"]', b => b.getAttribute('aria-expanded') === 'false' && document.activeElement === b), 'busca do cabeçalho: Esc fecha e devolve o foco à lupa');
  ok(await page.$$eval('.site-footer .footer-links a', a => a.map(x => x.textContent.trim()).join() === 'Catálogo completo,Kits corporativos,Eventos corporativos,Hotelaria e gastronomia,Sobre a TaMa') && await page.$eval('.site-footer .fp-actions a[href^="/solicitar-proposta/"]', a => /Solicitar proposta/.test(a.textContent)), 'rodapé premium: convite com "Solicitar proposta" e os cinco links de Explore');
  ok(await page.$$eval('.foto-hero figcaption, .entrega-foto figcaption', f => f.length >= 1 && f.every(x => x.textContent === 'Imagem ilustrativa • Marca fictícia')) && await page.$$eval('.kits-grade .note', n => n.length === 1 && /^Imagens? ilustrativas?: (a marca TaMa e marcas fictícias aparecem|a marca (TaMa aparece|é fictícia e aparece)) como exemplo; no seu projeto, entra a marca da sua empresa\./.test(n[0].textContent)), 'kits: legenda padrão da marca fictícia no cabeçalho e uma nota padrão (marca TaMa e marcas fictícias como exemplo) depois da grade de kits');
  ok(await page.$$eval('a[href^="/branding-identidade-visual/"], a[href^="/projetos/"]', a => a.length === 0), 'nenhum link para branding ou projetos');
  await page.goto(BASE + '/confeccoes-personalizadas/', { waitUntil: 'networkidle0' });
  ok(await page.$$eval('.studio-grid .product.studio', c => c.length === 10) && await page.$eval('.studio-grid', g => !!g.closest('section').querySelector('a[href="/catalogo/?categoria=vestuario"]')), 'confecções: 10 peças em estúdio com link para o catálogo filtrado');
  ok(await page.$$eval('h1', h => h.length === 1 && /A identidade da sua marca também se veste/.test(h[0].textContent.replace(/\s+/g, ' '))) && await page.$eval('.foto-hero-photo img', i => i.loading === 'eager' && i.alt.length > 40) && await page.$$eval('.atalhos-list a', a => a.length === 6 && a.every(x => /^\/catalogo\/\?tipo=(polos|camisetas|camisas|moletons|aventais|dolmas)#catalogo$/.test(x.getAttribute('href')))), 'confecções abre com a foto da equipe, um único H1 e os 6 atalhos para os tipos de peça no catálogo');
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
  for (let i = 0; i < 20 && await page.$eval('#gift-grid .product[data-slug="taca-de-gin"]', el => el.classList.contains('cat-fora')); i++) await page.click('[data-gift-mais]');
  await page.$eval('#gift-grid .pick[data-slug="taca-de-gin"]', el => el.scrollIntoView({ block: 'center' }));
  await page.click('#gift-grid .pick[data-slug="taca-de-gin"]');

  {
    const formatos = [];
    for (const pg of ['brindes-corporativos', 'confeccoes-personalizadas', 'eventos-corporativos', 'hotelaria-e-gastronomia', 'brindes-de-fim-de-ano']) {
      const h = await (await fetch(BASE + '/' + pg + '/')).text();
      const m = h.match(/<section class="(atalhos[^"]*)"[\s\S]*?<\/section>/);
      const itens = m ? (m[0].match(/<li>/g) || []).length : 0, icones = m ? (m[0].match(/<svg viewBox="0 0 24 24"/g) || []).length : 0;
      formatos.push(`${pg}:${m ? m[1] : 'sem'}:${itens}:${icones}`);
    }
    ok(formatos.every(f => { const [, cls, n, ic] = f.split(':'); return cls === 'atalhos sem-linha' && +n >= 3 && +ic === +n; }),
       `atalhos no mesmo formato em todas as páginas de frente, sempre com ícone (${formatos.join(' | ')})`);
  }
  console.log('Processo (Do briefing à entrega)');
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  const proc = await page.$eval('section.process-section', s => ({
    steps: [...s.querySelectorAll('.process-step h3')].map(h => h.textContent.trim()),
    decor: [...s.querySelectorAll('.process-num')].map(e => e.getAttribute('aria-hidden')),
  }));
  ok(proc.steps.join(',') === 'Briefing,Curadoria,Proposta,Aprovação,Produção,Entrega', 'home mostra as 6 etapas, com ícones, na faixa escura');
  ok(proc.decor.length === 6 && proc.decor.every(v => v === 'true'), 'números das etapas são decorativos (aria-hidden)');
  // Seção padrão (process_section): as mesmas 6 etapas, com os mesmos nomes e na mesma ordem, em todas as páginas de frente,
  // no fim de ano e em /sobre/; nada do formato antigo (ol.steps com 4 etapas) pode sobrar.
  const ETAPAS = 'Briefing,Curadoria,Proposta,Aprovação,Produção,Entrega';
  // nas páginas de frente e em kits, a versão compacta (as 6 etapas numa linha, com link para o Sobre); completa só na home, no fim de ano e no Sobre
  for (const path of ['/brindes-corporativos/', '/kits-corporativos/', '/confeccoes-personalizadas/', '/eventos-corporativos/', '/hotelaria-e-gastronomia/']) {
    await page.goto(BASE + path, { waitUntil: 'networkidle0' });
    const c = await page.evaluate(() => ({ cheia: document.querySelectorAll('section.process-section').length, nomes: [...document.querySelectorAll('.process-strip .process-line li')].map(l => l.textContent.replace(/^\d+/, '').trim()).join(','),
      link: document.querySelector('.process-strip a[href="/sobre/#como-t"]') !== null,
      antesFaq: (() => { const s = document.querySelector('.process-strip'); let n = s?.nextElementSibling; while (n && !n.matches('section')) n = n.nextElementSibling; return !!n?.querySelector('.faq-list'); })() }));
    ok(c.cheia === 0 && c.nomes === ETAPAS && c.link && c.antesFaq, `${path}: passo a passo compacto (6 etapas na mesma ordem, link "Como trabalhamos"), logo antes das perguntas`);
  }
  for (const path of ['/brindes-de-fim-de-ano/', '/sobre/']) {
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
  ok(await page.$eval('input[name="tipo"][value="ativacoes"]', i => i.parentNode.textContent.trim() === 'Eventos corporativos: buffet, decoração e ações'), 'tipo Ativações cita "buffet ou decoração para evento" (a chave continua ativacoes)');
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
  // "Solicitar proposta só desta peça": a seleção não segue junto, a não ser que a pessoa peça; objetivo é opcional
  {
    const sp = await browser.newPage();
    await sp.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await sp.goto(BASE + '/catalogo/caneca/', { waitUntil: 'networkidle0' });
    ok(await sp.$eval('[data-pdp-proposta]', a => /[?&]so=1(&|$)/.test(a.getAttribute('href'))), 'produto: "Solicitar proposta só desta peça" marca o pedido como de uma peça só (so=1)');
    await sp.evaluate(() => { localStorage.setItem('tama-consent', 'denied'); localStorage.setItem('tama-selecao', JSON.stringify([{ s: 'caneca', c: 'Vermelho' }, { s: 'garrafa-termica', c: 'Azul royal' }])); });
    await sp.goto(BASE + '/solicitar-proposta/?tipo=brindes&so=1&interesse=' + encodeURIComponent('Caneca (Vermelho)'), { waitUntil: 'networkidle0' });
    const antes = await sp.evaluate(() => ({ sel: document.getElementById('f-selecao').value, lista: document.getElementById('picked-wrap').hidden, inc: !document.getElementById('so-peca-incluir').hidden, n: document.querySelector('[data-incluir-n]').textContent }));
    ok(antes.sel === '' && antes.lista && antes.inc && antes.n === '2 peças', 'formulário de uma peça: a seleção (2 peças) não vai junto e há o botão para incluí-la');
    await sp.click('[data-incluir-selecao]'); await sleep(100);
    ok(await sp.evaluate(() => document.getElementById('f-selecao').value.includes('Garrafa térmica') && !document.getElementById('picked-wrap').hidden), 'incluir a seleção põe as peças de volta no pedido');
    ok(await sp.$eval('#f-objetivo', t => !t.required) && await sp.$$eval('.field .opt', o => o.length >= 4), 'formulário: objetivo opcional e os campos opcionais sinalizados');
    await sp.close();
  }
  console.log('Frentes novas, seleção antiga e selo');
  const fp = await browser.newPage();
  await fp.setViewport({ width: 1280, height: 900 });
  for (const [path, tipo] of [['/eventos-corporativos/', 'ativacoes'], ['/hotelaria-e-gastronomia/', 'hotelaria']]) {
    await fp.goto(BASE + path, { waitUntil: 'networkidle0' });
    ok(await fp.$$eval('h1', h => h.length === 1) && await fp.$$eval(`a[href="/solicitar-proposta/?tipo=${tipo}"]`, a => a.length >= 2) && await fp.$$eval('.studio-grid .product.studio', c => c.length >= 6),
       `${path}: um H1, CTA com o tipo ${tipo} e peças do catálogo`);
  }
  ok(await fp.$$eval('.studio-grid .product', c => ['cardapio', 'porta-contas', 'dolma', 'avental'].every(s => c.some(x => x.dataset.slug === s))), 'hotelaria reúne cardápio, porta-contas, dólmã e avental da mesma base');
  // eventos: "Buffet e decoração" num bloco só (unificados em 06/11/2026), nos atalhos e nas perguntas; #fmt-decoracao antigo leva ao bloco
  await fp.goto(BASE + '/eventos-corporativos/', { waitUntil: 'networkidle0' });
  const ativ = await fp.evaluate(() => ({
    fmts: ['fmt-degustacao', 'fmt-feiras', 'fmt-promocao', 'fmt-buffet', 'fmt-decoracao'].every(id => document.getElementById(id)?.closest('#formatos')),
    atalhos: [...document.querySelectorAll('.atalhos .atalhos-list a')].map(a => a.getAttribute('href')),
    alvos: [...document.querySelectorAll('.atalhos .atalhos-list a')].every(a => document.querySelector(a.getAttribute('href'))),
    textos: ['fmt-buffet'].map(id => document.querySelector('#' + id + ' p')?.textContent || ''),
    links: ['fmt-buffet'].map(id => document.querySelector('#' + id + ' a')?.getAttribute('href') || ''),
    unificado: document.querySelector('#fmt-buffet h3')?.textContent === 'Buffet e decoração' && !!document.querySelector('#fmt-buffet #fmt-decoracao') && document.querySelectorAll('#formatos .item').length === 5,
    faq: [...document.querySelectorAll('.faq-list details')].some(d => /buffet/i.test(d.textContent) && /decoração/i.test(d.textContent) && /parceiros especializados/.test(d.textContent)),
    cenas: [...document.querySelectorAll('#formatos .ativ-cenas figure')].map(f => [f.querySelector('img')?.alt || '', f.querySelector('figcaption')?.textContent || '']),
  }));
  ok(ativ.fmts && ativ.alvos && ativ.unificado && ['#fmt-promocao', '#fmt-buffet'].every(h => ativ.atalhos.includes(h)) && !ativ.atalhos.includes('#fmt-decoracao'), `eventos: "Buffet e decoração" num bloco só (#fmt-buffet, com a âncora antiga #fmt-decoracao) e nos atalhos, que levam às seções (${ativ.atalhos.join(' ')})`);
  ok(ativ.textos.every(t => /parceiros especializados/.test(t) && !/R\$|\d|pessoas|convidados|cardápio|capacidade/i.test(t)) && ativ.faq, 'ativações: buffet e decoração coordenados com parceiros especializados, sem cardápio, capacidade, número de pessoas nem preço, e citados nas perguntas');
  ok(ativ.cenas.length <= 2 && ativ.cenas.every(([alt, leg]) => /marca fictícia (Solar|Oliva)/.test(alt) && leg === 'Cena ilustrativa · marca fictícia'), `ativações: faixa com as cenas de buffet e decoração (${ativ.cenas.length} de 2 com foto), legenda "Cena ilustrativa · marca fictícia"`);
  const ATIV_EVENTO = '/solicitar-proposta/?tipo=ativacoes&interesse=' + encodeURIComponent('Buffet ou decoração para evento');
  ok(ativ.links.every(h => h === ATIV_EVENTO), 'ativações: buffet e decoração levam ao pedido com tipo=ativacoes e o interesse "Buffet ou decoração para evento"');
  for (const [p, w] of [['/eventos-corporativos/', 320], ['/kits-corporativos/', 320], ['/kits-corporativos/', 1024]]) {
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
  ok(await fp.$$eval('section[aria-labelledby="fim-atalhos-t"] .atalhos-list a', a => a.map(x => x.getAttribute('href')).join() === '#brindar,#kits-fim-de-ano,#personalizacao' && a.every(x => document.querySelector(x.getAttribute('href')))), 'fim de ano: atalhos "Escolha como brindar." levam às seções da página');
  ok(await fp.$$eval('#brindar .product.studio', c => c.length === 8 && c.every(x => (x.dataset.occ || '').split(' ').includes('fim-de-ano'))) && await fp.$eval('#brindar a[href="/catalogo/?ocasiao=fim-de-ano"]', a => /fim de ano no catálogo/.test(a.textContent)), 'fim de ano: 8 taças e copos em #brindar, com link para o catálogo filtrado');
  ok(await fp.$$eval('.kit-card', k => k.length === 8 && k.filter(x => x.classList.contains('big')).length === 2 && k.slice(0, 2).every(x => x.classList.contains('big')) && k.every(x => x.querySelector('img').alt.length > 20)) && await fp.$$eval('.kit-card a', a => a.map(x => x.getAttribute('href')).join() === ['Brinde', 'Coquetel', 'Caipirinha', 'Gin', 'Vinho', 'Caf%C3%A9', 'Petiscos', 'de%20Agradecimento'].map(n => '/solicitar-proposta/?tipo=kits&interesse=Kit%20' + n).join()), 'fim de ano: Kit Brinde, Coquetel, Caipirinha, Gin, Vinho, Café, Petiscos e de Agradecimento (2 em destaque), com "Solicitar proposta deste kit" no pedido');
  ok(await fp.$$eval('.kit-card', k => ['Caipirinha', 'Gin', 'Vinho'].every(n => k.some(x => x.querySelector('h3').textContent === 'Kit ' + n && /Sem bebida/.test(x.textContent)))), 'fim de ano: os kits Caipirinha, Gin e Vinho dizem "Sem bebida" (só acessórios)');
  ok(await fp.$$eval('#presentear .product.studio', c => c.map(x => x.dataset.slug).join() === 'agenda,caneta-executiva-com-estojo,vela,caixa-para-presente'), 'fim de ano: 4 peças em "Para presentear"');
  ok(await fp.$$eval('#personalizacao .process-step', s => s.length === 6) && await fp.$$eval('.faq-list details', d => d.length === 4) && await fp.$$eval('a[href="/solicitar-proposta/?tipo=kits"]', a => a.length >= 2), 'fim de ano: as 6 etapas em #personalizacao, 4 perguntas e CTA final com tipo=kits');
  ok(await colorsHavePhoto(fp, '.studio-grid .product'), 'fim de ano: toda cor mostrada tem foto própria');
  await fp.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await fp.goto(BASE + '/', { waitUntil: 'networkidle0' });
  ok(await fp.$$eval('.tm-fronts-grid .tm-front-a', a => a.map(x => x.getAttribute('href')).join() === '/brindes-corporativos/,/confeccoes-personalizadas/,/kits-corporativos/,/eventos-corporativos/,/hotelaria-e-gastronomia/'), 'home apresenta as cinco áreas da TaMa');
  ok(await fp.$eval('meta[property="og:title"]', m => /brindes, uniformes, kits, eventos corporativos e hotelaria/i.test(m.content)), 'título de compartilhamento da home diz o que a TaMa oferece (as cinco áreas, como na assinatura)');
  ok(await fp.$eval('.site-footer .footer-brand p', p => /^Curadoria de produtos, personalização e soluções/.test(p.textContent)), 'rodapé: frase da TaMa ao lado da assinatura');
  ok(await fp.$$eval('.end-cta', s => s.length === 0) && await fp.$$eval('.site-footer .fp-actions a', a => a.length === 2 && /^Solicitar proposta/.test(a[0].textContent.trim())), 'fechamento: sem a seção "Próximo passo"; o convite fica no rodapé (Solicitar proposta + WhatsApp)');
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
    footer: !!document.querySelector('.site-footer'),
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
  ok(idx.navCurrent === '/blog/' && idx.footer, 'Blog no menu (página atual marcada)');
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
  ok(await bp.evaluate(() => document.querySelectorAll('h1').length === 1 && /Sua marca/.test(document.querySelector('.foto-hero h1').textContent) && /ocasiao-eventos/.test(document.querySelector('.foto-hero-photo img').getAttribute('srcset') || '') && document.querySelectorAll('template[data-occ-hero]').length === 5),
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
    const b = await bp.evaluate(() => { const a = document.querySelector('body > .announce'), h = document.querySelector('body > .site-header'); return h ? [a ? a.querySelector('.announce-season')?.textContent.replace(/\s+/g, ' ').trim() : '', a ? getComputedStyle(a).backgroundColor : '', !!h.querySelector('.brand') && !!h.querySelector('#site-nav') && !!h.querySelector('#menu-btn')].join('§') : null; });
    if (barra === null) barra = b;
    if (b !== barra) diff.push(p);
  }
  ok(barra && (SEASON === 'fim-de-ano' ? barra.startsWith('Fim de ano:') : barra.startsWith('§')) && diff.length === 0, `barra do topo (só na temporada) e cabeçalho iguais em todas as páginas, inclusive no blog${diff.length ? ' — diferem: ' + diff.join(', ') : ''}`);
  await bp.close();

  console.log('Inventário (/admin/inventario/)');
  // A página lê e grava pelo servidor local (tools/admin_local.py, porta 8081). Aqui ele é simulado: getEntry devolve os
  // arquivos do repositório e persistEntry só guarda o que seria gravado (nada é escrito em disco).
  const ip = await browser.newPage();
  await ip.setViewport({ width: 1366, height: 900 });
  await ip.setRequestInterception(true);
  let gravado = null, chamadas = [], janelasDoNavegador = 0;
  ip.on('request', req => {
    if (/:8081\/api\/v1/.test(req.url())) {
      if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST' } });
      const { action, params } = JSON.parse(req.postData() || '{}');
      chamadas.push(action);
      const cors = { 'Access-Control-Allow-Origin': '*' };
      if (action === 'getEntry') {
        const f = params.path.startsWith('src/data/') ? path.join(DADOS, path.basename(params.path)) : path.join(RAIZ, params.path);
        return fs.existsSync(f) ? req.respond({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ file: { path: params.path }, data: fs.readFileSync(f, 'utf8') }) })
          : req.respond({ status: 404, contentType: 'application/json', headers: cors, body: '{}' });
      }
      if (action === 'persistEntry') { gravado = params; return req.respond({ status: 200, contentType: 'application/json', headers: cors, body: '{"message":"ok"}' }); }
    }
    req.continue();
  });
  const invHtml = await (await fetch(BASE + '/admin/inventario/')).text();
  const invOp = await (await fetch(BASE + '/admin/inventario/opcoes.json')).json();
  ok(invHtml.includes('noindex') && !invHtml.includes('"imagens"') && invOp.categorias && invOp.spec_re && Object.keys(invOp.imagens).length > 100 && admHtml.includes('href="/admin/inventario/"'),
     'Inventário ligado ao editor, com noindex, sem dados de produto na página e com as opções do build (categorias, regra de material, miniaturas)');
  await ip.goto(BASE + '/admin/inventario/#resumo', { waitUntil: 'networkidle0' });
  await ip.evaluate(() => localStorage.removeItem('tama-inventario-rascunho'));
  await ip.reload({ waitUntil: 'networkidle0' });
  await ip.waitForSelector('#sec-resumo .kpi');
  // contagens da tela = contagem pelos dados: produto novo (todas as fotos a aprovar), existente com cores novas, fora do site
  const dadosP = JSON.parse(fs.readFileSync(path.join(DADOS, 'produtos.json'), 'utf8')).imagens;
  const grupos = {}; dadosP.forEach(i => (grupos[i.produto] = grupos[i.produto] || []).push(i));
  const vis = i => ['aprovada', 'revisao'].includes(i.aprovacao);
  const esperado = { novos: 0, cores: 0, fora: 0 };
  Object.values(grupos).forEach(g => { const v = g.filter(vis); if (!v.some(i => (i.vista || 'frente') === 'frente')) esperado.fora++; else if (v.every(i => i.aprovacao === 'revisao')) esperado.novos++; else if (v.some(i => i.aprovacao === 'revisao')) esperado.cores++; });
  const kpis = await ip.$$eval('#sec-resumo .kpi b', b => b.map(x => +x.textContent));
  ok(kpis[0] === Object.keys(grupos).length - esperado.fora && kpis[1] === esperado.novos && kpis[2] === esperado.cores,
     `resumo: ${kpis[0]} modelos no site, ${kpis[1]} produtos novos e ${kpis[2]} existentes com cores novas, como nos dados`);
  ok(await ip.$$eval('#sec-resumo tbody tr', r => r.length >= 5 && r.every(t => t.querySelectorAll('td').length === 6)), 'resumo: tabela existentes × novos por categoria');
  await ip.click('[data-tab="produtos"]');
  await ip.click('[data-sit-f="produto-novo"]');
  ok(await ip.$$eval('#sec-produtos .item', c => c.length) === Math.min(esperado.novos, 60) && await ip.$$eval('#sec-produtos .item .tag.novo', t => t.every(x => x.textContent === 'Produto novo')),
     'produtos: filtro "Produtos novos" mostra só os produtos novos');
  // tirar um modelo do site, editar texto e acrescentar uma cor com foto
  await ip.click('[data-sit-f=""]');
  await ip.type('#busca-p', 'Caneca');
  await ip.click('[data-produto="Caneca"]');
  await ip.waitForSelector('#m-tirar');
  ip.on('dialog', d => { janelasDoNavegador++; d.dismiss(); });   // a tela não pode depender de confirm/alert do navegador
  await ip.click('#m-tirar'); await sleep(150);
  const caixa = await ip.$eval('#modal', m => !m.hidden && /Tirar "Caneca" do site\?/.test(m.textContent) && document.activeElement.id === 'conf-ok');
  await ip.click('#conf-ok'); await sleep(150);
  ok(caixa && await ip.$eval('#modal', m => m.hidden) && await ip.$('#m-voltar'), '"Tirar do site" confirma numa caixa da própria página (não depende de janela do navegador) e tira o modelo');
  await ip.$eval('#m-resumo', t => { t.value = 'Resumo de teste.'; t.dispatchEvent(new Event('change')); }); await sleep(150);
  await ip.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = c.height = 1100; const x = c.getContext('2d'); x.fillStyle = '#F6F2EC'; x.fillRect(0, 0, 1100, 1100); x.fillStyle = '#2E8B57'; x.fillRect(300, 250, 500, 620);
    const dt = new DataTransfer(); dt.items.add(new File([await new Promise(r => c.toBlob(r, 'image/png'))], 'cor.png', { type: 'image/png' }));
    const inp = document.getElementById('nc-arq'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));
  });
  await ip.waitForFunction(() => !document.getElementById('nc-ok').disabled);
  await ip.type('#nc-cor', 'Verde teste');
  await ip.click('#nc-ok'); await sleep(200);
  await ip.click('#gaveta-fechar');
  await ip.click('[data-tab="alteracoes"]');
  const mud = await ip.$$eval('.mudancas li', l => l.map(x => x.querySelector('.tag').textContent + ': ' + x.querySelector('p').textContent));
  // as cores antigas saem e a nova entra (como "Novo"): o modelo continua no site, então a linha é "Alterado" com o detalhe
  ok(mud.length === 1 && /^Alterado: Caneca: 1 cor\/foto nova, \d+ cores saem do site, textos e destaques$/.test(mud[0]) && await ip.$eval('#barra-texto', b => b.textContent.startsWith('1 alteração não publicada')),
     `alterações: uma linha para a Caneca com o que entra e o que sai, também na barra do topo (${mud.join(' | ')})`);
  // material no nome com material não confirmado: erro e publicação bloqueada (mesma regra do build)
  await ip.click('[data-tab="produtos"]');
  await ip.click('[data-produto="Caneca"]');
  await ip.waitForSelector('#m-desc');
  await ip.$eval('#m-desc', i => { i.value = 'Clássica de porcelana'; i.dispatchEvent(new Event('change')); }); await sleep(150);
  await ip.click('#gaveta-fechar');
  await ip.click('[data-tab="alteracoes"]');
  ok(await ip.$$eval('.erros li', l => l.some(x => /"porcelana"/.test(x.textContent))) && await ip.$eval('#pub-ok', b => b.disabled), 'material sem confirmação na descrição vira erro e bloqueia a publicação');
  await ip.click('[data-tab="produtos"]');
  await ip.click('[data-produto="Caneca"]');
  await ip.waitForSelector('#m-desc');
  await ip.$eval('#m-desc', i => { i.value = 'Clássica, com alça'; i.dispatchEvent(new Event('change')); }); await sleep(150);
  await ip.click('#gaveta-fechar');
  // kit: tirar do site
  await ip.click('[data-tab="kits"]');
  await ip.click('[data-kit="kit-gin"]');
  await ip.waitForSelector('#k-tirar');
  await ip.click('#k-tirar'); await sleep(150);
  await ip.click('#conf-ok'); await sleep(150);
  await ip.click('#gaveta-fechar');
  await ip.click('[data-tab="alteracoes"]');
  ok(await ip.$$eval('.mudancas li p', l => l.some(x => /Kit sai do site: Kit Gin/.test(x.textContent))) && !(await ip.$('.erros')), 'kits: "Kit sai do site" na lista, sem erros');
  // kit novo: precisa dizer onde aparece (tipo, home ou fim de ano); sem isso, não é criado
  await ip.click('[data-tab="kits"]');
  await ip.click('#novo-kit');
  await ip.waitForSelector('#nk-nome');
  await ip.type('#nk-nome', 'Kit Teste Inventário');
  await ip.type('#nk-desc', 'Caneca, caderno e caneta na caixa com berço.');
  await ip.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 1500; c.height = 1000; const x = c.getContext('2d'); x.fillStyle = '#EEE'; x.fillRect(0, 0, 1500, 1000);
    const dt = new DataTransfer(); dt.items.add(new File([await new Promise(r => c.toBlob(r, 'image/png'))], 'kit.png', { type: 'image/png' }));
    const inp = document.getElementById('nk-arq'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));
  });
  await ip.waitForFunction(() => !document.getElementById('nk-ok').disabled);
  await ip.click('#nk-ok'); await sleep(200);
  const avisoLugar = await ip.$eval('#modal', m => !m.hidden && /Marque onde o kit aparece/.test(m.textContent));
  await ip.click('#conf-ok'); await sleep(100);
  const semLugar = await ip.evaluate(() => window.TAMA_INVENTARIO.estado().ops.some(o => o.t === 'kit_novo'));
  await ip.click('[data-nktipo="kits-escritorio"]');
  await ip.click('#nk-ok'); await sleep(300);
  const kitOps = await ip.evaluate(() => window.TAMA_INVENTARIO.estado().ops.filter(o => /^kit_(novo|lista)$/.test(o.t) && o.slug !== 'kit-gin').map(o => o.t + ':' + (o.ancora || o.lista || '')));
  // slug do kit criado (vem do nome digitado; não depende de como o navegador digita acentos)
  const slugKitNovo = await ip.evaluate(() => (window.TAMA_INVENTARIO.estado().ops.find(o => o.t === 'kit_novo') || {}).kit?.slug || '');
  ok(avisoLugar && !semLugar && kitOps.join() === 'kit_novo:,kit_lista:kits-escritorio' && await ip.$('#k-nome'), `kit novo: sem marcar onde aparece não é criado; com o tipo marcado, entra no Kit escritório (${kitOps.join()})`);
  await ip.click('#gaveta-fechar');
  await ip.click('[data-tab="alteracoes"]');
  // publicar (local): os JSON gravados mantêm o formato do repositório e só mudam o necessário
  await ip.click('#pub-ok');
  await ip.waitForFunction(() => document.getElementById('status').classList.contains('ok'), { timeout: 15000 });
  const arqs = Object.fromEntries((gravado?.entry?.dataFiles || []).map(f => [f.path, f.raw]));
  const assets = (gravado?.entry?.assets || []).map(a => a.path);
  const prodNovo = arqs['src/data/produtos.json'] ? JSON.parse(arqs['src/data/produtos.json']).imagens : [];
  const caneca = prodNovo.filter(i => i.produto === 'Caneca');
  const nova = prodNovo.find(i => i.id === 'caneca~verde-teste');
  const kitsNovo = arqs['src/data/kits.json'] ? JSON.parse(arqs['src/data/kits.json']) : {};
  const origP = fs.readFileSync(path.join(DADOS, 'produtos.json'), 'utf8').split('\n'), novoP = (arqs['src/data/produtos.json'] || '').split('\n');
  ok(caneca.length > 1 && caneca.filter(i => i.id !== 'caneca~verde-teste').every(i => i.aprovacao === 'retirada') && nova && nova.arquivo === '/' + assets[0] && /^img\/produtos\/caneca~verde-teste\.(webp|png)$/.test(assets[0]) && nova.cor.hex && nova.alt,
     `publicar: Caneca sai do site (todas as fotos "retirada") e a cor nova entra com a foto em ${assets[0] || '?'}`);
  ok(arqs['src/data/modelos.json'] && JSON.parse(arqs['src/data/modelos.json']).modelos.find(m => m.produto === 'Caneca').resumo === 'Resumo de teste.' && (kitsNovo.kits || []).find(k => k.slug === 'kit-gin')?.situacao === 'fora',
     'publicar: resumo em modelos.json e "fora" do Kit Gin em kits.json');
  const kitTeste = (kitsNovo.kits || []).find(k => k.slug === slugKitNovo);
  const kitNaSecao = !!kitTeste && (kitsNovo.tipos || []).find(x => x.ancora === 'kits-escritorio').kits.includes(kitTeste.slug);
  const kitFoto = !!kitTeste && assets.some(a => a.startsWith('img/v2/' + kitTeste.foto + '.'));
  ok(/^kit-teste-invent/.test(slugKitNovo) && kitTeste && kitTeste.novo === true && kitNaSecao && kitFoto,
     `publicar: kit novo em kits.json, na seção Kit escritório, com a foto em img/v2/ (${slugKitNovo || 'sem kit'}; seção ${kitNaSecao}; foto ${kitFoto}; ${assets.join(' ')})`);
  ok(novoP.length > origP.length && novoP.length - origP.length < 40 && arqs['src/data/produtos.json'].endsWith('}\n') && origP.slice(0, 20).join('\n') === novoP.slice(0, 20).join('\n'),
     'publicar: produtos.json no mesmo formato (indentação 1, quebra no fim), só com as linhas da cor nova e das situações');
  ok(await ip.$eval('#barra', b => b.hidden) && await ip.evaluate(() => !localStorage.getItem('tama-inventario-rascunho')), 'depois de publicar: barra de pendências some e o rascunho do navegador é apagado');
  ok(janelasDoNavegador === 0, `nenhuma janela do navegador (confirm/alert) no fluxo do inventário (${janelasDoNavegador})`);
  // conteúdo do site (site.json): carrossel, páginas (cabeçalho e vitrine), destaques da home e contato
  const siteFix = JSON.parse(fs.readFileSync(path.join(DADOS, 'site.json'), 'utf8'));
  const selFix = JSON.parse(fs.readFileSync(path.join(DADOS, 'selecoes.json'), 'utf8'));
  const muda = (sel, v) => ip.$eval(sel, (e, v) => { e.value = v; e.dispatchEvent(new Event('change')); }, v);
  await ip.click('[data-tab="carrossel"]');
  ok(await ip.$$eval('#sec-carrossel .slide-item', l => l.length) === siteFix.carrossel.length && await ip.$eval('#sec-carrossel .slide-item .meta', m => m.textContent) === siteFix.carrossel[0].eyebrow,
     `carrossel: os ${siteFix.carrossel.length} slides do site.json, na ordem`);
  await ip.click('[data-slide="kits"]'); await ip.waitForSelector('#s-titulo');
  await muda('#s-titulo', ''); await sleep(150);
  await ip.click('#gaveta-fechar'); await ip.click('[data-tab="alteracoes"]');
  ok(await ip.$$eval('.erros li', l => l.some(x => /slide 4 \(Kits corporativos\): título é obrigatório/.test(x.textContent))) && await ip.$eval('#pub-ok', b => b.disabled), 'carrossel: slide sem título vira erro e bloqueia a publicação');
  await ip.click('[data-tab="carrossel"]'); await ip.click('[data-slide="kits"]'); await ip.waitForSelector('#s-titulo');
  await muda('#s-titulo', 'Kits feitos de *ponta a ponta*.'); await sleep(150);
  await ip.click('#gaveta-fechar');
  await ip.click('[data-desce="0"]'); await sleep(150);
  await ip.click('[data-slide="escritorio"]'); await ip.waitForSelector('#s-desligar'); await ip.click('#s-desligar'); await sleep(150);
  await ip.click('#gaveta-fechar');
  await ip.click('[data-slide="confeccoes"]'); await ip.waitForSelector('#s-arq');
  await ip.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 2000; c.height = 1300; const x = c.getContext('2d'); x.fillStyle = '#E8E2D8'; x.fillRect(0, 0, 2000, 1300);
    const dt = new DataTransfer(); dt.items.add(new File([await new Promise(r => c.toBlob(r, 'image/png'))], 'slide.png', { type: 'image/png' }));
    const inp = document.getElementById('s-arq'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));
  });
  await ip.waitForFunction(() => Object.keys(window.TAMA_INVENTARIO.estado().arquivos).some(p => p.startsWith('img/v2/slide-confeccoes-')), { timeout: 10000 });
  await ip.click('#gaveta-fechar');
  await ip.click('[data-tab="paginas"]'); await ip.click('[data-pagina="brindes"]'); await ip.waitForSelector('#p-eyebrow');
  await muda('#p-eyebrow', 'Brindes para empresas'); await sleep(150);
  const nomeNovo = await ip.evaluate(() => { const o = [...document.querySelectorAll('#pv0-opcoes option')][0]; return o ? o.value : ''; });
  await ip.$eval('#pv0-add', (e, v) => { e.value = v; }, nomeNovo); await ip.click('#pv0-ok'); await sleep(150);
  await ip.click('[data-pv0-tira="0"]'); await sleep(150);
  await ip.click('#gaveta-fechar');
  await ip.click('[data-pagina="home"]'); await ip.waitForSelector('[data-ph-desce="0"]'); await ip.click('[data-ph-desce="0"]'); await sleep(150);
  await ip.click('#gaveta-fechar');
  await ip.click('[data-tab="contato"]'); await muda('#c-email', 'teste@example.com'); await sleep(150);
  await ip.click('[data-tab="alteracoes"]');
  const mudSite = await ip.$$eval('.mudancas li p', l => l.map(x => x.textContent));
  ok(['Slide alterado: Kits corporativos', 'Slide desligado: Canetas e escritório', 'Nova ordem dos slides do carrossel', 'Home: alterações em destaques', 'Brindes corporativos: alterações em cabeçalho, vitrine', 'Contato, topo e rodapé alterados'].every(t => mudSite.includes(t)) && !(await ip.$('.erros')),
     `alterações do site listadas, sem erros (${mudSite.join(' | ')})`);
  gravado = null;
  await ip.click('#pub-ok');
  await ip.waitForFunction(() => document.getElementById('status').classList.contains('ok'), { timeout: 15000 });
  const arqs2 = Object.fromEntries((gravado?.entry?.dataFiles || []).map(f => [f.path, f.raw]));
  const assets2 = (gravado?.entry?.assets || []).map(a => a.path);
  const site2 = arqs2['src/data/site.json'] ? JSON.parse(arqs2['src/data/site.json']) : {};
  const sel2 = arqs2['src/data/selecoes.json'] ? JSON.parse(arqs2['src/data/selecoes.json']) : {};
  const sl = id => (site2.carrossel || []).find(x => x.id === id) || {};
  ok(site2.carrossel && site2.carrossel[1].id === siteFix.carrossel[0].id && sl('kits').titulo === 'Kits feitos de *ponta a ponta*.' && sl('escritorio').ativo === false &&
     /^slide-confeccoes-\d+$/.test(sl('confeccoes').imagem) && assets2.some(a => a.startsWith('img/v2/' + sl('confeccoes').imagem + '.')),
     `publicar: carrossel com a ordem, o título, o slide desligado e a foto nova em img/v2/ (${assets2.join(' ')})`);
  ok(site2.cabecalhos.brindes.eyebrow === 'Brindes para empresas' && site2.vitrines.brindes.modelos[0] === siteFix.vitrines.brindes.modelos[1] && site2.vitrines.brindes.modelos.length === siteFix.vitrines.brindes.modelos.length &&
     site2.contato.email === 'teste@example.com' && sel2.home && sel2.home[0] === selFix.home[1] && sel2.home[1] === selFix.home[0] && arqs2['src/data/site.json'].endsWith('}\n'),
     'publicar: cabeçalho e vitrine de Brindes, contato em site.json e destaques da home em selecoes.json');
  // seções com foto: formatos de Ativações (texto) e abertura de uma ocasião
  await ip.click('[data-tab="paginas"]'); await ip.click('[data-pagina="ativacoes"]'); await ip.waitForSelector('[data-caminho]');
  const camBuffet = JSON.stringify(['secoes', 'ativacoes-formatos', 'itens', siteFix.secoes['ativacoes-formatos'].itens.findIndex(i => i.id === 'fmt-buffet'), 'texto']);
  await ip.evaluate(c => { const e = [...document.querySelectorAll('[data-caminho]')].find(x => x.dataset.caminho === c); e.value = 'Buffet para eventos da empresa.'; e.dispatchEvent(new Event('change')); }, camBuffet); await sleep(150);
  await ip.click('#gaveta-fechar');
  await ip.click('[data-pagina="ocasioes"]'); await ip.waitForSelector('[data-caminho]');
  await ip.evaluate(() => { const e = [...document.querySelectorAll('[data-caminho]')].find(x => x.dataset.caminho === JSON.stringify(['secoes', 'ocasioes', 'eventos', 'eyebrow'])); e.value = 'Eventos e feiras'; e.dispatchEvent(new Event('change')); }); await sleep(150);
  await ip.click('#gaveta-fechar');
  await ip.click('[data-tab="alteracoes"]');
  const mudSec = await ip.$$eval('.mudancas li p', l => l.map(x => x.textContent));
  gravado = null;
  await ip.click('#pub-ok');
  await ip.waitForFunction(() => document.getElementById('status').classList.contains('ok'), { timeout: 15000 });
  const site3 = JSON.parse(((gravado?.entry?.dataFiles || []).find(f => f.path === 'src/data/site.json') || {}).raw || '{}');
  ok(mudSec.includes('Eventos corporativos: alterações em seções') && mudSec.includes('Brindes por ocasião: alterações em seções') &&
     (site3.secoes?.['ativacoes-formatos']?.itens || []).find(i => i.id === 'fmt-buffet')?.texto === 'Buffet para eventos da empresa.' && site3.secoes?.ocasioes?.eventos?.eyebrow === 'Eventos e feiras',
     `seções com foto: formatos de Ativações e abertura de ocasião editados e publicados em site.json (${mudSec.join(' | ')})`);
  await ip.close();

  // login com usuário e senha (serviço admin-api, simulado): sem sessão aparece o formulário; senha errada avisa; certa abre o inventário
  const lp = await browser.newPage();
  await lp.setViewport({ width: 1280, height: 900 });
  await lp.setRequestInterception(true);
  let sessao = false, tentativas = 0;
  lp.on('request', req => {
    const u = new URL(req.url());
    if (!u.pathname.startsWith('/api/admin/')) return req.continue();
    const j = (st, d) => req.respond({ status: st, contentType: 'application/json', body: JSON.stringify(d) });
    const rota = u.pathname.slice('/api/admin'.length);
    if (rota === '/eu') return sessao ? j(200, { usuario: 'tama' }) : j(401, { erro: 'login' });
    if (rota === '/login') { tentativas++; const d = JSON.parse(req.postData() || '{}'); if (d.senha === 'certa') { sessao = true; return j(200, { usuario: 'tama' }); } return j(401, { erro: 'Usuário ou senha incorretos.' }); }
    if (!sessao) return j(401, { erro: 'login' });
    if (rota === '/ler') { const f = path.join(DADOS, path.basename(JSON.parse(req.postData()).path)); return j(200, { texto: fs.readFileSync(f, 'utf8') }); }
    if (rota === '/rascunhos') return j(200, []);
    return j(404, {});
  });
  await lp.goto(BASE + '/admin/inventario/', { waitUntil: 'networkidle0' });
  await lp.waitForSelector('#form-login');
  ok(await lp.$eval('.tabs', t => t.hidden) && await lp.$eval('#l-senha', i => i.type === 'password' && i.autocomplete === 'current-password'), 'inventário sem sessão mostra o login (usuário e senha) e esconde as abas');
  await lp.type('#l-usuario', 'tama'); await lp.type('#l-senha', 'errada');
  await lp.click('#l-ok');
  await lp.waitForFunction(() => !document.getElementById('l-erro').hidden);
  ok(await lp.$eval('#l-erro', e => e.textContent === 'Usuário ou senha incorretos.') && await lp.$('#form-login'), 'senha errada: avisa e continua no login');
  await lp.$eval('#l-senha', i => (i.value = '')); await lp.type('#l-senha', 'certa');
  await lp.click('#l-ok');
  await lp.waitForSelector('#sec-resumo .kpi');
  ok(tentativas === 2 && await lp.$eval('.tabs', t => !t.hidden) && /conectado como tama/.test(await lp.$eval('#fonte', f => f.textContent)) && !!(await lp.$('#sair')),
     'senha certa: abre o inventário pelo serviço, com "conectado como" e Sair');
  await lp.close();
} finally {
  await browser.close();
}
console.log(`\n${pass} ok, ${fail} falhas`);
process.exit(fail ? 1 : 0);
