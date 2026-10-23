// Çalıyor göstergesi: üç çubuk farklı hızlarda iner kalkar (sistemde animasyonlar kapalıysa durur).

import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { EASE } from '@/lib/motion';
import { useTheme } from '@/theme';

function Bar({ delay, period }: { delay: number; period: number }) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const h = useSharedValue(0.4);
  useEffect(() => {
    if (reduce) return;
    h.value = withDelay(delay, withRepeat(withTiming(1, { duration: period, easing: EASE.standard }), -1, true));
    return () => cancelAnimation(h);
  }, [reduce, delay, period, h]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: h.value }] }));
  return <Animated.View style={[{ width: 3, height: 12, borderRadius: 2, backgroundColor: t.c.accent.text, transformOrigin: 'bottom' }, style]} />;
}

/** Süs: çalma durumu metin olarak ayrıca okunur. */
export function Equalizer() {
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 12 }}>
      <Bar delay={0} period={420} />
      <Bar delay={140} period={520} />
      <Bar delay={60} period={360} />
    </View>
  );
}

