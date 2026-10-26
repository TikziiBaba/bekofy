// Ekranların ortak yapı taşları: kart rafı, koleksiyon başlığı, boş durum, yükleniyor/hata.

import { formatTotalDuration } from '@bekofy/core';
import { router, type Href } from 'expo-router';
import { Play } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { cancelAnimation, Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { enter, EASE, haptic } from '@/lib/motion';
import { useTheme } from '@/theme';
import { Cover } from './cover';
import { useScrollY } from './screen';
import { Tappable } from './tappable';
import { Button, T } from './ui';

const CARD = 144;

/** Yatay kaydırılan kart rafı; kenardan kenara uzanır, bırakınca bir kartın başına yaslanır. */
export function Shelf({ label, children }: { label: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <ScrollView
      horizontal
      accessibilityLabel={label}
      showsHorizontalScrollIndicator={false}
      snapToInterval={CARD + t.space[3]}
      decelerationRate="fast"
      style={{ marginHorizontal: -t.space[4], marginVertical: -t.space[3] }}
      contentContainerStyle={{ paddingHorizontal: t.space[4], paddingVertical: t.space[3], gap: t.space[3] }}
    >
      {children}
    </ScrollView>
  );
}

/** Kapaklı kart; karta dokununca sayfası açılır, çal düğmesi ayrı. */
export function Card({ href, cover, title, sub, round = false, onPlay, index = 0 }: { href: Href; cover: string | null | undefined; title: string; sub: string; round?: boolean; onPlay?: () => void; index?: number }) {
  const t = useTheme();
  return (
    <Animated.View entering={enter(index)} style={{ width: CARD }}>
      <Tappable accessibilityRole="link" accessibilityLabel={`${title}, ${sub}`} onPress={() => router.push(href)} scaleTo={0.95} style={{ gap: t.space[2] }}>
        <Cover uri={cover} size={CARD} round={round} shadow={t.shadow.md} />
        <View>
          <T variant="labelMd" numberOfLines={1}>
            {title}
          </T>
          <T variant="bodySm" tone="secondary" numberOfLines={1}>
            {sub}
          </T>
        </View>
      </Tappable>
      {onPlay ? (
        <Tappable
          accessibilityRole="button"
          accessibilityLabel={`Çal: ${title}`}
          onPress={() => {
            haptic.tap();
            onPlay();
          }}
          hitSlop={4}
          scaleTo={0.86}
          style={{
            position: 'absolute',
            right: t.space[2],
            top: CARD - t.size.control.md - t.space[2],
            width: t.size.control.md,
            height: t.size.control.md,
            borderRadius: t.radius.full,
            backgroundColor: t.c.accent.default,
            boxShadow: t.shadow.md,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Play color={t.c.accent.on} fill={t.c.accent.on} size={t.size.icon.xs} style={{ marginLeft: 2 }} />
        </Tappable>
      ) : null}
    </Animated.View>
  );
}

/**
 * Çalma listesi, albüm, sanatçı, profil başlığı. Kaydırınca kapak yarım hızla geride kalır, küçülür ve solar;
 * başlığın bittiği yer ölçülüp ekrana bildirilir (adı tam o anda üst çubuğa geçer).
 */
export function CollectionHead({ kind, title, cover, round = false, meta, description, art }: { kind: string; title: string; cover?: string | null; round?: boolean; meta?: string; description?: string | null; art?: ReactNode }) {
  const t = useTheme();
  const s = useScrollY();
  const artStyle = useAnimatedStyle(() => {
    const v = s?.y.value ?? 0;
    return {
      opacity: interpolate(v, [0, 220], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: v > 0 ? v * 0.35 : v * 0.5 }, { scale: v > 0 ? interpolate(v, [0, 220], [1, 0.86], Extrapolation.CLAMP) : interpolate(v, [-160, 0], [1.12, 1], Extrapolation.CLAMP) }],
    };
  });
  return (
    <View
      onLayout={(e) => {
        if (s) s.revealAt.value = e.nativeEvent.layout.y + e.nativeEvent.layout.height - s.edge;
      }}
      style={{ gap: t.space[5] }}
    >
      <Animated.View style={[{ alignSelf: 'center' }, artStyle]}>{art ?? <Cover uri={cover} size={t.size.artwork.xl} round={round} shadow={t.shadow.lg} />}</Animated.View>
      <View style={{ gap: t.space[1], zIndex: 1 }}>
        <T variant="labelMd" tone="secondary">
          {kind}
        </T>
        <T variant={title.length > 12 ? 'titleXl' : 'displayLg'} accessibilityRole="header" numberOfLines={3}>
          {title}
        </T>
        {description ? (
          <T tone="secondary" numberOfLines={3}>
            {description}
          </T>
        ) : null}
        {meta ? (
          <T variant="bodySm" tone="secondary">
            {meta}
          </T>
        ) : null}
      </View>
    </View>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  const t = useTheme();
  return (
    <Animated.View entering={enter(0)} style={{ gap: t.space[3], padding: t.space[6], borderRadius: t.radius.xl, backgroundColor: t.c.glass.panel.bg, borderColor: t.c.glass.edge, borderWidth: t.size.border.hairline }}>
      <T variant="titleMd" accessibilityRole="header">
        {title}
      </T>
      {typeof children === 'string' ? <T tone="secondary">{children}</T> : children}
      {action}
    </Animated.View>
  );
}

/** Yükleniyor iskeleti: yavaşça nabız gibi atar (sistemde animasyon kapalıysa durur). */
function Skeleton({ label }: { label: string }) {
  const t = useTheme();
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.45, { duration: 800, easing: EASE.standard }), -1, true);
    return () => cancelAnimation(pulse);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`${label} yükleniyor`} style={{ gap: t.space[3] }}>
      {[0, 1, 2, 3].map((i) => (
        <Animated.View key={i} style={[{ flexDirection: 'row', alignItems: 'center', gap: t.space[3] }, style]}>
          <View style={{ width: t.size.artwork.sm, height: t.size.artwork.sm, borderRadius: t.radius.artwork.sm, backgroundColor: t.c.fill.muted }} />
          <View style={{ flex: 1, gap: t.space[2] }}>
            <View style={{ height: t.space[3], width: `${70 - i * 10}%`, borderRadius: t.radius.xs, backgroundColor: t.c.fill.muted }} />
            <View style={{ height: t.space[3], width: '40%', borderRadius: t.radius.xs, backgroundColor: t.c.fill.subtle }} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

/** Yükleniyor ve hata durumları; veri gelince çocuklar çizilir. */
export function Loadable<T>({ query, children, label }: { query: { data: T | undefined; isLoading: boolean; error: unknown; refetch: () => unknown }; children: (data: T) => ReactNode; label: string }) {
  if (query.isLoading) return <Skeleton label={label} />;
  if (query.error || query.data === undefined) {
    return (
      <Empty title={`${label} alınamadı`} action={<Button variant="secondary" label="Tekrar dene" onPress={() => void query.refetch()} />}>
        {query.error instanceof Error ? query.error.message : 'İnternet bağlantını kontrol edip tekrar dene.'}
      </Empty>
    );
  }
  return <>{children(query.data)}</>;
}

/** "12 şarkı, 48 dk". Süresi bilinmeyen eski kayıtlar varsa ve toplam bir dakikanın altındaysa süre yazılmaz. */
export function songCount(tracks: ReadonlyArray<{ duration: number | null }>): string {
  const total = tracks.reduce((s, t) => s + (t.duration ?? 0), 0);
  return total >= 60 ? `${tracks.length} şarkı, ${formatTotalDuration(total)}` : `${tracks.length} şarkı`;
}
