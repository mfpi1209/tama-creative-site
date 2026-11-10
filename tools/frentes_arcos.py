"""Prepara as 5 fotos dos arcos da seção "Cinco frentes" (briefing de 10/11/2026, paleta intensa: azul-petróleo,
terracota, dourado, verde-profundo e rosa-antigo) a partir das imagens enviadas pela TaMa em midia/frentes-arcos/.

As imagens enviadas já vêm com o arco desenhado (cantos em off-white) e com sobras das fotos vizinhas nas laterais.
Este script só RECORTA cada foto por dentro do arco desenhado, na proporção do arco do site (3:5), de modo que o arco do
CSS (raio = metade da largura, tangente ao topo) fique inteiro sobre a fotografia. Não altera cor, contraste nem
conteúdo. Para trocar uma foto pela versão final em alta, basta salvar um arquivo sem arco desenhado em
img/v2/home-frente-<frente>-v4.webp (3:5, ≥ 900 × 1500) ou apontar outra imagem em site.json › secoes › home-frentes.

Uso: python -I tools/frentes_arcos.py      (lê midia/frentes-arcos/0N-*.webp, grava img/v2/home-frente-<frente>-v4.webp)
"""
import os, math, statistics
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIG = os.path.join(ROOT, 'midia', 'frentes-arcos')
WEB = os.path.join(ROOT, 'img', 'v2')
ARQS = {'brindes': '01-brindes-corporativos.webp', 'confeccoes': '02-uniformes-confeccoes.webp', 'kits': '03-kits-corporativos.webp',
        'eventos': '04-eventos-corporativos.webp', 'hotelaria': '05-hotelaria-gastronomia.webp'}
PROPORCAO = 3 / 5   # largura / altura do .tm-front-media
FOLGA = 2           # px entre o arco do CSS e o arco desenhado


def preparar(nome):
    im = Image.open(os.path.join(ORIG, ARQS[nome])).convert('RGB')
    w, h = im.size
    px = im.load()
    bg = px[2, 2]   # o off-white em volta do arco desenhado
    def fundo(x, y):
        c = px[x, y]
        return sum(abs(c[i] - bg[i]) for i in range(3)) < 24
    # arco desenhado: círculo tangente ao topo, ajustado pela largura das linhas de cima
    raios, centros = [], []
    for y in range(8, 70, 2):
        l = next(x for x in range(w) if not fundo(x, y))
        r = next(x for x in range(w - 1, -1, -1) if not fundo(x, y))
        mw = (r - l + 1) / 2
        raios.append((mw * mw + y * y) / (2 * y)); centros.append((l + r + 1) / 2)
    R, cx = statistics.median(raios), statistics.median(centros)
    # bordas do corpo do arco nas linhas de baixo: uma sobra vizinha (até 25 px) fica separada do corpo por uma faixa de fundo
    def borda(y, xs):
        xs = list(xs)
        if fundo(xs[0], y) or not any(fundo(x, y) for x in xs[:25]):
            return next(x for x in xs if not fundo(x, y))
        i = next(i for i, x in enumerate(xs[:25]) if fundo(x, y))
        return next(x for x in xs[i:] if not fundo(x, y))
    linhas = range(200, h - 6, 20)
    bl = max(borda(y, range(w)) for y in linhas) + 2
    br = min(borda(y, range(w - 1, -1, -1)) for y in linhas) - 2
    base = 4   # cantos de baixo levemente arredondados no desenho
    for topo in range(2, 80):
        alt = h - topo - base
        larg = round(alt * PROPORCAO)
        x0 = min(max(round(cx - larg / 2), bl), br - larg)
        rr = larg / 2
        if x0 >= bl and math.hypot(x0 + rr - cx, topo + rr - R) + rr <= R - FOLGA:
            break
    else:
        raise SystemExit(f'{nome}: não coube um arco 3:5 dentro do arco desenhado')
    out = im.crop((x0, topo, x0 + larg, topo + alt))
    out.save(os.path.join(WEB, f'home-frente-{nome}-v4.webp'), 'WEBP', lossless=True, method=6)
    return f'{nome}: {w}×{h} → {out.width}×{out.height} (x {x0}, topo {topo})'


if __name__ == '__main__':
    for n in ARQS:
        print(preparar(n))
