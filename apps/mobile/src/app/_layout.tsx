// Kök düzen: yazı tipleri, ayarlar, oturum, veri önbelleği, tema. Oturum yoksa yalnızca giriş/kayıt açılır.

import { isPremium } from '@bekofy/core';
// Yalnızca kullanılan kalınlıklar: paket kökünden almak 18 Geist dosyasının hepsini uygulamaya katar.
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, ThemeProvider } from 'expo-router';
import { DarkTheme, DefaultTheme } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ToastView } from '@/components/toast-view';
import { refreshOffline, setDownloadAllowed } from '@/lib/offline';
import { player } from '@/lib/player';
import { SessionProvider, useSession } from '@/lib/session';
import { loadSettings } from '@/lib/settings';
import { useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();

// Geliştirme sürümü: "animasyonları kaldır" açıkken Reanimated'ın bilgilendirme kutusu ekranı kaplamasın (bu durum
// lib/motion'da zaten ele alınıyor). Yayın sürümünde LogBox yoktur.
LogBox.ignoreLogs(['[Reanimated] Reduced motion setting is enabled']);

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } });

function Root() {
  const t = useTheme();
  const { state } = useSession();
  const signedIn = state.status === 'signed-in';
  const userId = signedIn ? state.user.id : null;
  const premium = signedIn && isPremium(state.profile);

  useEffect(() => {
    player.setAccount(userId);
    if (!userId) queryClient.clear();
  }, [userId]);

  useEffect(() => {
    setDownloadAllowed(premium);
  }, [premium]);

  useEffect(() => {
    if (state.status !== 'loading') void SplashScreen.hideAsync();
  }, [state.status]);

  const navTheme = useMemo(() => {
    const base = t.mode === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, primary: t.c.accent.text, background: t.c.surface.page, card: t.c.surface.raised, text: t.c.text.primary, border: t.c.border.subtle, notification: t.c.accent.default },
    };
  }, [t]);

  if (state.status === 'loading') return null;

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={t.mode === 'dark' ? 'light' : 'dark'} />
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: t.c.surface.page }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.c.surface.page } }}>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(tabs)" />
            {/* Şimdi çalıyor kendi kayma ve sürükleyip kapatma animasyonunu yapar; altındaki ekran görünür kalır. */}
            <Stack.Screen name="now-playing" options={{ presentation: 'transparentModal', animation: 'none', contentStyle: { backgroundColor: 'transparent' } }} />
            <Stack.Screen name="wrapped" options={{ presentation: 'transparentModal', animation: 'fade' }} />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="login" />
            <Stack.Screen name="register" options={{ animation: 'slide_from_right' }} />
          </Stack.Protected>
        </Stack>
        <ToastView />
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}

export default function Layout() {
  const [fontsLoaded, fontError] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold, BricolageGrotesque_700Bold });
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    void Promise.all([loadSettings(), refreshOffline().catch(() => undefined)]).finally(() => setSettingsLoaded(true));
  }, []);

  if (!(fontsLoaded || fontError) || !settingsLoaded) return null;
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <Root />
      </SessionProvider>
    </QueryClientProvider>
  );
}
