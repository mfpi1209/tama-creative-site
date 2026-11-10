"""Gera as 5 fotos da seção "Cinco frentes" da home (arcos verticais) com a API de imagens da OpenAI, numa mesma
direção de arte (briefing do cliente de 10/11/2026, "Premium Product Editorial"): estúdio, fundo claro neutro, luz
difusa, produtos protagonistas, saturação controlada. Só UMA peça por composição leva a assinatura TaMa, discreta;
as demais ficam lisas. Sem marcas fictícias, sem pessoas, sem comida.

A chave vem de OPENAI_API_KEY ou ~/.config/tama/openai.env. Cada foto (1024 × 1536, high) custa ~US$ 0,25.
São imagens ilustrativas (conceito visual), não fotos de projetos executados.

Uso:
  python -I tools/frentes_fotos.py                    # as que faltam
  python -I tools/frentes_fotos.py hotelaria eventos  # refaz só estas
Saída: midia/frentes-png/<frente>.png e img/v2/home-frente-<frente>-v3.webp (o build usa pelo site.json).
"""
import os, sys, time, urllib.error
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import variacoes  # noqa: E402
import logo_ref   # noqa: E402

PNG = os.path.join(ROOT, 'midia', 'frentes-png')
WEB = os.path.join(ROOT, 'img', 'v2')

COMUM = ('Premium editorial product photograph for the website of a corporate gifts company. Vertical 2:3 portrait. Studio '
         'still life: soft diffuse daylight from the upper left, realistic soft shadows, light neutral background and surfaces in '
         'warm off-white, sand and soft grey, subtle depth. The products are the protagonists, filling most of the frame, composed '
         'in the CENTER: keep the important products between 25% and 85% of the height and away from the left and right edges (the '
         'photo is shown inside a tall arch with a fully rounded top). Controlled saturation, true product colors, refined '
         'materials, textures and finishes. Minimal, elegant, contemporary, like a luxury product catalog. Full-bleed photograph filling '
         'the whole canvas edge to edge (no white margins, no frame, no cut-out shape); behind the products a softly lit off-white '
         'plaster wall with a shallow arched niche, the same set for every photo of the series. {cena} '
         'Branding: ONLY ONE item carries the attached TaMa Creative logo (curved petal symbol, geometric sans-serif "TaMa", small '
         'letter-spaced "CREATIVE"), small and discreet: {logo} Reproduce it faithfully. Every other item is plain, with no logo, '
         'no monogram and no text. No people, no hands, no food, no other brands, no watermark.')

FRENTES = {
    'brindes': ('A curated arrangement of corporate gifts on stacked sand-colored stone blocks: a matte graphite stainless steel '
                'thermal bottle with a brushed steel cap, a deep navy hardcover executive notebook with an elastic band, a brushed '
                'silver metal pen resting on it, a white ceramic mug and an off-white rigid gift box with its lid slightly open.',
                'printed on the graphite bottle with white letters and the coral petal.', 'negativo'),
    'confeccoes': ('Premium uniforms presented as an editorial still life, placed LOW in the frame (the folded garments occupy the '
                   'lower half, from about 55% to 90% of the height, with the embroidered logo at about 75% of the height): a navy '
                   'pique polo shirt neatly folded showing the collar and buttons, a crisp white chef jacket folded beside it, a close view of fine embroidery on the polo chest with '
                   'visible satin stitches, fabric texture and seams, a small fan of neutral fabric swatches and a spool of thread.',
                   'embroidered on the chest of the navy polo, white thread letters and a coral petal.', 'negativo'),
    'kits': ('An open rigid gift box in soft warm grey with a fitted interior, three-quarter top view, neatly organized: a matte white '
             'thermal bottle, a charcoal notebook, a metal pen, a small ceramic cup, a folded linen napkin, white tissue paper and a '
             'blank greeting card. The box and its organization are the protagonists.',
             'printed small on the inside of the open box lid in its original colors.', 'positivo'),
    'eventos': ('Branded event items arranged on a light stone counter, product first: a neat stack of fabric lanyards with clear blank '
                'badge holders (no names, no text on the badges), frosted reusable event cups, a natural canvas tote bag standing '
                'upright, a small zip pouch for participants, in a coordinated palette of off-white, warm grey and one terracotta '
                'accent; softly out-of-focus event venue lights far in the background, no people.',
                'printed small on the canvas tote bag in its original colors.', 'positivo'),
    'hotelaria': ('A sophisticated restaurant table as a product still life, with NO food and no people: a dark brown leather menu '
                  'cover standing upright, a matching leather bill holder, a woven linen placemat, a brushed brass napkin ring holding '
                  'a folded linen napkin, a small kraft takeaway box tied with a ribbon, an empty white plate and a wine glass in soft '
                  'focus, warm neutral restaurant interior blurred far behind.',
                  'debossed tone on tone on the leather menu cover, no color.', 'branco'),
}


def gerar(chave, nome):
    cena, logo, ref = FRENTES[nome]
    t = time.time()
    try:
        png, _ = variacoes.edit(chave, 'gpt-image-1.5', 'high', logo_ref.referencia(ref), COMUM.format(cena=cena, logo=logo),
                                fidelidade='high', tamanho='1024x1536')
    except urllib.error.HTTPError as e:
        return f'{nome}: HTTP {e.code} {e.read()[:300].decode(errors="replace")}'
    from PIL import Image
    import io
    os.makedirs(PNG, exist_ok=True)
    open(os.path.join(PNG, nome + '.png'), 'wb').write(png)
    Image.open(io.BytesIO(png)).convert('RGB').save(os.path.join(WEB, f'home-frente-{nome}-v3.webp'), 'WEBP', quality=88, method=6)
    return f'{nome}  {time.time() - t:.0f}s'


def main():
    chave = os.environ.get('OPENAI_API_KEY') or variacoes.chave_do_arquivo()
    if not chave:
        sys.exit('defina OPENAI_API_KEY ou grave a chave em ~/.config/tama/openai.env')
    nomes = sys.argv[1:] or [n for n in FRENTES if not os.path.exists(os.path.join(WEB, f'home-frente-{n}-v3.webp'))]
    with ThreadPoolExecutor(5) as ex:
        for r in ex.map(lambda n: gerar(chave, n), nomes):
            print(r, flush=True)


if __name__ == '__main__':
    main()
