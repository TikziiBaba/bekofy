// Çalan şarkının kapağından ortam zemini türetir. Vurgu rengi markadır (nane yeşili) ve değişmez;
// kapak yalnızca arka plandaki ışığı renklendirir. Ortam renklerinin açıklığı, üstündeki metin
// ve vurgu metni hedef kontrasta ulaşana kadar kaydırılır.

import { dark, light } from '../dist/tokens.js';
import { composite, contrast, formatColor, fromOklch, parseColor, toOklch } from './color.js';
import { cssVarName } from './names.js';

export const TEXT_MIN = 4.5;
export const UI_MIN = 3;

const BRAND = toOklch(parseColor(dark.color.accent.default));
const NEUTRAL_CHROMA = 0.04;
const STEP = 0.005;
const AMBIENT = {
  dark: [[0.26, 0.07, 0], [0.19, 0.04, 15], [0.155, 0.02, -15]],
  light: [[0.93, 0.045, 0], [0.9, 0.035, 15], [0.965, 0.02, -15]],
};

/** 8 bit'e yuvarlanmış hali: kontrol, ekrana çıkacak gerçek değer üzerinde yapılır. */
const quantize = (c) => parseColor(formatColor(c));

/**
 * Kapaktan ortam zemini. seed: kapağın baskın rengi (hex). mode: 'light' | 'dark'.
 * Gri kapaklarda markanın yeşil ortamına döner. cssVars doğrudan document.documentElement.style'a yazılabilir.
 */
export function deriveAmbient(seed, mode = 'dark') {
  const theme = mode === 'dark' ? dark : light;
  const src = toOklch(parseColor(seed));
  const neutral = src.c < NEUTRAL_CHROMA;
  const hue = neutral ? BRAND.h : src.h;
  const away = mode === 'dark' ? -1 : 1;
  const fg = [theme.color.text.primary, theme.color.text.secondary, theme.color.accent.text].map(parseColor);
  const readable = (bg) =>
    fg.every((c) => contrast(c, bg) >= TEXT_MIN && contrast(c, composite(theme.color.glass.panel.bg, bg)) >= TEXT_MIN);

  const ambient = AMBIENT[mode].map(([l, maxC, dh]) => {
    const chroma = neutral ? maxC : Math.min(src.c, maxC);
    let color = quantize(fromOklch(l, chroma, hue + dh));
    while (!readable(color) && l > 0 && l < 1) {
      l += away * STEP;
      color = quantize(fromOklch(l, chroma, hue + dh));
    }
    return formatColor(color);
  });

  return {
    mode,
    seed,
    color: { ambient: { 1: ambient[0], 2: ambient[1], 3: ambient[2] } },
    cssVars: {
      [cssVarName('color.ambient.1')]: ambient[0],
      [cssVarName('color.ambient.2')]: ambient[1],
      [cssVarName('color.ambient.3')]: ambient[2],
    },
  };
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
  if (!pick.n) return dark.color.accent.default;
  return formatColor({ r: pick.r / pick.n, g: pick.g / pick.n, b: pick.b / pick.n });
}
