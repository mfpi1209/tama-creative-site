#!/usr/bin/env python3
"""Gerador estático do site TaMa Creative.

Uso:  python build.py            -> gera dist/
Requer: Python 3.10+, Pillow (com AVIF/WebP) e resvg-py  (pip install -r requirements.txt)
Configuração: site.config.json, sobrescrita por variáveis de ambiente
(SITE_URL, WHATSAPP, EMAIL, INSTAGRAM, GA4_ID, REDIRECT_NETLIFY_SUBDOMAIN).
"""
import hashlib, html, json, os, re, shutil, sys, urllib.parse
from datetime import date
import blog  # /blog/: artigos em src/blog/*.md (ver blog.py e docs/BLOG.md)

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
DIST = os.path.join(ROOT, 'dist')
IMG_SRC = os.path.join(ROOT, 'img')
LOGOS = os.path.join(ROOT, 'brand', 'logos')  # cópia versionada de ../tama-creative-logos/svg (o build no Netlify só vê este repositório)
LOGOS_OFICIAIS = os.path.join(ROOT, '..', 'tama-creative-logos', 'svg')

# ------------------------------------------------------------------ config
CFG = json.load(open(os.path.join(ROOT, 'site.config.json'), encoding='utf-8'))
for key in ('site_url', 'whatsapp', 'email', 'instagram', 'ga4_id', 'redirect_netlify_subdomain', 'form_endpoint'):
    env = os.environ.get(key.upper())
    if env:   # vazia = não definida (o Dockerfile passa ARG sem valor como variável vazia)
        CFG[key] = env.lower() in ('1', 'true', 'yes') if key == 'redirect_netlify_subdomain' else env
SITE = CFG['site_url'].rstrip('/')
WA = re.sub(r'\D', '', CFG.get('whatsapp') or '')
EMAIL = (CFG.get('email') or '').strip()
IG = (CFG.get('instagram') or '').strip().lstrip('@')
RAZAO, CNPJ, CIDADE, RESPONSAVEL = ((CFG.get(k) or '').strip() for k in ('razao_social', 'cnpj', 'cidade', 'responsavel_comercial'))
GA4 = (CFG.get('ga4_id') or '').strip()
# Envio do formulário: o Nginx repassa /api/proposta ao n8n (docs/PROPOSTAS.md). Não há mais Netlify Forms.
FORM_ENDPOINT = (CFG.get('form_endpoint') or '/api/proposta').strip() or '/api/proposta'
# Branded mockups (img/marca/ + src/data/mockups.json). Off unless MOCKUPS_MARCA=1 or "mockups_marca": true.
MOCKUPS = str(os.environ.get('MOCKUPS_MARCA', CFG.get('mockups_marca', ''))).lower() in ('1', 'true', 'yes')
BUILD_DATE = date.today().isoformat()
esc = lambda s: html.escape(s, quote=True)

# ------------------------------------------------------------------ brand svg
ARC = 'M0 0A100 100 0 0 0 100 100Z'
ARC_SVG = f'<svg class="arc{{cls}}" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path d="{ARC}"/></svg>'
def arc(cls=''):
    return ARC_SVG.replace('{cls}', (' ' + cls) if cls else '')
ARROW = '<svg class="i-arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
CHAT = '<svg class="wa-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>'  # logo do WhatsApp (Simple Icons, CC0)


def themed_svg(name, cls, label):
    s = open(os.path.join(LOGOS, name + '.svg'), encoding='utf-8').read().strip()
    s = re.sub(r' width="[^"]+" height="[^"]+"', '', s, count=1)
    attrs = f'class="{cls}" focusable="false" ' + (f'role="img" aria-label="{label}" ' if label else 'aria-hidden="true" ')
    s = s.replace('<svg ', '<svg ' + attrs, 1)
    s = s.replace('stroke="#65253D"', 'style="stroke:var(--logo-name)"')
    s = s.replace('fill="#65253D"', 'style="fill:var(--logo-name)"')
    return s.replace('fill="#D5483A"', 'style="fill:var(--logo-accent)"')


LOGO = themed_svg('tama-logo-horizontal-positivo', 'logo', 'TaMa Creative')
LOGO_DECOR = themed_svg('tama-logo-horizontal-positivo', 'logo', '')
SELO = themed_svg('tama-selo-positivo', 'selo', '')


def data_uri(svg):
    return 'data:image/svg+xml,' + urllib.parse.quote(svg, safe='')


def pattern_uri():
    cells = []
    for r in range(4):
        for c in range(4):
            rot = ((r + c) % 4) * 90
            cells.append(f"<path transform='translate({c*40} {r*40}) rotate({rot} 20 20) translate(7.6 7.6) scale(.248)' d='{ARC}'/>")
    return data_uri(f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160'>{''.join(cells)}</svg>")


ARC_MASK = data_uri(f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='{ARC}'/></svg>")

ICONS = {
    'vela': '<path d="M7 10h10v9.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19.5z"/><path d="M7 13.5h10"/><path d="M12 10V7.6"/><path d="M12 3.2c1.3 1.4 1.5 2.6 0 3.6-1.5-1-1.3-2.2 0-3.6z"/>',
    'bandeja': '<path d="M3 12.5h18l-1.5 5a1.6 1.6 0 0 1-1.5 1.1H6a1.6 1.6 0 0 1-1.5-1.1z"/><circle cx="9" cy="9" r="2"/><path d="M13 9.6h5.5"/><path d="M16.5 9.6v1.6"/>',
    'cafe': '<path d="M6 4h12l-3.6 6H9.6z"/><path d="M12 10v2"/><path d="M6.5 13.5h11v3a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4z"/><path d="M17.5 15h1a2 2 0 0 1 0 4h-1.3"/>',
    'baralho': '<rect x="4" y="5" width="10.5" height="14.5" rx="1.5"/><path d="M14.5 7.3l4.3 1.2a1.5 1.5 0 0 1 1.1 1.8l-2.5 9.3a1.5 1.5 0 0 1-1.8 1.1l-2.3-.6"/><path d="M7 9a4.2 4.2 0 0 0 4.2 4.2"/>',
    'pedra': '<path d="M4.6 18c-.6-4.1 2.3-8.6 7-9.5 4.2-.8 7.7 2.3 8.1 6.5.2 1.7-1 3-2.7 3z"/><path d="M3 18h18"/><path d="M10 12.2a3.4 3.4 0 0 0 3.4 3.4"/>',
    'caneta': '<path d="M15.2 3.6l5.2 5.2-9.7 9.7-5.3 1.1 1.1-5.3z"/><path d="M13.4 5.4l5.2 5.2"/><circle cx="10.5" cy="13.5" r="1.2"/>',
    'calendario': '<rect x="4.5" y="5" width="15" height="15" rx="1.5"/><path d="M4.5 9.5h15"/><path d="M9 3.5v3M15 3.5v3"/><path d="M8.5 13.2h.01M12 13.2h.01M15.5 13.2h.01M8.5 16.6h.01M12 16.6h.01"/>',
    'cha': '<rect x="6" y="7" width="12" height="13.5" rx="1.5"/><path d="M8 4h8v3H8z"/><path d="M6 11h12"/><path d="M9.5 16c1.6-2 3.6-2 5 0-1.4 2-3.4 2-5 0z"/>',
    'tabua': '<rect x="3" y="7.5" width="13.5" height="10" rx="2"/><path d="M16.5 12.5H21"/><path d="M6.5 14.6l4.8-3.6v3.6z"/>',
    'linho': '<path d="M7 3h10l-1.1 18H8.1z"/><rect x="6.2" y="10" width="11.6" height="3" rx="1"/>',
    'manta': '<rect x="4" y="5" width="16" height="12" rx="2"/><path d="M4 9h16M4 13h16"/><path d="M6.5 17v2.5M9.5 17v2.5M12.5 17v2.5M15.5 17v2.5M18 17v2.5"/>',
    'mascara': '<path d="M3 11.5C4.7 8.6 8 7.5 12 7.5s7.3 1.1 9 4c-1.3 3-4.7 4.8-9 4.8s-7.7-1.8-9-4.8z"/><path d="M7.8 12c1 .9 2.6.9 3.5 0M12.7 12c1 .9 2.6.9 3.5 0"/>',
    'garrafa': '<path d="M10 3h4v3.2l1.3 2.3V20a1 1 0 0 1-1 1H9.7a1 1 0 0 1-1-1V8.5L10 6.2z"/><path d="M8.7 13h6.6v4H8.7z"/>',
    'meia': '<path d="M9 3h6v8.5l3.5 3.5a3 3 0 0 1-4.2 4.3L9 14z"/><path d="M9 6.5h6"/><path d="M11 9.5a2.2 2.2 0 0 0 2.2 2.2"/>',
    'lenco': '<path d="M4 5h16l-8 14z"/><path d="M8 5l4 7 4-7"/>',
    'bone': '<path d="M4 15a8 7 0 0 1 16 0z"/><path d="M20 15h2.5"/><path d="M12 8v7"/>',
    'domino': '<rect x="8" y="3" width="8" height="18" rx="1.8"/><path d="M8 12h8"/><path d="M12 7.5h.01M10.4 15.5h.01M13.6 17.6h.01"/>',
    'horta': '<path d="M7 13h10l-1.4 7.2a1 1 0 0 1-1 .8H9.4a1 1 0 0 1-1-.8z"/><path d="M12 13V8.5"/><path d="M12 9.6C9 9.6 7.8 7.7 7.8 5.3c2.6 0 4.2 1.6 4.2 4.3z"/><path d="M12 8.5c0-2.6 1.6-4.3 4.3-4.3 0 2.6-1.6 4.3-4.3 4.3z"/>',
    'postal': '<rect x="3" y="6" width="18" height="12" rx="1.2"/><path d="M13 8.5v7"/><path d="M15.5 9.8h3M15.5 12.3h3"/><rect x="5.5" y="9" width="4.6" height="4" rx=".5"/>',
    'carregador': '<circle cx="12" cy="13" r="7.5"/><path d="M9.2 12.2a4 4 0 0 1 5.6 0M10.6 14.2a2 2 0 0 1 2.8 0"/>',
    'cabo': '<rect x="4" y="7" width="16" height="10" rx="5"/><path d="M8 12c1.3-1.6 2.7-1.6 4 0s2.7 1.6 4 0"/>',
}
SPRITE = ('<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>'
          + ''.join(f'<symbol id="i-{k}" viewBox="0 0 24 24">{v}</symbol>' for k, v in ICONS.items()) + '</defs></svg>')
def pict(name, cls='pict'):
    return f'<svg class="{cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#i-{name}"/></svg>'

# Seleções editoriais (home, ordem, foto-base, ocasiões, slugs antigos) sobre a base única src/data/produtos.json.
SEL = json.load(open(os.path.join(SRC, 'data', 'selecoes.json'), encoding='utf-8'))
OCCS = SEL['ocasioes']
ALIASES = SEL['aliases']
# banco de imagens de produto (docs/BANCO-IMAGENS.md): uma entrada por imagem; o catálogo agrupa por produto
PRODUTOS = json.load(open(os.path.join(SRC, 'data', 'produtos.json'), encoding='utf-8'))['imagens']
CAT_PROD = {'vestuario': 'Vestuário', 'canetas-escritorio': 'Canetas e escritório', 'bolsas-embalagens': 'Bolsas e embalagens', 'garrafas-copos': 'Garrafas e copos',
            'acessorios': 'Acessórios', 'casa-bem-estar': 'Casa e bem-estar', 'hotelaria-gastronomia': 'Hotelaria e gastronomia'}
# cores de referência sem foto, por categoria (catálogo inicial do pacote tama-home-v2); as demais categorias mostram só a cor da foto
CORES_REF = {'vestuario': [['Vermelho', '#C8202F'], ['Azul royal', '#1F4FB8'], ['Azul-marinho', '#1E2A4A'], ['Preto', '#1E1E1E'], ['Branco', '#F7F5F0'], ['Cinza', '#9A9A98'], ['Verde', '#1F6B45']],
             'hotelaria-gastronomia': [['Preto', '#1E1E1E'], ['Verde', '#1F4A35'], ['Marrom café', '#4A2E22'], ['Havana', '#7A4A2E'], ['Vinho', '#6B1E33'], ['Caramelo', '#A0623A'], ['Azul', '#1E2A4A']]}


def build_catalogo():
    """Um card por modelo (= nome do produto) a partir do inventário: imagens em revisão ou aprovadas, nunca retiradas.
    O id do modelo é o nome sem acentos (polo-masculina). Cada cor com foto vira uma bolinha; a foto-base vem de
    selecoes.json (foto_base) ou é a foto original do modelo."""
    grupos = {}
    for im in sorted(PRODUTOS, key=lambda x: x['id']):
        if im.get('aprovacao') in ('retirada', 'substituir'):
            continue
        grupos.setdefault(im['produto'], []).append(im)
    prio = {m: n for n, m in enumerate(SEL.get('prioridade', []))}
    out = []
    for nome, ims in grupos.items():
        slug = color_slug(nome)
        base_id = SEL.get('foto_base', {}).get(slug)
        originais = [i for i in ims if not (i.get('observacao') or '').startswith('Variação de cor')]
        base = next((i for i in ims if i['id'] == base_id), (originais or ims)[0])
        ims = [base] + [i for i in ims if i is not base]
        cores = [[i['cor']['nome'], i['cor']['hex'], i['id'], i['alt']] for i in ims]
        out.append({'slug': slug, 'nome': nome, 'img': base['id'], 'categoria': base['categoria'], 'descricao': base.get('modelo') or '',
                    'meta': spec_line(base), 'alt': base['alt'], 'cores': cores, 'ocasioes': SEL.get('ocasioes_por_modelo', {}).get(slug, [])})
    ordem = list(CAT_PROD)
    out.sort(key=lambda c: (ordem.index(c['categoria']), prio.get(c['slug'], 999), c['nome']))
    # vizinhos na grade não abrem na mesma cor: troca para a próxima cor com foto (foto-base definida em selecoes.json fica)
    fixas = set(SEL.get('foto_base', {}))
    for ant, c in zip(out, out[1:]):
        if c['cores'][0][0] == ant['cores'][0][0] and c['slug'] not in fixas:
            alt = next((x for x in c['cores'][1:] if x[0] != ant['cores'][0][0]), None)
            if alt:
                c['cores'] = [alt] + [x for x in c['cores'] if x is not alt]
                c['img'], c['alt'] = alt[2], alt[3]
    return out

_MOCK_JSON = os.path.join(SRC, 'data', 'mockups.json')
MOCK_DATA = json.load(open(_MOCK_JSON, encoding='utf-8')) if MOCKUPS and os.path.exists(_MOCK_JSON) else {}
CAP = 'Imagem ilustrativa'
CAPS = 'Imagens ilustrativas'
# Nota única sob as grades de produto: a mesma em todo o site.
NOTE_IMAGENS = ('Imagens ilustrativas com a marca TaMa como exemplo: no seu projeto entram a marca e as cores da sua empresa. '
                'Cores de referência, sem declaração de estoque. Modelo, material e personalização são confirmados na proposta.')
NOTE_MOCKUPS = ('Os produtos exibidos usam a identidade TaMa Creative como exemplo de personalização. No seu projeto, '
                'a marca, as cores e os elementos visuais da sua empresa assumem esse lugar. Imagens ilustrativas; '
                'materiais e técnicas são confirmados na proposta.')


# ------------------------------------------------------------------ images
IMAGES = {}


def build_images():
    from PIL import Image
    out = os.path.join(DIST, 'img')
    os.makedirs(out, exist_ok=True)
    cache = os.path.join(ROOT, '.cache', 'img')
    os.makedirs(cache, exist_ok=True)
    sources = [(fn[:-4], os.path.join(IMG_SRC, fn)) for fn in os.listdir(IMG_SRC) if fn.lower().endswith('.jpg')]
    v2 = os.path.join(IMG_SRC, 'v2')
    if os.path.isdir(v2):
        sources += [(fn[:-5], os.path.join(v2, fn)) for fn in os.listdir(v2) if fn.lower().endswith('.webp')]
    produtos = os.path.join(IMG_SRC, 'produtos')   # banco de imagens de produto (src/data/produtos.json); só as usadas entram no site
    if os.path.isdir(produtos):
        usadas = {i['id'] for i in PRODUTOS if i.get('uso') and i.get('aprovacao') not in ('retirada', 'substituir')}
        arquivo = {i['id']: os.path.join(ROOT, i['arquivo'].lstrip('/')) for i in PRODUTOS if i.get('arquivo')}
        for n in sorted(usadas):
            f = arquivo.get(n, os.path.join(produtos, n + '.webp'))
            if os.path.isfile(f):
                sources.append((n, f))
    sources += blog.image_sources(IMG_SRC)  # img/blog/: imagens enviadas pelo editor do blog
    marca = os.path.join(IMG_SRC, 'marca')
    if MOCKUPS and os.path.isdir(marca):  # branded versions replace the v2 photo of the same name
        over = {fn[:-5]: os.path.join(marca, fn) for fn in os.listdir(marca) if fn.lower().endswith('.webp')}
        sources = [(n, over.pop(n, s)) for n, s in sources] + sorted(over.items())
    for name, src in sorted(sources):
        im = Image.open(src).convert('RGB')
        widths = [w for w in (420, 640, 960, 1280, 1920) if w < im.width - 40] + [im.width]
        if '~' in name:   # colour variants: cards and lightbox never need more than 1280 px
            widths = [w for w in widths if w <= 1280]
        cdir = os.path.join(cache, 'marca') if os.path.basename(os.path.dirname(src)) == 'marca' else cache
        os.makedirs(cdir, exist_ok=True)
        # content hash in the public file name: /img/* is cached for a year (immutable), so an updated image needs a new URL
        stem = f"{name}.{hashlib.md5(open(src, 'rb').read()).hexdigest()[:8]}"
        IMAGES[name] = {'w': im.width, 'h': im.height, 'widths': widths, 'stem': stem, 'src': src}
        for w in widths:
            h = round(im.height * w / im.width)
            for ext, kw in (('avif', {'quality': 52}), ('webp', {'quality': 78, 'method': 6}), ('jpg', {'quality': 80, 'optimize': True, 'progressive': True})):
                # cache pelo hash do conteúdo (stem), não pela data: vale entre máquinas e no build do Netlify (checkout muda as datas)
                cached = os.path.join(cdir, f'{stem}-{w}.{ext}')
                if not os.path.exists(cached):
                    r = im if w == im.width else im.resize((w, h), Image.LANCZOS)
                    r.save(cached, 'JPEG' if ext == 'jpg' else ext.upper(), **kw)
                IMG_FILES.setdefault(stem, []).append((cached, os.path.join(out, f'{stem}-{w}.{ext}')))


OG_USADAS = set()   # imagens usadas como og:image (recortadas em 1200 × 630 no fim do build)
IMG_FILES = {}   # stem -> [(arquivo no cache, destino em dist/img)]; só os referenciados são publicados


def og_images():
    """Recorta a imagem de compartilhamento de cada página em 1200 × 630 (proporção dos cards de redes sociais)."""
    from PIL import Image
    os.makedirs(os.path.join(DIST, 'og'), exist_ok=True)
    for name in OG_USADAS:
        m = IMAGES[name]
        im = Image.open(m['src']).convert('RGB')
        k = max(1200 / im.width, 630 / im.height)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        x, y = (im.width - 1200) // 2, (im.height - 630) // 2
        im.crop((x, y, x + 1200, y + 630)).save(os.path.join(DIST, 'og', m['stem'] + '.jpg'), 'JPEG', quality=84, optimize=True, progressive=True)


def publish_used_images():
    """Copia para dist/img só as imagens que alguma página, script, CSS ou feed referencia (pelo stem com hash)."""
    texto = ''.join(open(os.path.join(dp, f), encoding='utf-8', errors='ignore').read()
                    for dp, _, fs in os.walk(DIST) for f in fs if f.endswith(('.html', '.js', '.css', '.xml', '.json', '.yml')))
    usados = [st for st in IMG_FILES if st in texto]
    for st in usados:
        for src, dst in IMG_FILES[st]:
            shutil.copy2(src, dst)
    print(f'imagens: {len(usados)} de {len(IMG_FILES)} usadas nas páginas')


def img_url(name, ext='webp', min_w=640):
    m = IMAGES[name]
    w = next((x for x in m['widths'] if x >= min_w), m['widths'][-1])
    return f'/img/{m["stem"]}-{w}.{ext}'


def picture(name, alt, sizes, cls='', eager=False, style='', low=False):
    m = IMAGES[name]
    if alt and name in MOCK_DATA:
        alt = MOCK_DATA[name]['alt']
    def srcset(ext):
        return ', '.join(f'/img/{m["stem"]}-{w}.{ext} {w}w' for w in m['widths'])
    fallback = next((w for w in m['widths'] if w >= 640), m['widths'][-1])
    if eager:
        attrs = ' loading="eager" fetchpriority="high"'
    else:
        attrs = ' loading="lazy"' + (' fetchpriority="low"' if low else '')
    cls_attr = f' class="{cls}"' if cls else ''
    style_attr = f' style="{style}"' if style else ''
    return (f'<picture><source type="image/avif" srcset="{srcset("avif")}" sizes="{sizes}">'
            f'<source type="image/webp" srcset="{srcset("webp")}" sizes="{sizes}">'
            f'<img src="/img/{m["stem"]}-{fallback}.jpg" srcset="{srcset("jpg")}" sizes="{sizes}" width="{m["w"]}" height="{m["h"]}"'
            f' alt="{esc(alt)}" decoding="async"{attrs}{cls_attr}{style_attr}></picture>')


def preload_image(name, sizes):
    m = IMAGES[name]
    srcset = ', '.join(f'/img/{m["stem"]}-{w}.avif {w}w' for w in m['widths'])
    return f'<link rel="preload" as="image" type="image/avif" imagesrcset="{srcset}" imagesizes="{sizes}" fetchpriority="high">'


# ------------------------------------------------------------------ catalog helpers


def color_slug(s):
    import unicodedata
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return '-'.join(''.join(c if c.isalnum() else ' ' for c in s).split())


SPEC_RE = re.compile(r'\b(couros?|acr[íi]licos?|alum[íi]nio|inox\w*|a[çc]o|algod[ãa]o|piquet|piqu[êe]|cer[âa]micas?|porcelanas?|bambu|vidros?|madeiras?|pap[ée]is|papel|pl[áa]stic[oa]s?|metal|metais|met[áa]lic[oa]s?|cera|kraft|ecol[óo]gic[oa]s?|corti[çc]a|silicone|poli[ée]ster|linho|\d+(?:[.,]\d+)?\s?(?:ml|l|litros?))\b', re.I)


def preparar_produtos():
    """Entradas criadas no editor (/admin/ › Catálogo): gera o id quando vazio, usa o catálogo como destino padrão e
    barra dado inválido (o build falha e a produção continua como estava)."""
    erros, vistos = [], set()
    for n, im in enumerate(PRODUTOS, 1):
        cor = im.get('cor') or {}
        if not im.get('id'):
            base, tom = color_slug(im.get('produto') or ''), color_slug(cor.get('nome') or '')
            im['id'] = f'{base}~{tom}' if f'{base}~{tom}' not in vistos else f"{base}-{color_slug(im.get('modelo') or str(n))[:40]}~{tom}"
        vistos.add(im['id'])
        im['uso'] = im.get('uso') or ['catalogo']
        nome = f"{im['id']} (item {n})"
        if im.get('categoria') not in CAT_PROD:
            erros.append(f'{nome}: categoria inválida')
        if not re.fullmatch(r'#[0-9A-Fa-f]{6}', cor.get('hex') or ''):
            erros.append(f'{nome}: cor sem hexadecimal (#RRGGBB)')
        if not (im.get('produto') and cor.get('nome') and im.get('alt')):
            erros.append(f'{nome}: produto, nome da cor e texto alternativo são obrigatórios')
        arq = (im.get('arquivo') or '').lstrip('/')
        if arq and not os.path.isfile(os.path.join(ROOT, arq)):
            erros.append(f'{nome}: foto não encontrada ({arq})')
        for k in ('material', 'tecnica'):
            if (im.get(k) or {}).get('status', 'a_confirmar') not in ('a_confirmar', 'confirmado'):
                erros.append(f'{nome}: {k} com status inválido')
    if len(vistos) < len(PRODUTOS):
        erros.append('há ids repetidos no catálogo')
    # Material, capacidade e técnica só aparecem no site quando confirmados: nome, descrição e texto alternativo não
    # podem afirmá-los enquanto o material estiver "a confirmar" (a especificação fica em material/tecnica/observacao).
    for im in PRODUTOS:
        if (im.get('material') or {}).get('status') == 'confirmado':
            continue
        for campo in ('produto', 'modelo', 'alt'):
            m = SPEC_RE.search(im.get(campo) or '')
            if m:
                erros.append(f"{im['id']}: {campo} afirma \"{m.group(0)}\" sem material confirmado")
    if erros:
        raise SystemExit('Catálogo (src/data/produtos.json) com erro:\n  ' + '\n  '.join(erros))


def spec_line(im):
    """Material e técnica só aparecem como especificação quando confirmados (status no editor); o resto fica sob consulta."""
    mat, tec = im.get('material') or {}, im.get('tecnica') or {}
    m_ok, t_ok = mat.get('status') == 'confirmado' and mat.get('valor'), tec.get('status') == 'confirmado' and tec.get('valor')
    if m_ok and t_ok:
        return f"{mat['valor']} · {tec['valor']}"
    if m_ok:
        return f"{mat['valor']} · técnica sob consulta"
    if t_ok:
        return f"Material sob consulta · {tec['valor']}"
    return 'Material e técnica sob consulta'


preparar_produtos()
PRODUTOS_BY = {i['id']: i for i in PRODUTOS}
CATALOGO = build_catalogo()   # depois de color_slug
CATALOGO_BY = {c['slug']: c for c in CATALOGO}
_falta = [m for m in SEL.get('home', []) + SEL.get('prioridade', []) + list(SEL.get('foto_base', {})) + list(SEL.get('ocasioes_por_modelo', {})) + list(ALIASES.values()) if m not in CATALOGO_BY]
if _falta:
    raise SystemExit(f'selecoes.json aponta para modelos que não existem em produtos.json: {sorted(set(_falta))}')


def modelo(slug):
    """Modelo do catálogo por id atual ou por slug antigo (aliases). Id desconhecido para o build: uma página não
    pode perder um card em silêncio (ex.: produto renomeado no /admin/ sem alias em selecoes.json)."""
    m = CATALOGO_BY.get(ALIASES.get(slug, slug))
    if not m:
        raise SystemExit(f'Modelo {slug!r} não existe em produtos.json (renomeado? acrescente o id antigo em aliases de selecoes.json)')
    return m


def catalog_json():
    """Dados dos modelos para a seleção e a foto ampliada: um arquivo só (/assets/catalogo.<hash>.js), em cache entre páginas.
    TAMA_ALIAS leva seleções salvas com slugs antigos para o id atual."""
    data = {c['slug']: {'n': c['nome'], 'i': img_url(c['img'], 'webp', 420), 'c': home_colors(c), 'v': home_variants(c)} for c in CATALOGO}
    js = 'window.TAMA_CAT=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + ';\n'
    return js + 'window.TAMA_ALIAS=' + json.dumps(ALIASES, ensure_ascii=False, separators=(',', ':')) + ';\n'


def swatches(p):
    btns = ''.join(f'<button class="swatch" type="button" style="--c:{hexv}" data-color="{esc(nome)}" aria-label="Cor de referência: {esc(nome)}" aria-pressed="{"true" if i == 0 else "false"}" title="{esc(nome)}"></button>'
                   for i, (nome, hexv) in enumerate(p['cores']))
    return f'<div class="swatches" role="group" aria-label="Cores de referência para {esc(p["nome"])}">{btns}</div>'


def colors_with_photo(h):
    """Só as cores que têm foto própria (mais a primeira, que é a foto-base): nenhuma bolinha de cor fica sem efeito."""
    return [c for i, c in enumerate(h['cores']) if i == 0 or (len(c) > 2 and c[2] in IMAGES)]


def home_colors(h):
    """[[nome, hex], ...]: as cores do destaque sem o nome da foto (formato que swatches() e o site.js esperam)."""
    return [c[:2] for c in colors_with_photo(h)]


def home_variants(h):
    """{cor: [stem, widths, alt]} para cada cor do destaque que tem foto própria. Sem foto, a cor muda só a referência."""
    out = {}
    for c in h['cores']:
        if len(c) > 2 and c[2] in IMAGES:
            out[c[0]] = [IMAGES[c[2]]['stem'], IMAGES[c[2]]['widths'], (c[3] if len(c) > 3 else f"{h['nome']} na cor {c[0].lower()}. Imagem ilustrativa.")]
    return out if len(out) > 1 else {}


def home_product_card(h, eager=False):
    """Card de produto, o único do site (home, catálogo, ocasiões, páginas de frente, blog): foto de estúdio, cores com
    foto própria, seleção e foto ampliada. A bolinha troca a foto pela da cor; nenhuma cor é simulada."""
    cat = f' data-cat="{h["categoria"]}"' if h.get('categoria') in CAT_PROD else ''
    occ = f' data-occ="{" ".join(h["ocasioes"])}"' if h.get('ocasioes') else ''
    return f'''<article class="product studio" id="{h['slug']}" data-slug="{h['slug']}"{cat}{occ}>
  <button class="prod-media" type="button" data-zoom="{h['slug']}" aria-label="Ampliar foto de {esc(h['nome'])}">{picture(h['img'], h['alt'], '(max-width: 760px) 46vw, (max-width: 1180px) 30vw, 290px', eager=eager)}<span class="prod-zoom" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M8 3v10M3 8h10"/></svg></span></button>
  <div class="prod-info">
    <h3>{h['nome']}</h3>
    <p class="prod-desc">{h['descricao']}</p>
    <div class="swatch-row">{swatches(dict(h, cores=home_colors(h)))}<span class="color-name">{h['cores'][0][0]}</span></div>
    <p class="prod-meta">{h['meta']}</p>
    <div class="prod-actions">
      <button class="pick" type="button" data-slug="{h['slug']}" aria-pressed="false"><span class="when-off">+ Selecionar</span><span class="when-on">✓ Selecionado</span><span class="visually-hidden">: {h['nome']}</span></button>
    </div>
  </div>
</article>'''


def catalogo_block():
    """Curadoria: os modelos do banco de imagens, com filtro por categoria (mesmo mecanismo dos trilhos: data-rail-filter)."""
    chips = ('<button class="chip" type="button" data-rail-filter="catalogo-grid" data-value="todas" aria-pressed="true">Todos</button>'
             + ''.join(f'<button class="chip" type="button" data-rail-filter="catalogo-grid" data-value="{k}" aria-pressed="false">{v}</button>' for k, v in CAT_PROD.items()))
    return f'''<section class="section catalogo" id="catalogo" aria-labelledby="catalogo-t" style="padding-top:0">
  <div class="wrap">
    <h2 id="catalogo-t" class="visually-hidden">Modelos</h2>
    <div class="filters" role="group" aria-label="Filtrar o catálogo por categoria" style="flex-wrap:wrap;margin-bottom:22px">{chips}</div>
    <div class="studio-grid" id="catalogo-grid">{''.join(home_product_card(c, eager=i < 2) for i, c in enumerate(CATALOGO))}</div>
    <p class="note" style="margin-top:18px">{NOTE_IMAGENS}</p>
  </div>
</section>'''


def page_catalogo():
    url = SITE + '/catalogo/'
    item_list = {'@type': 'ItemList', '@id': url + '#lista', 'name': 'Catálogo de modelos TaMa Creative', 'numberOfItems': len(CATALOGO),
                 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': c['nome'], 'url': url + '#' + c['slug']} for i, c in enumerate(CATALOGO)]}
    return {
        'path': '/catalogo/', 'assunto': 'peças do catálogo', 'title': f'Catálogo: {len(CATALOGO)} modelos de brindes e confecções | TaMa Creative',
        'og_title': 'Catálogo de modelos · TaMa Creative',
        'description': f'{len(CATALOGO)} modelos para personalizar com a sua marca: vestuário, canetas, bolsas, embalagens, garrafas, acessórios e casa. Monte sua seleção e peça uma proposta.',
        'trail': [('/', 'Início'), ('/catalogo/', 'Catálogo')],
        'wp_type': 'CollectionPage', 'ld_extra': [item_list],
        'body': f'''<section class="page-head" style="padding-bottom:clamp(20px,3vw,32px)">
  <div class="wrap"><div class="section-head" style="margin:0;max-width:54rem">
    <p class="eyebrow">Catálogo</p>
    <h1>{len(CATALOGO)} modelos para a sua marca</h1>
    <p class="lead">Cada modelo aparece com a identidade TaMa como exemplo. Toque na cor de referência, adicione à seleção e envie junto com o pedido de proposta. Modelos, cores, materiais e técnicas são confirmados na proposta.</p>
  </div></div>
</section>
{catalogo_block()}
{end_cta(tipo='brindes')}''',
    }


def studio_block(slugs, title, eyebrow, intro, aria, more=None):
    """Grade de modelos do catálogo para as páginas de frente (brindes, confecções, hotelaria), escolhidos por id."""
    cards = ''.join(home_product_card(m) for m in (modelo(s) for s in slugs) if m)
    more_html = f'<a class="link" href="{more[0]}">{more[1]} {ARROW}</a>' if more else ''
    return f'''<section class="section" aria-labelledby="{aria}">
  <div class="wrap">
    <div class="section-head row"><div class="stack" style="gap:12px"><p class="eyebrow">{eyebrow}</p><h2 id="{aria}" class="section-title">{title}</h2><p class="muted">{intro}</p></div>{more_html}</div>
    <div class="studio-grid">{cards}</div>
    <p class="note" style="margin-top:18px">{NOTE_IMAGENS}</p>
  </div>
</section>'''


def home_products_block():
    cards = ''.join(home_product_card(CATALOGO_BY[s]) for s in SEL['home'])
    return f'''<section class="section home-prods" aria-labelledby="prods-t">
  <div class="wrap">
    <div class="section-head row">
      <div class="stack" style="gap:12px"><p class="eyebrow">Catálogo TaMa</p><h2 id="prods-t" class="section-title">Peças para a sua marca</h2>
      <p class="muted">Cada peça aparece com a marca TaMa como exemplo. No seu projeto, entram a marca e as cores da sua empresa.</p></div>
      <a class="link" href="/catalogo/">Ver os {len(CATALOGO)} modelos do catálogo {ARROW}</a>
    </div>
    <div class="studio-grid">{cards}</div>
    <p class="note">{NOTE_IMAGENS}</p>
  </div>
</section>'''


def product_rail(slugs, rail_id, title_html, intro='', chips=False, more=None):
    """Peças sugeridas (ex.: no fim dos artigos do blog): modelos do catálogo por id ou slug antigo."""
    cards = ''.join(home_product_card(m) for m in (modelo(s) for s in slugs) if m)
    more_html = f'<a class="link" href="{more[0]}">{more[1]} {ARROW}</a>' if more else ''
    return f'''<div class="section-head row"><div class="stack" style="gap:12px">{title_html}{f'<p class="muted">{intro}</p>' if intro else ''}</div>{more_html}</div>
<div class="studio-grid" id="{rail_id}">{cards}</div>
<p class="note" style="margin-top:18px">{NOTE_IMAGENS}</p>'''


def brand_note():
    """'Sua marca é a protagonista.' block with the TaMa x fictional-brand comparison (mockups only)."""
    if not MOCKUPS:
        return ''
    pair = ''
    if 'caderno-azul--casa-mirelo' in IMAGES and 'caderno-azul' in IMAGES:
        sz = '(max-width: 760px) 44vw, 240px'
        pair = (f'<div class="brand-compare"><figure>{picture("caderno-azul", "x", sz)}<figcaption>TaMa Creative</figcaption></figure>'
                f'<figure>{picture("caderno-azul--casa-mirelo", "x", sz)}<figcaption>Casa Mirelo · marca fictícia</figcaption></figure></div>')
    return f'''<div class="brand-note">
  <div class="stack" style="gap:10px"><p class="eyebrow">Personalização</p><h2 class="section-title">Sua marca é a protagonista.</h2>
  <p class="muted">Os produtos exibidos são exemplos de personalização com a identidade TaMa Creative. No seu projeto, a marca, as cores e os elementos visuais da sua empresa assumem esse lugar.</p>
  <p class="note">Uma peça, aplicada com a marca de cada empresa.</p></div>
  {pair}
</div>'''


COLLECTIONS = [
    ('boas-vindas', 'Boas-vindas', 'Receba novas pessoas com identidade e cuidado.', 'kitp-kit-pratico'),
    ('eventos', 'Eventos', 'Presença de marca em cada encontro.', 'conf-evento-camisetas'),
    ('executivos', 'Presentes executivos', 'Gestos refinados para relações importantes.', 'kitp-kit-executivo'),
    ('campanhas', 'Campanhas e ativações', 'Degustações, promoções e ações no ponto de venda.', 'conf-degustacao'),
    ('lancamentos', 'Lançamentos', 'Peças para apresentar um produto ou uma novidade.', 'papelaria-cores'),
    ('fim-de-ano', 'Fim de ano', 'Presentes para encerrar o ano perto de quem importa.', 'embalagem-presente'),
]


def collections_block(title='Coleções por ocasião'):
    cards = ''.join(
        f'<a class="collection" href="/brindes-corporativos-premium/?ocasiao={k}#pecas">{picture(img, "", "(max-width: 760px) 84vw, (max-width: 980px) 46vw, 300px")}'
        f'<div class="collection-copy"><h3>{t}</h3><p>{d}</p></div><span class="collection-arr" aria-hidden="true">{ARROW}</span></a>'
        for k, t, d, img in COLLECTIONS)
    return f'''<section class="section" aria-labelledby="col-t" style="padding-top:clamp(24px,3vw,40px)">
  <div class="wrap">
    <div class="section-head row">
      <div class="stack" style="gap:12px"><p class="eyebrow">Para cada momento</p><h2 id="col-t" class="section-title">{title}</h2><p class="muted">Seleções que combinam peças, acabamentos e boas ideias para cada ocasião.</p></div>
      <div class="rail-arrows"><button class="icon-btn" type="button" data-rail-prev="col-rail" aria-label="Coleções anteriores"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button><button class="icon-btn" type="button" data-rail-next="col-rail" aria-label="Próximas coleções"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button></div>
    </div>
    <div class="collections-rail" id="col-rail">{cards}</div>
  </div>
</section>'''


# Kits premium da home (fotos da apresentação TaMa, pacote tama-home-v2): dois destaques e três menores.
# As ocasiões continuam como atalhos para a curadoria filtrada.
HOME_KITS = [
    ('gelato-experience', 'Gelato Experience', 'Duas taças, duas colheres longas, colher de servir e três toppings. Caixa e cartão personalizados.'),
    ('mesa-de-descobertas', 'Mesa de Descobertas', 'Bandeja, dois potinhos, espátula, faca, geleia e mel. Caixa e cartões de harmonização.'),
    ('kit-pratico', 'Kit Prático', 'Bloco de notas, kit mouse, porta-trecos, porta-lápis, estojo e embalagem personalizada.'),
    ('em-movimento', 'Em Movimento', 'Mochila, nécessaire, pasta executiva, tag de mala e porta-passaporte.'),
    ('pausa-e-inspiracao', 'Pausa e Inspiração', 'Caderno com amarração, vela em copo com cinta, caixa e cartão.'),
]


def kit_cards():
    """Os kits premium (home e página de kits): dois destaques e três menores."""
    return ''.join(
        f'<article class="kit-card{" big" if i < 2 else ""}">'
        f'{picture("kitp-" + slug, f"{name}: {desc}", "(max-width: 760px) 92vw, 46vw" if i < 2 else "(max-width: 760px) 92vw, 31vw")}'
        f'<div class="kit-copy"><p class="eyebrow">Kit {i + 1:02d}</p><h3>{name}</h3><p>{desc}</p>'
        f'<a class="link" href="/solicitar-proposta/?tipo=kits&amp;interesse={urllib.parse.quote(name if name.startswith("Kit") else "Kit " + name)}" data-track="cta_solicitar_proposta" data-track-label="kit-{slug}" data-interesse="{name if name.startswith('Kit') else 'Kit ' + name}">Quero este kit {ARROW}</a></div></article>'
        for i, (slug, name, desc) in enumerate(HOME_KITS))


def kits_block():
    cards = kit_cards()
    occ = ''.join(f'<a class="chip" href="/brindes-corporativos-premium/?ocasiao={k}#pecas">{t}</a>' for k, t, _d, _img in COLLECTIONS)
    return f'''<section class="section kits-home" aria-labelledby="kits-t">
  <div class="wrap">
    <div class="section-head row">
      <div class="stack" style="gap:12px"><p class="eyebrow">Kits premium</p><h2 id="kits-t" class="section-title">Presentes que marcam momentos.</h2><p class="muted">Seleções para surpreender, agradecer e criar conexões. Cada composição se ajusta ao seu público e à sua marca.</p></div>
      <a class="link" href="/kits-corporativos/">Ver todos os kits {ARROW}</a>
    </div>
    <div class="kit-grid">{cards}</div>
    <div class="kit-foot">
      <nav class="kit-occ" aria-label="Peças por ocasião"><span>Para cada momento:</span>{occ}</nav>
      {cta_link('Solicitar proposta de kit', tipo='kits', track_label='home-kits')}
    </div>
    <p class="note">Os kits aparecem na identidade TaMa como exemplo. No seu projeto, caixa, cartão e peças levam a marca e as cores da sua empresa; a composição é ajustada ao público, à ocasião e ao investimento e confirmada na proposta. Imagens ilustrativas.</p>
  </div>
</section>'''


# ------------------------------------------------------------------ navigation and shared blocks
NAV = [
    ('/brindes-corporativos/', 'Brindes'),
    ('/confeccoes-personalizadas/', 'Confecções'),
    ('/kits-corporativos/', 'Kits'),
    ('/ativacoes-promocionais/', 'Ativações'),
    ('/hotelaria-e-gastronomia/', 'Hotelaria'),
    ('/catalogo/', 'Catálogo'),   # todos os modelos (src/data/produtos.json, editado em /admin/)
    ('/sobre/', 'Sobre'),
    ('/blog/', 'Blog'),
]
BAG_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l-1 12H7z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>'


def cta_link(label='Solicitar proposta', tipo=None, cls='btn btn-wine', arrow=True, track_label=None):
    href = '/solicitar-proposta/' + (f'?tipo={tipo}' if tipo else '')
    tl = f' data-track-label="{esc(track_label)}"' if track_label else ''
    return f'<a class="{cls}" href="{href}" data-track="cta_solicitar_proposta"{tl}>{label}{" " + ARROW if arrow else ""}</a>'


def header(path):
    def current(p):
        if path.startswith(p):
            return ' aria-current="page"'
        # as ideias por ocasião fazem parte da frente "Brindes"
        return ' aria-current="true"' if p == '/brindes-corporativos/' and path.startswith('/brindes-corporativos-premium/') else ''
    links = ''.join(f'<a class="nav-link" href="{p}"{current(p)}>{t}</a>' for p, t in NAV)
    return f'''<a class="skip" href="#conteudo">Pular para o conteúdo</a>
<aside class="announce" aria-label="Destaques da TaMa"><div class="wrap"><p>Brindes, confecções, kits e ativações para empresas.</p><ul><li>Atendimento consultivo</li><li>Arte aprovada antes da produção</li><li>Do pedido à entrega</li></ul></div></aside>
<header class="site-header">
  <div class="wrap header-row">
    <a class="brand" href="/" aria-label="TaMa Creative, página inicial">{LOGO_DECOR}</a>
    <nav class="site-nav" id="site-nav" aria-label="Principal">{links}{cta_link(cls='btn btn-wine nav-cta', track_label='menu-celular')}</nav>
    <div class="head-actions">
      <button class="icon-btn bag" type="button" data-open-drawer aria-label="Sua seleção de peças">{BAG_SVG}<span class="bag-count" data-sel-count hidden>0</span></button>
      {cta_link(cls='btn btn-wine btn-sm', track_label='header')}
      <button class="icon-btn menu-btn" id="menu-btn" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Abrir menu"><svg viewBox="0 0 24 24"><path d="M4 8h16M4 16h16"/></svg></button>
    </div>
  </div>
</header>'''


def contact_lines():
    out = []
    if WA:
        out.append(f'<a href="https://wa.me/{WA}" data-track="whatsapp_click" rel="noopener">WhatsApp: {fmt_phone(WA)}</a>')
    if EMAIL:
        out.append(f'<a href="mailto:{esc(EMAIL)}">{esc(EMAIL)}</a>')
    if IG:
        out.append(f'<a href="https://www.instagram.com/{esc(IG)}/" rel="noopener">@{esc(IG)}</a>')
    return out


def fmt_phone(d):
    if d.startswith('55') and len(d) in (12, 13):
        n = d[4:]
        return f'+55 {d[2:4]} {n[:-4]}-{n[-4:]}'
    return '+' + d


def empresa_linha():
    """Razão social, CNPJ e cidade, só quando informados em site.config.json (nada é inventado nem mostrado vazio)."""
    partes = [esc(x) for x in (RAZAO, CNPJ and f'CNPJ {CNPJ}', CIDADE) if x]
    return ' · '.join(partes)


def footer():
    sol = ''.join(f'<li><a href="{p}">{t}</a></li>' for p, t in [('/brindes-corporativos/', 'Brindes corporativos'), ('/confeccoes-personalizadas/', 'Confecções personalizadas'), ('/kits-corporativos/', 'Kits premium'), ('/ativacoes-promocionais/', 'Ativações e degustações'), ('/hotelaria-e-gastronomia/', 'Hotelaria e gastronomia'), ('/catalogo/', 'Catálogo'), ('/brindes-corporativos-premium/', 'Ideias por ocasião')])
    contacts = contact_lines()
    contact_col = ''.join(f'<li>{c}</li>' for c in contacts) + '<li><a href="/solicitar-proposta/">Solicitar proposta</a></li>'
    empresa = empresa_linha()
    return f'''<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="footer-brand"><a class="brand" href="/" aria-label="TaMa Creative, página inicial">{LOGO_DECOR}</a><p>Brindes, confecções, kits e ativações para empresas. Desenvolvemos e coordenamos cada projeto, da escolha das peças à entrega.</p></div>
    <div><p class="footer-title">Soluções</p><ul class="footer-links">{sol}</ul></div>
    <div><p class="footer-title">TaMa</p><ul class="footer-links"><li><a href="/sobre/">Sobre</a></li><li><a href="/blog/">Blog</a></li><li><a href="/privacidade/">Privacidade</a></li></ul></div>
    <div><p class="footer-title">Contato</p><ul class="footer-links">{contact_col}</ul></div>
  </div>
  <div class="wrap footer-bottom">
    <div class="left">{SELO}<span>© {date.today().year} TaMa Creative{(' · ' + empresa) if empresa else ''}</span></div>
    <span>{NOTE_MOCKUPS if MOCKUPS else 'Imagens ilustrativas; não representam estoque nem trabalhos para clientes.'}</span>
  </div>
</footer>'''


def crumbs(trail):
    lis = []
    for i, (p, label) in enumerate(trail):
        lis.append(f'<li><span aria-current="page">{label}</span></li>' if i == len(trail) - 1 else f'<li><a href="{p}">{label}</a></li>')
    return f'<nav class="crumbs wrap" aria-label="Caminho"><ol>{"".join(lis)}</ol></nav>'


def end_cta(title='Conte o que você precisa.', text='Ocasião, público, quantidade e data: com isso a TaMa responde com uma proposta de peças, personalização e condições.', tipo=None, eyebrow='Solicitar proposta'):
    return f'''<section class="end-cta" aria-labelledby="cta-t">
  <div class="wrap"><p class="eyebrow light">{eyebrow}</p><h2 id="cta-t">{title}</h2><p>{text}</p>
  <div class="actions" style="justify-content:center">{cta_link('Solicitar uma proposta', tipo=tipo, cls='btn btn-light', track_label='end-cta')}{wa_button('btn btn-glass')}</div></div>
</section>'''


def wa_button(cls='btn btn-line', text='Conversar no WhatsApp'):
    if not WA:
        return ''
    msg = urllib.parse.quote('Olá, TaMa! Gostaria de conversar sobre um projeto.')
    return f'<a class="{cls}" href="https://wa.me/{WA}?text={msg}" data-track="whatsapp_click" rel="noopener">{CHAT} {text}</a>'


def faq(items, title='Boas ideias começam com boas perguntas.', eyebrow='Conversa direta'):
    det = ''.join(f'<details><summary>{q}</summary><p>{a}</p></details>' for q, a in items)
    return f'''<section class="section" aria-labelledby="faq-t">
  <div class="wrap faq-grid">
    <div class="stack" style="gap:12px"><p class="eyebrow">{eyebrow}</p><h2 id="faq-t" class="section-title">{title}</h2></div>
    <div class="faq-list">{det}</div>
  </div>
</section>'''


# Método TaMa em 6 etapas: faixa "Do briefing à entrega." da home (process_band) e variante clara em /kits-corporativos/.
# Ícones de linha originais, desenhados para o site numa grade 48×48 (sem dependência nem licença de terceiros).
STEP_ICONS = {
    'briefing': '<path d="M18 26h-2l-6 5v-5a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v8"/><path d="M22 20h16a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4v5l-6-5H22a4 4 0 0 1-4-4V24a4 4 0 0 1 4-4z"/><circle cx="30" cy="29" r="5.5"/><circle cx="30" cy="29" r="2.2"/>',
    'curadoria': '<path d="M31 10H7a3 3 0 0 0-3 3v24a3 3 0 0 0 3 3h28a3 3 0 0 0 3-3V17"/><path d="M4 17h34"/><circle cx="8.5" cy="13.5" r=".6"/><circle cx="12" cy="13.5" r=".6"/><circle cx="15.5" cy="13.5" r=".6"/><rect x="9" y="22" width="24" height="13" rx="1.5"/><circle cx="16" cy="26.5" r="1.8"/><path d="M33 30l-6.5-4.5L12 35"/><path d="M40 2c.5 3.6 2.4 5.5 6 6-3.6.5-5.5 2.4-6 6-.5-3.6-2.4-5.5-6-6 3.6-.5 5.5-2.4 6-6z"/>',
    'proposta': '<path d="M17 8h-4a3 3 0 0 0-3 3v28a3 3 0 0 0 3 3h22a3 3 0 0 0 3-3V11a3 3 0 0 0-3-3h-4"/><rect x="17" y="5" width="14" height="6" rx="1.5"/><path d="M16 19h16M16 25h16M16 31h10"/>',
    'aprovacao': '<path d="M38 25V11a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v22a3 3 0 0 0 3 3h19"/><path d="M4 15h34"/><circle cx="8.5" cy="11.5" r=".6"/><circle cx="12" cy="11.5" r=".6"/><circle cx="15.5" cy="11.5" r=".6"/><rect x="9" y="20" width="10" height="10" rx="1"/><path d="M23 21h10M23 25.5h6"/><circle cx="36" cy="35" r="8"/><path d="M32.5 35.2l2.4 2.4 4.6-4.8"/>',
    'producao': '<path d="M20.6 8.9l.9-4.2a19.5 19.5 0 0 1 5 0l.9 4.2a15.5 15.5 0 0 1 4.9 2l3.6-2.4a19.5 19.5 0 0 1 3.6 3.6l-2.4 3.6a15.5 15.5 0 0 1 2 4.9l4.2.9a19.5 19.5 0 0 1 0 5l-4.2.9a15.5 15.5 0 0 1-2 4.9l2.4 3.6a19.5 19.5 0 0 1-3.6 3.6l-3.6-2.4a15.5 15.5 0 0 1-4.9 2l-.9 4.2a19.5 19.5 0 0 1-5 0l-.9-4.2a15.5 15.5 0 0 1-4.9-2l-3.6 2.4a19.5 19.5 0 0 1-3.6-3.6l2.4-3.6a15.5 15.5 0 0 1-2-4.9l-4.2-.9a19.5 19.5 0 0 1 0-5l4.2-.9a15.5 15.5 0 0 1 2-4.9l-2.4-3.6a19.5 19.5 0 0 1 3.6-3.6l3.6 2.4a15.5 15.5 0 0 1 4.9-2z"/><path d="M24 16l6.9 4v8L24 32l-6.9-4v-8z"/><path d="M17.1 20l6.9 4 6.9-4M24 24v8"/>',
    'entrega': '<path d="M6 18h5M4 23h7M7 28h4"/><path d="M17.5 34H16a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v20"/><path d="M24.5 34h10"/><path d="M32 19h7l5 7v6a2 2 0 0 1-2 2h-.5"/><path d="M32 26h12"/><circle cx="21" cy="34" r="3.5"/><circle cx="38" cy="34" r="3.5"/>',
}
STEPS = [
    ('Briefing', 'Entendemos objetivo, público, ocasião, prazo e investimento do projeto.', 'briefing'),
    ('Curadoria', 'Selecionamos ideias, materiais, acabamentos e caminhos criativos para sua marca.', 'curadoria'),
    ('Proposta', 'Apresentamos solução, peças, quantidades, personalização e condições comerciais.', 'proposta'),
    ('Aprovação', 'Validamos arte, aplicações, especificações e detalhes antes da produção.', 'aprovacao'),
    ('Produção', 'Coordenamos fornecedores, materiais e execução com atenção aos acabamentos.', 'producao'),
    ('Entrega', 'Acompanhamos a conferência com os fornecedores e organizamos a entrega conforme o cronograma.', 'entrega'),
]


def steps_html(light=False):
    return f'<ol class="process-steps{" light" if light else ""}" role="list">' + ''.join(
        f'<li class="process-step"><span class="process-num" aria-hidden="true">{i + 1:02d}</span>'
        f'<svg class="process-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">{STEP_ICONS[k]}</svg>'
        f'<h3>{t}</h3><p>{d}</p></li>' for i, (t, d, k) in enumerate(STEPS)) + '</ol>'


def process_band():
    return f'''<section class="process" aria-labelledby="proc-t">
  <div class="wrap">
    <div class="process-grid">
      <div class="process-intro"><h2 id="proc-t">Do briefing<br>à entrega.</h2><p>Seis etapas, do briefing à entrega, com a arte aprovada por você antes da produção.</p></div>
      {steps_html()}
    </div>
    <div class="process-cta">
      <div><h3>Pronto para tirar sua ideia do papel?</h3><p>Envie objetivo, público e data: a proposta traz peças, quantidades e condições.</p></div>
      {cta_link(cls='btn btn-light', track_label='process')}
    </div>
  </div>
</section>'''


def page_head(eyebrow, h1, lead, actions, img=None, alt='', obj=''):
    media = ''
    if img:
        media = f'<figure class="page-media">{picture(img, alt, "(max-width: 760px) 92vw, 46vw", eager=True, style=obj)}<figcaption>{CAP}</figcaption></figure>'
    return f'''<section class="page-head">
  <div class="wrap split">
    <div class="copy"><p class="eyebrow">{eyebrow}</p><h1>{h1}</h1><p class="lead">{lead}</p><div class="actions">{actions}</div></div>
    {media}
  </div>
</section>'''


# ------------------------------------------------------------------ JSON-LD
ORG_ID = SITE + '/#org'


def org():
    o = {'@type': 'Organization', '@id': ORG_ID, 'name': 'TaMa Creative', 'url': SITE + '/', 'logo': SITE + '/logo-512.png',
         'slogan': 'Sua marca ganha forma.',
         'description': 'Brindes corporativos, confecções personalizadas, kits premium e ativações promocionais para empresas.'}
    if IG:
        o['sameAs'] = [f'https://www.instagram.com/{IG}/']
    if RAZAO:
        o['legalName'] = RAZAO
    if CNPJ:
        o['taxID'] = CNPJ
    if CIDADE:
        o['address'] = {'@type': 'PostalAddress', 'addressLocality': CIDADE, 'addressCountry': 'BR'}
    cp = {}
    if EMAIL:
        cp['email'] = EMAIL
    if WA:
        cp['telephone'] = '+' + WA
    if cp:
        o['contactPoint'] = [dict({'@type': 'ContactPoint', 'contactType': 'sales', 'availableLanguage': 'pt-BR'}, **cp)]
    return o


def jsonld(page):
    url = SITE + page['path']
    graph = [org(), {'@type': 'WebSite', '@id': SITE + '/#website', 'url': SITE + '/', 'name': 'TaMa Creative', 'inLanguage': 'pt-BR', 'publisher': {'@id': ORG_ID}}]
    wp = {'@type': page.get('wp_type', 'WebPage'), '@id': url + '#webpage', 'url': url, 'name': page['title'], 'description': page['description'],
          'isPartOf': {'@id': SITE + '/#website'}, 'inLanguage': 'pt-BR'}
    if page.get('trail'):
        wp['breadcrumb'] = {'@id': url + '#breadcrumb'}
        graph.append({'@type': 'BreadcrumbList', '@id': url + '#breadcrumb', 'itemListElement': [
            {'@type': 'ListItem', 'position': i + 1, 'name': re.sub('<[^>]+>', '', label), 'item': SITE + p} for i, (p, label) in enumerate(page['trail'])]})
    graph.append(wp)
    if page.get('service'):
        s = page['service']
        graph.append({'@type': 'Service', '@id': url + '#service', 'name': s['name'], 'serviceType': s['type'], 'description': page['description'],
                      'provider': {'@id': ORG_ID}, 'url': url, 'inLanguage': 'pt-BR'})
    graph.extend(page.get('ld_extra', []))
    return json.dumps({'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False, separators=(',', ':'))


# ------------------------------------------------------------------ page shell
def minify_css(css):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    css = re.sub(r'\s+', ' ', css)
    return re.sub(r'\s*([{};,>])\s*', r'\1', css).replace(';}', '}').strip()


CSS = None
CSS_FILE = None
CAT_FILE = None
JS_FILE = None

DIALOGS = '''<dialog class="drawer" id="drawer" aria-labelledby="drawer-t">
  <div class="drawer-inner">
    <div class="drawer-head"><div><p class="eyebrow">Para o pedido de proposta</p><h2 id="drawer-t">Sua seleção.</h2><p class="muted">Peças e cores de referência para o seu pedido de proposta.</p></div>
      <button class="icon-btn" type="button" data-close-dialog aria-label="Fechar seleção"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="drawer-body"><ul class="picked-list" id="drawer-list"></ul><p class="empty" id="drawer-empty">Sua seleção começa aqui. Toque em “+ Selecionar” nas peças de que gostar.</p></div>
    <div class="drawer-foot"><a class="btn btn-wine" href="/solicitar-proposta/" data-track="cta_solicitar_proposta" data-track-label="drawer">Montar pedido com a seleção ''' + '{ARROW}' + '''</a><button class="btn btn-line" type="button" data-clear-selection>Limpar seleção</button></div>
  </div>
</dialog>
<dialog class="lightbox" id="lightbox" aria-labelledby="lb-title">
  <button class="icon-btn lightbox-close" type="button" data-close-dialog aria-label="Fechar foto"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
  <div class="lightbox-body"><img id="lb-img" alt="" width="850" height="780"><div><p class="eyebrow">{LB_EYEBROW}</p><h2 id="lb-title"></h2><p class="muted" id="lb-desc"></p><div id="lb-swatches"></div><p class="prod-meta" id="lb-meta"></p><div class="actions" style="margin-top:16px"><button class="pick" type="button" id="lb-pick" aria-pressed="false"><span class="when-off">+ Selecionar</span><span class="when-on">✓ Selecionado</span></button></div></div></div>
</dialog>
<button class="float-bag" type="button" data-open-drawer hidden>''' + BAG_SVG + '''<span><span data-sel-count-text>0 peças</span> na seleção</span></button>
<div class="toast" id="toast" role="status" aria-live="polite"></div>'''


def shell(page, body):
    url = SITE + page['path']
    robots = 'index, follow' if page.get('index', True) else 'noindex, follow'
    og_img, og_w, og_h = SITE + page.get('og_image', '/og-default.jpg'), 1200, 630
    if page.get('og') in IMAGES:   # imagem da própria página, recortada em 1200 × 630 por og_images()
        og_img = SITE + f'/og/{IMAGES[page["og"]]["stem"]}.jpg'
        OG_USADAS.add(page['og'])
    config = json.dumps({'whatsapp': WA, 'ga4': GA4}, separators=(',', ':'))
    consent = ''
    if GA4:
        consent = ('<div class="consent" id="consent" role="dialog" aria-label="Privacidade" hidden><p>Usamos cookies de análise (Google Analytics) para entender como o site é usado. '
                   'Você pode aceitar ou recusar. <a href="/privacidade/">Saiba mais</a>.</p>'
                   '<div class="actions"><button class="btn btn-wine btn-sm" type="button" data-consent="granted">Aceitar</button>'
                   '<button class="btn btn-line btn-sm" type="button" data-consent="denied">Recusar</button></div></div>')
    wa_float = ''
    if WA:
        msg = urllib.parse.quote('Olá, TaMa! Gostaria de conversar sobre um projeto.')
        wa_float = f'<aside aria-label="Atendimento por WhatsApp"><a class="wa-float" href="https://wa.me/{WA}?text={msg}" target="_blank" data-track="whatsapp_click" data-track-label="flutuante" rel="noopener" aria-label="Conversar com a TaMa no WhatsApp" title="Conversar no WhatsApp">{CHAT}</a></aside>'
    service_attr = (f' data-service="{page["service"]["key"]}"' if page.get('service') else '') + (f' data-assunto="{esc(page["assunto"])}"' if page.get('assunto') else '')
    canonical = '' if page['path'].endswith('.html') else f'<link rel="canonical" href="{url}">'
    return f'''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(page['title'])}</title>
<meta name="description" content="{esc(page['description'])}">
{canonical}
<meta name="robots" content="{robots}">
<link rel="preload" href="/fonts/dm-sans-normal-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/playfair-display-normal-latin.woff2" as="font" type="font/woff2" crossorigin>
{page.get('preload', '')}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#FAF7F2">
<meta property="og:type" content="{page.get('og_type', 'website')}">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="TaMa Creative">
<meta property="og:title" content="{esc(page.get('og_title', page['title']))}">
<meta property="og:description" content="{esc(page['description'])}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{og_img}">
<meta property="og:image:width" content="{og_w}">
<meta property="og:image:height" content="{og_h}">
<meta property="og:image:alt" content="{esc(page.get('og_title', page['title']))}">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/assets/{CSS_FILE}">
{page.get('head', '')}
<script type="application/ld+json">{jsonld(page)}</script>
<script id="tama-config" type="application/json">{config}</script>
<script src="/assets/{CAT_FILE}" defer></script>
<script src="/assets/{JS_FILE}" defer></script>
</head>
<body{service_attr}>
{SPRITE}
{header(page['path'])}
<main id="conteudo" tabindex="-1">
{crumbs(page['trail']) if page.get('trail') else ''}
{body}
</main>
{footer()}
{DIALOGS.replace('{ARROW}', ARROW).replace('{LB_EYEBROW}', CAP + ' · personalizável com a sua marca')}
{wa_float}
{consent}
</body>
</html>
'''


# ------------------------------------------------------------------ pages
HOME_FAQ = [
    ('O que a TaMa faz?', 'Desenvolve e coordena brindes, confecções, kits personalizados e ativações promocionais para empresas: entende o objetivo, propõe as peças, coordena a aplicação da sua marca com os fornecedores e acompanha a produção com fornecedores até a entrega.'),
    ('Posso personalizar produtos nas cores da minha marca?', 'Sim. A escolha de cores e acabamentos faz parte da proposta de cada projeto. As cores mostradas no site são referências visuais e não significam estoque; a disponibilidade é confirmada na proposta.'),
    ('Vocês desenvolvem kits completos?', 'Sim. A proposta combina curadoria, materiais, embalagem e personalização para criar conjuntos com a mesma linguagem visual.'),
    ('Existe quantidade mínima?', 'Depende do produto e da técnica de personalização. Informe a quantidade aproximada no pedido: se não for viável para a peça escolhida, a proposta indica alternativas.'),
    ('Qual é o prazo de produção?', 'É definido conforme o briefing, as quantidades e os acabamentos aprovados, e informado antes da confirmação do projeto. Informe a data desejada no pedido.'),
]


ASSURANCES = '''<ul class="assurances wrap" aria-label="Como a TaMa trabalha">
  <li><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M4 13h16M12 9v11"/><path d="M12 9c-1.6-3.6-6-3.6-5.2-.6.4 1.4 3.3.6 5.2.6zM12 9c1.6-3.6 6-3.6 5.2-.6-.4 1.4-3.3.6-5.2.6z"/></svg>Peças escolhidas com você</li>
  <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5.5c0 4.3-3 7.8-7 9.5-4-1.7-7-5.2-7-9.5V6z"/><path d="M8.8 12.2l2.2 2.2 4.3-4.6"/></svg>Arte aprovada antes da produção</li>
  <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l7-7"/></svg>Produção coordenada até a entrega</li>
</ul>'''


def hero_carousel(slides=None, label='Destaques da TaMa Creative', assurances=True):
    # Fotos claras de estúdio (pacote tama-home-v2). No computador a foto ocupa a metade direita e se funde ao tom do
    # slide (creme, sálvia, rosé, linho); o texto fica numa coluna própria, sem encostar nos produtos. No celular o texto
    # vem acima da foto. frame: enquadramento da foto (--fx no computador, --fx-m no celular) e largura (--pw).
    slides = slides or [
        ('tone-cream', 'hero-brindes', '--fx:100%;--fx-m:96%', 'Ecobag, squeeze, caderno com caneta, power bank, taça e copo com a marca TaMa aplicada como exemplo.', 'Para empresas', 'Brindes, confecções e ativações para dar <em>presença à sua marca</em>.',
         'Criamos e coordenamos soluções personalizadas para empresas, da escolha das peças à entrega.',
         cta_link('Solicitar proposta', track_label='hero-1') + '<a class="btn btn-line" href="/catalogo/">Ver produtos ' + ARROW + '</a>'),
        ('tone-sage', 'hero-v3-confeccoes', '--fx:72%;--fx-m:72%', 'Polo vermelha, moletom azul royal e camiseta branca com a marca TaMa.', 'Confecções personalizadas', 'Sua marca no <em>uniforme</em> da equipe.',
         'Polos, camisetas, moletons, dólmãs e aventais nas cores definidas no projeto.',
         cta_link('Solicitar proposta', tipo='confeccoes', track_label='hero-2') + '<a class="btn btn-line" href="/confeccoes-personalizadas/">Conhecer soluções ' + ARROW + '</a>'),
        ('tone-rose', 'hero-kits', '--fx:100%;--fx-m:80%', 'Caixa bordô aberta com tábua, potinhos, geleias, facas de queijo e cartão com a marca TaMa.', 'Kits premium', 'Kits pensados de <em>ponta a ponta</em>.',
         'Caixa, peças e cartão com a sua marca, compostos para surpreender, agradecer e aproximar.',
         cta_link('Solicitar proposta de kit', tipo='kits', track_label='hero-3') + '<a class="btn btn-line" href="/kits-corporativos/">Conhecer os kits ' + ARROW + '</a>'),
        ('tone-linen', 'conf-degustacao', '--fx:42%;--fx-m:40%', 'Cena ilustrativa: equipe de camiseta e avental com a marca TaMa servindo degustação num supermercado.', 'Ativações e degustações', 'Sua marca perto de quem <em>compra</em>.',
         'Degustações, ações em feiras e eventos e promoções no ponto de venda, com uniformes, materiais e brindes na identidade da sua marca.',
         cta_link('Planejar uma ativação', tipo='ativacoes', track_label='hero-4') + '<a class="btn btn-line" href="/ativacoes-promocionais/">Conhecer ativações ' + ARROW + '</a>'),
    ]
    n = len(slides)
    out = []
    for i, (tone, img, frame, alt, eyebrow, title, desc, actions) in enumerate(slides):
        tag = 'h1' if i == 0 else 'p'
        out.append(f'''<div class="slide {tone}{' is-active' if i == 0 else ''}" id="slide-{i + 1}" role="group" aria-roledescription="slide" aria-label="{i + 1} de {n}" style="{frame}"{'' if i == 0 else ' aria-hidden="true" inert'}>
  <div class="wrap slide-inner"><div class="slide-copy">
    <p class="eyebrow">{eyebrow}</p>
    <{tag} class="slide-title">{title}</{tag}>
    <p class="slide-desc">{desc}</p>
    <div class="actions">{actions}</div>
  </div></div>
  <div class="slide-photo">{picture(img, alt, '(max-width: 760px) 200vw, (max-width: 1100px) 140vw, 100vw' if i == 0 else '(max-width: 760px) 100vw, (max-width: 1100px) 140vw, 100vw', eager=(i == 0), low=(i > 0))}</div>
</div>''')
    dots = ''.join(f'<button class="dot" type="button" data-slide="{i}" aria-label="Mostrar slide {i + 1} de {n}" aria-controls="slide-{i + 1}"{" aria-current=\"true\"" if i == 0 else ""}></button>' for i in range(n))
    strip = ASSURANCES if assurances else ''
    return f'''<section class="hero light" aria-roledescription="carrossel" aria-label="{label}" id="hero">
  {''.join(out)}
  <div class="hero-bar"><div class="wrap hero-controls">
    <p class="hero-count" aria-hidden="true"><span data-hero-count>01</span> / {n:02d}</p>
    <div class="hero-dots">{dots}</div>
    <button class="hero-arrow prev" type="button" data-hero-prev aria-label="Slide anterior"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
    <button class="hero-arrow next" type="button" data-hero-next aria-label="Próximo slide"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
    <button class="hero-pause" type="button" data-hero-pause aria-pressed="false" aria-label="Pausar troca automática"><svg class="i-pause" viewBox="0 0 24 24"><path d="M9 6v12M15 6v12"/></svg><svg class="i-play" viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg></button>
  </div></div>
  <p class="hero-caption">{CAPS}</p>
</section>
{strip}'''


def page_home():
    return {
        'path': '/', 'title': 'TaMa Creative | Brindes, confecções, kits e ativações', 'og': 'hero-brindes',
        'og_title': 'TaMa Creative · Brindes, confecções e ativações para empresas',
        'description': 'Brindes corporativos, uniformes, kits e ativações promocionais com a marca da sua empresa. A TaMa cria e coordena da escolha das peças à entrega.',
        'assunto': 'um projeto para a minha empresa',
        'preload': preload_image('hero-brindes', '(max-width: 760px) 200vw, (max-width: 1100px) 140vw, 100vw'),
        'body': hero_carousel() + f'''
<section class="services" aria-labelledby="frentes-t">
  <h2 id="frentes-t" class="visually-hidden">O que a TaMa faz</h2>
  <div class="wrap service-grid cinco">
    <a class="service-card split" href="/brindes-corporativos/">{picture('home-card-brindes', '', '(max-width: 760px) 46vw, 16vw', style='object-position:78% center')}<div class="service-info"><h3>Brindes corporativos</h3><p>Peças para clientes, equipes e eventos.</p><span class="link">Ver brindes {ARROW}</span></div></a>
    <a class="service-card split" href="/confeccoes-personalizadas/">{picture('home-confeccoes', '', '(max-width: 760px) 46vw, 16vw', style='object-position:57% 80%')}<div class="service-info"><h3>Confecções personalizadas</h3><p>Polos, camisetas, moletons, dólmãs e aventais.</p><span class="link">Ver confecções {ARROW}</span></div></a>
    <a class="service-card split" href="/kits-corporativos/">{picture('home-kits', '', '(max-width: 760px) 46vw, 16vw', style='object-position:72% center')}<div class="service-info"><h3>Kits premium</h3><p>Caixa, peças e cartão para cada ocasião.</p><span class="link">Ver kits {ARROW}</span></div></a>
    <a class="service-card split" href="/ativacoes-promocionais/">{picture('conf-degustacao', '', '(max-width: 760px) 46vw, 24vw', style='object-position:40% center')}<div class="service-info"><h3>Ativações e degustações</h3><p>Ações em eventos, feiras e pontos de venda.</p><span class="link">Ver ativações {ARROW}</span></div></a>
    <a class="service-card split" href="/hotelaria-e-gastronomia/">{picture('conf-chef-dolma', '', '(max-width: 760px) 46vw, 24vw', style='object-position:76% 20%')}<div class="service-info"><h3>Hotelaria e gastronomia</h3><p>Cardápios, porta-contas, jogos americanos e uniformes.</p><span class="link">Ver soluções {ARROW}</span></div></a>
  </div>
</section>
{process_band()}
{home_products_block()}
{kits_block()}
{collections_block('Ideias por ocasião')}
{faq(HOME_FAQ)}
{end_cta()}''',
    }


def page_brindes():
    return {
        'path': '/brindes-corporativos/', 'og': 'hero-gift', 'assunto': 'brindes corporativos', 'title': 'Brindes corporativos personalizados para empresas | TaMa Creative',
        'description': 'Brindes personalizados para empresas com curadoria de peças e acabamento escolhido para o seu público: presentes para clientes, colaboradores e eventos. Peça uma proposta.',
        'trail': [('/', 'Início'), ('/brindes-corporativos/', 'Brindes corporativos')],
        'service': {'key': 'brindes', 'name': 'Brindes corporativos personalizados', 'type': 'Brindes corporativos'},
        'preload': preload_image('hero-gift', '(max-width: 760px) 92vw, 46vw'),
        'body': page_head('Brindes corporativos', 'Brindes corporativos personalizados, escolhidos para serem usados',
                          'Presentes e brindes para clientes, colaboradores e eventos, com curadoria de materiais, cores da sua marca e acabamento cuidado. Peças que entram na rotina de quem recebe.',
                          cta_link(tipo='brindes', track_label='brindes-head') + '<a class="btn btn-line" href="/brindes-corporativos-premium/">Ideias por ocasião</a>',
                          'hero-gift', 'Garrafa verde, bandeja, caixas terracota e caneca mostarda com a marca TaMa como exemplo. Imagem ilustrativa.') + f'''
<section class="section ivory" aria-labelledby="escolha-t">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Como escolhemos</p><h2 id="escolha-t" class="section-title">Três perguntas antes de qualquer peça</h2><p class="muted">A curadoria começa pelo uso, não pelo catálogo. É o que separa um brinde lembrado de um brinde esquecido na gaveta.</p></div>
    <div class="cols-3">
      <div class="col">{arc('c1')}<h3>Para quem?</h3><p>Quem vai receber, o que essa pessoa usa no dia a dia e o que ela guardaria.</p></div>
      <div class="col">{arc('c2')}<h3>Para quando?</h3><p>Boas-vindas, campanha, evento ou fim de ano pedem peças e tons diferentes.</p></div>
      <div class="col">{arc('c3')}<h3>Com quanto?</h3><p>A seleção parte do investimento disponível e ajusta peças e acabamento a ele.</p></div>
    </div>
  </div>
</section>
{studio_block(['caderno-de-anotacoes', 'agenda', 'caneta-executiva-com-estojo', 'garrafa-termica', 'caneca', 'copo-com-tampa', 'ecobag', 'necessaire', 'caixa-para-presente', 'guarda-chuva', 'vela', 'difusor-de-aromas'],
              'Peças para a sua marca', 'Brindes', 'Uma amostra do catálogo: do brinde de evento ao presente executivo. Toque na cor para ver a foto e adicione à sua seleção.', 'estudio-b-t',
              more=('/catalogo/', f'Ver os {len(CATALOGO)} modelos do catálogo'))}
<section class="section ivory" aria-labelledby="tec-t">
  <div class="wrap split" style="align-items:start">
    <div class="stack" style="gap:12px"><p class="eyebrow">Personalização</p><h2 id="tec-t" class="section-title">A técnica certa para cada material</h2><p class="muted">A técnica é escolhida conforme a peça e confirmada na proposta, junto com a arte para aprovação.</p></div>
    <dl class="pack">
      <div><dt>Gravação a laser</dt><dd>Madeira, metal, couro, cortiça e pedra. Marca permanente e sutil.</dd></div>
      <div><dt>Baixo relevo e hot stamping</dt><dd>Couro e papel. Relevo com ou sem cor, discreto e sofisticado.</dd></div>
      <div><dt>Bordado</dt><dd>Tecidos. Tom sobre tom para elegância ou em contraste para presença.</dd></div>
      <div><dt>Tampografia e serigrafia</dt><dd>Cerâmica, vidro e superfícies curvas. Cor aplicada com precisão.</dd></div>
      <div><dt>Impressão digital</dt><dd>Papelaria, embalagens e estampas com muitas cores.</dd></div>
    </dl>
  </div>
</section>
<section class="section" aria-labelledby="entrega-t">
  <div class="wrap split">
    <figure>{picture('embalagem-presente', 'Embalagem de presente com fita. Imagem ilustrativa.', '(max-width: 760px) 92vw, 46vw', cls='photo')}<figcaption class="caption">{CAP}</figcaption></figure>
    <div class="stack">
      <p class="eyebrow">Apresentação</p><h2 id="entrega-t" class="section-title">A entrega também comunica</h2>
      <p class="muted">O momento de abrir a caixa faz parte do brinde. Opções de apresentação que podem entrar na proposta:</p>
      <dl class="pack"><div><dt>Caixa rígida</dt><dd>Com a marca aplicada por fora e um detalhe na tampa interna.</dd></div><div><dt>Papel de seda</dt><dd>Nas cores da marca, envolvendo cada peça.</dd></div><div><dt>Lacre e cartão</dt><dd>Lacre com o símbolo da marca e uma mensagem curta de quem envia.</dd></div></dl>
    </div>
  </div>
</section>
''' + faq([
            ('Qual é a quantidade mínima?', 'Varia conforme a peça e a técnica de personalização. Informe a quantidade aproximada no pedido: a proposta indica as quantidades viáveis e alternativas.'),
            ('Quanto tempo leva?', 'Depende da produção e da personalização de cada peça. Por isso pedimos a data desejada já no primeiro contato e confirmamos o prazo na proposta.'),
            ('Vocês têm catálogo com preços?', 'O catálogo mostra modelos de referência, sem preços. A curadoria parte do seu objetivo, do público e do investimento disponível, e a proposta traz peças, quantidades e condições comerciais.'),
            ('Posso usar a arte da minha empresa?', 'Sim. A marca da sua empresa é aplicada nas peças pelos fornecedores, e a arte é enviada para a sua aprovação antes da produção.'),
        ], title='Perguntas sobre brindes', eyebrow='Dúvidas') + end_cta(tipo='brindes'),
    }


def page_kits():
    return {
        'path': '/kits-corporativos/', 'og': 'kitp-kit-completo', 'assunto': 'kits corporativos', 'title': 'Kits corporativos personalizados: boas-vindas e eventos | TaMa',
        'description': 'Kits de boas-vindas, kits para eventos e presentes para clientes, com curadoria, embalagem personalizada e a marca da sua empresa. Solicite uma proposta.',
        'trail': [('/', 'Início'), ('/kits-corporativos/', 'Kits corporativos')],
        'service': {'key': 'kits', 'name': 'Kits corporativos personalizados', 'type': 'Kits corporativos'},
        'preload': preload_image('kitp-kit-completo', '(max-width: 760px) 92vw, 46vw'),
        'body': page_head('Kits corporativos', 'Kits corporativos personalizados para cada momento',
                          'Kits de boas-vindas, kits para eventos e presentes para clientes, montados com curadoria, embalagem personalizada e a marca da sua empresa.',
                          cta_link('Solicitar proposta de kit', tipo='kits', track_label='kits-head') + '<a class="btn btn-line" href="#kits">Ver os kits</a>',
                          'kitp-kit-completo', 'Kit completo em bordô com pasta, agenda, garrafa, caneca, guarda-chuva e acessórios com a marca TaMa.') + f'''
<section class="section kits-page" id="kits" aria-labelledby="kits-p-t" style="padding-top:clamp(24px,3vw,40px)">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Kits premium</p><h2 id="kits-p-t" class="section-title">Kits de referência para adaptar à sua marca</h2><p class="muted">Cinco composições para começar. Peças, embalagem e cartão se ajustam ao seu público, à ocasião e ao investimento.</p></div>
    <div class="kit-grid">{kit_cards()}</div>
    <div class="kit-foot"><p class="muted">Prefere outra composição? Conte a ocasião e o público no pedido.</p>{cta_link('Solicitar proposta de kit', tipo='kits', track_label='kits-lista')}</div>
    <p class="note" style="margin-top:18px">Os kits aparecem na identidade TaMa como exemplo. No seu projeto, caixa, cartão e peças levam a marca e as cores da sua empresa; a composição é confirmada na proposta. Imagens ilustrativas.</p>
  </div>
</section>
<section class="section ivory" aria-labelledby="tipos-t">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Tipos de kit</p><h2 id="tipos-t" class="section-title">Um kit para cada relação</h2></div>
    <div class="cols-2">
      <div class="item">{arc()}<div><h3>Kit de boas-vindas (onboarding)</h3><p>Recebe quem chega com peças úteis e um primeiro contato com a cultura da empresa.</p></div></div>
      <div class="item">{arc()}<div><h3>Kit para eventos</h3><p>Convenções, lançamentos e feiras: peças que acompanham a programação e levam a mensagem para casa.</p></div></div>
      <div class="item">{arc()}<div><h3>Kit para clientes especiais</h3><p>Relacionamento, fim de ano e agradecimentos, com presentes que parecem escolhidos para a pessoa.</p></div></div>
      <div class="item">{arc()}<div><h3>Kit de reconhecimento</h3><p>Metas, tempo de casa e conquistas da equipe celebradas com algo que dura.</p></div></div>
      <div class="item">{arc()}<div><h3>Kit de lançamento</h3><p>Para imprensa, parceiros e clientes conhecerem um produto ou uma marca nova.</p></div></div>
      <div class="item">{arc()}<div><h3>Kit vestuário</h3><p>Moletom, polo, boné e bolsa na mesma linguagem para equipes e campanhas.</p></div></div>
    </div>
  </div>
</section>
<section class="section on-dark" aria-labelledby="comp-t">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow light">Como compomos</p><h2 id="comp-t" class="section-title">Três camadas em todo kit</h2><p class="muted">Uma regra simples para que o kit seja usado, lembrado e reconhecido.</p></div>
    <div class="cols-3">
      <div class="item" style="grid-template-columns:1fr">{arc()}<div><h3>Uma peça de uso diário</h3><p>Garrafa, caderno ou objeto de mesa. É o que faz a marca aparecer todo dia.</p></div></div>
      <div class="item" style="grid-template-columns:1fr">{arc()}<div><h3>Uma peça de afeto</h3><p>Manta, caneca ou um mimo de casa. É o que faz a pessoa lembrar de quem enviou.</p></div></div>
      <div class="item" style="grid-template-columns:1fr">{arc()}<div><h3>A marca na medida</h3><p>Caixa, papel de seda e cartão. É o que transforma itens em um presente.</p></div></div>
    </div>
  </div>
</section>
<section class="section ivory" aria-labelledby="kit-m-t">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Do briefing à entrega</p><h2 id="kit-m-t" class="section-title">Como montamos o seu kit</h2></div>
    {steps_html(light=True)}
  </div>
</section>
''' + faq([
            ('O que colocar em um kit de boas-vindas?', 'Uma combinação que funciona: uma peça de uso diário (garrafa, caderno), um mimo que gere afeto (caneca, manta) e um material sobre a cultura da empresa, como uma carta de boas-vindas. A proposta ajusta a composição ao seu público.'),
            ('Dá para ter versões diferentes do mesmo kit?', 'Sim. A proposta pode prever versões por área ou ocasião, mantendo a mesma linguagem visual.'),
            ('Qual é a quantidade mínima de kits?', 'Depende das peças escolhidas e das técnicas de personalização. Informe o número de kits no pedido: a proposta indica as quantidades viáveis.'),
            ('Com quanto tempo de antecedência devo pedir?', 'Quanto antes, mais opções de peças e acabamentos. Informe a data desejada no pedido e confirmamos o prazo na proposta.'),
        ], title='Perguntas sobre kits', eyebrow='Dúvidas') + end_cta('Vamos montar o seu kit?', 'Conte a ocasião e o público. A TaMa propõe a composição.', tipo='kits'),
    }


def page_curadoria():
    """Seleção editorial por ocasião (URL antiga da curadoria): reapresenta modelos do catálogo, sem cadastro próprio."""
    pecas = [c for c in CATALOGO if c['ocasioes']]
    cats = [k for k in CAT_PROD if any(c['categoria'] == k for c in pecas)]
    occ_chips = '<button class="chip" type="button" data-filter="occ" data-value="todas" aria-pressed="true">Todas</button>' + ''.join(
        f'<button class="chip" type="button" data-filter="occ" data-value="{k}" aria-pressed="false">{v}</button>' for k, v in OCCS.items())
    cat_chips = ('<button class="chip" type="button" data-filter="cat" data-value="todas" aria-pressed="true">Todas</button>'
                 + ''.join(f'<button class="chip" type="button" data-filter="cat" data-value="{k}" aria-pressed="false">{CAT_PROD[k]}</button>' for k in cats))
    url = SITE + '/brindes-corporativos-premium/'
    item_list = {'@type': 'ItemList', '@id': url + '#lista', 'name': 'Brindes e presentes corporativos por ocasião', 'numberOfItems': len(pecas),
                 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': c['nome'], 'url': SITE + '/catalogo/#' + c['slug']} for i, c in enumerate(pecas)]}
    return {
        'path': '/brindes-corporativos-premium/', 'title': 'Brindes e presentes corporativos por ocasião | TaMa Creative',
        'description': 'Ideias de brindes e presentes corporativos para boas-vindas, eventos, fim de ano, reconhecimento e lançamentos, com a marca da sua empresa. Monte a seleção.',
        'trail': [('/', 'Início'), ('/brindes-corporativos/', 'Brindes corporativos'), ('/brindes-corporativos-premium/', 'Por ocasião')],
        'service': {'key': 'ocasioes', 'name': 'Brindes e presentes corporativos por ocasião', 'type': 'Brindes corporativos'},
        'assunto': 'brindes e presentes por ocasião',
        'wp_type': 'CollectionPage', 'ld_extra': [item_list],
        'body': f'''<section class="page-head" style="padding-bottom:clamp(28px,4vw,44px)">
  <div class="wrap"><div class="section-head" style="margin:0;max-width:54rem">
    <p class="eyebrow">Ideias por ocasião</p>
    <h1>Brindes e presentes corporativos por ocasião</h1>
    <p class="lead">Boas-vindas, eventos, fim de ano, reconhecimento: escolha a ocasião, veja as peças que a TaMa sugere e envie a seleção junto com o pedido de proposta. Todas as peças vêm do mesmo catálogo.</p>
  </div></div>
</section>
<section class="section ivory" id="pecas" style="padding-top:clamp(32px,4vw,52px)" aria-label="Peças por ocasião">
  <div class="wrap">
    {brand_note()}
    <div class="stack" style="gap:12px;margin-bottom:26px">
      <div class="filters" role="group" aria-label="Filtrar por ocasião" style="flex-wrap:wrap">{occ_chips}</div>
      <div class="filters" role="group" aria-label="Filtrar por categoria" style="flex-wrap:wrap">{cat_chips}</div>
      <p class="note" id="gift-count" aria-live="polite">{len(pecas)} peças</p>
    </div>
    <h2 class="visually-hidden">Peças sugeridas</h2>
    <div class="studio-grid" id="gift-grid">{''.join(home_product_card(c) for c in pecas)}</div>
    <div class="empty" id="gift-empty" hidden><p>Nenhuma peça combina esses filtros. <button class="link" type="button" id="gift-reset" style="background:none;border:0;cursor:pointer">Limpar os filtros</button>. Se a peça que você procura não está aqui, descreva a ideia no <a href="/solicitar-proposta/">pedido de proposta</a>.</p></div>
    <p class="note" style="margin-top:24px">{NOTE_IMAGENS}</p>
  </div>
</section>
<section class="section" aria-labelledby="cat-cta-t">
  <div class="wrap section-head row" style="margin:0">
    <div class="stack" style="gap:12px"><p class="eyebrow">Mais opções</p><h2 id="cat-cta-t" class="section-title">Prefere ver tudo ou um kit?</h2><p class="muted">O catálogo tem {len(CATALOGO)} modelos, organizados por categoria. Os kits reúnem caixa, cartão e peças para uma ocasião.</p></div>
    <div class="actions"><a class="btn btn-wine" href="/catalogo/">Ver o catálogo {ARROW}</a><a class="btn btn-line" href="/kits-corporativos/">Ver os kits</a></div>
  </div>
</section>
{end_cta(tipo='brindes')}''',
    }


# Abertura de Confecções: pessoas usando as peças com a marca (cenas geradas com IA, ilustrativas; tools/cenas.py).
# frame: --fx/--fy enquadram a foto no computador, --fx-m no celular.
CONF_SLIDES = [
    ('tone-linen', 'conf-equipe-kits', '--fx:58%;--fx-m:52%', 'Cena ilustrativa: equipe de uma empresa usando polo azul e camisetas preta e branca, com a marca TaMa aplicada como exemplo.',
     'Confecções personalizadas', 'Uniformes corporativos e <em>confecções personalizadas</em>',
     'Polos, camisetas, dólmãs e moletons para equipes, eventos e o dia a dia, alinhados à identidade da sua empresa.',
     cta_link('Solicitar proposta', tipo='confeccoes', track_label='conf-hero-4') + '<a class="btn btn-line" href="/catalogo/?categoria=vestuario">Ver polos e moletons ' + ARROW + '</a>'),
    ('tone-cream', 'conf-chef-dolma', '--fx:78%;--fy:15%;--fx-m:74%', 'Chef de dólmã branca com a marca TaMa bordada finalizando um prato em uma cozinha profissional.',
     'Hotelaria e gastronomia', 'Sua marca na <em>cozinha e no salão</em>.',
     'Dólmãs e aventais com a sua marca. Tecido e personalização definidos na proposta.',
     cta_link('Solicitar proposta', tipo='hotelaria', track_label='conf-hero-2') + '<a class="btn btn-line" href="/hotelaria-e-gastronomia/">Ver hotelaria e gastronomia ' + ARROW + '</a>'),
    ('tone-sage', 'conf-estande-evento', '--fx:72%;--fx-m:70%', 'Equipe de polo branca e camiseta vermelha com a marca TaMa atendendo visitantes e entregando ecobags num estande de feira.',
     'Eventos e ações', 'Camisetas que viram <em>presença de marca</em>.',
     'Camisetas personalizadas para feiras, campanhas e ativações, com a técnica definida na proposta.',
     cta_link('Solicitar proposta', tipo='confeccoes', track_label='conf-hero-3') + '<a class="btn btn-line" href="/catalogo/?categoria=vestuario">Ver camisetas ' + ARROW + '</a>'),
    ('tone-rose', 'conf-degustacao', '--fx:42%;--fx-m:40%', 'Promotoras de camiseta branca e avental verde e terracota com a marca TaMa servindo degustação de queijo num supermercado.',
     'Ativações e degustações', 'Aventais que levam a marca <em>ao ponto de venda</em>.',
     'Aventais, camisetas e toucas para degustações, promoções e equipes de loja.',
     cta_link('Planejar uma ativação', tipo='ativacoes', track_label='conf-hero-5') + '<a class="btn btn-line" href="/ativacoes-promocionais/">Conhecer ativações ' + ARROW + '</a>'),
]


def page_confeccoes():
    return {
        'path': '/confeccoes-personalizadas/', 'og': 'conf-equipe-kits', 'assunto': 'confecções e uniformes', 'title': 'Uniformes e confecções personalizadas para empresas | TaMa',
        'description': 'Uniformes corporativos, polos bordadas, moletons e bonés para equipes e eventos, alinhados à identidade visual da sua empresa e pensados para quem veste.',
        'trail': [('/', 'Início'), ('/confeccoes-personalizadas/', 'Confecções')],
        'service': {'key': 'confeccoes', 'name': 'Confecções personalizadas e uniformes corporativos', 'type': 'Uniformes corporativos personalizados'},
        'preload': preload_image(CONF_SLIDES[0][1], '(max-width: 760px) 200vw, (max-width: 1100px) 140vw, 100vw'),  # mesma imagem e sizes do slide 1
        'body': hero_carousel(CONF_SLIDES, label='Confecções da TaMa Creative', assurances=False) + f'''
<section class="section ivory" aria-labelledby="uso-t">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Definido pelo uso</p><h2 id="uso-t" class="section-title">Cada peça começa pela rotina de quem veste</h2></div>
    <div class="cols-3">
      <div class="col">{arc('c1')}<h3>Tecido</h3><p>Malha, piquê, moletom ou sarja, conforme o clima, a rotina e a durabilidade esperada.</p></div>
      <div class="col">{arc('c2')}<h3>Modelagem</h3><p>Cortes escolhidos para vestir bem a equipe, com a grade de tamanhos definida no projeto.</p></div>
      <div class="col">{arc('c3')}<h3>Personalização</h3><p>Bordado, silk e etiquetas escolhidos para a peça e para a imagem da marca.</p></div>
    </div>
  </div>
</section>
{studio_block(['polo-masculina', 'polo-feminina', 'camiseta-masculina', 'camiseta-feminina', 'moletom-com-capuz', 'bone', 'dolma', 'avental'],
              'As peças de vestuário', 'Catálogo', 'Polo, camiseta, moletom, dólmã e avental, com a marca aplicada como exemplo.', 'estudio-c-t',
              more=('/catalogo/?categoria=vestuario', 'Ver no catálogo'))}
<section class="section ivory" aria-labelledby="tec-c-t">
  <div class="wrap split" style="align-items:start">
    <div class="stack" style="gap:12px"><p class="eyebrow">Acabamentos</p><h2 id="tec-c-t" class="section-title">Bordado, silk ou etiqueta?</h2></div>
    <dl class="pack">
      <div><dt>Bordado</dt><dd>Tom sobre tom para elegância, ou em contraste para presença. Indicado para polos e peças de uso contínuo.</dd></div>
      <div><dt>Silk e estampa</dt><dd>Para campanhas, áreas grandes e padrões de marca aplicados em toda a peça.</dd></div>
      <div><dt>Etiquetas</dt><dd>Tecidas ou aplicadas na barra. Um detalhe discreto, que valoriza a peça.</dd></div>
    </dl>
  </div>
</section>
''' + faq([
            ('Bordado ou estampa: qual escolher?', 'O bordado costuma durar mais e transmite sofisticação, por isso funciona bem em polos e uniformes. A estampa permite mais cores e áreas maiores, o que combina com camisetas de campanha e eventos.'),
            ('Qual é a quantidade mínima?', 'Varia conforme a peça, o tecido e a técnica de personalização. Informe quantas pessoas e a grade aproximada no pedido: a proposta indica as quantidades viáveis.'),
            ('As peças seguem as cores da empresa?', 'Envie as cores da marca (manual ou códigos) no pedido: a proposta indica os tecidos e as cores disponíveis mais próximas, aprovados antes da produção. As cores do site são referências visuais.'),
        ], title='Perguntas sobre confecções', eyebrow='Dúvidas') + end_cta('Sua marca merece ser vestida.', 'Conte quem vai vestir e em que ocasião. A TaMa propõe as peças.', tipo='confeccoes'),
    }


def page_ativacoes():
    return {
        'path': '/ativacoes-promocionais/', 'og': 'conf-degustacao', 'title': 'Ativações promocionais e degustações para marcas | TaMa Creative',
        'description': 'Degustações, ações em feiras e eventos e promoções no ponto de venda, com uniformes, brindes e materiais na identidade da sua marca. Peça uma proposta.',
        'trail': [('/', 'Início'), ('/ativacoes-promocionais/', 'Ativações')],
        'service': {'key': 'ativacoes', 'name': 'Ativações promocionais e degustações', 'type': 'Ativação promocional'},
        'assunto': 'uma ativação promocional ou degustação',
        'preload': preload_image('conf-degustacao', '(max-width: 760px) 92vw, 46vw'),
        'body': page_head('Ativações promocionais', 'Ativações promocionais e degustações para a sua marca',
                          'Ações em eventos, feiras e pontos de venda para levar o produto e a marca até quem compra. A TaMa desenvolve a ação com você e coordena o que ela precisa, dos materiais com a sua marca à execução combinada na proposta.',
                          cta_link('Planejar uma ativação', tipo='ativacoes', track_label='ativacoes-head') + '<a class="btn btn-line" href="#formatos">Ver formatos</a>',
                          'conf-degustacao', 'Cena ilustrativa: equipe de camiseta e avental com a marca TaMa servindo degustação num supermercado.', obj='object-position:40% center') + f'''
<section class="section ivory" id="formatos" aria-labelledby="formatos-t">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Formatos</p><h2 id="formatos-t" class="section-title">Onde a ativação acontece</h2><p class="muted">Cada formato pede peças, equipe e cronograma diferentes. O ponto de partida é o que a ação precisa provocar e em quem.</p></div>
    <div class="cols-2">
      <div class="item">{arc()}<div><h3>Degustação no ponto de venda</h3><p>O cliente prova o produto onde decide a compra: supermercados, empórios, lojas e farmácias.</p></div></div>
      <div class="item">{arc()}<div><h3>Feiras e eventos</h3><p>Brindes, uniformes e materiais para o estande e para receber quem visita.</p></div></div>
      <div class="item">{arc()}<div><h3>Promoção e amostragem</h3><p>Brindes, amostras e materiais para campanhas de venda, lançamentos e ações com distribuidores.</p></div></div>
      <div class="item">{arc()}<div><h3>Ações internas</h3><p>Convenções, lançamentos para a equipe e datas da empresa, com kits e peças na mesma linguagem.</p></div></div>
    </div>
  </div>
</section>
<section class="section" aria-labelledby="ativ-inclui-t">
  <div class="wrap split" style="align-items:start">
    <div class="stack" style="gap:12px"><p class="eyebrow">O que pode fazer parte</p><h2 id="ativ-inclui-t" class="section-title">Tudo o que a ação precisa, com a sua marca</h2><p class="muted">O escopo de cada ativação (materiais, equipe, logística e regras do local ou do organizador) é definido com você e confirmado na proposta.</p></div>
    <dl class="pack">
      <div><dt>Uniformes da equipe</dt><dd>Camisetas, polos, aventais e bonés. <a class="link" href="/confeccoes-personalizadas/">Ver confecções</a></dd></div>
      <div><dt>Brindes e amostras</dt><dd>Peças para entregar ao público, do copo à ecobag. <a class="link" href="/catalogo/">Ver o catálogo</a></dd></div>
      <div><dt>Kits para convidados</dt><dd>Kits para enviar a imprensa, parceiros e clientes. <a class="link" href="/kits-corporativos/">Ver kits</a></dd></div>
      <div><dt>Planejamento e coordenação</dt><dd>Cronograma, coordenação dos fornecedores e entrega combinada na proposta.</dd></div>
    </dl>
  </div>
</section>
<section class="section ivory" aria-labelledby="ativ-como-t">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Como planejamos</p><h2 id="ativ-como-t" class="section-title">Da ideia ao dia da ação</h2></div>
    <ol class="steps light">
      <li class="step"><b>01</b><strong>Objetivo</strong><span>O que a ação precisa provocar, em quem e onde.</span></li>
      <li class="step"><b>02</b><strong>Formato</strong><span>Local, duração, público esperado e o que será entregue.</span></li>
      <li class="step"><b>03</b><strong>Materiais</strong><span>Uniformes, brindes e peças com a marca, com arte aprovada antes da produção.</span></li>
      <li class="step"><b>04</b><strong>Execução</strong><span>Cronograma, entrega dos materiais e acompanhamento combinados na proposta.</span></li>
    </ol>
  </div>
</section>
{studio_block(['avental', 'camiseta-masculina', 'camiseta-feminina', 'bone', 'ecobag', 'copo-360', 'squeeze', 'taca-de-champanhe'],
              'Peças que costumam entrar em ativações', 'Catálogo', 'Escolha as cores de referência e adicione à seleção: as peças seguem com o pedido.', 'ativ-pecas-t',
              more=('/catalogo/', 'Ver o catálogo completo'))}
''' + faq([
            ('Que tipo de ativação vocês fazem?', 'Degustações e promoções no ponto de venda, ações em feiras e eventos e ativações internas. Conte o objetivo, o público e o local: a proposta indica o formato e o que entra nele.'),
            ('Quem cuida da equipe e da logística?', 'Diga no pedido se a ação precisa de equipe, transporte ou montagem. A proposta separa o que a TaMa coordena e o que fica com a sua empresa, com o local ou com o organizador.'),
            ('Com quanto tempo de antecedência devo pedir?', 'Quanto antes, mais opções de materiais e de datas. Informe a data da ação no pedido e o prazo é confirmado na proposta.'),
            ('Precisa de autorização do local?', 'Lojas, supermercados e eventos costumam ter regras próprias para ações. Envie o local e as regras do organizador, se já tiver: a proposta indica quem cuida de cada autorização.'),
        ], title='Perguntas sobre ativações', eyebrow='Dúvidas') + end_cta('Vamos planejar a sua ativação?', 'Conte o produto, o público, o local e a data. A TaMa propõe o formato e os materiais.', tipo='ativacoes', eyebrow='Ativações'),
    }


def page_hotelaria():
    return {
        'path': '/hotelaria-e-gastronomia/', 'title': 'Cardápios, porta-contas e uniformes para restaurantes | TaMa', 'og': 'conf-chef-dolma',
        'description': 'Cardápios, porta-contas, jogos americanos, dólmãs e aventais com a marca do seu restaurante, bar, café ou hotel. Monte a seleção e peça uma proposta.',
        'trail': [('/', 'Início'), ('/hotelaria-e-gastronomia/', 'Hotelaria e gastronomia')],
        'service': {'key': 'hotelaria', 'name': 'Produtos personalizados para hotelaria e gastronomia', 'type': 'Produtos personalizados para restaurantes e hotéis'},
        'assunto': 'produtos para hotelaria e gastronomia',
        'preload': preload_image('conf-chef-dolma', '(max-width: 760px) 92vw, 46vw'),
        'body': page_head('Hotelaria e gastronomia', 'Produtos personalizados para restaurantes, bares e hotéis',
                          'Cardápios, porta-contas, jogos americanos, dólmãs e aventais com a marca da sua casa. A TaMa ajuda a escolher as peças para o salão, a cozinha e a equipe e coordena a produção.',
                          cta_link('Solicitar proposta', tipo='hotelaria', track_label='hotelaria-head') + '<a class="btn btn-line" href="#hot-pecas-t">Ver peças</a>',
                          'conf-chef-dolma', 'Cena ilustrativa: chef de dólmã branca com a marca TaMa bordada finalizando um prato.', obj='object-position:76% 20%') + f'''
<section class="section ivory" aria-labelledby="ambientes-t">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Por ambiente</p><h2 id="ambientes-t" class="section-title">A marca em cada ponto de contato</h2></div>
    <div class="cols-2">
      <div class="item">{arc()}<div><h3>Salão e mesa</h3><p>Cardápio, porta-contas e jogos americanos: o que o cliente segura durante toda a refeição.</p></div></div>
      <div class="item">{arc()}<div><h3>Cozinha e equipe</h3><p>Dólmãs e aventais com a marca, em cores definidas no projeto.</p></div></div>
      <div class="item">{arc()}<div><h3>Bar e eventos</h3><p>Taças, copos e peças para eventos, degustações e datas especiais da casa.</p></div></div>
      <div class="item">{arc()}<div><h3>Clientes e hóspedes</h3><p>Kits e brindes para receber, agradecer e fidelizar. <a class="link" href="/kits-corporativos/">Ver kits</a></p></div></div>
    </div>
  </div>
</section>
{studio_block(['cardapio', 'porta-contas', 'jogo-americano-retangular', 'jogo-americano-oval', 'jogo-americano-impresso', 'dolma', 'avental', 'taca-de-vinho'],
              'Peças para salão, cozinha e equipe', 'Catálogo', 'Toque na cor para ver a foto e adicione à seleção: as peças seguem com o pedido de proposta.', 'hot-pecas-t',
              more=('/catalogo/?categoria=hotelaria-gastronomia', 'Ver hotelaria no catálogo'))}
<section class="section ivory" aria-labelledby="hot-considerar-t">
  <div class="wrap split" style="align-items:start">
    <div class="stack" style="gap:12px"><p class="eyebrow">Antes de pedir</p><h2 id="hot-considerar-t" class="section-title">O que vale definir</h2></div>
    <dl class="pack">
      <div><dt>Uso diário</dt><dd>Peças manuseadas o dia todo: material, acabamento e limpeza são escolhidos e confirmados na proposta.</dd></div>
      <div><dt>Quantidades e reposição</dt><dd>Informe quantas mesas, pessoas na equipe e a previsão de reposição.</dd></div>
      <div><dt>Uma linguagem só</dt><dd>Salão, cozinha e equipe com a mesma identidade, da cor do avental ao cardápio.</dd></div>
    </dl>
  </div>
</section>
''' + faq([
            ('Quais peças vocês personalizam para restaurantes e hotéis?', 'Cardápios, porta-contas, jogos americanos, dólmãs, aventais, taças e copos, além de kits e brindes para clientes. Se a peça que você procura não está no catálogo, descreva no pedido.'),
            ('As peças aguentam o uso diário?', 'Conte no pedido a rotina das peças (lavagens, uso na cozinha, área externa): a proposta indica material, acabamento e cuidados.'),
            ('Bordado ou estampa nas dólmãs e aventais?', 'O bordado costuma ser usado em peças de uso contínuo; a estampa permite mais cores e áreas maiores. A técnica é definida no projeto.'),
        ], title='Perguntas sobre hotelaria e gastronomia', eyebrow='Dúvidas') + end_cta('Sua casa com a sua marca em cada detalhe.', 'Conte o tipo de casa, o número de mesas e de pessoas na equipe. A TaMa propõe as peças.', tipo='hotelaria', eyebrow='Hotelaria e gastronomia'),
    }


def page_sobre():
    dados = ''.join(f'<div><dt>{t}</dt><dd>{esc(v)}</dd></div>' for t, v in (('Razão social', RAZAO), ('CNPJ', CNPJ), ('Cidade', CIDADE), ('Atendimento comercial', RESPONSAVEL), ('E-mail', EMAIL)) if v)
    dados_html = f'<section class="section" aria-labelledby="dados-t"><div class="wrap split" style="align-items:start"><div class="stack" style="gap:12px"><p class="eyebrow">Dados da empresa</p><h2 id="dados-t" class="section-title">TaMa Creative</h2></div><dl class="pack">{dados}</dl></div></section>' if dados else ''
    return {
        'path': '/sobre/', 'title': 'Sobre a TaMa Creative | Brindes, confecções, kits e ativações',
        'description': 'A TaMa Creative desenvolve e coordena brindes, confecções, kits personalizados e ativações promocionais para empresas, com visão de Trade Marketing.',
        'trail': [('/', 'Início'), ('/sobre/', 'Sobre')], 'wp_type': 'AboutPage', 'assunto': 'um projeto para a minha empresa',
        'body': f'''<section class="page-head">
  <div class="wrap split">
    <div class="copy"><p class="eyebrow">Sobre a TaMa</p><h1>Quem é a TaMa Creative</h1><p class="lead">A TaMa Creative desenvolve e coordena brindes, confecções, kits personalizados e ativações promocionais para empresas. Antes de escolher qualquer peça, olhamos para o público, a ocasião e a execução: é a experiência da fundadora em Trade Marketing aplicada a cada projeto.</p><div class="actions">{cta_link(track_label='sobre-head')}</div></div>
    <div class="seal-block">{SELO}<p>Sua marca ganha forma. Personalizamos ideias.</p></div>
  </div>
</section>
<section class="section ivory" aria-labelledby="faz-t">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">O que fazemos</p><h2 id="faz-t" class="section-title">Cinco frentes, um mesmo cuidado com a marca</h2></div>
    <div class="cols-2">
      <div class="item">{arc()}<div><h3><a href="/brindes-corporativos/">Brindes corporativos</a></h3><p>Peças para clientes, equipes e eventos, escolhidas pelo uso.</p></div></div>
      <div class="item">{arc()}<div><h3><a href="/confeccoes-personalizadas/">Confecções personalizadas</a></h3><p>Polos, camisetas, moletons, dólmãs e aventais com a marca da empresa.</p></div></div>
      <div class="item">{arc()}<div><h3><a href="/kits-corporativos/">Kits premium</a></h3><p>Caixa, cartão e peças compostos para uma ocasião.</p></div></div>
      <div class="item">{arc()}<div><h3><a href="/ativacoes-promocionais/">Ativações e degustações</a></h3><p>Ações em eventos, feiras e pontos de venda.</p></div></div>
      <div class="item">{arc()}<div><h3><a href="/hotelaria-e-gastronomia/">Hotelaria e gastronomia</a></h3><p>Cardápios, porta-contas, jogos americanos e uniformes.</p></div></div>
    </div>
  </div>
</section>
<section class="section" aria-labelledby="como-t">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Como trabalhamos</p><h2 id="como-t" class="section-title">Da escolha das peças à entrega</h2><p class="muted">A TaMa entende o objetivo, propõe as peças e coordena com os fornecedores a aplicação da sua marca, os materiais e a execução até a entrega.</p></div>
    <div class="cols-2">
      <div class="item">{arc()}<div><h3>Visão de Trade Marketing</h3><p>Público, ocasião de uso e execução vêm antes da escolha de qualquer peça.</p></div></div>
      <div class="item">{arc()}<div><h3>Seleção sob medida</h3><p>Peças alinhadas ao público, à ocasião e ao investimento, escolhidas para cada projeto.</p></div></div>
      <div class="item">{arc()}<div><h3>Tudo em um pedido</h3><p>Brindes, kits, uniformes e materiais de ativação no mesmo pedido, com uma única linguagem.</p></div></div>
      <div class="item">{arc()}<div><h3>Da arte à entrega</h3><p>Arte e especificações aprovadas antes da produção e materiais conferidos antes da entrega.</p></div></div>
    </div>
  </div>
</section>
<section class="section question" aria-label="A pergunta que abre cada projeto">
  <div class="wrap"><p class="eyebrow light">Ponto de partida</p><blockquote>O que queremos que as pessoas lembrem da sua marca?</blockquote><p style="margin-top:16px;max-width:36rem">É a pergunta que abre cada projeto. A resposta orienta a seleção das peças, a personalização e a execução.</p></div>
</section>
<section class="editorial" aria-labelledby="ed-t">
  <div class="wrap editorial-grid">
    <div class="editorial-text">
      <p class="eyebrow">O que nos move</p>
      <h2 id="ed-t">Marca não é o que se diz. <em>É o que fica.</em></h2>
      <p>Um caderno aberto todos os dias. Um uniforme usado com orgulho. Uma caixa guardada na estante. A TaMa leva a sua marca às escolhas de produto, cor e acabamento, pensando no público e na ocasião antes da peça.</p>
    </div>
    <div class="editorial-photo">{picture('editorial-kit-cores', 'Peças em cores variadas com a marca TaMa como exemplo: pasta, agenda, garrafa, caneca, caixa, guarda-chuva, carregador e caderno. Imagem ilustrativa.', '(max-width: 760px) 92vw, 55vw')}</div>
  </div>
</section>
{dados_html}
<section class="section ivory" aria-labelledby="simbolo-t">
  <div class="wrap split">
    <svg class="arc-diagram" viewBox="-14 -114 228 228" role="img" aria-label="Diagrama: o arco é um segmento de um círculo tracejado, fechado por uma reta diagonal.">
      <circle class="d-circle" cx="100" cy="0" r="100"/><path class="d-arc" d="{ARC}"/><line class="d-chord" x1="0" y1="0" x2="100" y2="100"/>
      <circle class="d-dot" cx="0" cy="0" r="3"/><circle class="d-dot" cx="100" cy="100" r="3"/><circle class="d-center" cx="100" cy="0" r="2.4"/>
    </svg>
    <div class="stack">
      <p class="eyebrow">O símbolo</p><h2 id="simbolo-t" class="section-title">Um círculo que ainda está sendo desenhado</h2>
      <p class="muted">O arco é o segmento de um círculo cortado por uma reta: a forma no instante em que ganha forma.</p>
      <div class="legend">
        <div><svg viewBox="0 0 34 20" aria-hidden="true"><line class="k-line" x1="2" y1="18" x2="32" y2="2"/></svg><p><strong>A reta</strong> é a intenção: o objetivo, o briefing, a ideia.</p></div>
        <div><svg viewBox="0 0 34 20" aria-hidden="true"><path class="k-curve" d="M2 4 Q4 18 32 18"/></svg><p><strong>A curva</strong> é o objeto: o que a pessoa segura, veste e guarda.</p></div>
        <div><svg viewBox="0 0 34 20" aria-hidden="true"><line class="k-dash" x1="2" y1="10" x2="32" y2="10"/></svg><p><strong>O tracejado</strong> é o círculo que a TaMa ajuda a fechar.</p></div>
      </div>
    </div>
  </div>
</section>
{end_cta()}''',
    }


def page_proposta():
    tipos = [('brindes', 'Brindes corporativos'), ('kits', 'Kits premium'), ('confeccoes', 'Confecções e uniformes'),
             ('ativacoes', 'Ativação ou degustação'), ('hotelaria', 'Hotelaria e gastronomia'), ('integrado', 'Mais de uma frente ou ainda não sei')]
    choices = ''.join(f'<label class="choice"><input type="radio" name="tipo" value="{v}" required> {t}</label>' for v, t in tipos)
    contacts = contact_lines()
    contact_block = f'<div class="stack" style="gap:10px"><p class="eyebrow">Fale direto</p><div class="contact-lines">{"".join(contacts)}</div></div>' if contacts else ''
    wa_retry = f'<a class="btn btn-line" href="https://wa.me/{WA}" data-wa-summary data-track="whatsapp_click" data-track-label="erro-envio" rel="noopener">{CHAT} Enviar pelo WhatsApp</a>' if WA else ''
    alt_contact = ' ou '.join(x for x in (WA and 'pelo WhatsApp', EMAIL and 'por e-mail') if x) or 'mais tarde'
    return {
        'path': '/solicitar-proposta/', 'title': 'Solicitar proposta de brindes, kits e confecções | TaMa',
        'description': 'Peça uma proposta de brindes corporativos, kits ou uniformes. Conte a ocasião e a TaMa Creative propõe as possibilidades.',
        'trail': [('/', 'Início'), ('/solicitar-proposta/', 'Solicitar proposta')], 'wp_type': 'ContactPage',
        'body': f'''<section class="page-head" style="padding-bottom:clamp(24px,4vw,40px)">
  <div class="wrap"><div class="section-head" style="margin:0;max-width:50rem"><p class="eyebrow">Solicitar proposta</p><h1>Vamos dar forma à sua ideia?</h1><p class="lead">Conte a ocasião. A TaMa propõe as possibilidades. O formulário leva cerca de dois minutos.</p></div></div>
</section>
<section class="section" style="padding-top:0">
  <div class="wrap contact-grid">
    <div>
      <form class="form" id="proposal-form" name="proposta" method="POST" action="{FORM_ENDPOINT}" data-endpoint="{FORM_ENDPOINT}" novalidate>
        <input type="hidden" name="form-name" value="proposta">
        <p hidden><label>Não preencha este campo <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
        <!-- preenchidos pelo site.js: identificador do pedido (o mesmo em cada nova tentativa, para não duplicar), interesse vindo do botão clicado, página de origem e UTMs -->
        <input type="hidden" name="pedido_id" id="f-pedido-id">
        <input type="hidden" name="interesse" id="f-interesse">
        <input type="hidden" name="origem_pagina" id="f-origem-pagina">
        <input type="hidden" name="primeira_pagina" id="f-primeira-pagina">
        <input type="hidden" name="referencia" id="f-referencia">
        <input type="hidden" name="utm_source" id="f-utm_source"><input type="hidden" name="utm_medium" id="f-utm_medium"><input type="hidden" name="utm_campaign" id="f-utm_campaign"><input type="hidden" name="utm_term" id="f-utm_term"><input type="hidden" name="utm_content" id="f-utm_content">
        <p class="interest-note" id="interest-note" hidden></p>
        <div class="form-grid">
          <div class="field"><label for="f-nome">Nome <span class="req" aria-hidden="true">*</span></label><input id="f-nome" name="nome" autocomplete="name" maxlength="120" required aria-describedby="f-nome-error"><p class="field-error" id="f-nome-error"></p></div>
          <div class="field"><label for="f-empresa">Empresa</label><input id="f-empresa" name="empresa" autocomplete="organization" maxlength="160"></div>
          <div class="field full"><label for="f-contato">E-mail ou WhatsApp <span class="req" aria-hidden="true">*</span></label><input id="f-contato" name="contato" autocomplete="email" maxlength="160" required aria-describedby="f-contato-hint f-contato-error"><p class="hint" id="f-contato-hint">Para responder com a proposta. Telefone com DDD.</p><p class="field-error" id="f-contato-error"></p></div>
        </div>
        <fieldset class="fieldset" id="f-tipo" aria-describedby="f-tipo-error"><legend>Tipo de projeto <span class="req" aria-hidden="true">*</span></legend><div class="choices">{choices}</div><p class="field-error" id="f-tipo-error"></p></fieldset>
        <div class="field" id="picked-wrap" hidden><span class="field-label">Peças selecionadas</span><ul class="picked-list" id="picked-list" aria-label="Peças selecionadas por você"></ul><input type="hidden" name="selecao" id="f-selecao"><a class="link" href="/brindes-corporativos-premium/">Adicionar mais peças {ARROW}</a></div>
        <div class="form-grid">
          <div class="field" data-show-for="brindes kits confeccoes ativacoes hotelaria integrado"><label for="f-qtd">Quantidade aproximada</label><input id="f-qtd" name="quantidade" type="number" min="1" inputmode="numeric" placeholder="Ex.: 80"></div>
          <div class="field" data-show-for="brindes kits confeccoes ativacoes hotelaria integrado"><label for="f-data">Data desejada</label><input id="f-data" name="data" type="date"></div>
          <div class="field full"><label for="f-orcamento">Orçamento estimado (opcional)</label><select id="f-orcamento" name="orcamento"><option value="">Prefiro não informar</option><option>Até R$ 5 mil</option><option>R$ 5 mil a R$ 20 mil</option><option>R$ 20 mil a R$ 50 mil</option><option>Acima de R$ 50 mil</option></select></div>
          <div class="field full"><label for="f-objetivo">Objetivo do projeto <span class="req" aria-hidden="true">*</span></label><textarea id="f-objetivo" name="objetivo" maxlength="4000" required aria-describedby="f-objetivo-error" placeholder="Ex.: receber 40 novas pessoas em março com um kit que apresente a cultura da empresa."></textarea><p class="field-error" id="f-objetivo-error"></p></div>
        </div>
        <div class="field"><label class="check" for="f-consent" style="text-transform:none;letter-spacing:0;font-weight:400;font-size:.9375rem"><input type="checkbox" id="f-consent" name="consentimento" value="sim" required aria-describedby="f-consent-error"> <span>Concordo que a TaMa use estes dados para responder ao meu pedido, conforme a <a href="/privacidade/">política de privacidade</a>.</span></label><p class="field-error" id="f-consent-error"></p></div>
        <div class="form-foot"><button class="btn btn-wine" type="submit" id="submit-btn">Enviar pedido {ARROW}</button><p class="form-status" id="form-status" role="status" aria-live="polite"></p></div>
      </form>
      <div class="result" id="form-result" hidden tabindex="-1"></div>
      <template id="tpl-ok"><p class="eyebrow">Pedido registrado</p><h2>Recebemos o seu pedido</h2><p class="muted">O pedido foi gravado e a TaMa responde pelo contato informado. Se quiser, guarde o resumo abaixo.</p><p class="pedido-ref">Número do pedido: <strong data-pedido-ref></strong></p><label for="f-resumo-ok" class="visually-hidden">Resumo do pedido</label><textarea id="f-resumo-ok" readonly></textarea><div class="actions"><button class="btn btn-line" type="button" data-copy>Copiar resumo</button><a class="btn btn-line" href="/catalogo/">Ver o catálogo</a></div><p class="form-status" data-copy-status aria-live="polite"></p></template>
      <template id="tpl-error"><p class="eyebrow">Envio não confirmado</p><h2>Não conseguimos confirmar o seu pedido</h2><p class="muted">Não recebemos a confirmação de que o pedido foi gravado. Tente de novo em instantes: se ele já tiver chegado, não será duplicado. Se preferir, envie o resumo {alt_contact}.</p><label for="f-resumo-err" class="visually-hidden">Resumo do pedido</label><textarea id="f-resumo-err" readonly></textarea><div class="actions"><button class="btn btn-wine" type="button" data-retry>Tentar de novo</button><button class="btn btn-line" type="button" data-copy>Copiar resumo</button>{wa_retry}</div><p class="form-status" data-copy-status aria-live="polite"></p></template>
    </div>
    <aside class="aside" aria-labelledby="depois-t">
      <div class="stack" style="gap:14px"><h2 id="depois-t">O que acontece depois</h2><ol><li><span>Lemos o seu pedido e, se precisar, fazemos perguntas rápidas.</span></li><li><span>Preparamos a proposta com solução, peças, quantidades e condições.</span></li><li><span>Você aprova a arte antes de qualquer peça entrar em produção.</span></li></ol></div>
      {contact_block}
      {wa_button('btn btn-line', 'Prefiro conversar no WhatsApp')}
    </aside>
  </div>
</section>''',
    }


def page_obrigado():
    return {
        'path': '/obrigado/', 'title': 'Pedido recebido | TaMa Creative', 'index': False,
        'description': 'Recebemos o seu pedido de proposta. A TaMa Creative responde pelo contato informado.',
        'body': '''<section class="section"><div class="wrap"><div class="section-head" style="max-width:44rem"><p class="eyebrow">Pedido enviado</p><h1>Recebemos o seu pedido</h1><p class="lead">Vamos responder pelo contato informado. Enquanto isso, veja o catálogo.</p><div class="actions"><a class="btn btn-wine" href="/catalogo/">Ver o catálogo</a><a class="btn btn-line" href="/">Voltar ao início</a></div></div></div></section>''',
    }


def page_privacidade():
    contato = EMAIL and f'pelo e-mail <a href="mailto:{esc(EMAIL)}">{esc(EMAIL)}</a>' or 'pelo formulário de <a href="/solicitar-proposta/">solicitação de proposta</a>'
    return {
        'path': '/privacidade/', 'title': 'Política de privacidade | TaMa Creative',
        'description': 'Como a TaMa Creative trata os dados enviados pelo formulário de proposta, conforme a Lei Geral de Proteção de Dados (LGPD).',
        'trail': [('/', 'Início'), ('/privacidade/', 'Privacidade')],
        'body': f'''<section class="section"><div class="wrap" style="max-width:52rem"><div class="stack">
  <p class="eyebrow">Privacidade</p><h1>Política de privacidade</h1><p class="muted">Atualizada em {blog.fmt_date(date.today())}.</p>
  {f'<h2 style="font-size:1.6rem">Quem é o responsável pelos dados</h2><p>{empresa_linha()}.</p>' if (RAZAO or CNPJ) else ''}
  <h2 style="font-size:1.6rem">Quais dados coletamos</h2><p>Apenas o que você informa no formulário de proposta: nome, empresa, e-mail ou WhatsApp, tipo de projeto, interesse, quantidade, data desejada, orçamento estimado, peças e cores de interesse e a descrição do objetivo. Junto com o pedido, o site envia a página de onde você veio, a primeira página visitada, o site de referência e os parâmetros de campanha (UTM) do link, quando existirem, para sabermos qual conteúdo gerou o pedido. Nada disso identifica você além do que você mesmo informou.</p>
  <h2 style="font-size:1.6rem">Para que usamos</h2><p>Para responder ao seu pedido e preparar a proposta. Não vendemos nem compartilhamos esses dados para fins de marketing de terceiros.</p>
  <h2 style="font-size:1.6rem">Com quem os dados são compartilhados</h2><ul style="padding-left:1.2em;display:grid;gap:6px"><li>O provedor de hospedagem do site, por onde o pedido passa.</li><li>A ferramenta de automação (n8n) que registra o pedido e avisa a equipe da TaMa por e-mail.</li><li>Ferramentas de gestão de clientes usadas pela TaMa para organizar e responder pedidos.</li>{"<li>Google Analytics, somente se você aceitar os cookies de análise.</li>" if GA4 else ""}</ul>
  <h2 style="font-size:1.6rem">Seleção de peças no navegador</h2><p>As peças que você seleciona ficam guardadas apenas no seu navegador até o envio do pedido, e são apagadas depois de um envio confirmado. A página de origem e os parâmetros de campanha ficam só na sessão do navegador e não são enviados a ferramentas de análise.</p>
  <h2 style="font-size:1.6rem">Por quanto tempo guardamos</h2><p>Pelo tempo necessário para tratar o pedido e manter o histórico comercial, ou até você pedir a exclusão.</p>
  <h2 style="font-size:1.6rem">Seus direitos</h2><p>Pela LGPD (Lei 13.709/2018), você pode pedir acesso, correção ou exclusão dos seus dados e revogar o consentimento a qualquer momento, {contato}.</p>
</div></div></section>''',
    }


def page_404():
    return {
        'path': '/404.html', 'title': 'Página não encontrada | TaMa Creative', 'index': False,
        'description': 'A página que você procurou não existe ou mudou de endereço.',
        'body': '''<section class="section"><div class="wrap"><div class="section-head" style="max-width:44rem"><p class="eyebrow">Erro 404</p><h1>Esta página não existe ou mudou de lugar</h1><p class="lead">O site da TaMa foi reorganizado. Comece por um destes caminhos:</p><div class="actions"><a class="btn btn-wine" href="/">Página inicial</a><a class="btn btn-line" href="/catalogo/">Catálogo</a><a class="btn btn-line" href="/brindes-corporativos-premium/">Ideias por ocasião</a><a class="btn btn-line" href="/solicitar-proposta/">Solicitar proposta</a></div></div></div></section>''',
    }


PAGES = [page_home, page_catalogo, page_brindes, page_kits, page_ativacoes, page_hotelaria, page_curadoria, page_confeccoes, page_sobre,
 page_proposta, page_obrigado, page_privacidade, page_404]


# ------------------------------------------------------------------ static files
def write(rel, content, mode='w'):
    path = os.path.join(DIST, rel.lstrip('/'))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, mode, **({'encoding': 'utf-8'} if 'b' not in mode else {})) as f:
        f.write(content)


def build_static():
    import resvg_py
    from PIL import Image
    import io
    shutil.copytree(os.path.join(SRC, 'fonts'), os.path.join(DIST, 'fonts'), ignore=shutil.ignore_patterns('*.css'))
    write('favicon.svg', open(os.path.join(LOGOS, 'tama-favicon-64.svg'), encoding='utf-8').read())
    # arquivos públicos usados fora do site (ex.: logo da assinatura de e-mail): /email/...
    if os.path.isdir(os.path.join(SRC, 'email')):
        shutil.copytree(os.path.join(SRC, 'email'), os.path.join(DIST, 'email'), dirs_exist_ok=True)
    write('favicon-32.png', resvg_py.svg_to_bytes(svg_path=os.path.join(LOGOS, 'tama-favicon-64.svg'), width=32), 'wb')
    write('apple-touch-icon.png', resvg_py.svg_to_bytes(svg_path=os.path.join(LOGOS, 'tama-avatar-512.svg'), width=180), 'wb')
    write('logo-512.png', resvg_py.svg_to_bytes(svg_path=os.path.join(LOGOS, 'tama-avatar-512.svg'), width=512), 'wb')
    # Share image 1200x630: plum panel with the negative logo + kit photo
    og = Image.new('RGB', (1200, 630), (101, 37, 61))
    photo = Image.open(os.path.join(IMG_SRC, 'v2', 'hero-gift.webp')).convert('RGB')
    ph = photo.resize((1120, 630), Image.LANCZOS).crop((440, 0, 440 + 640, 630))
    og.paste(ph, (560, 0))
    logo = Image.open(io.BytesIO(resvg_py.svg_to_bytes(svg_path=os.path.join(LOGOS, 'tama-logo-vertical-negativo.svg'), width=380))).convert('RGBA')
    og.paste(logo, ((560 - logo.width) // 2, (630 - logo.height) // 2), logo)
    buf = io.BytesIO(); og.save(buf, 'JPEG', quality=86, optimize=True)
    write('og-default.jpg', buf.getvalue(), 'wb')

    indexable = [p for p in BUILT if p.get('index', True) and p['path'] != '/404.html']
    write('robots.txt', f'User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: {SITE}/sitemap.xml\n')
    # lastmod só onde a data é real (artigos do blog); a data do build mudaria em todas as páginas a cada publicação
    urls = ''.join(f'<url><loc>{SITE}{p["path"]}</loc>' + (f'<lastmod>{p["lastmod"]}</lastmod>' if p.get('lastmod') else '') + '</url>' for p in indexable)
    write('sitemap.xml', f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>\n')
    redirects = [
        '/brindes            /catalogo/                      301',
        '/brindes/*          /catalogo/                      301',
        '/adm                /admin/                         301',
        '/kits               /kits-corporativos/             301',
        '/curadoria          /brindes-corporativos-premium/  301',
        '/confeccoes         /confeccoes-personalizadas/     301',
        '/uniformes          /confeccoes-personalizadas/     301',
        '/marcas             /                               301',
        '/branding           /                               301',
        '/branding-identidade-visual/*  /                    301',
        '/ativacoes          /ativacoes-promocionais/        301',
        '/degustacao         /ativacoes-promocionais/        301',
        '/hotelaria          /hotelaria-e-gastronomia/       301',
        '/gastronomia        /hotelaria-e-gastronomia/       301',
        '/projetos/*         /sobre/                         301',
        '/contato            /solicitar-proposta/            301',
        '/proposta           /solicitar-proposta/            301',
    ]
    if CFG.get('redirect_netlify_subdomain'):
        redirects.insert(0, f'{CFG["netlify_subdomain"].rstrip("/")}/*  {SITE}/:splat  301!')
    write('_redirects', '\n'.join(redirects) + '\n')
    csp = ("default-src 'self'; script-src 'self' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; "
           "img-src 'self' data: https://*.google-analytics.com https://www.googletagmanager.com; font-src 'self'; "
           "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com; "
           "form-action 'self'; frame-ancestors 'self'; base-uri 'self'; object-src 'none'")
    # originais do catálogo no mesmo caminho do campo "arquivo": o editor (/admin/) mostra a foto por esse endereço
    for im in PRODUTOS:
        arq = (im.get('arquivo') or '').lstrip('/')
        if arq.startswith('img/produtos/') and os.path.isfile(os.path.join(ROOT, arq)):
            os.makedirs(os.path.join(DIST, os.path.dirname(arq)), exist_ok=True)
            shutil.copy2(os.path.join(ROOT, arq), os.path.join(DIST, arq))
    write('_headers', f'''/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
  Content-Security-Policy: {csp}
/img/*
  Cache-Control: public, max-age=31536000, immutable
/img/produtos/*
  X-Robots-Tag: noindex
/fonts/*
  Cache-Control: public, max-age=31536000, immutable
/assets/*
  Cache-Control: public, max-age=31536000, immutable
''')


BUILT = []


def main():
    global CSS, CSS_FILE, CAT_FILE, JS_FILE
    # Limpa o conteúdo de dist/ sem remover a pasta (um servidor local pode estar usando-a).
    os.makedirs(DIST, exist_ok=True)
    for entry in os.listdir(DIST):
        p = os.path.join(DIST, entry)
        shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    if os.path.isdir(LOGOS_OFICIAIS):
        dif = [f for f in os.listdir(LOGOS_OFICIAIS) if f.endswith('.svg') and (not os.path.exists(os.path.join(LOGOS, f)) or open(os.path.join(LOGOS_OFICIAIS, f), 'rb').read() != open(os.path.join(LOGOS, f), 'rb').read())]
        if dif:
            print(f'AVISO: brand/logos/ difere de tama-creative-logos/svg em {len(dif)} arquivo(s). Copie os SVGs oficiais para brand/logos/ e faça commit.')
    build_images()
    fonts_css = open(os.path.join(SRC, 'fonts', 'fonts.css'), encoding='utf-8').read()
    masks = f':root{{--arc-mask:url("{ARC_MASK}");--pattern-mask:url("{pattern_uri()}")}}'
    CSS = minify_css(fonts_css + masks + open(os.path.join(SRC, 'styles.css'), encoding='utf-8').read())
    CSS_FILE = f'site.{hashlib.md5(CSS.encode()).hexdigest()[:8]}.css'
    write('assets/' + CSS_FILE, CSS)
    cat = catalog_json()
    CAT_FILE = f'catalogo.{hashlib.md5(cat.encode()).hexdigest()[:8]}.js'
    write('assets/' + CAT_FILE, cat)
    js = open(os.path.join(SRC, 'site.js'), encoding='utf-8').read()
    JS_FILE = f'site.{hashlib.md5(js.encode()).hexdigest()[:8]}.js'
    write('assets/' + JS_FILE, js)
    for fn in PAGES + blog.pages(sys.modules[__name__]):
        page = fn()
        BUILT.append(page)
        rel = page['path'] if page['path'].endswith('.html') else page['path'] + 'index.html'
        write(rel, shell(page, page['body']))
    blog.finalize(sys.modules[__name__])
    build_static()
    blog.post_static(sys.modules[__name__])  # editor /admin/ e seus cabeçalhos
    og_images()
    publish_used_images()
    html_all = ''.join(open(os.path.join(dp, f), encoding='utf-8').read() for dp, _, fs in os.walk(DIST) for f in fs if f.endswith('.html'))
    leftovers = [p for p in ('[WhatsApp]', '[e-mail]', '[@instagram]', '@@') if p in html_all]
    total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(DIST) for f in fs)
    print(f'{len(BUILT)} páginas | {total // 1024} KB em dist/ | site_url={SITE} | whatsapp={"sim" if WA else "não"} | email={"sim" if EMAIL else "não"} | ga4={"sim" if GA4 else "não"}')
    if leftovers:
        raise SystemExit(f'Placeholders encontrados no HTML: {leftovers}')


if __name__ == '__main__':
    main()
