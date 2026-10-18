"""Gera e importa as variações de cor que faltam, conforme src/data/plano-cores.json.

Para cada foto-base do plano e cada cor sem foto no banco: chama tools/variacoes.py (API da OpenAI, custa dinheiro),
importa com tools/produtos.py e copia os campos de catálogo da foto-base trocando a cor. Pode ser interrompido e
retomado: o que já existe não é gerado de novo.

Uso:
  python -I tools/gerar_cores.py --listar            # só mostra o que falta (sem custo)
  python -I tools/gerar_cores.py [--limite N] [--so <id-base> ...] [--qualidade medium]
"""
import argparse, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLANO = os.path.join(ROOT, 'src', 'data', 'plano-cores.json')
INV = os.path.join(ROOT, 'src', 'data', 'produtos.json')
GERADAS = os.path.join(ROOT, 'midia', 'produtos', 'geradas')
PY = sys.executable


def slug(s):
    import unicodedata
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return '-'.join(''.join(c if c.isalnum() else ' ' for c in s).split())


def faltantes():
    plano = json.load(open(PLANO, encoding='utf-8'))
    inv = json.load(open(INV, encoding='utf-8'))
    ids = {e['id'] for e in inv['imagens']}
    out = []
    for base, cores in plano['paleta'].items():
        if base not in ids:
            print(f'aviso: foto-base {base} não está no banco; pulando', file=sys.stderr); continue
        produto = base.split('~')[0]
        for cor in cores:
            id_ = f'{produto}~{slug(cor)}'
            if id_ not in ids:
                out.append((base, cor, plano['cores'][cor], id_))
    return out


def importar(base, cor, hexv, id_):
    inv = json.load(open(INV, encoding='utf-8'))
    b = next(e for e in inv['imagens'] if e['id'] == base)
    org = 'Variação de cor gerada com IA (OpenAI gpt-image-1.5, edição a partir da foto-base) em ' + __import__('datetime').date.today().strftime('%d/%m/%Y') + '. Ilustrativa: não é foto do produto final.'
    subprocess.run([PY, '-I', os.path.join(ROOT, 'tools', 'produtos.py'), 'importar', os.path.join(GERADAS, id_ + '.png'), '--id', id_, '--origem', org], check=True, capture_output=True)
    inv = json.load(open(INV, encoding='utf-8'))
    e = next(x for x in inv['imagens'] if x['id'] == id_)
    alt = b['alt'].replace(b['cor']['nome'].lower(), cor.lower()).replace(b['cor']['nome'], cor.lower())
    e.update(produto=b['produto'], categoria=b['categoria'], modelo=b['modelo'], cor={'nome': cor, 'hex': hexv}, material=dict(b['material']), tecnica=dict(b['tecnica']),
             alt=alt, uso=['catalogo'], observacao=f'Variação de cor gerada a partir da foto-base {base}.')
    json.dump(inv, open(INV, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); open(INV, 'a').write('\n')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--listar', action='store_true'); ap.add_argument('--limite', type=int, default=0)
    ap.add_argument('--so', nargs='*', default=[]); ap.add_argument('--qualidade', default='medium')
    a = ap.parse_args()
    falta = [f for f in faltantes() if not a.so or f[0] in a.so]
    if a.listar or not falta:
        for base, cor, _h, id_ in falta:
            print(f'{id_:40} ← {base}')
        print(f'{len(falta)} imagem(ns) a gerar'); return
    if a.limite:
        falta = falta[:a.limite]
    feitas = 0
    for base, cor, hexv, id_ in falta:
        r = subprocess.run([PY, '-I', os.path.join(ROOT, 'tools', 'variacoes.py'), base, cor, hexv, '--qualidade', a.qualidade], capture_output=True, text=True)
        if r.returncode:
            print(f'parou em {id_}: {r.stderr.strip()[-300:] or r.stdout.strip()[-300:]}'); break
        importar(base, cor, hexv, id_); feitas += 1
        print(f'{feitas}/{len(falta)} {id_}')
    print(f'{feitas} geradas e importadas; rode: python -I tools/produtos.py verificar && python build.py')


if __name__ == '__main__':
    main()
