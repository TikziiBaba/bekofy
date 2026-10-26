// Şarkı ilerleme çubuğu: sürükle ya da dokun. Ekran okuyucuda ayarlanabilir öğe; yukarı/aşağı kaydırma 10 sn ileri/geri.
// Çubuk, oynatıcının yarım saniyede bir gelen konumu arasında akıcı ilerler (adım adım zıplamaz).

import { formatDuration } from '@bekofy/core';
import { useEffect, useState } from 'react';
import { View, type GestureResponderEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { DURATION, EASE } from '@/lib/motion';
import { player, STATUS_INTERVAL_MS, usePlayer } from '@/lib/player';
import { useTheme } from '@/theme';
import { T } from './ui';

/** Çalan şarkının ilerlemesi (0-1). Çalarken bir sonraki konuma doğrusal akar; sarma ya da şarkı değişince hemen yerine geçer. */
export function useProgress(): SharedValue<number> {
  const p = usePlayer();
  const duration = p.duration || p.current?.duration || 0;
  const v = useSharedValue(0);
  useEffect(() => {
    if (!duration) {
      v.value = 0;
      return;
    }
    const now = Math.min(1, p.position / duration);
    if (!p.isPlaying) {
      v.value = withTiming(now, { duration: DURATION.fast, easing: EASE.standard });
      return;
    }
    if (Math.abs(now - v.value) * duration > 1.5) v.value = now;
    v.value = withTiming(Math.min(1, (p.position + STATUS_INTERVAL_MS / 1000) / duration), { duration: STATUS_INTERVAL_MS, easing: Easing.linear });
  }, [p.position, p.isPlaying, duration, v]);
  return v;
}

export function Seek() {
  const t = useTheme();
  const p = usePlayer();
  const progress = useProgress();
  const held = useSharedValue(-1);
  const grab = useSharedValue(0);
  const [width, setWidth] = useState(1);
  const [drag, setDrag] = useState<number | null>(null);
  const duration = p.duration || p.current?.duration || 0;
  const position = drag ?? Math.min(p.position, duration || p.position);
  const ratioAt = (e: GestureResponderEvent) => Math.min(1, Math.max(0, e.nativeEvent.locationX / width));
  const follow = (e: GestureResponderEvent) => {
    const r = ratioAt(e);
    held.value = r;
    setDrag(r * duration);
  };

  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: held.value >= 0 ? held.value : progress.value }] }));
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: (held.value >= 0 ? held.value : progress.value) * width - 6 }, { scale: 1 + grab.value * 0.5 }],
  }));

  return (
    <View style={{ gap: t.space[1] }}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Şarkıda konum"
        accessibilityValue={{ text: `${formatDuration(position)} / ${duration ? formatDuration(duration) : 'bilinmiyor'}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => player.seek(Math.max(0, Math.min(duration, p.position + (e.nativeEvent.actionName === 'increment' ? 10 : -10))))}
        onLayout={(e) => setWidth(Math.max(1, e.nativeEvent.layout.width))}
        onStartShouldSetResponder={() => duration > 0}
        onMoveShouldSetResponder={() => duration > 0}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          grab.value = withTiming(1, { duration: DURATION.fast, easing: EASE.enter });
          follow(e);
        }}
        onResponderMove={follow}
        onResponderRelease={(e) => {
          const r = ratioAt(e);
          progress.value = r;
          held.value = -1;
          grab.value = withTiming(0, { duration: DURATION.base, easing: EASE.standard });
          player.seek(r * duration);
          setDrag(null);
        }}
        onResponderTerminate={() => {
          held.value = -1;
          grab.value = withTiming(0, { duration: DURATION.base, easing: EASE.standard });
          setDrag(null);
        }}
        style={{ height: t.size.touch, justifyContent: 'center' }}
      >
        <View pointerEvents="none" style={{ height: t.space[1], borderRadius: t.radius.full, backgroundColor: t.c.fill.muted, overflow: 'hidden' }}>
          <Animated.View style={[{ width: '100%', height: '100%', backgroundColor: t.c.text.primary, transformOrigin: 'left' }, fill]} />
        </View>
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, width: 12, height: 12, borderRadius: t.radius.full, backgroundColor: t.c.text.primary, boxShadow: t.shadow.sm }, thumb]} />
      </View>
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T variant="caption" tone="secondary" style={{ fontVariant: ['tabular-nums'] }}>
          {formatDuration(position)}
        </T>
        <T variant="caption" tone="secondary" style={{ fontVariant: ['tabular-nums'] }}>
          {duration ? formatDuration(duration) : '-'}
        </T>
      </View>
    </View>
  );
}
