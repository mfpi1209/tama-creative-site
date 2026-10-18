"""Refaz a logo de fotos do banco (logo grande demais ou versão errada) com a API de imagens da OpenAI.

Edita o original (midia/produtos/mestre/<id>.png) passando o logo oficial como segunda imagem; o produto, a cor, o ângulo e
o fundo ficam iguais. Depois importe com: python -I tools/produtos.py importar midia/produtos/geradas/<id>.png --id <id>
A chave vem de OPENAI_API_KEY ou ~/.config/tama/openai.env.

Uso:
  python -I tools/logo_ajuste.py menor <id> [<id> ...] --logo <logo.png>     logo proporcional (~1/3 da largura da peça)
  python -I tools/logo_ajuste.py oficial <id> [<id> ...] --logo <logo.png>   troca uma logo errada pela oficial, discreta (couro)
  python -I tools/logo_ajuste.py fiel <id> [<id> ...] --logo <logo.png>      mesma posição e tamanho, com o desenho e as cores oficiais
"""
import argparse, json, os, sys, time, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import variacoes  # noqa: E402

BASE = ('Edit the first image, a catalog product photo. Keep EXACTLY the same product, color, material, shape, angle, framing, '
        'soft studio lighting, shadow and warm off-white background; change nothing but the logo. The second image is the official '
        'TaMa Creative logo: a leaf symbol to the left of the serif wordmark "TaMa", with the small letter-spaced word "CREATIVE" '
        'underneath. Reproduce it faithfully, letter by letter. ')
MENOR = BASE + ('The current logo on the product is too big. Remove it completely, leaving the surface clean, and apply the logo '
                'again SMALLER, as a real promotional print: its width about one third of the visible width of the product face, '
                'centered on the front, with generous clear margin from rims, lids, edges and seams. On any colored, dark or saturated '
                'surface the WHOLE logo (leaf and letters) is white; original colors only on white or very light surfaces. No other text, no extra objects, no watermark. Photorealistic.')
OFICIAL = BASE + ('The brand mark currently on the product is wrong (wrong lettering or only the symbol). Remove it and apply the '
                  'official logo in the same spot, small and discreet, as a premium blind deboss/hot-stamp on leather in a subtle tone '
                  'that matches the material, perfectly flat and aligned with the surface. No other text, no extra objects, no '
                  'watermark. Photorealistic.')
FIEL = BASE + ('The logo on the product has the wrong layout or colors. Remove it and apply the official logo in the same spot and at '
               'the same size, with the exact layout of the second image (leaf on the left, "TaMa" on the right, "CREATIVE" under '
               'it): original colors (red leaf, dark plum wordmark) on white or light surfaces, all white on dark or saturated ones. '
               'No other text, no extra objects, no watermark. Photorealistic.')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('modo', choices=('menor', 'oficial', 'fiel')); ap.add_argument('ids', nargs='+'); ap.add_argument('--logo', required=True)
    ap.add_argument('--saida', default=os.path.join(ROOT, 'midia', 'produtos', 'geradas'))
    ap.add_argument('--modelo', default='gpt-image-1.5'); ap.add_argument('--qualidade', default='high')
    a = ap.parse_args()
    key = os.environ.get('OPENAI_API_KEY') or variacoes.chave_do_arquivo()
    if not key:
        sys.exit('defina OPENAI_API_KEY ou grave a chave em ~/.config/tama/openai.env')
    os.makedirs(a.saida, exist_ok=True)
    prompt = {'menor': MENOR, 'oficial': OFICIAL, 'fiel': FIEL}[a.modo]
    for id_ in a.ids:
        base = os.path.join(ROOT, 'midia', 'produtos', 'mestre', id_ + '.png')
        dest = os.path.join(a.saida, id_ + '.png')
        t = time.time()
        try:
            png, usage = variacoes.edit(key, a.modelo, a.qualidade, base, prompt, fidelidade='high', extras=(a.logo,))
        except urllib.error.HTTPError as e:
            corpo = e.read()[:400].decode(errors='replace')
            print(f'{id_}: HTTP {e.code} {corpo}', flush=True)
            if 'billing' in corpo or 'credit' in corpo or 'quota' in corpo:
                sys.exit(2)
            continue
        open(dest, 'wb').write(png)
        print(f'{os.path.relpath(dest, ROOT)}  {len(png) // 1024} KB  {time.time() - t:.0f}s  {json.dumps(usage) if usage else ""}', flush=True)


if __name__ == '__main__':
    main()
