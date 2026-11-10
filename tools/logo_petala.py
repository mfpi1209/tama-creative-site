"""Troca a logo antiga (folha + "TaMa" serifado) pela assinatura "pétala" nas fotos do banco de produtos.

Padrão da marca nas peças (decidido pelo cliente em 10/11/2026): a TaMa é a única marca de exemplo e sempre aparece com
cor. Peça clara: logo positivo (pétala coral, "Ta" grafite, "Ma" bordô). Peça escura: letras brancas e pétala coral.
Peça vermelha, laranja, rosa ou marrom (o coral sumiria): logo todo branco. Gravação/baixo-relevo: tom sobre tom.

Caminho econômico (escolhido pelo cliente em 10/11/2026): por produto e vista (frente, verso, detalhe), UMA foto de cor
média ou escura é editada pela API de imagens da OpenAI (mesma peça, cor, ângulo e fundo; só a logo muda);
as outras cores escuras/médias saem dela, sem custo, com a recoloração local de tools/recolorir.py (a cor-alvo é medida
na foto atual de cada cor). Cores claras pedem a logo nas cores oficiais: cada uma vai pela API. Vista "grupo" também.
As fotos sem a marca TaMa (alt sem "TaMa": versos lisos, "sua logo aqui", marcas fictícias) ficam como estão.

A chave vem de OPENAI_API_KEY ou ~/.config/tama/openai.env. Cada edição custa ~US$ 0,10–0,25.

Uso:
  python -I tools/logo_petala.py plano                       # o que vai pela API e o que sai da recoloração (sem custo)
  python -I tools/logo_petala.py gerar [--so <produto> ...] [--limite N] [--paralelo 4]
  python -I tools/logo_petala.py folha [--so <produto> ...]  # antes/depois em midia/produtos/petala/folhas/
  python -I tools/logo_petala.py limpar                      # apaga saídas fora do padrão atual e as recoloridas
  python -I tools/logo_petala.py importar [--so <produto> ...]   # img/produtos/<id>.webp + inventário (mesmo id)
Saída intermediária: midia/produtos/petala/<id>.png (fora do Git). Retomável: o que já existe não é refeito.
"""
import argparse, json, os, sys, time, urllib.error
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
INV = os.path.join(ROOT, 'src', 'data', 'produtos.json')
SAIDA = os.path.join(ROOT, 'midia', 'produtos', 'petala')
FOLHAS = os.path.join(SAIDA, 'folhas')

PROMPT = ('Edit the first image, a catalog product photo. Keep EXACTLY the same product, color, material, shape, angle, framing, '
          'lighting, shadows and background; change nothing but the logo. The logo currently on the product (a leaf symbol with a '
          'serif "TaMa" wordmark and the word "CREATIVE") is an OUTDATED version: remove it completely, leaving the surface clean, and '
          'apply in the same position, at the same size and with the same technique (print, embroidery, engraving, deboss or '
          'hot-stamp) the NEW logo shown in the second image: a curved petal symbol on the left, the geometric sans-serif wordmark '
          '"TaMa" and the small letter-spaced word "CREATIVE" underneath (spell C-R-E-A-T-I-V-E). Reproduce the new logo faithfully, '
          'letter by letter, following the curvature, folds and perspective of the surface. {cor} No other text, no extra objects, '
          'no watermark. Photorealistic, catalog quality.')
COR_BRANCO = ('The WHOLE new logo (petal and letters) is white, as in the second image; if the old logo was engraved, debossed or '
              'hot-stamped, keep that technique in the same single tone as before.')
COR_NEGATIVO = ('Use the two colors of the second image: the letters ("TaMa" and "CREATIVE") are white and the petal is coral '
                '(#E14B3B); if the old logo was engraved, debossed or hot-stamped, keep that technique in a single tone instead.')
COR_ORIGINAL = ('This is a light-colored product: use the original colors of the second image (coral petal, graphite "Ta", burgundy '
                '"Ma", graphite "CREATIVE"); if the old logo was engraved, debossed or hot-stamped, keep that technique in a single tone.')


def lum(hexv):
    try:
        h = hexv.lstrip('#'); r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    except (ValueError, AttributeError):
        return 0.4
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def croma(hexv):
    try:
        h = hexv.lstrip('#'); r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    except (ValueError, AttributeError):
        return 0
    return max(r, g, b) - min(r, g, b)


def quente(hexv):
    """Vermelho, laranja, rosa, bordô, marrom: a pétala coral não aparece nessas cores (logo todo branco)."""
    import colorsys
    try:
        h = hexv.lstrip('#'); r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    except (ValueError, AttributeError):
        return False
    hh, ss, vv = colorsys.rgb_to_hsv(r, g, b)
    return ss > 0.3 and (hh * 360 < 45 or hh * 360 > 320)


def tipo_escura(e):
    return 'branco' if quente(e['cor'].get('hex', '')) else 'negativo'


def grupos(so=None):
    """{(produto, vista): {'api': [(entrada, tipo_logo)], 'base': entrada|None, 'recolor': [entrada]}}"""
    im = [e for e in json.load(open(INV, encoding='utf-8'))['imagens'] if e.get('aprovacao') not in ('retirada', 'substituir')]
    g = defaultdict(list)
    for e in im:
        if 'TaMa' not in (e.get('alt') or ''):
            continue
        # fotos reais enviadas pela TaMa e fotos não quadradas (de fornecedor) ficam como estão: a API as devolve
        # quadradas, distorcidas, e pode mudar a peça
        if (e.get('origem') or '').startswith(('Foto enviada', 'Enviada pela TaMa')) or abs(e.get('largura', 1024) / max(1, e.get('altura', 1024)) - 1) > 0.02:
            continue
        pref = e['id'].split('~')[0]
        if so and pref not in so:
            continue
        g[(pref, e.get('vista') or 'frente')].append(e)
    plano = {}
    for k, es in sorted(g.items()):
        claras = [e for e in es if lum(e['cor'].get('hex', '')) > 0.72]
        escuras = [e for e in es if e not in claras]
        if k[1] == 'grupo' or len(escuras) <= 1:
            plano[k] = {'api': [(e, 'positivo' if e in claras else tipo_escura(e)) for e in es], 'base': None, 'recolor': []}
            continue
        # base: de preferência uma cor fria (a pétala coral se separa do tecido e é preservada na recoloração), a mais
        # saturada de luminosidade média (o branco da logo lê bem e a recoloração parte de um tom "puro")
        base = max(escuras, key=lambda e: (not quente(e['cor'].get('hex', ''))) * 1000 + croma(e['cor'].get('hex', ''))
                   - 120 * abs(lum(e['cor'].get('hex', '')) - 0.35))
        rec = [e for e in escuras if e is not base]
        # de uma base neutra (preto, cinza) a recoloração não chega a uma cor viva (sai com ruído vermelho): API
        viva = [e for e in rec if croma(base['cor'].get('hex', '')) < 45 and croma(e['cor'].get('hex', '')) >= 45]
        plano[k] = {'api': [(base, tipo_escura(base))] + [(e, 'positivo') for e in claras] + [(e, tipo_escura(e)) for e in viva], 'base': base,
                    'recolor': [e for e in rec if e not in viva]}
    return plano


def arquivo(e):
    return os.path.join(ROOT, e['arquivo'].lstrip('/'))


def png_de(e):
    """A foto atual como PNG (a API recebe PNG); fica em midia/produtos/petala/_orig/."""
    from PIL import Image
    d = os.path.join(SAIDA, '_orig'); os.makedirs(d, exist_ok=True)
    p = os.path.join(d, e['id'] + '.png')
    if not os.path.exists(p):
        Image.open(arquivo(e)).convert('RGB').save(p)
    return p


def editar(chave, e, tipo, qualidade):
    import variacoes, logo_ref
    dest = os.path.join(SAIDA, e['id'] + '.png')
    if os.path.exists(dest):
        return None
    t = time.time()
    for tentativa in range(3):
        try:
            png, usage = variacoes.edit(chave, 'gpt-image-1.5', qualidade, png_de(e),
                                        PROMPT.format(cor={'branco': COR_BRANCO, 'negativo': COR_NEGATIVO}.get(tipo, COR_ORIGINAL)),
                                        fidelidade='high', extras=[logo_ref.referencia(tipo)])
            break
        except urllib.error.HTTPError as err:
            msg = f'{e["id"]}: HTTP {err.code} {err.read()[:200].decode(errors="replace")}'
            if err.code < 500 and err.code != 429:
                return msg
            time.sleep(20 * (tentativa + 1))
        except Exception as err:   # rede
            msg = f'{e["id"]}: {err}'
            time.sleep(20 * (tentativa + 1))
    else:
        return msg
    open(dest, 'wb').write(png)
    marcar(e['id'], tipo)
    return f'api {e["id"]}  {time.time() - t:.0f}s  {usage.get("total_tokens") if usage else ""}'


def tipos_feitos():
    f = os.path.join(SAIDA, '_tipos.json')
    return json.load(open(f)) if os.path.exists(f) else {}


def marcar(id_, tipo):
    import threading
    global _trava
    with _trava:
        t = tipos_feitos(); t[id_] = tipo
        json.dump(t, open(os.path.join(SAIDA, '_tipos.json'), 'w'), indent=0)


import threading  # noqa: E402
_trava = threading.Lock()


def petala_mascara(lab):
    """Pixels da pétala coral (#E14B3B ≈ Lab 55/62/45) numa foto de base de cor fria, com borda suavizada."""
    import numpy as np
    from PIL import Image, ImageFilter
    C = np.hypot(lab[..., 1], lab[..., 2]); h = np.degrees(np.arctan2(lab[..., 2], lab[..., 1]))
    m = ((C > 32) & (np.abs(h - 38) < 24) & (lab[..., 0] > 30) & (lab[..., 0] < 80)).astype(np.uint8) * 255
    im = Image.fromarray(m).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    return np.asarray(im, dtype=np.float64) / 255


def com_petala(rec, base_rgb, m, branca):
    """Devolve a pétala da base sobre a foto recolorida; em cor quente, a pétala vira branca (mesma luz e textura)."""
    import numpy as np
    import recolorir
    pet = base_rgb
    if branca:
        lab = recolorir.rgb2lab(base_rgb)
        sel = m > 0.6
        mL = lab[..., 0][sel].mean() if sel.any() else 55
        novo = lab.copy(); novo[..., 0] = np.clip(93 + (lab[..., 0] - mL) * 0.45, 0, 100); novo[..., 1] = 0.4; novo[..., 2] = 1.6
        pet = recolorir.lab2rgb(novo)
    return rec * (1 - m[..., None]) + pet * m[..., None]


def recolorir_grupo(k, p):
    import numpy as np
    from PIL import Image
    import recolorir
    base_novo = os.path.join(SAIDA, p['base']['id'] + '.png')
    if not os.path.exists(base_novo):
        return []
    sem_fundo = k[1] == 'detalhe'
    base = Image.open(base_novo).convert('RGB')
    if base.size != (1024, 1024):
        base = base.resize((1024, 1024), Image.LANCZOS)
    base_rgb = np.asarray(base, dtype=np.float64)
    m = petala_mascara(recolorir.rgb2lab(base_rgb)) if tipos_feitos().get(p['base']['id']) == 'negativo' else None
    feitos = []
    for e in p['recolor']:
        dest = os.path.join(SAIDA, e['id'] + '.png')
        if os.path.exists(dest):
            continue
        img, _ = recolorir.recolorir(base, Image.open(arquivo(e)), e['cor'].get('hex', '#777777'), sem_fundo)
        if m is not None:
            out = com_petala(np.asarray(img, dtype=np.float64), base_rgb, m, quente(e['cor'].get('hex', '')))
            img = Image.fromarray(out.round().clip(0, 255).astype(np.uint8))
        img.save(dest)
        feitos.append(e['id'])
    return feitos


def cmd_plano(a):
    p = grupos(a.so)
    api = sum(len(v['api']) for v in p.values()); rec = sum(len(v['recolor']) for v in p.values())
    for (pref, vista), v in p.items():
        print(f'{pref:44} {vista:8} api {len(v["api"]):2}  recolor {len(v["recolor"]):2}  base {v["base"]["id"] if v["base"] else "-"}')
    print(f'\n{len(p)} grupos · {api} pela API · {rec} recoloridas localmente')


def cmd_gerar(a):
    import variacoes
    chave = os.environ.get('OPENAI_API_KEY') or variacoes.chave_do_arquivo()
    if not chave:
        sys.exit('defina OPENAI_API_KEY ou grave a chave em ~/.config/tama/openai.env')
    os.makedirs(SAIDA, exist_ok=True)
    p = grupos(a.so)
    tarefas = [(e, t) for v in p.values() for e, t in v['api'] if not os.path.exists(os.path.join(SAIDA, e['id'] + '.png'))]
    if a.limite:
        tarefas = tarefas[:a.limite]
    print(f'{len(tarefas)} edições pela API', flush=True)
    with ThreadPoolExecutor(a.paralelo) as ex:
        for r in ex.map(lambda x: editar(chave, x[0], x[1], a.qualidade), tarefas):
            if r:
                print(r, flush=True)
    n = 0
    for k, v in p.items():
        if v['base']:
            n += len(recolorir_grupo(k, v))
    print(f'{n} recoloridas localmente', flush=True)


def cmd_limpar(a):
    """Apaga as saídas que não seguem o plano atual (tipo de logo diferente) e todas as recoloridas (refeitas da base)."""
    t = tipos_feitos(); n = 0
    for v in grupos(a.so).values():
        for e, tipo in v['api']:
            f = os.path.join(SAIDA, e['id'] + '.png')
            if os.path.exists(f) and t.get(e['id'], 'branco' if lum(e['cor'].get('hex', '')) <= 0.72 else 'positivo') != tipo:
                os.remove(f); n += 1
        for e in v['recolor']:
            f = os.path.join(SAIDA, e['id'] + '.png')
            if os.path.exists(f):
                os.remove(f); n += 1
    print(n, 'saídas apagadas')


def cmd_folha(a):
    from PIL import Image, ImageDraw
    os.makedirs(FOLHAS, exist_ok=True)
    p = grupos(a.so)
    t = 200
    for (pref, vista), v in p.items():
        es = [e for e, _ in v['api']] + v['recolor']
        es = [e for e in es if os.path.exists(os.path.join(SAIDA, e['id'] + '.png'))]
        if not es:
            continue
        W = Image.new('RGB', (len(es) * t, 2 * t + 16), 'white'); d = ImageDraw.Draw(W)
        for i, e in enumerate(es):
            for j, src in enumerate((arquivo(e), os.path.join(SAIDA, e['id'] + '.png'))):
                im = Image.open(src).convert('RGB'); im.thumbnail((t, t)); W.paste(im, (i * t, j * t))
            d.text((i * t + 2, 2 * t + 2), e['id'].split('~')[1][:28], fill='black')
        W.save(os.path.join(FOLHAS, f'{pref}--{vista}.jpg'), quality=72)
    print('folhas em', os.path.relpath(FOLHAS, ROOT))


def cmd_importar(a):
    import produtos
    p = grupos(a.so)
    n = 0
    for v in p.values():
        for e in [e for e, _ in v['api']] + v['recolor']:
            src = os.path.join(SAIDA, e['id'] + '.png')
            if os.path.exists(src):
                produtos.importar(src, e['id']); n += 1
    print(f'{n} fotos importadas')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('cmd', choices=('plano', 'gerar', 'folha', 'importar', 'limpar'))
    ap.add_argument('--so', nargs='*'); ap.add_argument('--limite', type=int, default=0)
    ap.add_argument('--paralelo', type=int, default=4); ap.add_argument('--qualidade', default='medium')
    a = ap.parse_args()
    {'plano': cmd_plano, 'gerar': cmd_gerar, 'folha': cmd_folha, 'importar': cmd_importar, 'limpar': cmd_limpar}[a.cmd](a)


if __name__ == '__main__':
    main()
