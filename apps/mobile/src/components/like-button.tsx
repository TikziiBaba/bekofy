import { Heart } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useLikedIds, useToggleLike } from '@/lib/data';
import { DURATION, EASE, haptic, SPRING } from '@/lib/motion';
import { useTheme } from '@/theme';
import { Tappable } from './tappable';

/** Beğen: beğenince kalp kısa bir sıçrama yapar ve hafif titreşir. */
export function LikeButton({ songId, title, size }: { songId: string; title: string; size?: number }) {
  const t = useTheme();
  const liked = useLikedIds().data?.has(songId) ?? false;
  const toggle = useToggleLike();
  const pop = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const color = liked ? t.c.accent.text : t.c.text.secondary;

  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={liked ? `Beğenilenlerden çıkar: ${title}` : `Beğen: ${title}`}
      accessibilityState={{ selected: liked }}
      hitSlop={8}
      scaleTo={0.86}
      android_ripple={{ color: t.c.state.pressed, borderless: true, radius: 24 }}
      onPress={() => {
        if (!liked) {
          haptic.tap();
          pop.value = withSequence(withTiming(1.35, { duration: DURATION.fast, easing: EASE.enter }), withSpring(1, SPRING));
        }
        toggle.mutate({ songId, liked, title });
      }}
      style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View style={style}>
        <Heart color={color} fill={liked ? color : 'transparent'} size={size ?? t.size.icon.sm} />
      </Animated.View>
    </Tappable>
  );
}
