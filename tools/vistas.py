"""Outras vistas das peças (verso, close do bordado, frente com bordado realista) e cadastro no banco de imagens.

  gerar     usa a API de imagens da OpenAI (gpt-image-1.5) a partir da foto de frente de UMA cor (a "base"), com os
            prompts aprovados no piloto de 18/10/2026 (polo masculina e boné). Cada imagem custa ~US$ 0,20–0,30.
  importar  cadastra no banco (src/data/produtos.json + img/produtos/) as imagens <produto>~<cor>-<sufixo>.png de uma
            pasta: as geradas aqui e as variações de cor feitas sem API com tools/recolorir.py.

Fluxo (ex.: dólmã, base branca não serve: escolha uma cor escura ou saturada):
  python -I tools/vistas.py gerar dolma~preto verso bordado frente --logo <logo-positivo.png>
  python tools/recolorir.py midia/produtos/geradas/dolma~preto-verso.png --base dolma~preto --sufixo verso
  python tools/recolorir.py midia/produtos/geradas/dolma~preto-bordado.png --base dolma~preto --sufixo bordado --sem-fundo
  python tools/recolorir.py midia/produtos/geradas/dolma~preto-frente.png --base dolma~preto --sufixo frente
  python -I tools/vistas.py importar midia/produtos/geradas
"frente" substitui a foto de frente da cor (mesmo id; a anterior fica no histórico do Git). Cores claras com bordado
(branco, cru) não saem do recolorir: gere pela API, com o logo nas cores oficiais.
O original da base vem de midia/produtos/mestre/<id>.png ou, se não houver, de img/produtos/<id>.webp.
"""
import argparse, datetime, json, os, sys, tempfile, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))

BG = 'warm off-white seamless studio background #FBF8F5, soft diffused studio light from the upper left, soft natural contact shadow'
LOGO = ('the official TaMa Creative logo from the second image (leaf symbol on the LEFT, serif wordmark "TaMa", small letter-spaced '
        '"CREATIVE" underneath; spell C-R-E-A-T-I-V-E)')
BORDADO = ('REAL machine embroidery in ONE single thread color, white, for the WHOLE logo (leaf, TaMa and CREATIVE all white; no coral, '
           'no red, no second color), not print: individual satin stitch lines clearly visible, raised edges casting a tiny shadow, dense '
           'satin stitches with visible parallel thread direction and a soft thread sheen, slightly raised from the fabric, fill stitches '
           'inside the leaf, the tiny CREATIVE letters in fine satin stitch, a little natural puckering of the fabric around the stitching')
PROMPTS = {
    'verso': (False, 'The first image is a catalog photo of the FRONT of a {peca}. Create the matching catalog photo of the BACK of the exact '
              'same {peca}: same fabric, color, construction and details seen from behind, same presentation, same size and position in the '
              'square frame, ' + BG + '. The back has NO logo, no print and no label. No text, no extra objects, no watermark. '
              'Photorealistic catalog quality.'),
    'bordado': (True, 'The first image is a catalog photo of a {peca} with a logo; the second image is the official logo. Create a square '
                'close-up detail photo (macro lens) of that logo on the same fabric and color: ' + LOGO + ', filling about 60% of the frame '
                'width, executed as ' + BORDADO + '. Fabric texture clearly visible around it. Directional soft light from the upper left to '
                'reveal the relief of the stitches. It must not look printed or flat. No other text, no extra objects, no watermark. '
                'Photorealistic.'),
    'frente': (True, 'Edit the first image. Keep EXACTLY the same {peca}, color, folds, details, framing, light and background. Change ONLY '
               'the logo so it reads as ' + BORDADO + ', same position and same size as now, faithful to ' + LOGO + '. No other changes, '
               'no extra text, no watermark. Photorealistic catalog quality.'),
}
VISTA = {'verso': 'verso', 'bordado': 'detalhe', 'detalhe': 'detalhe'}


def banco():
    p = os.path.join(ROOT, 'src', 'data', 'produtos.json')
    return p, json.load(open(p, encoding='utf-8'))


def base_png(bid):
    m = os.path.join(ROOT, 'midia', 'produtos', 'mestre', bid + '.png')
    if os.path.isfile(m):
        return m
    from PIL import Image
    t = tempfile.NamedTemporaryFile(suffix='.png', delete=False).name
    Image.open(os.path.join(ROOT, 'img', 'produtos', bid + '.webp')).convert('RGB').save(t)
    return t


def gerar(a):
    import variacoes
    key = os.environ.get('OPENAI_API_KEY') or variacoes.chave_do_arquivo()
    if not key:
        sys.exit('defina OPENAI_API_KEY ou grave em ~/.config/tama/openai.env')
    _, d = banco()
    e = next((x for x in d['imagens'] if x['id'] == a.base), None)
    if not e:
        sys.exit(f'{a.base} não está no banco')
    peca = a.peca or e['produto'].lower()
    os.makedirs(a.saida, exist_ok=True)
    for v in a.vistas:
        logo, prompt = PROMPTS[v]
        dest = os.path.join(a.saida, f'{a.base}-{v}.png')
        if os.path.exists(dest):
            print('já existe:', dest); continue
        t = time.time()
        png, _ = variacoes.edit(key, a.modelo, a.qualidade, base_png(a.base), prompt.format(peca=peca), extras=[a.logo] if logo else ())
        open(dest, 'wb').write(png)
        print(f'{dest}  {len(png) // 1024} KB  {time.time() - t:.0f}s')


def importar(a):
    from PIL import Image
    p, d = banco()
    by = {e['id']: e for e in d['imagens']}
    hoje = datetime.date.today().isoformat()
    n = 0
    for fn in sorted(os.listdir(a.pasta)):
        if not fn.endswith('.png') or '~' not in fn or '-' not in fn.split('~')[1]:
            continue
        nome = fn[:-4]
        prefixo, resto = nome.split('~')
        cor, suf = resto.rsplit('-', 1)
        fid = f'{prefixo}~{cor}'
        if fid not in by or suf not in ('verso', 'bordado', 'detalhe', 'frente'):
            print('ignorada:', fn); continue
        f = by[fid]
        im = Image.open(os.path.join(a.pasta, fn)).convert('RGB')
        origem = a.origem or 'Ilustrativa, gerada em ' + hoje + '.'
        if suf == 'frente':
            im.save(os.path.join(ROOT, 'img', 'produtos', fid + '.webp'), 'WEBP', quality=92, method=6)
            f.update({'origem': origem, 'observacao': 'Frente refeita com bordado realista.', 'atualizado_em': hoje, 'largura': im.width, 'altura': im.height})
            n += 1; continue
        vid = f'{fid}-{suf}'
        im.save(os.path.join(ROOT, 'img', 'produtos', vid + '.webp'), 'WEBP', quality=92, method=6)
        c = f['cor']['nome']; c = c[0].lower() + c[1:]
        alt = (f'Verso: {f["produto"].lower()} na cor {c}, sem marca.' if suf == 'verso'
               else f'Detalhe do bordado da marca TaMa em linha branca: {f["produto"].lower()} na cor {c}.')
        e = {k: f[k] for k in ('produto', 'categoria', 'modelo', 'cor', 'material', 'tecnica', 'fornecedor', 'sku', 'estoque')}
        e.update({'id': vid, 'vista': VISTA[suf], 'alt': by.get(vid, {}).get('alt') or alt, 'uso': ['catalogo'], 'ilustrativa': True,
                  'aprovacao': 'revisao', 'origem': origem, 'substitui': None, 'observacao': '', 'arquivo': f'/img/produtos/{vid}.webp',
                  'mestre': None, 'largura': im.width, 'altura': im.height, 'atualizado_em': hoje})
        if vid in by:
            by[vid].update(e)
        else:
            d['imagens'].append(e); by[vid] = e
        n += 1
    d['imagens'].sort(key=lambda e: e['id'])
    open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=1) + '\n')
    print(f'{n} imagem(ns) cadastradas; revise o texto alternativo e aprove no /admin/')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    g = sub.add_parser('gerar'); g.add_argument('base'); g.add_argument('vistas', nargs='+', choices=sorted(PROMPTS))
    g.add_argument('--logo', required=True, help='PNG do logo oficial (positivo)'); g.add_argument('--peca', help='nome da peça em inglês (ex.: polo shirt)')
    g.add_argument('--saida', default=os.path.join(ROOT, 'midia', 'produtos', 'geradas'))
    g.add_argument('--modelo', default='gpt-image-1.5'); g.add_argument('--qualidade', default='high')
    i = sub.add_parser('importar'); i.add_argument('pasta'); i.add_argument('--origem', help='texto do campo origem')
    a = ap.parse_args()
    gerar(a) if a.cmd == 'gerar' else importar(a)


if __name__ == '__main__':
    main()
