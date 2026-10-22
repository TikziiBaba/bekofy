// DTCG kaynaklarını okur, takma adları ({a.b}) ve alpha({a.b}, n) ifadelerini tema bazında çözer.
// Yalnızca derleme ve testlerde (Node) kullanılır; çalışma anı kodu dist/tokens.js'i okur.

import { readFileSync, readdirSync } from 'node:fs';
import { parseColor, withAlpha } from './color.js';

const SRC = new URL('./tokens/', import.meta.url);
const THEME_FILES = { 'semantic.light.json': 'light', 'semantic.dark.json': 'dark' };
const ALIAS = /^\{([^}]+)\}$/;
const ALPHA = /^alpha\(\{([^}]+)\},\s*([\d.]+)\)$/;

function flatten(node, prefix, inheritedType, out, meta) {
  const type = node.$type ?? inheritedType;
  if ('$value' in node) {
    out[prefix] = { type, value: node.$value, ...meta };
    return;
  }
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$') || typeof child !== 'object' || child === null) continue;
    flatten(child, prefix ? `${prefix}.${key}` : key, type, out, meta);
  }
}

/** Tüm kaynak dosyaları okur: { base, themes: { light, dark } } (yol -> ham token). */
export function loadSources() {
  const base = {};
  const themes = { light: {}, dark: {} };
  for (const file of readdirSync(SRC).filter((f) => f.endsWith('.json')).sort()) {
    const json = JSON.parse(readFileSync(new URL(file, SRC), 'utf8'));
    const theme = THEME_FILES[file];
    flatten(json, '', undefined, theme ? themes[theme] : base, {
      primitive: file.startsWith('primitive.'),
      themed: Boolean(theme),
    });
  }
  return { base, themes };
}

/** Bir temanın tüm token'larını çözer: yol -> { type, value, raw, primitive, themed }. */
export function resolveTheme(sources, theme) {
  const all = { ...sources.base, ...sources.themes[theme] };
  const done = {};

  const resolvePath = (path, stack) => {
    if (done[path]) return done[path].value;
    const token = all[path];
    if (!token) throw new Error(`Bilinmeyen token: {${path}} (zincir: ${stack.join(' -> ')})`);
    if (stack.includes(path)) throw new Error(`Döngüsel başvuru: ${[...stack, path].join(' -> ')}`);
    const value = resolveValue(token.value, token.type, [...stack, path]);
    done[path] = { ...token, raw: token.value, value };
    return value;
  };

  const resolveValue = (raw, type, stack) => {
    if (typeof raw === 'string') {
      const alias = raw.match(ALIAS);
      if (alias) return resolvePath(alias[1], stack);
      const alpha = raw.match(ALPHA);
      if (alpha) return withAlpha(resolvePath(alpha[1], stack), parseFloat(alpha[2]));
      if (type === 'color') return parseColor(raw);
      return raw;
    }
    if (Array.isArray(raw)) return raw.map((item) => (typeof item === 'object' ? resolveValue(item, type, stack) : item));
    if (raw && typeof raw === 'object') {
      const out = {};
      for (const [key, val] of Object.entries(raw)) out[key] = resolveValue(val, key === 'color' ? 'color' : undefined, stack);
      return out;
    }
    return raw;
  };

  for (const path of Object.keys(all)) resolvePath(path, []);
  return done;
}

/** Bir token'ın başvurduğu yolları döndürür (alias, alpha ve bileşik alanlar). */
export function referencesOf(raw) {
  const refs = [];
  const walk = (v) => {
    if (typeof v === 'string') {
      const m = v.match(ALIAS) ?? v.match(ALPHA);
      if (m) refs.push(m[1]);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(raw);
  return refs;
}
