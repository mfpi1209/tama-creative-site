"""Liga as cores dos destaques da home (src/data/home-produtos.json) às fotos que existem no banco.

Para cada cor de cada destaque, se o banco tem <produto>~<cor-slug> (produto = parte antes do ~ na foto-base do
destaque), a cor passa a apontar para essa foto; cores sem foto continuam só como referência. Rode depois de
gerar variações (tools/gerar_cores.py).
"""
import json, os, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOME = os.path.join(ROOT, 'src', 'data', 'home-produtos.json')
INV = os.path.join(ROOT, 'src', 'data', 'produtos.json')


def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return '-'.join(''.join(c if c.isalnum() else ' ' for c in s).split())


def main():
    inv = {e['id']: e for e in json.load(open(INV, encoding='utf-8'))['imagens'] if e.get('aprovacao') not in ('retirada', 'substituir')}
    d = json.load(open(HOME, encoding='utf-8'))
    ligadas = 0
    for h in d['produtos']:
        produto = h['img'].split('~')[0]
        novas = []
        for c in h['cores']:
            nome, hexv = c[0], c[1]
            id_ = f'{produto}~{slug(nome)}'
            if len(c) > 2 and c[2] in inv:
                novas.append(c)                                   # já ligada
            elif id_ in inv:
                novas.append([nome, hexv, id_, inv[id_]['alt'].rstrip('.').lower()]); ligadas += 1
            else:
                novas.append([nome, hexv])
        h['cores'] = novas
        # uso: a home passa a usar as fotos ligadas
        for c in novas:
            if len(c) > 2 and 'home' not in inv[c[2]]['uso']:
                inv[c[2]]['uso'].insert(0, 'home')
    json.dump(d, open(HOME, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); open(HOME, 'a').write('\n')
    full = json.load(open(INV, encoding='utf-8'))
    for e in full['imagens']:
        if e['id'] in inv:
            e['uso'] = inv[e['id']]['uso']
    json.dump(full, open(INV, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); open(INV, 'a').write('\n')
    print(f'{ligadas} cor(es) da home ligadas a fotos')


if __name__ == '__main__':
    main()
