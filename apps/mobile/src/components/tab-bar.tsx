// Alt çubuk: üstte mini oynatıcı (bir şey çalıyorsa), altta üç sekme.
// Mini oynatıcı: dokun ya da yukarı kaydır -> "Şimdi çalıyor"; yana kaydır -> önceki/sonraki şarkı.
// Etkin sekmenin simgesinin arkasında bir hap belirir (Material 3 etkin göstergesi). Sondaki "Oluştur" bir sekme
// değil: liste, ortak liste ve Jam oluşturma menüsünü açar.

import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { House, Library, Plus, Search, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { FadeIn, interpolate, SlideInDown, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { anim, DURATION, EASE, haptic, SPRING } from '@/lib/motion';
import { player, usePlayer } from '@/lib/player';
import { routes } from '@/lib/routes';
import { useTheme } from '@/theme';
import { Cover } from './cover';
import { CreateMenu } from './create-menu';
import { MINI_PLAYER_HEIGHT } from './screen';
import { PlayButton, T } from './ui';

const TABS: Record<string, [string, LucideIcon]> = {
  '(index)': ['Ana sayfa', House],
  '(search)': ['Ara', Search],
  '(library)': ['Kitaplık', Library],
};

const openNowPlaying = () => router.push(routes.nowPlaying);
const skip = (dir: 1 | -1) => {
  haptic.select();
  if (dir > 0) player.next();
  else player.previous();
};

function MiniPlayer() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const p = usePlayer();
  const cur = p.current;
  const x = useSharedValue(0);
  const axis = useSharedValue<0 | 1 | 2>(0); // 0 belirsiz, 1 yatay, 2 dikey
  const lift = useSharedValue(0);

  const pan = usePanGesture({
    activeOffsetX: [-12, 12],
    activeOffsetY: [-12, 12],
    onBegin: () => {
      'worklet';
      axis.value = 0;
    },
    onUpdate: (e) => {
      'worklet';
      if (axis.value === 0) axis.value = Math.abs(e.translationX) > Math.abs(e.translationY) ? 1 : 2;
      if (axis.value === 1) x.value = e.translationX;
      else lift.value = Math.min(0, e.translationY);
    },
    onDeactivate: (e) => {
      'worklet';
      if (axis.value === 1) {
        const dir = e.translationX < -70 || e.velocityX < -700 ? 1 : e.translationX > 70 || e.velocityX > 700 ? -1 : 0;
        if (dir) {
          x.value = withTiming(-dir * width * 0.6, { duration: DURATION.base, easing: EASE.exit }, () => {
            'worklet';
            x.value = dir * 60;
            x.value = withSpring(0, SPRING);
          });
          scheduleOnRN(skip, dir as 1 | -1);
        } else x.value = withSpring(0, SPRING);
      } else {
        if (e.translationY < -40 || e.velocityY < -600) scheduleOnRN(openNowPlaying);
        lift.value = withSpring(0, SPRING);
      }
    },
  });

  const content = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    opacity: interpolate(Math.abs(x.value), [0, width * 0.6], [1, 0], 'clamp'),
  }));
  const card = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value * 0.4 }] }));

  if (!cur) return null;
  const ratio = p.duration ? Math.min(1, p.position / p.duration) : 0;
  return (
    <Animated.View
      entering={anim(SlideInDown.duration(DURATION.slow).easing(EASE.emphasized))}
      style={[{ marginHorizontal: t.space[2], marginBottom: t.space[1], borderRadius: t.radius.lg, overflow: 'hidden', backgroundColor: t.c.surface.raised, borderColor: t.c.glass.edge, borderWidth: t.size.border.hairline }, card]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', height: MINI_PLAYER_HEIGHT - t.space[1], paddingRight: t.space[2] }}>
        <GestureDetector gesture={pan}>
          <Animated.View style={[{ flex: 1, height: '100%' }, content]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Şimdi çalıyor: ${cur.title}, ${cur.artist}`}
              accessibilityHint="Oynatıcıyı tam ekran açar"
              accessibilityActions={[{ name: 'magicTap' }, { name: 'next', label: 'Sonraki şarkı' }, { name: 'previous', label: 'Önceki şarkı' }]}
              onAccessibilityAction={(e) => {
                if (e.nativeEvent.actionName === 'next') player.next();
                else if (e.nativeEvent.actionName === 'previous') player.previous();
                else player.toggle();
              }}
              onPress={openNowPlaying}
              android_ripple={{ color: t.c.state.pressed }}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.space[3], paddingLeft: t.space[2] }}
            >
              <Animated.View key={cur.id} entering={anim(FadeIn.duration(DURATION.moderate))} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.space[3] }}>
                <Cover uri={cur.cover_url} size={t.size.artwork.xs} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T variant="labelMd" numberOfLines={1}>
                    {cur.title}
                  </T>
                  <T variant="bodySm" tone="secondary" numberOfLines={1}>
                    {cur.artist}
                  </T>
                </View>
              </Animated.View>
            </Pressable>
          </Animated.View>
        </GestureDetector>
        <PlayButton size={t.size.control.md} playing={p.isPlaying} label={cur.title} onPress={() => player.toggle()} />
      </View>
      {/* Genişlik yerine ölçek: yerleşim değişmez, her tikte erişilebilirlik olayı üretilmez. */}
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ height: 2, backgroundColor: t.c.fill.muted }}>
        <View style={{ width: '100%', height: '100%', backgroundColor: t.c.accent.default, transformOrigin: 'left', transform: [{ scaleX: ratio }] }} />
      </View>
    </Animated.View>
  );
}

function Tab({ label, icon: Icon, focused, onPress, role = 'tab' }: { label: string; icon: LucideIcon; focused: boolean; onPress: () => void; role?: 'tab' | 'button' }) {
  const t = useTheme();
  const on = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    on.value = withTiming(focused ? 1 : 0, { duration: DURATION.moderate, easing: EASE.emphasized });
  }, [focused, on]);
  const pill = useAnimatedStyle(() => ({ opacity: on.value, transform: [{ scaleX: interpolate(on.value, [0, 1], [0.5, 1]) }] }));
  const color = focused ? t.c.text.primary : t.c.text.secondary;
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === 'tab' ? { selected: focused } : undefined}
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.space[1] }}
    >
      <View style={{ width: 64, height: 32, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[{ position: 'absolute', inset: 0, borderRadius: t.radius.full, backgroundColor: t.c.fill.muted }, pill]} />
        <Icon color={color} size={t.size.icon.md} strokeWidth={focused ? 2.4 : 2} />
      </View>
      <T variant="labelSm" style={{ color }}>
        {label}
      </T>
    </Pressable>
  );
}

export function TabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [creating, setCreating] = useState(false);
  return (
    <View style={{ backgroundColor: t.c.glass.chrome.solid, borderTopColor: t.c.glass.hairline, borderTopWidth: t.size.border.hairline, paddingTop: t.space[2], paddingBottom: insets.bottom }}>
      <MiniPlayer />
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', height: t.size.layout.tabBar }}>
        {state.routes.map((route, index) => {
          const [label, icon] = TABS[route.name] ?? [descriptors[route.key]?.options.title ?? route.name, House];
          const focused = state.index === index;
          return (
            <Tab
              key={route.key}
              label={label}
              icon={icon}
              focused={focused}
              onPress={() => {
                const e = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused) haptic.select();
                if (!focused && !e.defaultPrevented) navigateToTab(route.key);
              }}
            />
          );
        })}
        <Tab
          label="Oluştur"
          icon={Plus}
          role="button"
          focused={creating}
          onPress={() => {
            haptic.select();
            setCreating(true);
          }}
        />
      </View>
      <CreateMenu open={creating} onClose={() => setCreating(false)} />
    </View>
  );
}
