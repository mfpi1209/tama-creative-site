# Placement specs. Coordinates in SOURCE px. light: degrees, 0 = from right, 90 = from top.
GOLD = '#C9A15F'; COPPER = '#C08457'; CREAM = '#F3ECDF'; PLUM = '#65253D'; CORAL = '#D5483A'
SPECS = {}

SPECS['caixa-terracota'] = dict(src='caixa-terracota', scale=3, clean=[
    dict(poly=[(126, 101), (346, 108), (346, 143), (126, 136)], donor=None),
    dict(poly=[(668, 334), (738, 334), (738, 402), (668, 402)], donor=(0, 95)),
    dict(poly=[(752, 326), (850, 326), (850, 396), (752, 396)], donor=(0, 95)),
    dict(poly=[(600, 584), (748, 587), (748, 602), (600, 599)], donor=None, lf=2),
], marks=[
    dict(logo='h', rect=(410, 252, 230), fx='foil', color=GOLD, light=60, depth=0.9),
    dict(logo='arc', rect=(704, 372, 34), fx='foil', color=GOLD, light=60, depth=0.8),
])

CADERNO_CLEAN = [dict(poly=[(6, 401), (124, 401), (121, 477), (6, 477)], donor=(-22, 82), lf=2)]  # fake emboss on the burgundy card
SPECS['caderno-azul'] = dict(src='caderno-azul', scale=3, clean=CADERNO_CLEAN, marks=[
    dict(logo='v', rect=(283, 300, 128), fx='foil', color=GOLD, light=45, depth=0.9, tex=0.38),
])

SPECS['sacola-verde'] = dict(src='sacola-verde', scale=3, clean=[
    dict(poly=[(735, 351), (850, 351), (850, 369), (735, 369)], donor=None, lf=2),
], marks=[
    dict(logo='v', rect=(410, 432, 128), rot=2.0, fx='print', color='#ECE4D4', opacity=0.92, tex=0.75),
    dict(logo='arc', rect=(207, 590, 34), fx='laser', cyl=(207, 77), color='#C9C2B4', tex=0.9),
])

SPECS['garrafa-termica'] = dict(src='garrafa-termica', scale=3, marks=[
    dict(logo='v', rect=(339, 318, 112), fx='laser', cyl=(339, 121), color='#D4CFC5', tex=0.7),
])

SPECS['bandeja-couro'] = dict(src='bandeja-couro', scale=3,
    recolor=[dict(poly=[(0, 238), (418, 136), (462, 133), (850, 318), (850, 426), (800, 452), (600, 549), (340, 634), (300, 631), (255, 611), (60, 480), (0, 465)], src='#aa5834', sample=(560, 300, 12), tol=22, cmin=0.28)],
    clean=[
    dict(poly=[(344, 417), (413, 417), (413, 456), (344, 456)], donor=None, lf=2),
], marks=[
    dict(logo='h', plane=(168, 482, 0.86, 0.51, -0.1, 1, 176, 47), fx='foil', color=GOLD, light=40, depth=0.9, sheen=0.3, tex=0.35),  # outer front wall: full signature in gold foil
    dict(logo='arc', plane=(452, 404, 0.97, -0.24, 0.6, 0.8, 50, 37), fx='deboss', light=40, depth=1.6, strength=0.85, darken=0.09, gloss=0.15),
])

SPECS['bone-verde'] = dict(src='bone-verde', scale=3, marks=[
    dict(logo='arc', rect=(264, 338, 36, 58), rot=-18, fx='embroidery', color='#D6CCB6', angle=-35, period=3.2, light=150, raised=1.8, tex=0.9, soft=0.5),
])
