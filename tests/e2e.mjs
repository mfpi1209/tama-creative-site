// Testes de fluxos críticos do site TaMa Creative.
// Uso: node tests/e2e.mjs [baseURL]   (padrão http://127.0.0.1:8099, servindo dist/)
// Requer puppeteer-core e um Edge/Chrome local (EDGE_PATH). Não envia nada para produção:
// o POST do formulário é interceptado e respondido localmente.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const BASE = process.argv[2] || 'http://127.0.0.1:8099';
const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = +process.env.E2E_PORT || 9335;
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
  ok(await page.$$eval('h1', h => h.length) === 1, 'home tem um único H1 com 3 slides');
  await page.click('[data-hero-next]');
  ok(await page.$eval('#slide-2', s => s.classList.contains('is-active') && !s.hasAttribute('aria-hidden')), 'seta avança para o slide 2');
  ok(await page.$eval('#slide-1', s => s.hasAttribute('inert')), 'slide inativo fica inerte (fora do foco)');
  ok(await page.$eval('[data-hero-pause]', b => b.getAttribute('aria-pressed') === 'true'), 'com movimento reduzido, a troca automática começa pausada');

  console.log('Vitrine, cores e seleção');
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await page.click('[data-rail-filter="rail-home"][data-value="bebidas"]');
  ok(await page.$$eval('#rail-home .product', p => p.filter(x => !x.hidden).length) === 2, 'filtro Bebidas na vitrine mostra 2 peças');
  await page.click('#rail-home .product[data-slug="garrafa-termica"] .swatch[data-color="Azul"]');
  ok(await page.$eval('#rail-home .product[data-slug="garrafa-termica"] .color-name', e => e.textContent === 'Azul'), 'troca de cor atualiza o nome da cor');
  await page.click('#rail-home .pick[data-slug="garrafa-termica"]');
  const sel = await page.evaluate(() => JSON.parse(localStorage.getItem('tama-selecao')));
  ok(sel.length === 1 && sel[0].s === 'garrafa-termica' && sel[0].c === 'Azul', 'peça entra na seleção com a cor escolhida');
  ok(await page.$eval('.site-header [data-sel-count]', e => !e.hidden && e.textContent === '1'), 'contador do cabeçalho mostra 1');
  await page.click('.site-header [data-open-drawer]');
  ok(await page.$eval('#drawer', d => d.open && d.textContent.includes('Garrafa térmica') && d.textContent.includes('Azul')), 'gaveta lista a peça com a cor');
  await page.keyboard.press('Escape');
  ok(!(await page.$eval('#drawer', d => d.open)), 'Esc fecha a gaveta');
  // Depois da rolagem anterior o chip pode ficar sob o cabeçalho fixo (o clique cairia num link do menu): centraliza antes.
  await page.$eval('[data-rail-filter="rail-home"][data-value="todas"]', el => el.scrollIntoView({ block: 'center' }));
  await page.click('[data-rail-filter="rail-home"][data-value="todas"]');
  await page.click('#rail-home .product[data-slug="bandeja-em-couro"] .swatch[data-color="Café"]');
  ok(await page.$eval('#rail-home .product[data-slug="bandeja-em-couro"] .prod-media img', i => (i.getAttribute('srcset') || '').includes('bandeja-couro~cafe')), 'trocar a cor mostra a foto do produto na cor escolhida');
  ok(await page.$eval('[data-rail-filter="rail-home"][data-value="todas"]', b => b.getAttribute('aria-pressed') === 'true'), 'filtro Todas volta a mostrar a vitrine inteira');
  await page.click('#rail-home [data-zoom="caneca-de-ceramica"]');
  ok(await page.$eval('#lightbox', d => d.open && d.querySelector('#lb-title').textContent === 'Caneca de cerâmica'), 'foto ampliada abre com a peça certa');
  await page.click('#lb-pick');
  ok((await page.evaluate(() => JSON.parse(localStorage.getItem('tama-selecao')).length)) === 2, 'selecionar pela foto ampliada adiciona a peça');
  await page.keyboard.press('Escape');

  console.log('Curadoria completa');
  await page.goto(BASE + '/brindes-corporativos-premium/', { waitUntil: 'networkidle0' });
  const visible = () => page.$$eval('#gift-grid .product, #idea-grid .idea', g => g.filter(x => !x.hidden).length);
  ok(await visible() === 38, '38 peças sem filtro (21 com foto + 17 além do óbvio)');
  await page.click('.chip[data-filter="cat"][data-value="alem"]');
  await page.click('.chip[data-filter="occ"][data-value="fim-de-ano"]');
  const n1 = await visible();
  ok(n1 === 9, `Além do óbvio + Fim de ano mostra 9 (${n1})`);
  ok(page.url().includes('categoria=alem') && page.url().includes('ocasiao=fim-de-ano'), 'filtros ficam na URL para compartilhar');
  await page.click('.chip[data-filter="cat"][data-value="bebidas"]');
  ok(await page.$eval('#gift-empty', e => !e.hidden), 'combinação sem resultados mostra estado vazio');
  await page.click('#gift-reset');
  ok(await visible() === 38, 'limpar filtros volta às 38 peças');
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
  await page.click('input[name="tipo"][value="branding"]');
  ok(await page.$eval('#f-qtd', i => i.disabled && i.closest('[data-show-for]').hidden), 'branding esconde quantidade e data');
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

  // ------------------------------------------------------------------ simulador "Veja sua marca"
  console.log('Simulador (Veja sua marca)');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tama-sim-'));
  const fileOf = (name, data) => { const f = path.join(tmp, name); fs.writeFileSync(f, data); return f; };
  const evilSvg = fileOf('logo-teste.svg', '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 420 120">'
    + '<script>alert(1)</script><circle cx="60" cy="60" r="48" fill="#1F6FB2" onload="alert(2)"/>'
    + '<path d="M130 92V30h22l20 44 20-44h22v62h-16V52l-18 40h-16l-18-40v40z" fill="#1F2A44"/>'
    + '<foreignObject width="9" height="9"><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>'
    + '<a xlink:href="javascript:alert(3)"><rect x="240" y="40" width="120" height="40" fill="#E8A33D"/></a>'
    + '<image href="https://example.com/rastreio.png" width="1" height="1"/></svg>');
  const gifFile = fileOf('logo.gif', Buffer.concat([Buffer.from('474946383961010001000000002c00000000010001000002024401003b', 'hex'), Buffer.alloc(2048)]));
  const bigPng = fileOf('logo-grande.png', Buffer.concat([Buffer.from('89504E470D0A1A0A', 'hex'), Buffer.alloc(5.5 * 1024 * 1024, 1)]));
  // registra o que o site envia (FormData) antes de a requisição sair
  const spyPosts = () => {
    window.__posts = [];
    const of = window.fetch;
    window.fetch = async function (url, opts) {
      if (opts && opts.body instanceof FormData) {
        const e = {};
        for (const [k, v] of opts.body.entries()) {
          if (v instanceof File) {
            const f = { name: v.name, type: v.type, size: v.size };
            if (v.type === 'image/svg+xml') f.text = await v.text();
            if (v.type === 'image/jpeg') { const b = await createImageBitmap(v); f.w = b.width; f.h = b.height; }
            e[k] = f;
          } else e[k] = v;
        }
        window.__posts.push({ url: String(url), e });
      }
      return of.apply(this, arguments);
    };
  };
  const sp = await browser.newPage();
  await sp.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await sp.setViewport({ width: 1280, height: 900 });
  await sp.evaluateOnNewDocument(spyPosts);
  await sp.goto(BASE + '/', { waitUntil: 'networkidle0' });
  ok(await sp.$eval('.sim-band', b => b.querySelector('h2').textContent.includes('Veja sua marca em nossos produtos') && !!b.querySelector('a[href="/veja-sua-marca/"]')), 'home tem a faixa "Veja sua marca em nossos produtos." com o CTA');
  await sp.goto(BASE + '/brindes-corporativos-premium/', { waitUntil: 'networkidle0' });
  ok(await sp.$eval('.page-head a[href="/veja-sua-marca/"]', a => a.textContent.includes('Ver com a minha marca')) && await sp.$('#pecas .sim-band'), 'curadoria tem o CTA no topo e a faixa do simulador');
  const cardLinks = await sp.$$eval('#gift-grid .product .sim-link', l => l.map(a => a.getAttribute('href')));
  ok(cardLinks.length === 21 && cardLinks.every(h => /^\/veja-sua-marca\/\?produto=[a-z-]+$/.test(h)), `os 21 cards de produto têm "Ver com a minha marca" (${cardLinks.length})`);
  await sp.$eval('#gift-grid .product[data-slug="garrafa-termica"]', el => el.scrollIntoView({ block: 'center' }));
  await sp.click('#gift-grid .product[data-slug="garrafa-termica"] .swatch[data-color="Azul"]');
  ok(await sp.$eval('#gift-grid .product[data-slug="garrafa-termica"] .sim-link', a => a.getAttribute('href').endsWith('?produto=garrafa-termica&cor=Azul')), 'o link do card leva a cor escolhida');
  await sp.click('#gift-grid .product[data-slug="garrafa-termica"] .sim-link');
  await sp.waitForFunction(() => location.pathname === '/veja-sua-marca/' && window.TamaSimulador, { timeout: 8000 });
  ok(await sp.$eval('#sim-pre', p => !p.hidden && p.textContent.includes('Garrafa térmica · Azul')), 'simulador abre com a peça e a cor do card');
  ok(await sp.evaluate(() => ['1', '2', '3'].map(n => document.getElementById('sim-step-' + n).dataset.state).join() === 'current,locked,locked'), 'passo 1 ativo; passos 2 e 3 bloqueados');
  ok(await sp.$eval('#sim-next-1', b => b.disabled), '"Continuar" só libera depois do logo');
  const input = await sp.$('#sim-file');
  await input.uploadFile(gifFile);
  ok(await sp.waitForFunction(() => document.getElementById('sim-file-error').textContent.includes('SVG, PNG ou JPG'), { timeout: 5000 }).then(() => true, () => false), 'formato não aceito (GIF) é recusado com mensagem clara');
  await input.uploadFile(bigPng);
  ok(await sp.waitForFunction(() => document.getElementById('sim-file-error').textContent.includes('5 MB'), { timeout: 5000 }).then(() => true, () => false), 'arquivo acima de 5 MB é recusado');
  await input.uploadFile(evilSvg);
  await sp.waitForFunction(() => !document.getElementById('sim-next-1').disabled, { timeout: 8000 });
  const clean = await sp.evaluate(() => window.TamaSimulador.state.info.svg.text);
  ok(!/<script|onload|foreignObject|javascript:|example\.com/i.test(clean) && clean.includes('<circle') && clean.includes('<rect'), 'SVG sanitizado: sem script, eventos, foreignObject, links externos; o desenho fica');
  ok(await sp.$eval('#sim-file-error', e => e.textContent === '') && await sp.$eval('#sim-logo', l => !l.hidden), 'logo aceito aparece na pré-visualização');
  await sp.click('#sim-next-1');
  ok(await sp.evaluate(() => document.activeElement.id === 'sim-h2' && document.getElementById('sim-step-2').dataset.state === 'current'), 'passo 2 recebe o foco');
  ok(await sp.evaluate(() => document.querySelector('input[name="sim-produto"][value="garrafa-termica"]').checked && document.querySelector('input[name="sim-cor"][value="azul"]').checked), 'peça e cor do card já vêm marcadas');
  await sp.click('#sim-produce');
  await sp.waitForFunction(() => window.TamaSimulador.state.rendered, { timeout: 10000 });
  const changed = await sp.evaluate(async () => {
    const c = document.getElementById('sim-canvas'), g = c.getContext('2d'), a = g.getImageData(0, 0, c.width, c.height).data;
    const SIM = JSON.parse(document.getElementById('tama-sim').textContent);
    const im = new Image(); im.src = SIM.bases['garrafa-termica~azul'].p; await im.decode();
    const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const og = o.getContext('2d'); og.drawImage(im, 0, 0, c.width, c.height);
    const b = og.getImageData(0, 0, c.width, c.height).data;
    // área do logo na garrafa (foto de 850 px: x 280–400, y 260–380)
    const k = c.width / 850; let diff = 0, n = 0;
    for (let y = Math.round(270 * k); y < Math.round(370 * k); y++) for (let x = Math.round(290 * k); x < Math.round(390 * k); x++) { const i = (y * c.width + x) * 4; diff += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]); n++; }
    return { w: c.width, mean: diff / n / 2, label: c.getAttribute('aria-label') };
  });
  ok(changed.w === 720 && changed.mean > 6 && changed.label.includes('Garrafa térmica na cor azul'), `prévia de 720 px com o logo aplicado na área da garrafa (Δ ${changed.mean.toFixed(1)})`);
  ok(await sp.evaluate(() => document.activeElement.id === 'sim-h3' && document.getElementById('sim-step-3').dataset.state === 'current'), 'passo 3 mostra a prévia e recebe o foco');
  await sp.click('#sim-colors-3 input[value="ocre"]');
  ok(await sp.waitForFunction(() => document.getElementById('sim-canvas').getAttribute('aria-label').includes('cor ocre'), { timeout: 8000 }).then(() => true, () => false), 'trocar a cor no passo 3 refaz a prévia');
  await sp.click('#sim-submit');
  const simErrs = await sp.$$eval('#sim-form .field-error', e => e.filter(x => x.textContent.trim()).length);
  ok(simErrs >= 3 && (await sp.evaluate(() => window.__posts.length)) === 0, `envio vazio mostra erros (${simErrs}) e não envia nada`);
  await sp.setRequestInterception(true);
  let simMode = 'fail';
  sp.on('request', req => {
    if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/simulador') return req.respond(simMode === 'ok' ? { status: 200, contentType: 'application/json', body: '{"ok":true}' } : { status: 500, contentType: 'application/json', body: '{"ok":false}' });
    req.continue();
  });
  for (const [s, v] of [['#sim-nome', 'Teste Automatizado'], ['#sim-email', 'teste@example.com'], ['#sim-empresa', 'Empresa Teste']]) await sp.type(s, v);
  await sp.click('#sim-consent');
  await sp.click('#sim-submit');
  await sp.waitForSelector('#sim-done:not([hidden])', { timeout: 15000 });
  ok(await sp.$eval('#sim-done', d => d.textContent.includes('Não conseguimos enviar')), 'falha do servidor mostra erro (nunca sucesso)');
  const post = await sp.evaluate(() => window.__posts[0]);
  const e = post && post.e;
  ok(post && post.url.endsWith('/api/simulador') && e.etapa === 'mockup' && e.produto === 'garrafa-termica' && e.cor === 'Ocre' && e.consentimento === 'sim' && 'bot-field' in e, 'POST para /api/simulador com peça, cor, consentimento e honeypot');
  ok(e && e.logo.type === 'image/svg+xml' && !/<script|onload|javascript:/i.test(e.logo.text) && e.mockup.type === 'image/jpeg' && e.mockup.w === 1600, `envia o logo sanitizado e o mockup em alta (1600 px, ${e && Math.round(e.mockup.size / 1024)} KB)`);
  await sp.click('[data-sim-retry]');
  simMode = 'ok';
  await sp.waitForFunction(() => !document.getElementById('sim-submit').disabled);
  await sp.click('#sim-submit');
  ok(await sp.waitForFunction(() => document.querySelector('#sim-done h3')?.textContent.includes('teste@example.com'), { timeout: 15000 }).then(() => true, () => false), 'resposta 200 confirma o envio para o e-mail informado');
  ok(await sp.evaluate(() => !!localStorage.getItem('tama-sim-usado')), 'quem usou o simulador não vê mais o convite de saída');
  const simEvents = await sp.evaluate(() => (window.dataLayer || []).map(x => x.event).filter(Boolean));
  ok(['sim_logo_ok', 'sim_produce', 'sim_submit_error', 'sim_submit_success'].every(x => simEvents.includes(x)), 'eventos do simulador disparados');
  await sp.click('[data-sim-proposta]');
  await sp.waitForFunction(() => location.pathname === '/solicitar-proposta/', { timeout: 8000 });
  ok(await sp.$eval('#f-selecao', i => i.value.includes('Garrafa térmica (Ocre)')) && sp.url().includes('tipo=brindes'), '"Pedir proposta com esta peça" leva a peça e a cor para o formulário');
  ok(!(await sp.$('#exit-modal')), 'formulário de proposta não tem convite de saída');
  await sp.evaluate(() => localStorage.clear());
  await sp.close();

  console.log('Convite de saída');
  const xp = await browser.newPage();
  await xp.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await xp.setViewport({ width: 1280, height: 900 });
  await xp.evaluateOnNewDocument(() => { window.TAMA_EXIT_TEST = { dwell: 0 }; });
  await xp.goto(BASE + '/kits-corporativos/', { waitUntil: 'networkidle0' });
  const leaveTop = () => xp.evaluate(() => document.dispatchEvent(new MouseEvent('mouseout', { clientY: -4, clientX: 400, relatedTarget: null, bubbles: true })));
  await xp.evaluate(() => document.dispatchEvent(new MouseEvent('mouseout', { clientY: 300, clientX: 400, relatedTarget: null, bubbles: true })));
  ok(!(await xp.$eval('#exit-modal', d => d.open)), 'mouse saindo pela lateral não abre o convite');
  await leaveTop();
  const dlg = await xp.$eval('#exit-modal', d => ({ open: d.open, modal: d.matches(':modal'), label: document.getElementById(d.getAttribute('aria-labelledby'))?.textContent, cta: d.querySelector('a[href="/veja-sua-marca/"]')?.textContent, close: d.querySelector('.exit-close')?.getAttribute('aria-label'), focus: d.contains(document.activeElement) }));
  ok(dlg.open && dlg.modal && dlg.label === 'Veja sua marca em nossos produtos.' && dlg.cta.includes('Ver com a minha marca'), 'mouse saindo pelo topo abre o convite (<dialog> modal com o mote)');
  ok(dlg.close === 'Fechar convite' && dlg.focus, 'convite tem botão X rotulado e o foco fica dentro dele');
  await xp.keyboard.press('Escape');
  await sleep(150);
  const until = await xp.evaluate(() => +localStorage.getItem('tama-exit-ate') - Date.now());
  ok(!(await xp.$eval('#exit-modal', d => d.open)) && until > 6.9 * 864e5, 'Esc fecha e o convite fica 7 dias sem voltar');
  await xp.evaluate(() => sessionStorage.clear());
  await xp.reload({ waitUntil: 'networkidle0' });
  await leaveTop();
  ok(!(await xp.$eval('#exit-modal', d => d.open)), 'depois de fechado, não volta (mesmo em outra sessão)');
  await xp.evaluate(() => localStorage.clear());
  await xp.reload({ waitUntil: 'networkidle0' });
  await leaveTop();
  await xp.click('#exit-modal .exit-later');
  await xp.evaluate(() => localStorage.removeItem('tama-exit-ate'));
  await xp.reload({ waitUntil: 'networkidle0' });
  await leaveTop();
  ok(!(await xp.$eval('#exit-modal', d => d.open)), 'uma vez por sessão');
  await xp.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await xp.goto(BASE + '/veja-sua-marca/', { waitUntil: 'networkidle0' });
  ok(!(await xp.$('#exit-modal')), 'o próprio simulador não tem convite de saída');
  await xp.close();

  const mp = await browser.newPage();
  await mp.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await mp.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await mp.evaluateOnNewDocument(() => { window.TAMA_EXIT_TEST = { mobileDwell: 0, timer: 2e9 }; });
  await mp.evaluateOnNewDocument(spyPosts);
  await mp.goto(BASE + '/brindes-corporativos/', { waitUntil: 'networkidle0' });
  await mp.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.6));
  await sleep(400);
  await mp.evaluate(() => window.scrollBy(0, -80));
  await sleep(120);
  ok(!(await mp.$eval('#exit-modal', d => d.open)), 'celular: rolagem lenta para cima não abre o convite');
  await sleep(400);
  // gesto rápido para cima: vários eventos de rolagem em ~200 ms, como um arrasto no celular
  await mp.evaluate(async () => { for (let i = 0; i < 8; i++) { window.scrollBy(0, -60); await new Promise(r => setTimeout(r, 25)); } });
  ok(await mp.waitForFunction(() => document.getElementById('exit-modal').open, { timeout: 3000 }).then(() => true, () => false), 'celular: rolagem rápida para cima depois de ler a página abre o convite');
  ok(await mp.$eval('#exit-modal', d => { const r = d.getBoundingClientRect(); return Math.abs(r.bottom - innerHeight) < 2 && r.width >= innerWidth - 1; }), 'no celular o convite é uma folha discreta presa à base da tela');
  await mp.click('#exit-form button[type="submit"]');
  ok(await mp.$$eval('#exit-form .field-error', e => e.filter(x => x.textContent.trim()).length) === 2, 'convite: e-mail e consentimento são obrigatórios');
  await mp.setRequestInterception(true);
  mp.on('request', req => (req.method() === 'POST' && new URL(req.url()).pathname === '/api/simulador') ? req.respond({ status: 200, contentType: 'application/json', body: '{"ok":true}' }) : req.continue());
  await mp.type('#exit-email', 'lead@example.com');
  await mp.click('#exit-consent');
  await mp.click('#exit-form button[type="submit"]');
  ok(await mp.waitForFunction(() => document.querySelector('.exit-done')?.textContent.includes('lead@example.com'), { timeout: 8000 }).then(() => true, () => false), 'convite: pedido do link confirmado');
  const lp = await mp.evaluate(() => window.__posts[0]?.e);
  ok(lp && lp.etapa === 'lembrete' && lp.email === 'lead@example.com' && lp.consentimento === 'sim' && 'bot-field' in lp && !lp.logo, 'convite envia só e-mail, consentimento e honeypot (etapa=lembrete)');
  await mp.evaluate(() => localStorage.clear());
  await mp.close();

  // acessibilidade (axe-core, se instalado junto do puppeteer-core)
  let AXE = null;
  try { AXE = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8'); } catch { console.log('  (axe-core não encontrado: verificação de acessibilidade pulada)'); }
  if (AXE) {
    console.log('Acessibilidade (axe)');
    const ap = await browser.newPage();
    await ap.setViewport({ width: 1280, height: 900 });
    await ap.evaluateOnNewDocument(() => { window.TAMA_EXIT_TEST = { dwell: 0 }; });
    const axe = async (label) => {
      await ap.evaluate(AXE);
      const v = await ap.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } })).violations.map(x => `${x.id} (${x.nodes.length}: ${x.nodes[0].target.join(' ')})`));
      ok(v.length === 0, `axe sem violações: ${label}${v.length ? ' — ' + v.join('; ') : ''}`);
    };
    await ap.goto(BASE + '/veja-sua-marca/?produto=caixa-rigida-premium', { waitUntil: 'networkidle0' });
    await axe('simulador, passo 1');
    await (await ap.$('#sim-file')).uploadFile(evilSvg);
    await ap.waitForFunction(() => !document.getElementById('sim-next-1').disabled);
    await ap.click('#sim-next-1');
    await axe('simulador, passo 2');
    await ap.click('#sim-produce');
    await ap.waitForFunction(() => window.TamaSimulador.state.rendered);
    await axe('simulador, passo 3 com formulário');
    await ap.goto(BASE + '/kits-corporativos/', { waitUntil: 'networkidle0' });
    await ap.evaluate(() => document.dispatchEvent(new MouseEvent('mouseout', { clientY: -4, relatedTarget: null, bubbles: true })));
    await axe('convite de saída aberto');
    await ap.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    for (const w of [320, 390]) {
      await ap.setViewport({ width: w, height: 800, isMobile: true, hasTouch: true });
      for (const u of ['/veja-sua-marca/', '/', '/brindes-corporativos-premium/']) {
        await ap.goto(BASE + u, { waitUntil: 'networkidle0' });
        const over = await ap.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        ok(over <= 0, `${u} sem rolagem horizontal em ${w} px${over > 0 ? ' (' + over + ' px)' : ''}`);
      }
    }
    await ap.close();
  }
} finally {
  await browser.close();
}
console.log(`\n${pass} ok, ${fail} falhas`);
process.exit(fail ? 1 : 0);
