// Her sekmenin kendi yığını; liste, sanatçı, albüm gibi sayfalar hangi sekmeden açılırsa onun içinde açılır.

import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

export const unstable_settings = {
  index: { anchor: 'index' },
  search: { anchor: 'search' },
  library: { anchor: 'library' },
};

export default function Layout({ segment }: { segment: string }) {
  const t = useTheme();
  const screen = segment.match(/\((.*)\)/)?.[1] ?? 'index';
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: t.c.surface.page } }}>
      <Stack.Screen name={screen} />
      <Stack.Screen name="playlist/[id]/edit" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
