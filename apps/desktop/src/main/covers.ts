// Kapağın baskın rengi: ana süreçte okunur (tarayıcı CORS kısıtı olmadan), küçültülüp ortalanır.

import { seedFromPixels } from '@bekofy/tokens';
import { nativeImage, net } from 'electron';
import { isMediaUrl } from './offline';

const cache = new Map<string, string | null>();

export async function coverSeed(raw: unknown): Promise<string | null> {
  if (typeof raw !== 'string' || !(isMediaUrl(raw) || raw.startsWith('https://i.ytimg.com/'))) return null;
  if (cache.has(raw)) return cache.get(raw) ?? null;
  let seed: string | null = null;
  try {
    const res = await net.fetch(raw);
    if (res.ok) {
      const image = nativeImage.createFromBuffer(Buffer.from(await res.arrayBuffer()));
      if (!image.isEmpty()) {
        const small = image.resize({ width: 24, height: 24, quality: 'good' });
        const bgra = small.toBitmap();
        const rgba = new Uint8ClampedArray(bgra.length);
        for (let i = 0; i < bgra.length; i += 4) {
          rgba[i] = bgra[i + 2]!;
          rgba[i + 1] = bgra[i + 1]!;
          rgba[i + 2] = bgra[i]!;
          rgba[i + 3] = bgra[i + 3]!;
        }
        seed = seedFromPixels(rgba);
      }
    }
  } catch {
    seed = null;
  }
  if (cache.size > 200) cache.clear();
  cache.set(raw, seed);
  return seed;
}
