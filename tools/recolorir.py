"""Variações de cor locais (sem API): recolore uma foto nova (verso, detalhe do bordado, outro ângulo) para as outras
cores do produto, usando como alvo a cor medida no tecido da foto de frente de cada cor que já está no banco.

Como funciona: separa a peça do fundo creme e do bordado/estampa claros, mede a cor do tecido (média e variação em Lab)
na foto nova e na foto de frente de cada cor, e transfere essa distribuição (Reinhard) só para o tecido. Sombras, dobras,
textura e o bordado ficam como estão. Cores muito claras (branco, cru, creme) não são feitas aqui: o bordado branco
some no tecido claro e o logo precisa mudar para as cores oficiais; gere essas pela API.

Cores claras com bordado (close do bordado): puladas, gere pela API. Verso branco sem logo: feito pelo código da cor.
Requer numpy (fora do requirements do site): python3 -m venv .venv-tools && .venv-tools/bin/pip install numpy pillow
Uso:
  python tools/recolorir.py <foto-nova.png> --base polo~vermelho --sufixo verso [--sem-fundo] [--cores azul-marinho,preto] [--saida midia/produtos/geradas]
  --base     id da foto de frente na mesma cor da foto nova (o produto e as outras cores saem do banco)
  --sufixo   vista da foto nova: verso, bordado, angulo…  (saída: <produto>~<cor>-<sufixo>.png)
  --sem-fundo  foto sem fundo creme (close do bordado: o quadro inteiro é tecido)
Depois: confira as imagens, importe com tools/produtos.py importar --id <produto>~<cor>-<sufixo> e marque a vista no /admin/.
"""
import argparse, json, os, sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def rgb2lab(rgb):
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def lab2rgb(lab):
    fy = (lab[..., 0] + 16) / 116
    fx, fz = fy + lab[..., 1] / 500, fy - lab[..., 2] / 200
    f = np.stack([fx, fy, fz], -1)
    xyz = np.where(f > 0.2069, f ** 3, (f - 16 / 116) / 7.787) * np.array([0.95047, 1.0, 1.08883])
    m = np.array([[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]])
    c = xyz @ m.T
    c = np.where(c > 0.0031308, 1.055 * np.clip(c, 0, None) ** (1 / 2.4) - 0.055, 12.92 * c)
    return np.clip(c * 255, 0, 255)


def pesos(lab, sem_fundo, matiz=False):
    """Peso 0–1 de "tecido" por pixel: fora do fundo creme e fora do bordado/estampa (claro e pouco saturado num tecido
    colorido; claro num tecido neutro). Com matiz=True, só o que tem o mesmo tom do tecido (fivela de metal, etiqueta e
    o forro escuro ficam como estão)."""
    h, w, _ = lab.shape
    if sem_fundo:
        tecido = np.ones((h, w))
    else:
        cantos = np.concatenate([lab[:12, :12].reshape(-1, 3), lab[:12, -12:].reshape(-1, 3), lab[-12:, :12].reshape(-1, 3), lab[-12:, -12:].reshape(-1, 3)])
        d = np.linalg.norm(lab - cantos.mean(0), axis=-1)
        tecido = np.clip((d - 10) / 10, 0, 1)
    sel = tecido > 0.9
    if sel.mean() < 0.02:
        return tecido
    L, C = lab[..., 0], np.hypot(lab[..., 1], lab[..., 2])
    medL, medC = np.median(L[sel]), np.median(C[sel])
    if medC > 15:   # tecido colorido: o logo branco/claro é o que tem pouca saturação
        claro = np.clip((0.55 * medC - C) / (0.15 * medC), 0, 1) * np.clip((L - medL - 5) / 8, 0, 1)
    else:           # tecido neutro (preto, cinza, branco): o logo é bem mais claro ou bem mais escuro
        claro = np.clip((np.abs(L - medL) - 22) / 6, 0, 1)
    w = tecido * (1 - claro)
    if matiz and medC > 15:
        h = np.arctan2(lab[..., 2], lab[..., 1])
        h0 = np.arctan2(np.median(lab[..., 2][sel]), np.median(lab[..., 1][sel]))
        dh = np.abs((h - h0 + np.pi) % (2 * np.pi) - np.pi)
        w = w * np.clip((0.7 - dh) / 0.3, 0, 1) * np.clip((C - 0.35 * medC) / (0.15 * medC), 0, 1)
    return w


def stats(lab, w):
    sel = w > 0.9
    px = lab[sel]
    return px.mean(0), px.std(0) + 1e-6


def recolorir(base_img, alvo_frente, hex_alvo, sem_fundo):
    lab = rgb2lab(np.asarray(base_img.convert('RGB'), dtype=np.float64))
    w = pesos(lab, sem_fundo, matiz=not sem_fundo)   # no close do bordado o quadro é só tecido: o filtro de tom criaria faixas nos reflexos
    mu_s, sd_s = stats(lab, w)
    lab_t = rgb2lab(np.asarray(alvo_frente.convert('RGB').resize((512, 512)), dtype=np.float64))
    w_t = pesos(lab_t, False)
    if (w_t > 0.9).mean() > 0.12:
        mu_t, sd_t = stats(lab_t, w_t)
    else:   # peça clara que se confunde com o fundo: usa o código da cor, com a textura da foto nova
        h = hex_alvo.lstrip('#')
        mu_t = rgb2lab(np.array([[int(h[i:i + 2], 16) for i in (0, 2, 4)]], dtype=np.float64))[0]
        sd_t = sd_s * np.array([0.6, 0.3, 0.3])
    # transferência em LCh: luminosidade com média e contraste do alvo; saturação na proporção do alvo; tom fixo no do
    # alvo (com pouca variação). Mudar o tom canal a canal (a, b) criaria faixas de cor intermediária nos reflexos.
    C = np.hypot(lab[..., 1], lab[..., 2]); h = np.arctan2(lab[..., 2], lab[..., 1])
    sel = w > 0.9
    C_s = np.hypot(mu_s[1], mu_s[2]) + 1e-6; h_s = np.arctan2(mu_s[2], mu_s[1])
    C_t = np.hypot(mu_t[1], mu_t[2]); h_t = np.arctan2(mu_t[2], mu_t[1])
    kL = np.clip(sd_t[0] / sd_s[0], 0.5, 1.5)
    L2 = (lab[..., 0] - mu_s[0]) * kL + mu_t[0]
    C2 = C * (C_t / C_s)
    dh = (h - h_s + np.pi) % (2 * np.pi) - np.pi
    h2 = h_t + 0.25 * dh
    novo = np.stack([L2, C2 * np.cos(h2), C2 * np.sin(h2)], -1)
    out = lab2rgb(novo) * w[..., None] + np.asarray(base_img.convert('RGB'), dtype=np.float64) * (1 - w[..., None])
    return Image.fromarray(out.round().astype(np.uint8)), float(mu_t[0])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('imagem'); ap.add_argument('--base', required=True); ap.add_argument('--sufixo', required=True)
    ap.add_argument('--sem-fundo', action='store_true'); ap.add_argument('--cores', default='')
    ap.add_argument('--saida', default=os.path.join(ROOT, 'midia', 'produtos', 'geradas'))
    a = ap.parse_args()
    banco = json.load(open(os.path.join(ROOT, 'src', 'data', 'produtos.json'), encoding='utf-8'))['imagens']
    prefixo = a.base.split('~')[0]
    frentes = [e for e in banco if e['id'].split('~')[0] == prefixo and (e.get('vista') or 'frente') == 'frente' and e['id'] != a.base
               and e.get('aprovacao') not in ('retirada', 'substituir')]
    if a.cores:
        quero = set(a.cores.split(','))
        frentes = [e for e in frentes if e['id'].split('~')[1] in quero]
    if not frentes:
        sys.exit(f'nenhuma outra cor de {prefixo} no banco')
    os.makedirs(a.saida, exist_ok=True)
    base = Image.open(a.imagem)
    for e in frentes:
        cor = e['id'].split('~')[1]
        alvo = Image.open(os.path.join(ROOT, e['arquivo'].lstrip('/')))
        img, L = recolorir(base, alvo, e['cor']['hex'], a.sem_fundo)
        if L > 85 and a.sufixo != 'verso':   # peça clara com logo: o bordado branco some; gere pela API
            print(f'pulada: {cor} (cor clara: gere pela API, com o logo nas cores oficiais)'); continue
        dest = os.path.join(a.saida, f'{prefixo}~{cor}-{a.sufixo}.png')
        img.save(dest)
        print(os.path.relpath(dest, ROOT) if dest.startswith(ROOT) else dest)


if __name__ == '__main__':
    main()
