// Prototip verisini üretir: data.json + her kapak rengi için önceden hesaplanmış ortam zemini -> data.js.
// Prototip file:// üzerinden açılabilsin diye ES modülü yerine klasik script çıktısı verir.

import { readFileSync, writeFileSync } from 'node:fs';
import { deriveAmbient } from '@bekofy/tokens';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url), 'utf8'));
const seeds = new Set([
  ...data.albums.map((a) => a.seed),
  ...data.playlists.map((p) => p.seed),
  ...data.artists.map((a) => a.seed),
  data.youtubePreview.seed,
]);
const themes = {};
for (const seed of seeds) {
  themes[seed] = { light: deriveAmbient(seed, 'light').cssVars, dark: deriveAmbient(seed, 'dark').cssVars };
}
delete data.$comment;
writeFileSync(
  new URL('./data.js', import.meta.url),
  `// Otomatik üretildi: node docs/prototype/build.mjs (kaynak: data.json). Elle düzenleme.\nwindow.BEKOFY_DATA = ${JSON.stringify({ ...data, themes })};\n`,
);
console.log(`prototip verisi: ${data.songs.length} şarkı, ${seeds.size} kapak teması`);
