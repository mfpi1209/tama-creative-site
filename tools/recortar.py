"""Recorta fotos de produto do banco (img/produtos/*.webp, fundo de estúdio claro e liso) em WebP com transparência,
para as cenas em que o produto aparece solto sobre o fundo do site (abertura da home, troca de cor).

Uso (fora do build; os recortes vão para img/recortes/ e entram no commit):
    pip install numpy scipy        # só para esta ferramenta
    python tools/recortar.py garrafa-termica~azul-royal garrafa-termica~preto ...
    python tools/recortar.py --folha   # também grava midia/recortes-folha.png (conferência sobre fundos claro e escuro)

Como funciona: a cor do fundo é a mediana da borda da foto; só o fundo ligado à borda sai (um branco dentro do produto,
como a marca impressa, fica). A transição usa um degrau suave pela distância da cor, e a cor da borda é "descontaminada"
do fundo (sem halo claro). A sombra de chão da foto sai junto com o fundo: o site desenha a sua própria sombra.
Nada é recolorido nem redesenhado: a foto é a mesma, só sem o fundo.
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'img', 'produtos')
OUT = os.path.join(ROOT, 'img', 'recortes')

T_IN, T_OUT = 7.0, 30.0   # distância de cor (0–255): abaixo de T_IN é fundo; acima de T_OUT é produto


def recortar(nome):
    im = np.asarray(Image.open(os.path.join(SRC, nome + '.webp')).convert('RGB')).astype(np.float32)
    h, w, _ = im.shape
    borda = np.concatenate([im[:6].reshape(-1, 3), im[-6:].reshape(-1, 3), im[:, :6].reshape(-1, 3), im[:, -6:].reshape(-1, 3)])
    bg = np.median(borda, axis=0)
    suave = ndimage.uniform_filter(im, size=(3, 3, 1))
    dist = np.abs(suave - bg).max(axis=2)
    # fundo = região abaixo de T_OUT ligada à borda (o branco da marca, dentro da peça, não encosta na borda)
    perto = dist < T_OUT
    rot, _ = ndimage.label(perto)
    ids = np.unique(np.concatenate([rot[0], rot[-1], rot[:, 0], rot[:, -1]]))
    fundo = np.isin(rot, ids[ids > 0])
    a = np.ones((h, w), np.float32)
    rampa = np.clip((dist - T_IN) / (T_OUT - T_IN), 0, 1)
    a[fundo] = rampa[fundo]
    # sombra de chão: na faixa da base da peça, cinza claro e neutro (pouca saturação) é sombra e sai; a peça colorida ou
    # escura fica inteira, com a base arredondada (nada é cortado por linha ou coluna)
    lum = im.mean(axis=2)
    sat = im.max(axis=2) - im.min(axis=2)
    corpo = ndimage.binary_opening(a > .98, iterations=2)
    linhas = np.where(corpo.any(axis=1))[0]
    if linhas.size:
        base = linhas.max()
        faixa = np.zeros((h, w), bool)
        faixa[max(0, base - int(h * .1)):] = True
        sombra = faixa & (sat < 22) & (lum > 78)
        a[sombra] = 0
        # o que sobrar ligado à peça só por fiapos (resto de sombra) sai: fica o maior bloco sólido
        rot, n = ndimage.label(a > .5)
        if n > 1:
            maior = np.argmax(ndimage.sum(np.ones_like(a), rot, range(1, n + 1))) + 1
            a[(rot > 0) & (rot != maior)] = 0
    a = ndimage.gaussian_filter(a, .6)
    a[a < .02] = 0
    # descontamina a borda: cor = (pixel - fundo × (1 - a)) / a
    aa = np.clip(a, 1e-3, 1)[..., None]
    cor = np.clip((im - bg * (1 - aa)) / aa, 0, 255)
    cor = np.where(aa > .995, im, cor)
    rgba = np.dstack([cor, a * 255]).astype(np.uint8)
    out = Image.fromarray(rgba, 'RGBA')
    caixa = out.getbbox()
    if caixa:   # margem de 4 % em volta da peça, centralizada
        m = int(max(w, h) * .04)
        x0, y0, x1, y1 = max(0, caixa[0] - m), max(0, caixa[1] - m), min(w, caixa[2] + m), min(h, caixa[3] + m)
        out = out.crop((x0, y0, x1, y1))
    os.makedirs(OUT, exist_ok=True)
    out.save(os.path.join(OUT, nome + '.webp'), 'WEBP', quality=90, method=6, exact=True)
    return out


def folha(recs):
    cel = 260
    sheet = Image.new('RGB', (cel * len(recs), cel * 2), (238, 240, 243))
    sheet.paste((23, 25, 28), (0, cel, sheet.width, sheet.height))
    for i, r in enumerate(recs):
        t = r.copy()
        t.thumbnail((cel - 20, cel - 20))
        for row in (0, 1):
            sheet.paste(t, (i * cel + (cel - t.width) // 2, row * cel + (cel - t.height) // 2), t)
    os.makedirs(os.path.join(ROOT, 'midia'), exist_ok=True)
    sheet.save(os.path.join(ROOT, 'midia', 'recortes-folha.png'))


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    recs = [recortar(n) for n in args]
    if '--folha' in sys.argv and recs:
        folha(recs)
    print(f'{len(recs)} recorte(s) em img/recortes/')
