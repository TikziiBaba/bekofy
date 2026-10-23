// Ekran kabı: ortam ışığı (çalan şarkının kapağından, yumuşak geçişle), güvenli alan, kaydırma.
// Alt sayfalarda (back) üstte sabit bir çubuk durur: geri düğmesi her zaman görünür; sayfa başlığı ve çubuğun zemini
// kaydırınca belirir. Kaydırma konumu ScrollY bağlamıyla paylaşılır (koleksiyon başlığı kapağı buna göre küçültür).

import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCoverAmbient } from '@/lib/ambient';
import { DURATION, EASE } from '@/lib/motion';
import { useTheme } from '@/theme';
import { IconButton, T } from './ui';

export const MINI_PLAYER_HEIGHT = 64;
const BAR = 56;

type Colors = { 1: string; 2: string; 3: string };

/** Arka plan ışığı. Renk değişince yeni katman eskisinin üstünde belirir (token: duration.ambient). */
export function Ambient({ strong = false }: { strong?: boolean }) {
  const t = useTheme();
  const cover = useCoverAmbient(t.mode);
  const next: Colors = cover ?? t.c.ambient;
  const [layers, setLayers] = useState<{ back: Colors; front: Colors }>({ back: next, front: next });
  const fade = useSharedValue(1);

  useEffect(() => {
    setLayers((l) => (l.front[1] === next[1] && l.front[2] === next[2] ? l : { back: l.front, front: next }));
  }, [next[1], next[2], next[3]]);

  useEffect(() => {
    fade.value = 0;
    fade.value = withTiming(1, { duration: DURATION.ambient, easing: EASE.standard });
  }, [layers, fade]);

  const front = useAnimatedStyle(() => ({ opacity: fade.value }));
  const stops = (c: Colors) => [c[1], c[2], t.c.surface.page] as const;
  const locations = (strong ? [0, 0.5, 1] : [0, 0.35, 0.8]) as [number, number, number];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={stops(layers.back)} locations={locations} style={StyleSheet.absoluteFill} />
      <Animated.View style={[StyleSheet.absoluteFill, front]}>
        <LinearGradient colors={stops(layers.front)} locations={locations} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

const ScrollY = createContext<SharedValue<number> | null>(null);
/** Sayfanın kaydırma konumu (koleksiyon başlığı için). */
export const useScrollY = () => useContext(ScrollY);

export function Screen({
  children,
  onRefresh,
  refreshing = false,
  back = false,
  title,
  actions,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Üstte geri düğmeli çubuk. */
  back?: boolean;
  /** Kaydırınca çubukta beliren başlık. */
  title?: string;
  actions?: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  const barBg = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [80, 180], [0, 1], Extrapolation.CLAMP) }));
  const barTitle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [180, 240], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(y.value, [180, 240], [8, 0], Extrapolation.CLAMP) }],
  }));

  return (
    <ScrollY.Provider value={y}>
      <View style={{ flex: 1, backgroundColor: t.c.surface.page }}>
        <Ambient />
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: insets.top + (back ? BAR : t.space[4]),
            paddingHorizontal: t.space[4],
            paddingBottom: t.space[8],
            gap: t.space[8],
          }}
          refreshControl={
            onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} progressViewOffset={insets.top + BAR} tintColor={t.c.accent.text} colors={[t.c.accent.on]} progressBackgroundColor={t.c.accent.default} /> : undefined
          }
        >
          {children}
        </Animated.ScrollView>
        {back ? (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top, height: insets.top + BAR }}>
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.c.glass.chrome.solid, borderBottomColor: t.c.glass.hairline, borderBottomWidth: t.size.border.hairline }, barBg]} />
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: t.space[1] }}>
              <IconButton icon={ChevronLeft} label="Geri" color={t.c.text.primary} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
              <Animated.View style={[{ flex: 1, paddingHorizontal: t.space[1] }, barTitle]} importantForAccessibility="no-hide-descendants">
                {title ? (
                  <T variant="titleSm" numberOfLines={1}>
                    {title}
                  </T>
                ) : null}
              </Animated.View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>{actions}</View>
            </View>
          </View>
        ) : null}
      </View>
    </ScrollY.Provider>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T variant="titleMd" accessibilityRole="header">
          {title}
        </T>
        {action}
      </View>
      {children}
    </View>
  );
}
