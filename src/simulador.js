/* TaMa Creative — "Veja sua marca em nossos produtos" (/veja-sua-marca/). Sem dependências.
   Composição determinística no navegador: o logo do cliente entra na área de aplicação de cada foto, com perspectiva
   e o efeito do material. É um porte de tools/mockup-engine/brand.py (fx_print, fx_foil, fx_deboss, fx_laser,
   fx_embroidery); as áreas vêm de src/data/simulador.json (gerado por tools/mockup-engine/simulador_export.py).
   Parâmetros do motor estão em px do "mestre" (foto x3); aqui o efeito é calculado numa grade de trabalho 2x a saída
   e reduzido. Prévia: 720 px com marca-d'água. Versão em alta (1600 px) só é gerada no envio, para o e-mail. */
(function () {
  'use strict';
  var root = document.getElementById('sim');
  if (!root) return;
  function readJSON(id) { try { return JSON.parse(document.getElementById(id).textContent); } catch (e) { return null; } }
  var SIM = readJSON('tama-sim');
  if (!SIM) return;
  var MAX_BYTES = 5 * 1024 * 1024;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var track = function (n, p) { if (window.tamaTrack) window.tamaTrack(n, p || {}); };
  var PROD = {};
  SIM.produtos.forEach(function (p) { PROD[p.slug] = p; });

  /* ================================================================ math helpers */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  function hexrgb(h) { h = String(h || '#000').replace('#', ''); return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]; }

  // Homografia que leva (u, v) do quadrado unitário aos 4 pontos (TL, TR, BR, BL); devolve a direta e a inversa.
  function homography(q) {
    var src = [[0, 0], [1, 0], [1, 1], [0, 1]], A = [], i, j, k;
    for (i = 0; i < 4; i++) {
      var u = src[i][0], v = src[i][1], x = q[i][0], y = q[i][1];
      A.push([u, v, 1, 0, 0, 0, -x * u, -x * v, x]);
      A.push([0, 0, 0, u, v, 1, -y * u, -y * v, y]);
    }
    for (i = 0; i < 8; i++) {   // eliminação de Gauss com pivô parcial
      var piv = i;
      for (j = i + 1; j < 8; j++) if (Math.abs(A[j][i]) > Math.abs(A[piv][i])) piv = j;
      var t = A[i]; A[i] = A[piv]; A[piv] = t;
      for (j = 0; j < 8; j++) if (j !== i) {
        var f = A[j][i] / A[i][i];
        for (k = i; k < 9; k++) A[j][k] -= f * A[i][k];
      }
    }
    var h = []; for (i = 0; i < 8; i++) h.push(A[i][8] / A[i][i]);
    var m = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
    var det = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
    var n = [
      (m[4] * m[8] - m[5] * m[7]) / det, (m[2] * m[7] - m[1] * m[8]) / det, (m[1] * m[5] - m[2] * m[4]) / det,
      (m[5] * m[6] - m[3] * m[8]) / det, (m[0] * m[8] - m[2] * m[6]) / det, (m[2] * m[3] - m[0] * m[5]) / det,
      (m[3] * m[7] - m[4] * m[6]) / det, (m[1] * m[6] - m[0] * m[7]) / det, (m[0] * m[4] - m[1] * m[3]) / det];
    function ap(M) { return function (x, y) { var w = M[6] * x + M[7] * y + M[8]; return [(M[0] * x + M[1] * y + M[2]) / w, (M[3] * x + M[4] * y + M[5]) / w]; }; }
    return { fwd: ap(m), inv: ap(n) };
  }

  function kernel(s) {
    var r = Math.max(1, Math.ceil(s * 3)), k = new Float32Array(2 * r + 1), sum = 0;
    for (var i = -r; i <= r; i++) { k[i + r] = Math.exp(-(i * i) / (2 * s * s)); sum += k[i + r]; }
    for (i = 0; i < k.length; i++) k[i] /= sum;
    return k;
  }
  // Desfoque gaussiano separável (bordas por repetição). sy/sx em px da grade de trabalho.
  function blur(src, w, h, sy, sx) {
    if (sx === undefined) sx = sy;
    var tmp = new Float32Array(src.length), out = new Float32Array(src.length), x, y, i, acc, r, k;
    if (sx > 0.12) {
      k = kernel(sx); r = (k.length - 1) / 2;
      for (y = 0; y < h; y++) {
        var row = y * w;
        for (x = 0; x < w; x++) {
          acc = 0;
          for (i = -r; i <= r; i++) acc += src[row + clamp(x + i, 0, w - 1)] * k[i + r];
          tmp[row + x] = acc;
        }
      }
    } else tmp.set(src);
    if (sy > 0.12) {
      k = kernel(sy); r = (k.length - 1) / 2;
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        acc = 0;
        for (i = -r; i <= r; i++) acc += tmp[clamp(y + i, 0, h - 1) * w + x] * k[i + r];
        out[y * w + x] = acc;
      }
    } else out.set(tmp);
    return out;
  }
  // Distância de Manhattan até o conjunto (equivale a binary_dilation com cruz, n iterações).
  function l1dist(mask, w, h) {
    var d = new Float32Array(w * h), INF = 1e9, x, y, i;
    for (i = 0; i < d.length; i++) d[i] = mask[i] ? 0 : INF;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x;
      if (x > 0 && d[i - 1] + 1 < d[i]) d[i] = d[i - 1] + 1;
      if (y > 0 && d[i - w] + 1 < d[i]) d[i] = d[i - w] + 1;
    }
    for (y = h - 1; y >= 0; y--) for (x = w - 1; x >= 0; x--) {
      i = y * w + x;
      if (x < w - 1 && d[i + 1] + 1 < d[i]) d[i] = d[i + 1] + 1;
      if (y < h - 1 && d[i + w] + 1 < d[i]) d[i] = d[i + w] + 1;
    }
    return d;
  }
  function percentile(vals, n, p) {
    if (!n) return 0.5;
    var a = vals.subarray(0, n).slice().sort();
    var pos = (p / 100) * (n - 1), lo = Math.floor(pos), hi = Math.min(n - 1, lo + 1);
    return a[lo] + (a[hi] - a[lo]) * (pos - lo);
  }
  function gradient(f, w, h) {
    var gx = new Float32Array(f.length), gy = new Float32Array(f.length), x, y, i;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x;
      gx[i] = x === 0 ? f[i + 1] - f[i] : x === w - 1 ? f[i] - f[i - 1] : (f[i + 1] - f[i - 1]) / 2;
      gy[i] = y === 0 ? f[i + w] - f[i] : y === h - 1 ? f[i] - f[i - w] : (f[i + w] - f[i - w]) / 2;
    }
    return { gx: gx, gy: gy };
  }
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function normalNoise(n, seed) {
    var r = rng(seed), out = new Float32Array(n);
    for (var i = 0; i < n; i += 2) {
      var u = Math.max(r(), 1e-9), v = r(), m = Math.sqrt(-2 * Math.log(u));
      out[i] = m * Math.cos(2 * Math.PI * v);
      if (i + 1 < n) out[i + 1] = m * Math.sin(2 * Math.PI * v);
    }
    return out;
  }
  function stdNormalize(a, target) {
    var s = 0, i; for (i = 0; i < a.length; i++) s += a[i] * a[i];
    var f = target / (Math.sqrt(s / a.length) || 1);
    for (i = 0; i < a.length; i++) a[i] *= f;
    return a;
  }

  /* ================================================================ effects (porte do brand.py) */
  // Contexto de trabalho: B (RGB 0..1, intercalado), L (luminância), a (alfa do logo), w, h, sf (px de trabalho por px do mestre).
  function relief(cx, depth, light, sign) {
    var hh = blur(cx.a, cx.w, cx.h, depth * cx.sf), i;
    if (sign < 0) for (i = 0; i < hh.length; i++) hh[i] = -hh[i];
    var g = gradient(hh, cx.w, cx.h), lx = Math.cos(light * Math.PI / 180), ly = -Math.sin(light * Math.PI / 180);
    var k = cx.sf / Math.max(depth, 0.5) * 2.2, out = new Float32Array(hh.length);
    for (i = 0; i < out.length; i++) out[i] = (-g.gx[i] * lx - g.gy[i] * ly) * k;
    return out;
  }
  function surfaceRef(cx, grow) {
    var n = cx.w * cx.h, m = new Uint8Array(n), i, cnt = 0;
    for (i = 0; i < n; i++) m[i] = cx.a[i] > 0.04 ? 1 : 0;
    var d = l1dist(m, cx.w, cx.h), g = Math.max(1, grow * cx.sf), vals = new Float32Array(n), rgb = [0, 0, 0];
    for (i = 0; i < n; i++) if (!m[i] && d[i] <= g) { vals[cnt++] = cx.L[i]; rgb[0] += cx.B[3 * i]; rgb[1] += cx.B[3 * i + 1]; rgb[2] += cx.B[3 * i + 2]; }
    if (cnt < 20) { cnt = 0; rgb = [0, 0, 0]; for (i = 0; i < n; i++) if (d[i] <= g) { vals[cnt++] = cx.L[i]; rgb[0] += cx.B[3 * i]; rgb[1] += cx.B[3 * i + 1]; rgb[2] += cx.B[3 * i + 2]; } }
    return { L: Math.max(percentile(vals, cnt, 50), 1e-3), rgb: cnt ? [rgb[0] / cnt, rgb[1] / cnt, rgb[2] / cnt] : [0.5, 0.5, 0.5] };
  }
  function wideRef(cx, grow, pct) {
    var n = cx.w * cx.h, m = new Uint8Array(n), i, cnt = 0;
    for (i = 0; i < n; i++) m[i] = cx.a[i] > 0.04 ? 1 : 0;
    var d = l1dist(m, cx.w, cx.h), g = grow * cx.sf, vals = new Float32Array(n);
    for (i = 0; i < n; i++) if (d[i] <= g) vals[cnt++] = cx.L[i];
    return Math.max(percentile(vals, cnt, pct), 1e-3);
  }
  function colorAt(cx, p, i) { return cx.rgb ? [cx.rgb[3 * i], cx.rgb[3 * i + 1], cx.rgb[3 * i + 2]] : p; }

  function fxPrint(cx, p) {
    var C = hexrgb(p.color || '#000000'), op = p.opacity == null ? 0.95 : p.opacity, tex = p.tex == null ? 0.55 : p.tex;
    var Lr = surfaceRef(cx, 6).L, out = new Float32Array(cx.B.length);
    for (var i = 0; i < cx.a.length; i++) {
      var sh = Math.pow(clamp(cx.L[i] / Lr, 0.25, 2.2), tex), k = cx.a[i] * op, c = colorAt(cx, C, i);
      for (var j = 0; j < 3; j++) { var b = cx.B[3 * i + j]; out[3 * i + j] = b * (1 - k) + clamp(c[j] * sh, 0, 1) * k; }
    }
    return out;
  }
  function fxFoil(cx, p) {
    var C = hexrgb(p.color || '#C9A15F'), light = p.light == null ? 120 : p.light, depth = p.depth == null ? 0.9 : p.depth;
    var sheen = p.sheen == null ? 0.35 : p.sheen, tex = p.tex == null ? 0.5 : p.tex, w = cx.w, n = w * cx.h, i, j;
    var Lr = surfaceRef(cx, 6).L, bl = blur(cx.L, w, cx.h, 2.0 * cx.sf);
    var sx = 0, sy = 0, c = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (i = 0; i < n; i++) if (cx.a[i] > 0.05) { var x = i % w, y = (i - x) / w; sx += x; sy += y; c++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    var mx = c ? sx / c : w / 2, my = c ? sy / c : cx.h / 2, span = c ? Math.max(x1 - x0, y1 - y0, 1) : w, ang = light * Math.PI / 180;
    var rel = relief(cx, depth, light, -1), edge = relief(cx, depth * 1.6, light, -1), out = new Float32Array(cx.B.length);
    for (i = 0; i < n; i++) {
      var xx = i % w, yy = (i - xx) / w, a = cx.a[i];
      var g = ((xx - mx) * Math.cos(ang) - (yy - my) * Math.sin(ang)) / span;
      var sm = 1 + sheen * Math.sin(g * 2.6 + 0.6), ls = Math.pow(clamp(cx.L[i] / Lr, 0.4, 1.8), 0.6);
      var hp = (cx.L[i] - bl[i]) / Lr * tex * 1.6 + rel[i] * 0.18, e = edge[i] * 0.06 * (1 - a);
      for (j = 0; j < 3; j++) {
        var b = cx.B[3 * i + j], metal = clamp(C[j] * sm * ls + hp, 0, 1);
        out[3 * i + j] = clamp(b * (1 - a) + metal * a + e * b, 0, 1);
      }
    }
    return out;
  }
  function fxDeboss(cx, p) {
    var light = p.light == null ? 120 : p.light, depth = p.depth == null ? 1.6 : p.depth, strength = p.strength == null ? 1 : p.strength;
    var darken = p.darken == null ? 0.1 : p.darken, sign = p.sign == null ? -1 : p.sign, gloss = p.gloss || 0, i, j;
    var rel = relief(cx, depth, light, sign), inner = blur(cx.a, cx.w, cx.h, depth * 0.5 * cx.sf), gl = null;
    for (i = 0; i < rel.length; i++) rel[i] *= strength;
    if (gloss) { var pos = new Float32Array(rel.length); for (i = 0; i < rel.length; i++) pos[i] = Math.max(rel[i], 0); gl = blur(pos, cx.w, cx.h, 0.8 * cx.sf); }
    var out = new Float32Array(cx.B.length);
    for (i = 0; i < rel.length; i++) for (j = 0; j < 3; j++) {
      var v = cx.B[3 * i + j] * (1 + rel[i] * 0.55) * (1 - darken * inner[i]);
      if (gl) v += gloss * inner[i] * gl[i];
      out[3 * i + j] = clamp(v, 0, 1);
    }
    return out;
  }
  function fxLaser(cx, p) {
    var C = hexrgb(p.color || '#B8B5AD'), tex = p.tex == null ? 0.85 : p.tex, light = p.light == null ? 120 : p.light;
    var depth = p.depth == null ? 0.7 : p.depth, op = p.opacity == null ? 1 : p.opacity, i, j;
    var Lr = wideRef(cx, 40, 92), n = cx.w * cx.h;
    var brush = stdNormalize(blur(normalNoise(n, 11), cx.w, cx.h, 0.4 * cx.sf, 6.0 * cx.sf), 0.0091);
    var rel = relief(cx, depth, light, -1), out = new Float32Array(cx.B.length);
    for (i = 0; i < n; i++) {
      var sh = Math.pow(clamp(cx.L[i] / Lr, 0.3, 2.0), tex) * (1 + brush[i]), k = cx.a[i] * op, r = 1 + rel[i] * 0.12, c = colorAt(cx, C, i);
      for (j = 0; j < 3; j++) { var b = cx.B[3 * i + j]; out[3 * i + j] = clamp((b * (1 - k) + clamp(c[j] * sh, 0, 1) * k) * r, 0, 1); }
    }
    return out;
  }
  function fxEmbroidery(cx, p) {
    var C = hexrgb(p.color || '#65253D'), angle = p.angle == null ? 35 : p.angle, period = (p.period == null ? 2.4 : p.period) * cx.sf;
    var light = p.light == null ? 120 : p.light, raised = p.raised == null ? 1.3 : p.raised, tex = p.tex == null ? 0.8 : p.tex;
    var shadow = p.shadow == null ? 0.45 : p.shadow, w = cx.w, h = cx.h, n = w * h, i, j;
    var Lr = wideRef(cx, 60, 90), bl = blur(cx.L, w, h, 1.0 * cx.sf);
    var jitter = stdNormalize(blur(normalNoise(n, 5), w, h, 3.0 * cx.sf), 0.564 * cx.sf);
    var th = angle * Math.PI / 180, ct = Math.cos(th), st = Math.sin(th);
    var detail = clamp((period - 2) / 2, 0, 1), mean = 0.934;   // listras abaixo de ~2 px viram textura média (sem moiré)
    var rel = relief(cx, raised, light, 1), inner = blur(cx.a, w, h, raised * 1.2 * cx.sf), ba = blur(cx.a, w, h, raised * cx.sf);
    var lx = Math.cos(light * Math.PI / 180), ly = -Math.sin(light * Math.PI / 180), dx = lx * raised * 1.2 * cx.sf, dy = ly * raised * 1.2 * cx.sf;
    var kk = blur(cx.a, w, h, 0.35 * cx.sf), out = new Float32Array(cx.B.length);
    for (i = 0; i < n; i++) {
      var x = i % w, y = (i - x) / w;
      var shade = Math.pow(clamp(bl[i] / Lr, 0.2, 1.25), tex);
      var u = x * ct + y * st, v = -x * st + y * ct;
      var stp = 0.5 + 0.5 * Math.sin(2 * Math.PI * (u + jitter[i]) / period);
      var sheen = 0.8 + 0.32 * Math.pow(stp, 1.5);
      sheen = mean + (sheen - mean) * detail;
      sheen *= 1 + 0.06 * Math.sin(2 * Math.PI * v / (period * 7));
      var t = (1 + rel[i] * 0.6) * (0.72 + 0.28 * clamp(inner[i] * 1.6, 0, 1));
      // sombra projetada do bordado (ndi.shift com interpolação linear)
      var sxp = x + dx, syp = y + dy, ix = Math.floor(sxp), iy = Math.floor(syp), fx = sxp - ix, fy = syp - iy;
      var s00 = (ix >= 0 && iy >= 0 && ix < w && iy < h) ? ba[iy * w + ix] : 0, s10 = (ix + 1 < w && iy >= 0 && iy < h && ix + 1 >= 0) ? ba[iy * w + ix + 1] : 0;
      var s01 = (ix >= 0 && iy + 1 < h && ix < w && iy + 1 >= 0) ? ba[(iy + 1) * w + ix] : 0, s11 = (ix + 1 < w && iy + 1 < h && ix + 1 >= 0 && iy + 1 >= 0) ? ba[(iy + 1) * w + ix + 1] : 0;
      var sh = s00 * (1 - fx) * (1 - fy) + s10 * fx * (1 - fy) + s01 * (1 - fx) * fy + s11 * fx * fy;
      var sb = 1 - shadow * clamp(sh - cx.a[i], 0, 1), c = colorAt(cx, C, i);
      for (j = 0; j < 3; j++) {
        var thread = clamp(c[j] * sheen * shade * t, 0, 1);
        out[3 * i + j] = clamp(cx.B[3 * i + j] * sb * (1 - kk[i]) + thread * kk[i], 0, 1);
      }
    }
    return out;
  }
  var FX = { print: fxPrint, foil: fxFoil, deboss: fxDeboss, laser: fxLaser, embroidery: fxEmbroidery };
  var FULLCOLOR = { print: 1, embroidery: 1 };
  var MARGIN = { embroidery: 23, laser: 15 };   // px da foto de origem: raio de leitura dos efeitos

  /* ================================================================ composition */
  var imgCache = {};
  function loadImage(url) {
    if (!imgCache[url]) imgCache[url] = new Promise(function (ok, fail) {
      var im = new Image();
      im.decoding = 'async';
      im.onload = function () { ok(im); };
      im.onerror = function () { delete imgCache[url]; fail(new Error('img')); };
      im.src = url;
    });
    return imgCache[url];
  }
  function baseUrl(prod, color, size) { var b = SIM.bases[prod.img + '~' + color]; return b && b[size]; }

  // Onde o logo do cliente entra: a caixa da assinatura TaMa vira a área; o logo cabe nela mantendo a proporção.
  function placement(area, logo, scale) {
    var q = area.q, bw = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2, bh = (dist(q[0], q[3]) + dist(q[1], q[2])) / 2;
    var s = Math.min(area.fit[0] * bw / logo.aspect, area.fit[1] * bh), cw = s * logo.aspect, ch = s;
    var cap = bw * bh * (area.fit[2] || 0.92);
    if (cw * ch > cap) { var f = Math.sqrt(cap / (cw * ch)); cw *= f; ch *= f; }
    cw *= scale; ch *= scale;
    if (area.role !== 'main' && Math.min(cw, ch) < 9) return null;
    var H = homography(q), du = cw / bw / 2, dv = ch / bh / 2;
    return [H.fwd(0.5 - du, 0.5 - dv), H.fwd(0.5 + du, 0.5 - dv), H.fwd(0.5 + du, 0.5 + dv), H.fwd(0.5 - du, 0.5 + dv)];
  }

  // Textura do logo na resolução necessária (alfa pré-multiplicado). mono: usa a máscara de tinta.
  function logoTexture(logo, tw, th, mono) {
    tw = Math.max(8, Math.min(Math.round(tw), logo.w * 2)); th = Math.max(8, Math.min(Math.round(th), logo.h * 2));
    var key = tw + 'x' + th + (mono ? 'm' : 'c');
    logo.tex = logo.tex || {};
    if (logo.tex[key]) return logo.tex[key];
    var c = document.createElement('canvas'); c.width = tw; c.height = th;
    var g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingQuality = 'high';
    g.drawImage(mono ? logo.monoCanvas : logo.canvas, 0, 0, tw, th);
    var d = g.getImageData(0, 0, tw, th).data, n = tw * th, t = { w: tw, h: th, a: new Float32Array(n), rgb: new Float32Array(3 * n) };
    for (var i = 0; i < n; i++) {
      var a = d[4 * i + 3] / 255; t.a[i] = a;
      t.rgb[3 * i] = d[4 * i] / 255 * a; t.rgb[3 * i + 1] = d[4 * i + 1] / 255 * a; t.rgb[3 * i + 2] = d[4 * i + 2] / 255 * a;
    }
    return (logo.tex[key] = t);
  }

  function applyArea(img, W, H, k, area, colorSlug, logo, opts, report) {
    var ov = (area.v && area.v[colorSlug]) || {}, fx = ov.fx || area.fx, p = {}, key;
    for (key in area.p) p[key] = area.p[key];
    for (key in ov) if (key !== 'fx') p[key] = ov[key];
    var L = placement(area, logo, opts.scale || 1);
    if (!L) return;
    var ws = 2 * k, sf = ws / 3, m = MARGIN[fx] || 5;
    var xs = L.map(function (pt) { return pt[0]; }), ys = L.map(function (pt) { return pt[1]; });
    var ox0 = clamp(Math.floor((Math.min.apply(null, xs) - m) * k), 0, W), ox1 = clamp(Math.ceil((Math.max.apply(null, xs) + m) * k), 0, W);
    var oy0 = clamp(Math.floor((Math.min.apply(null, ys) - m) * k), 0, H), oy1 = clamp(Math.ceil((Math.max.apply(null, ys) + m) * k), 0, H);
    var ow = ox1 - ox0, oh = oy1 - oy0;
    if (ow < 2 || oh < 2) return;
    var w = ow * 2, h = oh * 2, n = w * h, i, j, x, y;
    // base ampliada para a grade de trabalho
    var src = img.data, B = new Float32Array(3 * n), Lum = new Float32Array(n);
    for (y = 0; y < h; y++) {
      var fy = clamp(oy0 + (y + 0.5) / 2 - 0.5, 0, H - 1), y0 = Math.floor(fy), y1 = Math.min(H - 1, y0 + 1), ty = fy - y0;
      for (x = 0; x < w; x++) {
        var fxp = clamp(ox0 + (x + 0.5) / 2 - 0.5, 0, W - 1), x0 = Math.floor(fxp), x1 = Math.min(W - 1, x0 + 1), tx = fxp - x0;
        i = y * w + x;
        for (j = 0; j < 3; j++) {
          var v = (src[(y0 * W + x0) * 4 + j] * (1 - tx) + src[(y0 * W + x1) * 4 + j] * tx) * (1 - ty) + (src[(y1 * W + x0) * 4 + j] * (1 - tx) + src[(y1 * W + x1) * 4 + j] * tx) * ty;
          B[3 * i + j] = v / 255;
        }
        Lum[i] = B[3 * i] * 0.2126 + B[3 * i + 1] * 0.7152 + B[3 * i + 2] * 0.0722;
      }
    }
    // decide cores do logo x um tom (contraste com a superfície)
    var useColor = false;
    if (FULLCOLOR[fx]) {
      if (opts.mode === 'cores') useColor = true;
      else if (opts.mode !== 'tom') {
        var probe = { a: new Float32Array(n), B: B, L: Lum, w: w, h: h, sf: sf };
        var cxp = (L[0][0] + L[2][0]) / 2, cyp = (L[0][1] + L[2][1]) / 2;   // anel ao redor do centro da área
        for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
          var sx = (ox0 + (x + 0.5) / 2) / k, sy = (oy0 + (y + 0.5) / 2) / k;
          probe.a[y * w + x] = Math.hypot(sx - cxp, sy - cyp) < Math.min(dist(L[0], L[1]), dist(L[0], L[3])) / 2 ? 1 : 0;
        }
        // cores do logo só quando a maior parte do desenho contrasta com a superfície; senão, um tom (cor da técnica)
        var ref = surfaceRef(probe, 8), sl = ref.rgb[0] * 0.2126 + ref.rgb[1] * 0.7152 + ref.rgb[2] * 0.0722, low = 0, tot = 0;
        logo.samples.forEach(function (c) {
          var dl = Math.abs(c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722 - sl), dc = Math.hypot(c[0] - ref.rgb[0], c[1] - ref.rgb[1], c[2] - ref.rgb[2]);
          tot += c[3]; if (dl < 0.16 && dc < 0.32) low += c[3];
        });
        useColor = tot > 0 && low / tot < 0.25;
      }
    }
    if (report && FULLCOLOR[fx]) report.push(useColor ? 'cores' : 'tom');
    // logo com perspectiva (+ cilindro) na grade de trabalho
    var Hl = homography(L), tw = Math.max(dist(L[0], L[1]), dist(L[3], L[2])) * ws, th = Math.max(dist(L[0], L[3]), dist(L[1], L[2])) * ws;
    var tex = logoTexture(logo, tw, th, !useColor), a = new Float32Array(n), rgb = useColor ? new Float32Array(3 * n) : null;
    var cyl = area.cyl;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var X = (ox0 + (x + 0.5) / 2) / k, Y = (oy0 + (y + 0.5) / 2) / k;
      if (cyl) { var t = (X - cyl[0]) / cyl[1]; if (Math.abs(t) >= 0.999) continue; X = cyl[0] + cyl[1] * Math.asin(t); }
      var uv = Hl.inv(X, Y), u = uv[0] * tex.w - 0.5, vv = uv[1] * tex.h - 0.5;
      if (u < -1 || vv < -1 || u > tex.w || vv > tex.h) continue;
      var u0 = Math.floor(u), v0 = Math.floor(vv), du = u - u0, dv = vv - v0, acc = 0, cr = 0, cg = 0, cb = 0;
      for (var q = 0; q < 4; q++) {
        var uu = u0 + (q & 1), vq = v0 + (q >> 1);
        if (uu < 0 || vq < 0 || uu >= tex.w || vq >= tex.h) continue;
        var wt = ((q & 1) ? du : 1 - du) * ((q >> 1) ? dv : 1 - dv), ti = vq * tex.w + uu;
        acc += tex.a[ti] * wt;
        if (rgb) { cr += tex.rgb[3 * ti] * wt; cg += tex.rgb[3 * ti + 1] * wt; cb += tex.rgb[3 * ti + 2] * wt; }
      }
      i = y * w + x; a[i] = acc;
      if (rgb && acc > 1e-4) { rgb[3 * i] = cr / acc; rgb[3 * i + 1] = cg / acc; rgb[3 * i + 2] = cb / acc; }
    }
    if (area.clip) {   // recorte (ex.: o cordão do moletom passa por cima da estampa)
      var cc = document.createElement('canvas'); cc.width = w; cc.height = h;
      var g = cc.getContext('2d', { willReadFrequently: true });
      g.setTransform(ws, 0, 0, ws, -2 * ox0, -2 * oy0);
      g.beginPath(); area.clip.forEach(function (pt, ix) { if (ix) g.lineTo(pt[0], pt[1]); else g.moveTo(pt[0], pt[1]); }); g.closePath();
      g.fillStyle = '#fff'; g.fill();
      var cd = g.getImageData(0, 0, w, h).data, cm = new Float32Array(n);
      for (i = 0; i < n; i++) cm[i] = cd[4 * i + 3] / 255;
      cm = blur(cm, w, h, 0.8 * sf);
      for (i = 0; i < n; i++) a[i] *= cm[i];
    }
    if (area.soft) a = blur(a, w, h, area.soft * sf);
    if (p.alpha != null) for (i = 0; i < n; i++) a[i] = clamp(a[i] * p.alpha, 0, 1);
    var cx = { B: B, L: Lum, a: a, rgb: rgb, w: w, h: h, sf: sf };
    var R = FX[fx](cx, p);
    // diferença reduzida 2x2 e somada à saída
    for (y = 0; y < oh; y++) for (x = 0; x < ow; x++) {
      var o = ((oy0 + y) * W + ox0 + x) * 4;
      for (j = 0; j < 3; j++) {
        var s = 0;
        for (var dyy = 0; dyy < 2; dyy++) for (var dxx = 0; dxx < 2; dxx++) { var ii = ((2 * y + dyy) * w + 2 * x + dxx) * 3 + j; s += R[ii] - B[ii]; }
        src[o + j] = clamp(src[o + j] + s / 4 * 255, 0, 255);
      }
    }
  }

  function watermark(g, W, H) {
    g.save();
    var fs = Math.max(11, Math.round(W * 0.024));
    g.font = '600 ' + fs + 'px "DM Sans", "Segoe UI", Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.translate(W / 2, H / 2); g.rotate(-Math.PI / 7);
    var step = fs * 13, row = 0;   // discreta: poucas linhas, translúcidas
    for (var y = -H; y <= H; y += step * 0.55, row++) for (var x = -W - (row % 2) * step / 2; x <= W; x += step) {
      g.fillStyle = 'rgba(30, 22, 18, .07)'; g.fillText('PRÉVIA · TaMa Creative', x + 1, y + 1);
      g.fillStyle = 'rgba(255, 252, 246, .2)'; g.fillText('PRÉVIA · TaMa Creative', x, y);
    }
    g.restore();
    var label = 'Prévia · mockup ilustrativo', lf = Math.max(11, Math.round(W * 0.018));
    g.font = '600 ' + lf + 'px "DM Sans", "Segoe UI", Arial, sans-serif';
    var tw = g.measureText(label).width, pad = lf * 0.7, bh = lf * 2.1, bx = lf, by = H - bh - lf;
    g.fillStyle = 'rgba(37, 30, 26, .66)';
    g.beginPath();
    if (g.roundRect) g.roundRect(bx, by, tw + pad * 2, bh, bh / 2); else g.rect(bx, by, tw + pad * 2, bh);
    g.fill();
    g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(label, bx + pad, by + bh / 2);
  }

  // Composição completa. size: 'p' (prévia 720 px) ou 'f' (alta, 1600 px).
  function compose(prod, colorSlug, logo, opts) {
    var size = opts.size || 'p';
    return loadImage(baseUrl(prod, colorSlug, size)).then(function (im) {
      var W = size === 'f' ? 1600 : 720, k = W / SIM.w, H = Math.round(SIM.h * k);
      var c = opts.canvas || document.createElement('canvas'); c.width = W; c.height = H;
      var g = c.getContext('2d', { willReadFrequently: true });
      g.imageSmoothingQuality = 'high';
      g.drawImage(im, 0, 0, W, H);
      var data = g.getImageData(0, 0, W, H), report = [];
      prod.areas.forEach(function (area) { applyArea(data, W, H, k, area, colorSlug, logo, opts, report); });
      g.putImageData(data, 0, 0);
      if (opts.watermark) watermark(g, W, H);
      return { canvas: c, modes: report };
    });
  }

  /* ================================================================ logo intake */
  function fail(msg) { var e = new Error(msg); e.user = true; return e; }
  function sniff(b) {
    if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'png';
    if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpg';
    var head = '';
    for (var i = 0; i < Math.min(b.length, 1024); i++) head += String.fromCharCode(b[i]);
    head = head.replace(/^﻿|^\xEF\xBB\xBF/, '').replace(/^\s+/, '');
    if (/^(<\?xml|<svg|<!--|<!doctype svg)/i.test(head) && /<svg[\s>]/i.test(head)) return 'svg';
    if (/^(<\?xml|<!--)/i.test(head)) return 'maybe-svg';
    return null;
  }

  var SVG_NS = 'http://www.w3.org/2000/svg', XLINK_NS = 'http://www.w3.org/1999/xlink';
  var SVG_OK = {};
  ('svg g defs title desc symbol use path rect circle ellipse line polyline polygon lineargradient radialgradient stop clippath mask ' +
   'pattern style text tspan textpath image filter fegaussianblur feoffset feblend fecolormatrix fecomposite feflood femerge femergenode').split(' ').forEach(function (n) { SVG_OK[n] = 1; });
  var URL_EXT = /url\(\s*(['"]?)\s*(?!#)[^)]*\)/gi;
  function cleanCss(css) {
    return String(css).replace(/@import[^;]*;?/gi, '').replace(URL_EXT, 'none').replace(/expression\s*\(/gi, '(').replace(/-moz-binding[^;]*;?/gi, '').replace(/(javascript|vbscript)\s*:/gi, '');
  }
  // Sanitiza o SVG enviado: só elementos de desenho, sem scripts, eventos, links externos ou objetos estrangeiros.
  function sanitizeSvg(text) {
    if (/<!ENTITY/i.test(text)) throw fail('Este SVG usa recursos que não aceitamos (entidades). Exporte de novo ou envie um PNG.');
    var doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    var rootEl = doc.documentElement;
    if (doc.getElementsByTagName('parsererror').length || !rootEl || rootEl.localName !== 'svg' || rootEl.namespaceURI !== SVG_NS) throw fail('Não conseguimos ler este SVG. Exporte de novo ou envie um PNG.');
    function cleanAttrs(el, name) {
      Array.prototype.slice.call(el.attributes).forEach(function (at) {
        var n = at.name.toLowerCase(), v = at.value, ns = at.namespaceURI;
        if (ns && ns !== XLINK_NS && ns !== 'http://www.w3.org/XML/1998/namespace' && ns !== 'http://www.w3.org/2000/xmlns/') { el.removeAttributeNode(at); return; }
        if (n.indexOf('on') === 0) { el.removeAttributeNode(at); return; }
        if (at.localName === 'href') {
          var ok = name === 'image' ? /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(v.trim()) : v.trim().charAt(0) === '#';
          if (!ok) el.removeAttributeNode(at);
          return;
        }
        if (/(javascript|vbscript|data)\s*:/i.test(v)) { el.removeAttributeNode(at); return; }
        if (/url\(/i.test(v)) el.setAttribute(at.name, cleanCss(v));
      });
    }
    function walk(el) {
      Array.prototype.slice.call(el.childNodes).forEach(function (ch) {
        if (ch.nodeType === 7 || ch.nodeType === 8) { el.removeChild(ch); return; }   // instruções e comentários
        if (ch.nodeType !== 1) return;
        var name = (ch.localName || '').toLowerCase();
        if (ch.namespaceURI === SVG_NS && name === 'a') {   // link: mantém o desenho, tira o link
          walk(ch);
          while (ch.firstChild) el.insertBefore(ch.firstChild, ch);
          el.removeChild(ch);
          return;
        }
        if (ch.namespaceURI !== SVG_NS || !SVG_OK[name]) { el.removeChild(ch); return; }
        cleanAttrs(ch, name);
        if (name === 'style') { ch.textContent = cleanCss(ch.textContent); return; }
        walk(ch);
      });
    }
    cleanAttrs(rootEl, 'svg');
    walk(rootEl);
    var vb = (rootEl.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(parseFloat), w, h;
    if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) { w = vb[2]; h = vb[3]; }
    else {
      w = parseFloat(rootEl.getAttribute('width')); h = parseFloat(rootEl.getAttribute('height'));
      if (!(w > 0 && h > 0) || /%/.test(rootEl.getAttribute('width') + rootEl.getAttribute('height'))) throw fail('Este SVG não informa o tamanho (viewBox). Exporte de novo ou envie um PNG.');
      rootEl.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    }
    var out = new XMLSerializer().serializeToString(rootEl);
    if (/<script|\son\w+\s*=|javascript:|<foreignObject/i.test(out)) throw fail('Não conseguimos ler este SVG com segurança. Envie um PNG.');
    return { text: out, w: w, h: h, hasText: !!rootEl.getElementsByTagNameNS(SVG_NS, 'text').length };
  }

  function svgToCanvas(clean) {
    var max = 1600, s = max / Math.max(clean.w, clean.h), W = Math.max(1, Math.round(clean.w * s)), H = Math.max(1, Math.round(clean.h * s));
    var sized = clean.text.replace(/^<svg\b([^>]*)>/, function (m0, attrs) {
      attrs = attrs.replace(/\s(width|height|preserveAspectRatio)\s*=\s*("[^"]*"|'[^']*')/g, '');
      return '<svg' + attrs + ' width="' + W + '" height="' + H + '">';
    });
    return new Promise(function (ok, no) {
      var im = new Image();
      im.onload = function () { var c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(im, 0, 0, W, H); ok(c); };
      im.onerror = function () { no(fail('Não conseguimos desenhar este SVG. Envie um PNG.')); };
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sized);
    });
  }
  function rasterToCanvas(file) {
    var draw = function (src, w, h) {
      if (w < 16 || h < 16) throw fail('A imagem é pequena demais. Envie o logo com pelo menos 200 px.');
      var s = Math.min(1, 2000 / Math.max(w, h)), c = document.createElement('canvas');
      c.width = Math.round(w * s); c.height = Math.round(h * s);
      var g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, c.width, c.height);
      return { canvas: c, w0: w, h0: h };
    };
    if (window.createImageBitmap) return createImageBitmap(file).then(function (b) { return draw(b, b.width, b.height); }, function () { throw fail('Não conseguimos abrir esta imagem. Confira se o arquivo não está corrompido.'); });
    return new Promise(function (ok, no) {
      var fr = new FileReader();
      fr.onload = function () { var im = new Image(); im.onload = function () { try { ok(draw(im, im.naturalWidth, im.naturalHeight)); } catch (e) { no(e); } }; im.onerror = function () { no(fail('Não conseguimos abrir esta imagem.')); }; im.src = fr.result; };
      fr.onerror = function () { no(fail('Não conseguimos ler o arquivo.')); };
      fr.readAsDataURL(file);
    });
  }

  // Fundo: detecta fundo liso na borda (JPG ou PNG sem transparência) e o torna transparente.
  function analyzeBackground(d, w, h) {
    var px = [], i, x, y, transparent = 0;
    var take = function (x2, y2) { var o = (y2 * w + x2) * 4; px.push([d[o], d[o + 1], d[o + 2], d[o + 3]]); if (d[o + 3] < 200) transparent++; };
    for (x = 0; x < w; x += Math.max(1, w >> 8)) { take(x, 0); take(x, h - 1); }
    for (y = 0; y < h; y += Math.max(1, h >> 8)) { take(0, y); take(w - 1, y); }
    if (transparent / px.length > 0.15) return null;
    var med = [0, 1, 2].map(function (c) { var v = px.map(function (p) { return p[c]; }).sort(function (a, b) { return a - b; }); return v[v.length >> 1]; });
    var near = px.filter(function (p) { return Math.hypot(p[0] - med[0], p[1] - med[1], p[2] - med[2]) < 30; }).length;
    if (near / px.length < 0.8) return null;
    var lum = (med[0] * 0.2126 + med[1] * 0.7152 + med[2] * 0.0722) / 255;
    return { rgb: med, auto: lum > 0.82 || lum < 0.1 };
  }
  function removeBackground(d, bg) {
    for (var i = 0; i < d.length; i += 4) {
      var dd = Math.hypot(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]), a = smooth(18, 60, dd) * d[i + 3] / 255;
      if (a > 0.003 && a < 0.999) for (var j = 0; j < 3; j++) d[i + j] = clamp((d[i + j] - bg[j] * (1 - a)) / a, 0, 255);
      d[i + 3] = Math.round(a * 255);
    }
  }
  function finishLogo(srcCanvas, removeBg, bgInfo) {
    var w = srcCanvas.width, h = srcCanvas.height, g = srcCanvas.getContext('2d', { willReadFrequently: true });
    var img = g.getImageData(0, 0, w, h), d = img.data, i;
    if (removeBg && bgInfo) removeBackground(d, bgInfo.rgb);
    var x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) throw fail('Não encontramos o desenho do logo: a imagem parece vazia ou só tem fundo.');
    var cw = x1 - x0 + 1, ch = y1 - y0 + 1, s = Math.min(1, 1400 / Math.max(cw, ch));
    var tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h; tmp.getContext('2d').putImageData(img, 0, 0);
    var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(cw * s)); c.height = Math.max(1, Math.round(ch * s));
    var cg = c.getContext('2d', { willReadFrequently: true }); cg.imageSmoothingQuality = 'high';
    cg.drawImage(tmp, x0, y0, cw, ch, 0, 0, c.width, c.height);
    var cd = cg.getImageData(0, 0, c.width, c.height), dd = cd.data, n = c.width * c.height;
    // cor média e máscara de tinta (partes quase brancas de um logo colorido não levam tinta numa aplicação de um tom)
    var sa = 0, sr = 0, sg = 0, sb = 0, ink = new Float32Array(n), sink = 0;
    for (i = 0; i < n; i++) {
      var a = dd[4 * i + 3] / 255, r = dd[4 * i] / 255, gg = dd[4 * i + 1] / 255, b = dd[4 * i + 2] / 255;
      sa += a; sr += r * a; sg += gg * a; sb += b * a;
      ink[i] = a * smooth(0.06, 0.22, 1 - Math.min(r, gg, b)); sink += ink[i];
    }
    var light = sink < 0.25 * sa, samples = [], step = Math.max(1, Math.floor(n / 4000));
    for (i = 0; i < n; i += step) if (dd[4 * i + 3] > 128) samples.push([dd[4 * i] / 255, dd[4 * i + 1] / 255, dd[4 * i + 2] / 255, dd[4 * i + 3] / 255]);
    var mono = document.createElement('canvas'); mono.width = c.width; mono.height = c.height;
    var mg = mono.getContext('2d'), md = mg.createImageData(c.width, c.height);
    for (i = 0; i < n; i++) { md.data[4 * i] = md.data[4 * i + 1] = md.data[4 * i + 2] = 0; md.data[4 * i + 3] = Math.round((light ? dd[4 * i + 3] / 255 : ink[i]) * 255); }
    mg.putImageData(md, 0, 0);
    return { canvas: c, monoCanvas: mono, w: c.width, h: c.height, aspect: c.width / c.height, mean: sa ? [sr / sa, sg / sa, sb / sa] : [0, 0, 0], samples: samples, light: light, tex: {} };
  }

  function readLogo(file) {
    if (!file) return Promise.reject(fail('Escolha um arquivo.'));
    if (file.size > MAX_BYTES) return Promise.reject(fail('O arquivo tem ' + (file.size / 1048576).toFixed(1).replace('.', ',') + ' MB. O limite é 5 MB: envie uma versão menor.'));
    if (file.size < 40) return Promise.reject(fail('O arquivo está vazio ou incompleto.'));
    return file.slice(0, 1024).arrayBuffer().then(function (buf) {
      var kind = sniff(new Uint8Array(buf));
      if (kind === 'maybe-svg' && /\.svg$/i.test(file.name)) kind = 'svg';
      if (kind !== 'png' && kind !== 'jpg' && kind !== 'svg') throw fail('Formato não aceito. Envie o logo em SVG, PNG ou JPG.');
      if (kind === 'svg') {
        return file.text().then(function (text) {
          var clean = sanitizeSvg(text);
          return svgToCanvas(clean).then(function (c) {
            return { kind: 'svg', source: c, svg: clean, upload: new File([clean.text], safeName(file.name, 'svg'), { type: 'image/svg+xml' }), w0: clean.w, h0: clean.h, hasText: clean.hasText };
          });
        });
      }
      return rasterToCanvas(file).then(function (r) { return { kind: kind, source: r.canvas, upload: file, w0: r.w0, h0: r.h0 }; });
    }).then(function (info) {
      var d = info.source.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, info.source.width, info.source.height).data;
      info.bg = analyzeBackground(d, info.source.width, info.source.height);
      info.removeBg = !!(info.bg && info.bg.auto);
      info.name = file.name;
      info.logo = finishLogo(cloneCanvas(info.source), info.removeBg, info.bg);
      info.lowRes = info.kind !== 'svg' && Math.max(info.w0, info.h0) < 400;
      return info;
    });
  }
  function cloneCanvas(c) { var o = document.createElement('canvas'); o.width = c.width; o.height = c.height; o.getContext('2d').drawImage(c, 0, 0); return o; }
  function safeName(name, ext) {
    var base = String(name || 'logo').replace(/\.[^.]+$/, '').normalize('NFKD').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'logo';
    return base + '.' + ext;
  }

  /* ================================================================ UI */
  var $ = function (id) { return document.getElementById(id); };
  var state = { info: null, prod: null, color: null, mode: 'auto', scale: 1, step: 1, rendered: false, busy: false };
  var steps = [null, $('sim-step-1'), $('sim-step-2'), $('sim-step-3')];
  var statusEl = $('sim-status');

  function say(msg) { if (statusEl) statusEl.textContent = msg; }
  function scrollTo(el) { el.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' }); }
  function setStep(n, focus) {
    state.step = n;
    for (var i = 1; i <= 3; i++) {
      var s = steps[i], st = i < n ? 'done' : i === n ? 'current' : 'locked';
      if (i === 2 && n === 3) st = 'done';
      s.setAttribute('data-state', st);
      s.querySelector('.sim-step-body').hidden = st !== 'current' && !(i === 3 && n === 3);
      var sum = s.querySelector('.sim-step-summary'); if (sum) sum.hidden = st !== 'done';
      var lock = s.querySelector('.sim-step-locked'); if (lock) lock.hidden = st !== 'locked';
    }
    document.querySelectorAll('.sim-progress li').forEach(function (li) {
      var k = +li.getAttribute('data-step');
      if (k === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      li.classList.toggle('is-done', k < n);
    });
    if (focus) { var hd = steps[n].querySelector('h2'); scrollTo(steps[n]); hd.focus({ preventScroll: true }); }
  }

  // ---------- passo 1: logo
  var fileInput = $('sim-file'), fileErr = $('sim-file-error'), logoBox = $('sim-logo'), next1 = $('sim-next-1');
  function showLogoError(msg) {
    fileErr.textContent = msg;
    fileInput.setAttribute('aria-invalid', 'true');
    track('sim_logo_error', { reason: msg.slice(0, 60) });
  }
  function drawLogoPreview() {
    var c = $('sim-logo-canvas'), lg = state.info.logo, s = Math.min(1, 560 / lg.w, 240 / lg.h);
    c.width = Math.max(1, Math.round(lg.w * s)); c.height = Math.max(1, Math.round(lg.h * s));
    var g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.imageSmoothingQuality = 'high'; g.drawImage(lg.canvas, 0, 0, c.width, c.height);
    c.setAttribute('aria-label', 'Seu logo: ' + state.info.name);
  }
  function logoNotes() {
    var info = state.info, notes = [];
    if (info.bg && info.removeBg) notes.push('Removemos o fundo liso da imagem para aplicar só o desenho do logo.');
    if (info.lowRes) notes.push('A imagem tem pouca resolução: a prévia funciona, mas para a produção vamos pedir o arquivo original.');
    if (info.hasText) notes.push('Este SVG tem textos editáveis. Se a fonte não aparecer certa, exporte o logo com os textos em curvas.');
    var ul = $('sim-logo-notes'); ul.textContent = '';
    notes.forEach(function (t) { var li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
    var bgWrap = $('sim-bg-wrap');
    bgWrap.hidden = !info.bg;
    $('sim-bg').checked = !!info.removeBg;
  }
  function acceptFile(file) {
    fileErr.textContent = ''; fileInput.removeAttribute('aria-invalid');
    say('Lendo o logo…');
    readLogo(file).then(function (info) {
      state.info = info; state.rendered = false;
      $('sim-logo-name').textContent = info.name;
      $('sim-sum-logo').textContent = info.name;
      drawLogoPreview(); logoNotes();
      logoBox.hidden = false; next1.disabled = false;
      say('Logo carregado: ' + info.name + '.');
      track('sim_logo_ok', { kind: info.kind });
      if (state.step === 3) produce(false);
    }).catch(function (e) {
      say('');
      showLogoError(e && e.user ? e.message : 'Não conseguimos ler este arquivo. Envie o logo em SVG, PNG ou JPG.');
    });
  }
  fileInput.addEventListener('change', function () { if (fileInput.files[0]) acceptFile(fileInput.files[0]); fileInput.value = ''; });
  var drop = $('sim-drop');
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('is-over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('is-over'); }); });
  drop.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files[0]; if (f) acceptFile(f); });
  $('sim-bg').addEventListener('change', function () {
    var info = state.info; if (!info) return;
    info.removeBg = this.checked;
    try { info.logo = finishLogo(cloneCanvas(info.source), info.removeBg, info.bg); } catch (e) { showLogoError(e.message); return; }
    drawLogoPreview(); logoNotes(); state.rendered = false;
    if (state.step === 3) produce(false);
  });
  next1.addEventListener('click', function () { if (state.info) setStep(2, true); });

  // ---------- passo 2: peça e cor
  var prodInputs = document.querySelectorAll('input[name="sim-produto"]'), colorBox = $('sim-colors'), produceBtn = $('sim-produce');
  function colorName(prod, slug) { for (var i = 0; i < prod.cores.length; i++) if (prod.cores[i].s === slug) return prod.cores[i].n; return ''; }
  function thumbUrl(prod, slug) { return baseUrl(prod, slug, 't'); }
  function renderColors(groupEl, name, prod, current) {
    groupEl.textContent = '';
    prod.cores.forEach(function (c) {
      var lab = document.createElement('label'); lab.className = 'sim-color';
      var inp = document.createElement('input'); inp.type = 'radio'; inp.name = name; inp.value = c.s; inp.checked = c.s === current;
      var sw = document.createElement('span'); sw.className = 'sim-swatch'; sw.style.setProperty('--c', c.h); sw.setAttribute('aria-hidden', 'true');
      var tx = document.createElement('span'); tx.textContent = c.n;
      lab.appendChild(inp); lab.appendChild(sw); lab.appendChild(tx); groupEl.appendChild(lab);
    });
  }
  function selectProduct(slug, color, silent) {
    var prod = PROD[slug]; if (!prod) return;
    state.prod = prod;
    state.color = color && prod.cores.some(function (c) { return c.s === color; }) ? color : prod.cores[0].s;
    prodInputs.forEach(function (i) { i.checked = i.value === slug; });
    renderColors(colorBox, 'sim-cor', prod, state.color);
    renderColors($('sim-colors-3'), 'sim-cor-3', prod, state.color);
    $('sim-color-field').hidden = false;
    $('sim-tech').textContent = 'Técnica de referência: ' + prod.tecnicas.join(' ou ').toLowerCase() + '. A técnica final é confirmada na proposta.';
    syncColor(silent);
    produceBtn.disabled = false;
  }
  function syncColor(silent) {
    var prod = state.prod, cn = colorName(prod, state.color);
    var t = document.querySelector('.sim-prod input[value="' + prod.slug + '"]');
    if (t) { var im = t.parentNode.querySelector('img'); if (im) im.src = thumbUrl(prod, state.color); }
    $('sim-sum-prod').textContent = prod.nome + ' · ' + cn;
    document.querySelectorAll('input[name="sim-cor"], input[name="sim-cor-3"]').forEach(function (i) { i.checked = i.value === state.color; });
    var hasColorFx = prod.areas.some(function (a) { return FULLCOLOR[(a.v && a.v[state.color] && a.v[state.color].fx) || a.fx]; });
    $('sim-mode-field').hidden = !hasColorFx;
    loadImage(baseUrl(prod, state.color, 'p')).catch(function () {});
    if (!silent && state.step === 3) produce(false);
  }
  prodInputs.forEach(function (inp) { inp.addEventListener('change', function () { selectProduct(inp.value, null); }); });
  root.addEventListener('change', function (e) {
    if (e.target.name === 'sim-cor' || e.target.name === 'sim-cor-3') { state.color = e.target.value; syncColor(); track('sim_color', { item: state.prod.slug, color: state.color }); }
    if (e.target.name === 'sim-modo') { state.mode = e.target.value; produce(false); }
  });
  var sizeInput = $('sim-size'), sizeOut = $('sim-size-out'), sizeTimer;
  sizeInput.addEventListener('input', function () {
    state.scale = +sizeInput.value / 100; sizeOut.textContent = sizeInput.value + '%';
    clearTimeout(sizeTimer); sizeTimer = setTimeout(function () { produce(false); }, 120);
  });

  // ---------- passo 3: produzir
  var canvas = $('sim-canvas'), renderSeq = 0;
  function describe() {
    return 'Prévia: ' + state.prod.nome + ' na cor ' + colorName(state.prod, state.color).toLowerCase() + ' com o seu logo aplicado (' +
      state.prod.tecnicas.join(' ou ').toLowerCase() + '). Mockup ilustrativo em baixa resolução, com marca-d’água.';
  }
  function produce(move) {
    if (!state.info || !state.prod) return Promise.resolve();
    var seq = ++renderSeq;
    say('Produzindo a prévia…');
    root.setAttribute('aria-busy', 'true');
    return compose(state.prod, state.color, state.info.logo, { size: 'p', watermark: true, mode: state.mode, scale: state.scale }).then(function (r) {
      if (seq !== renderSeq) return;
      canvas.width = r.canvas.width; canvas.height = r.canvas.height;
      canvas.getContext('2d').drawImage(r.canvas, 0, 0);
      canvas.setAttribute('aria-label', describe());
      $('sim-figure').classList.add('is-ready');
      if (state.mode === 'auto' && r.modes.length) {
        var auto = r.modes[0];
        document.querySelectorAll('input[name="sim-modo"]').forEach(function (i) { i.checked = i.value === auto; });
      }
      state.rendered = true;
      root.removeAttribute('aria-busy');
      say('Prévia pronta: ' + state.prod.nome + ', ' + colorName(state.prod, state.color) + '.');
      if (move) { setStep(3, true); track('sim_produce', { item: state.prod.slug, color: state.color }); }
    }).catch(function () {
      root.removeAttribute('aria-busy');
      say('Não conseguimos produzir a prévia agora. Tente de novo em instantes.');
    });
  }
  produceBtn.addEventListener('click', function () { produce(true); });
  root.addEventListener('click', function (e) {
    var ed = e.target.closest('[data-sim-edit]');
    if (ed) setStep(+ed.getAttribute('data-sim-edit'), true);
  });

  // ---------- envio (lead)
  var form = $('sim-form'), submitBtn = $('sim-submit'), formStatus = $('sim-form-status'), done = $('sim-done');
  function setError(id, msg) {
    var el = $(id), er = $(id + '-error');
    if (el) el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (er) er.textContent = msg || '';
    return !msg;
  }
  function validate() {
    var first = null, chk = function (id, msg) { if (!setError(id, msg) && !first) first = id; };
    chk('sim-nome', form.nome.value.trim().length < 2 ? 'Informe seu nome.' : '');
    chk('sim-email', !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.value.trim()) ? 'Informe um e-mail válido: é para lá que enviamos o mockup.' : '');
    var wa = form.whatsapp.value.replace(/\D/g, '');
    chk('sim-whats', wa && wa.length < 10 ? 'Confira o WhatsApp: use DDD e número.' : '');
    chk('sim-consent', !form.consentimento.checked ? 'Para enviar o mockup, precisamos do seu consentimento.' : '');
    if (first) { var f = $(first); f.scrollIntoView({ block: 'center' }); f.focus({ preventScroll: true }); }
    return !first;
  }
  form.addEventListener('input', function (e) { if (e.target.getAttribute('aria-invalid') === 'true') setError(e.target.id, ''); });
  function addToSelection() {
    try {
      var sel = JSON.parse(localStorage.getItem('tama-selecao') || '[]');
      if (!Array.isArray(sel)) sel = [];
      var cn = colorName(state.prod, state.color);
      sel = sel.filter(function (x) { return (x && (x.s || x)) !== state.prod.slug; });
      sel.push({ s: state.prod.slug, c: cn });
      localStorage.setItem('tama-selecao', JSON.stringify(sel));
    } catch (e) { /* armazenamento indisponível */ }
  }
  function showDone(kind) {
    form.hidden = true;
    done.textContent = '';
    done.appendChild($('sim-tpl-' + kind).content.cloneNode(true));
    done.hidden = false;
    done.className = 'result' + (kind === 'ok' ? ' ok' : '');
    var em = done.querySelector('[data-email]'); if (em) em.textContent = form.email.value.trim();
    var h = done.querySelector('h3'); h.setAttribute('tabindex', '-1');
    done.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    h.focus({ preventScroll: true });
  }
  done.addEventListener('click', function (e) {
    if (e.target.closest('[data-sim-proposta]')) {
      addToSelection();
      var cat = state.prod.categoria, tipo = cat === 'vestuario' ? 'confeccoes' : cat === 'kits' ? 'kits' : cat === 'branding' ? 'branding' : 'brindes';
      e.preventDefault();
      location.href = '/solicitar-proposta/?tipo=' + tipo;
    }
    if (e.target.closest('[data-sim-again]')) { done.hidden = true; form.hidden = false; setStep(2, true); }
    if (e.target.closest('[data-sim-retry]')) { done.hidden = true; form.hidden = false; submitBtn.focus(); }
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!state.rendered) { formStatus.textContent = 'Produza a prévia antes de enviar.'; return; }
    if (!validate()) { formStatus.textContent = 'Revise os campos destacados.'; return; }
    submitBtn.disabled = true;
    formStatus.textContent = 'Preparando o mockup em alta…';
    var prod = state.prod, cn = colorName(prod, state.color);
    compose(prod, state.color, state.info.logo, { size: 'f', watermark: false, mode: state.mode, scale: state.scale }).then(function (r) {
      return new Promise(function (ok, no) { r.canvas.toBlob(function (b) { if (b) ok({ blob: b, modes: r.modes }); else no(new Error('blob')); }, 'image/jpeg', 0.9); });
    }).then(function (res) {
      formStatus.textContent = 'Enviando…';
      var fd = new FormData(form);
      fd.set('consentimento', form.consentimento.checked ? 'sim' : '');
      fd.append('form-name', 'simulador');
      fd.append('etapa', 'mockup');
      fd.append('produto', prod.slug);
      fd.append('produto_nome', prod.nome);
      fd.append('cor', cn);
      fd.append('cor_hex', (prod.cores.filter(function (c) { return c.s === state.color; })[0] || {}).h || '');
      fd.append('tecnica', prod.tecnicas.join(', '));
      fd.append('material', (prod.materiais || []).join(', '));
      fd.append('aplicacao', res.modes[0] || 'tom');
      fd.append('tamanho', String(Math.round(state.scale * 100)));
      fd.append('pagina', location.pathname);
      fd.append('logo', state.info.upload, state.info.upload.name || 'logo');
      fd.append('mockup', new File([res.blob], 'mockup-' + prod.slug + '-' + state.color + '.jpg', { type: 'image/jpeg' }));
      var ctl = 'AbortController' in window ? new AbortController() : null, timer = ctl ? setTimeout(function () { ctl.abort(); }, 45000) : null;
      return fetch(form.getAttribute('data-endpoint'), { method: 'POST', body: fd, signal: ctl ? ctl.signal : undefined }).then(function (rsp) {
        if (timer) clearTimeout(timer);
        if (!rsp.ok) throw new Error('HTTP ' + rsp.status);
      });
    }).then(function () {
      formStatus.textContent = '';
      showDone('ok');
      try { localStorage.setItem('tama-sim-usado', String(Date.now())); } catch (er) { /* ok */ }
      track('sim_submit_success', { item: prod.slug, color: state.color });
    }).catch(function (err) {
      formStatus.textContent = '';
      showDone('error');
      track('sim_submit_error', { reason: String((err && err.message) || err).slice(0, 80) });
    }).then(function () { submitBtn.disabled = false; });
  });

  // ---------- início: peça vinda do card (?produto=slug&cor=Nome)
  try { sessionStorage.setItem('tama-exit-sessao', '1'); } catch (e) { /* ok */ }   // quem já está aqui não precisa do convite de saída
  var qp = new URLSearchParams(location.search), pre = qp.get('produto'), preColor = qp.get('cor');
  if (pre && PROD[pre]) {
    var pc = null;
    if (preColor) PROD[pre].cores.forEach(function (c) { if (c.s === preColor || c.n.toLowerCase() === preColor.toLowerCase()) pc = c.s; });
    selectProduct(pre, pc, true);
    var banner = $('sim-pre');
    banner.textContent = 'Peça escolhida: ' + PROD[pre].nome + ' · ' + colorName(PROD[pre], state.color) + '. Envie o logo para ver a sua marca nela.';
    banner.hidden = false;
  }
  root.classList.add('is-ready');
  setStep(1, false);
  window.TamaSimulador = { compose: compose, sanitizeSvg: sanitizeSvg, state: state };
})();
