export { light, dark, Theme } from '../dist/tokens';

export type Mode = 'light' | 'dark';

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface DynamicTheme {
  mode: Mode;
  seed: string;
  color: {
    accent: { default: string; on: string; text: string };
    focus: string;
    ambient: { 1: string; 2: string; 3: string };
  };
  cssVars: Record<string, string>;
}

export declare const TEXT_MIN: number;
export declare const UI_MIN: number;

export declare function deriveDynamicTheme(seed: string, mode?: Mode): DynamicTheme;
export declare function seedFromPixels(rgba: ArrayLike<number>, step?: number): string;

export declare function contrast(fg: string | Rgba, bg: string | Rgba): number;
export declare function composite(top: string | Rgba, bottom: string | Rgba): Rgba;
export declare function formatColor(color: Rgba): string;
export declare function fromOklch(l: number, c: number, h: number, a?: number): Rgba;
export declare function parseColor(value: string): Rgba;
export declare function toOklch(color: Rgba): { l: number; c: number; h: number };
export declare function withAlpha(color: string | Rgba, alpha: number): Rgba;
export declare function cssVarName(path: string): string;
