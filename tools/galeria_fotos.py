"""Gera as 9 fotos ambientadas da galeria de coleções da home (img/galeria/<categoria>.png) com a API de imagens da
OpenAI, já com a assinatura "pétala" da TaMa. Uma cor de peça diferente por categoria e fundos claros variados, para a
galeria não ficar toda no mesmo tom (pedido do cliente em 10/11/2026: elegância, sofisticação, vida e modernidade).

A chave vem de OPENAI_API_KEY ou ~/.config/tama/openai.env. Cada foto (1536 × 1024, qualidade high) custa ~US$ 0,25.
Fotos ilustrativas: a marca TaMa aparece como exemplo, sem outras marcas.

Uso:
  python -I tools/galeria_fotos.py                       # as que faltam
  python -I tools/galeria_fotos.py vestuario tecnologia  # refaz só estas (sobrescreve)
Depois converta para WebP (o site usa img/galeria/<categoria>.webp; o PNG original vai para midia/galeria-png/) e
rode o build: a galeria usa essas fotos no lugar das capas do blog (build.py › home_galeria, foco em GALERIA_FOCO).
"""
import json, os, sys, time, urllib.error
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import variacoes  # noqa: E402
import logo_ref   # noqa: E402

SAIDA = os.path.join(ROOT, 'img', 'galeria')

COMUM = ('The attached image shows the NEW logo of the company "TaMa Creative": a curved petal symbol on the left, the geometric '
         'sans-serif wordmark "TaMa" and the small letter-spaced word "CREATIVE" underneath (spell C-R-E-A-T-I-V-E). Create a '
         'photorealistic, editorial product photograph for the collections gallery of a premium corporate gifts website. '
         'Landscape 3:2. {cena} Composition: the products sit in the CENTRAL THIRD of the frame, complete, with generous breathing '
         'room on both sides (the photo is also shown as a narrow vertical strip, so keep the hero piece centered and not too wide). '
         'Soft natural daylight from the left, gentle realistic shadows, shallow depth of field, crisp focus on the logo. '
         'Mood: elegant, sophisticated, lively and modern; clean, bright, with one confident color accent. '
         'Logo: apply exactly the attached logo, small and proportional, as a real {tecnica}; {cor_logo} Do not redraw the letters. '
         'No people, no other brands, no other text, no watermark.')
BRANCO = 'on dark or saturated surfaces the whole logo (petal and letters) is white.'
ORIGINAL = 'on light surfaces use the original colors: coral petal, graphite "Ta", burgundy "Ma", graphite "CREATIVE".'

FOTOS = {
    'garrafas-copos': ('A matte cobalt-blue stainless steel water bottle with a brushed steel cap standing on a pale travertine block, a '
                       'clear glass of sparkling water with a lemon slice beside it, soft leaf shadows on a warm white wall behind.',
                       'laser engraving on the bottle body', BRANCO),
    'vestuario': ('A neatly folded burgundy pique polo shirt with an off-white baseball cap resting next to it, on a light oak bench, '
                  'against a soft blush-pink plaster wall.', 'embroidery on the chest of the polo', BRANCO),
    'canetas-escritorio': ('A burnt-orange hardcover notebook with an elastic band and a graphite metal pen lying diagonally on it, on a '
                           'white marble desk, a small white ceramic espresso cup in the soft background.',
                           'tone-on-tone deboss on the notebook cover', 'the logo is debossed in a slightly darker orange tone.'),
    'bolsas-embalagens': ('A natural canvas tote bag with deep forest-green handles standing upright, slightly open, next to a small '
                          'coral-colored gift box with a ribbon, on a pale sand-colored floor against a warm white wall.',
                          'screen print on the front of the tote', ORIGINAL),
    'tecnologia': ('A mustard-yellow matte power bank and a white wireless charging pad with a neatly coiled white cable, on light '
                   'polished concrete, a small potted succulent softly out of focus behind.', 'white screen print on the power bank', BRANCO),
    'cozinha-bar': ('A light oak wooden cheese board with two cheese knives, a few figs and grapes, and two wine glasses with rosé wine, '
                    'on a white marble countertop, bright and fresh.', 'laser engraving in one tone on the corner of the board',
                    'the logo is burned into the wood in a single dark brown tone.'),
    'acessorios': ('A caramel-brown leather wallet and a matching zippered pouch with gold hardware, side by side on a smooth stone '
                   'surface, against a soft terracotta wall with warm light.', 'blind deboss on the pouch',
                   'the logo is debossed in the leather, same tone, no color.'),
    'casa-bem-estar': ('A blush-pink ceramic reed diffuser with natural wooden reeds and a fresh eucalyptus sprig, next to a folded light '
                       'grey knitted throw, on a white side table, airy bright room softly blurred behind.',
                       'printed label on the diffuser', ORIGINAL),
    'hotelaria-gastronomia': ('A navy-blue leather restaurant menu cover and a matching bill holder on a set table with a white tablecloth, '
                              'white plate, silver cutlery, a wine glass and a small vase of red flowers, elegant restaurant softly blurred.',
                              'silver hot-stamp on the menu cover', 'the logo is a silver metallic hot-stamp.'),
}


def gerar(chave, cat):
    cena, tecnica, cor = FOTOS[cat]
    ref = logo_ref.referencia('branco' if cor == BRANCO else 'positivo')
    dest = os.path.join(SAIDA, cat + '.png')
    t = time.time()
    try:
        png, usage = variacoes.edit(chave, 'gpt-image-1.5', 'high', ref, COMUM.format(cena=cena, tecnica=tecnica, cor_logo=cor),
                                    fidelidade='high', tamanho='1536x1024')
    except urllib.error.HTTPError as e:
        return f'{cat}: HTTP {e.code} {e.read()[:300].decode(errors="replace")}'
    open(dest, 'wb').write(png)
    return f'{os.path.relpath(dest, ROOT)}  {len(png) // 1024} KB  {time.time() - t:.0f}s  {json.dumps(usage) if usage else ""}'


def main():
    chave = os.environ.get('OPENAI_API_KEY') or variacoes.chave_do_arquivo()
    if not chave:
        sys.exit('defina OPENAI_API_KEY ou grave a chave em ~/.config/tama/openai.env')
    os.makedirs(SAIDA, exist_ok=True)
    cats = sys.argv[1:] or [c for c in FOTOS if not any(os.path.exists(os.path.join(SAIDA, c + e)) for e in ('.png', '.jpg', '.webp'))]
    with ThreadPoolExecutor(5) as ex:
        for r in ex.map(lambda c: gerar(chave, c), cats):
            print(r, flush=True)


if __name__ == '__main__':
    main()
