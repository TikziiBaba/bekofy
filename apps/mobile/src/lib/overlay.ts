// Tam ekran katman (Şimdi çalıyor) açık mı. Saydam modal altındaki ekranlar erişilebilirlik ağacında kalır;
// katman açıkken sekmeler ekran okuyucudan gizlenir, yoksa TalkBack arkadaki öğelere gidebilir.

import { useSyncExternalStore } from 'react';

let open = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Katman görününce çağrılır; dönen işlev katman kalkınca çağrılır. */
export function holdOverlay(): () => void {
  open += 1;
  emit();
  return () => {
    open -= 1;
    emit();
  };
}

export function useOverlayOpen(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => open > 0,
  );
}
