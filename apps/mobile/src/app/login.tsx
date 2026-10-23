import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, type TextInputInstance, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field } from '@/components/field';
import { Logo } from '@/components/logo';
import { Ambient } from '@/components/screen';
import { Button, Notice, T } from '@/components/ui';
import { useSession } from '@/lib/session';
import { useTheme } from '@/theme';

export default function Login() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { state, signIn, signInWithGoogle } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const notice = state.status === 'signed-out' ? state.notice : null;

  async function submit() {
    const next = {
      email: email.trim() ? undefined : 'E-posta gerekli.',
      password: password ? undefined : 'Şifre gerekli.',
    };
    setErrors(next);
    setError(null);
    if (next.email || next.password) return;
    setBusy('email');
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Giriş yapılamadı. Tekrar dene.');
    } finally {
      setBusy(null);
    }
  }

  async function google() {
    setError(null);
    setBusy('google');
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google ile giriş yapılamadı.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: t.c.surface.page }}>
      <Ambient />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: t.space[8], paddingTop: insets.top + t.space[8], paddingBottom: insets.bottom + t.space[8], paddingHorizontal: t.space[6] }}>
        <View style={{ gap: t.space[4] }}>
          <Logo />
          <T variant="displayLg" accessibilityRole="header">
            Giriş yap
          </T>
          <T tone="secondary">Müziğin, listelerin ve arkadaşların seni bekliyor.</T>
        </View>
        {notice ? <Notice tone="warning">{notice}</Notice> : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <View style={{ gap: t.space[5] }}>
          <Field
            label="E-posta"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <Field
            ref={passwordRef}
            label="Şifre"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />
          <Button label="Şifremi unuttum" variant="ghost" onPress={() => void WebBrowser.openBrowserAsync('https://bekofy.bekirr.dev/forgot-password')} style={{ marginTop: -t.space[3], marginLeft: -t.space[5] }} />
          <Button label="Giriş yap" loading={busy === 'email'} disabled={busy !== null} onPress={() => void submit()} style={{ alignSelf: 'stretch' }} />
          <Button label="Google ile devam et" variant="secondary" loading={busy === 'google'} disabled={busy !== null} onPress={() => void google()} style={{ alignSelf: 'stretch' }} />
        </View>
        <View style={{ gap: t.space[2], alignItems: 'center' }}>
          <T tone="secondary">Hesabın yok mu?</T>
          <Button label="Kayıt ol" variant="ghost" onPress={() => router.push('/register')} style={{ alignSelf: 'center' }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
