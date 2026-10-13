"""Export the approved renders into the project's media library.
Usage: python -I export.py <manifest_in.json>
manifest_in: [{key, produto, marca, ficticia, nivel, tecnicas, alt}]
Writes tama-site/midia/mockups/{mestre,web,miniatura}/ + manifest.json"""
import glob, json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'midia', 'mockups')
HEROES = {'hero-gift', 'hero-brand', 'hero-wear'}


def file_name(key, ficticia, marca):
    base = key.split('--')[0]
    if ficticia:
        slug = marca.lower().split(' (')[0].replace(' ', '-')
        return f'{base}-ficticia-{slug}'
    return f'{base}-tama'


def main(spec_path):
    items = json.load(open(spec_path, encoding='utf-8'))
    for d in ('mestre', 'web', 'miniatura'):
        os.makedirs(os.path.join(DEST, d), exist_ok=True)
    out = []
    for it in items:
        src = os.path.join(HERE, 'out', it['key'] + '.jpg')
        im = Image.open(src).convert('RGB')
        name = file_name(it['key'], it.get('ficticia'), it['marca'])
        hero = it['key'].split('--')[0] in HEROES
        web_w = 2400 if hero else 1600
        im.save(os.path.join(DEST, 'mestre', name + '.jpg'), quality=95, subsampling=0, optimize=True)
        web = im.resize((web_w, round(im.height * web_w / im.width)), Image.LANCZOS)
        web.save(os.path.join(DEST, 'web', name + '.webp'), quality=84, method=6)
        web.save(os.path.join(DEST, 'web', name + '.avif'), quality=62)
        mobile = None
        if hero:  # 4:5 crop for phones, centred on the subject (foco = 0..1 across the width)
            ch = im.height; cw = round(ch * 4 / 5)
            cx = round(it.get('foco', 0.5) * im.width)
            x0 = min(max(0, cx - cw // 2), im.width - cw)
            mob = im.crop((x0, 0, x0 + cw, ch)).resize((1080, 1350), Image.LANCZOS)
            mob.save(os.path.join(DEST, 'web', name + '-mobile.webp'), quality=84, method=6)
            mob.save(os.path.join(DEST, 'web', name + '-mobile.avif'), quality=62)
            mobile = {'webp': f'web/{name}-mobile.webp', 'avif': f'web/{name}-mobile.avif', 'largura': 1080, 'altura': 1350}
        th = im.resize((480, round(im.height * 480 / im.width)), Image.LANCZOS)
        th.save(os.path.join(DEST, 'miniatura', name + '.webp'), quality=80, method=6)
        variantes = []
        for vf in sorted(glob.glob(os.path.join(HERE, 'out', it['key'] + '~*.jpg'))):
            vslug = os.path.basename(vf)[:-4].split('~', 1)[1]
            vim = Image.open(vf).convert('RGB')
            vw = vim.resize((web_w, round(vim.height * web_w / vim.width)), Image.LANCZOS)
            vw.save(os.path.join(DEST, 'web', f'{name}~{vslug}.webp'), quality=84, method=6)
            vim.resize((480, round(vim.height * 480 / vim.width)), Image.LANCZOS).save(os.path.join(DEST, 'miniatura', f'{name}~{vslug}.webp'), quality=80, method=6)
            variantes.append({'cor': vslug, 'webp': f'web/{name}~{vslug}.webp', 'miniatura': f'miniatura/{name}~{vslug}.webp'})
        out.append({
            'arquivo': name,
            'origem': f"img/v2/{it['key'].split('--')[0]}.webp",
            'produto': it['produto'],
            'marca': it['marca'],
            'marca_ficticia': bool(it.get('ficticia')),
            'nivel': it['nivel'],
            'tecnicas': it['tecnicas'],
            'alt': it['alt'],
            'mestre': {'arquivo': f'mestre/{name}.jpg', 'largura': im.width, 'altura': im.height},
            'web': {'webp': f'web/{name}.webp', 'avif': f'web/{name}.avif', 'largura': web.width, 'altura': web.height},
            'miniatura': {'arquivo': f'miniatura/{name}.webp', 'largura': th.width, 'altura': th.height},
            **({'mobile': mobile} if mobile else {}),
            **({'variantes': variantes} if variantes else {}),
        })
        print(name, im.size, flush=True)
    json.dump(out, open(os.path.join(DEST, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main(sys.argv[1])
