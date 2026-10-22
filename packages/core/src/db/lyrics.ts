// Şarkı sözleri: senkron (LRC) ayrıştırma, aktif satır bulma ve lrclib.net'ten arama.

import type { Song } from './songs';

export interface LyricLine {
  /** Saniye. */
  time: number;
  text: string;
}

const STAMP = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const OFFSET = /^\[offset:\s*([+-]?\d+)\]/im;

/**
 * LRC metnini satırlara ayırır. Bir satırda birden çok zaman damgası olabilir; [offset:+/-ms] uygulanır,
 * [ar:], [ti:] gibi bilgi etiketleri atlanır. Sonuç zamana göre sıralıdır.
 */
export function parseLrc(lrc: string): LyricLine[] {
  const offset = Number(lrc.match(OFFSET)?.[1] ?? 0) / 1000;
  const lines: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(STAMP)];
    if (!stamps.length) continue;
    const text = raw.replace(STAMP, '').trim();
    for (const s of stamps) {
      const frac = s[3] ? Number(s[3]) / 10 ** s[3].length : 0;
      const time = Number(s[1]) * 60 + Number(s[2]) + frac - offset;
      lines.push({ time: Math.max(0, Math.round(time * 1000) / 1000), text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

/** t saniyesinde söylenen satırın indeksi; ilk satırdan önceyse -1. İkili arama. */
export function activeLineIndex(lines: readonly LyricLine[], t: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((lines[mid] as LyricLine).time <= t) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return found;
}

export interface Lyrics {
  plain: string | null;
  synced: LyricLine[] | null;
}

/** Şarkının kendi kaydındaki sözler; yoksa null. */
export function storedLyrics(song: Pick<Song, 'lyrics' | 'synced_lyrics'>): Lyrics | null {
  if (!song.lyrics && !song.synced_lyrics) return null;
  const synced = song.synced_lyrics ? parseLrc(song.synced_lyrics) : [];
  return { plain: song.lyrics, synced: synced.length ? synced : null };
}

type Fetch = (input: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
interface LrclibItem {
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

const LRCLIB = 'https://lrclib.net/api';

/**
 * lrclib.net'te arar: önce tam eşleşme (ad, sanatçı, albüm, süre), sonra ad + sanatçı, en son serbest metin.
 * Bulamazsa ya da ağ hatasında null döner.
 */
export async function fetchLyrics(
  song: Pick<Song, 'title' | 'artist' | 'album' | 'duration'>,
  fetchImpl: Fetch = fetch as unknown as Fetch,
): Promise<Lyrics | null> {
  const headers = { 'Lrclib-Client': 'Bekofy (https://bekofy.app)' };
  const pick = (item: LrclibItem | undefined): Lyrics | null => {
    if (!item || (!item.plainLyrics && !item.syncedLyrics)) return null;
    const synced = item.syncedLyrics ? parseLrc(item.syncedLyrics) : [];
    return { plain: item.plainLyrics ?? null, synced: synced.length ? synced : null };
  };
  const firstWithLyrics = (list: unknown): Lyrics | null => {
    if (!Array.isArray(list)) return null;
    const items = list as LrclibItem[];
    return pick(items.find((r) => r.syncedLyrics) ?? items.find((r) => r.plainLyrics));
  };
  try {
    if (song.album && song.duration) {
      const q = new URLSearchParams({ track_name: song.title, artist_name: song.artist, album_name: song.album, duration: String(Math.round(song.duration)) });
      const res = await fetchImpl(`${LRCLIB}/get?${q}`, { headers });
      if (res.ok) {
        const exact = pick((await res.json()) as LrclibItem);
        if (exact) return exact;
      }
    }
    for (const q of [new URLSearchParams({ track_name: song.title, artist_name: song.artist }), new URLSearchParams({ q: `${song.artist} ${song.title}` })]) {
      const res = await fetchImpl(`${LRCLIB}/search?${q}`, { headers });
      if (!res.ok) continue;
      const found = firstWithLyrics(await res.json());
      if (found) return found;
    }
    return null;
  } catch {
    return null;
  }
}
