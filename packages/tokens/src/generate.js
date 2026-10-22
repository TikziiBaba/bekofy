// Çözülmüş token'lardan dist çıktılarını üretir: tokens.css (web/masaüstü), tokens.js + tokens.d.ts (React Native ve JS).

import { formatColor } from './color.js';
import { cssVarName } from './names.js';
import { loadSources, resolveTheme } from './resolve.js';

const HEADER = 'Otomatik üretildi: packages/tokens/src/tokens/*.json -> npm run build -w @bekofy/tokens. Elle düzenleme.';
const ALIAS = /^\{([^}]+)\}$/;
const GENERIC_FONTS = new Set(['system-ui', 'sans-serif', 'serif', 'monospace', 'ui-monospace', '-apple-system']);

const px = (v) => (typeof v === 'string' && v.endsWith('px') ? parseFloat(v) : v);
const ms = (v) => (typeof v === 'string' && v.endsWith('ms') ? parseFloat(v) : v);
const fontStack = (families) => families.map((f) => (GENERIC_FONTS.has(f) || !f.includes(' ') ? f : `"${f}"`)).join(', ');

function cssShadow(token, emitted) {
  return token.value
    .map((s, i) => {
      const rawColor = token.raw[i].color;
      const alias = typeof rawColor === 'string' && rawColor.match(ALIAS);
      const color = alias && emitted.has(alias[1]) ? `var(${cssVarName(alias[1])})` : formatColor(s.color);
      return `${s.inset ? 'inset ' : ''}${s.offsetX} ${s.offsetY} ${s.blur} ${s.spread} ${color}`;
    })
    .join(', ');
}

/** Bir token'ı CSS bildirimlerine çevirir. useVars: başka bir yayınlanmış token'a başvuru var() olarak kalsın. */
function cssDeclarations(path, token, emitted, useVars) {
  const name = cssVarName(path);
  const alias = useVars && typeof token.raw === 'string' && token.raw.match(ALIAS);
  if (alias && emitted.has(alias[1])) return [[name, `var(${cssVarName(alias[1])})`]];
  const v = token.value;
  switch (token.type) {
    case 'color':
      return [[name, formatColor(v)]];
    case 'fontFamily':
      return [[name, fontStack(v)]];
    case 'cubicBezier':
      return [[name, `cubic-bezier(${v.join(', ')})`]];
    case 'shadow':
      return [[name, cssShadow(token, emitted)]];
    case 'typography':
      return [
        [`${name}-font`, `${v.fontWeight} ${v.fontSize}/${v.lineHeight} ${fontStack(v.fontFamily)}`],
        [`${name}-tracking`, v.letterSpacing],
      ];
    default:
      return [[name, String(v)]];
  }
}

/** React Native dostu değer: px -> sayı, ms -> sayı, renk -> dize, tipografi -> mutlak satır yüksekliği. */
function jsValue(token) {
  const v = token.value;
  switch (token.type) {
    case 'color':
      return formatColor(v);
    case 'dimension':
      return px(v);
    case 'duration':
      return ms(v);
    case 'shadow':
      return v.map((s) => ({
        offsetX: px(s.offsetX),
        offsetY: px(s.offsetY),
        blur: px(s.blur),
        spread: px(s.spread),
        color: formatColor(s.color),
        inset: Boolean(s.inset),
      }));
    case 'typography': {
      const size = px(v.fontSize);
      const tracking = String(v.letterSpacing).endsWith('em') ? parseFloat(v.letterSpacing) * size : px(v.letterSpacing);
      return {
        fontFamily: v.fontFamily,
        fontSize: size,
        fontWeight: v.fontWeight,
        lineHeight: Math.round(size * v.lineHeight * 100) / 100,
        letterSpacing: Math.round(tracking * 100) / 100,
      };
    }
    default:
      return v;
  }
}

function setPath(obj, path, value) {
  const keys = path.replace(/^component\./, 'component.').split('.');
  let node = obj;
  keys.slice(0, -1).forEach((k) => (node = node[k] ??= {}));
  node[keys.at(-1)] = value;
}

function tsType(value, indent) {
  if (Array.isArray(value)) return `readonly ${value.length && typeof value[0] === 'object' ? tsType(value[0], indent) : typeof value[0]}[]`;
  if (value && typeof value === 'object') {
    const pad = '  '.repeat(indent + 1);
    const entries = Object.entries(value).map(([k, v]) => `${pad}readonly ${/^[a-zA-Z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${tsType(v, indent + 1)};`);
    return `{\n${entries.join('\n')}\n${'  '.repeat(indent)}}`;
  }
  return typeof value;
}

/** dist dosyalarının içeriğini döndürür: { css, js, dts }. */
export function generate() {
  const sources = loadSources();
  const themes = { light: resolveTheme(sources, 'light'), dark: resolveTheme(sources, 'dark') };
  const sourceOrder = Object.keys({ ...sources.base, ...sources.themes.light });
  const emitted = new Set(sourceOrder.filter((p) => !themes.light[p].primitive));
  const block = (selector, lines) => `${selector} {\n${lines.map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}\n`;

  const baseLines = [];
  const themeLines = { light: [], dark: [] };
  for (const path of emitted) {
    const token = themes.light[path];
    if (token.themed) {
      for (const t of ['light', 'dark']) themeLines[t].push(...cssDeclarations(path, themes[t][path], emitted, false));
    } else {
      baseLines.push(...cssDeclarations(path, token, emitted, true));
    }
  }

  const glassFallback = [
    ['--color-glass-chrome-bg', 'var(--color-glass-chrome-solid)'],
    ['--color-glass-panel-bg', 'var(--color-glass-panel-solid)'],
    ['--blur-chrome', '0px'],
    ['--blur-panel', '0px'],
    ['--blur-subtle', '0px'],
  ];
  const indent = (s) => s.replace(/^/gm, '  ').trimEnd();
  const css = [
    `/* ${HEADER} */\n`,
    block(':root', baseLines),
    `/* Varsayılan tema siyah. Açık tema data-theme="light" ile, işletim sistemine uyma data-theme="system" ile. */\n`,
    block(':root,\n:root[data-theme="dark"]', themeLines.dark),
    block(':root[data-theme="light"]', themeLines.light),
    `@media (prefers-color-scheme: light) {\n${indent(block(':root[data-theme="system"]', themeLines.light))}\n}\n`,
    `/* Saydamlık azaltılmışsa cam düz yüzeye döner. :root:root:root, tema seçicilerinin önüne geçmek için. */\n`,
    `@media (prefers-reduced-transparency: reduce) {\n${indent(block(':root:root:root', glassFallback))}\n}\n`,
  ].join('\n');

  const nested = { light: {}, dark: {} };
  for (const t of ['light', 'dark']) for (const path of emitted) setPath(nested[t], path, jsValue(themes[t][path]));

  const js = `// ${HEADER}\n\nexport const light = ${JSON.stringify(nested.light, null, 2)};\n\nexport const dark = ${JSON.stringify(nested.dark, null, 2)};\n`;
  const dts = `// ${HEADER}\n\nexport type Theme = ${tsType(nested.light, 0)};\n\nexport declare const light: Theme;\nexport declare const dark: Theme;\n`;
  return { css, js, dts };
}
