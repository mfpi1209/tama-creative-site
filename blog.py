#!/usr/bin/env python3
"""Blog da TaMa Creative (/blog/): artigos em Markdown com front matter em src/blog/.

Ganchos usados por build.py (o módulo build é passado como `b`):
    blog.pages(b)     -> funções de página, no mesmo formato de build.PAGES
    blog.image_sources(img_dir) -> imagens enviadas pelo editor (img/blog/) para o processamento de imagens
    blog.finalize(b)  -> valida links internos, grava /blog/feed.xml e as imagens OG dos artigos
    blog.post_static(b) -> editor do blog em /admin/ (Decap CMS) com config gerada dos dados do site

Passo a passo para escrever e publicar um artigo: docs/BLOG.md.
Variável de ambiente BLOG_DRAFTS=1 inclui rascunhos (draft: true) e datas futuras, sempre com noindex.
"""
import html
import io
import json
import os
import re
import shutil
import unicodedata
import urllib.parse
from datetime import date, datetime, timedelta, timezone
from email.utils import format_datetime

import markdown
import yaml

ROOT = os.path.dirname(os.path.abspath(__file__))
BLOG_SRC = os.path.join(ROOT, 'src', 'blog')
BLOG_CSS = os.path.join(ROOT, 'src', 'blog.css')
ADMIN_SRC = os.path.join(ROOT, 'src', 'admin')
CMS_REPO = os.environ.get('CMS_REPO', 'mfpi1209/tama-creative-site')   # repositório GitHub (privado) que o editor edita
CMS_SITE_DOMAIN = 'tamacreative.netlify.app'                    # site do Netlify que faz o login (OAuth GitHub)
IMG_EXT = ('.jpg', '.jpeg', '.png', '.webp')
BLOG_IMG = {}  # chave -> arquivo de img/blog/ (imagens enviadas pelo editor)
DRAFTS = os.environ.get('BLOG_DRAFTS', '').lower() in ('1', 'true', 'yes')

# Temas do blog. A página /blog/tema/<chave>/ só é gerada quando o tema tem TEMA_MIN artigos publicados;
# antes disso o tema aparece só como etiqueta (evita páginas rasas no Google).
TEMAS = {
    'fim-de-ano': ('Fim de ano', 'Presentes para clientes, equipes e parceiros no encerramento do ano.'),
    'boas-vindas': ('Boas-vindas', 'Kits e rituais para receber quem chega à empresa.'),
    'politicas': ('Compliance e políticas', 'Regras, limites e boas práticas para presentear com segurança.'),
    'eventos': ('Eventos', 'Peças e kits que acompanham encontros, feiras e convenções.'),
    'sustentabilidade': ('Sustentabilidade', 'Materiais, escolhas e cuidados para brindes que duram.'),
    'marca': ('Marca e identidade', 'Como a identidade visual ganha forma em objetos, embalagens e vestuário.'),
    'uniformes': ('Uniformes e confecções', 'Tecidos, modelagens e personalização para quem veste a marca.'),
}
TEMA_MIN = 3
TIPOS = ('brindes', 'kits', 'confeccoes', 'branding', 'integrado')
MESES = ('janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro')
BRT = timezone(timedelta(hours=-3))
FEED_PATH = '/blog/feed.xml'
SLUG_RE = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')

# Pautas (src/pautas/*.md): planejamento editorial editado em /admin/ e lido pelo painel /admin/painel/.
# Ficam só no repositório (privado): o build valida, mas não publica nada delas.
PAUTAS_SRC = os.path.join(ROOT, 'src', 'pautas')
STATUS_PAUTA = {
    'ideia': 'Ideia', 'aprovada': 'Aprovada', 'escrevendo': 'Escrevendo', 'revisao': 'Em revisão',
    'publicada': 'Publicada', 'espera': 'Em espera', 'descartada': 'Descartada',
}
PRIORIDADES = {'alta': 'Alta', 'media': 'Média', 'baixa': 'Baixa'}
INTENCOES = {'informacional': 'Informacional', 'comercial': 'Comercial', 'transacional': 'Transacional'}

# Consulta principal e secundárias de cada página do site (mapa de palavras-chave de docs/SEO.md).
# O painel compara artigos e pautas com estas consultas para apontar canibalização.
CONSULTAS_PAGINAS = {
    '/': ('estúdio de brindes corporativos e branding', ['brindes, kits e uniformes personalizados para empresas']),
    '/brindes-corporativos/': ('brindes corporativos personalizados', ['brindes personalizados para empresas', 'curadoria de brindes corporativos']),
    '/brindes-corporativos-premium/': ('brindes corporativos premium', ['ideias de brindes corporativos premium', 'presentes corporativos exclusivos', 'brindes para clientes VIP']),
    '/kits-corporativos/': ('kit corporativo personalizado', ['kit onboarding personalizado', 'kit de boas-vindas para colaboradores', 'kit para eventos corporativos']),
    '/confeccoes-personalizadas/': ('uniformes corporativos personalizados', ['confecção personalizada para empresas', 'camisa polo bordada para empresa']),
    '/branding-identidade-visual/': ('criação de identidade visual para empresas', ['branding para empresas', 'identidade visual corporativa', 'manual de marca']),
    '/sobre/': ('TaMa Creative', ['estúdio criativo trade marketing']),
    '/solicitar-proposta/': ('orçamento de brindes corporativos', ['orçamento de kit corporativo']),
}

ARTS = []      # artigos publicados nesta build (mais recentes primeiro)
SLUGS = set()  # todos os artigos de src/blog/, inclusive rascunhos
ERRORS = []


def _err(msg):
    ERRORS.append(msg)


# ------------------------------------------------------------------ imagens enviadas pelo editor (img/blog/)
def image_key(filename):
    """Nome interno (e das URLs geradas) de uma imagem de img/blog/: 'Foto Kit.JPG' -> 'blog-foto-kit'."""
    stem = os.path.splitext(os.path.basename(urllib.parse.unquote(str(filename))))[0]
    stem = unicodedata.normalize('NFKD', stem).encode('ascii', 'ignore').decode('ascii').lower()
    return 'blog-' + (re.sub(r'[^a-z0-9]+', '-', stem).strip('-') or 'imagem')


def image_sources(img_src):
    """Chamado por build.build_images(): devolve [(chave, arquivo)] das imagens de img/blog/."""
    folder = os.path.join(img_src, 'blog')
    BLOG_IMG.clear()
    if os.path.isdir(folder):
        for fn in sorted(os.listdir(folder)):
            if fn.lower().endswith(IMG_EXT):
                BLOG_IMG[image_key(fn)] = os.path.join(folder, fn)
    return sorted(BLOG_IMG.items())


# ------------------------------------------------------------------ leitura dos arquivos
def parse_front(text, fn):
    """Front matter em YAML (o mesmo formato que o editor /admin/ grava). Textos com ':' vão entre aspas."""
    m = re.match(r'^﻿?---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(?:\r?\n(.*))?$', text, re.S)
    if not m:
        _err(f'{fn}: falta o front matter (bloco entre duas linhas ---)')
        return {}, text
    try:
        meta = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError as e:
        mark = getattr(e, 'problem_mark', None)
        where = f' (linha {mark.line + 2})' if mark else ''
        _err(f'{fn}: front matter inválido{where}. Textos com dois-pontos precisam de aspas: title: "A: B"')
        return {}, m.group(2) or ''
    if not isinstance(meta, dict):
        _err(f'{fn}: front matter precisa ser uma lista de campos "chave: valor"')
        return {}, m.group(2) or ''
    for k, v in list(meta.items()):
        if v is None:
            meta[k] = ''
        elif isinstance(v, list):
            meta[k] = [str(x) for x in v if x not in (None, '')]
    return meta, m.group(2) or ''


def _date(v, fn, field):
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    try:
        return date.fromisoformat(str(v).strip()[:10])
    except ValueError:
        _err(f'{fn}: {field} deve estar no formato AAAA-MM-DD (recebido {v!r})')
        return None


def fmt_date(d):
    return f'{d.day} de {MESES[d.month - 1]} de {d.year}'


# ------------------------------------------------------------------ Markdown
def _slugify(value, separator='-'):
    import unicodedata
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode('ascii')
    value = re.sub(r'[^\w\s-]', '', value).strip().lower()
    return re.sub(r'[\s_-]+', separator, value)


def render_markdown(b, body, a):
    # O editor visual escapa colchetes; desfaz nos atalhos do blog (notas de fonte e [[cta]]).
    body = re.sub(r'\\\[\^', '[^', body)                    # \[^nota  -> [^nota
    body = re.sub(r'(\[\^[^\]\s]+)\\\]', r'\1]', body)      # [^nota\] -> [^nota]
    body = re.sub(r'\\\[\\\[cta(.*?)\\\]\\\]', r'[[cta\1]]', body)  # \[\[cta\]\] -> [[cta]]
    md = markdown.Markdown(
        extensions=['tables', 'footnotes', 'attr_list', 'def_list', 'abbr', 'sane_lists', 'smarty', 'toc'],
        extension_configs={
            'toc': {'slugify': _slugify, 'toc_depth': '2-3'},
            'footnotes': {'BACKLINK_TEXT': '↑', 'BACKLINK_TITLE': 'Voltar ao trecho da nota %d'},
            'smarty': {'smart_angled_quotes': False},
        })
    out = md.convert(body)
    toc = [(t['id'], t['name']) for t in md.toc_tokens if t['level'] == 2]
    fn = a['file']
    if re.search(r'<h1[\s>]', out):
        _err(f'{fn}: o corpo não pode ter título nível 1 (# ...); o H1 vem do campo title. Use ## e ###.')
    if '[fonte?]' in out or 'TODO' in out:
        _err(f'{fn}: há marcações pendentes ([fonte?] ou TODO) no texto')
    # Notas de rodapé -> seção "Fontes"
    out = re.sub(r'<a class="footnote-ref" href="#fn:([^"]+)">(\d+)</a>', r'<a class="footnote-ref" href="#fn:\1" aria-label="Fonte \2">\2</a>', out)
    out = re.sub(r'<a class="footnote-backref" href="#fnref:([^"]+)" title="([^"]*)">', r'<a class="footnote-backref" href="#fnref:\1" title="\2" aria-label="\2">', out)
    out = re.sub(r'<div class="footnote">\s*<hr\s*/?>\s*(.*)</div>\s*$',
                 r'<section class="sources" aria-labelledby="fontes-t"><h2 id="fontes-t">Fontes</h2>\1</section>', out, flags=re.S)
    # Imagens no texto: só de img/blog/ (enviadas pelo editor), com texto alternativo; viram <picture> otimizado
    def figure(m):
        wrap = m.group(1) is not None
        tag = m.group(1) if wrap else m.group(0)
        src = (re.search(r'src="([^"]*)"', tag) or [None, ''])[1]
        alt = html.unescape((re.search(r'alt="([^"]*)"', tag) or [None, ''])[1])
        title = (re.search(r'title="([^"]*)"', tag) or [None, ''])[1]
        key = image_key(src)
        if not src.startswith('/img/blog/') or key not in b.IMAGES:
            _err(f'{fn}: imagem {src!r} não está em img/blog/ (envie pela biblioteca de mídia do editor)')
            return m.group(0)
        if not alt.strip():
            _err(f'{fn}: imagem {src!r} sem texto alternativo (descreva o que aparece na foto)')
        pic = b.picture(key, alt, '(max-width: 760px) 92vw, 704px')
        if not wrap:
            return pic
        return f'<figure class="post-figure">{pic}' + (f'<figcaption>{title}</figcaption>' if title else '') + '</figure>'
    out = re.sub(r'<p>\s*(<img [^>]*>)\s*</p>|<img [^>]*>', figure, out)  # uma passada: o <img> gerado não é reprocessado
    # Tabelas roláveis no celular
    out = re.sub(r'<table>', '<div class="table-wrap" role="region" tabindex="0" aria-label="Tabela (role para ver tudo)"><table>', out)
    out = out.replace('</table>', '</table></div>')
    # Atalho [[cta]] ou [[cta: texto]] -> chamada para a proposta dentro do texto
    def cta(m):
        text = m.group(1) or 'Quer ajuda para transformar estas ideias em uma seleção com a sua marca? Conte a ocasião e a TaMa propõe as peças.'
        return (f'<aside class="post-callout" aria-label="Solicitar proposta"><p>{text}</p>'
                f'{b.cta_link("Solicitar proposta", tipo=a["proposta"], track_label="blog-meio-" + a["slug"])}</aside>')
    out = re.sub(r'<p>\[\[cta(?::\s*(.*?))?\]\]</p>', cta, out)
    if '[[' in out:
        _err(f'{fn}: atalho desconhecido entre [[ ]] (só existe [[cta]] ou [[cta: texto]])')
    words = len(re.sub(r'<[^>]+>', ' ', out).split())
    return out, toc, words


# ------------------------------------------------------------------ carga e validação
def load(b):
    ARTS.clear()
    ERRORS.clear()
    if not os.path.isdir(BLOG_SRC):
        return
    today = date.today()
    known_items = set(b.PECA) | {it['slug'] for it in b.ALEM}
    seen = {}
    for fname in sorted(os.listdir(BLOG_SRC)):
        if not fname.endswith('.md') or fname.startswith(('_', '.')):
            continue
        fn = 'src/blog/' + fname
        meta, body = parse_front(open(os.path.join(BLOG_SRC, fname), encoding='utf-8').read(), fn)
        slug = str(meta.get('slug') or re.sub(r'^\d{4}-\d{2}-\d{2}-', '', fname[:-3]))
        a = {'file': fn, 'slug': slug, 'path': f'/blog/{slug}/'}
        if not SLUG_RE.match(slug):
            _err(f'{fn}: slug inválido {slug!r} (use minúsculas, números e hífens)')
        if slug in seen:
            _err(f'{fn}: slug {slug!r} repetido (já usado em {seen[slug]})')
        seen[slug] = fn
        for field in ('title', 'description', 'date', 'tema', 'capa_alt'):
            if not meta.get(field):
                _err(f'{fn}: campo obrigatório ausente: {field}')
        if not meta.get('capa') and not meta.get('capa_arquivo'):
            _err(f'{fn}: escolha uma capa da biblioteca (capa) ou envie uma imagem (capa_arquivo)')
        a['title'] = str(meta.get('title', ''))
        a['seo_title'] = str(meta.get('seo_title') or (f'{a["title"]} | TaMa Creative' if len(a['title']) <= 49 else a['title']))
        a['description'] = str(meta.get('description', ''))
        a['breadcrumb'] = str(meta.get('breadcrumb') or a['title'])
        if len(a['title']) > 110:
            _err(f'{fn}: title com {len(a["title"])} caracteres (máximo 110)')
        if len(a['seo_title']) > 70:
            _err(f'{fn}: seo_title com {len(a["seo_title"])} caracteres (máximo 70; ideal até 65)')
        if a['description'] and not 70 <= len(a['description']) <= 160:
            _err(f'{fn}: description com {len(a["description"])} caracteres (use de 70 a 160)')
        a['date'] = _date(meta.get('date', ''), fn, 'date') or today
        a['updated'] = _date(meta['updated'], fn, 'updated') if meta.get('updated') else a['date']
        if a['updated'] < a['date']:
            _err(f'{fn}: updated é anterior a date')
        a['tema'] = meta.get('tema', '')
        if a['tema'] and a['tema'] not in TEMAS:
            _err(f'{fn}: tema {a["tema"]!r} não existe (opções: {", ".join(TEMAS)})')
        a['ocasiao'] = meta.get('ocasiao') or None
        if a['ocasiao'] and a['ocasiao'] not in b.OCCS:
            _err(f'{fn}: ocasiao {a["ocasiao"]!r} não existe na curadoria (opções: {", ".join(b.OCCS)})')
        a['servico'] = meta.get('servico') or None
        a['proposta'] = meta.get('proposta') or None
        if a['proposta'] and a['proposta'] not in TIPOS:
            _err(f'{fn}: proposta {a["proposta"]!r} inválida (opções: {", ".join(TIPOS)})')
        arquivo = str(meta.get('capa_arquivo') or '')
        if arquivo and not re.match(r'^/?img/blog/', arquivo):
            _err(f'{fn}: capa_arquivo deve estar em img/blog/ (recebido {arquivo!r})')
        a['capa'] = image_key(arquivo) if arquivo else str(meta.get('capa', ''))
        if a['capa'] and a['capa'] not in b.IMAGES:
            _err(f'{fn}: capa {arquivo or a["capa"]!r} não encontrada em img/, img/v2/ ou img/blog/')
        a['capa_alt'] = str(meta.get('capa_alt', ''))
        a['capa_conceitual'] = meta.get('capa_conceitual', True) is not False
        a['capa_posicao'] = meta.get('capa_posicao') or ''
        a['pecas'] = meta.get('pecas') or []
        for s in a['pecas']:
            if s not in known_items:
                _err(f'{fn}: peça {s!r} não existe em src/data/curadoria.json')
        a['relacionados'] = [re.sub(r'^\d{4}-\d{2}-\d{2}-', '', s) for s in (meta.get('relacionados') or [])]
        a['palavra_chave'] = meta.get('palavra_chave') or ''
        a['revisar_em'] = _date(meta['revisar_em'], fn, 'revisar_em') if meta.get('revisar_em') else None
        a['revisar_motivo'] = str(meta.get('revisar_motivo') or '')
        if a['revisar_motivo'] and not a['revisar_em']:
            _err(f'{fn}: revisar_motivo sem revisar_em (informe a data da próxima revisão)')
        a['draft'] = meta.get('draft') is True
        a['destaque'] = meta.get('destaque') is True
        scheduled = a['date'] > today
        if (a['draft'] or scheduled) and not DRAFTS:
            continue
        a['noindex'] = a['draft'] or scheduled
        a['html'], a['toc'], a['words'] = render_markdown(b, body, a)
        a['minutes'] = max(1, round(a['words'] / 200))
        ARTS.append(a)
    # Mais recentes primeiro; no mesmo dia, o de destaque vem antes e os demais por título.
    ARTS.sort(key=lambda x: x['title'])
    ARTS.sort(key=lambda x: (x['date'], x['destaque']), reverse=True)
    for a in ARTS:
        for s in a['relacionados']:
            if s not in seen:
                _err(f'{a["file"]}: relacionado {s!r} não existe')
    SLUGS.clear()
    SLUGS.update(seen)
    load_pautas(b)


def load_pautas(b):
    """Valida src/pautas/*.md (só os campos com opções fixas; o resto é livre). Nada delas vai para dist/."""
    if not os.path.isdir(PAUTAS_SRC):
        return
    for fname in sorted(os.listdir(PAUTAS_SRC)):
        if not fname.endswith('.md') or fname.startswith(('_', '.')):
            continue
        fn = 'src/pautas/' + fname
        meta, _ = parse_front(open(os.path.join(PAUTAS_SRC, fname), encoding='utf-8').read(), fn)
        if not meta:
            continue
        for field in ('titulo', 'palavra_chave', 'status'):
            if not meta.get(field):
                _err(f'{fn}: campo obrigatório ausente: {field}')
        checks = (('status', STATUS_PAUTA), ('tema', TEMAS), ('prioridade', PRIORIDADES), ('intencao', INTENCOES), ('destino', SERVICOS))
        for field, opts in checks:
            if meta.get(field) and meta[field] not in opts:
                _err(f'{fn}: {field} {meta[field]!r} inválido (opções: {", ".join(opts)})')
        if meta.get('artigo') and meta['artigo'] not in SLUGS:
            _err(f'{fn}: artigo {meta["artigo"]!r} não existe em src/blog/')
        if meta.get('status') == 'publicada' and not meta.get('artigo'):
            _err(f'{fn}: pauta publicada precisa indicar o artigo')
        if meta.get('prazo'):
            _date(meta['prazo'], fn, 'prazo')
        for m in meta.get('pico') or []:
            if m not in MESES:
                _err(f'{fn}: mês de pico {m!r} inválido (use o nome do mês em minúsculas)')


def tema_label(key):
    return TEMAS.get(key, (key, ''))[0]


def temas_com_pagina():
    counts = {}
    for a in ARTS:
        if not a['noindex']:
            counts[a['tema']] = counts.get(a['tema'], 0) + 1
    return [k for k in TEMAS if counts.get(k, 0) >= TEMA_MIN]


def tema_html(key):
    label = tema_label(key)
    return f'<a href="/blog/tema/{key}/">{label}</a>' if key in temas_com_pagina() else label


# ------------------------------------------------------------------ blocos de página
def _css(b):
    return '<style>' + b.minify_css(open(BLOG_CSS, encoding='utf-8').read()) + '</style>'


def _head(b, extra=''):
    return (f'<link rel="alternate" type="application/rss+xml" title="Blog TaMa Creative" href="{FEED_PATH}">'
            + extra + _css(b))


def _meta_line(a, author=True):
    parts = []
    if author:
        parts.append('Por <a href="/sobre/">TaMa Creative</a>')
    parts.append(f'<time datetime="{a["date"].isoformat()}">{fmt_date(a["date"])}</time>')
    if a['updated'] != a['date']:
        parts.append(f'Atualizado em <time datetime="{a["updated"].isoformat()}">{fmt_date(a["updated"])}</time>')
    parts.append(f'{a["minutes"]} min de leitura')
    return ' · '.join(parts)


def _cover_alt(a):
    return ('Fotografia conceitual: ' if a['capa_conceitual'] else '') + a['capa_alt']


def post_card(b, a, level=3, sizes='(max-width: 760px) 92vw, (max-width: 1180px) 30vw, 380px'):
    pos = f'object-position:{a["capa_posicao"]}' if a['capa_posicao'] else ''
    return f'''<article class="post-card">
  <div class="post-thumb">{b.picture(a['capa'], '', sizes, style=pos)}</div>
  <p class="post-kicker">{tema_label(a['tema'])}</p>
  <h{level}><a href="{a['path']}">{a['title']}</a></h{level}>
  <p>{a['description']}</p>
  <p class="post-meta">{_meta_line(a, author=False)}</p>
</article>'''


def post_feature(b, a):
    pos = f'object-position:{a["capa_posicao"]}' if a['capa_posicao'] else ''
    return f'''<article class="post-feature">
  <div class="post-thumb">{b.picture(a['capa'], '', '(max-width: 980px) 92vw, 640px', eager=True, style=pos)}</div>
  <div class="stack" style="gap:14px">
    <p class="post-kicker">Mais recente · {tema_label(a['tema'])}</p>
    <h2><a href="{a['path']}">{a['title']}</a></h2>
    <p class="muted">{a['description']}</p>
    <p class="post-meta">{_meta_line(a, author=False)}</p>
    <span class="link" aria-hidden="true">Ler o guia {b.ARROW}</span>
  </div>
</article>'''


def related(a):
    by_slug = {x['slug']: x for x in ARTS}
    picked = [by_slug[s] for s in a['relacionados'] if s in by_slug and s != a['slug']]
    rest = [x for x in ARTS if x['slug'] != a['slug'] and x not in picked]
    rest.sort(key=lambda x: (x['tema'] != a['tema'], -x['date'].toordinal()))
    return (picked + rest)[:3]


def blog_jsonld(b, a):
    url = b.SITE + a['path']
    m = b.IMAGES[a['capa']]
    imgs = [f'{b.SITE}/img/{m["stem"]}-{m["widths"][-1]}.jpg', f'{b.SITE}{a["path"]}og.jpg']
    post = {'@type': 'BlogPosting', '@id': url + '#artigo', 'headline': a['title'], 'description': a['description'],
            'image': imgs, 'datePublished': a['date'].isoformat(), 'dateModified': a['updated'].isoformat(),
            'author': {'@type': 'Organization', '@id': b.ORG_ID, 'name': 'TaMa Creative', 'url': b.SITE + '/'},
            'publisher': {'@id': b.ORG_ID}, 'mainEntityOfPage': {'@id': url + '#webpage'},
            'isPartOf': {'@id': b.SITE + '/blog/#blog'}, 'articleSection': tema_label(a['tema']),
            'inLanguage': 'pt-BR', 'wordCount': a['words'], 'url': url}
    if a['palavra_chave']:
        post['keywords'] = a['palavra_chave']
    return post


def article_page(b, a):
    def fn():
        oc = a['ocasiao']
        pos = f'object-position:{a["capa_posicao"]}' if a['capa_posicao'] else ''
        toc = ''
        if len(a['toc']) >= 2:
            toc = ('<nav class="post-toc" aria-labelledby="toc-t"><p class="post-toc-t" id="toc-t">Neste guia</p><ol>'
                   + ''.join(f'<li><a href="#{i}">{n}</a></li>' for i, n in a['toc']) + '</ol></nav>')
        caption = '<figcaption>Fotografia conceitual</figcaption>' if a['capa_conceitual'] else ''
        draft = '<p class="post-draft">Rascunho ou artigo agendado: não aparece no site publicado.</p>' if a['noindex'] else ''
        # Peças da curadoria ligadas ao artigo
        pecas_html = ''
        fotos = [s for s in a['pecas'] if s in b.PECA]
        ideias = [it for it in b.ALEM if it['slug'] in a['pecas']]
        if fotos or ideias:
            if oc:
                more = (f'/brindes-corporativos-premium/?ocasiao={oc}#pecas', f'Ver todas as ideias para {b.OCCS[oc].lower()}')
            else:
                more = ('/brindes-corporativos-premium/', 'Ver a curadoria completa')
            title = '<p class="eyebrow">Da curadoria TaMa</p><h2 id="pecas-a-t" class="section-title">Peças para começar a seleção</h2>'
            intro = 'Escolha a cor de referência e toque em “+ Selecionar”: as peças seguem com o seu pedido de proposta.'
            rail = b.product_rail(fotos, 'rail-post', title, intro, more=more) if fotos else (
                f'<div class="section-head">{title}<p class="muted">{intro}</p></div>')
            ideas_html = f'<div class="ideas" style="margin-top:28px">{"".join(b.idea_card(it) for it in ideias)}</div>' if ideias else ''
            if ideias and not fotos:
                ideas_html += f'<p style="margin-top:18px"><a class="link" href="{more[0]}">{more[1]} {b.ARROW}</a></p>'
            pecas_html = f'<section class="section ivory" aria-labelledby="pecas-a-t"><div class="wrap">{rail}{ideas_html}</div></section>'
        rel = related(a)
        rel_html = ''
        if rel:
            rel_html = (f'<section class="section" aria-labelledby="rel-t"><div class="wrap"><div class="section-head row"><div class="stack" style="gap:12px">'
                        f'<p class="eyebrow">Continue lendo</p><h2 id="rel-t" class="section-title">Outros guias</h2></div>'
                        f'<a class="link" href="/blog/">Todos os guias {b.ARROW}</a></div>'
                        f'<div class="post-grid">{"".join(post_card(b, x) for x in rel)}</div></div></section>')
        servico = ''
        if a['servico']:
            servico = f'<a class="btn btn-line" href="{a["servico"]}">{SERVICOS.get(a["servico"], "Conhecer o serviço")}</a>'
        author = f'''<div class="post-author">{b.SELO}<div class="stack" style="gap:8px"><p><strong>TaMa Creative</strong></p>
      <p class="muted">Estúdio criativo de brindes corporativos premium, kits, confecções e branding, com visão de Trade Marketing: o público e a ocasião vêm antes da peça.</p>
      <div class="actions">{b.cta_link(tipo=a['proposta'], track_label='blog-autor-' + a['slug'])}{servico}</div></div></div>'''
        body = f'''<article class="post">
  <div class="wrap"><header class="post-head">
    {draft}<p class="eyebrow">{tema_html(a['tema'])}</p>
    <h1>{a['title']}</h1>
    <p class="lead">{a['description']}</p>
    <p class="post-meta">{_meta_line(a)}</p>
  </header></div>
  <figure class="wrap post-cover">{b.picture(a['capa'], _cover_alt(a), '(max-width: 1280px) 92vw, 1184px', eager=True, style=pos)}{caption}</figure>
  <div class="wrap post-layout{'' if toc else ' no-toc'}">
    {toc}
    <div class="post-body"><div class="prose">{a['html']}</div>{author}</div>
  </div>
</article>
{pecas_html}
{rel_html}
{b.end_cta(tipo=a['proposta'])}'''
        head = (f'<meta property="article:published_time" content="{a["date"].isoformat()}">'
                f'<meta property="article:modified_time" content="{a["updated"].isoformat()}">'
                f'<meta property="article:section" content="{b.esc(tema_label(a["tema"]))}">')
        return {
            'path': a['path'], 'title': a['seo_title'], 'og_title': a['title'], 'description': a['description'],
            'index': not a['noindex'], 'lastmod': a['updated'].isoformat(),
            'trail': [('/', 'Início'), ('/blog/', 'Blog'), (a['path'], a['breadcrumb'])],
            'og_type': 'article', 'og_image': a['path'] + 'og.jpg',
            'preload': b.preload_image(a['capa'], '(max-width: 1280px) 92vw, 1184px'),
            'head': _head(b, head), 'ld_extra': [blog_jsonld(b, a)], 'body': body, 'blog': a,
        }
    return fn


SERVICOS = {
    '/brindes-corporativos/': 'Ver brindes corporativos',
    '/kits-corporativos/': 'Ver kits corporativos',
    '/brindes-corporativos-premium/': 'Ver a curadoria',
    '/confeccoes-personalizadas/': 'Ver confecções',
    '/branding-identidade-visual/': 'Ver branding',
}


def listing(b, arts, feature=True):
    if not arts:
        return '<p class="empty">Os primeiros guias estão a caminho.</p>'
    first, rest = (arts[0], arts[1:]) if feature else (None, arts)
    out = post_feature(b, first) if first else ''
    if rest:
        head = '<h2 class="section-title" style="font-size:clamp(1.8rem,1.4rem + 1.4vw,2.4rem)">Mais guias</h2>' if first else '<h2 class="visually-hidden">Artigos</h2>'
        out += f'<div class="post-list">{head}<div class="post-grid">{"".join(post_card(b, a) for a in rest)}</div></div>'
    return out


def index_page(b):
    def fn():
        pub = [a for a in ARTS if not a['noindex']] + [a for a in ARTS if a['noindex']]
        temas = temas_com_pagina()
        temas_html = ''
        if temas:
            temas_html = ('<nav class="filters" aria-label="Temas do blog" style="flex-wrap:wrap;margin-top:8px">'
                          + ''.join(f'<a class="chip" href="/blog/tema/{k}/">{tema_label(k)}</a>' for k in temas) + '</nav>')
        url = b.SITE + '/blog/'
        blog_ld = {'@type': 'Blog', '@id': url + '#blog', 'name': 'Blog TaMa Creative', 'url': url, 'inLanguage': 'pt-BR',
                   'publisher': {'@id': b.ORG_ID},
                   'blogPost': [{'@type': 'BlogPosting', '@id': b.SITE + a['path'] + '#artigo', 'headline': a['title'], 'url': b.SITE + a['path'],
                                 'datePublished': a['date'].isoformat()} for a in pub if not a['noindex']]}
        latest = max((a['updated'] for a in pub if not a['noindex']), default=None)
        page = {
            'path': '/blog/', 'title': 'Blog: guias de brindes corporativos e kits | TaMa Creative',
            'description': 'Guias da TaMa Creative sobre brindes corporativos, kits e presentes de empresa: como escolher, o que incluir e como respeitar as regras de quem recebe.',
            'trail': [('/', 'Início'), ('/blog/', 'Blog')], 'wp_type': 'CollectionPage', 'ld_extra': [blog_ld],
            'head': _head(b),
            'body': f'''<section class="page-head blog-head">
  <div class="wrap"><div class="section-head" style="margin:0;max-width:52rem">
    <p class="eyebrow">Blog TaMa</p>
    <h1>Guias para presentear em nome da sua marca</h1>
    <p class="lead">Como escolher brindes e kits que as pessoas usam, o que colocar em cada ocasião e como respeitar as regras de quem recebe. Conteúdo prático, escrito pela TaMa Creative.</p>
    {temas_html}
  </div></div>
</section>
<section class="section" style="padding-top:0" aria-label="Artigos do blog">
  <div class="wrap">{listing(b, pub)}</div>
</section>
{b.end_cta()}''',
        }
        if pub and pub[0]['capa']:
            page['preload'] = b.preload_image(pub[0]['capa'], '(max-width: 980px) 92vw, 640px')
        if latest:
            page['lastmod'] = latest.isoformat()
        return page
    return fn


def tema_page(b, key):
    def fn():
        label, desc = TEMAS[key]
        arts = [a for a in ARTS if a['tema'] == key and not a['noindex']]
        return {
            'path': f'/blog/tema/{key}/', 'title': f'{label}: guias e ideias | Blog TaMa Creative',
            'description': f'{desc} Guias práticos da TaMa Creative sobre {label.lower()}.'[:160],
            'trail': [('/', 'Início'), ('/blog/', 'Blog'), (f'/blog/tema/{key}/', label)], 'wp_type': 'CollectionPage',
            'head': _head(b), 'lastmod': max(a['updated'] for a in arts).isoformat(),
            'body': f'''<section class="page-head blog-head"><div class="wrap"><div class="section-head" style="margin:0;max-width:52rem">
  <p class="eyebrow">Blog TaMa · Tema</p><h1>{label}</h1><p class="lead">{desc}</p></div></div></section>
<section class="section" style="padding-top:0" aria-label="Artigos do tema"><div class="wrap">{listing(b, arts, feature=False)}</div></section>
{b.end_cta()}''',
        }
    return fn


# ------------------------------------------------------------------ ganchos
def pages(b):
    """Carrega e valida os artigos; devolve as funções de página do blog."""
    load(b)
    if ERRORS:
        raise SystemExit('Blog: corrija antes de publicar:\n- ' + '\n- '.join(ERRORS))
    if not ARTS:
        return []
    return [index_page(b)] + [article_page(b, a) for a in ARTS] + [tema_page(b, k) for k in temas_com_pagina()]


def _og_image(b, a):
    """Imagem de compartilhamento 1200x630: painel ameixa com o logo oficial + capa do artigo (como a og-default)."""
    import resvg_py
    from PIL import Image
    candidates = [BLOG_IMG.get(a['capa'], '')]
    if getattr(b, 'MOCKUPS', False):
        candidates.append(os.path.join(b.IMG_SRC, 'marca', a['capa'] + '.webp'))
    candidates += [os.path.join(b.IMG_SRC, 'v2', a['capa'] + '.webp'), os.path.join(b.IMG_SRC, a['capa'] + '.jpg')]
    src = next(c for c in candidates if c and os.path.exists(c))
    og = Image.new('RGB', (1200, 630), (101, 37, 61))
    photo = Image.open(src).convert('RGB')
    scale = max(640 / photo.width, 630 / photo.height)
    photo = photo.resize((round(photo.width * scale), round(photo.height * scale)), Image.LANCZOS)
    left, top = (photo.width - 640) // 2, (photo.height - 630) // 2
    og.paste(photo.crop((left, top, left + 640, top + 630)), (560, 0))
    if not hasattr(_og_image, 'logo'):
        _og_image.logo = Image.open(io.BytesIO(resvg_py.svg_to_bytes(
            svg_path=os.path.join(b.LOGOS, 'tama-logo-vertical-negativo.svg'), width=380))).convert('RGBA')
    logo = _og_image.logo
    og.paste(logo, ((560 - logo.width) // 2, (630 - logo.height) // 2), logo)
    buf = io.BytesIO()
    og.save(buf, 'JPEG', quality=86, optimize=True)
    b.write(a['path'] + 'og.jpg', buf.getvalue(), 'wb')


def _feed(b):
    def rfc822(d):
        return format_datetime(datetime(d.year, d.month, d.day, 9, 0, tzinfo=BRT))
    x = lambda s: b.esc(re.sub(r'<[^>]+>', '', s))
    pub = [a for a in ARTS if not a['noindex']]
    items = ''.join(f'''
  <item>
    <title>{x(a['title'])}</title>
    <link>{b.SITE}{a['path']}</link>
    <guid isPermaLink="true">{b.SITE}{a['path']}</guid>
    <pubDate>{rfc822(a['date'])}</pubDate>
    <category>{x(tema_label(a['tema']))}</category>
    <description>{x(a['description'])}</description>
  </item>''' for a in pub)
    last = rfc822(max((a['updated'] for a in pub), default=date.today()))
    b.write(FEED_PATH, f'''<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Blog TaMa Creative</title>
  <link>{b.SITE}/blog/</link>
  <atom:link href="{b.SITE}{FEED_PATH}" rel="self" type="application/rss+xml"/>
  <description>Guias sobre brindes corporativos, kits e presentes de empresa.</description>
  <language>pt-BR</language>
  <lastBuildDate>{last}</lastBuildDate>{items}
</channel>
</rss>
''')


def finalize(b):
    """Depois de gerar as páginas: valida links internos do blog, grava o RSS e as imagens OG."""
    if not ARTS:
        return
    paths = {p['path'] for p in b.BUILT} | {FEED_PATH}
    anchors = set(b.PECA) | {it['slug'] for it in b.ALEM} | {'pecas'}
    for p in b.BUILT:
        if not p['path'].startswith('/blog/'):
            continue
        a = p.get('blog')
        where = a['file'] if a else p['path']
        if a and a['servico'] and a['servico'] not in paths:
            _err(f'{where}: servico {a["servico"]!r} não é uma página do site')
        for href in set(re.findall(r'href="(/[^"]*)"', p['body'])):
            path, _, frag = href.partition('#')
            path = path.split('?')[0]
            if path not in paths and not os.path.exists(os.path.join(b.DIST, path.lstrip('/'))):
                _err(f'{where}: link interno quebrado {href}')
            elif frag and path == '/brindes-corporativos-premium/' and frag not in anchors:
                _err(f'{where}: âncora inexistente na curadoria #{frag}')
        if a:
            for href in set(re.findall(r'href="(http[^"]*)"', a['html'])):
                if href.startswith('http://'):
                    _err(f'{where}: use https em {href}')
    if ERRORS:
        raise SystemExit('Blog: corrija antes de publicar:\n- ' + '\n- '.join(ERRORS))
    for a in ARTS:
        _og_image(b, a)
    _feed(b)
    pub = sum(1 for a in ARTS if not a['noindex'])
    print(f'blog: {pub} artigo(s) publicado(s){f", {len(ARTS) - pub} rascunho(s)" if len(ARTS) > pub else ""} | temas com página: {len(temas_com_pagina())}')


# ------------------------------------------------------------------ editor do blog (/admin/, Decap CMS)
ADMIN_CSP = ("default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; "
             "img-src 'self' data: blob: https://avatars.githubusercontent.com https://*.githubusercontent.com; "
             "connect-src 'self' https://api.github.com https://api.netlify.com https://*.githubusercontent.com; "
             "font-src 'self' data:; media-src 'self' blob:; worker-src 'self' blob:; frame-ancestors 'none'; "
             "base-uri 'self'; object-src 'none'; form-action 'self'")


def _opt(label, value):
    return {'label': label, 'value': value}


def cms_config(b):
    """config.yml do Decap CMS, gerado dos mesmos dados que o build valida: o editor só oferece valores válidos."""
    date_fmt = {'widget': 'datetime', 'format': 'YYYY-MM-DD', 'date_format': 'DD/MM/YYYY', 'time_format': False, 'picker_utc': True}
    capas = sorted(k for k in b.IMAGES if not k.startswith('blog-'))
    pecas = ([_opt(f'{p["nome"]} (com foto)', p['slug']) for p in b.PECAS]
             + [_opt(f'{it["nome"]} (além do óbvio)', it['slug']) for it in b.ALEM])
    tipos = {'brindes': 'Brindes ou presentes', 'kits': 'Kits corporativos', 'confeccoes': 'Confecções e uniformes',
             'branding': 'Branding e identidade', 'integrado': 'Projeto integrado'}
    fields = [
        {'label': 'Título do artigo (H1)', 'name': 'title', 'widget': 'string',
         'hint': 'Responde à busca principal com naturalidade. Até 110 caracteres.',
         'pattern': ['^.{10,110}$', 'Use de 10 a 110 caracteres']},
        {'label': 'Título curto', 'name': 'breadcrumb', 'widget': 'string',
         'hint': 'Aparece no caminho (Início / Blog / …) e forma o endereço do artigo. Ex.: Kit de boas-vindas',
         'pattern': ['^.{3,60}$', 'Use de 3 a 60 caracteres']},
        {'label': 'Título no Google (SEO)', 'name': 'seo_title', 'widget': 'string',
         'hint': 'O que aparece no resultado de busca. Comece pela palavra-chave e termine com " | TaMa". Ideal até 65 caracteres.',
         'pattern': ['^.{20,70}$', 'Use de 20 a 70 caracteres (ideal até 65)']},
        {'label': 'Descrição (SEO)', 'name': 'description', 'widget': 'text',
         'hint': 'Resumo que aparece no Google, nos cards do blog e abaixo do título. De 70 a 160 caracteres.',
         'pattern': ['^[\\s\\S]{70,160}$', 'Use de 70 a 160 caracteres']},
        {'label': 'Palavra-chave principal', 'name': 'palavra_chave', 'widget': 'string',
         'hint': 'A busca que o artigo responde, como as pessoas digitam. Use-a no título, na descrição e no primeiro parágrafo.'},
        dict(date_fmt, label='Data de publicação', name='date', hint='Data futura = o artigo só aparece a partir desse dia (no próximo build).'),
        dict(date_fmt, label='Atualizado em', name='updated', required=False, default='',
             hint='Preencha só quando revisar o conteúdo de verdade (o Google mostra a data de atualização).'),
        dict(date_fmt, label='Próxima revisão', name='revisar_em', required=False, default='',
             hint='Opcional. Quando conferir o artigo de novo (lei, valor ou dado que pode mudar). Aparece no Painel de SEO.'),
        {'label': 'O que revisar', 'name': 'revisar_motivo', 'widget': 'string', 'required': False,
         'hint': 'Ex.: conferir o valor do limite de brindes (1% do subsídio do STF).'},
        {'label': 'Destaque no blog', 'name': 'destaque', 'widget': 'boolean', 'default': False, 'required': False,
         'hint': 'Coloca o artigo em destaque entre os publicados no mesmo dia.'},
        {'label': 'Tema', 'name': 'tema', 'widget': 'select', 'options': [_opt(v[0], k) for k, v in TEMAS.items()]},
        {'label': 'Ocasião da curadoria', 'name': 'ocasiao', 'widget': 'select', 'required': False,
         'options': [_opt(v, k) for k, v in b.OCCS.items()],
         'hint': 'Liga o artigo à curadoria filtrada (/brindes-corporativos-premium/?ocasiao=…).'},
        {'label': 'Página de serviço', 'name': 'servico', 'widget': 'select', 'required': False,
         'options': [_opt(v.replace('Ver ', '').capitalize(), k) for k, v in SERVICOS.items()],
         'hint': 'Botão para o serviço no fim do artigo. Todo artigo deve apontar para um serviço.'},
        {'label': 'Tipo de proposta', 'name': 'proposta', 'widget': 'select', 'required': False,
         'options': [_opt(v, k) for k, v in tipos.items()], 'hint': 'Já vem marcado no formulário quando o leitor clica em Solicitar proposta.'},
        {'label': 'Capa: imagem da biblioteca do site', 'name': 'capa', 'widget': 'select', 'required': False,
         'options': capas, 'hint': 'Fotografias conceituais e mockups já usados no site. Ou envie uma imagem nova no campo abaixo.'},
        {'label': 'Capa: enviar imagem nova', 'name': 'capa_arquivo', 'widget': 'image', 'required': False, 'choose_url': False,
         'hint': 'Só fotos próprias ou com licença de uso. Mínimo de 1600 px de largura. Se preenchida, substitui a da biblioteca.'},
        {'label': 'Descrição da capa (texto alternativo)', 'name': 'capa_alt', 'widget': 'string',
         'hint': 'O que aparece na foto, para leitores de tela e para o Google. Ex.: caixa terracota com caderno e garrafa verde.'},
        {'label': 'A capa é uma fotografia conceitual', 'name': 'capa_conceitual', 'widget': 'boolean', 'default': True, 'required': False,
         'hint': 'Desmarque só para fotos reais de trabalhos entregues. Conceituais aparecem identificadas no site.'},
        {'label': 'Enquadramento da capa', 'name': 'capa_posicao', 'widget': 'string', 'required': False,
         'hint': 'Opcional. Ex.: 50% 40% (horizontal e vertical) para mostrar outra parte da foto.'},
        {'label': 'Peças da curadoria', 'name': 'pecas', 'widget': 'select', 'multiple': True, 'required': False, 'max': 9,
         'options': pecas, 'hint': 'Aparecem no fim do artigo com o botão "+ Selecionar" (levam o leitor à proposta). Até 9.'},
        {'label': 'Outros guias (relacionados)', 'name': 'relacionados', 'widget': 'relation', 'collection': 'blog',
         'search_fields': ['title'], 'value_field': '{{slug}}', 'display_fields': ['title'], 'multiple': True, 'required': False, 'max': 3,
         'hint': 'Até 3. Sem escolha, o site mostra os do mesmo tema e os mais recentes.'},
        {'label': 'Rascunho (não publicar)', 'name': 'draft', 'widget': 'boolean', 'default': False, 'required': False,
         'hint': 'Marcado, o artigo não vai ao ar mesmo se for publicado no editor.'},
        {'label': 'Texto', 'name': 'body', 'widget': 'markdown', 'modes': ['rich_text', 'raw'],
         'buttons': ['bold', 'italic', 'link', 'heading-two', 'heading-three', 'quote', 'bulleted-list', 'numbered-list'],
         'editor_components': ['image', 'cta'],
         'hint': ('Use "Título 2" para as seções (entram no sumário) e "Título 3" para subseções. '
                  'Fato externo sempre com fonte: no modo Markdown, escreva texto[^id] e, no fim, [^id]: Fonte. [Link](https://…). '
                  'Use o bloco "Chamada para proposta" uma vez no meio do texto.')},
    ]
    cfg = {
        'backend': {'name': 'github', 'repo': CMS_REPO, 'branch': 'main', 'base_url': 'https://api.netlify.com',
                    'auth_endpoint': 'auth', 'site_domain': CMS_SITE_DOMAIN, 'squash_merges': True,
                    'commit_messages': {'create': 'Blog: cria {{slug}}', 'update': 'Blog: atualiza {{slug}}', 'delete': 'Blog: remove {{slug}}',
                                        'uploadMedia': 'Blog: envia imagem {{path}}', 'deleteMedia': 'Blog: remove imagem {{path}}',
                                        'openAuthoring': 'Blog: {{message}}'}},
        'local_backend': True,
        'publish_mode': 'editorial_workflow',
        'locale': 'pt',
        'site_url': b.SITE, 'display_url': b.SITE, 'logo_url': '/admin/logo.svg',
        'media_folder': 'img/blog', 'public_folder': '/img/blog',
        'slug': {'encoding': 'ascii', 'clean_accents': True, 'sanitize_replacement': '-'},
        'collections': [{
            'name': 'blog', 'label': 'Artigos do blog', 'label_singular': 'artigo',
            'description': 'Guias do blog. Cada artigo publicado vai para tamacreative.com.br/blog/ depois do build (alguns minutos).',
            'folder': 'src/blog', 'create': True, 'extension': 'md', 'format': 'frontmatter',
            'identifier_field': 'breadcrumb', 'slug': '{{slug}}',
            'preview_path': 'blog/{{slug}}/', 'summary': '{{title}} · {{date}}',
            'sortable_fields': ['date', 'title'], 'view_groups': [{'label': 'Tema', 'field': 'tema'}],
            'fields': fields,
        }, {
            'name': 'pautas', 'label': 'Pautas', 'label_singular': 'pauta',
            'description': 'Planejamento editorial: uma pauta por consulta de busca. Não aparece no site; o Painel de SEO (/admin/painel/) organiza o calendário e aponta conflitos.',
            'folder': 'src/pautas', 'create': True, 'extension': 'md', 'format': 'frontmatter',
            'identifier_field': 'titulo', 'slug': '{{slug}}', 'summary': '{{titulo}} · {{status}}',
            'sortable_fields': ['titulo', 'prazo', 'status'], 'view_groups': [{'label': 'Status', 'field': 'status'}],
            'fields': [
                {'label': 'Título provisório', 'name': 'titulo', 'widget': 'string'},
                {'label': 'Consulta-alvo (palavra-chave)', 'name': 'palavra_chave', 'widget': 'string',
                 'hint': 'Uma consulta por artigo, como as pessoas digitam. O painel avisa se outra página ou pauta já disputa a mesma busca.'},
                {'label': 'Consultas secundárias', 'name': 'secundarias', 'widget': 'list', 'required': False,
                 'hint': 'Variações que o mesmo artigo pode responder. Uma por linha.'},
                {'label': 'Status', 'name': 'status', 'widget': 'select', 'default': 'ideia',
                 'options': [_opt(v, k) for k, v in STATUS_PAUTA.items()]},
                {'label': 'Prioridade', 'name': 'prioridade', 'widget': 'select', 'required': False,
                 'options': [_opt(v, k) for k, v in PRIORIDADES.items()]},
                {'label': 'Intenção de busca', 'name': 'intencao', 'widget': 'select', 'required': False,
                 'options': [_opt(v, k) for k, v in INTENCOES.items()],
                 'hint': 'Informacional = quer aprender; comercial = compara opções; transacional = quer comprar ou orçar.'},
                {'label': 'Tema', 'name': 'tema', 'widget': 'select', 'required': False,
                 'options': [_opt(v[0], k) for k, v in TEMAS.items()]},
                {'label': 'Página de destino do link', 'name': 'destino', 'widget': 'select', 'required': False,
                 'options': [_opt(v.replace('Ver ', '').capitalize(), k) for k, v in SERVICOS.items()]},
                dict(date_fmt, label='Publicar até', name='prazo', required=False, default='',
                     hint='Para pautas sazonais, publique semanas antes do pico de busca.'),
                {'label': 'Meses de pico de busca', 'name': 'pico', 'widget': 'select', 'multiple': True, 'required': False,
                 'options': list(MESES), 'hint': 'Só com base em dado (Search Console, Keyword Planner ou Google Trends).'},
                {'label': 'Precisa de fontes externas', 'name': 'precisa_fontes', 'widget': 'boolean', 'default': False, 'required': False,
                 'hint': 'Lei, número ou estudo citado: cada fato com fonte oficial em nota.'},
                {'label': 'Responsável', 'name': 'responsavel', 'widget': 'string', 'required': False},
                {'label': 'Artigo', 'name': 'artigo', 'widget': 'relation', 'collection': 'blog', 'required': False,
                 'search_fields': ['title'], 'value_field': '{{slug}}', 'display_fields': ['title'],
                 'hint': 'Ligue a pauta ao artigo quando ele for criado.'},
                {'label': 'Motivo da espera ou observação', 'name': 'observacao', 'widget': 'string', 'required': False},
                {'label': 'Briefing e esboço', 'name': 'body', 'widget': 'markdown', 'required': False, 'modes': ['raw', 'rich_text'],
                 'default': ('## Para quem\n\n\n\n## Perguntas que o artigo responde\n\n- \n\n## Esboço (Título 2)\n\n1. \n\n'
                             '## Links internos\n\n- \n\n## Fontes a confirmar\n\n- \n'),
                 'hint': 'Público, perguntas da busca, seções, links internos e fontes. Serve de roteiro para quem escreve.'},
            ],
        }],
    }
    return ('# Gerado por blog.py a cada build (não editar à mão): opções vindas de TEMAS, curadoria.json e das imagens do site.\n'
            + yaml.safe_dump(cfg, allow_unicode=True, sort_keys=False, width=1000))


def painel_dados(b):
    """Dados públicos do Painel de SEO (/admin/painel/): opções do editor e páginas do site.
    Artigos e pautas não entram aqui: o painel lê do repositório com o login do GitHub."""
    titulos = {p['path']: p.get('title', '') for p in b.BUILT}
    return {
        'site': b.SITE, 'repo': CMS_REPO, 'tema_min': TEMA_MIN, 'meses': list(MESES),
        'temas': {k: v[0] for k, v in TEMAS.items()},
        'servicos': {k: v.replace('Ver ', '').capitalize() for k, v in SERVICOS.items()},
        'status': STATUS_PAUTA, 'prioridades': PRIORIDADES, 'intencoes': INTENCOES,
        'paginas': [{'path': path, 'titulo': titulos.get(path, path), 'consulta': c, 'secundarias': sec}
                    for path, (c, sec) in CONSULTAS_PAGINAS.items()],
    }


def post_static(b):
    """Depois de build_static(): copia o editor (src/admin/), grava config.yml e preview.css e os cabeçalhos de /admin/."""
    if not os.path.isdir(ADMIN_SRC):
        return
    out = os.path.join(b.DIST, 'admin')
    shutil.copytree(ADMIN_SRC, out, dirs_exist_ok=True)
    shutil.copy2(os.path.join(b.LOGOS, 'tama-logo-horizontal-positivo.svg'), os.path.join(out, 'logo.svg'))  # logo oficial no login
    b.write('/admin/config.yml', cms_config(b))
    b.write('/admin/preview.css', b.CSS + b.minify_css(open(BLOG_CSS, encoding='utf-8').read()))
    b.write('/admin/painel/site.json', json.dumps(painel_dados(b), ensure_ascii=False))
    with open(os.path.join(b.DIST, '_headers'), 'a', encoding='utf-8') as f:
        f.write(f'/admin/*\n  X-Robots-Tag: noindex, nofollow\n  Cache-Control: no-cache\n  Content-Security-Policy: {ADMIN_CSP}\n')
