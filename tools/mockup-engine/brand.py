"""Brand-application engine: official TaMa SVGs composited onto upscaled product photos
with material-aware treatments (foil, deboss, print, laser, embroidery, pattern).

Coordinates in specs are in SOURCE pixels (the 850x780 / 1600x900 web originals);
everything is rendered at MASTER resolution (source * scale).
"""
import io, os, re, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi
import resvg_py

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))                      # tama-site/
LOGOS = os.path.join(ROOT, 'brand', 'logos') + os.sep              # SVGs oficiais (cópia versionada)
SRC_DIR = os.path.join(ROOT, 'img', 'v2') + os.sep                 # fotos-base do site (850x780)
# Bases ampliadas 4x (Real-ESRGAN, ver upscale.py). Ficam só no computador (349 MB, fora do Git): sem elas o motor
# amplia com LANCZOS, o que basta para as bases do simulador (1600 px).
X4_DIR = os.environ.get('MOCKUP_X4', os.path.join(ROOT, 'midia', 'mockups', 'x4'))
BRANDS = os.path.join(HERE, 'brands')                              # marcas fictícias usadas em alguns mockups

# ---------------------------------------------------------------- logos
LOGO_FILES = {
    'h': 'tama-logo-horizontal-positivo',   # petal + TaMa + CREATIVE
    'v': 'tama-logo-vertical-positivo',
    'arc': 'tama-simbolo-ameixa',           # the petal alone
    'word': 'tama-wordmark-positivo',
    'pattern': 'tama-padrao-arcos',
}


def logo_svg(kind):
    if kind in LOGO_FILES:
        return open(LOGOS + LOGO_FILES[kind] + '.svg', encoding='utf-8').read()
    return open(os.path.join(BRANDS, kind + '.svg'), encoding='utf-8').read()


def render_logo(kind, width, mono=None):
    """RGBA of the logo, cropped to ink. mono='#hex' recolours every fill (alpha mask use)."""
    svg = logo_svg(kind)
    if mono:
        svg = re.sub(r'fill="#[0-9A-Fa-f]{6}"', f'fill="{mono}"', svg)
        if kind == 'pattern':  # drop the background rect of the pattern tile
            svg = re.sub(r'<rect[^>]*/>', '', svg)
    png = resvg_py.svg_to_bytes(svg_string=svg, width=int(width))
    im = Image.open(io.BytesIO(bytes(png))).convert('RGBA')
    bb = im.getchannel('A').getbbox()
    return im.crop(bb) if bb else im


def logo_aspect(kind):
    im = render_logo(kind, 800)
    return im.width / im.height

# ---------------------------------------------------------------- geometry
def rect_quad(cx, cy, w, kind=None, aspect=None, rot=0.0, h=None):
    """Axis-aligned (optionally rotated) logo box, in source px: TL, TR, BR, BL."""
    if h is None:
        h = w / (aspect or logo_aspect(kind))
    a = math.radians(rot)
    pts = []
    for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        x, y = sx * w / 2, sy * h / 2
        pts.append((cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)))
    return pts


def _coeffs(dst, src):
    """PIL PERSPECTIVE coefficients mapping output (dst) points to input (src) points."""
    A, B = [], []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); B.append(v)
    return np.linalg.solve(np.array(A, float), np.array(B, float)).tolist()


def place(kind, quad, size, mono='#000000', ss=3, color=False):
    """Warp the logo into `quad` (master px). Returns (alpha float HxW, rgb float HxWx3 or None, bbox)."""
    W, H = size
    xs, ys = [p[0] for p in quad], [p[1] for p in quad]
    x0, y0 = max(0, int(min(xs)) - 4), max(0, int(min(ys)) - 4)
    x1, y1 = min(W, int(math.ceil(max(xs))) + 4), min(H, int(math.ceil(max(ys))) + 4)
    qw = max(math.dist(quad[0], quad[1]), math.dist(quad[3], quad[2]))
    lg = render_logo(kind, max(64, qw * ss * 1.6) * (1 if kind != 'pattern' else 1), mono=None if color else mono)
    lw, lh = lg.size
    dst = [((x - x0) * ss, (y - y0) * ss) for x, y in quad]
    src = [(0, 0), (lw, 0), (lw, lh), (0, lh)]
    cw, ch = (x1 - x0) * ss, (y1 - y0) * ss
    warped = lg.transform((cw, ch), Image.PERSPECTIVE, _coeffs(dst, src), Image.BICUBIC, fillcolor=(0, 0, 0, 0))
    warped = warped.reduce(ss)
    arr = np.asarray(warped).astype(np.float32) / 255.0
    alpha = np.zeros((H, W), np.float32); alpha[y0:y1, x0:x1] = arr[..., 3]
    rgb = None
    if color:
        rgb = np.zeros((H, W, 3), np.float32); rgb[y0:y1, x0:x1] = arr[..., :3]
    return alpha, rgb, (x0, y0, x1, y1)


def cylinder(alpha, cx, R, rgb=None):
    """Wrap a mask placed flat (tangent at cx) around a vertical cylinder of radius R (master px)."""
    H, W = alpha.shape
    xs = np.arange(W, dtype=np.float32)
    t = np.clip((xs - cx) / R, -0.999, 0.999)
    src_x = cx + R * np.arcsin(t)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    coords = [yy, np.broadcast_to(src_x[None, :], (H, W))]
    a = ndi.map_coordinates(alpha, coords, order=1, mode='constant')
    a[:, np.abs(xs - cx) >= R * 0.999] = 0
    if rgb is not None:
        rgb = np.stack([ndi.map_coordinates(rgb[..., c], coords, order=1) for c in range(3)], -1)
    return a, rgb

# ---------------------------------------------------------------- helpers
def hexrgb(h):
    h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255.0


def lum(a):
    return a[..., 0] * 0.2126 + a[..., 1] * 0.7152 + a[..., 2] * 0.0722


def blur(a, s):
    if np.isscalar(s) and s <= 0: return a
    if a.ndim == 3: return np.stack([ndi.gaussian_filter(a[..., c], s) for c in range(a.shape[2])], -1)
    return ndi.gaussian_filter(a, s)


def surface_ref(base, alpha, grow=6):
    m = alpha > 0.04
    ring = ndi.binary_dilation(m, iterations=grow) & ~m
    L = lum(base)
    if ring.sum() < 20: ring = ndi.binary_dilation(m, iterations=grow)
    return float(np.median(L[ring])), base[ring].mean(0)


def relief(alpha, depth, light, sign):
    """Lambert shading delta of a height field sign*blur(alpha). light = angle in degrees, 0 = from right, 90 = from top."""
    Hh = sign * blur(alpha, depth)
    gy, gx = np.gradient(Hh)
    lx, ly = math.cos(math.radians(light)), -math.sin(math.radians(light))
    k = 1.0 / max(depth, 0.5)
    # normal ~ (-gx, -gy, 1/k); delta against the flat surface
    return (-gx * lx - gy * ly) * k * 2.2

# ---------------------------------------------------------------- treatments
def fx_print(base, a, color, opacity=0.95, tex=0.55, rgb=None):
    """Ink (silk, offset, pad print, ceramic decal): takes surface lighting and texture."""
    Lr, _ = surface_ref(base, a)
    shade = np.clip(lum(base) / max(Lr, 1e-3), 0.25, 2.2) ** tex
    C = rgb if rgb is not None else hexrgb(color)[None, None, :]
    ink = np.clip(C * shade[..., None], 0, 1)
    k = (a * opacity)[..., None]
    return base * (1 - k) + ink * k


def fx_foil(base, a, color='#C9A15F', light=120, depth=0.9, sheen=0.35, tex=0.5):
    Lr, _ = surface_ref(base, a)
    L = lum(base)
    hp = (L - blur(L, 2.0)) / max(Lr, 1e-3)
    H, W = a.shape
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    ys, xs = np.nonzero(a > 0.05)
    if len(xs):
        cx, cy, span = xs.mean(), ys.mean(), max(np.ptp(xs), np.ptp(ys), 1)
    else:
        cx, cy, span = W / 2, H / 2, W
    ang = math.radians(light)
    g = ((xx - cx) * math.cos(ang) - (yy - cy) * math.sin(ang)) / span
    sheen_map = 1.0 + sheen * np.sin(g * 2.6 + 0.6)
    light_shade = np.clip(L / max(Lr, 1e-3), 0.4, 1.8) ** 0.6
    C = hexrgb(color)[None, None, :]
    metal = C * (sheen_map * light_shade)[..., None] + (hp * tex * 1.6)[..., None]
    rel = relief(a, depth, light, -1) * 0.18
    metal = metal + rel[..., None]
    k = a[..., None]
    out = base * (1 - k) + np.clip(metal, 0, 1) * k
    # pressure ring around the foil (slight deboss)
    edge = relief(a, depth * 1.6, light, -1) * 0.06 * (1 - a)
    return np.clip(out + edge[..., None] * base, 0, 1)


def fx_deboss(base, a, light=120, depth=1.6, strength=1.0, darken=0.10, sign=-1, gloss=0.0):
    """Blind deboss/emboss (leather, paper, board). darken: burnish inside the pressed area."""
    rel = relief(a, depth, light, sign) * strength
    inner = blur(a, depth * 0.5)
    out = base * (1 + rel[..., None] * 0.55)
    out = out * (1 - darken * inner)[..., None]
    if gloss:
        out = out + gloss * inner[..., None] * blur(np.clip(rel, 0, None), 0.8)[..., None]
    return np.clip(out, 0, 1)


def fx_laser(base, a, color='#B8B5AD', tex=0.85, light=120, depth=0.7, opacity=1.0):
    """Laser on powder coat / anodised metal: exposes metal that follows the object's shading."""
    m = a > 0.04
    wide = ndi.binary_dilation(m, iterations=40)
    Lr = float(np.percentile(lum(base)[wide], 92))
    shade = np.clip(lum(base) / max(Lr, 1e-3), 0.3, 2.0) ** tex
    metal = hexrgb(color)[None, None, :] * shade[..., None]
    H, W = a.shape
    rng = np.random.default_rng(11)
    brush = blur(rng.normal(0, 1, (H, W)).astype(np.float32), (0.4, 6.0)) * 0.05
    metal = metal * (1 + brush[..., None])
    k = (a * opacity)[..., None]
    out = base * (1 - k) + np.clip(metal, 0, 1) * k
    out = out * (1 + relief(a, depth, light, -1)[..., None] * 0.12)
    return np.clip(out, 0, 1)


def illum(base, a, grow=60, pct=90, lo=0.2, hi=1.25, k=0.8):
    """Illumination proxy: local luminance relative to the best-lit part of the same object."""
    wide = ndi.binary_dilation(a > 0.04, iterations=grow)
    Lr = float(np.percentile(lum(base)[wide], pct))
    return np.clip(blur(lum(base), 1.0) / max(Lr, 1e-3), lo, hi) ** k


def fx_embroidery(base, a, color, angle=35, period=2.4, light=120, raised=1.3, tex=0.8, shadow=0.45):
    shade = illum(base, a, k=tex)
    H, W = a.shape
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    rng = np.random.default_rng(5)
    th = math.radians(angle)
    u = xx * math.cos(th) + yy * math.sin(th)
    v = -xx * math.sin(th) + yy * math.cos(th)
    jitter = blur(rng.normal(0, 1, (H, W)).astype(np.float32), 3.0) * 6.0
    stripes = 0.5 + 0.5 * np.sin(2 * math.pi * (u + jitter) / period)
    sheen = 0.80 + 0.32 * stripes ** 1.5
    sheen *= 1 + 0.06 * np.sin(2 * math.pi * v / (period * 7.0))
    C = hexrgb(color)[None, None, :]
    thread = C * (sheen * shade)[..., None]
    rel = relief(a, raised, light, +1)
    thread = thread * (1 + rel[..., None] * 0.6)
    inner = blur(a, raised * 1.2)
    thread = thread * (0.72 + 0.28 * np.clip(inner * 1.6, 0, 1))[..., None]   # thread rolls over at the edges
    # cast shadow of the raised thread onto the fabric
    lx, ly = math.cos(math.radians(light)), -math.sin(math.radians(light))
    sh = ndi.shift(blur(a, raised), (-ly * raised * 1.2, -lx * raised * 1.2), order=1)  # cast away from the light
    shaded_base = base * (1 - shadow * np.clip(sh - a, 0, 1))[..., None]
    k = blur(a, 0.35)[..., None]
    return np.clip(shaded_base * (1 - k) + np.clip(thread, 0, 1) * k, 0, 1)


def fx_label(base, a, quad_mask, fabric='#F1ECE3', text_color='#65253D', **kw):
    """Woven/printed label: a small fabric rectangle with the logo printed on it."""
    out = fx_print(base, quad_mask, fabric, opacity=1.0, tex=0.35)
    out = out * (1 + relief(quad_mask, 1.2, kw.get('light', 120), +1)[..., None] * 0.25)
    return fx_print(out, a, text_color, opacity=0.95, tex=0.4)


# ---------------------------------------------------------------- cleanup (remove fake glyphs)
def clean(base, poly, donor, feather=2.0, sigma_lf=6.0):
    """Seamless clone: fill the polygon with the donor area (offset) and spread the colour
    difference measured on the border into the hole (membrane), like a Poisson clone."""
    H, W = base.shape[:2]
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon([tuple(p) for p in poly], fill=255)
    m = np.asarray(m).astype(np.float32) / 255.0
    hard = m > 0.5
    ys, xs = np.nonzero(hard)
    pad = int(sigma_lf * 6) + 4
    y0, y1 = max(0, ys.min() - pad), min(H, ys.max() + pad)
    x0, x1 = max(0, xs.min() - pad), min(W, xs.max() + pad)
    B = base[y0:y1, x0:x1]
    hm = hard[y0:y1, x0:x1]
    ring = ndi.binary_dilation(hm, iterations=max(2, int(sigma_lf))) & ~hm
    if donor is None:   # smooth membrane + grain matched to the surroundings
        D = np.zeros_like(B)
        hp = B - blur(B, 1.2)
        sd = hp[ring].std(0) if ring.any() else np.full(3, 0.01, np.float32)
        nz = blur(np.random.default_rng(3).normal(0, 1, hm.shape).astype(np.float32), 0.5)
        nz /= nz.std() + 1e-6
        noise = nz[..., None] * sd[None, None, :] * 1.1
    else:
        dx, dy = int(donor[0]), int(donor[1])
        D = base[np.clip(np.arange(y0, y1) + dy, 0, H - 1)][:, np.clip(np.arange(x0, x1) + dx, 0, W - 1)]
        noise = 0
    diff = (B - D) * ring[..., None]
    wsum = ring.astype(np.float32)
    est = np.zeros_like(B); have = np.zeros(hm.shape, np.float32)
    for s in (sigma_lf, sigma_lf * 2, sigma_lf * 4, sigma_lf * 8):
        n = blur(diff, s); d = blur(wsum, s)
        take = (have < 0.5) & (d > 1e-3)
        est[take] = (n[take] / d[take][:, None]); have[take] = 1
    fill = D + est + noise
    k = blur(m[y0:y1, x0:x1], feather)[..., None]
    out = base.copy()
    out[y0:y1, x0:x1] = np.clip(B * (1 - k) + fill * k, 0, 1)
    return out


# ---------------------------------------------------------------- recolour (product colour variants)
def _srgb_to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


_M = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]], np.float32)
_MI = np.linalg.inv(_M).astype(np.float32)
_WP = np.array([0.95047, 1.0, 1.08883], np.float32)


def rgb2lab(rgb):
    xyz = (_srgb_to_lin(rgb) @ _M.T) / _WP
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def lab2rgb(lab):
    fy = (lab[..., 0] + 16) / 116
    fx = fy + lab[..., 1] / 500
    fz = fy - lab[..., 2] / 200
    f = np.stack([fx, fy, fz], -1)
    xyz = np.where(f ** 3 > 0.008856, f ** 3, (f - 16 / 116) / 7.787) * _WP
    return np.clip(_lin_to_srgb(xyz @ _MI.T), 0, 1)


def recolor(base, poly, src_hex, dst_hex, tol=18.0, keep=0.25, feather=1.2, sample=None, exclude=(), cmin_frac=0.45):
    """Recolour the object inside `poly` (master px) from its photographed colour to dst_hex.
    Pixels are selected softly by colour distance (a*b* mostly) to the object's own mean colour, so
    shadows and highlights follow; L keeps the object's shading, rescaled toward the target lightness."""
    H, W = base.shape[:2]
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon([tuple(p) for p in poly], fill=255)
    for ex in exclude:
        ImageDraw.Draw(m).polygon([tuple(p) for p in ex], fill=0)
    region = np.asarray(m).astype(np.float32) / 255.0
    ys, xs = np.nonzero(region > 0.5)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    B = base[y0:y1, x0:x1]
    R = region[y0:y1, x0:x1]
    lab = rgb2lab(B)
    if sample is not None:
        sx, sy, sr = sample
        sm = np.zeros(R.shape, bool); yy, xx = np.ogrid[:R.shape[0], :R.shape[1]]
        sm[(yy - (sy - y0)) ** 2 + (xx - (sx - x0)) ** 2 <= sr * sr] = True
        ref = np.median(lab[sm], 0)
    else:
        ref = rgb2lab(hexrgb(src_hex)[None, None, :])[0, 0]
        ref[0] = np.median(lab[..., 0][R > 0.5])
    # select by hue (stable under light and shadow) and by a minimum chroma (keeps neutral stone/paper out)
    C = np.hypot(lab[..., 1], lab[..., 2])
    hue = np.degrees(np.arctan2(lab[..., 2], lab[..., 1]))
    ref_c = float(np.hypot(ref[1], ref[2]))
    ref_h = float(np.degrees(np.arctan2(ref[2], ref[1])))
    dh = np.abs((hue - ref_h + 180) % 360 - 180)
    if ref_c < 12:          # near-neutral object (off-white, black): select by lightness instead of hue
        w = np.exp(-((lab[..., 0] - ref[0]) ** 2) / (2 * (tol * 1.2) ** 2)) * np.exp(-(np.maximum(C - ref_c - 8, 0) ** 2) / (2 * 6 ** 2))
    else:
        cmin = ref_c * cmin_frac
        w_c = np.clip((C - (cmin - 6)) / 12, 0, 1)
        w = np.exp(-(dh ** 2) / (2 * tol ** 2)) * w_c
    w = blur(w * R, feather)
    inside = w > 0.35
    Ls = lab[..., 0][inside]
    if Ls.size < 50:
        return base
    mL = float(np.median(Ls))
    src_lab = rgb2lab(hexrgb(src_hex)[None, None, :])[0, 0]
    dst_lab = rgb2lab(hexrgb(dst_hex)[None, None, :])[0, 0]
    tL = mL + (dst_lab[0] - src_lab[0])
    gain = float(np.clip(np.sqrt((dst_lab[0] + 8) / (src_lab[0] + 8)), 0.55, 1.6))
    mab = lab[..., 1:][inside].mean(0)
    new = lab.copy()
    new[..., 0] = np.clip(tL + (lab[..., 0] - mL) * gain, 0, 100)
    new[..., 1:] = dst_lab[1:] + (lab[..., 1:] - mab) * keep
    out_rgb = lab2rgb(new)
    out = base.copy()
    out[y0:y1, x0:x1] = B * (1 - w[..., None]) + out_rgb * w[..., None]
    return out

# ---------------------------------------------------------------- base image
def load_base(name, scale, esr=True):
    src = Image.open(SRC_DIR + name + '.webp').convert('RGB')
    W, H = src.width * scale, src.height * scale
    lz = np.asarray(src.resize((W, H), Image.LANCZOS)).astype(np.float32) / 255.0
    x4p = os.path.join(X4_DIR, name + '-x4.png')
    if not (esr and os.path.exists(x4p)):
        return lz, False
    ex = np.asarray(Image.open(x4p).convert('RGB').resize((W, H), Image.LANCZOS)).astype(np.float32) / 255.0
    # restore the mid-frequency texture the GAN smoothed away (paper, stone, fabric grain)
    s1, s2 = 0.6 * scale, 2.2 * scale
    band = lambda a: blur(a, s1) - blur(a, s2)
    out = ex + 0.65 * (band(lz) - band(ex))
    return np.clip(out, 0, 1), True


def grain(a, sigma=0.012, seed=1):
    H, W = a.shape[:2]
    n = np.random.default_rng(seed).normal(0, 1, (H, W)).astype(np.float32)
    n = blur(n, 0.55); n /= n.std() + 1e-6
    L = lum(a)
    amp = sigma * (0.6 + 0.8 * np.sqrt(np.clip(L, 0, 1)) * (1 - np.clip(L, 0, 1)) * 2)
    return np.clip(a + (n * amp)[..., None], 0, 1)

# ---------------------------------------------------------------- driver
def apply_spec(spec, esr=True, debug=False, variant=None, with_marks=True):
    """variant: (colour_name, dst_hex) -> recolour spec['recolor'] objects before the marks.
    with_marks=False: base limpa e recolorida, sem nenhuma marca (fotos-base do simulador "Veja sua marca")."""
    sc = spec['scale']
    base, used_esr = load_base(spec['src'], sc, esr)
    H, W = base.shape[:2]
    S = lambda pts: [(x * sc, y * sc) for x, y in pts]
    for c in spec.get('clean', []):
        base = clean(base, S(c['poly']), None if c.get('donor') is None else (c['donor'][0] * sc, c['donor'][1] * sc), c.get('feather', 1.5) * sc / 2, c.get('lf', 3) * sc)
    if variant is not None:
        vname, vhex = variant
        for rc in spec['recolor']:
            smp = rc.get('sample')
            base = recolor(base, S(rc['poly']), rc['src'], vhex, tol=rc.get('tol', 18.0), keep=rc.get('keep', 0.25), cmin_frac=rc.get('cmin', 0.45),
                           sample=None if smp is None else (smp[0] * sc, smp[1] * sc, smp[2] * sc),
                           exclude=[S(e) for e in rc.get('exclude', [])])
    marks = [dict(mk) for mk in spec.get('marks', [])] if with_marks else []
    if with_marks and variant is not None:
        for idx, ov in spec.get('variant_marks', {}).get(variant[0], {}).items():
            marks[idx].update(ov)
    for mk in marks:
        if 'quad' in mk:
            q = S(mk['quad'])
        elif 'plane' in mk:   # (cx, cy, bx, by, ax, ay, w, h): logo x along B, logo y (down) along A
            cx, cy, bx, by, ax, ay, w, h = mk['plane']
            nb, na = math.hypot(bx, by), math.hypot(ax, ay)
            bx, by, ax, ay = bx / nb * w / 2, by / nb * w / 2, ax / na * h / 2, ay / na * h / 2
            q = S([(cx - bx - ax, cy - by - ay), (cx + bx - ax, cy + by - ay), (cx + bx + ax, cy + by + ay), (cx - bx + ax, cy - by + ay)])
        else:
            r = mk['rect']
            q = S(rect_quad(r[0], r[1], r[2], kind=mk['logo'], rot=mk.get('rot', 0), h=r[3] if len(r) > 3 else None))
        fx = mk['fx']
        color_logo = fx == 'print' and mk.get('fullcolor')
        a, rgb, _ = place(mk['logo'], q, (W, H), color=color_logo)
        if 'cyl' in mk:
            cx, R = mk['cyl']
            a, rgb = cylinder(a, cx * sc, R * sc, rgb)
        if mk.get('clip'):
            cm = Image.new('L', (W, H), 0); ImageDraw.Draw(cm).polygon([tuple(p) for p in S(mk['clip'])], fill=255)
            cm = blur(np.asarray(cm).astype(np.float32) / 255.0, 0.8)
            a = a * cm
            if rgb is not None: rgb = rgb  # colour unaffected
        if mk.get('soft'):
            a = blur(a, mk['soft'] * sc / 3)
        a = np.clip(a * mk.get('alpha', 1.0), 0, 1)
        p = {k: v for k, v in mk.items() if k in ('color', 'light', 'depth', 'strength', 'darken', 'sign', 'gloss', 'tex', 'opacity', 'sheen', 'angle', 'period', 'raised', 'shadow')}
        for key in ('depth', 'period', 'raised'):
            if key in p: p[key] = p[key] * sc / 3
        if fx == 'print':
            base = fx_print(base, a, p.get('color', '#000000'), p.get('opacity', 0.95), p.get('tex', 0.55), rgb=rgb if color_logo else None)
        elif fx == 'foil':
            base = fx_foil(base, a, **{k: v for k, v in p.items() if k in ('color', 'light', 'depth', 'sheen', 'tex')})
        elif fx == 'deboss':
            base = fx_deboss(base, a, **{k: v for k, v in p.items() if k in ('light', 'depth', 'strength', 'darken', 'sign', 'gloss')})
        elif fx == 'laser':
            base = fx_laser(base, a, **{k: v for k, v in p.items() if k in ('color', 'tex', 'light', 'depth', 'opacity')})
        elif fx == 'embroidery':
            base = fx_embroidery(base, a, **{k: v for k, v in p.items() if k in ('color', 'angle', 'period', 'light', 'raised', 'tex', 'shadow')})
        else:
            raise ValueError(fx)
    base = grain(base, spec.get('grain', 0.010))
    return Image.fromarray((base * 255 + 0.5).astype(np.uint8)), used_esr
