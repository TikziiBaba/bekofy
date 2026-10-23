// İnternetsiz dinleme (Premium): şarkı uygulamanın belge klasörüne iner (offline-songs/<id>.mp3 + <id>.json).
// Oynatıcı indirilmiş şarkıyı diskten çalar.

import { songAudioUrl, type SongSummary } from '@bekofy/core';
import { Directory, File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { sb } from './supabase';

export interface OfflineSong {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  cover_url: string | null;
  duration: number | null;
  downloaded_at: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dir = () => new Directory(Paths.document, 'offline-songs');

interface State {
  songs: OfflineSong[];
  progress: Record<string, number>;
}
let state: State = { songs: [], progress: {} };
let ids = new Set<string>();
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  ids = new Set(state.songs.map((s) => s.id));
  listeners.forEach((l) => l());
};

/** İnternetsiz dinleme Premium'a özel; oturum açılınca ayarlanır. */
let allowed = false;
export const setDownloadAllowed = (v: boolean) => {
  allowed = v;
};
export const canDownload = () => allowed;
export const PREMIUM_DOWNLOAD_MESSAGE = "İnternetsiz dinleme Premium'a özel. Premium'u sitede inceleyebilirsin.";

export async function refreshOffline(): Promise<void> {
  const d = dir();
  if (!d.exists) return set({ songs: [] });
  const songs: OfflineSong[] = [];
  for (const entry of d.list()) {
    if (!(entry instanceof File) || !entry.name.endsWith('.json')) continue;
    try {
      const meta = JSON.parse(await entry.text()) as OfflineSong;
      if (UUID.test(meta.id) && new File(d, `${meta.id}.mp3`).exists) songs.push(meta);
    } catch {
      // Bozuk meta dosyası atlanır.
    }
  }
  songs.sort((a, b) => b.downloaded_at.localeCompare(a.downloaded_at));
  set({ songs });
}

/** İndirilmişse dosya adresi, değilse null. */
export function localUri(id: string): string | null {
  return ids.has(id) ? new File(dir(), `${id}.mp3`).uri : null;
}

export async function downloadTrack(t: SongSummary): Promise<string | null> {
  if (!allowed) return PREMIUM_DOWNLOAD_MESSAGE;
  if (!UUID.test(t.id)) return 'Bu şarkı indirilemiyor.';
  const d = dir();
  if (!d.exists) d.create({ intermediates: true });
  const target = new File(d, `${t.id}.mp3`);
  try {
    if (!target.exists) {
      set({ progress: { ...state.progress, [t.id]: 0 } });
      const task = File.createDownloadTask(songAudioUrl(sb, t), target, {
        onProgress: ({ bytesWritten, totalBytes }) => {
          if (totalBytes > 0) set({ progress: { ...state.progress, [t.id]: Math.floor((bytesWritten / totalBytes) * 100) } });
        },
      });
      const file = await task.downloadAsync();
      if (!file?.exists) throw new Error('indirilemedi');
    }
    const meta: OfflineSong = { id: t.id, title: t.title, artist: t.artist, album: t.album, cover_url: t.cover_url, duration: t.duration, downloaded_at: new Date().toISOString() };
    const json = new File(d, `${t.id}.json`);
    json.create({ overwrite: true });
    await json.write(JSON.stringify(meta));
    return null;
  } catch {
    if (target.exists) target.delete();
    return 'İndirilemedi. İnternet bağlantını kontrol edip tekrar dene.';
  } finally {
    const { [t.id]: _done, ...progress } = state.progress;
    set({ progress });
    await refreshOffline();
  }
}

export async function removeDownload(id: string): Promise<void> {
  if (!UUID.test(id)) return;
  for (const name of [`${id}.mp3`, `${id}.json`]) {
    const f = new File(dir(), name);
    if (f.exists) f.delete();
  }
  await refreshOffline();
}

export const offlineAsTrack = (s: OfflineSong): SongSummary => ({
  id: s.id,
  title: s.title,
  artist: s.artist,
  album: s.album,
  duration: s.duration,
  cover_url: s.cover_url,
  file_path: '',
  genre: null,
  status: 'approved',
  created_at: s.downloaded_at,
});

export function useOffline(): State {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}
