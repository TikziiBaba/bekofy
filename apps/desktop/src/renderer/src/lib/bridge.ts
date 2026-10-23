// Ana sürece köprü. Tarayıcıda (testler, Vite önizlemesi) köprü yoktur; masaüstüne özgü özellikler kapanır.

import type { BekofyBridge } from '../../../shared/ipc';

declare global {
  interface Window {
    bekofy?: BekofyBridge;
  }
}

export const bridge: BekofyBridge | null = typeof window !== 'undefined' ? (window.bekofy ?? null) : null;
export const isDesktop = bridge !== null;
