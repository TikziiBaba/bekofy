import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { composite, contrast, parseColor, withAlpha } from '../src/color.js';
import { generate } from '../src/generate.js';
import { loadSources, resolveTheme } from '../src/resolve.js';

const sources = loadSources();
const themes = { light: resolveTheme(sources, 'light'), dark: resolveTheme(sources, 'dark') };
const WHITE = parseColor('#FFFFFF');
const BLACK = parseColor('#000000');

/** Temanın gerekli kontrast çiftleri: [etiket, ön plan, zemin, en az oran]. */
function pairs(mode) {
  const t = (path) => themes[mode][path].value;
  const bg = {
    page: t('color.surface.page'),
    raised: t('color.surface.raised'),
    sunken: t('color.surface.sunken'),
    'cam bant / beyaz üstü': composite(t('color.glass.chrome.bg'), WHITE),
    'cam bant / siyah üstü': composite(t('color.glass.chrome.bg'), BLACK),
    'cam panel / sayfa üstü': composite(t('color.glass.panel.bg'), t('color.surface.page')),
    'satır hover': composite(t('color.state.hover'), t('color.surface.page')),
  };
  for (const n of [1, 2, 3]) {
    bg[`ortam ${n}`] = t(`color.ambient.${n}`);
    bg[`cam panel / ortam ${n}`] = composite(t('color.glass.panel.bg'), t(`color.ambient.${n}`));
  }
  const out = [];
  const add = (label, fg, back, min) => out.push([label, fg, back, min]);
  for (const [name, back] of Object.entries(bg)) {
    add(`text.primary / ${name}`, t('color.text.primary'), back, 4.5);
    add(`text.secondary / ${name}`, t('color.text.secondary'), back, 4.5);
  }
  for (const name of ['page', 'raised', 'sunken']) add(`text.tertiary / ${name}`, t('color.text.tertiary'), bg[name], 4.5);
  for (const name of ['page', 'raised', 'cam bant / beyaz üstü', 'cam bant / siyah üstü', 'ortam 1', 'ortam 2', 'ortam 3']) {
    add(`accent.text / ${name}`, t('color.accent.text'), bg[name], 4.5);
  }
  const { hover, pressed } = { hover: t('opacity.state.hover'), pressed: t('opacity.state.pressed') };
  for (const [fill, on] of [['color.accent.default', 'color.accent.on'], ['color.destructive.default', 'color.destructive.on']]) {
    for (const [state, a] of [['dinlenme', 0], ['hover', hover], ['basılı', pressed]]) {
      add(`${on} / ${fill} (${state})`, t(on), composite(withAlpha(t(on), a), t(fill)), 4.5);
    }
  }
  for (const kind of ['danger', 'warning', 'success', 'info']) {
    for (const back of [`color.feedback.${kind}.bg`, 'color.surface.page', 'color.surface.raised']) {
      add(`feedback.${kind}.text / ${back}`, t(`color.feedback.${kind}.text`), t(back), 4.5);
    }
  }
  add('text.inverse / surface.inverse (toast)', t('color.text.inverse'), t('color.surface.inverse'), 4.5);
  add('chip seçili: text.inverse / text.primary', t('color.text.inverse'), t('color.text.primary'), 4.5);
  for (const name of ['page', 'raised']) add(`border.strong / ${name}`, t('color.border.strong'), bg[name], 3);
  for (const name of ['page', 'raised', 'ortam 1', 'ortam 2', 'ortam 3']) add(`focus / ${name}`, t('color.focus'), bg[name], 3);
  add('slider dolgu / iz', t('color.text.primary'), composite(t('color.fill.muted'), bg.page), 3);
  return out;
}

test('açık ve koyu tema aynı semantik yolları tanımlar', () => {
  assert.deepEqual(Object.keys(sources.themes.light).sort(), Object.keys(sources.themes.dark).sort());
});

for (const mode of ['light', 'dark']) {
  test(`${mode}: tüm gerekli kontrast çiftleri geçer`, () => {
    const failures = pairs(mode)
      .map(([label, fg, back, min]) => [label, contrast(fg, back), min])
      .filter(([, ratio, min]) => ratio < min)
      .map(([label, ratio, min]) => `${label}: ${ratio.toFixed(2)} < ${min}`);
    assert.deepEqual(failures, []);
  });
}

test('dist dosyaları kaynak JSON ile güncel', () => {
  const generated = generate();
  for (const [key, file] of [['css', 'tokens.css'], ['js', 'tokens.js'], ['dts', 'tokens.d.ts']]) {
    const onDisk = readFileSync(new URL(`../dist/${file}`, import.meta.url), 'utf8');
    assert.equal(onDisk, generated[key], `dist/${file} eski; npm run build -w @bekofy/tokens çalıştır`);
  }
});

test('tokens.css içindeki her var() başvurusu tanımlı', () => {
  const css = readFileSync(new URL('../dist/tokens.css', import.meta.url), 'utf8');
  const defined = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  const missing = [...css.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]).filter((v) => !defined.has(v));
  assert.deepEqual([...new Set(missing)], []);
});
