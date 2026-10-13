"""Copy the branded mockups (midia/mockups/web) into img/marca/ for the site build,
and write src/data/mockups.json (alt text and fictional-brand flag by image name).

The site only uses them when built with MOCKUPS_MARCA=1 (or "mockups_marca": true in
site.config.json). Without the flag the build keeps the unbranded v2 photos.

Usage: python tools/sync_mockups.py
"""
import json, os, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOCK = os.path.join(ROOT, 'midia', 'mockups')
DEST = os.path.join(ROOT, 'img', 'marca')


def main():
    man = json.load(open(os.path.join(MOCK, 'manifest.json'), encoding='utf-8'))
    os.makedirs(DEST, exist_ok=True)
    data = {}
    for m in man:
        origem = os.path.basename(m['origem'])[:-5]            # e.g. caderno-azul
        comparison = m['produto'].startswith('comparação:')
        name = f"{origem}--{m['arquivo'].split('-ficticia-')[-1]}" if comparison else origem
        shutil.copy2(os.path.join(MOCK, m['web']['webp']), os.path.join(DEST, name + '.webp'))
        data[name] = {'alt': m['alt'], 'marca': m['marca'], 'ficticia': m['marca_ficticia'], 'comparacao': comparison}
    json.dump(data, open(os.path.join(ROOT, 'src', 'data', 'mockups.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(data)} imagens em img/marca/')


if __name__ == '__main__':
    main()
