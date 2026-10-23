// Cihaz ayarları (hesaptan bağımsız): tema, kapak rengi, Discord. Değişince abonelere bildirilir.

import { deriveAmbient } from '@bekofy/tokens';
import { useSyncExternalStore } from 'react';
import { bridge } from './bridge';

export type ThemeChoice = 'dark' | 'light' | 'system';
export interface Settings {
  theme: ThemeChoice;
  coverColor: boolean;
  discord: boolean;
}

const KEY = 'bekofy-settings';
const DEFAULTS: Settings = { theme: 'dark', coverColor: true, discord: true };

function load(): Settings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>) };
  } catch {
    return DEFAULTS;
  }
}

let current = load();
const listeners = new Set<() => void>();
const lightQuery = window.matchMedia('(prefers-color-scheme: light)');

export const resolvedMode = (s: Settings = current): 'dark' | 'light' => (s.theme === 'system' ? (lightQuery.matches ? 'light' : 'dark') : s.theme);

function apply(): void {
  const root = document.documentElement;
  if (current.theme === 'dark') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', current.theme);
  bridge?.window.setTheme(resolvedMode());
  bridge?.discord.setEnabled(current.discord);
  applyAmbient();
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Depolama kapalıysa ayar bu oturumla sınırlı kalır.
  }
  apply();
  listeners.forEach((l) => l());
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

/* ---------- Ortam ışığı: çalan şarkının kapağından, yalnızca arka plan ---------- */
let ambientSeed: string | null = null;
const AMBIENT_VARS = ['--color-ambient-1', '--color-ambient-2', '--color-ambient-3'];

function applyAmbient(): void {
  const root = document.documentElement;
  if (!current.coverColor || !ambientSeed) {
    AMBIENT_VARS.forEach((k) => root.style.removeProperty(k));
    return;
  }
  const { cssVars } = deriveAmbient(ambientSeed, resolvedMode());
  for (const [k, v] of Object.entries(cssVars)) root.style.setProperty(k, v);
}

export function setAmbientSeed(seed: string | null): void {
  ambientSeed = seed;
  applyAmbient();
}

lightQuery.addEventListener('change', apply);
apply();
