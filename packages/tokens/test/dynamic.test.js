import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dark, light } from '../dist/tokens.js';
import { composite, contrast, formatColor, fromOklch, parseColor, toOklch, withAlpha } from '../src/color.js';
import { deriveDynamicTheme, seedFromPixels } from '../src/dynamic.js';

const WHITE = parseColor('#FFFFFF');
const BLACK = parseColor('#000000');

/** Türetilmiş temanın tüm çiftlerini denetler; geçmeyenleri döndürür. */
function audit(seed, mode) {
  const theme = mode === 'dark' ? dark : light;
  const { color } = deriveDynamicTheme(seed, mode);
  const { hover, pressed } = theme.opacity.state;
  const fails = [];
  const need = (label, fg, bg, min = 4.5) => {
    const ratio = contrast(fg, bg);
    if (ratio < min) fails.push(`${mode} ${seed} ${label}: ${ratio.toFixed(2)}`);
  };
  for (const a of [0, hover, pressed]) need(`accent.on/fill@${a}`, color.accent.on, composite(withAlpha(color.accent.on, a), color.accent.default));
  const ambients = [color.ambient[1], color.ambient[2], color.ambient[3]];
  const backdrops = [
    theme.color.surface.page,
    theme.color.surface.raised,
    composite(theme.color.glass.chrome.bg, WHITE),
    composite(theme.color.glass.chrome.bg, BLACK),
    ...ambients,
  ];
  backdrops.forEach((bg, i) => need(`accent.text/zemin${i}`, color.accent.text, bg));
  backdrops.forEach((bg, i) => need(`focus/zemin${i}`, color.focus, bg, 3));
  for (const amb of ambients) {
    const panel = composite(theme.color.glass.panel.bg, amb);
    for (const fg of [theme.color.text.primary, theme.color.text.secondary]) {
      need('metin/ortam', fg, amb);
      need('metin/cam panel', fg, panel);
    }
  }
  return fails;
}

test('dinamik tema her ton, doygunluk ve açıklıkta kontrastı korur (2.592 tohum)', () => {
  const fails = [];
  for (const mode of ['light', 'dark']) {
    for (let h = 0; h < 360; h += 5) {
      for (const c of [0, 0.02, 0.05, 0.1, 0.2, 0.3]) {
        for (const l of [0.35, 0.65, 0.9]) fails.push(...audit(formatColor(fromOklch(l, c, h)), mode));
      }
    }
  }
  assert.deepEqual(fails.slice(0, 10), [], `${fails.length} hata`);
});

test('uç tohumlar: siyah, beyaz, gri ve doygun RGB', () => {
  const seeds = ['#000000', '#FFFFFF', '#808080', '#FF0000', '#FFFF00', '#00FF00', '#0000FF', '#FF00FF'];
  const fails = seeds.flatMap((s) => [...audit(s, 'light'), ...audit(s, 'dark')]);
  assert.deepEqual(fails, []);
});

test('gri kapak marka tonuna döner, renkli kapak kendi tonunu korur', () => {
  const brandHue = toOklch(parseColor(light.color.accent.default)).h;
  const grey = toOklch(parseColor(deriveDynamicTheme('#7A7A7A', 'dark').color.accent.default));
  assert.ok(Math.abs(grey.h - brandHue) < 3, `gri kapak tonu ${grey.h}`);
  const red = toOklch(parseColor(deriveDynamicTheme('#D0312D', 'dark').color.accent.default));
  assert.ok(red.h < 40 || red.h > 340, `kırmızı kapak tonu ${red.h}`);
});

test('seedFromPixels: baskın renkli tonu seçer, boş görselde markaya döner', () => {
  const px = new Uint8ClampedArray(4 * 400);
  for (let i = 0; i < 400; i++) {
    const red = i < 300;
    px.set(red ? [200, 40, 40, 255] : [240, 240, 240, 255], i * 4);
  }
  const seed = toOklch(parseColor(seedFromPixels(px, 1)));
  assert.ok(seed.h < 40 || seed.h > 340, `seçilen ton ${seed.h}`);
  assert.equal(seedFromPixels(new Uint8ClampedArray(16), 1), light.color.accent.default);
});
