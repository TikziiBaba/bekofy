// Şimdi çalıyor: alttan kayarak açılır; açılırken kapak yerine oturur, başlık ve denetimler sırayla yükselir.
// Aşağı sürükleyince yüzey parmağı izleyip hafifçe küçülür; bırakınca, "Kapat"la ya da geri tuşuyla kayarak kapanır.
// Kapakta yana kaydırma önceki/sonraki şarkıya geçer; duraklatınca kapak küçülür. Sözler ve sıradakiler alt sayfada;
// sözlerde çalan satır yumuşakça parlar.

import { activeLineIndex, fetchLyrics, getSong, storedLyrics } from '@bekofy/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronDown, ListMusic, ListPlus, ListStart, MicVocal, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeInDown, interpolate, Keyframe, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { Cover } from '@/components/cover';
import { LikeButton } from '@/components/like-button';
import { Ambient } from '@/components/screen';
import { Seek } from '@/components/seek';
import { Sheet } from '@/components/sheet';
import { SongSheet } from '@/components/song-sheet';
import { SwipeRow } from '@/components/swipe-row';
import { Button, IconButton, PlayButton, T } from '@/components/ui';
import { anim, DURATION, EASE, haptic, SPRING, SPRING_SHEET } from '@/lib/motion';
import { holdOverlay } from '@/lib/overlay';
import { player, usePlayer, type Track } from '@/lib/player';
import { sb } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import { useTheme } from '@/theme';

const goBack = () => router.back();
const skip = (dir: 1 | -1) => {
  haptic.select();
  if (dir > 0) player.next();
  else player.previous();
};

/** Açılış sırası: kapak biraz küçükten yerine oturur, ardından başlık ve denetimler aşağıdan yükselir. */
const coverIn = () =>
  anim(
    new Keyframe({
      0: { opacity: 0, transform: [{ scale: 0.9 }] },
      100: { opacity: 1, transform: [{ scale: 1 }], easing: EASE.emphasized },
    })
      .delay(DURATION.fast)
      .duration(DURATION.slow),
  );
const riseIn = (step: number) =>
  anim(
    FadeInDown.delay(DURATION.base + step * 60)
      .duration(DURATION.slow)
      .easing(EASE.emphasized)
      .withInitialValues({ opacity: 0, transform: [{ translateY: 24 }] }),
  );

export default function NowPlaying() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const p = usePlayer();
  const cur = p.current;
  const [panel, setPanel] = useState<'lyrics' | 'queue' | null>(null);
  // Kapak: genişliğe ve kalan yüksekliğe sığar (denetimler, başlık ve ilerleme çubuğu için ~470dp ayrılır).
  const art = Math.max(160, Math.min(width - t.space[6] * 2, t.size.artwork['2xl'], height - insets.top - insets.bottom - 470));

  const y = useSharedValue(height);
  const x = useSharedValue(0);
  const shrink = useSharedValue(p.isPlaying ? 1 : 0.88);

  useEffect(() => {
    y.value = withTiming(0, { duration: DURATION.slow, easing: EASE.emphasized });
  }, [y]);

  useEffect(() => holdOverlay(), []);

  useEffect(() => {
    shrink.value = withSpring(p.isPlaying ? 1 : 0.88, SPRING_SHEET);
  }, [p.isPlaying, shrink]);

  const close = useCallback(() => {
    y.value = withTiming(height, { duration: DURATION.moderate, easing: EASE.exit }, (done) => {
      'worklet';
      if (done) scheduleOnRN(goBack);
    });
  }, [height, y]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  const dismiss = usePanGesture({
    activeOffsetY: 10,
    failOffsetX: [-24, 24],
    onUpdate: (e) => {
      'worklet';
      y.value = e.translationY > 0 ? e.translationY : e.translationY * 0.1;
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > height * 0.18 || e.velocityY > 900) {
        y.value = withTiming(height, { duration: DURATION.base, easing: EASE.exit }, (done) => {
          'worklet';
          if (done) scheduleOnRN(goBack);
        });
      } else y.value = withSpring(0, SPRING_SHEET);
    },
  });

  const swipe = usePanGesture({
    activeOffsetX: [-14, 14],
    failOffsetY: [-14, 14],
    onUpdate: (e) => {
      'worklet';
      x.value = e.translationX;
    },
    onDeactivate: (e) => {
      'worklet';
      const dir = e.translationX < -80 || e.velocityX < -700 ? 1 : e.translationX > 80 || e.velocityX > 700 ? -1 : 0;
      if (!dir) {
        x.value = withSpring(0, SPRING);
        return;
      }
      x.value = withTiming(-dir * width, { duration: DURATION.base, easing: EASE.exit }, () => {
        'worklet';
        x.value = dir * width * 0.5;
        x.value = withSpring(0, SPRING_SHEET);
      });
      scheduleOnRN(skip, dir as 1 | -1);
    },
  });

  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { scale: interpolate(y.value, [0, height * 0.6], [1, 0.94], 'clamp') }] }));
  const scrim = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, height], [1, 0], 'clamp') }));
  const coverStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { scale: shrink.value * interpolate(Math.abs(x.value), [0, width], [1, 0.9], 'clamp') }],
    opacity: interpolate(Math.abs(x.value), [0, width], [1, 0.3], 'clamp'),
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.c.scrim }, scrim]} />
      <GestureDetector gesture={dismiss}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.c.surface.page, overflow: 'hidden', borderTopLeftRadius: t.radius.sheet, borderTopRightRadius: t.radius.sheet }, sheet]}>
          <Ambient strong />
          <View style={{ flex: 1, paddingTop: insets.top + t.space[1], paddingBottom: insets.bottom + t.space[4], paddingHorizontal: t.space[6], justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -t.space[3] }}>
              <IconButton icon={ChevronDown} label="Kapat" color={t.c.text.primary} onPress={close} />
              <T variant="labelMd" tone="secondary" accessibilityRole="header">
                Şimdi çalıyor
              </T>
              <View style={{ width: 48 }} />
            </View>

            {cur ? (
              <>
                <Animated.View entering={coverIn()} style={{ alignSelf: 'center' }}>
                  <GestureDetector gesture={swipe}>
                    <Animated.View
                      accessible
                      accessibilityRole="image"
                      accessibilityLabel={`${cur.title} kapağı`}
                      accessibilityHint="Sonraki ya da önceki şarkı için yana kaydır"
                      accessibilityActions={[{ name: 'increment', label: 'Sonraki şarkı' }, { name: 'decrement', label: 'Önceki şarkı' }]}
                      onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'increment' ? player.next() : player.previous())}
                      style={coverStyle}
                    >
                      <Animated.View key={cur.id} entering={anim(FadeIn.duration(DURATION.moderate).easing(EASE.standard))}>
                        <Cover uri={cur.cover_url} size={art} shadow={t.shadow.lg} />
                      </Animated.View>
                    </Animated.View>
                  </GestureDetector>
                </Animated.View>

                <View style={{ gap: t.space[4] }}>
                  <Animated.View entering={riseIn(0)} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3] }}>
                    <Animated.View key={cur.id} entering={anim(FadeIn.duration(DURATION.moderate))} style={{ flex: 1, minWidth: 0 }}>
                      <T variant="titleLg" numberOfLines={2}>
                        {cur.title}
                      </T>
                      <T variant="bodyLg" tone="secondary" numberOfLines={1}>
                        {cur.artist}
                      </T>
                    </Animated.View>
                    <LikeButton songId={cur.id} title={cur.title} size={t.size.icon.md} />
                  </Animated.View>
                  <Animated.View entering={riseIn(1)}>
                    <Seek />
                  </Animated.View>
                  <Animated.View entering={riseIn(2)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <IconButton icon={Shuffle} label="Karışık çal" active={p.shuffle} onPress={() => player.toggleShuffle()} />
                    <IconButton icon={SkipBack} label="Önceki" color={t.c.text.primary} filled size={t.size.icon.lg} onPress={() => skip(-1)} />
                    <PlayButton size={t.size.control.xl + t.space[2]} playing={p.isPlaying} label={cur.title} onPress={() => player.toggle()} />
                    <IconButton icon={SkipForward} label="Sonraki" color={t.c.text.primary} filled size={t.size.icon.lg} onPress={() => skip(1)} />
                    <IconButton
                      icon={p.repeat === 'one' ? Repeat1 : Repeat}
                      label={p.repeat === 'one' ? 'Tekrar: bu şarkı' : p.repeat === 'all' ? 'Tekrar: tüm liste' : 'Tekrar: kapalı'}
                      active={p.repeat !== 'off'}
                      onPress={() => player.cycleRepeat()}
                    />
                  </Animated.View>
                  <Animated.View entering={riseIn(3)} style={{ flexDirection: 'row', gap: t.space[2] }}>
                    <Button variant="secondary" icon={MicVocal} label="Sözler" onPress={() => setPanel('lyrics')} style={{ flex: 1 }} />
                    <Button variant="secondary" icon={ListMusic} label="Sıradaki" onPress={() => setPanel('queue')} style={{ flex: 1 }} />
                  </Animated.View>
                </View>
              </>
            ) : (
              <T tone="secondary">Şu an bir şey çalmıyor.</T>
            )}
          </View>
        </Animated.View>
      </GestureDetector>

      <Sheet open={panel !== null} onClose={() => setPanel(null)} title={panel === 'lyrics' ? 'Sözler' : 'Sıradaki'}>
        {cur && panel === 'lyrics' ? <Lyrics songId={cur.id} /> : <Queue />}
      </Sheet>
    </View>
  );
}

function Lyrics({ songId }: { songId: string }) {
  const t = useTheme();
  const p = usePlayer();
  const box = useRef<ScrollViewInstance>(null);
  const lines = useRef<Record<number, number>>({});
  const q = useQuery({
    queryKey: ['lyrics', songId],
    staleTime: Infinity,
    queryFn: async () => {
      const song = await getSong(sb, songId);
      return storedLyrics(song) ?? (await fetchLyrics(song));
    },
  });
  const synced = q.data?.synced ?? null;
  const active = synced ? activeLineIndex(synced, p.position + 0.2) : -1;
  const lit = useSharedValue(active);

  // Etkin satırı kutunun üçte birine getir; yalnızca söz kutusu kayar.
  useEffect(() => {
    lit.value = active;
    const at = lines.current[active];
    if (at !== undefined) box.current?.scrollTo({ y: Math.max(0, at - 140), animated: true });
  }, [active, lit]);

  if (q.isLoading) return <T tone="secondary" style={{ padding: t.space[3] }}>Sözler aranıyor</T>;
  if (!q.data) return <T tone="secondary" style={{ padding: t.space[3] }}>Bu şarkının sözleri bulunamadı.</T>;

  return (
    <ScrollView ref={box} style={{ height: 420 }} contentContainerStyle={{ padding: t.space[3], gap: t.space[3], paddingBottom: t.space[24] }}>
      {synced ? (
        synced.map((line, i) => (
          <Pressable
            key={`${line.time}-${i}`}
            accessibilityRole="button"
            accessibilityHint="Şarkıyı bu satıra sarar"
            accessibilityState={{ selected: i === active }}
            onLayout={(e) => {
              lines.current[i] = e.nativeEvent.layout.y;
            }}
            onPress={() => player.seek(line.time)}
          >
            <LyricLine index={i} lit={lit} text={line.text || '...'} />
          </Pressable>
        ))
      ) : (
        <T variant="bodyLg" selectable>
          {q.data.plain}
        </T>
      )}
    </ScrollView>
  );
}

/** Söz satırı: çalan satır renk ve boyutça yumuşak bir geçişle öne çıkar, geçenler geri çekilir. */
function LyricLine({ index, lit, text }: { index: number; lit: SharedValue<number>; text: string }) {
  const t = useTheme();
  const primary = t.c.text.primary;
  const tertiary = t.c.text.tertiary;
  const style = useAnimatedStyle(() => {
    const on = lit.value === index;
    const timing = { duration: DURATION.moderate, easing: EASE.standard };
    return { color: withTiming(on ? primary : tertiary, timing), transform: [{ scale: withTiming(on ? 1 : 0.96, timing) }] };
  });
  return <Animated.Text style={[t.type.titleMd, { transformOrigin: 'left center' }, style]}>{text}</Animated.Text>;
}

function Queue() {
  const t = useTheme();
  const p = usePlayer();
  const [adding, setAdding] = useState<Track | null>(null);
  const next = p.items.slice(p.index + 1);
  if (!next.length) return <T tone="secondary" style={{ padding: t.space[3] }}>Sırada şarkı yok. Bir şarkıyı sağa çekerek ya da seçeneklerinden sıraya ekleyebilirsin.</T>;
  return (
    <ScrollView style={{ maxHeight: 420 }}>
      <T variant="bodySm" tone="secondary" style={{ paddingHorizontal: t.space[3], paddingBottom: t.space[2] }}>
        Sağa çek: hemen sıradaki olsun. Sola çek: listeye ekle.
      </T>
      {next.map((s, n) => {
        const at = p.index + 1 + n;
        const toNext = () => {
          player.moveToNext(at);
          showToast(`${s.title} sıradaki oldu`);
        };
        return (
          <SwipeRow key={`${s.id}-${at}`} left={n > 0 ? { icon: ListStart, label: 'Hemen sıradaki olsun', run: toNext } : undefined} right={{ icon: ListPlus, label: 'Çalma listesine ekle', run: () => setAdding(s) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3], minHeight: t.size.control.xl, paddingLeft: t.space[3] }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${s.title}, ${s.artist}`}
                accessibilityHint="Bu şarkıya geçer"
                accessibilityActions={[...(n > 0 ? [{ name: 'toNext', label: 'Hemen sıradaki olsun' }] : []), { name: 'addToPlaylist', label: 'Çalma listesine ekle' }]}
                onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'toNext' ? toNext() : setAdding(s))}
                onPress={() => player.skipTo(at)}
                android_ripple={{ color: t.c.state.pressed }}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.space[3] }}
              >
                <Cover uri={s.cover_url} size={t.size.artwork.xs} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T variant="labelMd" numberOfLines={1}>
                    {s.title}
                  </T>
                  <T variant="bodySm" tone="secondary" numberOfLines={1}>
                    {s.artist}
                  </T>
                </View>
              </Pressable>
              <IconButton icon={X} label={`Sıradan çıkar: ${s.title}`} size={t.size.icon.sm} onPress={() => player.removeAt(at)} />
            </View>
          </SwipeRow>
        );
      })}
      <SongSheet track={adding} mode="playlist" onClose={() => setAdding(null)} />
    </ScrollView>
  );
}
