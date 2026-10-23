// Dokunulabilir yüzey: basılıyken hafifçe küçülür, bırakınca yayla yerine oturur. Pressable'ın yerine geçer;
// stil yalnızca nesne olarak verilir (basılı durum ölçekle gösterilir).

import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { DURATION, EASE, SPRING } from '@/lib/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Tappable({ scaleTo = 0.96, style, onPressIn, onPressOut, ...props }: Omit<PressableProps, 'style'> & { scaleTo?: number; style?: StyleProp<ViewStyle> }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...props}
      onPressIn={(e) => {
        scale.value = withTiming(scaleTo, { duration: DURATION.fast, easing: EASE.standard });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, SPRING);
        onPressOut?.(e);
      }}
      style={[style, animated]}
    />
  );
}
