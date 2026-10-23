// İndirilen şarkılar: liste, indirme ilerlemesi, silme. Oynatıcı indirilmiş şarkıyı diskten çalar.

import { songAudioUrl, type BekofyClient } from '@bekofy/core';
import { useEffect, useSyncExternalStore } from 'react';
import type { OfflineSong } from '../../../shared/ipc';
import { bridge } from './bridge';
import { player, type Track } from './player';

interface OfflineState {
  songs: OfflineSong[];
  /** İndirilmekte olanlar: kimlik -> yüzde. */
  progress: Record<string, number>;
  errors: Record<string, string>;
}

let state: OfflineState = { songs: [], progress: {}, errors: {} };
const listeners = new Set<() => void>();
const set = (patch: Partial<OfflineState>) => {
  state = { ...state, ...patch };
  player.setOffline(state.songs.map((s) => s.id));
  listeners.forEach((l) => l());
};

export async function refreshOffline(): Promise<void> {
  if (!bridge) return;
  set({ songs: await bridge.offline.list() });
}

bridge?.offline.onEvent((e) => {
  if (e.state === 'progress') set({ progress: { ...state.progress, [e.id]: e.percent } });
  else {
    const { [e.id]: _done, ...progress } = state.progress;
    set({ progress, errors: e.state === 'error' ? { ...state.errors, [e.id]: e.message } : state.errors });
    if (e.state === 'done') void refreshOffline();
  }
});

export async function downloadTrack(sb: BekofyClient, t: Track): Promise<string | null> {
  if (!bridge) return 'İndirme yalnızca masaüstü uygulamasında var.';
  const { [t.id]: _old, ...errors } = state.errors;
  set({ progress: { ...state.progress, [t.id]: 0 }, errors });
  const res = await bridge.offline.download({ id: t.id, title: t.title, artist: t.artist, album: t.album, cover_url: t.cover_url, duration: t.duration, url: songAudioUrl(sb, t) });
  return res.ok ? null : res.error;
}

export async function removeDownload(id: string): Promise<void> {
  await bridge?.offline.remove(id);
  await refreshOffline();
}

/** İndirilen şarkıyı oynatıcının beklediği biçime çevirir (çevrimdışı listeden çalmak için). */
export const offlineAsTrack = (s: OfflineSong): Track => ({
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

export function useOffline(): OfflineState {
  useEffect(() => {
    if (!state.songs.length) void refreshOffline();
  }, []);
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}
