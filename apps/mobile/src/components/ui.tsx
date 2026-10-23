// Temel yapı taşları: metin, düğme, simge düğmesi. Renk ve ölçüler temadan gelir; dokunma alanı en az 48dp.

import { Pause, Play, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { anim, DURATION, EASE, haptic } from '@/lib/motion';
import { useTheme, type AppTheme } from '@/theme';
import { Tappable } from './tappable';

type Variant = keyof AppTheme['type'];
type Tone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'danger' | 'inverse' | 'onAccent';

export function T({ variant = 'bodyMd', tone = 'primary', style, ...props }: TextProps & { variant?: Variant; tone?: Tone }) {
  const t = useTheme();
  const color = {
    primary: t.c.text.primary,
    secondary: t.c.text.secondary,
    tertiary: t.c.text.tertiary,
    accent: t.c.accent.text,
    danger: t.c.feedback.danger.text,
    inverse: t.c.text.inverse,
    onAccent: t.c.accent.on,
  }[tone];
  return <Text {...props} style={[t.type[variant], { color }, style]} />;
}

/** inverseOutline: ters renkli (açık zeminli) şeritlerde ikincil düğme. */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'inverseOutline';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon: Icon,
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const bg = { primary: t.c.accent.default, secondary: t.c.fill.subtle, ghost: 'transparent', destructive: t.c.destructive.default, inverseOutline: 'transparent' }[variant];
  const fg = { primary: t.c.accent.on, secondary: t.c.text.primary, ghost: t.c.text.primary, destructive: t.c.destructive.on, inverseOutline: t.c.text.inverse }[variant];
  const off = disabled || loading;
  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      onPress={onPress}
      android_ripple={{ color: t.c.state.pressed, borderless: false }}
      style={[
        styles.button,
        { backgroundColor: bg, borderRadius: t.radius.full, paddingHorizontal: t.space[5], minHeight: t.size.touch + 4, opacity: off ? 0.5 : 1, overflow: 'hidden' },
        variant === 'inverseOutline' && { borderColor: fg, borderWidth: t.size.border.hairline },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : Icon ? <Icon color={fg} size={20} /> : null}
      <Text style={[t.type.labelMd, { color: fg }]}>{label}</Text>
    </Tappable>
  );
}

export function IconButton({
  icon: Icon,
  label,
  onPress,
  active = false,
  size = 24,
  color,
  filled = false,
  style,
  ...rest
}: { icon: LucideIcon; label: string; onPress: () => void; active?: boolean; size?: number; color?: string; filled?: boolean; style?: StyleProp<ViewStyle> } & Omit<PressableProps, 'onPress' | 'style'>) {
  const t = useTheme();
  const fg = color ?? (active ? t.c.accent.text : t.c.text.secondary);
  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      hitSlop={8}
      scaleTo={0.86}
      android_ripple={{ color: t.c.state.pressed, borderless: true, radius: 24 }}
      style={[styles.icon, style]}
      {...rest}
    >
      <Icon color={fg} size={size} fill={filled ? fg : 'transparent'} />
    </Tappable>
  );
}

/** Çal/duraklat: simge değişirken kısa bir büyüme geçişi; dokununca hafif titreşim. */
export function PlayButton({ playing, label, onPress, size = 56 }: { playing: boolean; label: string; onPress: () => void; size?: number }) {
  const t = useTheme();
  const icon = size * 0.4;
  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={`${playing ? 'Duraklat' : 'Çal'}: ${label}`}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      scaleTo={0.9}
      style={[styles.play, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.c.accent.default }]}
    >
      <Animated.View key={playing ? 'pause' : 'play'} entering={anim(ZoomIn.duration(DURATION.base).easing(EASE.emphasized))}>
        {playing ? <Pause color={t.c.accent.on} fill={t.c.accent.on} size={icon} /> : <Play color={t.c.accent.on} fill={t.c.accent.on} size={icon} style={{ marginLeft: size * 0.05 }} />}
      </Animated.View>
    </Tappable>
  );
}

export function Notice({ tone = 'info', title, children }: { tone?: 'info' | 'success' | 'warning' | 'danger'; title?: string; children?: ReactNode }) {
  const t = useTheme();
  const f = t.c.feedback[tone];
  return (
    <View accessibilityRole={tone === 'danger' ? 'alert' : undefined} style={{ backgroundColor: f.bg, borderColor: f.border, borderWidth: 1, borderRadius: t.radius.lg, padding: t.space[4], gap: t.space[1] }}>
      {title ? <Text style={[t.type.labelMd, { color: f.text }]}>{title}</Text> : null}
      {typeof children === 'string' ? <Text style={[t.type.bodySm, { color: f.text }]}>{children}</Text> : children}
    </View>
  );
}

export const textStyle = (t: AppTheme, v: Variant, color: string): TextStyle => ({ ...t.type[v], color });

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'flex-start' },
  icon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  play: { alignItems: 'center', justifyContent: 'center' },
});
