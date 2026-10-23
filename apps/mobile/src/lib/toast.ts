// Kısa bildirim: ekranın altında birkaç saniye görünür, ekran okuyucuya da okunur.

import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

let message: { id: number; text: string } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showToast(text: string): void {
  message = { id: (message?.id ?? 0) + 1, text };
  AccessibilityInfo.announceForAccessibility(text);
  emit();
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    message = null;
    emit();
  }, 3500);
}

export function useToast() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => message,
  );
}
