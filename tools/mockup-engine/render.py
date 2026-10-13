"""Usage: python -I render.py <key> [<key> ...]   (keys from SPECS in specs*.py)
Writes out/<key>.jpg at master resolution."""
import sys, os, time, glob, importlib.util
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import brand
from PIL import Image

def all_specs():
    specs = {}
    for f in sorted(glob.glob(os.path.join(HERE, 'specs*.py'))):
        spec = importlib.util.spec_from_file_location(os.path.basename(f)[:-3], f)
        m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
        specs.update(getattr(m, 'SPECS', {}))
    return specs

import json, unicodedata
CUR = json.load(open(os.path.join(os.path.dirname(os.path.dirname(HERE)), 'src', 'data', 'curadoria.json'), encoding='utf-8'))
COLORS = {p['img']: p['cores'] for p in CUR['pecas']}


def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return '-'.join(''.join(c if c.isalnum() else ' ' for c in s).split())


def variants_of(key, spec):
    """Colour variants for a product spec: every curadoria colour after the first (the photographed one)."""
    if 'recolor' not in spec or key not in COLORS:
        return []
    return [(n, h) for n, h in COLORS[key][1:]]


def run(key, spec, variant=None):
    t = time.time()
    im, esr = brand.apply_spec(spec, variant=variant)
    name = key if variant is None else f'{key}~{slug(variant[0])}'
    im.save(os.path.join(HERE, 'out', name + '.jpg'), quality=93, subsampling=0)
    print(name, im.size, 'esr' if esr else 'lanczos-preview', f'{time.time() - t:.0f}s', flush=True)


if __name__ == '__main__':
    # render.py key            -> base image only
    # render.py key~           -> all colour variants of key
    # render.py key~Café       -> one variant (colour name as in curadoria.json)
    # render.py                -> everything (bases + variants)
    os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
    SPECS = all_specs()
    args = sys.argv[1:]
    if not args:
        for key, spec in SPECS.items():
            run(key, spec)
            for v in variants_of(key, spec):
                run(key, spec, v)
    for a in args:
        key, _, var = a.partition('~')
        spec = SPECS[key]
        if '~' not in a:
            run(key, spec)
        elif var:
            run(key, spec, next(v for v in variants_of(key, spec) if v[0] == var))
        else:
            for v in variants_of(key, spec):
                run(key, spec, v)
