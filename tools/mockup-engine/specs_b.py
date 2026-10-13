# Agent B: paper, stationery and packaging. Coordinates in SOURCE px. light: 0 = from right, 90 = from top.
GOLD = '#C9A15F'; COPPER = '#C08457'; CREAM = '#F3ECDF'; PLUM = '#65253D'
SPECS = {}
# hero-brand, kit-papelaria, papelaria-cores, cartoes-colors (and the approved caixa-terracota, caderno-azul, sacola-verde)
# are crops of ONE frame (phase correlation): kit-papelaria = 1.17*hero + (-500,-146); papelaria-cores = 1.26*kit + (-346,-280);
# cartoes-colors = 1.61*kit + (-290,-626); caixa-terracota = 1.48*kit + (-288,-202). Shared marks use mapped positions.

# Box mark shared by the stationery scene: gold-foil h on the front face, following the face slope (vector (307,-22)).
# Defined in caixa-terracota coords (centre (410,258), width 330) and mapped to the other crops.
_BOX = dict(caixa=(410, 258, 330))
_BOX['kit'] = ((410 + 288) / 1.48, (255 + 202) / 1.48, 300 / 1.48)
_BOX['pc'] = (1.26 * _BOX['kit'][0] - 346, 1.26 * _BOX['kit'][1] - 280, 1.26 * _BOX['kit'][2])
_BOX['hero'] = ((_BOX['kit'][0] + 500) / 1.17, (_BOX['kit'][1] + 146) / 1.17, _BOX['kit'][2] / 1.17)


def _box_h(key, **kw):
    cx, cy, w = _BOX[key]
    d = dict(logo='h', plane=(cx, cy, 307, -22, 0, 1, w, w / 3.739), fx='foil', color=GOLD, light=60, depth=0.9, tex=0.4)
    d.update(kw)
    return d


# envelope flap mark (stationery scene): plum on the mustard paper (gold would vanish on mustard); gold foil on the darker variants
_ENV_PLUM = dict(fx='foil', color=PLUM, light=60, depth=0.9, sheen=0.25, tex=0.45)
_ENV_GOLD = dict(fx='foil', color=GOLD, light=60, depth=0.9, sheen=0.35, tex=0.4)
# box mark on light / mustard boxes
_BOX_PLUM = dict(color=PLUM, sheen=0.25, tex=0.45)

SPECS['caixa-terracota'] = dict(src='caixa-terracota', scale=3, clean=[
    dict(poly=[(126, 101), (346, 108), (346, 143), (126, 136)], donor=None),
    dict(poly=[(668, 334), (738, 334), (738, 402), (668, 402)], donor=(0, 95)),
    dict(poly=[(752, 326), (850, 326), (850, 396), (752, 396)], donor=(0, 95)),
    dict(poly=[(600, 584), (748, 587), (748, 602), (600, 599)], donor=None, lf=2),
], recolor=[
    dict(poly=[(0, 95.6), (281.8, 77.7), (647, 145.8), (646.5, 250), (644, 362), (600, 368.5), (450, 382), (300, 396), (178, 411), (100, 396),
               (20, 387), (0, 384.5)], src='#d06b4b', sample=(420, 330, 12), tol=24, cmin=0.2, keep=0.12),
], marks=[
    _box_h('caixa'),
    dict(logo='arc', rect=(704, 372, 34), fx='foil', color=GOLD, light=60, depth=0.8),
])

SPECS['kit-papelaria'] = dict(src='kit-papelaria', scale=3, clean=[
    # fake marks on the box lid
    dict(poly=[(283, 211), (336, 211), (337, 226), (283, 226)], donor=None, lf=2),
    dict(poly=[(355, 215), (422, 217), (422, 233), (355, 231)], donor=None, lf=2),
    # fake emboss on the standing burgundy card
    dict(poly=[(644, 362), (692, 362), (690, 405), (642, 405)], donor=(0, 70)),
    dict(poly=[(702, 357), (720, 357), (720, 372), (702, 372)], donor=(0, 70), lf=1),
    dict(poly=[(733, 364), (772, 364), (770, 406), (731, 406)], donor=(0, 70)),
    # fake text on the top of the card stack
    dict(poly=[(598, 532), (706, 535.5), (706, 543), (598, 540)], donor=None, lf=1),
], recolor=[
    dict(poly=[(86, 208), (385, 189), (632, 235), (630.5, 300), (629, 383), (600, 385.5), (500, 395), (400, 404.5), (330, 411), (314, 411.5), (300, 409),
               (200, 398), (100, 386), (86, 385)], src='#d26d4f', sample=(470, 330, 10), tol=24, cmin=0.2, keep=0.12),
], marks=[
    _box_h('kit'),
    dict(logo='arc', plane=(670.3, 387.8, 1, 0, -19, 170, 23, 23), fx='foil', color=GOLD, light=60, depth=0.8, tex=0.4),
    dict(logo='h', rect=(335.4, 472.7, 155), **_ENV_PLUM),
], variant_marks={'Areia': {0: _BOX_PLUM}, 'Mostarda': {0: _BOX_PLUM}})

SPECS['papelaria-cores'] = dict(src='papelaria-cores', scale=3, clean=[
    # fake marks on the box lid (top edge of the frame)
    dict(poly=[(118, 0), (186, 0), (186, 12), (118, 12)], donor=None, lf=2),
    # fake emboss on the standing burgundy card
    dict(poly=[(462, 180), (518, 180), (516, 222), (460, 222)], donor=(0, 90)),
    dict(poly=[(536, 168), (560, 168), (560, 188), (536, 188)], donor=(0, 90), lf=1),
    dict(poly=[(578, 180), (628, 180), (626, 232), (576, 232)], donor=(-10, 90)),
    dict(poly=[(605, 166), (640, 166), (638, 190), (605, 190)], donor=None, lf=1),
    # fake text on the top of the card stack
    dict(poly=[(335, 389), (515, 392), (515, 399), (335, 397)], donor=None, lf=1),
], recolor=[
    dict(poly=[(0, 271.5), (100, 268), (200, 265.5), (281, 263.5), (286, 270), (287.5, 285), (291, 300), (295, 350), (301, 400), (305, 440), (305.5, 445.5),
               (290, 447), (250, 452), (205, 455), (196, 452.5), (188, 448), (170, 443), (150, 439), (133.8, 436.1), (0, 520)], src='#c3883f', sample=(120, 330, 10), tol=22, cmin=0.4),
], marks=[
    dict(logo='h', rect=(115, 314, 160), **_ENV_PLUM),
    _box_h('pc'),
    dict(logo='arc', plane=(498.6, 208.6, 1, 0, -24, 218, 29, 29), fx='foil', color=GOLD, light=60, depth=0.8, tex=0.4),
    dict(logo='v', rect=(769.0, 82.5, 106.3), fx='foil', color=GOLD, light=45, depth=0.9, tex=0.38),   # navy notebook (caderno-azul mapped)
], variant_marks={'Bordô': {0: _ENV_GOLD}, 'Azul': {0: _ENV_GOLD}, 'Verde': {0: _ENV_GOLD}})

SPECS['cartoes-colors'] = dict(src='cartoes-colors', scale=3, clean=[
    # fake text on the top of the card stack
    dict(poly=[(690, 229), (818, 232), (818, 246), (690, 243)], donor=None, lf=1),
    # remnant of fake emboss at the top of the standing burgundy card
    dict(poly=[(745, 0), (802, 0), (802, 22), (745, 22)], donor=(0, 60)),
], recolor=[
    dict(poly=[(0, 81.5), (200, 78.5), (400, 71.5), (500, 67.5), (512, 70), (518, 80), (521.5, 100), (524.5, 120), (533.5, 200), (542, 280), (544.5, 300),
               (500, 305), (450, 310), (410, 315), (398, 316), (323, 289), (139, 410), (0, 410)], src='#c78c42', sample=(300, 130, 12), tol=22, cmin=0.4),
], marks=[
    dict(logo='h', rect=(250, 135, 250), **_ENV_PLUM),
    dict(logo='word', plane=(735, 236.5, 275, 10, 0.35, 1, 150, 13), fx='foil', color=GOLD, light=60, depth=0.6, tex=0.4),
], variant_marks={'Bordô': {0: _ENV_GOLD}, 'Oliva': {0: _ENV_GOLD}, 'Azul': {0: _ENV_GOLD}})

# ---- gift kit scene. manta-textil is a crop of kit-presente (manta = 1.17*kit + (-95, 0), verified on the stone, mug and
# green-box edges); embalagem-presente is a slightly different viewpoint (parallax), so its outlines are measured on its own.
# Marks: gold-foil v on the standing lid, plum-printed h on the lavender band (the blanket's personalised label),
# blind-debossed petal on the leather strap of the green box. The mug stays unbranded.
_KIT_SIL = [(128, 318), (160, 301), (169, 295), (179, 292), (186, 292), (192, 280), (200, 260), (214, 236), (234, 208), (256, 192), (300, 192), (334, 195), (340, 180),
            (350, 150), (359, 124), (364, 115), (380, 119), (450, 123), (520, 129), (600, 137), (624, 139), (627, 120), (640, 125),
            (700, 127), (780, 127), (850, 129), (850, 457), (800, 456), (760, 454), (720, 452), (690, 455), (640, 455), (600, 460),
            (440, 488), (437, 570), (401, 570), (399, 545), (392, 534), (376, 528), (350, 521), (321, 519), (321, 444), (310, 441), (280, 433),
            (230, 425), (180, 417), (139, 410), (136, 390), (130, 340)]
_KIT_OPEN = [(183, 324), (190, 280), (205, 245), (225, 215), (252, 185), (300, 182), (345, 180), (380, 170), (400, 164), (450, 170),
             (500, 177), (560, 183), (600, 186), (619, 188), (615, 250), (612, 300), (605, 334), (600, 339), (590, 346),
             (585, 349), (575, 357), (560, 367), (540, 367), (500, 362), (400, 349),
             (300, 337), (200, 325)]
_EMB_SIL = [(0, 320), (80, 233), (130, 241), (183, 250), (186, 232), (196, 200), (206, 160), (213, 143), (250, 147), (350, 155),
            (450, 163), (540, 171), (549, 171), (552, 152), (600, 156), (700, 156), (800, 158), (850, 158), (850, 594),
            (820, 594), (760, 589), (700, 586), (640, 590), (580, 590), (540, 590), (500, 597), (450, 607), (400, 617), (360, 625),
            (309, 636), (309, 742), (264, 742), (263, 712), (258, 700), (245, 690), (220, 683), (180, 679), (157, 678), (157, 582),
            (155, 578), (152, 574), (145, 570), (130, 568), (100, 564), (80, 561), (30, 549), (0, 547)]
_EMB_OPEN = [(0, 322), (25, 280), (55, 245), (80, 231), (130, 240), (190, 257), (198, 240), (220, 219), (260, 211), (300, 206),
             (400, 222), (500, 232), (549, 232), (546, 260), (543, 300), (540, 350), (537, 400), (534, 430), (500, 453), (450, 467), (400, 471), (300, 456),
             (200, 444), (100, 432), (20, 421), (0, 420)]


def _m(pts, s, tx, ty):
    return [(round(s * x + tx, 1), round(s * y + ty, 1)) for x, y in pts]


_LID_PLUM = dict(color=PLUM, sheen=0.25, tex=0.45)


def _gift(name, lid, band, strap, recolor, light_variants):
    return dict(src=name, scale=3, recolor=recolor, marks=[
        dict(logo='v', rect=lid, fx='foil', color=GOLD, light=100, depth=0.9, sheen=0.25, tex=0.3),
        dict(logo='h', rect=band[:3], rot=band[3], fx='print', color=PLUM, opacity=0.92, tex=0.8, soft=0.3),
        dict(logo='arc', rect=strap, fx='deboss', light=140, depth=1.8, strength=2.0, darken=0.12, gloss=0.2),
    ], variant_marks={v: {0: _LID_PLUM} for v in light_variants})


SPECS['kit-presente'] = _gift('kit-presente', (735, 345, 150), (430, 276, 185, 20.5), (678, 568, 36),
    [dict(poly=_KIT_SIL, src='#d4683e', sample=(730, 380, 10), tol=28, cmin=0.15, keep=0.15, exclude=[_KIT_OPEN])], ['Areia'])

SPECS['embalagem-presente'] = _gift('embalagem-presente', (700, 450, 170), (300, 353.5, 243, 21.8), (625.6, 736.9, 47.3),
    [dict(poly=_EMB_SIL, src='#d56b3f', sample=(700, 400, 10), tol=28, cmin=0.15, keep=0.15, exclude=[_EMB_OPEN])], ['Creme'])

# manta-textil: the product is the blanket; recolour only the blanket (inside the box opening; the band is lavender and the
# box rim terracotta, both far in hue from the olive, so tol is kept tight).
SPECS['manta-textil'] = _gift('manta-textil', (758, 405, 150), (408, 323, 216, 21.5), (698.3, 664.6, 42.1),
    [dict(poly=_m(_KIT_OPEN, 1.17, -95, 0), src='#6c5b3c', sample=(500, 260, 8), tol=18, cmin=0.05, keep=0.2)], [])

# Green paper bag (override of specs.py): bigger cream-printed v, placed so "TaMa" sits in the sunlit band between the
# handle shadow and the box shadow; the whole bag (front, gusset, handles) is recoloured, the bottle and box stay.
SPECS['sacola-verde'] = dict(src='sacola-verde', scale=3, clean=[
    dict(poly=[(735, 351), (850, 351), (850, 369), (735, 369)], donor=None, lf=2),
], recolor=[
    dict(poly=[(191, 51), (262, 48), (268, 37), (362, 47), (368, 42), (402, 46), (404, 56), (548, 73), (552, 68), (588, 72),
               (590, 80), (680, 93), (681, 346), (551, 346), (549, 592), (287, 592), (287, 505), (275, 475), (265, 455),
               (265, 392), (172, 392), (176, 330), (180, 250), (185, 150)],
         src='#696c57', sample=(646, 224, 10), tol=26, cmin=0.1, keep=0.1),
], marks=[
    dict(logo='v', rect=(395, 418, 160), rot=2.0, fx='print', color='#ECE4D4', opacity=0.92, tex=0.75),
    dict(logo='arc', rect=(207, 590, 34), fx='laser', cyl=(207, 77), color='#C9C2B4', tex=0.9),
], variant_marks={'Creme': {0: dict(color=PLUM, tex=0.6)}})

SPECS['hero-brand'] = dict(src='hero-brand', scale=2, clean=[
    # fake marks on the box lid
    dict(poly=[(668, 305), (708, 305), (708, 319), (668, 319)], donor=None, lf=2),
    dict(poly=[(730, 309), (790, 310), (790, 324), (730, 323)], donor=None, lf=2),
    # fake emboss on the standing burgundy card
    dict(poly=[(980, 436), (1015, 436), (1014, 470), (979, 470)], donor=(0, 50)),
    dict(poly=[(1026, 428), (1044, 428), (1044, 443), (1026, 443)], donor=(0, 50), lf=1),
    dict(poly=[(1052, 430), (1077, 430), (1075, 482), (1050, 482)], donor=(-5, 55), lf=1),
    # fake text on the top of the card stack
    dict(poly=[(925, 580.5), (1035, 583), (1035, 590), (925, 587.5)], donor=None, lf=1),
], marks=[
    # positions of the bag, bottle, notebook and card marks are mapped from the approved crops
    # (sacola-verde = 1.22*hero + (-62,-20); caderno-azul = 1.775*hero + (-1818,-358); caixa-terracota = 1.7375*hero + (-1034,-422))
    dict(logo='v', rect=(374.6, 359.0, 131.1), rot=2.0, fx='print', color='#ECE4D4', opacity=0.92, tex=0.75),   # bag (sacola-verde mapped)
    dict(logo='arc', rect=(220.5, 500.0, 27.9), fx='laser', cyl=(220.5, 63.1), color='#C9C2B4', tex=0.9),
    dict(logo='v', rect=(1183.7, 370.7, 72.1), fx='foil', color=GOLD, light=45, depth=0.9, tex=0.38),
    dict(logo='arc', plane=(1000.3, 457.0, 1, 0, -15, 140, 19.6, 19.6), fx='foil', color=GOLD, light=60, depth=0.8, tex=0.4),
    _box_h('hero'),   # box front face: TL(698,346) TR(967,327) BR(967,455) BL(698,478)
    dict(logo='h', rect=(714.0, 528.8, 132.5), **_ENV_PLUM),   # envelope flap (kit-papelaria mapped)
])
