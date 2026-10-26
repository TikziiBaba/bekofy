// Ortam ışığı: çalan şarkının kapağından, yalnızca arka plan. Masaüstüyle aynı yol: kapağın pikselleri ->
// seedFromPixels -> deriveAmbient (metin kontrastını koruyan renkler). Pikseller kapağın thumbhash'inden açılır
// (expo-image üretir), ayrıca bir yerel modül gerekmez. Ayarlardan kapatılırsa token'lardaki yeşil ışık kalır.

import { deriveAmbient, seedFromPixels } from '@bekofy/tokens';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { thumbHashToRGBA } from 'thumbhash';
import { player } from './player';
import { getSetting, subscribeSettings } from './settings';

const seeds = new Map<string, string | null>();
let seed: string | null = null;
let coverUrl: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function seedFor(url: string): Promise<string | null> {
  if (seeds.has(url)) return seeds.get(url)!;
  try {
    const hash = await Image.generateThumbhashAsync(url);
    const bytes = Uint8Array.from(atob(hash), (ch) => ch.charCodeAt(0));
    const { rgba } = thumbHashToRGBA(bytes);
    const s = seedFromPixels(rgba, 1);
    seeds.set(url, s);
    return s;
  } catch {
    seeds.set(url, null);
    return null;
  }
}

function sync(): void {
  const url = getSetting('coverColor') ? (player.getState().current?.cover_url ?? null) : null;
  if (url === coverUrl) return;
  coverUrl = url;
  if (!url) {
    seed = null;
    return emit();
  }
  void seedFor(url).then((s) => {
    if (coverUrl !== url) return;
    seed = s;
    emit();
  });
}

player.subscribe(sync);
subscribeSettings(sync);

/** Kapaktan türetilen ortam renkleri; kapak yoksa ya da ayar kapalıysa null (tema rengi kullanılır). */
export function useCoverAmbient(mode: 'dark' | 'light'): { 1: string; 2: string; 3: string } | null {
  const s = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => seed,
  );
  return s ? deriveAmbient(s, mode).color.ambient : null;
}

/** Bir koleksiyonun (liste, albüm, sanatçı) kendi kapağından ortam renkleri; ayar kapalıysa ya da kapak yoksa null. */
export function useCoverTint(url: string | null | undefined, mode: 'dark' | 'light'): { 1: string; 2: string; 3: string } | null {
  const enabled = useSyncExternalStore(subscribeSettings, () => getSetting('coverColor'));
  const [s, setS] = useState<string | null>(() => (url ? (seeds.get(url) ?? null) : null));
  useEffect(() => {
    if (!url || !enabled) return setS(null);
    let live = true;
    void seedFor(url).then((v) => {
      if (live) setS(v);
    });
    return () => {
      live = false;
    };
  }, [url, enabled]);
  return useMemo(() => (enabled && s ? deriveAmbient(s, mode).color.ambient : null), [enabled, s, mode]);
}
