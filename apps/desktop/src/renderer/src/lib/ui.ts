// Arayüz durumu: sağ panel, "Şimdi çalıyor" ekranı, Wrapped, mini oynatıcı.

import { useSyncExternalStore } from 'react';

export interface UiState {
  /** Sağ panel sekmesi; null ise kapalı. Dar pencerede panel varsayılan olarak kapalıdır. */
  panel: 'queue' | 'friends' | null;
  nowPlaying: null | 'lyrics' | 'queue';
  wrapped: boolean;
  miniOpen: boolean;
}

let state: UiState = { panel: 'friends', nowPlaying: null, wrapped: false, miniOpen: false };
const listeners = new Set<() => void>();

export function setUi(patch: Partial<UiState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useUi(): UiState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

export const getUi = () => state;
