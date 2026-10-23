import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { T } from './ui';

/** Profil görseli; yoksa adın baş harfi. Süs: ad yanında yazılıdır. */
export function Avatar({ uri, name, size }: { uri?: string | null; name?: string | null; size?: number }) {
  const t = useTheme();
  const s = size ?? t.size.control.md;
  const [failed, setFailed] = useState(false);
  if (uri && !failed) {
    return <Image source={{ uri }} accessible={false} contentFit="cover" cachePolicy="memory-disk" onError={() => setFailed(true)} style={{ width: s, height: s, borderRadius: s / 2 }} />;
  }
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: s, height: s, borderRadius: s / 2, backgroundColor: t.c.fill.muted, alignItems: 'center', justifyContent: 'center' }}>
      <T variant={s >= t.size.artwork.md ? 'titleLg' : 'labelMd'}>{(name ?? '?').slice(0, 1).toLocaleUpperCase('tr')}</T>
    </View>
  );
}
