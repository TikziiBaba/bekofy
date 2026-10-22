// Çalan şarkının kapağından tema türetir: vurgu dolgusu, vurgu metni, odak halkası ve ortam zemini.
// Her ton ve doygunlukta kontrast çiftleri garanti edilir: değerler hedefe ulaşana kadar açıklık kaydırılır.

import { dark, light } from '../dist/tokens.js';
import { composite, contrast, formatColor, fromOklch, parseColor, toOklch, withAlpha } from './color.js';
import { cssVarName } from './names.js';

export const TEXT_MIN = 4.5;
export const UI_MIN = 3;

const BRAND = toOklch(parseColor(light.color.accent.default));
const NEUTRAL_CHROMA = 0.04;
const STEP = 0.005;
const WHITE = parseColor('#FFFFFF');
const BLACK = parseColor('#000000');
const INK = parseColor(light.color.text.primary);
const AMBIENT = {
  dark: [[0.27, 0.07, 0], [0.2, 0.05, 15], [0.165, 0.03, -15]],
  light: [[0.93, 0.045, 0], [0.9, 0.035, 15], [0.965, 0.02, -15]],
};

/** 8 bit'e yuvarlanmış hali: kontrol, ekrana çıkacak gerçek değer üzerinde yapılır. */
const quantize = (c) => parseColor(formatColor(c));

/** Vurgu metninin üstünde durabileceği en kötü zeminler. */
function worstBackdrops(theme) {
  const chrome = theme.color.glass.chrome.bg;
  return [
    parseColor(theme.color.surface.page),
    parseColor(theme.color.surface.raised),
    composite(chrome, WHITE),
    composite(chrome, BLACK),
  ];
}

/** Dolgu üstündeki koyu yazının dinlenme, hover ve basılı durumlarındaki en düşük kontrastı. */
function fillContrast(fill, theme) {
  const { hover, pressed } = theme.opacity.state;
  return Math.min(
    contrast(INK, fill),
    contrast(INK, composite(withAlpha(INK, hover), fill)),
    contrast(INK, composite(withAlpha(INK, pressed), fill)),
  );
}

/** l açıklığından başlayıp dir yönünde ilerleyerek ok(c) sağlanana kadar renk arar. */
function search(l, chroma, hue, dir, ok) {
  let color = quantize(fromOklch(l, chroma, hue));
  while (!ok(color) && l > 0 && l < 1) {
    l += dir * STEP;
    color = quantize(fromOklch(l, chroma, hue));
  }
  return color;
}

/**
 * Kapaktan türetilen tema. seed: kapağın baskın rengi (hex). mode: 'light' | 'dark'.
 * Dönen cssVars doğrudan document.documentElement.style üzerine yazılabilir.
 */
export function deriveDynamicTheme(seed, mode = 'dark') {
  const isDark = mode === 'dark';
  const theme = isDark ? dark : light;
  const src = toOklch(parseColor(seed));
  const neutral = src.c < NEUTRAL_CHROMA;
  const hue = neutral ? BRAND.h : src.h;
  const chroma = neutral ? BRAND.c : Math.min(Math.max(src.c, 0.09), 0.16);
  const textPrimary = parseColor(theme.color.text.primary);
  const textSecondary = parseColor(theme.color.text.secondary);
  const away = isDark ? -1 : 1;

  const ambient = AMBIENT[mode].map(([l, maxC, dh]) =>
    search(l, Math.min(src.c, maxC), hue + dh, away, (bg) =>
      contrast(textPrimary, bg) >= TEXT_MIN && contrast(textSecondary, bg) >= TEXT_MIN,
    ),
  );

  const fill = search(isDark ? 0.72 : 0.74, chroma, hue, 1, (c) => fillContrast(c, theme) >= TEXT_MIN);

  const backdrops = [...worstBackdrops(theme), ...ambient];
  const text = search(isDark ? 0.8 : 0.45, Math.min(chroma, 0.14), hue, -away, (c) =>
    backdrops.every((bg) => contrast(c, bg) >= TEXT_MIN),
  );

  const color = {
    accent: { default: formatColor(fill), on: formatColor(INK), text: formatColor(text) },
    focus: formatColor(text),
    ambient: { 1: formatColor(ambient[0]), 2: formatColor(ambient[1]), 3: formatColor(ambient[2]) },
  };
  const cssVars = {
    [cssVarName('color.accent.default')]: color.accent.default,
    [cssVarName('color.accent.on')]: color.accent.on,
    [cssVarName('color.accent.text')]: color.accent.text,
    [cssVarName('color.focus')]: color.focus,
    [cssVarName('color.ambient.1')]: color.ambient[1],
    [cssVarName('color.ambient.2')]: color.ambient[2],
    [cssVarName('color.ambient.3')]: color.ambient[3],
  };
  return { mode, seed, color, cssVars };
}

/**
 * Kapak piksellerinden (RGBA dizi, canvas getImageData çıktısı gibi) tohum rengi seçer.
 * Çok koyu/açık pikseller atlanır; tonlar 24 kovaya ayrılır, doygunluk ağırlıklı en kalabalık kova kazanır.
 */
export function seedFromPixels(rgba, step = 4) {
  const buckets = Array.from({ length: 24 }, () => ({ score: 0, r: 0, g: 0, b: 0, n: 0 }));
  let total = { r: 0, g: 0, b: 0, n: 0 };
  for (let i = 0; i < rgba.length; i += 4 * step) {
    if (rgba[i + 3] < 128) continue;
    const px = { r: rgba[i] / 255, g: rgba[i + 1] / 255, b: rgba[i + 2] / 255 };
    total = { r: total.r + px.r, g: total.g + px.g, b: total.b + px.b, n: total.n + 1 };
    const { l, c, h } = toOklch(px);
    if (l < 0.15 || l > 0.95 || c < 0.03) continue;
    const bucket = buckets[Math.floor(h / 15) % 24];
    bucket.score += c;
    bucket.r += px.r;
    bucket.g += px.g;
    bucket.b += px.b;
    bucket.n += 1;
  }
  const best = buckets.reduce((a, b) => (b.score > a.score ? b : a));
  const pick = best.n ? best : total;
  if (!pick.n) return light.color.accent.default;
  return formatColor({ r: pick.r / pick.n, g: pick.g / pick.n, b: pick.b / pick.n });
}
