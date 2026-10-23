// Şarkı ilerleme çubuğu: sürükle ya da dokun. Ekran okuyucuda ayarlanabilir öğe; yukarı/aşağı kaydırma 10 sn ileri/geri.

import { formatDuration } from '@bekofy/core';
import { useState } from 'react';
import { View, type GestureResponderEvent } from 'react-native';
import { player, usePlayer } from '@/lib/player';
import { useTheme } from '@/theme';
import { T } from './ui';

export function Seek() {
  const t = useTheme();
  const p = usePlayer();
  const [width, setWidth] = useState(1);
  const [drag, setDrag] = useState<number | null>(null);
  const duration = p.duration || p.current?.duration || 0;
  const position = drag ?? Math.min(p.position, duration || p.position);
  const ratio = duration ? Math.min(1, Math.max(0, position / duration)) : 0;
  const at = (e: GestureResponderEvent) => Math.min(1, Math.max(0, e.nativeEvent.locationX / width)) * duration;

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
        onResponderGrant={(e) => setDrag(at(e))}
        onResponderMove={(e) => setDrag(at(e))}
        onResponderRelease={(e) => {
          player.seek(at(e));
          setDrag(null);
        }}
        onResponderTerminate={() => setDrag(null)}
        style={{ height: t.size.touch, justifyContent: 'center' }}
      >
        <View pointerEvents="none" style={{ height: t.space[1], borderRadius: t.radius.full, backgroundColor: t.c.fill.muted }}>
          <View style={{ width: `${ratio * 100}%`, height: '100%', borderRadius: t.radius.full, backgroundColor: t.c.text.primary }} />
        </View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: ratio * width - (drag !== null ? 9 : 6),
            width: drag !== null ? 18 : 12,
            height: drag !== null ? 18 : 12,
            borderRadius: t.radius.full,
            backgroundColor: t.c.text.primary,
          }}
        />
      </View>
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T variant="caption" tone="secondary">
          {formatDuration(position)}
        </T>
        <T variant="caption" tone="secondary">
          {duration ? formatDuration(duration) : '-'}
        </T>
      </View>
    </View>
  );
}
