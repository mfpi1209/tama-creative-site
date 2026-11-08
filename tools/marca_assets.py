"""Gera os arquivos da proposta de rebrand (docs/rebrand/): assinatura "TaMa.", símbolo do arco, lockups e paletas,
em SVG com o texto convertido em contorno (abre sem a fonte instalada) e em PNG grande com fundo transparente.

Uso:  pip install fonttools brotli   (só para esta ferramenta; resvg-py já está em requirements.txt)
      python tools/marca_assets.py

A fonte é a Manrope do próprio site (src/fonts/manrope-latin.woff2, variável), instanciada no peso de cada texto.
São arquivos de proposta: o logotipo final deve ser ajustado (espaçamento ótico, kerning) por um designer de marcas.
"""
import io
import os

import resvg_py
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTE = os.path.join(ROOT, 'src', 'fonts', 'manrope-latin.woff2')
OUT = os.path.join(ROOT, 'docs', 'rebrand')
ARC = 'M0 0A100 100 0 0 0 100 100Z'   # o arco do logotipo oficial (build.py › ARC), em caixa de 100 × 100

TINTA, BORDO, BORDO_CLARO, BRANCO = '#17191C', '#76263E', '#E8A9BB', '#FFFFFF'
CORAL, AMEIXA = '#C2391F', '#4A2338'

_cache = {}


def fonte(peso):
    if peso not in _cache:
        f = TTFont(FONTE)
        _cache[peso] = instantiateVariableFont(f, {'wght': peso}, inplace=False)
    return _cache[peso]


def texto(s, peso, tamanho, x, y, tracking=0.0):
    """Contorno do texto s (linha de base em y), com tracking em em. Devolve (path d, largura)."""
    f = fonte(peso)
    upm = f['head'].unitsPerEm
    cmap, gs, hmtx = f.getBestCmap(), f.getGlyphSet(), f['hmtx']
    k = tamanho / upm
    d, cx = [], x
    for ch in s:
        g = cmap.get(ord(ch))
        if g is None:
            continue
        pen = SVGPathPen(gs)
        gs[g].draw(TransformPen(pen, (k, 0, 0, -k, cx, y)))
        d.append(pen.getCommands())
        cx += hmtx[g][0] * k + tracking * tamanho
    return ' '.join(d), cx - x - tracking * tamanho


def assinatura(cor_ta, cor_ma, cor_sub, x=0, y=0, tam=200):
    """'Ta' + 'Ma.' em Manrope 800 (tracking -0,055 em) e 'CREATIVE' em 700 (0,3 do tamanho, tracking 0,42 em).
    Devolve (svg interno, largura, altura) com a origem no canto superior esquerdo."""
    base = y + tam * 0.74
    d1, w1 = texto('Ta', 800, tam, x, base, -0.055)
    d2, w2 = texto('Ma.', 800, tam, x + w1 - 0.055 * tam, base, -0.055)
    sub = tam * 0.3
    d3, w3 = texto('CREATIVE', 700, sub * 0.6, x + tam * 0.02, base + tam * 0.18 + sub * 0.55, 0.42)
    w = max(w1 + w2 - 0.055 * tam, w3)
    h = tam * 0.74 + tam * 0.18 + sub * 0.55
    g = f'<path d="{d1}" fill="{cor_ta}"/><path d="{d2}" fill="{cor_ma}"/><path d="{d3}" fill="{cor_sub}"/>'
    return g, w, h


def arco(cor, x, y, lado):
    k = lado / 100
    return f'<path d="{ARC}" fill="{cor}" transform="translate({x:.2f} {y:.2f}) scale({k:.4f})"/>'


def svg(conteudo, w, h, fundo=None, margem=0):
    W, H = w + 2 * margem, h + 2 * margem
    bg = f'<rect width="{W:.0f}" height="{H:.0f}" fill="{fundo}"/>' if fundo else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.0f} {H:.0f}" width="{W:.0f}" height="{H:.0f}">'
            f'{bg}<g transform="translate({margem} {margem})">{conteudo}</g></svg>')


def salvar(nome, s, largura_png=3000):
    base = os.path.join(OUT, nome)
    os.makedirs(os.path.dirname(base), exist_ok=True)
    open(base + '.svg', 'w', encoding='utf-8').write(s)
    open(base + '.png', 'wb').write(bytes(resvg_py.svg_to_bytes(svg_string=s, width=largura_png)))


def logos():
    m = 40
    # Direção A: assinatura (positivo, negativo, monocromáticas)
    for nome, ta, ma, sub in [('a-assinatura-positivo', TINTA, BORDO, TINTA), ('a-assinatura-negativo', BRANCO, BORDO_CLARO, BRANCO),
                              ('a-assinatura-tinta', TINTA, TINTA, TINTA), ('a-assinatura-branca', BRANCO, BRANCO, BRANCO)]:
        g, w, h = assinatura(ta, ma, sub)
        salvar(f'logos/{nome}', svg(g, w, h, margem=m))
    # Recomendado (A com o arco): símbolo e lockups
    salvar('logos/recomendado-simbolo-arco-bordo', svg(arco(BORDO, 0, 0, 400), 400, 400, margem=m), 2000)
    salvar('logos/recomendado-simbolo-arco-branco', svg(arco(BRANCO, 0, 0, 400), 400, 400, margem=m), 2000)
    for nome, ta, ma, sub, cor_arco in [('recomendado-lockup-positivo', TINTA, BORDO, TINTA, BORDO), ('recomendado-lockup-negativo', BRANCO, BORDO_CLARO, BRANCO, BORDO_CLARO)]:
        g, w, h = assinatura(ta, ma, sub, x=200 * 0.74 + 60)
        lado = 200 * 0.74
        salvar(f'logos/{nome}', svg(arco(cor_arco, 0, 0, lado) + g, w + lado + 60, h, margem=m))
    # favicon/avatar (A + arco): arco bordô sobre papel
    salvar('logos/recomendado-avatar', svg(f'<rect width="512" height="512" rx="112" fill="{BRANCO}"/>' + arco(BORDO, 112, 112, 288), 512, 512), 1024)
    # Direção B: nome em ameixa, "Ma" coral e o arco coral
    g, w, h = assinatura(AMEIXA, CORAL, AMEIXA, x=200 * 0.74 + 60)
    salvar('logos/b-lockup-arco-coral', svg(arco(CORAL, 0, 0, 200 * 0.74) + g, w + 200 * 0.74 + 60, h, margem=m))
    # Direção C: o ponto muda de cor por coleção
    for nome, cor in [('azul', '#2447CB'), ('vermelho', '#C8202F'), ('verde', '#1F6B45'), ('laranja', '#B8520F'), ('marinho', '#1E2A4A')]:
        g, w, h = assinatura(TINTA, cor, TINTA)
        salvar(f'logos/c-assinatura-{nome}', svg(g, w, h, margem=m))


def contraste(a, b):
    def L(hx):
        c = [int(hx[i:i + 2], 16) / 255 for i in (1, 3, 5)]
        c = [x / 12.92 if x <= .03928 else ((x + .055) / 1.055) ** 2.4 for x in c]
        return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]
    la, lb = L(a), L(b)
    return (max(la, lb) + .05) / (min(la, lb) + .05)


PALETAS = {
    'a-objeto-em-foco': ('Direção A · Objeto em foco', [('Papel', '#FFFFFF', 'fundo'), ('Névoa', '#F4F6F8', 'superfícies'), ('Tinta', '#17191C', 'texto'),
                                                         ('Grafite', '#59616C', 'texto de apoio'), ('Bordô TaMa', '#76263E', 'assinatura e ação'), ('Bordô claro', '#E8A9BB', 'sobre fundo escuro')]),
    'b-o-arco': ('Direção B · O arco', [('Papel', '#FFFFFF', 'fundo'), ('Névoa', '#F4F6F8', 'superfícies'), ('Tinta', '#17191C', 'texto'),
                                        ('Coral TaMa', '#C2391F', 'o arco e a ação'), ('Ameixa', '#4A2338', 'institucional'), ('Coral claro', '#F7E3DE', 'fundos de destaque')]),
    'c-paleta-viva': ('Direção C · Paleta viva', [('Tinta', '#17191C', 'a marca'), ('Papel', '#FFFFFF', 'fundo'), ('Azul', '#2447CB', 'garrafas e copos'),
                                                  ('Vermelho', '#C8202F', 'vestuário'), ('Verde', '#1F6B45', 'kits'), ('Laranja', '#B8520F', 'cozinha e bar'),
                                                  ('Marinho', '#1E2A4A', 'escritório'), ('Bordô', '#76263E', 'institucional')]),
}


def paletas():
    for chave, (titulo, cores) in PALETAS.items():
        cw, ch, gap, top = 300, 420, 24, 150
        n = len(cores)
        W = 80 + n * cw + (n - 1) * gap
        H = top + ch + 80
        dt, _ = texto(titulo, 800, 52, 40, 96, -0.03)
        partes = [f'<rect width="{W}" height="{H}" fill="#FFFFFF"/>', f'<path d="{dt}" fill="{TINTA}"/>']
        for i, (nome, hx, uso) in enumerate(cores):
            x = 40 + i * (cw + gap)
            partes.append(f'<rect x="{x}" y="{top}" width="{cw}" height="{ch}" rx="22" fill="#FFFFFF" stroke="#E1E5EA" stroke-width="2"/>')
            partes.append(f'<path d="M{x + 22} {top}h{cw - 44}a22 22 0 0 1 22 22v218h-{cw}v-218a22 22 0 0 1 22-22z" fill="{hx}"' + (' stroke="#E1E5EA" stroke-width="2"' if hx.upper() in ('#FFFFFF', '#F4F6F8', '#F7E3DE') else '') + '/>')
            for txt, peso, tam, yy, cor in [(nome, 700, 30, top + 290, TINTA), (hx.upper(), 600, 24, top + 330, '#59616C'), (uso, 500, 22, top + 366, '#59616C')]:
                d, _ = texto(txt, peso, tam, x + 22, yy)
                partes.append(f'<path d="{d}" fill="{cor}"/>')
            melhor = max(contraste(hx, '#FFFFFF'), contraste(hx, TINTA))
            sobre = 'sobre branco' if contraste(hx, '#FFFFFF') >= contraste(hx, TINTA) else 'sobre tinta'
            d, _ = texto(f'{melhor:.1f}:1 {sobre}', 500, 20, x + 22, top + 398)
            partes.append(f'<path d="{d}" fill="#59616C"/>')
        s = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">{"".join(partes)}</svg>'
        salvar(f'paletas/paleta-{chave}', s, 4000)


if __name__ == '__main__':
    logos()
    paletas()
    print('arquivos em', os.path.relpath(OUT, ROOT))
