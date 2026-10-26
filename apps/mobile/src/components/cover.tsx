import { Image } from 'expo-image';
import { useState } from 'react';
import { View, type BoxShadowValue, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

/** Kapak; yoksa ya da yüklenemezse iki token renginden desen. Süs: ad yanında yazılıdır. shadow: yüzen kapak (kart, başlık). */
export function Cover({ uri, size, round = false, style, shadow }: { uri?: string | null; size: number; round?: boolean; style?: StyleProp<ViewStyle>; shadow?: BoxShadowValue[] }) {
  const t = useTheme();
  const [failed, setFailed] = useState(false);
  const radius = round ? size / 2 : size >= 160 ? t.radius.artwork.lg : size >= 64 ? t.radius.artwork.md : t.radius.artwork.sm;
  const art =
    !uri || failed ? (
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={[{ width: size, height: size, borderRadius: radius, overflow: 'hidden', backgroundColor: t.c.ambient[1] }, style]}>
        <View style={{ position: 'absolute', left: -size * 0.02, bottom: -size * 0.02, width: size * 0.62, height: size * 0.62, borderRadius: size, backgroundColor: t.c.accent.default }} />
      </View>
    ) : (
      <Image
        source={{ uri }}
        accessible={false}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
        onError={() => setFailed(true)}
        style={[{ width: size, height: size, borderRadius: radius }, style as StyleProp<ImageStyle>]}
      />
    );
  return shadow ? <View style={{ borderRadius: radius, boxShadow: shadow }}>{art}</View> : art;
}
