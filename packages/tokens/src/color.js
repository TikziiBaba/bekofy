// Renk matematiği: OKLCH <-> sRGB, hex, WCAG kontrastı ve alfa birleştirme.
// Renkler içeride { r, g, b, a } olarak tutulur; r/g/b gamma kodlu sRGB (0..1).

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const GAMUT_EPS = 1e-6;

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

function oklchToLinear({ l, c, h }) {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
}

function inGamut(rgb) {
  return rgb.every((x) => x >= -GAMUT_EPS && x <= 1 + GAMUT_EPS);
}

/** OKLCH -> sRGB. Gamut dışındaysa ton ve açıklık korunur, kroma düşürülür. */
export function fromOklch(l, c, h, a = 1) {
  const lch = { l: clamp01(l), c: Math.max(0, c), h: ((h % 360) + 360) % 360 };
  let lin = oklchToLinear(lch);
  if (!inGamut(lin)) {
    let lo = 0;
    let hi = lch.c;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear({ ...lch, c: mid }))) lo = mid;
      else hi = mid;
    }
    lin = oklchToLinear({ ...lch, c: lo });
  }
  const [r, g, b] = lin.map((x) => clamp01(linearToSrgb(clamp01(x))));
  return { r, g, b, a };
}

/** sRGB -> OKLCH ({ l, c, h }). */
export function toOklch({ r, g, b }) {
  const [lr, lg, lb] = [r, g, b].map(srgbToLinear);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.sqrt(A * A + B * B);
  const h = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}

/** "#RGB", "#RRGGBB" veya "#RRGGBBAA" -> renk. */
export function parseHex(hex) {
  let s = hex.replace('#', '');
  if (s.length === 3) s = [...s].map((ch) => ch + ch).join('');
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(s)) throw new Error(`Geçersiz hex renk: ${hex}`);
  const n = (i) => parseInt(s.slice(i, i + 2), 16) / 255;
  return { r: n(0), g: n(2), b: n(4), a: s.length === 8 ? n(6) : 1 };
}

/** "oklch(L C H)" veya "oklch(L C H / A)" -> renk. L 0..1 ya da yüzde olabilir. */
export function parseOklch(str) {
  const m = str.match(/^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+))?\s*\)$/);
  if (!m) throw new Error(`Geçersiz oklch renk: ${str}`);
  const l = m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  return fromOklch(l, parseFloat(m[2]), parseFloat(m[3]), m[4] === undefined ? 1 : parseFloat(m[4]));
}

export function parseColor(str) {
  return str.startsWith('#') ? parseHex(str) : parseOklch(str);
}

const to255 = (x) => Math.round(clamp01(x) * 255);

/** Opak renk -> "#RRGGBB"; saydam renk -> "rgba(r, g, b, a)" (CSS ve React Native ortak). */
export function formatColor({ r, g, b, a = 1 }) {
  if (a >= 1) return '#' + [r, g, b].map((x) => to255(x).toString(16).padStart(2, '0')).join('').toUpperCase();
  return `rgba(${to255(r)}, ${to255(g)}, ${to255(b)}, ${Math.round(a * 1000) / 1000})`;
}

/** Hex dizesi ya da renk nesnesi kabul eder. */
function asColor(x) {
  if (typeof x !== 'string') return x;
  if (x.startsWith('rgba(')) {
    const [r, g, b, a] = x.slice(5, -1).split(',').map((v) => parseFloat(v));
    return { r: r / 255, g: g / 255, b: b / 255, a };
  }
  return parseColor(x);
}

/** Saydam rengi altındaki opak rengin üzerine bindirir (tarayıcılar gibi sRGB uzayında). */
export function composite(top, bottom) {
  const t = asColor(top);
  const b = asColor(bottom);
  const a = t.a ?? 1;
  return { r: t.r * a + b.r * (1 - a), g: t.g * a + b.g * (1 - a), b: t.b * a + b.b * (1 - a), a: 1 };
}

export function luminance(color) {
  const { r, g, b } = asColor(color);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** WCAG 2.2 kontrast oranı. Saydam ön plan önce arka plana bindirilir. */
export function contrast(fg, bg) {
  const back = asColor(bg);
  const front = (asColor(fg).a ?? 1) < 1 ? composite(fg, back) : asColor(fg);
  const l1 = luminance(front);
  const l2 = luminance(back);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function withAlpha(color, alpha) {
  return { ...asColor(color), a: alpha };
}
