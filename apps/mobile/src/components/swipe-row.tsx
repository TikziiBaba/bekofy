// Kaydırılabilir satır: sağa çek -> sol eylem (ör. sıraya al), sola çek -> sağ eylem (ör. listeye ekle).
// Eşik geçilince simge büyür ve telefon bir kez titrer; bırakınca eylem çalışır, satır yerine oturur.
// Dikey kaydırma önceliklidir (liste rahat kayar). Ekran okuyucuda aynı eylemler satırın özel eylemleri olarak durur.

import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { haptic, SPRING } from '@/lib/motion';
import { useTheme } from '@/theme';

const THRESHOLD = 72;

export interface SwipeAction {
  icon: LucideIcon;
  label: string;
  run: () => void;
}

export function SwipeRow({ left, right, children }: { left?: SwipeAction; right?: SwipeAction; children: ReactNode }) {
  const t = useTheme();
  const x = useSharedValue(0);
  const armed = useSharedValue(0);

  const fire = (side: 'left' | 'right') => (side === 'left' ? left : right)?.run();

  const pan = usePanGesture({
    activeOffsetX: [-18, 18],
    failOffsetY: [-10, 10],
    onUpdate: (e) => {
      'worklet';
      // Eylemi olmayan yöne çekilirse direnç gösterir.
      const raw = e.translationX;
      const v = (raw > 0 && !left) || (raw < 0 && !right) ? raw * 0.15 : raw;
      x.value = Math.max(-THRESHOLD * 1.8, Math.min(THRESHOLD * 1.8, v));
      const now = Math.abs(x.value) >= THRESHOLD ? 1 : 0;
      if (now !== armed.value) {
        armed.value = now;
        if (now) scheduleOnRN(haptic.select);
      }
    },
    onDeactivate: () => {
      'worklet';
      if (x.value >= THRESHOLD && left) scheduleOnRN(fire, 'left');
      else if (x.value <= -THRESHOLD && right) scheduleOnRN(fire, 'right');
      armed.value = 0;
      x.value = withSpring(0, SPRING);
    },
  });

  const row = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  // Renkli şerit yalnızca açılan boşluğu doldurur; satırın kendisi saydam kalır (arka plan ışığı görünür).
  // Şeridin iç boşluğu yok: boşluk genişliği sıfırın altına indirmez, şerit dururken de ince bir çizgi gibi görünürdü.
  const leftBg = useAnimatedStyle(() => ({ width: Math.max(0, x.value) }));
  const rightBg = useAnimatedStyle(() => ({ width: Math.max(0, -x.value) }));
  const leftIcon = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(x.value, [0, THRESHOLD, THRESHOLD + 1], [0.6, 1, 1.2], 'clamp') }] }));
  const rightIcon = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(-x.value, [0, THRESHOLD, THRESHOLD + 1], [0.6, 1, 1.2], 'clamp') }] }));

  return (
    <View style={{ borderRadius: t.radius.md, overflow: 'hidden' }}>
      {left ? (
        <Animated.View importantForAccessibility="no-hide-descendants" style={[styles.bg, { left: 0, backgroundColor: t.c.accent.default }, leftBg]}>
          <Animated.View style={[styles.icon, { left: t.space[5] }, leftIcon]}>
            <left.icon color={t.c.accent.on} size={t.size.icon.md} />
          </Animated.View>
        </Animated.View>
      ) : null}
      {right ? (
        <Animated.View importantForAccessibility="no-hide-descendants" style={[styles.bg, { right: 0, backgroundColor: t.c.surface.inverse }, rightBg]}>
          <Animated.View style={[styles.icon, { right: t.space[5] }, rightIcon]}>
            <right.icon color={t.c.text.inverse} size={t.size.icon.md} />
          </Animated.View>
        </Animated.View>
      ) : null}
      <GestureDetector gesture={pan}>
        <Animated.View style={row}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { position: 'absolute', top: 0, bottom: 0, overflow: 'hidden' },
  icon: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center' },
});
