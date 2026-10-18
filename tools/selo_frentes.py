"""Refaz o arco inferior do selo TaMa trocando MARCAS por ATIVAÇÕES, reaproveitando os contornos das letras do próprio selo."""
# Uso: python tools/selo_frentes.py <selo com BRINDES · CONFECÇÕES · MARCAS> <saída> ["BRINDES·CONFECÇÕES·ATIVAÇÕES"]
# Lê o texto de baixo do selo ORIGINAL (o desta versão já foi trocado em brand/logos em 17/10/2026; para refazer, use o arquivo do histórico do Git).
import math, re, sys, statistics
C = 100.0

def parse(d):
    toks = re.findall(r'[MLQZ]|-?\d*\.?\d+', d)
    subs, cur, cmd, i = [], None, None, 0
    while i < len(toks):
        t = toks[i]
        if t in 'MLQZ':
            cmd = t; i += 1
            if t == 'Z':
                cur.append(('Z',)); subs.append(cur); cur = None
            continue
        n = {'M': 2, 'L': 2, 'Q': 4}[cmd]
        vals = list(map(float, toks[i:i + n])); i += n
        if cmd == 'M':
            if cur: subs.append(cur)
            cur = [('M', vals)]; cmd = 'L'
        else:
            cur.append((cmd, vals))
    if cur: subs.append(cur)
    return subs

def pts(sub):
    for seg in sub:
        if seg[0] != 'Z':
            v = seg[1]
            for k in range(0, len(v), 2): yield v[k], v[k + 1]

def xform(sub, f):
    out = []
    for seg in sub:
        if seg[0] == 'Z': out.append(seg); continue
        v = seg[1]; nv = []
        for k in range(0, len(v), 2): nv += list(f(v[k], v[k + 1]))
        out.append((seg[0], nv))
    return out

def rot(a):  # rotação em torno do centro, graus
    r = math.radians(a); c, s = math.cos(r), math.sin(r)
    return lambda x, y: (C + (x - C) * c - (y - C) * s, C + (x - C) * s + (y - C) * c)

def ang(x, y): return math.degrees(math.atan2(y - C, x - C))

def clusters(subs, top):
    items = []
    for sb in subs:
        a = [ang(x, y) for x, y in pts(sb)]
        if top: a = [v % 360 for v in a]
        items.append([min(a), max(a), [sb]])
    items.sort(key=lambda t: t[0])
    merged = []
    for it in items:
        if merged and it[0] <= merged[-1][1] + 0.05:
            merged[-1][1] = max(merged[-1][1], it[1]); merged[-1][2] += it[2]
        else: merged.append(it)
    return merged

def canon(glyph_subs, center_angle, target):
    """Gira o glifo para o ângulo target (90 = embaixo, 270 = em cima) e o centraliza em x=100."""
    g = [xform(sb, rot(target - center_angle)) for sb in glyph_subs]
    xs = [x for sb in g for x, _ in pts(sb)]
    dx = C - (min(xs) + max(xs)) / 2
    return [xform(sb, lambda x, y: (x + dx, y)) for sb in g]

def bbox(g):
    p = [q for sb in g for q in pts(sb)]
    return min(x for x, _ in p), min(y for _, y in p), max(x for x, _ in p), max(y for _, y in p)

def fmt(subs):
    out = []
    for sb in subs:
        s = ''
        for seg in sb:
            if seg[0] == 'Z': s += 'Z'
            else: s += seg[0] + ' '.join(f'{v:.2f}'.rstrip('0').rstrip('.') for v in seg[1]) + ' '
        out.append(s.replace(' Z', 'Z').strip())
    return ' '.join(out)

def main(src, dst):
    svg = open(src, encoding='utf-8').read()
    ds = re.findall(r'<path fill="([^"]+)" d="([^"]+)"', svg)
    top_d, bot_d = ds[0][1], ds[1][1]
    top = clusters(parse(top_d), True)       # TAMA CREATIVE (ângulos ~200..340)
    bot = clusters(parse(bot_d), False)      # BRINDES · CONFECÇÕES · MARCAS (ângulos ~20..160)
    texto_bot = 'BRINDES·CONFECÇÕES·MARCAS'
    texto_top = 'TAMACREATIVE'
    assert len(bot) == len(texto_bot), (len(bot), len(texto_bot))
    assert len(top) == len(texto_top), (len(top), len(texto_top))
    bot = sorted(bot, key=lambda t: -t[0])   # leitura: da esquerda para a direita = ângulo decrescente
    top = sorted(top, key=lambda t: t[0])
    glyph = {}
    R = statistics.mean(math.hypot(x - C, y - C) for it in bot for sb in it[2] for x, y in pts(sb))
    pos = []   # (letra, borda esquerda, borda direita) em comprimento de arco no texto original
    for ch, it in zip(texto_bot, bot):
        a0, a1 = it[0], it[1]
        pos.append((ch, -(a1 - 90) * math.pi / 180 * R, -(a0 - 90) * math.pi / 180 * R))
        glyph.setdefault(ch, canon(it[2], (a0 + a1) / 2, 90))
    base_bot = statistics.mean(bbox(glyph[c])[3] for c in 'EIN')       # linha de base (y maior, embaixo)
    cap_bot = statistics.mean(bbox(glyph[c])[3] - bbox(glyph[c])[1] for c in 'EIN')
    for ch, it in zip(texto_top, top):
        if ch in glyph: continue
        g = canon(it[2], (it[0] + it[1]) / 2, 270)
        x0, y0, x1, y1 = bbox(g)
        h = y1 - y0
        k = cap_bot / h   # o texto de cima é maior: reduz para a altura das letras de baixo
        glyph[ch] = [xform(sb, lambda x, y, k=k, y1=y1: (C + (x - C) * k, base_bot - (y1 - y) * k)) for sb in g]
        print(f'{ch}: escala {k:.3f}')
    gaps_l, gaps_d = [], []
    for (c0, _, r0), (c1, l1, _) in zip(pos, pos[1:]):
        (gaps_d if '·' in (c0, c1) else gaps_l).append(l1 - r0)
    gl, gd = statistics.mean(gaps_l), statistics.mean(gaps_d)
    novo = sys.argv[3] if len(sys.argv) > 3 else 'BRINDES·CONFECÇÕES·ATIVAÇÕES'
    larg = [bbox(glyph[c])[2] - bbox(glyph[c])[0] for c in novo]
    total = sum(larg) + sum(gd if '·' in (a, b) else gl for a, b in zip(novo, novo[1:]))
    orig_total = pos[-1][2] - pos[0][1]
    s = -total / 2; out = []
    for i, ch in enumerate(novo):
        sc = s + larg[i] / 2
        delta = -math.degrees(sc / R)            # centro do glifo no ângulo 90 - delta
        out += [xform(sb, rot(delta)) for sb in glyph[ch]]
        s += larg[i] + (gd if i + 1 < len(novo) and '·' in (ch, novo[i + 1]) else gl)
    span = math.degrees(total / R)
    print(f'raio {R:.1f}; arco original {math.degrees(orig_total / R):.1f}°, novo {span:.1f}° (de {90 - span / 2:.1f}° a {90 + span / 2:.1f}°; os pontos laterais ficam em 0° e 180°)')
    new_d = fmt(out)
    svg = svg.replace(bot_d, new_d, 1)
    open(dst, 'w', encoding='utf-8').write(svg)

main(sys.argv[1], sys.argv[2])
