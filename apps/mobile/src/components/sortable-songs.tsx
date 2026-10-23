// Sıralanabilir şarkı listesi: tutamaktan sürükle, diğer satırlar yer açar; bırakınca yeni sıra bildirilir.
// Ekran okuyucuda her satırın "Yukarı taşı" / "Aşağı taşı" eylemleri vardır. Eksi düğmesi şarkıyı listeden çıkarır.

import type { SongSummary } from '@bekofy/core';
import { CircleMinus, GripVertical } from 'lucide-react-native';
import { useLayoutEffect } from 'react';
import { View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { DURATION, EASE, haptic } from '@/lib/motion';
import { useTheme } from '@/theme';
import { Cover } from './cover';
import { IconButton, T } from './ui';

const ROW = 64;

export function SortableSongs({ songs, onMove, onRemove }: { songs: readonly SongSummary[]; onMove: (from: number, to: number) => void; onRemove: (index: number) => void }) {
  const active = useSharedValue(-1);
  const dy = useSharedValue(0);

  // Yeni sıra çizildiği karede sürükleme durumunu sıfırla (satır yerine "zıplamasın").
  useLayoutEffect(() => {
    active.value = -1;
    dy.value = 0;
  }, [songs, active, dy]);

  return (
    <View>
      {songs.map((s, i) => (
        <Row key={s.id} song={s} index={i} count={songs.length} active={active} dy={dy} onMove={onMove} onRemove={onRemove} />
      ))}
    </View>
  );
}

function Row({
  song,
  index,
  count,
  active,
  dy,
  onMove,
  onRemove,
}: {
  song: SongSummary;
  index: number;
  count: number;
  active: SharedValue<number>;
  dy: SharedValue<number>;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
}) {
  const t = useTheme();
  const drop = (from: number, to: number) => {
    if (from !== to) onMove(from, to);
    else {
      active.value = -1;
      dy.value = 0;
    }
  };

  const pan = usePanGesture({
    minDistance: 2,
    onActivate: () => {
      'worklet';
      active.value = index;
      dy.value = 0;
      scheduleOnRN(haptic.heavy);
    },
    onUpdate: (e) => {
      'worklet';
      dy.value = Math.max(-index * ROW, Math.min((count - 1 - index) * ROW, e.translationY));
    },
    onDeactivate: () => {
      'worklet';
      const to = Math.max(0, Math.min(count - 1, Math.round(index + dy.value / ROW)));
      dy.value = withTiming((to - index) * ROW, { duration: DURATION.fast, easing: EASE.standard }, () => {
        'worklet';
        scheduleOnRN(drop, index, to);
      });
    },
  });

  const style = useAnimatedStyle(() => {
    const a = active.value;
    if (a === index) return { transform: [{ translateY: dy.value }, { scale: 1.02 }], zIndex: 10, elevation: 8, opacity: 0.97 };
    if (a < 0) return { transform: [{ translateY: 0 }, { scale: 1 }], zIndex: 0, elevation: 0, opacity: 1 };
    const to = Math.max(0, Math.min(count - 1, Math.round(a + dy.value / ROW)));
    const shift = a < index && index <= to ? -ROW : to <= index && index < a ? ROW : 0;
    return { transform: [{ translateY: withTiming(shift, { duration: DURATION.base, easing: EASE.standard }) }, { scale: 1 }], zIndex: 0, elevation: 0, opacity: 1 };
  });

  return (
    <Animated.View
      accessible
      accessibilityLabel={`${index + 1}. ${song.title}, ${song.artist}`}
      accessibilityActions={[
        ...(index > 0 ? [{ name: 'up', label: 'Yukarı taşı' }] : []),
        ...(index < count - 1 ? [{ name: 'down', label: 'Aşağı taşı' }] : []),
        { name: 'remove', label: 'Listeden çıkar' },
      ]}
      onAccessibilityAction={(e) => {
        const a = e.nativeEvent.actionName;
        if (a === 'up') onMove(index, index - 1);
        else if (a === 'down') onMove(index, index + 1);
        else onRemove(index);
      }}
      style={[{ height: ROW, flexDirection: 'row', alignItems: 'center', gap: t.space[2], backgroundColor: t.c.surface.raised, borderRadius: t.radius.md }, style]}
    >
      <IconButton icon={CircleMinus} label={`Listeden çıkar: ${song.title}`} color={t.c.feedback.danger.text} size={t.size.icon.md} onPress={() => onRemove(index)} />
      <Cover uri={song.cover_url} size={t.size.artwork.xs} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T variant="labelMd" numberOfLines={1}>
          {song.title}
        </T>
        <T variant="bodySm" tone="secondary" numberOfLines={1}>
          {song.artist}
        </T>
      </View>
      <GestureDetector gesture={pan}>
        <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: 48, height: ROW, alignItems: 'center', justifyContent: 'center' }}>
          <GripVertical color={t.c.text.secondary} size={t.size.icon.md} />
        </View>
      </GestureDetector>
    </Animated.View>
  );
}
