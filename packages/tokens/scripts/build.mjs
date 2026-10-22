// dist/tokens.css, dist/tokens.js ve dist/tokens.d.ts dosyalarını yeniden üretir.

import { mkdirSync, writeFileSync } from 'node:fs';
import { generate } from '../src/generate.js';

const dist = new URL('../dist/', import.meta.url);
const { css, js, dts } = generate();
mkdirSync(dist, { recursive: true });
writeFileSync(new URL('tokens.css', dist), css);
writeFileSync(new URL('tokens.js', dist), js);
writeFileSync(new URL('tokens.d.ts', dist), dts);
console.log(`tokens: ${css.split('\n').filter((l) => l.trim().startsWith('--')).length} CSS değişkeni yazıldı -> packages/tokens/dist`);
