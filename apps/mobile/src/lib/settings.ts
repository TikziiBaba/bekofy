// Cihaz ayarları: tema, kapak rengi. Açılışta diskten okunur; okunana kadar varsayılanlar geçerlidir.

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Settings {
  theme: 'dark' | 'light' | 'system';
  /** Arka plan ışığı çalan şarkının kapağından gelsin. */
  coverColor: boolean;
}

const KEY = 'bekofy-settings';
let settings: Settings = { theme: 'dark', coverColor: true };
const listeners = new Set<() => void>();

export async function loadSettings(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) settings = { ...settings, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    // Bozuk ya da okunamayan ayar: varsayılanlar kalır.
  }
  listeners.forEach((l) => l());
}

export const getSetting = <K extends keyof Settings>(key: K): Settings[K] => settings[key];

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  settings = { ...settings, [key]: value };
  void AsyncStorage.setItem(KEY, JSON.stringify(settings)).catch(() => undefined);
  listeners.forEach((l) => l());
}

export function subscribeSettings(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
