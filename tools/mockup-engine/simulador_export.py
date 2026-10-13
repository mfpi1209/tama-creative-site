"""Bases e áreas de aplicação do simulador "Veja sua marca" (/veja-sua-marca/).

Para cada peça da curadoria (src/data/curadoria.json) e cada cor:
  - img/simulador/<foto>~<cor>.webp : a foto do produto naquela cor, limpa e SEM nenhuma marca (1600 px de largura).
    Sai do mesmo motor dos mockups (brand.apply_spec com with_marks=False): limpeza + recoloração.
  - src/data/simulador.json : as áreas de aplicação de cada foto (quadrilátero em px da foto de 850 px, cilindro,
    recorte, técnica e parâmetros do efeito, ajustes por cor). O navegador (src/simulador.js) usa esses dados para
    aplicar o logo do cliente com perspectiva e o efeito do material.

Uso:  python -I tools/mockup-engine/simulador_export.py            (gera o que falta)
      python -I tools/mockup-engine/simulador_export.py --json     (só o JSON das áreas)
      python -I tools/mockup-engine/simulador_export.py --force    (refaz todas as bases)
"""
import glob, importlib.util, json, math, os, sys, time, unicodedata
from concurrent.futures import ProcessPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import brand  # noqa: E402

ROOT = brand.ROOT
OUT_DIR = os.path.join(ROOT, 'img', 'simulador')
JSON_OUT = os.path.join(ROOT, 'src', 'data', 'simulador.json')
OUT_W = 1600
SRC_W, SRC_H = 850, 780

# Parâmetros do efeito copiados para o navegador (mesmos nomes do motor).
FX_KEYS = ('color', 'light', 'depth', 'sheen', 'tex', 'opacity', 'strength', 'darken', 'sign', 'gloss', 'angle', 'period', 'raised', 'shadow', 'alpha')

# Quanto o logo do cliente pode crescer além da caixa da assinatura TaMa (largura, altura).
# Caixas em perspectiva (plane/quad) ficam presas à superfície; caixas retas têm folga vertical.
FIT_DEFAULT = {'h': (1.0, 1.45, 0.92), 'v': (1.12, 1.0, 0.92), 'arc': (1.25, 1.0, 0.92), 'word': (1.0, 1.0, 0.92)}
FIT_PLANE = (1.0, 1.0, 0.92)
# Por área: (gx, gy, cap) = largura e altura máximas relativas à caixa e área máxima do logo (x área da caixa).
# Paredes de bandejas ficam no padrão (presas à altura da parede); tampas, capas, peças de roupa e sacolas têm folga.
# Ajustado na conferência visual com logos largo, quadrado e vertical.
FIT_OVERRIDE = {
    ('garrafa-termica', 0): (1.12, 1.25, 1.1),
    ('caderno-premium', 0): (1.0, 1.6, 1.3),
    ('caneca-ceramica', 0): (0.85, 2.6, 2.0),
    ('kit-presente', 0): (1.0, 1.3, 1.2),
    ('hoodie-azul', 0): (1.1, 1.2, 1.1),
    ('polo-offwhite', 0): (0.85, 2.4, 2.0),
    ('bolsa-terracota', 0): (1.0, 2.4, 1.8),
    ('sacola-verde', 0): (1.05, 1.2, 1.1),
    ('kit-papelaria', 0): (1.0, 2.2, 1.8),
    ('kit-papelaria', 2): (1.0, 1.8, 1.5),
    ('caixa-terracota', 0): (0.9, 2.2, 1.6),
    ('cartoes-colors', 0): (1.0, 1.8, 1.5),
    ('caderno-azul', 0): (1.0, 1.5, 1.3),
    ('embalagem-presente', 0): (1.0, 1.3, 1.2),
    ('manta-textil', 0): (1.0, 1.3, 1.2),
    ('uniforme-verde', 0): (0.6, 2.4, 1.6),
    ('look-corporativo', 0): (1.1, 1.2, 1.1),
    ('look-corporativo', 1): (0.85, 2.4, 2.0),
    ('papelaria-cores', 0): (1.0, 1.8, 1.5),
    ('papelaria-cores', 1): (0.9, 2.0, 1.6),
    ('papelaria-cores', 3): (1.0, 1.4, 1.2),
}


def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return '-'.join(''.join(c if c.isalnum() else ' ' for c in s).split())


def all_specs():
    specs = {}
    for f in sorted(glob.glob(os.path.join(HERE, 'specs*.py'))):
        sp = importlib.util.spec_from_file_location(os.path.basename(f)[:-3], f)
        m = importlib.util.module_from_spec(sp)
        sp.loader.exec_module(m)
        specs.update(getattr(m, 'SPECS', {}))
    return specs


_ASPECT = {}


def aspect(kind):
    if kind not in _ASPECT:
        _ASPECT[kind] = brand.logo_aspect(kind)
    return _ASPECT[kind]


def mark_quad(mk):
    """Quadrilátero da marca em px da foto de origem: TL, TR, BR, BL (mesma geometria de brand.apply_spec)."""
    if 'quad' in mk:
        return [tuple(p) for p in mk['quad']], 'quad'
    if 'plane' in mk:
        cx, cy, bx, by, ax, ay, w, h = mk['plane']
        nb, na = math.hypot(bx, by), math.hypot(ax, ay)
        bx, by, ax, ay = bx / nb * w / 2, by / nb * w / 2, ax / na * h / 2, ay / na * h / 2
        return [(cx - bx - ax, cy - by - ay), (cx + bx - ax, cy + by - ay), (cx + bx + ax, cy + by + ay), (cx - bx + ax, cy - by + ay)], 'plane'
    r = mk['rect']
    return brand.rect_quad(r[0], r[1], r[2], kind=mk['logo'], rot=mk.get('rot', 0), h=r[3] if len(r) > 3 else None), 'rect'


def areas_for(key, spec, colors):
    names = {n: slug(n) for n, _ in colors}
    out = []
    for i, mk in enumerate(spec.get('marks', [])):
        quad, geo = mark_quad(mk)
        kind = mk['logo'] if mk['logo'] in FIT_DEFAULT else 'v'
        fit = FIT_OVERRIDE.get((key, i)) or (FIT_DEFAULT[kind] if geo == 'rect' else FIT_PLANE)
        a = {
            'q': [[round(x, 2), round(y, 2)] for x, y in quad],
            'fx': mk['fx'],
            'p': {k: mk[k] for k in FX_KEYS if k in mk},
            'role': 'main' if i == 0 else 'extra',
            'fit': list(fit),
        }
        if 'cyl' in mk:
            a['cyl'] = list(mk['cyl'])
        if mk.get('clip'):
            a['clip'] = [[round(x, 2), round(y, 2)] for x, y in mk['clip']]
        if mk.get('soft'):
            a['soft'] = mk['soft']
        var = {}
        for cname, ov in spec.get('variant_marks', {}).items():
            o = ov.get(i) or ov.get(str(i))
            if o and cname in names:
                var[names[cname]] = {k: v for k, v in o.items() if k in FX_KEYS or k == 'fx'}
        if var:
            a['v'] = var
        out.append(a)
    return out


def render_base(job):
    key, spec, variant, dest = job
    from PIL import Image
    t = time.time()
    im, esr = brand.apply_spec(spec, variant=variant, with_marks=False)
    im = im.resize((OUT_W, round(im.height * OUT_W / im.width)), Image.LANCZOS)
    im.save(dest, 'WEBP', quality=84, method=6)
    return f'{os.path.basename(dest)} {"esr" if esr else "lanczos"} {time.time() - t:.0f}s'


def main(argv):
    specs = all_specs()
    cur = json.load(open(os.path.join(ROOT, 'src', 'data', 'curadoria.json'), encoding='utf-8'))
    data = {'w': SRC_W, 'h': SRC_H, 'produtos': []}
    jobs = []
    os.makedirs(OUT_DIR, exist_ok=True)
    for p in cur['pecas']:
        key = p['img']
        spec = specs[key]
        data['produtos'].append({
            'slug': p['slug'], 'nome': p['nome'], 'img': key, 'categoria': p['categoria'],
            'tecnicas': p['tecnicas'], 'materiais': p['materiais'],
            'cores': [{'n': n, 'h': h, 's': slug(n)} for n, h in p['cores']],
            'areas': areas_for(key, spec, p['cores']),
        })
        for i, (n, h) in enumerate(p['cores']):
            dest = os.path.join(OUT_DIR, f'{key}~{slug(n)}.webp')
            if '--force' in argv or not os.path.exists(dest):
                jobs.append((key, spec, None if i == 0 else (n, h), dest))
    json.dump(data, open(JSON_OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'{JSON_OUT}: {len(data["produtos"])} peças, {sum(len(x["areas"]) for x in data["produtos"])} áreas')
    if '--json' in argv:
        return
    workers = int(os.environ.get('WORKERS', '4'))
    print(f'{len(jobs)} bases para gerar com {workers} processos')
    with ProcessPoolExecutor(max_workers=workers) as ex:
        for msg in ex.map(render_base, jobs):
            print(msg, flush=True)


if __name__ == '__main__':
    main(sys.argv[1:])
