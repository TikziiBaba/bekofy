import { Tabs } from 'expo-router/tabs';
import { View } from 'react-native';
import { TabBar } from '@/components/tab-bar';
import { TAB_TRANSITION } from '@/lib/motion';
import { useOverlayOpen } from '@/lib/overlay';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const t = useTheme();
  const covered = useOverlayOpen();
  return (
    <View style={{ flex: 1 }} importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}>
      {/* Sekme değişince yeni ekran seçilen yönden hafifçe kayarak belirir. */}
      <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, animation: 'shift', transitionSpec: TAB_TRANSITION, sceneStyle: { backgroundColor: t.c.surface.page } }}>
        <Tabs.Screen name="(index)" />
        <Tabs.Screen name="(search)" />
        <Tabs.Screen name="(library)" />
      </Tabs>
    </View>
  );
}
