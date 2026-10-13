# Agent C (objects). Coordinates in SOURCE px. light: degrees, 0 = from right, 90 = from top.
# Round 2: full signature clearly readable on the main product (card ~300 px) + colour variants (recolor).
# Tray bases seen at a grazing angle: the petal lies on the base plane, aligned with the tray diagonal,
# so it reads like the foreshortened petal of 'bandeja-couro' (plane vectors = b+a and a-b of the base edges).
GOLD = '#C9A15F'
BRASS = '#CDB98A'
BROWN = '#4A2E20'
CREAM_INK = '#EFE6D6'
SPECS = {}

# ---------------------------------------------------------------- overrides of specs.py keys
# Olive thermal bottle: laser v (larger than round 1), bottle recoloured (wooden cap untouched).
SPECS['garrafa-termica'] = dict(src='garrafa-termica', scale=3,
    recolor=[dict(poly=[(250, 28), (430, 28), (437, 36), (446, 48), (452, 60), (456, 72), (458, 90), (458, 110), (458, 595), (456, 608), (453, 619),
                        (448, 627), (442, 634), (434, 641), (424, 647), (412, 651), (400, 655), (270, 655), (256, 653), (245, 650), (236, 645), (229, 639),
                        (224, 633), (219, 626), (216, 615), (216, 110), (217.5, 90), (221, 72), (228, 58), (237, 46), (246, 36)],
                  src='#546447', sample=(290, 300, 8), tol=22, cmin=0.35)],
    marks=[
        dict(logo='v', rect=(339, 318, 140), fx='laser', cyl=(339, 121), color='#D4CFC5', tex=0.7),
    ],
    variant_marks={'Areia': {0: {'color': '#77736C', 'tex': 0.5}}, 'Ocre': {0: {'color': '#E6E2DA', 'tex': 0.6}}})

# Navy agenda: gold-foil v (larger than round 1), notebook recoloured.
CADERNO_CLEAN = [dict(poly=[(6, 401), (124, 401), (121, 477), (6, 477)], donor=(-22, 82), lf=2)]  # fake emboss on the burgundy card (as specs.py)
SPECS['caderno-azul'] = dict(src='caderno-azul', scale=3, clean=CADERNO_CLEAN,
    recolor=[dict(poly=[(88, 0), (563, 0), (563, 628), (88, 628)], src='#273e67', sample=(250, 200, 10), tol=22, cmin=0.28)],
    marks=[
        dict(logo='v', rect=(283, 300, 150), fx='foil', color=GOLD, light=45, depth=0.9, tex=0.38),
    ],
    variant_marks={'Preto': {0: {'tex': 0.14}}})   # on black the paper-texture term turns the foil grainy

# ---------------------------------------------------------------- agent C keys
# 1. Mustard mug on saucer: fictional client brand (Casa Mirelo) as a ceramic decal wrapped on the body.
SPECS['caneca-ceramica'] = dict(src='caneca-ceramica', scale=3,
    recolor=[dict(poly=[(257, 252), (260, 246), (265, 240), (275, 234), (290, 229.5), (310, 226.5), (340, 224.5), (380, 223.5), (415, 223.5), (470, 224.5),
                        (510, 226.5), (540, 230.5), (555, 235.5), (565, 241.5), (570, 247.5), (572, 255), (570, 300), (568.5, 350), (568.5, 419),
                        (587, 425.5), (605, 429.5), (620, 434.5), (626, 440), (630, 448), (632, 458), (631, 470), (627, 478), (617, 490), (605, 500),
                        (592, 507), (567, 520), (542, 528), (520, 539), (500, 545), (470, 548.5), (400, 551), (330, 549), (295, 542.5), (275, 536.5), (250, 523),
                        (225, 510), (212, 504), (199, 496.5), (188.5, 483), (183, 468), (183, 455), (188.5, 441), (199, 430), (212, 423), (232, 416), (255.5, 413.5),
                        (255.5, 300)], src='#d29b35', sample=(300, 350, 8), tol=27, cmin=0.26)],
    marks=[
        dict(logo='casa-mirelo', rect=(415, 360, 204), fx='print', color=BROWN, opacity=0.93, tex=0.7, cyl=(415, 156), soft=0.35),
    ],
    variant_marks={'Verde': {0: {'color': CREAM_INK, 'tex': 0.6}}, 'Azul': {0: {'color': CREAM_INK, 'tex': 0.6}}})

# 2. Black pen + tan leather tray + navy notebook. Main mark: gold-foil h on the tray's outer front wall.
SPECS['caneta-executiva'] = dict(src='caneta-executiva', scale=3,
    recolor=[dict(poly=[(0, 355), (20, 352), (40, 349), (60, 346), (75, 343), (100, 340), (116, 338), (145, 336), (200, 334), (260, 332), (315, 331),
                        (339, 370), (320, 370.5), (300, 372), (260, 378), (230, 384), (200, 388), (170, 392), (145, 396.5), (130, 399), (118, 400.5),
                        (105, 398.5), (95, 394.5), (90, 392), (45, 400), (0, 408)],
                  src='#25252a', sample=(200, 362, 4), tol=22, cmin=0.28)],   # pen body; gold ring and clip drop out by chroma
    marks=[
        dict(logo='h', plane=(550, 459, 0.869, 0.494, -0.1, 1, 280, 75), fx='foil', color=GOLD, light=40, depth=0.9, sheen=0.3, tex=0.35),
        dict(logo='arc', rect=(58, 369, 17, 15), rot=-3, fx='laser', color=BRASS, tex=1.0, opacity=0.95, soft=0.45),
        dict(logo='arc', plane=(800, 425, 1.851, 0.264, -0.101, 0.704, 55.5, 21.1), fx='deboss', light=40, depth=1.6, strength=0.9, darken=0.10, gloss=0.15),
    ],
    variant_marks={'Cobre': {1: {'color': '#3E2A1E', 'tex': 0.5}}})   # on the light copper lacquer the engraving reads darker

# 3. Navy notebook + tan leather tray: gold-foil v on the cover, gold-foil h on the tray's outer wall, petal debossed on the base.
SPECS['caderno-premium'] = dict(src='caderno-premium', scale=3, clean=[
    dict(poly=[(722, 655), (779, 652), (781, 684), (722, 687)], donor=None, lf=2),   # fake AI mark on the tray base
], recolor=[dict(poly=[(222, -1), (617, -1), (617, 40), (609, 300), (606, 470), (340, 540), (345, 589), (150, 592), (152, 560)], src='#23385b',
                 sample=(300, 200, 10), tol=22, cmin=0.18)],   # generous towards the tray: orange drops out by hue
   marks=[
    dict(logo='v', plane=(358, 285, 1, -0.03, -0.083, 1, 128, 106), fx='foil', color=GOLD, light=50, depth=0.9, tex=0.38),
    dict(logo='h', plane=(470, 661, 0.857, 0.514, -0.1, 1, 187, 50), fx='foil', color=GOLD, light=40, depth=0.9, sheen=0.3, tex=0.35),
    dict(logo='arc', plane=(752, 666, 1.849, 0.206, -0.081, 0.730, 52.6, 20.8), fx='deboss', light=40, depth=1.6, strength=0.9, darken=0.10, gloss=0.15),
],
   variant_marks={'Preto': {0: {'tex': 0.14}}, 'Terracota': {0: {'color': '#E8D6A6', 'tex': 0.3}}})   # pale gold keeps the v apart from the terracotta cover

# 4. Dark-green leather tray with olive ribbon: gold-foil h on the outer front wall, petal debossed on the base, tray recoloured.
SPECS['couro-verde'] = dict(src='couro-verde', scale=3,
    recolor=[dict(poly=[(0, 250), (150, 233), (274, 220), (363, 208), (372, 203), (404, 201), (470, 235), (570, 286.5), (650, 319.5), (700, 337.5), (716, 343), (714, 360), (712, 380), (685, 382), (595, 434), (499, 489),
                        (440, 537), (340, 552), (141, 581), (110, 586), (75, 575), (0, 558)], src='#334d3b', sample=(100, 300, 6), tol=28, cmin=0.28,
                  exclude=[[(448, 410), (468, 330), (488, 276), (503, 249), (548, 245), (590, 256), (620, 262), (652, 278), (664, 300), (640, 312), (600, 302),
                            (575, 292), (562, 322), (548, 362), (522, 388), (495, 410)]])],   # olive ribbon loop lying in the tray
    marks=[
        dict(logo='h', plane=(300, 485, 0.993, -0.12, 0, 1, 230, 61), fx='foil', color=GOLD, light=30, depth=0.9, sheen=0.3, tex=0.35),
        dict(logo='arc', plane=(225, 400, 1.873, 0.323, -0.105, 0.613, 48.4, 15.8), fx='deboss', light=30, depth=1.6, strength=1.2, darken=0.12, gloss=0.2),
    ])

# 5. Comparison: caderno-azul with the fictional client brand instead of TaMa (same spot, gold foil, light, texture).
SPECS['caderno-azul--casa-mirelo'] = dict(src='caderno-azul', scale=3, clean=CADERNO_CLEAN, marks=[
    dict(logo='casa-mirelo', rect=(283, 300, 220), fx='foil', color=GOLD, light=45, depth=0.9, tex=0.38),
])

# 6. Hero (1600x900): notebook v foil, tray h foil (outer front wall) + petal deboss, bottle v laser, box petal foil. Mug unbranded. No variants.
SPECS['hero-gift'] = dict(src='hero-gift', scale=2, clean=[
    dict(poly=[(611, 641), (656, 639), (657, 667), (612, 669)], donor=None, lf=2),   # fake AI mark on the tray base
], marks=[
    dict(logo='v', plane=(361, 379, 1, -0.02, -0.08, 1, 77, 66), fx='foil', color=GOLD, light=150, depth=0.9, tex=0.38),
    dict(logo='h', plane=(475, 662, 0.851, 0.526, -0.1, 1, 150, 40), fx='foil', color=GOLD, light=150, depth=0.9, sheen=0.3, tex=0.35),
    dict(logo='arc', plane=(632, 650, 1.818, 0.267, -0.118, 0.773, 44.2, 18.8), fx='deboss', light=160, depth=1.6, strength=1.05, darken=0.12, gloss=0.15),
    dict(logo='v', rect=(917, 305, 77), fx='laser', cyl=(917, 83), color='#D4CFC5', tex=0.7),
    # gift-kit objects: same treatment as kit-presente (this frame contains it; positions mapped by agent B)
    dict(logo='v', rect=(1509.1, 445.1, 118.6), fx='foil', color=GOLD, light=100, depth=0.9, sheen=0.25, tex=0.3),
    dict(logo='h', rect=(1268.0, 390.5, 146.2), rot=20.5, fx='print', color='#65253D', opacity=0.92, tex=0.8, soft=0.3),
    dict(logo='arc', rect=(1464.0, 621.3, 28.5), fx='deboss', light=140, depth=1.8, strength=2.0, darken=0.12, gloss=0.2),
])
