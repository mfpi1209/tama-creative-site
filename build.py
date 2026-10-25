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
# Dados do catálogo e do conteúdo (produtos, modelos, seleções, kits e site.json: carrossel, cabeçalhos, vitrines, contato,
# topo e temporada): src/data/, editados no /admin/inventario/. Os testes de fluxo (tests/e2e.mjs) rodam sobre uma cópia
# fixa em tests/fixtures/dados (TAMA_DADOS=tests/fixtures/dados), para a edição de conteúdo pelo cliente não travar a
# publicação; o site que vai ao ar sempre usa src/data/.
DADOS = os.path.join(ROOT, os.environ['TAMA_DADOS']) if os.environ.get('TAMA_DADOS') else os.path.join(SRC, 'data')
_SITE_JSON = os.path.join(DADOS, 'site.json')
SITE_DADOS = json.load(open(_SITE_JSON, encoding='utf-8')) if os.path.exists(_SITE_JSON) else {}
# contato e dados da empresa: site.json › contato (editado no inventário) vale sobre site.config.json; variável de ambiente vale sobre os dois
for key, val in (SITE_DADOS.get('contato') or {}).items():
    if key in ('whatsapp', 'email', 'instagram', 'razao_social', 'cnpj', 'cidade', 'responsavel_comercial'):
        CFG[key] = val
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


def _temporada():
    """Chave da ocasião em destaque (ex.: 'fim-de-ano') quando a data do build está dentro do período de site.json › topo ›
    temporada (editado no inventário; sem ele, site.config.json › temporada). "ligada": false desliga; TEMPORADA=off|chave força."""
    t = (SITE_DADOS.get('topo') or {}).get('temporada') or CFG.get('temporada') or {}
    env = (os.environ.get('TEMPORADA') or '').strip().lower()
    if env:
        return None if env in ('off', '0', 'nao', 'não') else env
    if t.get('ligada') is False:
        return None
    ini, fim, md = t.get('inicio'), t.get('fim'), date.today().strftime('%m-%d')
    if not (t.get('chave') and ini and fim):
        return None
    return t['chave'] if (ini <= md <= fim if ini <= fim else (md >= ini or md <= fim)) else None


SEASON = _temporada()   # hoje só existe a temporada de fim de ano (página /brindes-de-fim-de-ano/)
HTML_SEASON = f' data-temporada="{SEASON}"' if SEASON else ''   # os testes e o CSS sabem se a temporada está ativa
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
SEL = json.load(open(os.path.join(DADOS, 'selecoes.json'), encoding='utf-8'))
OCCS = SEL['ocasioes']
ALIASES = SEL['aliases']
# banco de imagens de produto (docs/BANCO-IMAGENS.md): uma entrada por imagem; o catálogo agrupa por produto
PRODUTOS = json.load(open(os.path.join(DADOS, 'produtos.json'), encoding='utf-8'))['imagens']
CAT_PROD = {'vestuario': 'Vestuário', 'canetas-escritorio': 'Canetas e escritório', 'tecnologia': 'Tecnologia', 'bolsas-embalagens': 'Bolsas e embalagens', 'garrafas-copos': 'Garrafas e copos',
            'cozinha-bar': 'Cozinha e bar', 'acessorios': 'Acessórios', 'casa-bem-estar': 'Casa e bem-estar', 'hotelaria-gastronomia': 'Hotelaria e gastronomia'}
# Tipos de peça (menu Brindes e Confecções, filtro ?tipo= do catálogo): o 1º padrão que casa com o id do modelo (o nome do
# banco de imagens sem acentos, ex.: taca-de-gin) define o tipo, então a ordem é a prioridade. O nome de exibição de
# modelos.json não entra ("Vela aromática em copo" não é copo). Sem padrão, a categoria tecnologia vira o tipo tecnologia.
# Chaves e rótulos dos brindes: lista da apresentação de 20/10 (lotes.json › tipos).
TIPOS = [
    ('tacas', 'Taças', r'^(taca|flute)s?\b'),
    ('copos', 'Copos', r'^copos?\b'),                                   # inclusive "Copo de vinho com tampa"
    ('porta-vinho', 'Porta-vinho', r'^porta-vinhos?\b|-para-vinho\b'),  # "Estojo para vinho", "Bolsa térmica para vinho"
    ('canecas', 'Canecas', r'^canecas?\b'),
    ('xicaras', 'Xícaras', r'^xicaras?\b'),
    ('squeezes', 'Squeezes e garrafas', r'^(squeeze|garrafa)s?\b'),    # âncora no início: "Chaveiro abridor de garrafa" fica de fora
    ('agendas', 'Agendas e cadernos', r'^(agenda|caderno|caderneta|bloco)s?\b'),
    ('canetas', 'Canetas', r'^canetas?\b'),
    ('mochilas', 'Mochilas e ecobags', r'^(mochila|ecobag)s?\b|^sacola-de-alca-longa\b'),
    ('polos', 'Camisetas polo', r'^polos?\b|^camiseta-polo\b'),         # antes de camisetas
    ('camisetas', 'Camisetas', r'^camisetas?\b'),
    ('moletons', 'Blusas de moletom', r'^(blusa-de-)?moletom\b|^moletons\b'),
    ('camisas', 'Camisas', r'^camisas?\b'),
    ('dolmas', 'Dólmãs', r'^dolmas?\b'),
    ('aventais', 'Aventais', r'^aventa(l|is)\b'),
    ('bones', 'Bonés', r'^bones?\b'),
    # tipos dos modelos novos que não estão no menu (filtram o catálogo pelo ?tipo=)
    ('bolsas', 'Bolsas e nécessaires', r'^(bolsa|necessaire)s?\b'),
    ('escritorio', 'Escritório', r'^(porta-canetas|porta-cartao|porta-cartoes|suporte-de-celular|estojo-de-escritorio)\b'),
    ('cozinha', 'Cozinha', r'^(tabua|kit-churrasco|cortador)\b'),
    ('bar', 'Bar', r'^(coqueteleira|abridor|porta-lata)\b'),
]
TIPO_DA_CATEGORIA = {'tecnologia': 'tecnologia'}
TIPO_ROTULO = {**{k: r for k, r, _ in TIPOS}, 'tecnologia': 'Tecnologia'}
_TIPOS_RE = [(k, re.compile(p)) for k, _, p in TIPOS]


def tipo_do_modelo(slug, categoria):
    """Tipo de peça do modelo (chave de TIPO_ROTULO) ou '' quando nenhum padrão casa."""
    return next((k for k, rx in _TIPOS_RE if rx.search(slug)), TIPO_DA_CATEGORIA.get(categoria, ''))


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
    for nome, todas in grupos.items():
        # vista: "frente" (uma foto por cor, padrão), "grupo" (todas as cores juntas), "verso" e "detalhe" (galeria)
        ims = [i for i in todas if (i.get('vista') or 'frente') == 'frente']
        extras = [i for i in todas if (i.get('vista') or 'frente') != 'frente']
        if not ims:
            continue
        slug = color_slug(nome)
        base_id = SEL.get('foto_base', {}).get(slug)
        originais = [i for i in ims if not (i.get('observacao') or '').startswith('Variação de cor')]
        base = next((i for i in ims if i['id'] == base_id), (originais or ims)[0])
        ims = [base] + [i for i in ims if i is not base]
        cores = [[i['cor']['nome'], i['cor']['hex'], i['id'], i['alt']] for i in ims]
        grupo = next((i for i in extras if i['vista'] == 'grupo'), None)
        versos = {i['cor']['nome']: i['id'] for i in extras if i['vista'] == 'verso'}
        detalhes = {i['cor']['nome']: i['id'] for i in extras if i['vista'] == 'detalhe'}
        out.append({'slug': slug, 'nome': nome, 'img': base['id'], 'categoria': base['categoria'], 'tipo': tipo_do_modelo(slug, base['categoria']), 'descricao': base.get('modelo') or '',
                    'meta': spec_line(base), 'alt': base['alt'], 'cores': cores, 'ocasioes': SEL.get('ocasioes_por_modelo', {}).get(slug, []),
                    'url': f'/catalogo/{slug}/', 'grupo': grupo and [grupo['id'], grupo['alt']], 'versos': versos, 'detalhes': detalhes,
                    'extras': [[i['id'], i['vista'], i['alt']] for i in extras if i['vista'] != 'grupo'], 'base': base})
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
# ------------------------------------------------------------------ textos padronizados
# A TaMa presta serviço: seleciona, personaliza, coordena fornecedores e entrega peças com a marca DO CLIENTE. As fotos
# mostram a marca TaMa (ou uma marca fictícia) só como exemplo de aplicação. Duas notas de imagem, as mesmas em todo o site:
NOTA_TAMA = 'Imagem ilustrativa: a marca TaMa aparece como exemplo; no seu projeto, entra a marca da sua empresa.'
NOTA_TAMA_CURTA = 'Imagem ilustrativa • Marca TaMa como exemplo'   # legendas curtas (cards, foto ampliada)
NOTA_FICTICIA = 'Imagem ilustrativa • Marca fictícia'               # cenas com marca fictícia (Nexo, Vera, Elo, Solar, Oliva…)
# Onde as duas convivem (carrossel da home e rodapé) e fotos conceituais sem marca aplicada (capas do blog):
NOTA_MISTA = 'Imagens ilustrativas: a marca TaMa e marcas fictícias aparecem como exemplo; no seu projeto, entra a marca da sua empresa.'
CAP = 'Imagem ilustrativa'
# Nota única sob as grades de produto e na página do modelo: a mesma em todo o site.
NOTE_IMAGENS = NOTA_TAMA + ' Cores de referência, sem declaração de estoque. Modelo, material e personalização são confirmados na proposta.'
# Complemento da nota sob os kits (home, página de kits e fim de ano); a primeira frase vem de nota_kits().
NOTE_KITS_EXTRA = ' Caixa, cartão e peças seguem as cores da sua empresa; a composição é confirmada na proposta.'
# Rodapé: a nota mista mais a ressalva comercial (vale com ou sem os mockups de marca).
NOTE_RODAPE = NOTA_MISTA + ' Não representam estoque nem trabalhos para clientes.'
# Texto alternativo só descreve a foto: a nota ("Imagem ilustrativa.", "Mockup ilustrativo com marca fictícia.") que
# alguns cadastros trazem no fim do alt é retirada no build, porque a legenda já diz isso.
ALT_NOTA_RE = re.compile(r'\s*(?:Imagem|Mockup|Cena) ilustrativ[oa](?: com marca fictícia)?\.?\s*$', re.I)
ALT_PREFIXO_RE = re.compile(r'^\s*(?:Imagem|Mockup|Cena) ilustrativ[oa]:\s*', re.I)
# Mesma nota em forma de frase para cenas com marca fictícia (notas sob kits e legenda do carrossel).
NOTA_FICTICIA_LONGA = 'Imagem ilustrativa: a marca é fictícia e aparece como exemplo; no seu projeto, entra a marca da sua empresa.'


def nota_marca(textos):
    """Escolhe a nota em frase pela marca que aparece nas fotos (pelos textos alternativos): TaMa, fictícia ou as duas."""
    t = ' '.join(textos)
    tama, fict = 'TaMa' in t, 'fictícia' in t
    return NOTA_MISTA if tama and fict else NOTA_FICTICIA_LONGA if fict else NOTA_TAMA
# Assinatura da agência (barra do topo, rodapé, blog): as cinco áreas de NAV, na mesma ordem.
_TOPO = SITE_DADOS.get('topo') or {}
ASSINATURA = _TOPO.get('assinatura') or 'Brindes, uniformes, kits, ativações e hotelaria para empresas.'
# Três compromissos, iguais na barra do topo e na faixa abaixo do carrossel.
GARANTIAS = (_TOPO.get('garantias') or ['Atendimento consultivo', 'Arte aprovada antes da produção', 'Coordenação do pedido à entrega'])[:3]


# ------------------------------------------------------------------ images
IMAGES = {}


# largura real da foto do carrossel (fotos 3:2 na metade direita; no celular, um pouco maior que a tela por causa do corte)
HERO_SIZES = '(max-width: 760px) 120vw, 95vw'
CARROSSEL_HQ = {s['imagem'] for s in SITE_DADOS.get('carrossel') or [] if s.get('imagem')}   # fotos do carrossel (site.json)
# fotos do carrossel mais estreitas que 1,9:1 que também já trazem o vazio do texto à esquerda (fim-header: a parede
# iluminada ocupa o primeiro terço; a taça solta começa em ~37% da largura)
CARROSSEL_RESPIRO = {s['imagem'] for s in SITE_DADOS.get('carrossel') or [] if s.get('respiro')}
FOTOS_HQ = CARROSSEL_HQ | {'home-frente-brindes-v2', 'home-frente-confeccoes-v2', 'home-frente-kits-v2', 'kits-header', 'kits-header-v3', 'conf-header', 'ativ-header', 'hot-header', 'brindes-header', 'brindes-entrega', 'fim-header', 'blog-header', 'sobre-header', 'ocasiao-boas-vindas', 'ocasiao-eventos', 'ocasiao-executivos', 'ocasiao-campanhas', 'ocasiao-lancamentos', 'ocasiao-reconhecimento', 'sobre-caderno', 'sobre-uniforme', 'sobre-caixa', 'slide-ativacoes'} | {c['imagem'] for c in (SITE_DADOS.get('cabecalhos') or {}).values() if c.get('imagem')} | {n for n in re.findall(r'"((?:topo|secao)-[a-z0-9-]+)"', json.dumps(SITE_DADOS.get('secoes') or {}))}   # fotos enviadas em alta pela TaMa, as dos cabeçalhos e as enviadas pelo inventário (site.json)


def build_images():
    from PIL import Image
    out = os.path.join(DIST, 'img')
    os.makedirs(out, exist_ok=True)
    cache = os.path.join(ROOT, '.cache', 'img')
    os.makedirs(cache, exist_ok=True)
    sources = [(fn[:-4], os.path.join(IMG_SRC, fn)) for fn in os.listdir(IMG_SRC) if fn.lower().endswith('.jpg')]
    v2 = os.path.join(IMG_SRC, 'v2')
    if os.path.isdir(v2):
        # .webp das fotos do site; .png/.jpg chegam pelo /admin/inventario/ (navegadores que não gravam WebP)
        sources += [(os.path.splitext(fn)[0], os.path.join(v2, fn)) for fn in sorted(os.listdir(v2)) if fn.lower().endswith(('.webp', '.png', '.jpg', '.jpeg'))]
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
            hq = name in FOTOS_HQ   # fotos do carrossel e das frentes da home: mais qualidade (detalhes nítidos em tela grande)
            for ext, kw in (('avif', {'quality': 64 if hq else 52}), ('webp', {'quality': 88 if hq else 78, 'method': 6}), ('jpg', {'quality': 90 if hq else 80, 'optimize': True, 'progressive': True})):
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
    if alt:   # o alt só descreve a foto: a nota "ilustrativa" fica na legenda, não repetida aqui
        alt = ALT_NOTA_RE.sub('', ALT_PREFIXO_RE.sub('', alt)).strip()
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


SPEC_RE = re.compile(r'\b(couros?|acr[íi]licos?|alum[íi]nio|inox\w*|a[çc]o|algod[ãa]o|piquet|piqu[êe]|cer[âa]micas?|porcelanas?|bambu|vidros?|madeiras?|pap[ée]is|papel|pl[áa]stic[oa]s?|metal|metais|met[áa]lic[oa]s?|cera|kraft|ecol[óo]gic[oa]s?|corti[çc]a|silicone|poli[ée]ster|linho|\d+(?:[.,]\d+)?\s?(?:ml|l|litros?|gb|tb|mah|w)|bluetooth\s?\d)\b', re.I)


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
        if (im.get('vista') or 'frente') not in ('frente', 'grupo', 'verso', 'detalhe'):
            erros.append(f'{nome}: vista inválida')
        if im.get('vista') != 'grupo' and not re.fullmatch(r'#[0-9A-Fa-f]{6}', cor.get('hex') or ''):
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
# Modelos fora do site: todas as fotos em "retirada"/"substituir" (o /admin/inventario/ tira um modelo inteiro assim).
# Cadastros em modelos.json e referências em selecoes.json e nas páginas continuam válidos e são ignorados, para o
# modelo poder voltar ao site sem perder textos nem posições.
FORA_DO_SITE = {color_slug(i['produto']) for i in PRODUTOS} - {c['slug'] for c in CATALOGO}
FORA_NOMES = {i['produto'] for i in PRODUTOS if color_slug(i['produto']) in FORA_DO_SITE}
# Cadastro por modelo (src/data/modelos.json, editado em /admin/ › Catálogo › Modelos): resumo, usos, medidas, gênero,
# título e descrição para o Google. Ligado ao catálogo pelo nome do produto; o build barra dado inválido.
_MODELOS_JSON = os.path.join(DADOS, 'modelos.json')
MODELOS = (json.load(open(_MODELOS_JSON, encoding='utf-8')).get('modelos') or []) if os.path.exists(_MODELOS_JSON) else []


def preparar_modelos():
    nomes, erros, vistos = {c['nome'] for c in CATALOGO}, [], set()
    for m in MODELOS:
        p = m.get('produto') or ''
        if p in FORA_NOMES:   # modelo fora do site: o cadastro fica guardado para quando ele voltar
            vistos.add(p)
            continue
        if p not in nomes:
            erros.append(f'"{p}": não há produto com esse nome no catálogo (o nome tem de ser igual ao do banco de imagens)')
        if p in vistos:
            erros.append(f'"{p}": cadastrado duas vezes')
        vistos.add(p)
        if (m.get('genero') or '') not in ('', 'f', 'm'):
            erros.append(f'"{p}": gênero deve ser f ou m')
        if len(m.get('resumo') or '') > 700:
            erros.append(f'"{p}": resumo com mais de 700 caracteres')
        if len(m.get('titulo_seo') or '') > 65:
            erros.append(f'"{p}": título para o Google com mais de 65 caracteres')
        d = m.get('descricao_seo') or ''
        if d and not 70 <= len(d) <= 160:
            erros.append(f'"{p}": descrição para o Google fora de 70 a 160 caracteres ({len(d)})')
        if (m.get('medidas') or {}).get('status', 'a_confirmar') not in ('a_confirmar', 'confirmado'):
            erros.append(f'"{p}": medidas com status inválido')
    if erros:
        raise SystemExit('Modelos do catálogo (src/data/modelos.json) com erro:\n  ' + '\n  '.join(erros))
    por_nome = {m['produto']: m for m in MODELOS}
    for c in CATALOGO:
        c['info'] = por_nome.get(c['nome'], {})
        # nome de exibição (modelos.json › nome): o slug e a URL continuam vindo do nome do banco de imagens
        if c['info'].get('nome'):
            c['nome_banco'], c['nome'] = c['nome'], c['info']['nome']


preparar_modelos()
CATALOGO_BY = {c['slug']: c for c in CATALOGO}
CABECALHOS_SITE = ('brindes', 'kits', 'confeccoes', 'ativacoes', 'hotelaria', 'fim-de-ano', 'sobre')
VITRINES_SITE = ('brindes', 'confeccoes', 'ativacoes', 'hotelaria', 'fim-brindar', 'fim-presentear')
TONS_CARROSSEL = ('tone-cream', 'tone-sage', 'tone-rose', 'tone-linen')
TIPOS_PEDIDO = ('', 'brindes', 'confeccoes', 'kits', 'ativacoes', 'hotelaria')


def preparar_site():
    """site.json (inventário › Carrossel, Páginas, Contato e rodapé): o build barra o que quebraria a página. As fotos são
    conferidas depois de carregar as imagens (conferir_imagens_site)."""
    erros, d = [], SITE_DADOS
    if not d:
        return
    estilo_ok = lambda v: re.fullmatch(r'[-a-z0-9:;%. ]*', v or '') is not None   # vai num atributo style
    link_ok = lambda v: bool(re.fullmatch(r'(/[^\s"<>]*|https://[^\s"<>]+)', v or ''))
    slides, ids = d.get('carrossel') or [], set()
    if not any(sl.get('ativo', True) is not False for sl in slides):
        erros.append('carrossel: deixe pelo menos um slide ativo')
    for n, sl in enumerate(slides, 1):
        nome = f"carrossel, slide {n} ({sl.get('eyebrow') or sl.get('id') or '?'})"
        if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', sl.get('id') or '') or sl.get('id') in ids:
            erros.append(f'{nome}: identificador inválido ou repetido')
        ids.add(sl.get('id'))
        for campo in ('imagem', 'alt', 'eyebrow', 'titulo', 'texto'):
            if not (sl.get(campo) or '').strip():
                erros.append(f'{nome}: {campo} é obrigatório')
        if (sl.get('tom') or 'tone-cream') not in TONS_CARROSSEL:
            erros.append(f'{nome}: tom de fundo inválido')
        if not estilo_ok(sl.get('enquadramento')):
            erros.append(f'{nome}: enquadramento inválido')
        if ((sl.get('botao') or {}).get('tipo') or '') not in TIPOS_PEDIDO:
            erros.append(f'{nome}: tipo de pedido do botão inválido')
        b2 = sl.get('botao2') or {}
        if b2.get('texto') and not link_ok(b2.get('link')):
            erros.append(f'{nome}: o link do 2º botão tem de começar com / (página do site) ou https://')
    for chave in CABECALHOS_SITE:
        c = (d.get('cabecalhos') or {}).get(chave)
        if not c:
            erros.append(f'cabeçalho "{chave}" não existe'); continue
        for campo in ('imagem', 'alt', 'eyebrow', 'texto'):
            if not (c.get(campo) or '').strip():
                erros.append(f'cabeçalho "{chave}": {campo} é obrigatório')
        if not [x for x in c.get('linhas') or [] if x.strip()] or not [x for x in c.get('destaque') or [] if x.strip()]:
            erros.append(f'cabeçalho "{chave}": título e destaque precisam de pelo menos uma linha')
        if not estilo_ok(c.get('posicao_celular')):
            erros.append(f'cabeçalho "{chave}": posição da foto no celular inválida')
    conhecidos = set(CATALOGO_BY) | set(ALIASES) | FORA_DO_SITE
    for chave in VITRINES_SITE:
        v = (d.get('vitrines') or {}).get(chave)
        if not v:
            erros.append(f'vitrine "{chave}" não existe'); continue
        for campo in ('eyebrow', 'titulo', 'texto'):
            if not (v.get(campo) or '').strip():
                erros.append(f'vitrine "{chave}": {campo} é obrigatório')
        erros += [f'vitrine "{chave}": modelo "{m}" não existe no catálogo' for m in v.get('modelos') or [] if m not in conhecidos]
    ct = d.get('contato') or {}
    if ct.get('whatsapp') and not re.fullmatch(r'\d{12,13}', re.sub(r'\D', '', ct['whatsapp'])):
        erros.append('contato: WhatsApp com DDI e DDD, só números (ex.: 5511999999999)')
    if ct.get('email') and not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+', ct['email']):
        erros.append('contato: e-mail inválido')
    for rede in ('linkedin', 'facebook', 'youtube'):
        if ct.get(rede) and not ct[rede].startswith('https://'):
            erros.append(f'contato: o endereço do {rede} tem de começar com https://')
    sc = d.get('secoes') or {}
    obrig = lambda nome, item, campos: [f'{nome}: {c} é obrigatório' for c in campos if not str(item.get(c) or '').strip()]
    for n, f in enumerate((sc.get('home-frentes') or {}).get('itens') or [], 1):
        erros += obrig(f'home, cartão {n}', f, ('link', 'imagem', 'chamada'))
        if len([x for x in f.get('titulo') or [] if x.strip()]) != 2 or len([x for x in f.get('texto') or [] if x.strip()]) != 2:
            erros.append(f'home, cartão {n}: título e texto têm 2 linhas cada')
        if not estilo_ok(f.get('posicao')):
            erros.append(f'home, cartão {n}: posição da foto inválida')
    if sc.get('brindes-entrega'):
        erros += obrig('brindes, foto da entrega', sc['brindes-entrega'], ('imagem', 'alt'))
    fm = sc.get('ativacoes-formatos') or {}
    for n, i in enumerate(fm.get('itens') or [], 1):
        erros += obrig(f'ativações, formato {n}', i, ('titulo', 'texto'))
    for n, c in enumerate((sc.get('ativacoes-cenas') or {}).get('itens') or [], 1):
        erros += obrig(f'ativações, cena {n}', c, ('imagem', 'alt'))
    for n, c in enumerate((sc.get('sobre-cenas') or {}).get('itens') or [], 1):
        erros += obrig(f'sobre, cena {n}', c, ('imagem', 'alt', 'texto', 'destaque'))
    for k, c in (sc.get('ocasioes') or {}).items():
        erros += obrig(f'ocasião {k}', c, ('imagem', 'alt', 'eyebrow', 'texto'))
        if not [x for x in c.get('linhas') or [] if x.strip()] or not [x for x in c.get('destaque') or [] if x.strip()]:
            erros.append(f'ocasião {k}: título e destaque precisam de pelo menos uma linha')
    tp = d.get('topo') or {}
    if len([g for g in tp.get('garantias') or [] if g.strip()]) != 3:
        erros.append('topo: os compromissos são 3 frases')
    t = tp.get('temporada') or {}
    if t and not all(re.fullmatch(r'(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])', t.get(k) or '') for k in ('inicio', 'fim')):
        erros.append('temporada: início e fim no formato MM-DD (ex.: 10-01)')
    if erros:
        raise SystemExit('Conteúdo do site (src/data/site.json) com erro:\n  ' + '\n  '.join(erros))


def conferir_imagens_site():
    """Depois de build_images(): toda foto citada no carrossel e nos cabeçalhos existe em img/ (img/v2/ para as enviadas)."""
    falta = [f"carrossel ({sl.get('eyebrow')}): {sl['imagem']}" for sl in SITE_DADOS.get('carrossel') or [] if sl.get('ativo', True) is not False and sl['imagem'] not in IMAGES]
    falta += [f"cabeçalho {k}: {c['imagem']}" for k, c in (SITE_DADOS.get('cabecalhos') or {}).items() if c['imagem'] not in IMAGES and k != 'kits']
    sc = SITE_DADOS.get('secoes') or {}
    fotos = ([('home, cartão', f['imagem']) for f in (sc.get('home-frentes') or {}).get('itens') or []] +
             ([('brindes, entrega', sc['brindes-entrega']['imagem'])] if sc.get('brindes-entrega') else []) +
             [('sobre, cena', c['imagem']) for c in (sc.get('sobre-cenas') or {}).get('itens') or []] +
             [(f'ocasião {k}', c['imagem']) for k, c in (sc.get('ocasioes') or {}).items()])   # cenas de ativações: só entram as que existem
    falta += [f'{onde}: {img}' for onde, img in fotos if img not in IMAGES]
    if falta:
        raise SystemExit('Conteúdo do site (src/data/site.json): foto não encontrada em img/v2/:\n  ' + '\n  '.join(falta))


preparar_site()
_falta = [m for m in SEL.get('home', []) + SEL.get('prioridade', []) + list(SEL.get('foto_base', {})) + list(SEL.get('ocasioes_por_modelo', {})) + list(ALIASES.values()) if m not in CATALOGO_BY and m not in FORA_DO_SITE]
if _falta:
    raise SystemExit(f'selecoes.json aponta para modelos que não existem em produtos.json: {sorted(set(_falta))}')


def modelo(slug):
    """Modelo do catálogo por id atual ou por slug antigo (aliases). Id desconhecido para o build: uma página não
    pode perder um card em silêncio (ex.: produto renomeado no /admin/ sem alias em selecoes.json)."""
    slug = ALIASES.get(slug, slug)
    m = CATALOGO_BY.get(slug)
    if not m and slug in FORA_DO_SITE:   # tirado do site no inventário: a página segue sem o card
        return None
    if not m:
        raise SystemExit(f'Modelo {slug!r} não existe em produtos.json (renomeado? acrescente o id antigo em aliases de selecoes.json)')
    return m


def catalog_json():
    """Dados dos modelos para a seleção e a foto ampliada: um arquivo só (/assets/catalogo.<hash>.js), em cache entre páginas.
    TAMA_ALIAS leva seleções salvas com slugs antigos para o id atual."""
    data = {c['slug']: {'n': c['nome'], 'i': img_url(c['img'], 'webp', 420), 'c': home_colors(c), 'v': home_variants(c)} for c in CATALOGO}
    for c in CATALOGO:   # verso de cada cor: aparece ao passar o mouse no card e acompanha a cor escolhida
        vs = {cor: [IMAGES[i]['stem'], IMAGES[i]['widths'], ''] for cor, i in c['versos'].items() if i in IMAGES}
        if vs:
            data[c['slug']]['vv'] = vs
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
            out[c[0]] = [IMAGES[c[2]]['stem'], IMAGES[c[2]]['widths'], (c[3] if len(c) > 3 else f"{h['nome']} na cor {c[0].lower()}.")]
    return out if len(out) > 1 else {}


def home_product_card(h, eager=False, sizes='(max-width: 760px) 46vw, (max-width: 1180px) 30vw, 290px', extra=''):
    """Card de estúdio (home, catálogo e páginas de frente): a foto e o nome levam à página do produto (/catalogo/<nome>/);
    o "+" abre a foto ampliada; as bolinhas trocam a foto pela da cor. Com foto de grupo no banco, o card abre nela
    (todas as cores juntas); com foto do verso, ela aparece ao passar o mouse."""
    cat = f' data-cat="{h["categoria"]}"' if h.get('categoria') in CAT_PROD else ''
    occ = f' data-occ="{" ".join(h["ocasioes"])}"' if h.get('ocasioes') else ''
    c = CATALOGO_BY.get(h['slug'], {})
    url = c.get('url')
    cores = home_colors(h)
    grupo = c.get('grupo') if c.get('grupo') and c['grupo'][0] in IMAGES else None
    foto = picture(grupo[0], grupo[1], sizes, eager=eager) if grupo else picture(h['img'], h['alt'], sizes, eager=eager)
    verso_id = (c.get('versos') or {}).get(h['cores'][0][0])
    verso = f'<span class="prod-alt">{picture(verso_id, "", sizes)}</span>' if verso_id in IMAGES else ''
    slug, nome = h['slug'], h['nome']
    zoom = f'<button class="prod-zoom" type="button" data-zoom="{slug}" aria-label="Ampliar foto de {esc(nome)}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg></button>'
    alt_cls = ' has-alt' if verso else ''
    media = (f'<a class="prod-media{alt_cls}" href="{url}" tabindex="-1" aria-hidden="true">{foto}{verso}</a>{zoom}' if url
             else f'<button class="prod-media" type="button" data-zoom="{slug}" aria-label="Ampliar foto de {esc(nome)}">{foto}</button>')
    titulo = f'<a class="prod-link" href="{url}">{nome}</a>' if url else nome
    rotulo = f'{len(cores)} cores' if grupo and len(cores) > 1 else h['cores'][0][0]
    return f'''<article class="product studio" id="{h['slug']}" data-slug="{h['slug']}"{cat}{occ}{extra}>
  {media}
  <div class="prod-info">
    <h3>{titulo}</h3>
    <p class="prod-desc">{h['descricao']}</p>
    <div class="swatch-row">{swatches(dict(h, cores=cores))}<span class="color-name">{rotulo}</span></div>
    <p class="prod-meta{' is-pending' if 'sob consulta' in h['meta'] else ''}">{h['meta']}</p>
    <div class="prod-actions">
      <button class="pick" type="button" data-slug="{h['slug']}" aria-pressed="false"><span class="when-off">+ Selecionar</span><span class="when-on">✓ Selecionado</span><span class="visually-hidden">: {h['nome']}</span></button>
    </div>
  </div>
</article>'''


# Famílias de cor do filtro do catálogo: os 26 nomes de cor do banco viram 8 opções (a bolinha mostra o tom da família)
FAMILIAS = {
    'preto': ('Preto', '#1E1E1E', ['Preto']),
    'branco': ('Branco e claros', '#F7F5F0', ['Branco', 'Cru', 'Creme', 'Transparente']),
    'cinza': ('Cinza e metálicos', '#A3A3A0', ['Cinza', 'Prata', 'Inox', 'Dourado']),
    'azul': ('Azul', '#1F4FB8', ['Azul-marinho', 'Azul royal', 'Jeans']),
    'vermelho': ('Vermelho e bordô', '#B3202F', ['Vermelho', 'Bordô']),
    'verde': ('Verde', '#1F6B45', ['Verde', 'Verde-escuro']),
    'rosa': ('Rosa', '#E07A9B', ['Rosa']),
    'marrom': ('Marrons e naturais', '#A0623A', ['Caramelo', 'Café', 'Havana', 'Taupe', 'Kraft', 'Bambu', 'Natural', 'Terracota', 'Âmbar']),
}
FAMILIA_DA_COR = {nome: k for k, (_, _, nomes) in FAMILIAS.items() for nome in nomes}


def busca_norm(s):
    return ' '.join(color_slug(s).split('-'))


def catalogo_block():
    """Catálogo: busca + filtro lateral (categoria, tipo de peça, ocasião e família de cor) e grade grande. No celular, os
    filtros abrem numa gaveta. O estado vai para a URL (?q=, ?tipo=, ?categoria=, ?ocasiao=, ?cor=), para compartilhar o
    resultado. O tipo (data-tipo, links do menu) e a ocasião (data-occ, links das páginas de ocasião) também aparecem como
    etiqueta removível acima da grade."""
    cats = [(k, v, sum(1 for c in CATALOGO if c['categoria'] == k)) for k, v in CAT_PROD.items()]
    cat_opts = (f'<label class="cat-opt"><input type="radio" name="categoria" value="" checked> <span>Todas</span> <small>{len(CATALOGO)}</small></label>'
                + ''.join(f'<label class="cat-opt"><input type="radio" name="categoria" value="{k}"> <span>{v}</span> <small>{n}</small></label>' for k, v, n in cats if n))
    # tipo de peça: na ordem do menu (brindes, depois confecções, depois os demais), só os tipos com modelo
    ordem_t = list(dict.fromkeys(MENU_BRINDES + [k for k, _ in MENU_CONFECCOES] + list(TIPO_ROTULO)))
    tipo_opts = (f'<label class="cat-opt"><input type="radio" name="tipo" value="" checked> <span>Todos</span> <small>{len(CATALOGO)}</small></label>'
                 + ''.join(f'<label class="cat-opt"><input type="radio" name="tipo" value="{k}"> <span>{TIPO_ROTULO[k]}</span> <small>{n}</small></label>'
                           for k, n in ((k, sum(1 for c in CATALOGO if c['tipo'] == k)) for k in ordem_t) if n))
    # ocasião: mesma regra do data-occ dos cards; Fim de ano vem logo depois de "Todas" (temporada), as outras seguem a ordem do selecoes.json
    occs = sorted(OCCS.items(), key=lambda kv: kv[0] != (SEASON or 'fim-de-ano'))   # a ocasião da temporada vem primeiro
    occ_opts = (f'<label class="cat-opt"><input type="radio" name="ocasiao" value="" checked> <span>Todas</span> <small>{len(CATALOGO)}</small></label>'
                + ''.join(f'<label class="cat-opt{" is-season" if k == "fim-de-ano" else ""}"><input type="radio" name="ocasiao" value="{k}"> <span>{v}</span> <small>{n}</small></label>'
                          for k, v, n in ((k, v, sum(1 for c in CATALOGO if k in c['ocasioes'])) for k, v in occs) if n))
    cor_opts = ''.join(f'<label class="cat-opt cor"><input type="checkbox" name="cor" value="{k}"> <i style="--c:{hexv}" aria-hidden="true"></i><span>{nome}</span></label>'
                       for k, (nome, hexv, _) in FAMILIAS.items())
    cards = []
    for i, c in enumerate(CATALOGO):
        cores = [n for n, _ in home_colors(c)]
        fams = sorted({FAMILIA_DA_COR.get(n, '') for n in cores} - {''})
        busca = busca_norm(' '.join([c['nome'], c.get('descricao') or ''] + cores))   # a categoria é filtro, não termo de busca
        cards.append(home_product_card(c, eager=i < 2, sizes='(max-width: 760px) 92vw, (max-width: 1180px) 32vw, 360px',
                                       extra=f' data-tipo="{c["tipo"]}" data-cores="{" ".join(fams)}" data-busca="{esc(busca)}"'))
    familias_json = esc(json.dumps(FAMILIA_DA_COR, ensure_ascii=False, separators=(',', ':')))
    ocasioes_json = esc(json.dumps(OCCS, ensure_ascii=False, separators=(',', ':')))
    tipos_json = esc(json.dumps(TIPO_ROTULO, ensure_ascii=False, separators=(',', ':')))
    lupa = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20"/></svg>'
    return f'''<section class="section catalogo" id="catalogo" aria-labelledby="catalogo-t" style="padding-top:0">
  <div class="wrap cat-layout" data-catalogo data-familias="{familias_json}" data-ocasioes="{ocasioes_json}" data-tipos="{tipos_json}">
    <h2 id="catalogo-t" class="visually-hidden">Modelos</h2>
    <div class="cat-scrim" data-cat-close hidden></div>
    <div class="cat-side" id="cat-filtros" aria-labelledby="cat-filtros-t">
      <div class="cat-side-head"><p class="cat-side-title" id="cat-filtros-t">Filtros</p><button class="icon-btn" type="button" data-cat-close aria-label="Fechar filtros"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <form class="cat-form" id="cat-form">
        <fieldset><legend>Categoria</legend>{cat_opts}</fieldset>
        <fieldset><legend>Tipo de peça</legend>{tipo_opts}</fieldset>
        <fieldset><legend>Ocasião</legend>{occ_opts}</fieldset>
        <fieldset><legend>Cor</legend>{cor_opts}</fieldset>
        <button class="link cat-clear" type="reset">Limpar filtros</button>
      </form>
      <div class="cat-side-foot"><button class="btn btn-wine" type="button" data-cat-close><span>Ver <span data-cat-n>{len(CATALOGO)}</span> modelos</span></button></div>
    </div>
    <div class="cat-main">
      <div class="cat-bar">
        <div class="cat-search">{lupa}<label class="visually-hidden" for="cat-q">Buscar no catálogo</label><input id="cat-q" type="search" form="cat-form" name="q" placeholder="Buscar: caneca, polo…" autocomplete="off" enterkeyhint="search"></div>
        <button class="btn btn-line cat-open" type="button" aria-controls="cat-filtros" aria-expanded="false" data-cat-open><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M7 12h10M10 17h4"/></svg>Filtros<span class="cat-badge" data-cat-badge hidden></span></button>
      </div>
      <div class="cat-occ" data-cat-tipo hidden><span>Tipo:</span><span class="cat-occ-chip"><strong data-cat-tipo-name></strong><button type="button" data-cat-tipo-clear aria-label="Remover o filtro de tipo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></span></div>
      <div class="cat-occ" data-cat-occ hidden><span>Ocasião:</span><span class="cat-occ-chip"><strong data-cat-occ-name></strong><button type="button" data-cat-occ-clear aria-label="Remover o filtro de ocasião"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></span></div>
      <div class="cat-status"><p id="cat-count" role="status" aria-live="polite"><strong data-cat-n>{len(CATALOGO)}</strong> modelos</p>
        <div class="cat-view" role="group" aria-label="Fotos por linha no celular"><button type="button" data-cat-cols="1" aria-pressed="true" aria-label="Uma foto por linha"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="16" rx="1.5"/></svg></button><button type="button" data-cat-cols="2" aria-pressed="false" aria-label="Duas fotos por linha"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="7.5" height="16" rx="1.5"/><rect x="13" y="4" width="7.5" height="16" rx="1.5"/></svg></button></div>
      </div>
      <div class="studio-grid cat-grid" id="catalogo-grid">{''.join(cards)}</div>
      <div class="cat-mais" data-cat-mais-box hidden><p>Mostrando <strong data-cat-vistos></strong> de <strong data-cat-total></strong> modelos</p><button class="btn btn-line" type="button" data-cat-mais>Ver mais modelos</button></div>
      <div class="cat-empty" id="cat-vazio" hidden><p><strong>Nenhum modelo com esses filtros.</strong> Tente outra busca ou <button class="link" type="reset" form="cat-form">limpe os filtros</button>. Se não encontrou a peça, descreva no pedido: a TaMa cota sob encomenda.</p>{cta_link(tipo='brindes', cls='btn btn-line btn-sm', track_label='catalogo-vazio')}</div>
      <p class="note" style="margin-top:18px">{NOTE_IMAGENS}</p>
    </div>
  </div>
</section>'''


def page_catalogo():
    url = SITE + '/catalogo/'
    item_list = {'@type': 'ItemList', '@id': url + '#lista', 'name': 'Catálogo de modelos TaMa Creative', 'numberOfItems': len(CATALOGO),
                 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': c['nome'], 'url': SITE + c['url']} for i, c in enumerate(CATALOGO)]}
    return {
        'path': '/catalogo/', 'assunto': 'peças do catálogo', 'title': f'Catálogo: {len(CATALOGO)} modelos de brindes e uniformes | TaMa',
        'og_title': 'Catálogo de modelos · TaMa Creative',
        'description': f'{len(CATALOGO)} modelos para personalizar com a sua marca: vestuário, canetas, bolsas, embalagens, garrafas, acessórios e casa. Monte sua seleção e peça uma proposta.',
        'trail': [('/', 'Início'), ('/catalogo/', 'Catálogo')],
        'wp_type': 'CollectionPage', 'ld_extra': [item_list],
        # abertura da mesma família dos cabeçalhos com foto (eyebrow, título em duas partes com a segunda em itálico vinho,
        # apoio), mais baixa e sem foto: a busca do catálogo vem logo abaixo
        'body': text_head('Catálogo', f'<span>{len(CATALOGO)} modelos</span> <em>para a sua marca.</em>',
                          'Cada modelo aparece com a identidade TaMa como exemplo. Toque na cor de referência, adicione à seleção e envie junto com o pedido de proposta. Modelos, cores, materiais e técnicas são confirmados na proposta.',
                          cls='text-head-xl') + f'''
{season_callout('catalogo')}
{catalogo_block()}
{end_cta(tipo='brindes')}''',
    }


# Texto de contexto das páginas de produto, por categoria (sem afirmar material ou técnica ainda não confirmados)
CAT_TEXTO = {
    'vestuario': 'Peças para equipes, eventos e uniformes do dia a dia. A técnica de aplicação da marca (bordado, silk ou outra) e a grade de tamanhos são definidas na proposta, conforme o uso e o tecido.',
    'canetas-escritorio': 'Itens que entram na rotina de trabalho: canetas, cadernos, agendas e organizadores. A aplicação da marca depende do material e é confirmada na proposta.',
    'tecnologia': 'Itens de tecnologia para a rotina de quem trabalha no escritório, em casa ou em trânsito: pen drives, power banks, carregadores, fones, caixas de som e organizadores. Capacidade, potência, compatibilidade e aplicação da marca são confirmadas na proposta.',
    'bolsas-embalagens': 'Bolsas, embalagens e acabamentos (cartões, lacres) que acompanham o presente ou viram o próprio brinde. Formato, acabamento e aplicação da marca são definidos na proposta.',
    'garrafas-copos': 'Garrafas, copos, canecas e taças para o dia a dia, eventos e presentes de fim de ano. Capacidade, material e técnica de personalização são confirmados na proposta.',
    'cozinha-bar': 'Peças para preparar, servir e brindar: tábuas, utensílios, acessórios de bar e porta-vinhos para presentes e kits. Material, acabamento e aplicação da marca são confirmados na proposta.',
    'acessorios': 'Acessórios úteis, que acompanham a pessoa no dia a dia. Material, acabamento e aplicação da marca são confirmados na proposta.',
    'casa-bem-estar': 'Peças para casa e bem-estar, pensadas para presentes de afeto e kits. Fragrância, material e embalagem são definidos na proposta.',
    'hotelaria-gastronomia': 'Itens para restaurantes, hotéis e eventos gastronômicos, com a identidade do seu negócio. Material e acabamento são confirmados na proposta.',
}
CAT_USO = {'vestuario': 'para uniformes, equipes e eventos', 'canetas-escritorio': 'para o escritório, eventos e kits',
           'tecnologia': 'para equipes, eventos e kits',
           'bolsas-embalagens': 'para presentes e kits corporativos', 'garrafas-copos': 'para eventos, presentes e kits',
           'cozinha-bar': 'para presentes, kits e eventos',
           'acessorios': 'para presentear clientes e equipes', 'casa-bem-estar': 'para presentes e kits corporativos',
           'hotelaria-gastronomia': 'para restaurantes, hotéis e eventos'}
# gênero do nome do modelo, para o título "… personalizada/personalizado" (o padrão é masculino)
FEMININOS = ('Agenda', 'Caneca', 'Caneta', 'Carteira', 'Camiseta', 'Polo', 'Taça', 'Vela', 'Ecobag', 'Garrafa', 'Nécessaire', 'Dólmã', 'Caixa', 'Sacola')


def titulo_produto(nome, genero=''):
    if 'personaliz' in nome.lower():
        base = nome
    else:
        fem = genero == 'f' if genero in ('f', 'm') else nome.split()[0] in FEMININOS
        base = f"{nome} {'personalizada' if fem else 'personalizado'}"
    t = f'{base} | TaMa Creative'
    return t if len(t) <= 60 else f'{base} | TaMa'


def thumb(name, label, attrs):
    return (f'<button class="pdp-thumb" type="button" {attrs} aria-label="{esc(label)}" aria-pressed="false">'
            f'<img src="{img_url(name, "webp", 420)}" alt="" width="120" height="120" loading="lazy" decoding="async"></button>')


def page_produto(c):
    """Página de cada modelo do catálogo (/catalogo/<nome>/): galeria (cores, grupo, verso), cor na URL (?cor=),
    zoom ao passar o mouse, seleção e pedido de proposta. Uma página por modelo; a cor não gera página própria."""
    slug, nome, url = c['slug'], c['nome'], c['url']
    cores = home_colors(c)
    variantes = home_variants(c) or {}
    thumbs = []
    if c.get('grupo') and c['grupo'][0] in IMAGES:
        g = IMAGES[c['grupo'][0]]
        thumbs.append(thumb(c['grupo'][0], 'Todas as cores', f"data-v='{esc(json.dumps([g['stem'], g['widths'], c['grupo'][1]]))}'"))
    for nome_cor, _hex, *resto in c['cores']:
        if resto and resto[0] in IMAGES and (nome_cor in variantes or nome_cor == c['cores'][0][0]):
            thumbs.append(thumb(resto[0], f'Foto na cor {nome_cor}', f'data-thumb-color="{esc(nome_cor)}"'))
    # vistas por cor (frente, verso, detalhe do bordado): a faixa acompanha a cor escolhida
    def vv(iid, alt):
        m = IMAGES[iid]
        return [m['stem'], m['widths'], alt]
    alt_de = {i[2]: i[3] for i in c['cores'] if len(i) > 3}
    vistas = {}
    for nome_cor, _hex, *resto in c['cores']:
        if not resto or resto[0] not in IMAGES:
            continue
        v = {'frente': vv(resto[0], alt_de.get(resto[0], c['alt']))}
        if c['versos'].get(nome_cor) in IMAGES:
            v['verso'] = vv(c['versos'][nome_cor], PRODUTOS_BY[c['versos'][nome_cor]]['alt'])
        if c['detalhes'].get(nome_cor) in IMAGES:
            v['detalhe'] = vv(c['detalhes'][nome_cor], PRODUTOS_BY[c['detalhes'][nome_cor]]['alt'])
        vistas[nome_cor] = v
    primeira = vistas.get(c['cores'][0][0], {})
    rotulo_det = 'Bordado' if any('bordado' in (PRODUTOS_BY.get(i) or {}).get('alt', '').lower() for i in c['detalhes'].values()) else 'Detalhe'
    vistas_html = ''
    if len(primeira) > 1:
        vistas_html = ('<div class="pdp-vistas" role="group" aria-label="Vistas da peça">'
                       + ''.join(f'<button class="pdp-vista" type="button" data-vista="{k}" aria-pressed="{str(k == "frente").lower()}">'
                                 f'<img src="/img/{primeira[k][0]}-{primeira[k][1][0]}.webp" alt="" width="120" height="120" loading="lazy" decoding="async">'
                                 f'<span>{ {"frente": "Frente", "verso": "Verso", "detalhe": rotulo_det}[k] }</span></button>'
                                 for k in ('frente', 'verso', 'detalhe') if k in primeira)
                       + '</div>')
    base = c['base']
    mat, tec = base.get('material') or {}, base.get('tecnica') or {}
    mat_txt = mat['valor'] if mat.get('status') == 'confirmado' and mat.get('valor') else 'A confirmar na proposta.'
    tec_txt = tec['valor'] if tec.get('status') == 'confirmado' and tec.get('valor') else 'Definida na proposta, conforme o material, com a arte para aprovação.'
    info = c.get('info') or {}
    med = info.get('medidas') or {}
    medidas = (f'<div><dt>Medidas</dt><dd>{esc(med["valor"])}</dd></div>' if med.get('status') == 'confirmado' and med.get('valor') else '')
    usos = [u for u in (info.get('usos') or []) if u]
    usos_html = (f'<div class="pdp-usos"><p class="pdp-label">Ideal para</p><ul>{"".join(f"<li>{esc(u)}</li>" for u in usos)}</ul></div>' if usos else '')
    tipo = {'vestuario': 'confeccoes', 'hotelaria-gastronomia': 'hotelaria'}.get(c['categoria'], 'brindes')
    cat_nome = CAT_PROD.get(c['categoria'], 'Catálogo')
    mesma = [x for x in CATALOGO if x['categoria'] == c['categoria']]
    i = mesma.index(c)
    relacionados = [mesma[(i + k) % len(mesma)] for k in range(1, min(5, len(mesma)))]
    if len(relacionados) < 4:   # categoria pequena (casa e bem-estar): completa com embalagens, que combinam em kits
        relacionados += [x for x in CATALOGO if x['categoria'] == 'bolsas-embalagens'][:4 - len(relacionados)]
    rel_html = ''
    if relacionados:
        rel_html = f'''<section class="section" aria-labelledby="rel-t">
  <div class="wrap">
    <div class="section-head row"><div class="stack" style="gap:12px"><p class="eyebrow">{cat_nome}</p><h2 id="rel-t" class="section-title">Outros modelos para combinar</h2><p class="muted">Modelos da mesma categoria, para compor um kit ou uma seleção com a sua marca.</p></div><a class="link" href="/catalogo/?categoria={c['categoria']}#catalogo">Ver a categoria completa {ARROW}</a></div>
    <div class="studio-grid">{''.join(home_product_card(x) for x in relacionados)}</div>
  </div>
</section>'''
    n, nomes_cor = len(cores), [x[0].lower() for x in cores]
    ct = (f'na cor de referência {nomes_cor[0]}' if n == 1 else f'nas cores de referência {nomes_cor[0]} e {nomes_cor[1]}' if n == 2
          else f'em {n} cores de referência')
    uso = CAT_USO.get(c['categoria'], 'para presentes e kits corporativos')
    desc = f'{nome} com a marca da sua empresa, {uso}. Veja o modelo {ct} e peça uma proposta à TaMa.'
    if len(desc) > 160:
        desc = f'{nome} com a marca da sua empresa, {uso}. Veja {n} cores de referência e peça uma proposta.'
    desc = info.get('descricao_seo') or desc
    return {
        'path': url, 'title': info.get('titulo_seo') or titulo_produto(nome, info.get('genero') or ''), 'description': desc,
        'trail': [('/', 'Início'), ('/catalogo/', 'Catálogo'), (url, nome)], 'wp_type': 'ItemPage',
        'preload': preload_image(c['img'], '(max-width: 900px) 92vw, 1100px'),
        'body': f'''<section class="section pdp-sec">
  <div class="wrap pdp-wrap">
    <div class="product pdp" data-slug="{slug}" data-pdp data-url="{url}" data-tipo="{tipo}" data-vistas="{esc(json.dumps(vistas, ensure_ascii=False, separators=(',', ':')))}">
      <div class="pdp-gallery">
        <div class="pdp-rail">{vistas_html}{f'<div class="pdp-thumbs" role="group" aria-label="Cores de {esc(nome)}">{"".join(thumbs)}</div>' if len(thumbs) > 1 else ''}</div>
        <div class="prod-media pdp-main" data-hover-zoom>{picture(c['img'], c['alt'], '(max-width: 900px) 92vw, 840px', eager=True)}<button class="prod-zoom" type="button" data-zoom="{slug}" aria-label="Ampliar foto de {esc(nome)}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg></button><p class="pdp-ilustra">Imagem ilustrativa</p></div>
      </div>
      <div class="pdp-info">
        <p class="eyebrow"><a href="/catalogo/?categoria={c["categoria"]}#catalogo">{cat_nome}</a></p>
        <h1 class="pdp-title">{nome}</h1>
        <div class="pdp-resumo-box" data-pdp-more><p class="pdp-resumo">{esc(info['resumo']) + ' ' if info.get('resumo') else ''}<span class="prod-desc pdp-desc">Modelo da imagem: {c['descricao']}</span></p><button class="pdp-more" type="button" aria-expanded="false" hidden>Ler mais</button></div>
        <p class="prod-meta" hidden>{c['meta']}</p>
        <ol class="pdp-steps">
          <li class="pdp-cores"><p class="pdp-q"><b aria-hidden="true">1</b>Cor de referência: <strong class="color-name">{cores[0][0]}</strong></p>{swatches(dict(c, cores=cores))}</li>
          <li><label class="pdp-q" for="pdp-ocasiao"><b aria-hidden="true">2</b>Para qual ocasião?</label>
            <select class="pdp-select" id="pdp-ocasiao" data-pdp-occ><option value="">Selecione uma ocasião (opcional)</option>{''.join(f'<option>{v}</option>' for v in OCCS.values())}</select></li>
          <li><label class="pdp-q" for="pdp-qtd"><b aria-hidden="true">3</b>Quantidade aproximada</label>
            <div class="pdp-qty"><button type="button" data-qty="-1" aria-label="Diminuir a quantidade">−</button><input id="pdp-qtd" type="number" inputmode="numeric" min="1" step="1" placeholder="ex.: 50" data-pdp-qtd><button type="button" data-qty="1" aria-label="Aumentar a quantidade">+</button></div></li>
        </ol>
        <div class="pdp-cta">
          <button class="pick btn-pick-lg pdp-add" type="button" data-slug="{slug}" aria-pressed="false"><span class="when-off">+ Adicionar à seleção</span><span class="when-on">✓ Na seleção</span><span class="visually-hidden">: {nome}</span></button>
          <a class="pdp-link" href="/solicitar-proposta/?tipo={tipo}&amp;interesse={urllib.parse.quote(nome + ' (' + cores[0][0] + ')')}" data-track="cta_solicitar_proposta" data-track-label="produto" data-interesse="{esc(nome)} ({esc(cores[0][0])})" data-pdp-proposta>Solicitar proposta só desta peça {ARROW}</a>
        </div>
        <p class="pdp-wa">Dúvidas? <a href="https://wa.me/{WA}" data-track="whatsapp_click" data-track-label="produto" data-interesse="{esc(nome)}" rel="noopener">Conversar no WhatsApp</a></p>
        {usos_html}
      </div>
    </div>
    <dl class="pdp-spec">
      {medidas}
      <div><dt>Material</dt><dd>{mat_txt}</dd></div>
      <div><dt>Personalização</dt><dd>{tec_txt}</dd></div>
      <div><dt>Quantidade e prazo</dt><dd>Informados na proposta, conforme o volume do pedido e a técnica.</dd></div>
    </dl>
    <p class="pdp-sobre">{CAT_TEXTO.get(c['categoria'], '')}</p>
    <p class="note">{NOTE_IMAGENS}</p>
  </div>
</section>
{rel_html}
{end_cta(tipo=tipo)}''',
    }


def studio_block(slugs, title, eyebrow, intro, aria, more=None, sid=None, cls=''):
    """Grade de modelos do catálogo para as páginas de frente (brindes, confecções, hotelaria), escolhidos por id.
    sid: id da seção (âncora de link interno); cls: classe extra da seção (ex.: ivory)."""
    cards = ''.join(home_product_card(m) for m in (modelo(s) for s in slugs) if m)
    more_html = f'<a class="link" href="{more[0]}">{more[1]} {ARROW}</a>' if more else ''
    id_attr = f' id="{sid}"' if sid else ''
    return f'''<section class="section{' ' + cls if cls else ''}"{id_attr} aria-labelledby="{aria}">
  <div class="wrap">
    <div class="section-head row"><div class="stack" style="gap:12px"><p class="eyebrow">{eyebrow}</p><h2 id="{aria}" class="section-title">{title}</h2><p class="muted">{intro}</p></div>{more_html}</div>
    <div class="studio-grid">{cards}</div>
    <p class="note" style="margin-top:18px">{NOTE_IMAGENS}</p>
  </div>
</section>'''


def home_products_block():
    cards = ''.join(home_product_card(CATALOGO_BY[s]) for s in SEL['home'] if s in CATALOGO_BY)
    return f'''<section class="section home-prods" aria-labelledby="prods-t">
  <div class="wrap">
    <div class="section-head row">
      <div class="stack" style="gap:12px"><p class="eyebrow">Catálogo</p><h2 id="prods-t" class="section-title">Peças para a sua marca</h2>
      <p class="muted">Modelos que a TaMa seleciona e personaliza para a sua empresa. Toque na cor de referência, adicione à seleção e envie com o pedido de proposta.</p></div>
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
  <div class="stack" style="gap:10px"><p class="eyebrow">Personalização</p><h2 class="section-title">Sua marca é a protagonista</h2>
  <p class="muted">A TaMa aplica a marca da sua empresa nas peças que seleciona. Nas fotos, a marca TaMa e a marca fictícia Casa Mirelo aparecem só como exemplo; no seu projeto, a marca, as cores e os elementos visuais da sua empresa assumem esse lugar.</p>
  <p class="note">A mesma peça, com a marca de cada empresa.</p></div>
  {pair}
</div>'''


# Bloco de prova (onda 3): só o que o site já afirma, sem clientes, números, prazos ou cases.
# A chave muda apenas a frase de introdução; título, demonstração e as três provas são os mesmos em todas as páginas.
PROVA_INTRO = {
    'home': 'Brindes, uniformes, kits e ativações seguem o mesmo caminho: a TaMa entende o objetivo, propõe as peças e coordena com os fornecedores a aplicação da sua marca até a entrega.',
    'brindes': 'Em brindes corporativos, a peça certa depende de quem recebe e da ocasião. É assim que a TaMa conduz cada seleção.',
    'kits': 'Em um kit, caixa, cartão e peças precisam falar a mesma língua. É assim que a TaMa conduz cada composição.',
    'confeccoes': 'Em uniformes e confecções, a marca precisa funcionar na rotina de quem veste. É assim que a TaMa conduz cada projeto.',
    'ativacoes': 'Em uma ativação, uniformes, brindes e materiais precisam estar prontos para o dia da ação. É assim que a TaMa conduz cada projeto.',
    'hotelaria': 'Em restaurantes, bares e hotéis, a marca aparece da mesa à equipe. É assim que a TaMa conduz cada projeto.',
}
PROVAS = [   # textos do /sobre/ ("Como trabalhamos") e da faixa de destaques
    ('O público vem antes da peça', 'Quem recebe, a ocasião e o uso vêm antes da escolha de qualquer peça.'),
    ('Arte aprovada por você antes da produção', 'Arte e especificações aprovadas antes da produção e materiais conferidos antes da entrega.'),
    ('Tudo em um pedido', 'Brindes, kits, uniformes e materiais de ativação no mesmo pedido, com uma única linguagem.'),
]


def prova_block(chave):
    """Bloco de prova reutilizável: a mesma peça com a marca TaMa e com a marca fictícia Casa Mirelo, ao lado de três
    provas em texto. chave ('home', 'brindes', 'kits', 'confeccoes', 'ativacoes', 'hotelaria') ajusta só a introdução."""
    intro = PROVA_INTRO.get(chave, PROVA_INTRO['home'])
    tid = f'prova-{chave}-t'
    demo = ''
    if MOCKUPS and 'caderno-azul--casa-mirelo' in IMAGES and 'caderno-azul' in IMAGES:
        sz = '(max-width: 760px) 46vw, (max-width: 1180px) 28vw, 340px'
        demo = (f'<div class="prova-demo"><div class="prova-pair">'
                f'<figure>{picture("caderno-azul", "Caderno azul com a marca TaMa Creative aplicada na capa.", sz)}<figcaption>TaMa Creative</figcaption></figure>'
                f'<figure>{picture("caderno-azul--casa-mirelo", "O mesmo caderno azul com a marca fictícia Casa Mirelo aplicada na capa.", sz)}<figcaption>Casa Mirelo · marca fictícia</figcaption></figure>'
                f'</div><p class="note">A mesma peça, com a marca de cada empresa.</p></div>')
    itens = ''.join(f'<li>{arc()}<div><h3>{t}</h3><p>{d}</p></div></li>' for t, d in PROVAS)
    return f'''<section class="section prova{' sem-demo' if not demo else ''}" aria-labelledby="{tid}">
  <div class="wrap">
    <div class="prova-in">
      {demo}
      <div class="prova-head"><p class="eyebrow">Como a TaMa trabalha</p><h2 id="{tid}" class="section-title">A mesma peça. <em>A marca da sua empresa.</em></h2><p class="muted">{intro}</p></div>
      <ul class="prova-list">{itens}</ul>
    </div>
  </div>
</section>'''


COLLECTIONS = [
    ('boas-vindas', 'Boas-vindas', 'Receba novas pessoas com identidade e cuidado.', 'kitp-kit-pratico'),
    ('eventos', 'Eventos', 'Presença de marca em cada encontro.', 'conf-evento-camisetas'),
    ('executivos', 'Presentes executivos', 'Gestos refinados para relações importantes.', 'kitp-kit-executivo'),
    ('campanhas', 'Campanhas e ativações', 'Degustações, promoções e ações no ponto de venda.', 'conf-degustacao'),
    ('lancamentos', 'Lançamentos', 'Peças para apresentar um produto ou uma novidade.', 'papelaria-cores'),
    ('fim-de-ano', 'Fim de ano', 'Presentes para encerrar o ano perto de quem importa.', 'kitp-kit-brinde'),
]
# ocasiões com página própria: o card da coleção leva para ela (as demais abrem as ideias filtradas)
COLLECTION_PAGES = {'fim-de-ano': '/brindes-de-fim-de-ano/'}


def collection_href(k):
    return COLLECTION_PAGES.get(k, f'/brindes-por-ocasiao/?ocasiao={k}#pecas')


def collections_block(title='Coleções por ocasião'):
    cards = ''.join(
        f'<a class="collection" href="{collection_href(k)}">{picture(img, "", "(max-width: 760px) 84vw, (max-width: 980px) 46vw, 300px")}'
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


def ocasioes_faixa(title='Brindes por ocasião'):
    """Home enxuta: as ocasiões numa faixa de chips (no lugar do carrossel de cartões de collections_block).
    Cada chip segue collection_href(k): "Fim de ano" vai para a página própria, as demais para as ideias filtradas."""
    chips = ''.join(f'<li><a class="chip" href="{collection_href(k)}">{t}</a></li>' for k, t, _d, _img in COLLECTIONS)
    return f'''<section class="section occ-faixa" aria-labelledby="occ-t">
  <div class="wrap occ-faixa-inner">
    <div class="occ-faixa-head"><p class="eyebrow">Para cada momento</p><h2 id="occ-t" class="section-title">{title}</h2><p class="muted">Escolha a ocasião e veja as peças que a TaMa sugere para ela.</p></div>
    <ul class="occ-chips" role="list">{chips}</ul>
    <a class="link" href="/brindes-por-ocasiao/">Ver todas as ocasiões {ARROW}</a>
  </div>
</section>'''


# Kits do site (home, /kits-corporativos/ e fim de ano): src/data/kits.json, editado em /admin/inventario/ › Kits.
# Cada kit: slug, nome, descrição, foto (nome em img/v2/, sem extensão), marca fictícia e cor da caixa da foto (vazias =
# marca TaMa), foto_anterior (vale enquanto a nova não existe) e situacao ("fora" tira o kit de todas as páginas).
# home, fim_de_ano e tipos (seções de /kits-corporativos/, âncoras do menu) são listas de slugs.
KITS_DADOS = json.load(open(os.path.join(DADOS, 'kits.json'), encoding='utf-8'))


def preparar_kits():
    erros, vistos = [], set()
    for n, k in enumerate(KITS_DADOS.get('kits') or [], 1):
        nome = f"{k.get('slug') or '(sem slug)'} (kit {n})"
        if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', k.get('slug') or ''):
            erros.append(f'{nome}: slug inválido (só minúsculas, números e hífen)')
        if k.get('slug') in vistos:
            erros.append(f'{nome}: slug repetido')
        vistos.add(k.get('slug'))
        if not (k.get('nome') and k.get('descricao')):
            erros.append(f'{nome}: nome e descrição são obrigatórios')
        if k.get('situacao', 'no_site') not in ('no_site', 'fora'):
            erros.append(f'{nome}: situação inválida')
    refs = KITS_DADOS.get('home', []) + KITS_DADOS.get('fim_de_ano', []) + [s for t in KITS_DADOS.get('tipos', []) for s in t.get('kits', [])]
    erros += [f'lista cita kit que não existe: {s}' for s in sorted(set(refs) - vistos)]
    for t in KITS_DADOS.get('tipos', []):
        if not (re.fullmatch(r'kits-[a-z0-9-]+', t.get('ancora') or '') and t.get('titulo')):
            erros.append(f"tipo {t.get('titulo') or '?'}: âncora (kits-...) e título são obrigatórios")
    if erros:
        raise SystemExit('Kits (src/data/kits.json) com erro:\n  ' + '\n  '.join(erros))


preparar_kits()
KITS_TODOS = KITS_DADOS['kits']
KITS_BY = {k['slug']: (k['slug'], k['nome'], k['descricao']) for k in KITS_TODOS if k.get('situacao', 'no_site') != 'fora'}


def kits_da_lista(chave):
    """Kits de uma lista de kits.json (home, fim_de_ano), na ordem, sem os que estão fora do site."""
    return [KITS_BY[s] for s in KITS_DADOS.get(chave, []) if s in KITS_BY]


# Kits corporativos da home: dois destaques e três menores. As ocasiões continuam como atalhos para a curadoria filtrada.
HOME_KITS = kits_da_lista('home')
# slug -> (imagem, marca fictícia, cor da caixa); sem foto cadastrada, o kit usa img/v2/kitp-<slug>.webp
KIT_FOTOS = {k['slug']: (k['foto'], k.get('marca_ficticia') or '', k.get('cor_caixa') or '') for k in KITS_TODOS if k.get('foto')}
# Foto anterior dos kits que trocaram de foto: vale enquanto a nova não estiver em img/v2/.
KIT_FOTOS_ANTES = {k['slug']: (k['foto_anterior'], k.get('marca_anterior') or '', k.get('cor_caixa_anterior') or '') for k in KITS_TODOS if k.get('foto_anterior')}


def kit_foto(slug):
    """(imagem, marca fictícia, cor) do kit: a de KIT_FOTOS se a foto já existe, senão a anterior (KIT_FOTOS_ANTES ou
    kitp-<slug>). None se nenhuma existe: o card sai da página e o build não quebra enquanto uma foto nova é gerada."""
    for f in (KIT_FOTOS.get(slug), KIT_FOTOS_ANTES.get(slug), ('kitp-' + slug, '', '')):
        if f and f[0] in IMAGES:
            return f
    return None


def kit_card(i, slug, name, desc, big):
    """Card de um kit (foto de kit_foto: KIT_FOTOS[slug] ou img/v2/kitp-<slug>.webp): "Solicitar proposta deste kit" abre o
    pedido com tipo=kits e o interesse. Sem foto, devolve '' (o kit fica fora da grade)."""
    f = kit_foto(slug)
    if not f:
        return ''
    interesse = name if name.startswith('Kit') else 'Kit ' + name
    foto, marca, cor = f
    alt = f'{name}: {desc}' + (f' Marca fictícia {marca}; {cor}.' if marca else '')   # só descreve a foto; a nota fica sob a grade
    return (f'<article class="kit-card{" big" if big else ""}">'
            f'{picture(foto, alt, "(max-width: 760px) 92vw, 46vw" if big else "(max-width: 760px) 92vw, 31vw")}'
            f'<div class="kit-copy"><p class="eyebrow">Kit {i + 1:02d}</p><h3>{name}</h3><p>{desc}</p>'
            f'<a class="link" href="/solicitar-proposta/?tipo=kits&amp;interesse={urllib.parse.quote(interesse)}" data-track="cta_solicitar_proposta" data-track-label="kit-{slug}" data-interesse="{interesse}">Solicitar proposta deste kit {ARROW}</a></div></article>')


def kit_cards(kits=None, inicio=0):
    """Os kits corporativos (home e página de kits): dois destaques e três menores. inicio: numeração do primeiro."""
    return ''.join(kit_card(inicio + i, slug, name, desc, i < 2) for i, (slug, name, desc) in enumerate(kits or HOME_KITS))


def nota_kits(kits):
    """Nota sob uma grade de kits: a primeira frase diz qual marca aparece nas fotos (TaMa, fictícia ou as duas)."""
    fotos = [kit_foto(k[0]) for k in kits]
    return nota_marca('marca fictícia' if f[1] else 'marca TaMa' for f in fotos if f) + NOTE_KITS_EXTRA


# /kits-corporativos/ por tipo de kit: (âncora, título, linha de apoio, kits), de kits.json › tipos. O menu aponta para
# estas âncoras. Um kit pode entrar em dois tipos (o Kit Prático serve ao escritório e às boas-vindas) e mantém o mesmo
# número nos dois.
KITS_TIPOS = [(t['ancora'], t['titulo'], t.get('linha') or '', t.get('kits') or []) for t in KITS_DADOS.get('tipos', [])]


def kits_grandes(n):
    """Quantos dos n cards de uma grade vão em destaque (.big, 2 por linha; os demais 3 por linha), sem buraco na grade."""
    return 0 if n % 3 == 0 else 2 if n % 3 == 2 else min(n, 4)


def kits_tipos_html():
    """Uma seção por tipo de kit (KITS_TIPOS), com os cards no padrão kit_card. Kit sem foto em img/ fica fora (kit_foto); um
    tipo sem nenhum kit com foto mantém a âncora, o título e o convite para pedir a composição."""
    tipos = [(sid, titulo, linha, [KITS_BY[s] for s in slugs if s in KITS_BY and kit_foto(s)]) for sid, titulo, linha, slugs in KITS_TIPOS]
    num, html = {}, []   # num: slug -> número do kit na página (o mesmo quando o kit aparece em dois tipos)
    for j, (sid, titulo, linha, kits) in enumerate(tipos):
        g = kits_grandes(len(kits))
        cards = ''.join(kit_card(num.setdefault(slug, len(num)), slug, name, desc, i < g) for i, (slug, name, desc) in enumerate(kits))
        corpo = (f'<div class="kit-grid">{cards}</div>' if kits else
                 '<p class="kit-vazio">Conte a ocasião e o público no pedido: a TaMa propõe a composição, a caixa e o cartão com a sua marca. '
                 f'<a class="link" href="/solicitar-proposta/?tipo=kits&amp;interesse={urllib.parse.quote(titulo)}" data-track="cta_solicitar_proposta" data-track-label="{sid}" data-interesse="{titulo}">Solicitar proposta {ARROW}</a></p>')
        fim = ''
        if j == len(tipos) - 1:   # depois do último tipo: outra composição e a nota das fotos de todos os kits da página
            fim = (f'\n    <div class="kit-foot"><p class="muted">Prefere outra composição? Conte a ocasião e o público no pedido.</p>{cta_link(tipo="kits", track_label="kits-lista")}</div>'
                   f'\n    <p class="note" style="margin-top:18px">{nota_kits([k for t in tipos for k in t[3]])}</p>')
        html.append(f'''<section class="section kits-page kits-tipo{' ivory' if j % 2 else ''}{' um' if len(kits) == 1 else ''}" id="{sid}" aria-labelledby="{sid}-t">
  <div class="wrap">
    <div class="kits-tipo-in"><div class="section-head"><h2 id="{sid}-t" class="section-title">{titulo}</h2><p class="muted">{linha}</p></div>
    {corpo}</div>{fim}
  </div>
</section>''')
    return '\n'.join(html)


def kits_block(compacto=False):
    """compacto (home enxuta): só os dois kits em destaque e o link para os cinco em /kits-corporativos/; as ocasiões
    ficam na faixa de chips logo abaixo (ocasioes_faixa), então o bloco não repete os atalhos .kit-occ.
    Sem kit da home com foto no site (todos tirados no inventário), o bloco sai da página."""
    if not [k for k in HOME_KITS if kit_foto(k[0])]:
        return ''
    if compacto:
        cards = ''.join(kit_card(i, slug, name, desc, True) for i, (slug, name, desc) in enumerate(HOME_KITS[:2]))
        foot = (f'<a class="link" href="/kits-corporativos/">Ver todos os kits {ARROW}</a>'
                + cta_link(tipo='kits', track_label='home-kits'))
    else:
        cards = kit_cards()
        occ = ''.join(f'<a class="chip" href="{collection_href(k)}">{t}</a>' for k, t, _d, _img in COLLECTIONS)
        foot = (f'<nav class="kit-occ" aria-label="Peças por ocasião"><span>Para cada momento:</span>{occ}</nav>'
                + cta_link(tipo='kits', track_label='home-kits'))
    return f'''<section class="section kits-home{' compacto' if compacto else ''}" aria-labelledby="kits-t">
  <div class="wrap">
    <div class="section-head row">
      <div class="stack" style="gap:12px"><p class="eyebrow">Kits corporativos</p><h2 id="kits-t" class="section-title">Presentes que marcam momentos</h2><p class="muted">Composições de referência para surpreender, agradecer e aproximar. Caixa, cartão e peças levam a marca da sua empresa e se ajustam ao seu público.</p></div>
      {'' if compacto else f'<a class="link" href="/kits-corporativos/">Ver todos os kits {ARROW}</a>'}
    </div>
    <div class="kit-grid">{cards}</div>
    <div class="kit-foot">
      {foot}
    </div>
    <p class="note">{nota_kits(HOME_KITS[:2] if compacto else HOME_KITS)}</p>
  </div>
</section>'''


# ------------------------------------------------------------------ navigation and shared blocks
# Áreas da TaMa (submenu "Soluções" e rodapé): nome oficial do glossário
NAV = [
    ('/brindes-corporativos/', 'Brindes corporativos'),
    ('/confeccoes-personalizadas/', 'Uniformes e confecções'),
    ('/kits-corporativos/', 'Kits corporativos'),
    ('/ativacoes-promocionais-eventos-corporativos/', 'Ativações promocionais para eventos corporativos'),
    ('/hotelaria-e-gastronomia/', 'Hotelaria e gastronomia'),
]
BAG_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l-1 12H7z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>'


def cta_link(label='Solicitar proposta', tipo=None, cls='btn btn-wine', arrow=True, track_label=None):
    href = '/solicitar-proposta/' + (f'?tipo={tipo}' if tipo else '')
    tl = f' data-track-label="{esc(track_label)}"' if track_label else ''
    return f'<a class="{cls}" href="{href}" data-track="cta_solicitar_proposta"{tl}>{label}{" " + ARROW if arrow else ""}</a>'


_T = (_TOPO.get('temporada') or {})
ANNOUNCE_SEASON = ('<p class="announce-season"><a href="/brindes-de-fim-de-ano/" data-track="season_click" data-track-label="barra-topo">'
                   f'<strong>{esc(_T.get("aviso_titulo") or "Fim de ano:")}</strong> {esc(_T.get("aviso_texto") or "presentes com a sua marca para agradecer clientes e equipes")} '
                   '<span aria-hidden="true">→</span></a></p>')


def season_callout(where):
    """Aviso de temporada nas páginas de Brindes, Kits e Catálogo (só dentro do período de site.config.json › temporada)."""
    if SEASON != 'fim-de-ano':
        return ''
    return (f'<aside class="season-callout" aria-label="Temporada de fim de ano"><div class="wrap season-callout-in">'
            f'<p><strong>Fim de ano</strong> Taças, copos e kits com a sua marca para agradecer clientes e equipes antes do recesso.</p>'
            f'<a class="btn btn-line btn-sm" href="/brindes-de-fim-de-ano/" data-track="season_click" data-track-label="{where}">Ver presentes de fim de ano {ARROW}</a>'
            f'</div></aside>')


# Menu da apresentação de 20/10: Brindes ▾ (tipos de peça), Kits ▾, Confecções ▾, Ativações ▾, Sobre e Blog.
# Tipos de brinde e de confecção levam ao catálogo filtrado (/catalogo/?tipo=<chave>#catalogo, rótulos em TIPO_ROTULO).
MENU_BRINDES = ['agendas', 'canetas', 'canecas', 'copos', 'xicaras', 'tacas', 'squeezes', 'porta-vinho', 'mochilas', 'tecnologia']
# Tipo sem modelo no catálogo fica fora do menu (sem link vazio). Exceção, enquanto True: os 9 tipos de brinde aparecem
# mesmo vazios, porque os modelos novos da lista de 20/10 entram no banco depois (o integrador importa as fotos).
MENU_TIPOS_VAZIOS = True
MENU_CONFECCOES = [('polos', 'Camiseta polo'), ('camisetas', 'Camiseta'), ('moletons', 'Blusa de moletom'), ('camisas', 'Camisa'),
                   ('dolmas', 'Dólmã'), ('aventais', 'Avental'), ('bones', 'Bonés')]
MENU_KITS = [('Kit escritório', '#kits-escritorio'), ('Kit cozinha', '#kits-cozinha'), ('Kit boas-vindas', '#kits-boas-vindas'),
             ('Kit executivo', '#kits-executivo'), ('Kit pausa', '#kits-pausa'), ('Kit de agradecimento', '#kits-agradecimento'),
             ('Kit fim de ano', '#kits-fim-de-ano')]   # âncoras de /kits-corporativos/
MENU_ATIVACOES = [('Buffet completo', '#fmt-buffet'), ('Decoração', '#fmt-decoracao')]   # âncoras de /ativacoes-promocionais-eventos-corporativos/


def nav_menu(path):
    """Menu principal (2ª linha do cabeçalho): Brindes ▾ (lista dos tipos de peça e, abaixo, as páginas de brindes),
    Kits ▾, Confecções ▾, Ativações ▾, Sobre e Blog; os quatro painéis são listas no mesmo formato. Os painéis são botões com aria-expanded; no celular viram
    acordeão. O grupo da página atual ganha aria-current="true" no botão, e o link da página, aria-current="page"."""
    def cur(p, exato=False):
        return ' aria-current="page"' if (path == p if exato else path.startswith(p)) else ''

    def grupo(chave, rotulo, painel, ativo, cls=''):
        atual = ' aria-current="true"' if ativo else ''
        return (f'<div class="nav-group nav-mega{cls}{" is-current" if ativo else ""}"><button class="nav-link nav-toggle" type="button" aria-expanded="false" '
                f'aria-controls="sub-{chave}" data-nav-toggle{atual}>{rotulo}<svg class="nav-caret" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3"/></svg></button>'
                f'<div class="nav-sub" id="sub-{chave}"><div class="nav-sub-in">{painel}</div></div></div>')

    por_tipo = {}
    for c in CATALOGO:
        por_tipo.setdefault(c['tipo'], []).append(c)
    # página de um modelo (/catalogo/<id>/): vestuário marca Confecções; os demais modelos e o catálogo marcam Brindes
    m = re.match(r'^/catalogo/([^/]+)/$', path)
    mod = CATALOGO_BY.get(m.group(1)) if m else None
    conf_atual = path.startswith('/confeccoes-personalizadas/') or bool(mod and mod['categoria'] == 'vestuario')
    brindes_atual = not conf_atual and path.startswith(('/brindes-corporativos/', '/hotelaria-e-gastronomia/', '/brindes-por-ocasiao/', '/brindes-de-fim-de-ano/', '/catalogo/'))

    tipos_b = ''.join(f'<li><a href="/catalogo/?tipo={k}#catalogo">{TIPO_ROTULO[k]}</a></li>'
                      for k in MENU_BRINDES if por_tipo.get(k) or (MENU_TIPOS_VAZIOS and k != 'tecnologia'))
    fim = (f'<li><a class="nav-season" href="/brindes-de-fim-de-ano/"{cur("/brindes-de-fim-de-ano/")}>Fim de ano <em>temporada</em></a></li>'
           if SEASON == 'fim-de-ano' else '')
    p_brindes = (f'<ul class="nav-list">{tipos_b}</ul>'
                 f'<ul class="nav-list nav-list-pe"><li><a href="/brindes-corporativos/"{cur("/brindes-corporativos/")}>Brindes corporativos</a></li>'
                 f'<li><a href="/hotelaria-e-gastronomia/"{cur("/hotelaria-e-gastronomia/")}>Hotelaria e gastronomia</a></li>'
                 f'<li><a href="/brindes-por-ocasiao/"{cur("/brindes-por-ocasiao/")}>Por ocasião</a></li>{fim}</ul>'
                 f'<a class="nav-sub-all" href="/catalogo/"{cur("/catalogo/", True)}>Catálogo completo {ARROW}</a>')
    kits = ''.join(f'<li><a href="/kits-corporativos/{a}">{t}</a></li>' for t, a in MENU_KITS)
    p_kits = f'<ul class="nav-list">{kits}</ul><a class="nav-sub-all" href="/kits-corporativos/"{cur("/kits-corporativos/")}>Ver todos os kits {ARROW}</a>'
    conf = ''.join(f'<li><a href="/catalogo/?tipo={k}#catalogo">{t}</a></li>' for k, t in MENU_CONFECCOES if por_tipo.get(k))
    p_conf = (f'<ul class="nav-list">{conf}</ul>'
              f'<a class="nav-sub-all" href="/confeccoes-personalizadas/"{cur("/confeccoes-personalizadas/")}>Uniformes e confecções {ARROW}</a>')
    ativ = ''.join(f'<li><a href="/ativacoes-promocionais-eventos-corporativos/{a}">{t}</a></li>' for t, a in MENU_ATIVACOES)
    p_ativ = f'<ul class="nav-list">{ativ}</ul><a class="nav-sub-all" href="/ativacoes-promocionais-eventos-corporativos/"{cur("/ativacoes-promocionais-eventos-corporativos/")}>Conhecer ativações {ARROW}</a>'
    return (grupo('brindes', 'Brindes', p_brindes, brindes_atual, ' nav-main nav-drop')
            + grupo('kits', 'Kits', p_kits, path.startswith('/kits-corporativos/'), ' nav-drop')
            + grupo('confeccoes', 'Confecções', p_conf, conf_atual, ' nav-drop')
            + grupo('ativacoes', 'Ativações', p_ativ, path.startswith('/ativacoes-promocionais-eventos-corporativos/'), ' nav-drop')
            + f'<a class="nav-link nav-sep" href="/sobre/"{cur("/sobre/")}>Sobre</a>'
            + f'<a class="nav-link" href="/blog/"{cur("/blog/")}>Blog</a>')


# Redes sociais no rodapé. Endereços provisórios (placeholders) até a TaMa confirmar os perfis: troque o href aqui
# (o Instagram usa site.config.json › instagram quando preenchido).
REDES = [
    ('Instagram', f'https://www.instagram.com/{IG}/' if IG else '#', '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".9" fill="currentColor" stroke="none"/>'),
    ('LinkedIn', (SITE_DADOS.get('contato') or {}).get('linkedin') or '#', '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 10.5V16M8 7.8v.1M11.5 16v-3.2c0-1.4.9-2.3 2.1-2.3s1.9.9 1.9 2.3V16M11.5 10.5V16"/>'),
    ('Facebook', (SITE_DADOS.get('contato') or {}).get('facebook') or '#', '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="M13.2 20.5v-6.7h2.3l.4-2.6h-2.7V9.6c0-.8.3-1.3 1.4-1.3h1.4V6c-.3 0-1.1-.1-2.1-.1-2.1 0-3.4 1.2-3.4 3.5v1.8H8.2v2.6h2.3v6.7"/>'),
    ('YouTube', (SITE_DADOS.get('contato') or {}).get('youtube') or '#', '<rect x="2.8" y="5.8" width="18.4" height="12.4" rx="3.6"/><path d="M10.4 9.6v4.8l4.2-2.4z" fill="currentColor" stroke="none"/>'),
]


def redes_html():
    lis = ''
    for nome, href, svg in REDES:
        extra = ' data-placeholder' if href == '#' else ' rel="noopener"'
        lis += (f'<li><a href="{esc(href)}" aria-label="TaMa Creative no {nome}"{extra}>'
                f'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{svg}</svg></a></li>')
    return f'<ul class="footer-social" aria-label="Redes sociais">{lis}</ul>'


SEARCH_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20"/></svg>'


def busca_form(sid):
    return (f'<form class="head-search" role="search" action="/catalogo/"><label class="visually-hidden" for="{sid}">Buscar no catálogo</label>'
            f'{SEARCH_SVG}<input id="{sid}" name="q" type="search" placeholder="Buscar no catálogo: caneca, polo, kit…" autocomplete="off"></form>')


def header(path):
    links = nav_menu(path)
    wa = (f'<a class="head-wa" href="https://wa.me/{WA}" data-track="whatsapp_click" rel="noopener">{CHAT}<span>WhatsApp</span></a>' if WA else '')
    return f'''<a class="skip" href="#conteudo">Pular para o conteúdo</a>
<aside class="announce" aria-label="Destaques da TaMa"><div class="wrap">{ANNOUNCE_SEASON if SEASON == 'fim-de-ano' else f'<p>{ASSINATURA}</p>'}<ul>{''.join(f'<li>{g}</li>' for g in GARANTIAS)}</ul></div></aside>
<header class="site-header">
  <div class="wrap header-row">
    <a class="brand" href="/" aria-label="TaMa Creative, página inicial">{LOGO_DECOR}</a>
    {busca_form('busca-topo')}
    <div class="head-actions">
      {wa}
      <button class="icon-btn bag" type="button" data-open-drawer aria-label="Sua seleção de peças">{BAG_SVG}<span class="bag-label" aria-hidden="true">Seleção</span><span class="bag-count" data-sel-count hidden>0</span></button>
      {cta_link('<span class="cta-long">Solicitar proposta</span><span class="cta-short">Proposta</span>', cls='btn btn-wine btn-sm head-cta', track_label='header')}
      <button class="icon-btn menu-btn" id="menu-btn" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Abrir menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="i-open" d="M4 8h16M4 16h16"/><path class="i-close" d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
  </div>
  <div class="nav-bar"><div class="wrap">
    <nav class="site-nav" id="site-nav" aria-label="Principal">{busca_form('busca-menu')}{links}{cta_link(cls='btn btn-wine nav-cta', track_label='menu-celular')}</nav>
  </div></div>
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
    sol = ''.join(f'<li><a href="{p}">{t}</a></li>' for p, t in NAV)   # as cinco áreas, com os nomes oficiais do menu
    ocas = ''.join(f'<li><a href="{p}">{t}</a></li>' for p, t in [('/brindes-de-fim-de-ano/', 'Brindes de fim de ano'), ('/brindes-por-ocasiao/', 'Brindes por ocasião'), ('/catalogo/', 'Catálogo completo')])
    contacts = contact_lines()
    contact_col = ''.join(f'<li>{c}</li>' for c in contacts) + '<li><a href="/solicitar-proposta/">Solicitar proposta</a></li>'
    empresa = empresa_linha()
    return f'''<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="footer-brand"><a class="brand" href="/" aria-label="TaMa Creative, página inicial">{LOGO_DECOR}</a><p>{ASSINATURA} A TaMa seleciona as peças, personaliza com a marca da sua empresa e coordena os fornecedores até a entrega.</p>{redes_html()}</div>
    <div><p class="footer-title">Soluções</p><ul class="footer-links">{sol}</ul></div>
    <div><p class="footer-title">Ocasiões e catálogo</p><ul class="footer-links">{ocas}</ul></div>
    <div><p class="footer-title">TaMa</p><ul class="footer-links"><li><a href="/sobre/">Sobre</a></li><li><a href="/blog/">Conteúdos</a></li><li><a href="/privacidade/">Privacidade</a></li><li><button class="link-btn" type="button" data-consent-open>Cookies</button></li></ul></div>
    <div><p class="footer-title">Contato</p><ul class="footer-links">{contact_col}</ul></div>
  </div>
  <div class="wrap footer-bottom">
    <div class="left">{SELO}<span>© {date.today().year} TaMa Creative{(' · ' + empresa) if empresa else ''}</span></div>
    <span>{NOTE_RODAPE}</span>
  </div>
</footer>'''


def crumbs(trail):
    lis = []
    for i, (p, label) in enumerate(trail):
        lis.append(f'<li><span aria-current="page">{label}</span></li>' if i == len(trail) - 1 else f'<li><a href="{p}">{label}</a></li>')
    return f'<nav class="crumbs wrap" aria-label="Caminho"><ol>{"".join(lis)}</ol></nav>'


# Guias do blog ligados às páginas de serviço (o blog deixa de ser uma ilha). Ordem = ordem de exibição.
GUIAS = {
    'home': ['brindes-de-fim-de-ano-para-clientes', 'o-que-colocar-no-kit-de-boas-vindas', 'brindes-e-compliance-politica-de-presentes'],
    'brindes': ['brindes-e-compliance-politica-de-presentes', 'brindes-de-fim-de-ano-para-clientes'],
    'kits': ['o-que-colocar-no-kit-de-boas-vindas', 'presente-de-natal-para-funcionarios'],
    'fim': ['brindes-de-fim-de-ano-para-clientes', 'presente-de-natal-para-funcionarios'],
}


def guias_block(chave, title='Guias para decidir com segurança', intro='Conteúdos da TaMa sobre como escolher, o que incluir e como respeitar as regras de quem recebe.'):
    """Artigos do blog relacionados à página (só os publicados; some quando nenhum estiver no ar)."""
    por_slug = {a['slug']: a for a in blog.ARTS if not a.get('noindex')}
    arts = [por_slug[s] for s in GUIAS.get(chave, []) if s in por_slug]
    if not arts:
        return ''
    itens = ''.join(f'<li><a class="guia" href="{a["path"]}"><span class="guia-tag">Guia</span><strong>{esc(a.get("breadcrumb") or a["title"])}</strong>'
                    f'<span class="guia-link">Ler o guia {ARROW}</span></a></li>' for a in arts)
    return f'''<section class="section guias" aria-labelledby="guias-{chave}-t">
  <div class="wrap">
    <div class="section-head row"><div class="stack" style="gap:12px"><p class="eyebrow">Conteúdos</p><h2 id="guias-{chave}-t" class="section-title">{title}</h2><p class="muted">{intro}</p></div><a class="link" href="/blog/">Ver todos os guias {ARROW}</a></div>
    <ul class="guias-list">{itens}</ul>
  </div>
</section>'''


def end_cta(title='Vamos dar forma à sua ideia?', text='Conte a ocasião, o público, a quantidade e a data: a TaMa responde com uma proposta de peças, personalização e condições.', tipo=None, eyebrow='Próximo passo', label='Solicitar proposta'):
    """Fechamento de todas as páginas, sempre com a mesma estrutura: eyebrow, título em forma de pergunta, uma frase de
    apoio e dois botões (Solicitar proposta e WhatsApp)."""
    return f'''<section class="end-cta" aria-labelledby="cta-t">
  <div class="wrap"><p class="eyebrow light">{eyebrow}</p><h2 id="cta-t">{title}</h2><p>{text}</p>
  <div class="actions" style="justify-content:center">{cta_link(label, tipo=tipo, cls='btn btn-light', track_label='end-cta')}{wa_button('btn btn-glass')}</div></div>
</section>'''


def wa_button(cls='btn btn-line', text='Conversar no WhatsApp'):
    if not WA:
        return ''
    msg = urllib.parse.quote('Olá, TaMa! Gostaria de conversar sobre um projeto.')
    return f'<a class="{cls}" href="https://wa.me/{WA}?text={msg}" data-track="whatsapp_click" rel="noopener">{CHAT} {text}</a>'


def faq(items, title='Perguntas frequentes', eyebrow='Dúvidas', intro='Respostas curtas para as dúvidas mais comuns. O que depende do projeto é confirmado na proposta.'):
    """Perguntas na voz do cliente, respostas de uma a três frases, sem prometer prazo, preço ou estoque."""
    det = ''.join(f'<details><summary>{q}</summary><p>{a}</p></details>' for q, a in items)
    return f'''<section class="section" aria-labelledby="faq-t">
  <div class="wrap faq-grid">
    <div class="stack" style="gap:12px"><p class="eyebrow">{eyebrow}</p><h2 id="faq-t" class="section-title">{title}</h2><p class="muted">{intro}</p></div>
    <div class="faq-list">{det}</div>
  </div>
</section>'''


# Método TaMa em 6 etapas: faixa compacta "Do briefing à entrega." da home (process_strip) e a seção padrão
# process_section (os mesmos 6 cartões em todas as páginas de frente, em /brindes-de-fim-de-ano/ e em /sobre/).
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


def process_section(eyebrow, titulo, apoio='', aria='processo-t', light=True, sid=None, cls='ivory', verde=True):
    """Seção padrão do passo a passo: section-head (eyebrow e título contextuais por página, parágrafo de apoio opcional)
    e os 6 cartões de STEPS, sempre com os mesmos nomes, textos e ícones. Posição padrão nas páginas: depois das peças
    ou kits e antes das perguntas. cls: fundo da seção ('ivory' ou '' para o fundo claro); sid: id da seção (âncora)."""
    # verde (on-dark) por padrão: destaca o método entre blocos claros; verde=False onde a seção vizinha já é verde (kits)
    if verde:
        cls, light = 'on-dark', False
    apoio_html = f'<p class="muted">{apoio}</p>' if apoio else ''
    return f'''<section class="section{' ' + cls if cls else ''} process-section"{f' id="{sid}"' if sid else ''} aria-labelledby="{aria}">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">{eyebrow}</p><h2 id="{aria}" class="section-title">{titulo}</h2>{apoio_html}</div>
    {steps_html(light=light)}
  </div>
</section>'''


def process_strip():
    """Home enxuta: as 6 etapas numa linha (número e nome, sem os textos); a explicação fica em /sobre/."""
    steps = ''.join(f'<li><span class="proc-n" aria-hidden="true">{i + 1:02d}</span>{t}</li>' for i, (t, _d, _k) in enumerate(STEPS))
    return f'''<section class="process-strip" aria-labelledby="proc-t">
  <div class="wrap process-strip-inner">
    <div class="process-strip-head"><h2 id="proc-t" class="process-strip-title">Do briefing à entrega.</h2><p>Seis etapas, com a arte aprovada por você antes da produção.</p></div>
    <ol class="process-line" role="list">{steps}</ol>
    <a class="link" href="/sobre/#como-t">Como trabalhamos {ARROW}</a>
  </div>
</section>'''


def text_head(eyebrow, h1, lead='', actions='', extra='', antes='', cls='', lead_cls='', inner=False, tag='div'):
    """Cabeçalho de texto padrão das páginas sem foto de abertura (proposta, obrigado, privacidade, 404, ocasiões,
    artigos do blog e páginas de modelo): eyebrow + título + apoio, sempre nas mesmas medidas (CSS .text-head).
    O título aceita <em> para a parte em itálico vinho, como nos cabeçalhos com foto (foto_hero). cls='text-head-xl'
    é a versão do catálogo (título no tamanho dos cabeçalhos com foto, sem a foto); cls='solo' dá mais respiro embaixo
    nas páginas que só têm o cabeçalho (obrigado, 404). inner=True devolve só o bloco, para encaixar dentro de outro
    contêiner (coluna de texto do modelo, cabeçalho do artigo)."""
    partes = [antes, f'<p class="eyebrow">{eyebrow}</p>' if eyebrow else '', f'<h1>{h1}</h1>',
              f'<p class="lead{" " + lead_cls if lead_cls else ""}">{lead}</p>' if lead else '', extra,
              f'<div class="actions">{actions}</div>' if actions else '']
    if inner:
        return f'<{tag} class="text-head-copy{" " + cls if cls else ""}">{"".join(partes)}</{tag}>'
    return f'''<section class="text-head{" " + cls if cls else ""}">
  <div class="wrap"><div class="text-head-copy">{"".join(partes)}</div></div>
</section>'''


# ------------------------------------------------------------------ JSON-LD
ORG_ID = SITE + '/#org'


def org():
    o = {'@type': 'Organization', '@id': ORG_ID, 'name': 'TaMa Creative', 'url': SITE + '/', 'logo': SITE + '/logo-512.png',
         'slogan': 'Sua marca ganha forma.',
         'description': 'Brindes corporativos, uniformes e confecções, kits corporativos, ativações promocionais e hotelaria e gastronomia para empresas.'}
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
    <div class="drawer-foot"><a class="btn btn-wine" href="/solicitar-proposta/" data-track="cta_solicitar_proposta" data-track-label="drawer">Solicitar proposta com a seleção ''' + '{ARROW}' + '''</a><button class="btn btn-line" type="button" data-clear-selection>Limpar seleção</button></div>
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
    # aviso de cookies em todas as páginas: essenciais sempre; análise (GA4) só depois de "Aceitar" (ver site.js)
    consent = ('<div class="consent" id="consent" role="dialog" aria-labelledby="consent-t" aria-describedby="consent-d" hidden>'
               '<p class="consent-title" id="consent-t">Cookies</p>'
               '<p id="consent-d">Usamos cookies essenciais para o site funcionar (como guardar a sua seleção de peças) e, se você aceitar, '
               'cookies de análise para entender como o site é usado. '
               '<a href="/privacidade/#cookies">Saiba mais sobre cookies</a>.</p>'
               '<div class="actions"><button class="btn btn-wine btn-sm" type="button" data-consent="granted">Aceitar todos</button>'
               '<button class="btn btn-line btn-sm" type="button" data-consent="denied">Só os essenciais</button></div></div>')
    wa_float = ''
    if WA:
        msg = urllib.parse.quote('Olá, TaMa! Gostaria de conversar sobre um projeto.')
        wa_float = f'<aside aria-label="Atendimento por WhatsApp"><a class="wa-float" href="https://wa.me/{WA}?text={msg}" target="_blank" data-track="whatsapp_click" data-track-label="flutuante" rel="noopener" aria-label="Conversar com a TaMa no WhatsApp (abre em nova aba)" title="Conversar no WhatsApp">{CHAT}</a></aside>'
    service_attr = (f' data-service="{page["service"]["key"]}"' if page.get('service') else '') + (f' data-assunto="{esc(page["assunto"])}"' if page.get('assunto') else '')
    canonical = '' if page['path'].endswith('.html') else f'<link rel="canonical" href="{url}">'
    return f'''<!doctype html>
<html lang="pt-BR"{HTML_SEASON}>
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
{crumbs(page['trail']) if page.get('trail') and not page.get('crumbs_inline') else ''}
{body}
</main>
{footer()}
{DIALOGS.replace('{ARROW}', ARROW).replace('{LB_EYEBROW}', NOTA_TAMA_CURTA)}
{wa_float}
{consent}
</body>
</html>
'''


# ------------------------------------------------------------------ pages
HOME_FAQ = [
    ('O que a TaMa faz?', 'A TaMa seleciona, personaliza e entrega brindes, uniformes, kits, materiais de ativação e peças de hotelaria com a marca da sua empresa. Ela não fabrica: entende o objetivo, propõe as peças, coordena a aplicação da marca com os fornecedores e acompanha tudo até a entrega.'),
    ('Posso personalizar as peças nas cores da minha marca?', 'Sim. A escolha de cores e acabamentos faz parte da proposta de cada projeto. As cores mostradas no site são referências visuais, não estoque; a disponibilidade é confirmada na proposta.'),
    ('Vocês montam kits completos?', 'Sim. A proposta combina seleção de peças, embalagem, cartão e personalização num conjunto com a mesma linguagem visual.'),
    ('Existe quantidade mínima?', 'Depende da peça e da técnica de personalização. Informe a quantidade aproximada no pedido: se não for viável para a peça escolhida, a proposta indica alternativas.'),
    ('Qual é o prazo?', 'Depende do briefing, das quantidades e dos acabamentos aprovados, e é informado na proposta, antes da confirmação do projeto. Informe a data desejada no pedido.'),
]


# Ícones de traço fino (vinho via CSS). viewBox 24, sem preenchimento.
ASSURANCES = f'''<ul class="garantias" aria-label="Como a TaMa trabalha">
  <li><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3.5" y="8" width="17" height="4" rx=".8"/><path d="M5 12v8h14v-8M12 8v12"/><path d="M12 8C10.6 5 7.2 4.4 7.2 6.5 7.2 8 9.6 8 12 8zM12 8c1.4-3 4.8-3.6 4.8-1.5C16.8 8 14.4 8 12 8z"/></svg><span>{GARANTIAS[0]}</span></li>
  <li><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.2l7 2.6v5.6c0 4.3-2.9 7.7-7 9.4-4.1-1.7-7-5.1-7-9.4V5.8z"/><path d="M8.9 12.1l2.2 2.2 4.1-4.4"/></svg><span>{GARANTIAS[1]}</span></li>
  <li><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 18.2C4.6 10.8 9.4 5 19.6 4.4 20.2 14 14.4 19.6 6 18.2z"/><path d="M4.2 20l1.8-1.8M6 18.2l9-9"/></svg><span>{GARANTIAS[2]}</span></li>
</ul>'''

# (link, imagem, enquadramento da foto, título em 2 linhas, descrição em 2 linhas, chamada)
# Fotos de img/v2/home-frente-*-v2: as do mockup enviado pela TaMa em 18/10/2026 (mesma proporção do cartão), editadas com
# marcas fictícias (Elo, Pulso, Arco) e caixas fora do bordô, para o cliente ver a marca dele, não a da TaMa.
# As quebras de linha seguem o mockup; cada metade cabe numa linha mesmo no cartão mais estreito (~225 px, tablet).
SECOES = SITE_DADOS.get('secoes') or {}
FRENTES = [(f['link'], f['imagem'], f.get('posicao') or 'center', tuple(f['titulo']), tuple(f['texto']), f['chamada'])
           for f in (SECOES.get('home-frentes') or {}).get('itens') or []]   # site.json › secoes › home-frentes (inventário › Páginas › Home)

def frentes_section():
    # O cartão inteiro é um único <a> (como antes): título, texto e chamada formam o nome acessível do link.
    # Fotos decorativas (alt vazio): o título já diz o destino. O espaço antes de cada <br> mantém
    # "Brindes corporativos" com espaço no texto do link.
    sizes = '(max-width: 760px) calc(100vw - 32px), (max-width: 1340px) 31vw, 400px'
    cards = '\n'.join(
        f'    <a class="frente-card" href="{href}">{picture(img, "", sizes, style=f"object-position:{pos}")}'
        f'<div class="frente-info"><h3>{esc(t[0])} <br>{esc(t[1])}</h3><p>{esc(d[0])} <br>{esc(d[1])}</p>'
        f'<span class="frente-link">{esc(cta)} {ARROW}</span></div></a>'
        for href, img, pos, t, d, cta in FRENTES)
    return f'''<section class="frentes" aria-labelledby="frentes-t">
  <h2 id="frentes-t" class="visually-hidden">O que a TaMa faz</h2>
  <div class="wrap frentes-grid">
{cards}
  </div>
</section>'''


def titulo_destaque(t):
    """Texto do site.json com o trecho entre *asteriscos* em itálico vinho (<em>)."""
    return re.sub(r'\*([^*]+)\*', r'<em>\1</em>', esc(t))


def slides_do_site():
    """Slides do carrossel da home (site.json › carrossel, editado no inventário), só os ativos, na ordem:
    (tom, imagem, enquadramento, alt, eyebrow, título, texto, botões, temporada)."""
    out = []
    for sl in SITE_DADOS.get('carrossel') or []:
        if sl.get('ativo', True) is False:
            continue
        b, b2 = sl.get('botao') or {}, sl.get('botao2') or {}
        acoes = cta_link(esc(b.get('texto') or 'Solicitar proposta'), tipo=b.get('tipo') or None, track_label=b.get('medicao') or 'hero-' + sl['id'])
        if b2.get('texto') and b2.get('link'):
            acoes += f'<a class="btn btn-line" href="{esc(b2["link"])}">{esc(b2["texto"])} ' + ARROW + '</a>'
        out.append((sl.get('tom') or 'tone-cream', sl['imagem'], sl.get('enquadramento') or '--fx:100%;--fx-m:80%', sl['alt'],
                    esc(sl['eyebrow']), titulo_destaque(sl['titulo']), esc(sl['texto']), acoes, sl.get('temporada')))
    return out


def hero_carousel(slides=None, label='Destaques da TaMa Creative', assurances=True):
    # Fotos claras de estúdio (pacote tama-home-v2). No computador a foto ocupa a metade direita e se funde ao tom do
    # slide (creme, sálvia, rosé, linho); o texto fica numa coluna própria, sem encostar nos produtos. No celular o texto
    # vem acima da foto. frame: enquadramento da foto (--fx no computador, --fx-m no celular) e largura (--pw).
    home_default = slides is None
    slides = slides or slides_do_site()
    h1 = ''
    da_temporada = next((i for i, sl in enumerate(slides) if len(sl) > 8 and SEASON and sl[8] == SEASON), None) if home_default else None
    if da_temporada is not None:
        slides.insert(0, slides.pop(da_temporada))   # temporada: o slide marcado com ela abre o carrossel
        h1 = f'<h1 class="visually-hidden">{esc(ASSINATURA.rstrip("."))}</h1>'
    n = len(slides)
    # legenda curta (cabe ao lado dos controles em qualquer largura), conforme a marca que aparece nas fotos
    nota = {NOTA_FICTICIA_LONGA: NOTA_FICTICIA, NOTA_TAMA: NOTA_TAMA_CURTA}.get(nota_marca(s[3] for s in slides), 'Imagens ilustrativas • Marcas fictícias e TaMa como exemplo')
    out = []
    for i, (tone, img, frame, alt, eyebrow, title, desc, actions) in enumerate(sl[:8] for sl in slides):
        cls = ''
        if img in CARROSSEL_HQ and img in IMAGES:   # fotos do carrossel: no computador a área da foto segue a imagem (inteira, sem corte)
            w, h = IMAGES[img]['w'], IMAGES[img]['h']
            frame = f"{frame};--ar:{w}/{h}"
            cls = ' inteira' + (' respiro' if w / h >= 1.9 or img in CARROSSEL_RESPIRO else '')   # respiro: a foto já traz o espaço vazio do texto à esquerda
        tag = 'h1' if i == 0 and not h1 else 'p'
        out.append(f'''<div class="slide {tone}{cls}{' is-active' if i == 0 else ''}" id="slide-{i + 1}" role="group" aria-roledescription="slide" aria-label="{i + 1} de {n}" style="{frame}"{'' if i == 0 else ' aria-hidden="true" inert'}>
  <div class="wrap slide-inner"><div class="slide-copy">
    <p class="eyebrow">{eyebrow}</p>
    <{tag} class="slide-title">{title}</{tag}>
    <p class="slide-desc">{desc}</p>
    <div class="actions">{actions}</div>
  </div></div>
  <div class="slide-photo">{picture(img, alt, HERO_SIZES, eager=(i == 0), low=(i > 0))}</div>
</div>''')
    dots = ''.join(f'<button class="dot" type="button" data-slide="{i}" aria-label="Mostrar slide {i + 1} de {n}" aria-controls="slide-{i + 1}"{" aria-current=\"true\"" if i == 0 else ""}></button>' for i in range(n))
    strip = ASSURANCES if assurances else ''
    return f'''<section class="hero light" aria-roledescription="carrossel" aria-label="{label}" id="hero">
  {h1}{''.join(out)}
  <div class="hero-bar"><div class="wrap hero-controls">
    <p class="hero-count" aria-hidden="true"><span data-hero-count>01</span> / {n:02d}</p>
    <div class="hero-dots">{dots}</div>
    <button class="hero-arrow prev" type="button" data-hero-prev aria-label="Slide anterior"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
    <button class="hero-arrow next" type="button" data-hero-next aria-label="Próximo slide"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
    <button class="hero-pause" type="button" data-hero-pause aria-pressed="false" aria-label="Pausar troca automática"><svg class="i-pause" viewBox="0 0 24 24"><path d="M9 6v12M15 6v12"/></svg><svg class="i-play" viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg></button>
  </div></div>
  <p class="hero-caption">{nota}</p>
</section>
{strip}'''


def page_home():
    return {
        'path': '/', 'title': 'Brindes corporativos, uniformes e kits | TaMa Creative', 'og': slides_do_site()[0][1],
        'og_title': 'TaMa Creative · ' + ASSINATURA.rstrip('.'),
        'description': 'Brindes, uniformes, kits, ativações e peças de hotelaria com a marca da sua empresa. A TaMa seleciona, personaliza e coordena da escolha das peças à entrega.',
        'assunto': 'um projeto para a minha empresa',
        'preload': preload_image(slides_do_site()[0][1], HERO_SIZES),
        'body': hero_carousel() + f'''
{frentes_section()}
{process_strip()}
{home_products_block()}
{kits_block(compacto=True)}
{ocasioes_faixa()}
{faq(HOME_FAQ, title='Perguntas sobre a TaMa')}
{guias_block('home')}
{end_cta()}''',
    }


# rótulos iguais aos filtros do catálogo (CAT_PROD)
BRINDES_ATALHOS = [(CAT_PROD['garrafas-copos'], '/catalogo/?categoria=garrafas-copos'), (CAT_PROD['canetas-escritorio'], '/catalogo/?categoria=canetas-escritorio'),
                   (CAT_PROD['tecnologia'], '/catalogo/?categoria=tecnologia'),
                   (CAT_PROD['bolsas-embalagens'], '/catalogo/?categoria=bolsas-embalagens'), (CAT_PROD['casa-bem-estar'], '/catalogo/?categoria=casa-bem-estar')]


def brindes_hero(trail):
    return cab_hero(trail, 'brindes', cta_link(tipo='brindes', track_label='brindes-head')
                     + '<a class="btn btn-line" href="#estudio-b-t">Explorar as peças</a>') + '\n' + atalhos('Encontre o brinde para a sua próxima ideia.', BRINDES_ATALHOS, 'brindes-atalhos-t', linha=False, traco=True)


def page_brindes():
    return {
        'path': '/brindes-corporativos/', 'og': cab('brindes')['imagem'], 'assunto': 'brindes corporativos', 'title': 'Brindes corporativos personalizados | TaMa Creative',
        'description': 'Brindes personalizados para empresas, com peças e acabamento escolhidos para o seu público: clientes, equipes e eventos. Peça uma proposta.',
        'trail': [('/', 'Início'), ('/brindes-corporativos/', 'Brindes corporativos')],
        'service': {'key': 'brindes', 'name': 'Brindes corporativos personalizados', 'type': 'Brindes corporativos'},
        'preload': preload_image(cab('brindes')['imagem'], FOTO_HERO_SIZES),   # mesma imagem e sizes da foto do cabeçalho
        'crumbs_inline': True,
        'body': brindes_hero([('/', 'Início'), ('/brindes-corporativos/', 'Brindes corporativos')]) + season_callout('brindes') + f'''
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
{vitrine('brindes', 'estudio-b-t', more=('/catalogo/', f'Ver os {len(CATALOGO)} modelos do catálogo'))}
<section class="section ivory" aria-labelledby="tec-t">
  <div class="wrap split" style="align-items:start">
    <div class="stack" style="gap:12px"><p class="eyebrow">Personalização</p><h2 id="tec-t" class="section-title">A técnica certa para cada material</h2><p class="muted">A técnica é escolhida conforme a peça e confirmada na proposta, junto com a arte para aprovação.</p></div>
    <dl class="pack">
      <div><dt>Gravação a laser</dt><dd>Madeira, metal, couro, cortiça e pedra. Acabamento discreto e durável, conforme a peça.</dd></div>
      <div><dt>Baixo relevo e hot stamping</dt><dd>Couro e papel. Relevo com ou sem cor, discreto e sofisticado.</dd></div>
      <div><dt>Bordado</dt><dd>Tecidos. Tom sobre tom para elegância ou em contraste para presença.</dd></div>
      <div><dt>Tampografia e serigrafia</dt><dd>Cerâmica, vidro e superfícies curvas. Cor aplicada com precisão.</dd></div>
      <div><dt>Impressão digital</dt><dd>Papelaria, embalagens e estampas com muitas cores.</dd></div>
    </dl>
  </div>
</section>
<section class="section entrega" aria-labelledby="entrega-t">
  <div class="wrap entrega-grid">
    <figure class="entrega-foto">{picture(SECOES['brindes-entrega']['imagem'], SECOES['brindes-entrega']['alt'], '(max-width: 900px) min(calc(100vw - 32px), 640px), (max-width: 1340px) 50vw, 680px')}<figcaption>{esc(SECOES['brindes-entrega'].get('legenda') or NOTA_FICTICIA)}</figcaption></figure>
    <div class="entrega-texto">
      <p class="eyebrow">Apresentação</p>
      <h2 id="entrega-t" class="entrega-title"><span>A entrega</span> <em>também comunica<span class="ponto">.</span></em></h2>
      <p class="entrega-desc">A experiência começa antes de revelar o <strong>presente.</strong> Combine o brinde com uma apresentação que leve as cores, a identidade e a mensagem da sua empresa.</p>
      <dl class="entrega-lista">
        <div><dt>Caixas e embalagens</dt><dd>Formatos e acabamentos escolhidos conforme as peças e a proposta.</dd></div>
        <div><dt>Papel de seda e fitas</dt><dd>Cores e detalhes que valorizam o momento de abrir.</dd></div>
        <div><dt>Lacres e cartões</dt><dd>Sua identidade e uma mensagem para quem recebe.</dd></div>
      </dl>
      {cta_link(tipo='brindes', track_label='brindes-embalagem')}
    </div>
  </div>
</section>
{process_section('Como trabalhamos', 'Do briefing à entrega do seu brinde', 'Seis etapas, com a peça, a personalização e a arte aprovadas por você antes da produção.', 'brindes-como-t')}
''' + faq([
            ('Qual é a quantidade mínima?', 'Varia conforme a peça e a técnica de personalização. Informe a quantidade aproximada no pedido: a proposta indica as quantidades viáveis e alternativas.'),
            ('Quanto tempo leva?', 'Depende da produção e da personalização de cada peça. Por isso pedimos a data desejada já no primeiro contato e confirmamos o prazo na proposta.'),
            ('Vocês têm catálogo com preços?', 'O catálogo mostra modelos de referência, sem preços. A curadoria parte do seu objetivo, do público e do investimento disponível, e a proposta traz peças, quantidades e condições comerciais.'),
            ('Posso usar a arte da minha empresa?', 'Sim. A marca da sua empresa é aplicada nas peças pelos fornecedores, e a arte é enviada para a sua aprovação antes da produção.'),
        ], title='Perguntas sobre brindes') + guias_block('brindes') + end_cta('Vamos escolher os brindes da sua marca?', 'Conte para quem são, a ocasião, a quantidade e a data: a TaMa propõe as peças, a personalização e a apresentação.', tipo='brindes'),
    }


ATIV_HERO_SIZES = '(max-width: 760px) 165vw, (max-width: 1100px) 110vw, 95vw'   # foto de ativações, mais larga (2,18:1)
FOTO_HERO_SIZES = '(max-width: 760px) 135vw, (max-width: 1100px) 100vw, (min-width: 1573px) 1210px, 77vw'   # foto 16:9 dos cabeçalhos de kits e confecções: altura × 16:9 no computador; no celular, cortada em 4:3


def cab(chave):
    """Cabeçalho de uma página (site.json › cabecalhos, editado no inventário › Páginas)."""
    return SITE_DADOS['cabecalhos'][chave]


def cab_hero(trail, chave, acoes, sizes=None):
    """foto_hero com a foto, o texto alternativo, os títulos e o texto do site.json; os botões continuam no código."""
    c = cab(chave)
    return foto_hero(trail, c['imagem'], c['alt'], esc(c['eyebrow']), [esc(x) for x in c['linhas']], [esc(x) for x in c['destaque']],
                     esc(c['texto']), acoes, esc(c.get('legenda') or NOTA_FICTICIA), pos_m=c.get('posicao_celular') or 'right',
                     desloc=c.get('desloc', 0), sizes=sizes)


def vitrine(chave, aria, more=None, sid=None, cls=''):
    """Vitrine de modelos de uma página (site.json › vitrines, editado no inventário › Páginas)."""
    v = SITE_DADOS['vitrines'][chave]
    return studio_block(v['modelos'], esc(v['titulo']), esc(v['eyebrow']), esc(v['texto']), aria, more=more, sid=sid, cls=cls)


def foto_hero(trail, img, alt, eyebrow, linhas, destaque, desc, actions, legenda, pos_m='right', desloc=0, sizes=None):
    # Cabeçalho dos mockups da TaMa (kits, confecções): a foto 16:9 ocupa a largura toda e o texto fica na parte clara à
    # esquerda, sem passar por cima do assunto (a altura acompanha a largura, então ele começa sempre depois da coluna de
    # texto). Até 1100 px o texto vem acima e a foto abaixo; no celular, cortada em 4:3 na direção de pos_m.
    # destaque: texto (ou lista de linhas) em itálico vinho. desloc: fração da largura da foto que fica para fora à direita,
    # para fotos mais largas que 16:9 cujo assunto começaria perto demais do texto.
    destaques = [destaque] if isinstance(destaque, str) else destaque
    titulo = ' '.join(f'<span>{l}</span>' for l in linhas) + ' ' + ' '.join(f'<em>{d}</em>' for d in destaques)
    ar = f"{IMAGES[img]['w']} / {IMAGES[img]['h']}" if img in IMAGES else '16 / 9'
    return f'''<section class="foto-hero" aria-labelledby="foto-hero-t" style="--pos-m:{pos_m};--ar:{ar};--desloc:{desloc}">
  {crumbs(trail)}
  <div class="wrap foto-hero-inner"><div class="foto-hero-copy">
    <p class="eyebrow">{eyebrow}</p>
    <h1 id="foto-hero-t" class="foto-hero-title">{titulo}</h1>
    <p class="foto-hero-desc">{desc}</p>
    <div class="actions">{actions}</div>
  </div></div>
  <figure class="foto-hero-photo">{picture(img, alt, sizes or FOTO_HERO_SIZES, eager=True)}<figcaption>{legenda}</figcaption></figure>
</section>'''


def kits_topo():
    """Foto do topo de /kits-corporativos/ (site.json › cabecalhos › kits); sem o arquivo, a foto anterior (kits-header)."""
    return cab('kits')['imagem'] if cab('kits')['imagem'] in IMAGES else 'kits-header'


def kits_hero(trail):
    return cab_hero(trail, 'kits', cta_link(tipo='kits', track_label='kits-head') + '<a class="btn btn-line" href="#kits">Conhecer os kits</a>')


def page_kits():
    trail = [('/', 'Início'), ('/kits-corporativos/', 'Kits corporativos')]
    topo = kits_topo()
    chips = ''.join(f'<a class="chip" href="#{sid}">{titulo}</a>' for sid, titulo, _l, _k in KITS_TIPOS)
    return {
        'path': '/kits-corporativos/', 'og': topo, 'assunto': 'kits corporativos', 'title': 'Kits corporativos e de boas-vindas | TaMa Creative',
        'description': 'Kits de boas-vindas, kits para eventos e presentes para clientes, com curadoria, embalagem personalizada e a marca da sua empresa. Solicite uma proposta.',
        'trail': trail,
        'service': {'key': 'kits', 'name': 'Kits corporativos personalizados', 'type': 'Kits corporativos'},
        'preload': preload_image(topo, FOTO_HERO_SIZES),   # mesma imagem e sizes da foto do cabeçalho
        'crumbs_inline': True,   # o caminho fica sobre a área creme da foto, logo abaixo do cabeçalho do site
        'body': kits_hero(trail) + season_callout('kits') + f'''
<section class="section kits-intro" id="kits" aria-labelledby="kits-p-t" style="padding-top:clamp(24px,3vw,40px)">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Kits corporativos</p><h2 id="kits-p-t" class="section-title">Kits de referência para adaptar à sua marca</h2><p class="muted">Composições organizadas por tipo de kit. A TaMa ajusta peças, embalagem e cartão ao seu público, à ocasião e ao investimento, sempre com a marca da sua empresa.</p></div>
    <nav class="kit-occ kit-tipos" aria-label="Tipos de kit"><span>Veja por tipo:</span>{chips}</nav>
  </div>
</section>
{kits_tipos_html()}
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
{process_section('Do briefing à entrega', 'Como montamos o seu kit', 'Seis etapas, com a composição, a embalagem e a arte aprovadas por você antes da produção.', 'kit-m-t', verde=False)}
''' + faq([
            ('O que colocar em um kit de boas-vindas?', 'Uma combinação que funciona: uma peça de uso diário (garrafa, caderno), um mimo que gere afeto (caneca, manta) e um material sobre a cultura da empresa, como uma carta de boas-vindas. A proposta ajusta a composição ao seu público.'),
            ('Dá para ter versões diferentes do mesmo kit?', 'Sim. A proposta pode prever versões por área ou ocasião, mantendo a mesma linguagem visual.'),
            ('Qual é a quantidade mínima de kits?', 'Depende das peças escolhidas e das técnicas de personalização. Informe o número de kits no pedido: a proposta indica as quantidades viáveis.'),
            ('Com quanto tempo de antecedência devo pedir?', 'Quanto antes, mais opções de peças e acabamentos. Informe a data desejada no pedido e confirmamos o prazo na proposta.'),
        ], title='Perguntas sobre kits') + guias_block('kits') + end_cta('Vamos montar o seu kit?', 'Conte a ocasião, o público e a quantidade: a TaMa propõe a composição, a caixa e o cartão com a sua marca.', tipo='kits'),
    }


# Abertura de /brindes-por-ocasiao/: foto e texto mudam com a ocasião escolhida (o site.js troca pelo <template>).
# (imagem, alt, eyebrow, linhas do título, destaque em itálico, apoio). Todas as fotos com marcas fictícias.
OCC_HEROS = {k: (c['imagem'], c['alt'], esc(c['eyebrow']), [esc(x) for x in c['linhas']],
                 [esc(x) for x in c['destaque']] if len(c['destaque']) > 1 else esc(c['destaque'][0]), esc(c['texto']))
             for k, c in (SECOES.get('ocasioes') or {}).items()}   # site.json › secoes › ocasioes (inventário › Páginas › Ocasiões)

def occ_hero(trail, k):
    img, alt, eyebrow, linhas, destaque, desc = OCC_HEROS[k]
    acoes = cta_link(tipo='brindes', track_label='ocasiao-head-' + k) + f'<a class="btn btn-line" href="#pecas">Ver as peças</a>'
    return foto_hero(trail, img, alt, eyebrow, linhas, destaque, desc, acoes, NOTA_FICTICIA, pos_m='80% center')


def page_curadoria():
    """Seleção editorial por ocasião (URL antiga da curadoria): reapresenta modelos do catálogo, sem cadastro próprio."""
    pecas = [c for c in CATALOGO if c['ocasioes']]
    cats = [k for k in CAT_PROD if any(c['categoria'] == k for c in pecas)]
    occ_chips = '<button class="chip" type="button" data-filter="occ" data-value="todas" aria-pressed="true">Todas</button>' + ''.join(
        f'<button class="chip" type="button" data-filter="occ" data-value="{k}" aria-pressed="false">{v}</button>' for k, v in sorted(OCCS.items(), key=lambda kv: kv[0] != (SEASON or 'fim-de-ano')))
    cat_chips = ('<button class="chip" type="button" data-filter="cat" data-value="todas" aria-pressed="true">Todas</button>'
                 + ''.join(f'<button class="chip" type="button" data-filter="cat" data-value="{k}" aria-pressed="false">{CAT_PROD[k]}</button>' for k in cats))
    url = SITE + '/brindes-por-ocasiao/'
    item_list = {'@type': 'ItemList', '@id': url + '#lista', 'name': 'Brindes e presentes corporativos por ocasião', 'numberOfItems': len(pecas),
                 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': c['nome'], 'url': SITE + '/catalogo/#' + c['slug']} for i, c in enumerate(pecas)]}
    return {
        'path': '/brindes-por-ocasiao/', 'title': 'Brindes corporativos por ocasião | TaMa Creative',
        'description': 'Ideias de brindes e presentes corporativos para boas-vindas, eventos, fim de ano, reconhecimento e lançamentos, com a marca da sua empresa. Monte a seleção.',
        'trail': [('/', 'Início'), ('/brindes-por-ocasiao/', 'Brindes por ocasião')],
        'service': {'key': 'ocasioes', 'name': 'Brindes e presentes corporativos por ocasião', 'type': 'Brindes corporativos'},
        'assunto': 'brindes e presentes por ocasião',
        'wp_type': 'CollectionPage', 'ld_extra': [item_list],
        'crumbs_inline': True,
        'preload': preload_image('brindes-header', FOTO_HERO_SIZES),
        'body': occ_hero([('/', 'Início'), ('/brindes-por-ocasiao/', 'Brindes por ocasião')], 'todas') + ''.join(f'<template data-occ-hero="{k}">{occ_hero([('/', 'Início'), ('/brindes-por-ocasiao/', 'Brindes por ocasião')], k)}</template>' for k in OCC_HEROS if k != 'todas') + f'''
{season_callout('ocasioes')}
<section class="section ivory" id="pecas" style="padding-top:clamp(32px,4vw,52px)" aria-label="Peças por ocasião">
  <div class="wrap">
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


ICONES = {   # traço fino, cor do texto (currentColor)
    'carrinho': '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 4h2.2l2.2 10.2h10.4l2-7.2H6.4"/><circle cx="9.5" cy="18.6" r="1.4"/><circle cx="16.6" cy="18.6" r="1.4"/></svg>',
    'calendario': '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3.8" y="5.2" width="16.4" height="15" rx="2"/><path d="M3.8 9.6h16.4M8 3.4v3.6M16 3.4v3.6"/></svg>',
    'talheres': '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 3v6.2a2 2 0 0 1-2 2h0M7 3v6.2a2 2 0 0 0 2 2h0M7 11.2V21M5 3v4.6M9 3v4.6"/><path d="M16.6 21V3.4c-1.9.9-3 3.3-3 6.6v3.4h3"/></svg>',
    'chef': '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7.4 14.4v5.6h9.2v-5.6M7.4 17.2h9.2"/><path d="M7.4 14.4A3.6 3.6 0 0 1 6.9 7.3a4.4 4.4 0 0 1 8.2-1.6 3.6 3.6 0 1 1 1.5 8.7"/></svg>',
    'cloche': '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 17.6h18M4.6 17.6a7.4 7.4 0 0 1 14.8 0M12 10.2V8.4M10.6 8.4h2.8"/></svg>',
    'pessoas': '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="7.4" r="2.6"/><circle cx="5.8" cy="9.4" r="2"/><circle cx="18.2" cy="9.4" r="2"/><path d="M7.4 19.6v-2.2a4.6 4.6 0 0 1 9.2 0v2.2zM2.6 19.6v-1.4a3.2 3.2 0 0 1 4.2-3M21.4 19.6v-1.4a3.2 3.2 0 0 0-4.2-3"/></svg>',
}


def atalhos(titulo, itens, aria, linha=True, centro=False, traco=False, eyebrow=None, lado=False):
    """Faixa de atalhos logo abaixo dos cabeçalhos de foto: título serifado e links com seta, separados por fios.
    itens: (texto, link) ou (texto, link, ícone de ICONES). lado: título (com eyebrow) à esquerda e links à direita."""
    lis = ''.join(f'<li><a href="{it[1]}">{ICONES.get(it[2], "") if len(it) > 2 else ""}<span>{it[0]}</span> {ARROW}</a></li>' for it in itens)
    h2 = f'<h2 id="{aria}" class="atalhos-title">{titulo}</h2>'
    if eyebrow:
        h2 = f'<div class="atalhos-head"><p class="eyebrow">{eyebrow}</p>{h2}</div>'
    return f'''<section class="atalhos{'' if linha else ' sem-linha'}{' centro' if centro else ''}{' traco' if traco else ''}{' lado' if lado else ''}" aria-labelledby="{aria}">
  <div class="wrap">
    {h2}
    <ul class="atalhos-list" style="--n:{len(itens)}">{lis}</ul>
  </div>
</section>'''


CONF_PECAS = [('Polos e camisetas', '/catalogo/?categoria=vestuario'), ('Camisas sociais', '/catalogo/?q=camisa'),
              ('Moletons', '/catalogo/?q=moletom'), ('Dólmãs e aventais', '/hotelaria-e-gastronomia/')]


def conf_hero(trail):
    return cab_hero(trail, 'confeccoes', cta_link(tipo='confeccoes', track_label='conf-head')
                    + '<a class="btn btn-line" href="#estudio-c-t">Explorar as peças</a>') + '\n' + atalhos('Encontre as peças para a sua equipe.', CONF_PECAS, 'conf-pecas-t')


def page_confeccoes():
    return {
        'path': '/confeccoes-personalizadas/', 'og': 'conf-equipe-kits', 'assunto': 'confecções e uniformes', 'title': 'Uniformes e confecções personalizadas para empresas | TaMa',
        'description': 'Uniformes corporativos, polos, camisas, moletons e bonés para equipes e eventos, alinhados à identidade visual da sua empresa e pensados para quem veste.',
        'trail': [('/', 'Início'), ('/confeccoes-personalizadas/', 'Uniformes e confecções')],
        'service': {'key': 'confeccoes', 'name': 'Uniformes e confecções personalizadas para empresas', 'type': 'Uniformes corporativos personalizados'},
        'preload': preload_image(cab('confeccoes')['imagem'], FOTO_HERO_SIZES),   # mesma imagem e sizes da foto do cabeçalho
        'crumbs_inline': True,   # o caminho fica sobre a área clara da foto, logo abaixo do cabeçalho do site
        'body': conf_hero([('/', 'Início'), ('/confeccoes-personalizadas/', 'Uniformes e confecções')]) + f'''
<section class="section ivory" aria-labelledby="uso-t">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Definido pelo uso</p><h2 id="uso-t" class="section-title">Cada peça começa pela rotina de quem veste</h2><p class="muted">Tecido, modelagem e personalização são escolhidos para a rotina da equipe e confirmados na proposta, com a arte para aprovação.</p></div>
    <div class="cols-3">
      <div class="col">{arc('c1')}<h3>Tecido</h3><p>Malha, piquê, moletom ou sarja, conforme o clima, a rotina e a durabilidade esperada.</p></div>
      <div class="col">{arc('c2')}<h3>Modelagem</h3><p>Cortes escolhidos para vestir bem a equipe, com a grade de tamanhos definida no projeto.</p></div>
      <div class="col">{arc('c3')}<h3>Personalização</h3><p>Bordado, silk e etiquetas escolhidos para a peça e para a imagem da marca.</p></div>
    </div>
  </div>
</section>
{vitrine('confeccoes', 'estudio-c-t', more=('/catalogo/?categoria=vestuario', 'Ver vestuário no catálogo'))}
<section class="section ivory" aria-labelledby="tec-c-t">
  <div class="wrap split" style="align-items:start">
    <div class="stack" style="gap:12px"><p class="eyebrow">Acabamentos</p><h2 id="tec-c-t" class="section-title">Bordado, silk ou etiqueta?</h2><p class="muted">A técnica depende da peça, do tecido e do uso. A proposta indica a mais adequada para cada item.</p></div>
    <dl class="pack">
      <div><dt>Bordado</dt><dd>Tom sobre tom para elegância, ou em contraste para presença. Indicado para polos e peças de uso contínuo.</dd></div>
      <div><dt>Silk e estampa</dt><dd>Para campanhas, áreas grandes e padrões de marca aplicados em toda a peça.</dd></div>
      <div><dt>Etiquetas</dt><dd>Tecidas ou aplicadas na barra. Um detalhe discreto, que valoriza a peça.</dd></div>
    </dl>
  </div>
</section>
{process_section('Como trabalhamos', 'Da peça escolhida ao uniforme entregue', 'Seis etapas, com tecido, modelagem, grade de tamanhos e arte aprovados por você antes da produção.', 'conf-como-t', cls='')}
''' + faq([
            ('Bordado ou estampa: qual escolher?', 'O bordado costuma durar mais e transmite sofisticação, por isso funciona bem em polos e uniformes. A estampa permite mais cores e áreas maiores, o que combina com camisetas de campanha e eventos.'),
            ('Qual é a quantidade mínima?', 'Varia conforme a peça, o tecido e a técnica de personalização. Informe quantas pessoas e a grade aproximada no pedido: a proposta indica as quantidades viáveis.'),
            ('As peças seguem as cores da empresa?', 'Envie as cores da marca (manual ou códigos) no pedido: a proposta indica os tecidos e as cores disponíveis mais próximas, aprovados antes da produção. As cores do site são referências visuais.'),
        ], title='Perguntas sobre uniformes e confecções') + end_cta('Vamos vestir a sua equipe com a sua marca?', 'Conte quem vai vestir, em que ocasião e quantas pessoas: a TaMa propõe as peças, o tecido e a personalização.', tipo='confeccoes'),
    }


ATIV_FORMATOS = [('Degustações no ponto de venda', '#fmt-degustacao', 'carrinho'), ('Feiras e eventos', '#fmt-feiras', 'calendario'),
                 ('Ações promocionais', '#fmt-promocao', 'pessoas'), ('Buffet completo', '#fmt-buffet', 'cloche'), ('Decoração', '#fmt-decoracao', 'arranjo')]
# ícone de Decoração (arranjo num vaso), no mesmo traço fino dos demais
ICONES['arranjo'] = ('<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8.4 14.4h7.2l-1.1 6.2H9.5z"/>'
                     '<path d="M12 14.4V8.6"/><circle cx="12" cy="6" r="2.4"/><path d="M12 12.2c-2.2 0-3.6-1.2-4-3 2.2 0 3.6 1.2 4 3z'
                     'M12 11c2.2 0 3.6-1.2 4-3-2.2 0-3.6 1.2-4 3z"/></svg>')
# Buffet e decoração: a TaMa coordena com parceiros especializados (sem cardápio, capacidade nem preço no site). Cenas em
# img/v2/ com marcas fictícias; só entram as que já existem em img/.
ATIV_EVENTO = 'Buffet ou decoração para evento'   # interesse que segue para o pedido de proposta
ATIV_CENAS = [(c['imagem'], c['alt'], c.get('legenda') or 'Cena ilustrativa · marca fictícia') for c in (SECOES.get('ativacoes-cenas') or {}).get('itens') or []]

def ativ_cenas():
    figs = ''.join(f'<figure>{picture(img, alt, "(max-width: 760px) 92vw, 46vw")}<figcaption>{esc(leg)}</figcaption></figure>'
                   for img, alt, leg in ATIV_CENAS if img in IMAGES)
    return f'\n    <div class="ativ-cenas">{figs}</div>' if figs else ''


def ativ_formatos():
    """Cabeçalho e itens da seção Formatos de /ativacoes-promocionais-eventos-corporativos/ (site.json › secoes › ativacoes-formatos). Itens com
    "pedido" ganham o link para o pedido de buffet ou decoração; o id é a âncora do menu (Ativações ▾)."""
    f = SECOES.get('ativacoes-formatos') or {}
    linhas = []
    for i in f.get('itens') or []:
        id_attr = f' id="{esc(i["id"])}"' if i.get('id') else ''
        link = (' ' + ativ_evento_link('ativ-' + i['id'].replace('fmt-', ''))) if i.get('pedido') else ''
        linhas.append(f'      <div class="item"{id_attr}>{arc()}<div><h3>{esc(i["titulo"])}</h3><p>{esc(i["texto"])}{link}</p></div></div>')
    cab_html = (f'    <div class="section-head"><p class="eyebrow">{esc(f.get("eyebrow") or "")}</p><h2 id="formatos-t" class="section-title">'
                f'{esc(f.get("titulo") or "")}</h2><p class="muted">{esc(f.get("texto") or "")}</p></div>\n    <div class="cols-2">\n')
    return cab_html + '\n'.join(linhas)


def ativ_evento_link(label):
    return (f'<a class="link" href="/solicitar-proposta/?tipo=ativacoes&amp;interesse={urllib.parse.quote(ATIV_EVENTO)}" data-track="cta_solicitar_proposta" '
            f'data-track-label="{label}" data-interesse="{ATIV_EVENTO}">Solicitar proposta</a>')


def ativ_hero(trail):
    return cab_hero(trail, 'ativacoes', cta_link(tipo='ativacoes', track_label='ativacoes-head') + '<a class="btn btn-line" href="#formatos">Conhecer os formatos</a>',
                    sizes=ATIV_HERO_SIZES) + '\n' + atalhos('Uma ação para cada encontro.', ATIV_FORMATOS, 'ativ-atalhos-t', linha=False)


def page_ativacoes():
    return {
        'path': '/ativacoes-promocionais-eventos-corporativos/', 'og': 'conf-degustacao-v2', 'title': 'Ativações promocionais para eventos corporativos | TaMa Creative',
        'description': 'Ativações promocionais para eventos corporativos: degustações, feiras, buffet e decoração, com uniformes e brindes da sua marca. Peça uma proposta.',
        'trail': [('/', 'Início'), ('/ativacoes-promocionais-eventos-corporativos/', 'Ativações promocionais para eventos corporativos')],
        'service': {'key': 'ativacoes', 'name': 'Ativações promocionais para eventos corporativos', 'type': 'Ativação promocional'},
        'assunto': 'uma ativação promocional ou degustação',
        'preload': preload_image(cab('ativacoes')['imagem'], ATIV_HERO_SIZES),   # mesma imagem e sizes da foto do cabeçalho
        'crumbs_inline': True,
        'body': ativ_hero([('/', 'Início'), ('/ativacoes-promocionais-eventos-corporativos/', 'Ativações promocionais para eventos corporativos')]) + f'''
<section class="section ivory" id="formatos" aria-labelledby="formatos-t">
  <div class="wrap">
{ativ_formatos()}
    </div>{ativ_cenas()}
  </div>
</section>
<section class="section" aria-labelledby="ativ-inclui-t">
  <div class="wrap split" style="align-items:start">
    <div class="stack" style="gap:12px"><p class="eyebrow">O que pode fazer parte</p><h2 id="ativ-inclui-t" class="section-title">Tudo o que a ação precisa, com a sua marca</h2><p class="muted">O escopo de cada ativação (materiais, equipe, logística e regras do local ou do organizador) é definido com você e confirmado na proposta.</p></div>
    <dl class="pack">
      <div><dt>Uniformes da equipe</dt><dd>Camisetas, polos, aventais e bonés. <a class="link" href="/confeccoes-personalizadas/">Ver uniformes e confecções</a></dd></div>
      <div><dt>Brindes e amostras</dt><dd>Peças para entregar ao público, do copo à ecobag. <a class="link" href="/catalogo/">Ver o catálogo</a></dd></div>
      <div><dt>Kits para convidados</dt><dd>Kits para enviar a imprensa, parceiros e clientes. <a class="link" href="/kits-corporativos/">Ver os kits</a></dd></div>
      <div><dt>Planejamento e coordenação</dt><dd>Cronograma, coordenação dos fornecedores e entrega combinada na proposta.</dd></div>
    </dl>
  </div>
</section>
{vitrine('ativacoes', 'ativ-pecas-t', more=('/catalogo/', 'Ver o catálogo completo'))}
{process_section('Como planejamos', 'Da ideia ao dia da ação', 'O objetivo da ação, o formato (local, duração e público esperado) e os materiais entram já no briefing. O cronograma e a entrega dos materiais são combinados na proposta, com a arte aprovada por você antes da produção.', 'ativ-como-t')}
''' + faq([
            ('Que tipo de ativação vocês fazem?', 'Degustações e promoções no ponto de venda, ações em feiras e eventos, ativações internas e, com parceiros especializados, buffet completo e decoração para eventos. Conte o objetivo, o público e o local: a proposta indica o formato e o que entra nele.'),
            ('Quem cuida da equipe e da logística?', 'Diga no pedido se a ação precisa de equipe, transporte ou montagem. A proposta separa o que a TaMa coordena e o que fica com a sua empresa, com o local ou com o organizador.'),
            ('Com quanto tempo de antecedência devo pedir?', 'Quanto antes, mais opções de materiais e de datas. Informe a data da ação no pedido e o prazo é confirmado na proposta.'),
            ('Precisa de autorização do local?', 'Lojas, supermercados e eventos costumam ter regras próprias para ações. Envie o local e as regras do organizador, se já tiver: a proposta indica quem cuida de cada autorização.'),
        ], title='Perguntas sobre ativações') + end_cta('Vamos planejar a sua ativação?', 'Conte o produto, o público, o local e a data: a TaMa propõe o formato e os materiais com a sua marca.', tipo='ativacoes'),
    }


HOT_ATALHOS = [('Mesa e salão', '#amb-salao', 'talheres'), ('Cozinha e atendimento', '#amb-cozinha', 'chef'), ('Hotelaria', '#amb-hospedes', 'cloche')]


def hot_hero(trail):
    return cab_hero(trail, 'hotelaria', cta_link(tipo='hotelaria', track_label='hotelaria-head') + '<a class="btn btn-line" href="#hot-pecas-t">Explorar as peças</a>') + '\n' + atalhos('Personalização que acompanha o seu atendimento.', HOT_ATALHOS, 'hot-atalhos-t', linha=False, centro=True)


def page_hotelaria():
    return {
        'path': '/hotelaria-e-gastronomia/', 'title': 'Hotelaria e gastronomia: cardápios e uniformes | TaMa', 'og': 'conf-chef-dolma',
        'description': 'Cardápios, porta-contas, jogos americanos, dólmãs e aventais com a marca do seu restaurante, bar, café ou hotel. Monte a seleção e peça uma proposta.',
        'trail': [('/', 'Início'), ('/hotelaria-e-gastronomia/', 'Hotelaria e gastronomia')],
        'service': {'key': 'hotelaria', 'name': 'Produtos personalizados para hotelaria e gastronomia', 'type': 'Produtos personalizados para restaurantes e hotéis'},
        'assunto': 'produtos para hotelaria e gastronomia',
        'preload': preload_image(cab('hotelaria')['imagem'], FOTO_HERO_SIZES),   # mesma imagem e sizes da foto do cabeçalho
        'crumbs_inline': True,
        'body': hot_hero([('/', 'Início'), ('/hotelaria-e-gastronomia/', 'Hotelaria e gastronomia')]) + f'''
<section class="section ivory" aria-labelledby="ambientes-t">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Por ambiente</p><h2 id="ambientes-t" class="section-title">A marca em cada ponto de contato</h2><p class="muted">Do salão à cozinha, as peças que o cliente vê e segura podem levar a identidade da sua casa.</p></div>
    <div class="cols-2">
      <div class="item" id="amb-salao">{arc()}<div><h3>Salão e mesa</h3><p>Cardápio, porta-contas e jogos americanos: o que o cliente segura durante toda a refeição.</p></div></div>
      <div class="item" id="amb-cozinha">{arc()}<div><h3>Cozinha e equipe</h3><p>Dólmãs e aventais com a marca, em cores definidas no projeto.</p></div></div>
      <div class="item">{arc()}<div><h3>Bar e eventos</h3><p>Taças, copos e peças para eventos, degustações e datas especiais da casa.</p></div></div>
      <div class="item" id="amb-hospedes">{arc()}<div><h3>Clientes e hóspedes</h3><p>Kits e brindes para receber, agradecer e fidelizar. <a class="link" href="/kits-corporativos/">Ver os kits</a></p></div></div>
    </div>
  </div>
</section>
{vitrine('hotelaria', 'hot-pecas-t', more=('/catalogo/?categoria=hotelaria-gastronomia', 'Ver hotelaria no catálogo'))}
<section class="section ivory" aria-labelledby="hot-considerar-t">
  <div class="wrap split" style="align-items:start">
    <div class="stack" style="gap:12px"><p class="eyebrow">Antes de pedir</p><h2 id="hot-considerar-t" class="section-title">O que vale definir</h2><p class="muted">Três informações que ajudam a proposta a chegar certa na primeira versão.</p></div>
    <dl class="pack">
      <div><dt>Uso diário</dt><dd>Peças manuseadas o dia todo: material, acabamento e limpeza são escolhidos e confirmados na proposta.</dd></div>
      <div><dt>Quantidades e reposição</dt><dd>Informe quantas mesas, pessoas na equipe e a previsão de reposição.</dd></div>
      <div><dt>Uma linguagem só</dt><dd>Salão, cozinha e equipe com a mesma identidade, da cor do avental ao cardápio.</dd></div>
    </dl>
  </div>
</section>
{process_section('Como trabalhamos', 'Da escolha das peças à mesa', 'Seis etapas, com material, acabamento e arte aprovados por você antes da produção.', 'hot-como-t', cls='')}
''' + faq([
            ('Quais peças vocês personalizam para restaurantes e hotéis?', 'Cardápios, porta-contas, jogos americanos, dólmãs, aventais, taças e copos, além de kits e brindes para clientes. Se a peça que você procura não está no catálogo, descreva no pedido.'),
            ('As peças aguentam o uso diário?', 'Conte no pedido a rotina das peças (lavagens, uso na cozinha, área externa): a proposta indica material, acabamento e cuidados.'),
            ('Bordado ou estampa nas dólmãs e aventais?', 'O bordado costuma ser usado em peças de uso contínuo; a estampa permite mais cores e áreas maiores. A técnica é definida no projeto.'),
        ], title='Perguntas sobre hotelaria e gastronomia') + end_cta('Vamos levar a sua marca à mesa e à equipe?', 'Conte o tipo de casa, o número de mesas e de pessoas na equipe: a TaMa propõe as peças e a personalização.', tipo='hotelaria'),
    }



# Kits da página de fim de ano: kits.json › fim_de_ano.
FIM_DE_ANO_KITS = kits_da_lista('fim_de_ano')


FIM_ATALHOS = [('Taças e copos', '#brindar'), ('Conjuntos e embalagens', '#kits-fim-de-ano'), ('Personalização e mensagens', '#personalizacao')]


def page_fim_de_ano():
    """Ocasião "Fim de ano": taças e copos para brindar, kits prontos e peças para presentear, todos do catálogo."""
    com_foto = [k for k in FIM_DE_ANO_KITS if kit_foto(k[0])]
    g = kits_grandes(len(com_foto))
    kits = ''.join(kit_card(i, slug, name, desc, i < g) for i, (slug, name, desc) in enumerate(com_foto))
    # sem kit de fim de ano no site (todos tirados no inventário): a seção e o atalho para ela saem da página
    kits_sec = f'''<section class="section kits-home" id="kits-fim-de-ano" aria-labelledby="kits-t">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Kits de fim de ano</p><h2 id="kits-t" class="section-title">Prontos para presentear</h2><p class="muted">Composições com caixa e cartão na identidade da sua empresa; a quantidade e as peças são ajustadas na proposta.</p></div>
    <div class="kit-grid">{kits}</div>
    <p class="note">{nota_kits(com_foto)}</p>
  </div>
</section>''' if com_foto else ''
    fim_atalhos = [a for a in FIM_ATALHOS if com_foto or a[1] != '#kits-fim-de-ano']
    return {
        'path': '/brindes-de-fim-de-ano/', 'og': 'kitp-kit-brinde', 'title': 'Brindes de fim de ano e Natal para empresas | TaMa',
        'description': 'Brindes de fim de ano e presentes de Natal com a marca da sua empresa: taças, copos e kits para clientes e equipes. Peça uma proposta.',
        'trail': [('/', 'Início'), ('/brindes-por-ocasiao/', 'Brindes por ocasião'), ('/brindes-de-fim-de-ano/', 'Fim de ano')],
        'service': {'key': 'fim-de-ano', 'name': 'Brindes de fim de ano para clientes e equipes', 'type': 'Brindes corporativos'},
        'assunto': 'brindes de fim de ano',
        'preload': preload_image(cab('fim-de-ano')['imagem'], FOTO_HERO_SIZES),   # mesma imagem e sizes da foto do cabeçalho
        'crumbs_inline': True,
        'body': cab_hero([('/', 'Início'), ('/brindes-de-fim-de-ano/', 'Fim de ano')], 'fim-de-ano',
                         cta_link(tipo='kits', track_label='fim-de-ano-head')
                         + '<a class="btn btn-line" href="#brindar">Explorar os presentes</a>') + '\n' + atalhos(
            'Escolha como brindar.', fim_atalhos, 'fim-atalhos-t', linha=False, eyebrow='Para brindar', lado=True) + f"""
{vitrine('fim-brindar', 'brindar-t', more=('/catalogo/?ocasiao=fim-de-ano', 'Ver todos de fim de ano no catálogo'), sid='brindar', cls='ivory')}
{kits_sec}
{vitrine('fim-presentear', 'presentear-t', more=('/catalogo/', 'Ver o catálogo'), sid='presentear')}
{process_section('Como planejamos', 'Do briefing à entrega antes do recesso', 'Para quem são os presentes, as peças, a embalagem e a mensagem do cartão entram no briefing e na proposta; a arte é aprovada por você antes da produção e a entrega segue os endereços e a data combinados.', 'fda-como-t', sid='personalizacao')}
""" + faq([
            ('Com quanto tempo de antecedência devo pedir?', 'Quanto antes, mais opções de peças, cores e embalagens. Informe a data de entrega no pedido e o prazo é confirmado na proposta.'),
            ('Dá para enviar para vários endereços?', 'Conte no pedido quantos destinos são e onde ficam: a proposta diz como a entrega é organizada.'),
            ('As taças podem levar a cor da minha marca?', 'Cada modelo tem cores de referência; cores, material e técnica de aplicação são confirmados na proposta.'),
            ('Posso misturar peças do catálogo num kit?', 'Sim. Selecione as peças no catálogo e envie com o pedido: a TaMa monta a composição, a caixa e o cartão.'),
        ], title='Perguntas sobre o fim de ano') + guias_block('fim') + end_cta('Vamos montar o seu fim de ano?', 'Conte para quem são os presentes, quantas pessoas e a data de entrega: a TaMa propõe as peças, os kits e a embalagem com a sua marca.', tipo='kits'),
    }

def sobre_cenas():
    """As cenas numeradas de /sobre/ (site.json › secoes › sobre-cenas)."""
    itens = (SECOES.get('sobre-cenas') or {}).get('itens') or []
    return '\n'.join(f'      <li><figure>{picture(c["imagem"], c["alt"], "(max-width: 760px) 92vw, 31vw")}<figcaption><span>{n:02d}</span>'
                     f'{esc(c["texto"])} <em>{esc(c["destaque"])}</em></figcaption></figure></li>' for n, c in enumerate(itens, 1))


def page_sobre():
    trail = [('/', 'Início'), ('/sobre/', 'Sobre')]
    dados = ''.join(f'<div><dt>{t}</dt><dd>{esc(v)}</dd></div>' for t, v in (('Razão social', RAZAO), ('CNPJ', CNPJ), ('Cidade', CIDADE), ('Atendimento comercial', RESPONSAVEL), ('E-mail', EMAIL)) if v)
    dados_html = f'<section class="section" aria-labelledby="dados-t"><div class="wrap split" style="align-items:start"><div class="stack" style="gap:12px"><p class="eyebrow">Dados da empresa</p><h2 id="dados-t" class="section-title">TaMa Creative</h2></div><dl class="pack">{dados}</dl></div></section>' if dados else ''
    return {
        'path': '/sobre/', 'title': 'Sobre a TaMa Creative | Brindes, uniformes, kits e ativações',
        'description': 'A TaMa Creative seleciona, personaliza e coordena brindes, uniformes, kits, ativações e peças de hotelaria com a marca da sua empresa.',
        'trail': trail, 'wp_type': 'AboutPage', 'assunto': 'um projeto para a minha empresa',
        'preload': preload_image(cab('sobre')['imagem'], FOTO_HERO_SIZES),   # mesma imagem e sizes da foto do cabeçalho
        'crumbs_inline': True,
        'body': cab_hero(trail, 'sobre', cta_link(track_label='sobre-head') + '<a class="btn btn-line" href="#como-t">Como trabalhamos</a>') + f'''
<section class="section ivory" aria-labelledby="faz-t">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">O que fazemos</p><h2 id="faz-t" class="section-title">Cinco áreas, um mesmo cuidado com a marca</h2><p class="muted">Em todas, a peça leva a marca da sua empresa: a TaMa seleciona, personaliza, coordena os fornecedores e entrega.</p></div>
    <div class="cols-2">
      <div class="item">{arc()}<div><h3><a href="/brindes-corporativos/">Brindes corporativos</a></h3><p>Peças para clientes, equipes e eventos, escolhidas pelo uso.</p></div></div>
      <div class="item">{arc()}<div><h3><a href="/confeccoes-personalizadas/">Uniformes e confecções</a></h3><p>Polos, camisas, camisetas, moletons, dólmãs e aventais com a marca da sua empresa.</p></div></div>
      <div class="item">{arc()}<div><h3><a href="/kits-corporativos/">Kits corporativos</a></h3><p>Caixa, cartão e peças compostos para uma ocasião.</p></div></div>
      <div class="item">{arc()}<div><h3><a href="/ativacoes-promocionais-eventos-corporativos/">Ativações promocionais para eventos corporativos</a></h3><p>Ações em eventos, feiras e pontos de venda.</p></div></div>
      <div class="item">{arc()}<div><h3><a href="/hotelaria-e-gastronomia/">Hotelaria e gastronomia</a></h3><p>Cardápios, porta-contas, jogos americanos e uniformes.</p></div></div>
    </div>
  </div>
</section>
{process_section('Como trabalhamos', 'Da escolha das peças à entrega', 'A TaMa entende o objetivo, propõe as peças e coordena com os fornecedores a aplicação da sua marca, os materiais e a execução até a entrega.', 'como-t', cls='')}
<section class="section ivory" aria-labelledby="sustenta-t">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Nosso jeito</p><h2 id="sustenta-t" class="section-title">O que sustenta cada projeto</h2></div>
    <div class="cols-3">
      <div class="col">{arc('c1')}<h3>O público vem antes da peça</h3><p>Público, ocasião de uso e execução vêm antes da escolha de qualquer peça.</p></div>
      <div class="col">{arc('c2')}<h3>Seleção sob medida</h3><p>Peças alinhadas ao público, à ocasião e ao investimento, escolhidas para cada projeto.</p></div>
      <div class="col">{arc('c3')}<h3>Tudo em um pedido</h3><p>Brindes, kits, uniformes e materiais de ativação no mesmo pedido, com uma única linguagem.</p></div>
    </div>
  </div>
</section>
<section class="section question" aria-label="A pergunta que abre cada projeto">
  <div class="wrap"><p class="eyebrow light">Ponto de partida</p><blockquote>O que queremos que as pessoas lembrem da sua marca?</blockquote><p style="margin-top:16px;max-width:36rem">É a pergunta que abre cada projeto. A resposta orienta a seleção das peças, a personalização e a execução.</p></div>
</section>
<section class="manifesto" aria-labelledby="ed-t">
  <div class="wrap">
    <div class="manifesto-head">
      <p class="eyebrow light">O que nos move</p>
      <h2 id="ed-t">Marca não é o que se diz. <em>É o que fica.</em></h2>
      <p>Uma marca se constrói nos objetos que as pessoas escolhem manter por perto. É para esses momentos que a TaMa trabalha.</p>
    </div>
    <ol class="manifesto-cenas" role="list">
{sobre_cenas()}
    </ol>
    <div class="manifesto-fecho">
      <p>Por isso a TaMa começa pelo público e pela ocasião, e só depois escolhe a peça, a cor e o acabamento. A marca é da sua empresa; o cuidado para ela ficar é o nosso trabalho.</p>
      <p class="manifesto-nota">{NOTA_FICTICIA}</p>
    </div>
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
    tipos = [('brindes', 'Brindes corporativos'), ('kits', 'Kits corporativos'), ('confeccoes', 'Uniformes e confecções'),
             ('ativacoes', 'Ativações promocionais para eventos corporativos: buffet, decoração e ações'), ('hotelaria', 'Hotelaria e gastronomia'), ('integrado', 'Mais de uma área ou ainda não sei')]
    choices = ''.join(f'<label class="choice"><input type="radio" name="tipo" value="{v}" required> {t}</label>' for v, t in tipos)
    contacts = contact_lines()
    contact_block = f'<div class="stack" style="gap:10px"><p class="eyebrow">Fale direto</p><div class="contact-lines">{"".join(contacts)}</div></div>' if contacts else ''
    wa_retry = f'<a class="btn btn-line" href="https://wa.me/{WA}" data-wa-summary data-track="whatsapp_click" data-track-label="erro-envio" rel="noopener">{CHAT} Enviar pelo WhatsApp</a>' if WA else ''
    alt_contact = ' ou '.join(x for x in (WA and 'pelo WhatsApp', EMAIL and 'por e-mail') if x) or 'mais tarde'
    return {
        'path': '/solicitar-proposta/', 'title': 'Solicitar proposta de brindes, kits e uniformes | TaMa',
        'description': 'Peça uma proposta de brindes corporativos, kits ou uniformes. Conte a ocasião e a TaMa Creative propõe as possibilidades.',
        'trail': [('/', 'Início'), ('/solicitar-proposta/', 'Solicitar proposta')], 'wp_type': 'ContactPage',
        'body': text_head('Solicitar proposta', 'Vamos dar forma à sua ideia?', 'Conte a ocasião. A TaMa propõe as possibilidades. O formulário leva cerca de dois minutos.') + f'''
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
        <div class="field" id="picked-wrap" hidden><span class="field-label">Peças selecionadas</span><ul class="picked-list" id="picked-list" aria-label="Peças selecionadas por você"></ul><input type="hidden" name="selecao" id="f-selecao"><a class="link" href="/brindes-por-ocasiao/">Adicionar mais peças {ARROW}</a></div>
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
      {wa_button()}
    </aside>
  </div>
</section>''',
    }


def page_obrigado():
    return {
        'path': '/obrigado/', 'title': 'Pedido recebido | TaMa Creative', 'index': False,
        'description': 'Recebemos o seu pedido de proposta. A TaMa Creative responde pelo contato informado.',
        'body': text_head('Pedido enviado', 'Recebemos o seu pedido', 'Vamos responder pelo contato informado. Enquanto isso, veja o catálogo.',
                          actions='<a class="btn btn-wine" href="/catalogo/">Ver o catálogo</a><a class="btn btn-line" href="/">Voltar ao início</a>', cls='solo'),
    }


def page_privacidade():
    contato = EMAIL and f'pelo e-mail <a href="mailto:{esc(EMAIL)}">{esc(EMAIL)}</a>' or 'pelo formulário de <a href="/solicitar-proposta/">solicitação de proposta</a>'
    return {
        'path': '/privacidade/', 'title': 'Política de privacidade | TaMa Creative',
        'description': 'Como a TaMa Creative trata os dados enviados pelo formulário de proposta, conforme a Lei Geral de Proteção de Dados (LGPD).',
        'trail': [('/', 'Início'), ('/privacidade/', 'Privacidade')],
        'body': text_head('Privacidade', 'Política de privacidade',
                          'Como a TaMa Creative trata os dados enviados pelo formulário de proposta, conforme a Lei Geral de Proteção de Dados (LGPD).',
                          extra=f'<p class="text-head-meta">Atualizada em {blog.fmt_date(date.today())}.</p>') + f'''
<section class="section" style="padding-top:0"><div class="wrap" style="max-width:52rem"><div class="stack">
  {f'<h2 style="font-size:1.6rem">Quem é o responsável pelos dados</h2><p>{empresa_linha()}.</p>' if (RAZAO or CNPJ) else ''}
  <h2 style="font-size:1.6rem">Quais dados coletamos</h2><p>Apenas o que você informa no formulário de proposta: nome, empresa, e-mail ou WhatsApp, tipo de projeto, interesse, quantidade, data desejada, orçamento estimado, peças e cores de interesse e a descrição do objetivo. Junto com o pedido, o site envia a página de onde você veio, a primeira página visitada, o site de referência e os parâmetros de campanha (UTM) do link, quando existirem, para sabermos qual conteúdo gerou o pedido. Nada disso identifica você além do que você mesmo informou.</p>
  <h2 style="font-size:1.6rem">Para que usamos</h2><p>Para responder ao seu pedido e preparar a proposta. Não vendemos nem compartilhamos esses dados para fins de marketing de terceiros.</p>
  <h2 style="font-size:1.6rem">Com quem os dados são compartilhados</h2><ul style="padding-left:1.2em;display:grid;gap:6px"><li>O provedor de hospedagem do site, por onde o pedido passa.</li><li>A ferramenta de automação (n8n) que registra o pedido e avisa a equipe da TaMa por e-mail.</li><li>Ferramentas de gestão de clientes usadas pela TaMa para organizar e responder pedidos.</li>{"<li>Google Analytics, somente se você aceitar os cookies de análise.</li>" if GA4 else ""}</ul>
  <h2 style="font-size:1.6rem">Seleção de peças no navegador</h2><p>As peças que você seleciona ficam guardadas apenas no seu navegador até o envio do pedido, e são apagadas depois de um envio confirmado. A página de origem e os parâmetros de campanha ficam só na sessão do navegador e não são enviados a ferramentas de análise.</p>
  <h2 style="font-size:1.6rem" id="cookies">Cookies</h2><p>Na primeira visita, o site pergunta se você aceita cookies. Os <strong>essenciais</strong> funcionam sempre: guardam no seu navegador a seleção de peças e a sua escolha sobre cookies, e não identificam você. Os <strong>de análise</strong> (Google Analytics, com IP anonimizado) só são ativados se você clicar em "Aceitar todos", e servem para entender quais páginas são usadas. Não usamos cookies de publicidade.</p><p>Você pode mudar a escolha quando quiser: <button class="link-btn" type="button" data-consent-open>preferências de cookies</button>.</p>
  <h2 style="font-size:1.6rem">Por quanto tempo guardamos</h2><p>Pelo tempo necessário para tratar o pedido e manter o histórico comercial, ou até você pedir a exclusão.</p>
  <h2 style="font-size:1.6rem">Seus direitos</h2><p>Pela LGPD (Lei 13.709/2018), você pode pedir acesso, correção ou exclusão dos seus dados e revogar o consentimento a qualquer momento, {contato}.</p>
</div></div></section>''',
    }


def page_404():
    return {
        'path': '/404.html', 'title': 'Página não encontrada | TaMa Creative', 'index': False,
        'description': 'A página que você procurou não existe ou mudou de endereço.',
        'body': text_head('Erro 404', 'Esta página não existe ou mudou de lugar', 'O site da TaMa foi reorganizado. Comece por um destes caminhos:',
                          actions='<a class="btn btn-wine" href="/">Voltar ao início</a><a class="btn btn-line" href="/catalogo/">Ver o catálogo</a><a class="btn btn-line" href="/brindes-por-ocasiao/">Ver brindes por ocasião</a><a class="btn btn-line" href="/solicitar-proposta/">Solicitar proposta</a>', cls='solo'),
    }


PAGES = [page_home, page_catalogo, page_brindes, page_kits, page_ativacoes, page_hotelaria, page_fim_de_ano, page_curadoria, page_confeccoes, page_sobre,
 page_proposta, page_obrigado, page_privacidade, page_404]
PAGES += [lambda c=c: page_produto(c) for c in CATALOGO]   # uma página por modelo do catálogo (/catalogo/<nome>/)


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
        '/brindes            /brindes-corporativos/          301',   # igual ao nginx e ao #brindes do site.js
        '/brindes/*          /catalogo/                      301',
        '/adm                /admin/                         301',
        '/kits               /kits-corporativos/             301',
        '/curadoria          /brindes-por-ocasiao/  301',
        '/brindes-corporativos-premium/*  /brindes-por-ocasiao/  301',   # endereço antigo da página de ocasiões (a consulta ?ocasiao= é mantida)
        '/confeccoes         /confeccoes-personalizadas/     301',
        '/uniformes          /confeccoes-personalizadas/     301',
        '/marcas             /catalogo/                      301',   # igual ao nginx e ao #marcas do site.js
        '/branding           /                               301',
        '/branding-identidade-visual/*  /                    301',
        '/ativacoes          /ativacoes-promocionais-eventos-corporativos/        301',
        '/degustacao         /ativacoes-promocionais-eventos-corporativos/        301',
        '/ativacoes-promocionais/  /ativacoes-promocionais-eventos-corporativos/  301',   # endereço antigo da página (até 24/10/2026)
        '/hotelaria          /hotelaria-e-gastronomia/       301',
        '/gastronomia        /hotelaria-e-gastronomia/       301',
        '/fim-de-ano         /brindes-de-fim-de-ano/         301',
        '/natal              /brindes-de-fim-de-ano/         301',
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
    conferir_imagens_site()
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
