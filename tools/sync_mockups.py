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


PECAS = {p['img']: p for p in json.load(open(os.path.join(ROOT, 'src', 'data', 'curadoria.json'), encoding='utf-8'))['pecas']}


def _slug(s):
    import unicodedata
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return '-'.join(''.join(c if c.isalnum() else ' ' for c in s).split())


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
        # colour variants: img/marca/<photo>~<colour-slug>.webp (the site swaps to them when a colour chip is clicked)
        peca = PECAS.get(origem)
        for v in m.get('variantes', []):
            vname = f"{origem}~{v['cor']}"
            shutil.copy2(os.path.join(MOCK, v['webp']), os.path.join(DEST, vname + '.webp'))
            cor = next((n for n, _ in (peca['cores'] if peca else []) if _slug(n) == v['cor']), v['cor'])
            nome = peca['nome'] if peca else origem
            sufixo = 'Mockup ilustrativo com marca fictícia.' if m['marca_ficticia'] else 'Mockup ilustrativo.'
            data[vname] = {'alt': f"{nome} na cor {cor.lower()}, com a marca {m['marca'].replace(' (fictícia)', '')} aplicada. {sufixo}",
                           'marca': m['marca'], 'ficticia': m['marca_ficticia'], 'comparacao': False}
    json.dump(data, open(os.path.join(ROOT, 'src', 'data', 'mockups.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(data)} imagens em img/marca/ ({sum(1 for k in data if "~" in k)} variantes de cor)')


if __name__ == '__main__':
    main()
