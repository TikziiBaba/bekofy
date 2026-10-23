import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { anim, DURATION, EASE } from '@/lib/motion';
import { usePlayer } from '@/lib/player';
import { useToast } from '@/lib/toast';
import { useTheme } from '@/theme';
import { MINI_PLAYER_HEIGHT } from './screen';
import { T } from './ui';

/** Bildirim kutusu; alt çubuğun üstünden kayarak gelir. Metin showToast içinde ekran okuyucuya ayrıca okunur. */
export function ToastView() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const msg = useToast();
  const hasPlayer = usePlayer().current !== null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: t.space[4],
        right: t.space[4],
        bottom: insets.bottom + t.size.layout.tabBar + (hasPlayer ? MINI_PLAYER_HEIGHT : 0) + t.space[3],
        alignItems: 'center',
      }}
    >
      {msg ? (
        <Animated.View
          key={msg.id}
          entering={anim(FadeInDown.duration(DURATION.moderate).easing(EASE.emphasized))}
          exiting={anim(FadeOutDown.duration(DURATION.base).easing(EASE.exit))}
          style={{ backgroundColor: t.c.surface.inverse, borderRadius: t.radius.md, paddingHorizontal: t.space[4], paddingVertical: t.space[3] }}
        >
          <T variant="labelMd" tone="inverse">
            {msg.text}
          </T>
        </Animated.View>
      ) : null}
    </View>
  );
}
