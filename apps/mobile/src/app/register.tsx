import { MIN_PASSWORD_LENGTH, normalizeUsername, USERNAME_MESSAGES, USERNAME_RULE } from '@bekofy/core';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, type TextInputInstance, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field } from '@/components/field';
import { Ambient } from '@/components/screen';
import { Button, IconButton, Notice, T } from '@/components/ui';
import { useSession } from '@/lib/session';
import { useTheme } from '@/theme';

export default function Register() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { signUp } = useSession();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ username?: string; email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  async function submit() {
    const name = normalizeUsername(username);
    const next = {
      username: USERNAME_RULE.test(name) ? undefined : USERNAME_MESSAGES.format,
      email: /^\S+@\S+\.\S+$/.test(email.trim()) ? undefined : 'Geçerli bir e-posta yaz. Örnek: ad@ornek.com',
      password: password.length >= MIN_PASSWORD_LENGTH ? undefined : `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı. Harf ve rakam karıştır.`,
    };
    setErrors(next);
    setError(null);
    if (next.username || next.email || next.password) return;
    setBusy(true);
    try {
      const res = await signUp({ username: name, email: email.trim(), password });
      if (res.needsConfirmation) setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kayıt olunamadı. Tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: t.c.surface.page }}>
      <Ambient />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, gap: t.space[8], paddingTop: insets.top + t.space[2], paddingBottom: insets.bottom + t.space[8], paddingHorizontal: t.space[6] }}>
        <IconButton icon={ChevronLeft} label="Geri" color={t.c.text.primary} onPress={() => router.back()} style={{ marginLeft: -t.space[3] }} />
        <View style={{ gap: t.space[3] }}>
          <T variant="displayLg" accessibilityRole="header">
            Kayıt ol
          </T>
          <T tone="secondary">Ücretsiz hesap aç; şarkıları dinle, listeler kur, arkadaşlarınla Jam yap.</T>
        </View>
        {sent ? (
          <Notice tone="success" title="E-postanı kontrol et">
            {`${email.trim()} adresine bir doğrulama bağlantısı gönderdik. Bağlantıya dokunduktan sonra buradan giriş yap.`}
          </Notice>
        ) : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <View style={{ gap: t.space[5] }}>
          <Field
            label="Kullanıcı adı"
            hint="3-24 karakter: küçük harf, rakam, nokta ya da alt çizgi."
            value={username}
            onChangeText={setUsername}
            error={errors.username}
            autoCapitalize="none"
            autoComplete="username-new"
            autoCorrect={false}
            maxLength={24}
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
          />
          <Field
            ref={emailRef}
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
            hint="En az 8 karakter. Harf ve rakam karıştır."
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />
          <Button label="Hesap oluştur" loading={busy} onPress={() => void submit()} style={{ alignSelf: 'stretch' }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
