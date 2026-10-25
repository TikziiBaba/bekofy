// Google girişi dönüşü: bekofy://auth/callback?code=... Android'de Custom Tab kapanınca bu adres Expo Router'a da
// gelir. Kod burada oturuma çevrilir, sonra ana sayfaya ya da girişe geçilir.

import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '@/lib/session';
import { useTheme } from '@/theme';

export default function AuthCallback() {
  const t = useTheme();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { state, completeGoogleSignIn } = useSession();
  const [done, setDone] = useState(!code);

  useEffect(() => {
    if (code) void completeGoogleSignIn(code).finally(() => setDone(true));
  }, [code, completeGoogleSignIn]);

  if (state.status === 'signed-in') return <Redirect href="/" />;
  if (done) return <Redirect href="/login" />;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.c.surface.page }}>
      <ActivityIndicator color={t.c.accent.text} accessibilityLabel="Giriş yapılıyor" />
    </View>
  );
}
