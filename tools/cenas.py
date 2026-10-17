"""Gera cenas de banner (pessoas usando peças com a marca TaMa) com a API de imagens da OpenAI.

Usa tools/variacoes.edit() com o logo oficial como imagem de referência, para a marca sair fiel nas roupas.
A chave vem de OPENAI_API_KEY ou ~/.config/tama/openai.env. Cada cena em qualidade high custa ~US$ 0,25.
As pessoas são fictícias e as imagens são ilustrativas; o site sempre as identifica assim.

Uso:
  python -I tools/cenas.py <nome> "<descrição da cena em inglês>" --logo <logo.png> [--qualidade high] [--saida midia/cenas]
Saída: <saida>/<nome>.png (1536×1024).
"""
import argparse, json, os, sys, time, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import variacoes  # noqa: E402

PROMPT = ('The attached image is the official logo of the company "TaMa Creative". On garments use ONLY the leaf symbol followed by '
          'the serif word "TaMa", exactly as in the logo, WITHOUT the small "CREATIVE" line underneath (it is too small to embroider); '
          'on dark or saturated fabric render it in white, on white fabric in the original colors. Create a photorealistic, editorial, '
          'natural-light photograph for a website banner: {cena} Framing: medium shot from the waist up, camera at chest height, every '
          'head between 20% and 45% of the image height from the top, never cropped; the people and the main action occupy the RIGHT '
          '55% of the frame. The LEFT 40% shows the same real environment continuing naturally, softly out of focus with real shallow '
          'depth of field (no artificial blur patches, no floating shapes, no colored haze), light and airy, with no faces and no text. '
          'Warm, bright, premium look; soft daylight; realistic skin and fabric; people look natural and engaged, not posing. No other '
          'brands or logos, no text other than the TaMa logo, no watermark.')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('nome'); ap.add_argument('cena'); ap.add_argument('--logo', required=True)
    ap.add_argument('--qualidade', default='high'); ap.add_argument('--modelo', default='gpt-image-1.5')
    ap.add_argument('--saida', default=os.path.join(ROOT, 'midia', 'cenas'))
    a = ap.parse_args()
    key = os.environ.get('OPENAI_API_KEY') or variacoes.chave_do_arquivo()
    if not key:
        sys.exit('defina OPENAI_API_KEY ou grave a chave em ~/.config/tama/openai.env')
    os.makedirs(a.saida, exist_ok=True)
    dest = os.path.join(a.saida, a.nome + '.png')
    t = time.time()
    try:
        png, usage = variacoes.edit(key, a.modelo, a.qualidade, a.logo, PROMPT.format(cena=a.cena), fidelidade='high', tamanho='1536x1024')
    except urllib.error.HTTPError as e:
        sys.exit(f'{a.nome}: HTTP {e.code} {e.read()[:400].decode(errors="replace")}')
    open(dest, 'wb').write(png)
    print(f'{os.path.relpath(dest, ROOT)}  {len(png) // 1024} KB  {time.time() - t:.0f}s  {json.dumps(usage) if usage else ""}')


if __name__ == '__main__':
    main()
