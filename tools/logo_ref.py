"""Imagens de referência da assinatura "pétala" para a API de imagens (o modelo enxerga mal um logo branco sobre
transparente): 'branco' = logo todo branco sobre grafite; 'positivo' = cores oficiais sobre branco. Geradas a partir de
brand/petala/ (tools/marca_assets.py petala) em midia/marca-ref/ (fora do Git)."""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASTA = os.path.join(ROOT, 'midia', 'marca-ref')


def referencia(tipo):
    from PIL import Image
    dest = os.path.join(PASTA, f'logo-{tipo}.png')
    if os.path.exists(dest):
        return dest
    os.makedirs(PASTA, exist_ok=True)
    src = os.path.join(ROOT, 'brand', 'petala', 'lockup-branco.png' if tipo == 'branco' else 'lockup-positivo.png')
    logo = Image.open(src).convert('RGBA')
    logo.thumbnail((1200, 1200))
    fundo = (31, 35, 40, 255) if tipo == 'branco' else (255, 255, 255, 255)
    tela = Image.new('RGBA', (1536, 1024), fundo)
    tela.alpha_composite(logo, ((1536 - logo.width) // 2, (1024 - logo.height) // 2))
    tela.convert('RGB').save(dest)
    return dest
