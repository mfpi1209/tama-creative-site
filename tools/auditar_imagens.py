"""Confere as fotos do banco (src/data/produtos.json) e gera folhas de contato para revisão visual.

Mede, em cada foto: a cor da peça × a cor declarada (ΔE em Lab, entre as 3 cores mais presentes da peça), a cor do fundo
nos cantos (padrão #FBF8F5) e a área ocupada pela peça. Lista o que passa dos limites e grava folhas de contato com o
id, o nome e a bolinha da cor declarada de cada foto (para conferir logo, cor e produto a olho).
Peças brancas, transparentes ou muito finas (canetas) podem dar aviso de cor falso: confira na folha de contato.

Uso:
  python -I tools/auditar_imagens.py [--saida midia/produtos/auditoria] [--de 15]
Ver docs/AUDITORIA-IMAGENS.md (regra do logo, lista de correções e prompts).
"""
import argparse, collections, json, math, os, re

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUNDO = (251, 248, 245)


def lab(rgb):
    def f(c):
        c /= 255
        return ((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92
    r, g, b = (f(x) for x in rgb)
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    t = lambda v: v ** (1 / 3) if v > 0.008856 else 7.787 * v + 16 / 116
    return 116 * t(y) - 16, 500 * (t(x) - t(y)), 200 * (t(y) - t(z))


def de(a, b):
    return math.dist(lab(a), lab(b))


def hexrgb(h):
    return tuple(int(h.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))


def medir(e):
    im = Image.open(os.path.join(ROOT, e['arquivo'].lstrip('/'))).convert('RGB').resize((128, 128))
    px = list(im.getdata())
    cantos = [im.getpixel((x, y)) for x in (2, 125) for y in (2, 125)]
    fundo = tuple(sum(c[i] for c in cantos) / 4 for i in range(3))
    peca = [p for p in px if de(p, fundo) > 12]
    grupos = collections.Counter((p[0] // 24, p[1] // 24, p[2] // 24) for p in peca).most_common(3)
    medias = []
    for k, _ in grupos:
        sel = [p for p in peca if (p[0] // 24, p[1] // 24, p[2] // 24) == k]
        medias.append(tuple(sum(c[i] for c in sel) / len(sel) for i in range(3)))
    decl = hexrgb(e['cor']['hex'])
    return {'delta': min((de(m, decl) for m in medias), default=None), 'fundo': fundo, 'area': len(peca) / len(px)}


def folhas(itens, saida):
    try:
        fonte = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 13)
    except OSError:
        fonte = ImageFont.load_default()
    t, cols, linhas = 220, 6, 5
    for s in range(0, len(itens), cols * linhas):
        folha = Image.new('RGB', (cols * t, linhas * (t + 44)), 'white')
        d = ImageDraw.Draw(folha)
        for k, e in enumerate(itens[s:s + cols * linhas]):
            x, y = (k % cols) * t, (k // cols) * (t + 44)
            im = Image.open(os.path.join(ROOT, e['arquivo'].lstrip('/'))).convert('RGB')
            im.thumbnail((t - 6, t - 6))
            folha.paste(im, (x + 3, y + 3))
            d.rectangle([x + 3, y + t, x + 21, y + t + 18], fill=e['cor']['hex'], outline='black')
            d.text((x + 25, y + t + 1), e['cor']['nome'], fill='black', font=fonte)
            d.text((x + 3, y + t + 22), e['id'][:34], fill='#555', font=fonte)
        folha.save(os.path.join(saida, f'folha{s // (cols * linhas) + 1:02d}.jpg'), quality=82)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--saida', default=os.path.join(ROOT, 'midia', 'produtos', 'auditoria'))
    ap.add_argument('--de', type=float, default=15, help='ΔE máximo entre a cor declarada e a cor da foto')
    a = ap.parse_args()
    itens = json.load(open(os.path.join(ROOT, 'src', 'data', 'produtos.json'), encoding='utf-8'))['imagens']
    itens = [e for e in itens if e.get('aprovacao') not in ('retirada', 'substituir') and e.get('arquivo')]
    itens.sort(key=lambda e: (e['categoria'], e['produto'], e['id']))
    os.makedirs(a.saida, exist_ok=True)
    avisos = []
    for e in itens:
        if not re.fullmatch(r'#[0-9A-Fa-f]{6}', e['cor'].get('hex') or ''):
            avisos.append(f"{e['id']}: cor sem hexadecimal"); continue
        m = medir(e)
        if m['delta'] is not None and m['delta'] > a.de:
            avisos.append(f"{e['id']}: cor da foto longe da declarada {e['cor']['hex']} (ΔE {m['delta']:.0f})")
        if sum(abs(m['fundo'][i] - FUNDO[i]) for i in range(3)) > 36:
            avisos.append(f"{e['id']}: fundo fora do padrão (#%02X%02X%02X)" % tuple(int(v) for v in m['fundo']))
        if m['area'] > 0.65:
            avisos.append(f"{e['id']}: peça ocupa {m['area']:.0%} da foto (enquadramento apertado)")
    folhas(itens, a.saida)
    print('\n'.join(avisos) or 'nenhum aviso')
    print(f'{len(itens)} fotos · {len(avisos)} aviso(s) · folhas de contato em {os.path.relpath(a.saida, ROOT)}/')


if __name__ == '__main__':
    main()
