// Alt sayfa: aşağıdan kayarak açılır, arka plan kararır. Kapatma: geri tuşu, arka plana dokunma ya da tutamaktan
// aşağı sürükleme. Ekran okuyucu yalnızca sayfayı görür. Açık prop'u false olunca önce kayarak kapanır, sonra kalkar.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { DURATION, EASE, SPRING_SHEET } from '@/lib/motion';
import { useTheme } from '@/theme';
import { Tappable } from './tappable';
import { T } from './ui';

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(open);
  const y = useSharedValue(2000);
  const height = useSharedValue(600);
  const entered = useRef(false);

  useEffect(() => {
    if (open) {
      entered.current = false;
      setVisible(true);
    } else if (visible) {
      y.value = withTiming(height.value, { duration: DURATION.base, easing: EASE.exit }, (done) => {
        'worklet';
        if (done) scheduleOnRN(setVisible, false);
      });
    }
    // visible bilerek dışarıda: yalnızca open değişince çalışır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** Kayarak kapan, sonra üst bileşene haber ver. */
  const dismiss = () => {
    y.value = withTiming(height.value, { duration: DURATION.base, easing: EASE.exit }, (done) => {
      'worklet';
      if (done) scheduleOnRN(onClose);
    });
  };

  const drag = usePanGesture({
    activeOffsetY: 8,
    failOffsetX: [-24, 24],
    onUpdate: (e) => {
      'worklet';
      y.value = Math.max(0, e.translationY);
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > height.value * 0.3 || e.velocityY > 900) {
        y.value = withTiming(height.value, { duration: DURATION.base, easing: EASE.exit }, (done) => {
          'worklet';
          if (done) scheduleOnRN(onClose);
        });
      } else y.value = withSpring(0, SPRING_SHEET);
    },
  });

  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const scrim = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, height.value], [1, 0], 'clamp') }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent navigationBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, scrim]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Kapat" onPress={dismiss} style={[StyleSheet.absoluteFill, { backgroundColor: t.c.scrim }]} />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          onLayout={(e) => {
            height.value = e.nativeEvent.layout.height;
            if (!entered.current && open) {
              entered.current = true;
              y.value = e.nativeEvent.layout.height;
              y.value = withTiming(0, { duration: DURATION.moderate, easing: EASE.emphasized });
            }
          }}
          style={[
            {
              backgroundColor: t.c.surface.raised,
              borderTopLeftRadius: t.radius.sheet,
              borderTopRightRadius: t.radius.sheet,
              borderColor: t.c.glass.edge,
              borderWidth: t.size.border.hairline,
              paddingHorizontal: t.space[2],
              paddingBottom: insets.bottom + t.space[4],
              maxHeight: '85%',
            },
            panel,
          ]}
        >
          <GestureDetector gesture={drag}>
            <View style={{ paddingTop: t.space[3] }}>
              <View accessible={false} style={{ alignSelf: 'center', width: t.space[10], height: t.space[1], borderRadius: t.radius.full, backgroundColor: t.c.border.strong, marginBottom: t.space[3] }} />
              {title ? (
                <T variant="titleSm" accessibilityRole="header" numberOfLines={2} style={{ paddingHorizontal: t.space[3], paddingBottom: t.space[2] }}>
                  {title}
                </T>
              ) : null}
            </View>
          </GestureDetector>
          {children}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** Alt sayfadaki bir seçenek satırı. */
export function SheetItem({ icon: Icon, label, onPress, tone = 'primary' }: { icon?: React.ComponentType<{ color: string; size: number }>; label: string; onPress: () => void; tone?: 'primary' | 'danger' }) {
  const t = useTheme();
  const color = tone === 'danger' ? t.c.feedback.danger.text : t.c.text.primary;
  return (
    <Tappable
      accessibilityRole="button"
      onPress={onPress}
      scaleTo={0.98}
      android_ripple={{ color: t.c.state.pressed }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[4], minHeight: t.size.control.lg + t.space[1], paddingHorizontal: t.space[3], borderRadius: t.radius.md, overflow: 'hidden' }}
    >
      {Icon ? <Icon color={color} size={t.size.icon.md} /> : null}
      <T style={{ color, flexShrink: 1 }} numberOfLines={1}>
        {label}
      </T>
    </Tappable>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, justifyContent: 'flex-end' } });
