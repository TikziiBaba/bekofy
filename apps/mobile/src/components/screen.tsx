// Ekran kabı: ortam ışığı, güvenli alan, kaydırma ve üst çubuk.
// Üst çubuk her ekranda vardır ve kaydırdıkça belirir: önce durum çubuğunun arkası dolar (içerik saatin altına girmez),
// başlık çubuğun altına girerken zemin ve küçük başlık gelir. Büyük başlık kaydırınca solup hafifçe küçülür.
// Ortam ışığı içerikten yavaş kayar (paralaks) ve söner: ışık sayfanın başına aittir, listenin derinine değil.
// Yapışkan bölüm (arama kutusu, süzgeçler) çubuğun hemen altında durur. Kaydırma konumu ve başlığın çubuğa geçtiği
// eşik ScrollY bağlamıyla paylaşılır; koleksiyon başlığı eşiği kendi ölçüsünden bildirir.

import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedReaction, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useCoverAmbient } from '@/lib/ambient';
import { DURATION, EASE } from '@/lib/motion';
import { useTheme } from '@/theme';
import { IconButton, T } from './ui';

export const MINI_PLAYER_HEIGHT = 64;
const BAR = 56;
const CLAMP = Extrapolation.CLAMP;

export type Colors = { 1: string; 2: string; 3: string };

const clear = (hex: string) => `${hex.slice(0, 7)}00`;
/** Prototipteki ortam ışığı: sol üstte ve sağda iki yumuşak ışık, alta doğru sayfa rengine iner. */
const glow = (c: Colors, page: string, strong: boolean) =>
  [
    `radial-gradient(ellipse ${strong ? '150% 70%' : '130% 55%'} at 12% 0%, ${c[1]} 0%, ${clear(c[1])} 72%)`,
    `radial-gradient(ellipse ${strong ? '120% 60%' : '100% 45%'} at 100% 24%, ${c[2]} 0%, ${clear(c[2])} 72%)`,
    `linear-gradient(180deg, ${c[3]} 0%, ${page} ${strong ? '92%' : '62%'})`,
  ].join(', ');

/**
 * Arka plan ışığı. Renk değişince yeni katman eskisinin üstünde belirir (token: duration.ambient).
 * tint verilirse renk o kapaktan gelir; scrollY verilirse ışık içerikle yavaşça yukarı kayıp söner.
 */
export function Ambient({ strong = false, tint, scrollY }: { strong?: boolean; tint?: Colors | null; scrollY?: SharedValue<number> }) {
  const t = useTheme();
  const cover = useCoverAmbient(t.mode);
  const next: Colors = tint ?? cover ?? t.c.ambient;
  const [layers, setLayers] = useState<{ back: Colors; front: Colors }>({ back: next, front: next });
  const fade = useSharedValue(1);

  useEffect(() => {
    setLayers((l) => (l.front[1] === next[1] && l.front[2] === next[2] && l.front[3] === next[3] ? l : { back: l.front, front: next }));
  }, [next[1], next[2], next[3]]);

  useEffect(() => {
    fade.value = 0;
    fade.value = withTiming(1, { duration: DURATION.ambient, easing: EASE.standard });
  }, [layers, fade]);

  const front = useAnimatedStyle(() => ({ opacity: fade.value }));
  const drift = useAnimatedStyle(() => {
    const y = Math.max(0, scrollY?.value ?? 0);
    return { opacity: interpolate(y, [0, 520], [1, 0.4], CLAMP), transform: [{ translateY: -Math.min(y, 1200) * 0.4 }] };
  });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, drift]}>
      <View style={[StyleSheet.absoluteFill, { backgroundImage: glow(layers.back, t.c.surface.page, strong) }]} />
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundImage: glow(layers.front, t.c.surface.page, strong) }, front]} />
    </Animated.View>
  );
}

type Scroll = { y: SharedValue<number>; revealAt: SharedValue<number>; edge: number };
const ScrollY = createContext<Scroll | null>(null);
/** Sayfanın kaydırma konumu, başlığın çubuğa geçtiği eşik ve çubuğun alt kenarı (koleksiyon başlığı için). */
export const useScrollY = () => useContext(ScrollY);

export function Screen({
  children,
  onRefresh,
  refreshing = false,
  back = false,
  title,
  largeTitle,
  trailing,
  sticky,
  actions,
  tint,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Üstte geri düğmesi. */
  back?: boolean;
  /** Çubuktaki küçük başlık; yoksa büyük başlık kullanılır. */
  title?: string;
  /** Sayfanın büyük başlığı: kaydırınca solar, adı çubuğa geçer. */
  largeTitle?: string;
  /** Büyük başlığın yanındaki düğmeler. */
  trailing?: ReactNode;
  /** Çubuğun hemen altına yapışan bölüm. */
  sticky?: ReactNode;
  /** Çubuğun sağı; küçük başlıkla birlikte belirir (ör. çal düğmesi). */
  actions?: ReactNode;
  /** Ortam ışığı ve çubuk bu renklerle boyanır (koleksiyonun kendi kapağından). */
  tint?: Colors | null;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(0);
  const revealAt = useSharedValue(0);
  const stickyAt = useSharedValue(0);
  const [revealed, setRevealed] = useState(false);
  const edge = insets.top + (back ? BAR : 0);
  // Yapışkan bölümü olan sekme ekranlarında (Ara, Kitaplık) küçük başlıklı çubuk yok: bölüm doğrudan durum çubuğunun
  // altına yapışır; büyük başlık o ana kadar çoktan sönmüş olur, kutu ya da süzgeçler sayfayı zaten tanıtır.
  const compact = back || !sticky;
  const stickTop = insets.top + (compact ? BAR : 0);
  const barColor = tint ? tint[1] : t.c.glass.chrome.solid;
  const barText = title ?? largeTitle;

  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  useAnimatedReaction(
    () => y.value > Math.max(revealAt.value, 24) - 12,
    (now, before) => {
      if (now !== before) scheduleOnRN(setRevealed, now);
    },
  );

  const statusScrim = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, 16], [0, 1], CLAMP) }));
  const barBg = useAnimatedStyle(() => {
    const r = Math.max(revealAt.value, 24);
    return { opacity: interpolate(y.value, [r * 0.45, r], [0, 1], CLAMP) };
  });
  const barTitle = useAnimatedStyle(() => {
    const r = Math.max(revealAt.value, 24);
    return { opacity: interpolate(y.value, [r - 20, r + 8], [0, 1], CLAMP), transform: [{ translateY: interpolate(y.value, [r - 20, r + 8], [10, 0], CLAMP) }] };
  });
  const collapse = useAnimatedStyle(() => {
    const r = Math.max(revealAt.value, 24);
    return {
      // Durum çubuğunun altına varmadan sönmüş olur (yarı saydam başlık saatin altında görünmesin).
      opacity: interpolate(y.value, [0, r * 0.5], [1, 0], CLAMP),
      transform: [{ scale: interpolate(y.value, [-120, 0, r], [1.08, 1, 0.94], CLAMP) }],
    };
  });
  const stick = useAnimatedStyle(() => ({ transform: [{ translateY: Math.max(0, y.value + stickTop - stickyAt.value) }] }));
  const stickBg = useAnimatedStyle(() => ({ opacity: interpolate(y.value + stickTop - stickyAt.value, [-12, 0], [0, 1], CLAMP) }));

  return (
    <ScrollY.Provider value={{ y, revealAt, edge }}>
      <View style={{ flex: 1, backgroundColor: t.c.surface.page }}>
        <Ambient tint={tint} scrollY={y} />
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            paddingTop: insets.top + (back ? BAR : t.space[3]),
            paddingHorizontal: t.space[4],
            paddingBottom: t.space[12],
            gap: t.space[8],
          }}
          refreshControl={
            onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} progressViewOffset={insets.top + BAR} tintColor={t.c.accent.text} colors={[t.c.accent.on]} progressBackgroundColor={t.c.accent.default} /> : undefined
          }
        >
          {largeTitle ? (
            <Animated.View
              onLayout={(e) => {
                revealAt.value = e.nativeEvent.layout.y + e.nativeEvent.layout.height - edge;
              }}
              style={[{ flexDirection: 'row', alignItems: 'center', gap: t.space[3], transformOrigin: 'left center' }, collapse]}
            >
              <T variant="titleXl" accessibilityRole="header" numberOfLines={2} style={{ flex: 1 }}>
                {largeTitle}
              </T>
              {trailing}
            </Animated.View>
          ) : null}
          {sticky ? (
            <Animated.View
              onLayout={(e) => {
                stickyAt.value = e.nativeEvent.layout.y;
              }}
              style={[{ zIndex: 10, marginTop: -t.space[4], marginBottom: -t.space[2], paddingVertical: t.space[2] }, stick]}
            >
              <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, bottom: 0, left: -t.space[4], right: -t.space[4], backgroundColor: barColor, borderBottomColor: t.c.glass.hairline, borderBottomWidth: t.size.border.hairline }, stickBg]} />
              {sticky}
            </Animated.View>
          ) : null}
          {children}
        </Animated.ScrollView>

        <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + BAR }}>
          {compact ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: barColor, borderBottomColor: sticky ? 'transparent' : t.c.glass.hairline, borderBottomWidth: t.size.border.hairline }, barBg]} /> : null}
          {/* Durum çubuğunun arkası; çubuk henüz dolmamışken altından geçen içerik sert bir çizgiyle kesilmesin diye kısa bir geçişle biter. */}
          <Animated.View
            pointerEvents="none"
            style={[
              { position: 'absolute', top: 0, left: 0, right: 0 },
              compact
                ? { height: insets.top + t.space[6], backgroundImage: `linear-gradient(180deg, ${barColor} 0%, ${barColor} ${Math.round((insets.top / (insets.top + t.space[6])) * 100)}%, ${barColor}00 100%)` }
                : { height: insets.top, backgroundColor: barColor },
              statusScrim,
            ]}
          />
          <View pointerEvents="box-none" style={{ flex: 1, marginTop: insets.top, flexDirection: 'row', alignItems: 'center', paddingHorizontal: back ? t.space[1] : t.space[4], display: compact ? 'flex' : 'none' }}>
            {back ? <IconButton icon={ChevronLeft} label="Geri" color={t.c.text.primary} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} /> : null}
            <Animated.View pointerEvents="none" style={[{ flex: 1, paddingHorizontal: back ? t.space[1] : 0 }, barTitle]} importantForAccessibility="no-hide-descendants">
              {barText ? (
                <T variant="titleSm" numberOfLines={1}>
                  {barText}
                </T>
              ) : null}
            </Animated.View>
            {actions ? (
              <Animated.View pointerEvents={revealed ? 'box-none' : 'none'} importantForAccessibility={revealed ? 'auto' : 'no-hide-descendants'} style={[{ flexDirection: 'row', alignItems: 'center', paddingRight: t.space[2] }, barTitle]}>
                {actions}
              </Animated.View>
            ) : null}
          </View>
        </View>
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
