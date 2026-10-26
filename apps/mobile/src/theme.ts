// Tema: @bekofy/tokens'ın JS değerleri (renk, boşluk, köşe, yazı). Varsayılan siyah; ayardan açık ya da sistem.
// Android'de özel yazı tiplerinde kalınlık ailenin adıyla seçilir (fontWeight tek başına işe yaramaz).

import { dark, light, type Theme } from '@bekofy/tokens';
import { useSyncExternalStore } from 'react';
import { Appearance, type BoxShadowValue, type TextStyle } from 'react-native';
import { getSetting, setSetting, subscribeSettings } from '@/lib/settings';

export const FONTS = {
  ui400: 'Geist_400Regular',
  ui500: 'Geist_500Medium',
  ui600: 'Geist_600SemiBold',
  ui700: 'Geist_700Bold',
  display700: 'BricolageGrotesque_700Bold',
} as const;

const family = (weight: number, display: boolean) =>
  display ? FONTS.display700 : weight >= 700 ? FONTS.ui700 : weight >= 600 ? FONTS.ui600 : weight >= 500 ? FONTS.ui500 : FONTS.ui400;

type Composite = { fontFamily: string[]; fontSize: number; fontWeight: number; lineHeight: number; letterSpacing: number };
const toText = (c: Composite): TextStyle => ({
  fontFamily: family(c.fontWeight, c.fontFamily[0] === 'Bricolage Grotesque'),
  fontSize: c.fontSize,
  lineHeight: Math.round(c.lineHeight),
  letterSpacing: c.letterSpacing,
});

type Layer = { offsetX: number; offsetY: number; blur: number; spread: number; color: string; inset?: boolean };
/** Token gölgesi -> React Native boxShadow (yüzen katmanlar: kapak, mini oynatıcı, alt sayfa). */
const toShadow = (layers: readonly Layer[]): BoxShadowValue[] =>
  layers.map((l) => ({ offsetX: l.offsetX, offsetY: l.offsetY, blurRadius: l.blur, spreadDistance: l.spread, color: l.color, inset: l.inset }));

function build(t: Theme) {
  const x = t.text as unknown as Record<string, Record<string, Composite> & Composite>;
  return {
    mode: t === dark ? ('dark' as const) : ('light' as const),
    c: t.color,
    space: t.space,
    radius: t.radius,
    size: t.size,
    shadow: { sm: toShadow(t.shadow.sm), md: toShadow(t.shadow.md), lg: toShadow(t.shadow.lg), glass: toShadow(t.shadow.glass) },
    type: {
      displayXl: toText(x.display!.xl as Composite),
      displayLg: toText(x.display!.lg as Composite),
      titleXl: toText(x.title!.xl as Composite),
      titleLg: toText(x.title!.lg as Composite),
      titleMd: toText(x.title!.md as Composite),
      titleSm: toText(x.title!.sm as Composite),
      bodyLg: toText(x.body!.lg as Composite),
      bodyMd: toText(x.body!.md as Composite),
      bodySm: toText(x.body!.sm as Composite),
      labelMd: toText(x.label!.md as Composite),
      labelSm: toText(x.label!.sm as Composite),
      caption: toText(x.caption as Composite),
    },
  };
}

const THEMES = { dark: build(dark), light: build(light) };
export type AppTheme = (typeof THEMES)['dark'];
export type ThemeChoice = 'dark' | 'light' | 'system';

const resolve = (): AppTheme => {
  const choice = getSetting('theme');
  const mode = choice === 'system' ? (Appearance.getColorScheme() === 'light' ? 'light' : 'dark') : choice;
  return THEMES[mode];
};

let current = resolve();
const listeners = new Set<() => void>();
const refresh = () => {
  const next = resolve();
  if (next !== current) {
    current = next;
    listeners.forEach((l) => l());
  }
};
Appearance.addChangeListener(refresh);
subscribeSettings(refresh);

export function useTheme(): AppTheme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

export const setThemeChoice = (choice: ThemeChoice) => setSetting('theme', choice);
