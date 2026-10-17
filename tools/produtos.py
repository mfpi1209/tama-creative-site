"""Banco de imagens de produto: importa, confere e gera o índice visual.

Fonte da verdade: src/data/produtos.json (uma entrada por imagem). Os originais ficam em midia/produtos/mestre/
(fora do Git); o site usa img/produtos/<id>.webp, que o build converte em AVIF/WebP/JPEG em vários tamanhos.

Uso:
  python -I tools/produtos.py importar <arquivo.png|jpg> --id <produto>[-<modelo>]~<cor> [--substitui <id>]
      copia o original para midia/produtos/mestre/, gera img/produtos/<id>.webp e cria (ou atualiza) a entrada
      no inventário com os campos técnicos; os campos de catálogo ficam para preencher à mão.
  python -I tools/produtos.py verificar
      confere arquivos, dimensões, hashes, campos obrigatórios e lista o que está "a_confirmar" ou em revisão.
  python -I tools/produtos.py indice
      escreve midia/produtos/indice.html: todas as imagens com os dados, para revisar e aprovar.
Ver docs/BANCO-IMAGENS.md.
"""
import argparse, datetime, hashlib, html, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INV = os.path.join(ROOT, 'src', 'data', 'produtos.json')
MESTRE = os.path.join(ROOT, 'midia', 'produtos', 'mestre')
WEB = os.path.join(ROOT, 'img', 'produtos')
INDICE = os.path.join(ROOT, 'midia', 'produtos', 'indice.html')
ID_RE = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*(~[a-z0-9]+(-[a-z0-9]+)*)?$')
OBRIGATORIOS = ('produto', 'categoria', 'cor', 'alt', 'aprovacao', 'origem')
APROVACAO = ('revisao', 'aprovada', 'substituir', 'retirada')
CATEGORIAS = ('vestuario', 'canetas-escritorio', 'bolsas-embalagens', 'garrafas-copos', 'acessorios', 'casa-bem-estar', 'hotelaria-gastronomia')


def carregar():
    return json.load(open(INV, encoding='utf-8')) if os.path.exists(INV) else {'observacao': '', 'imagens': []}


def salvar(inv):
    json.dump(inv, open(INV, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open(INV, 'a', encoding='utf-8').write('\n')


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def importar(src, id_, substitui=None, origem=None):
    from PIL import Image
    if not ID_RE.match(id_):
        sys.exit(f'id inválido: {id_}. Use <produto>[-<modelo>]~<cor>, só minúsculas, números e hífen (ex.: caneta-roller~bordo).')
    os.makedirs(MESTRE, exist_ok=True); os.makedirs(WEB, exist_ok=True)
    im = Image.open(src)
    ext = os.path.splitext(src)[1].lower()
    mestre = os.path.join(MESTRE, id_ + ext)
    if os.path.abspath(src) != os.path.abspath(mestre):
        with open(src, 'rb') as a, open(mestre, 'wb') as b:
            b.write(a.read())
    web = os.path.join(WEB, id_ + '.webp')
    im.convert('RGB').save(web, 'WEBP', quality=92, method=6)
    inv = carregar()
    ent = next((e for e in inv['imagens'] if e['id'] == id_), None)
    novo = ent is None
    if novo:
        ent = {'id': id_, 'produto': '', 'categoria': '', 'modelo': '', 'cor': {'nome': '', 'hex': ''},
               'material': {'valor': '', 'status': 'a_confirmar'}, 'tecnica': {'valor': '', 'status': 'a_confirmar'},
               'fornecedor': None, 'sku': None, 'estoque': None, 'alt': '', 'uso': [], 'ilustrativa': True,
               'aprovacao': 'revisao', 'origem': origem or '', 'substitui': substitui, 'observacao': ''}
        inv['imagens'].append(ent)
    ent.update({'arquivo': '/' + os.path.relpath(web, ROOT),   # caminho público (o editor /admin/ mostra a foto por ele)
                'mestre': os.path.relpath(mestre, ROOT), 'largura': im.width, 'altura': im.height,
                'sha256': sha256(mestre), 'bytes': os.path.getsize(mestre), 'atualizado_em': datetime.date.today().isoformat()})
    if substitui:
        ent['substitui'] = substitui
        ant = next((e for e in inv['imagens'] if e['id'] == substitui), None)
        if ant and ant['aprovacao'] != 'retirada':
            ant['aprovacao'] = 'retirada'; ant['observacao'] = (ant.get('observacao') or '') + f' Substituída por {id_}.'
    inv['imagens'].sort(key=lambda e: e['id'])
    salvar(inv)
    print(f"{'nova' if novo else 'atualizada'}: {id_} ({im.width}x{im.height}) → {ent['arquivo']}" + (' — preencha produto, categoria, cor e alt no inventário' if novo else ''))


def verificar():
    inv = carregar(); erros = []; avisos = []
    ids = [e['id'] for e in inv['imagens']]
    for d in {i for i in ids if ids.count(i) > 1}:
        erros.append(f'id repetido: {d}')
    for e in inv['imagens']:
        p = e['id']
        for k in OBRIGATORIOS:
            v = e.get(k)
            if not v or (k == 'cor' and not (v.get('nome') and v.get('hex'))):
                erros.append(f'{p}: falta {k}')
        if e.get('categoria') and e['categoria'] not in CATEGORIAS:
            erros.append(f'{p}: categoria desconhecida "{e["categoria"]}" (válidas: {", ".join(CATEGORIAS)})')
        if e.get('aprovacao') not in APROVACAO:
            erros.append(f'{p}: aprovacao deve ser uma de {APROVACAO}')
        web = os.path.join(ROOT, (e.get('arquivo') or '').lstrip('/'))
        if not e.get('arquivo') or not os.path.exists(web):
            erros.append(f'{p}: arquivo web não encontrado ({e.get("arquivo")})')
        mestre = os.path.join(ROOT, e.get('mestre', ''))
        if os.path.exists(mestre):
            if sha256(mestre) != e.get('sha256'):
                erros.append(f'{p}: o original mudou e o hash não bate; reimporte com "importar"')
        else:
            avisos.append(f'{p}: original ausente neste computador ({e.get("mestre")})')
        if e.get('aprovacao') == 'revisao':
            avisos.append(f'{p}: em revisão')
        for k in ('material', 'tecnica'):
            if (e.get(k) or {}).get('status') == 'a_confirmar':
                avisos.append(f'{p}: {k} a confirmar ({(e.get(k) or {}).get("valor") or "sem valor"})')
        if e.get('uso') and e.get('aprovacao') in ('substituir', 'retirada'):
            erros.append(f'{p}: está em uso ({", ".join(e["uso"])}) mas marcada como {e["aprovacao"]}')
    soltos = sorted(set(os.listdir(WEB)) - {os.path.basename(e.get('arquivo', '')) for e in inv['imagens']}) if os.path.isdir(WEB) else []
    for f in soltos:
        if f.endswith('.webp'):
            erros.append(f'img/produtos/{f} não está no inventário')
    for a in avisos:
        print('aviso:', a)
    for e in erros:
        print('ERRO:', e)
    print(f'{len(inv["imagens"])} imagens · {len(erros)} erro(s) · {len(avisos)} aviso(s)')
    return 1 if erros else 0


def indice():
    inv = carregar()
    por_cat = {}
    for e in sorted(inv['imagens'], key=lambda x: (x.get('categoria', ''), x.get('produto', ''), x['id'])):
        por_cat.setdefault(e.get('categoria') or 'sem categoria', []).append(e)
    css = ('body{font:14px/1.5 -apple-system,Helvetica,Arial;margin:24px;color:#282322;background:#FAF7F2}h1{font-weight:400}h2{margin-top:36px;font-weight:400;border-bottom:1px solid #E6DDD3}'
           '.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}.c{background:#fff;border:1px solid #E6DDD3;border-radius:6px;overflow:hidden}'
           '.c img{width:100%;aspect-ratio:1;object-fit:cover;display:block}.c div{padding:10px 12px;font-size:12px}.c b{display:block;font-size:14px}.t{display:inline-block;padding:1px 7px;border-radius:9px;background:#EEE;margin:2px 2px 0 0}'
           '.aprovada{background:#D8EBDD}.revisao{background:#F6E7C8}.substituir,.retirada{background:#F3D3D3}.ac{color:#9A4B1E}.sw{display:inline-block;width:11px;height:11px;border-radius:50%;border:1px solid #0002;vertical-align:-1px;margin-right:4px}')
    cards = []
    for cat, lista in por_cat.items():
        cards.append(f'<h2>{html.escape(cat)} <small>({len(lista)})</small></h2><div class="g">')
        for e in lista:
            cor = e.get('cor') or {}
            mat, tec = e.get('material') or {}, e.get('tecnica') or {}
            ac = lambda d: ' <span class="ac">(a confirmar)</span>' if d.get('status') == 'a_confirmar' else ''
            cards.append(
                f'<div class="c"><img src="../../{html.escape(e["arquivo"].lstrip("/"))}" alt="{html.escape(e.get("alt", ""))}" loading="lazy"><div>'
                f'<b>{html.escape(e.get("produto", ""))}</b>{html.escape(e.get("modelo") or "")}<br>'
                f'<span class="sw" style="background:{html.escape(cor.get("hex", "#fff"))}"></span>{html.escape(cor.get("nome", ""))} · {e.get("largura")}×{e.get("altura")}<br>'
                f'{html.escape(mat.get("valor") or "material?")}{ac(mat)} · {html.escape(tec.get("valor") or "técnica?")}{ac(tec)}<br>'
                f'<span class="t {html.escape(e.get("aprovacao", ""))}">{html.escape(e.get("aprovacao", ""))}</span>'
                + ''.join(f'<span class="t">{html.escape(u)}</span>' for u in e.get('uso') or [])
                + f'<br><code>{html.escape(e["id"])}</code></div></div>')
        cards.append('</div>')
    doc = (f'<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Banco de imagens de produto · TaMa</title><style>{css}</style>'
           f'<h1>Banco de imagens de produto <small>({len(inv["imagens"])})</small></h1><p>{html.escape(inv.get("observacao", ""))}</p>' + ''.join(cards))
    os.makedirs(os.path.dirname(INDICE), exist_ok=True)
    open(INDICE, 'w', encoding='utf-8').write(doc)
    print('índice:', os.path.relpath(INDICE, ROOT))


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    i = sub.add_parser('importar'); i.add_argument('arquivo'); i.add_argument('--id', required=True); i.add_argument('--substitui'); i.add_argument('--origem')
    sub.add_parser('verificar'); sub.add_parser('indice')
    a = ap.parse_args()
    if a.cmd == 'importar':
        importar(a.arquivo, a.id, a.substitui, a.origem)
    elif a.cmd == 'verificar':
        sys.exit(verificar())
    else:
        indice()
