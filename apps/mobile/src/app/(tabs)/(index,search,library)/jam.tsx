import { createJam, findJamByCode, formatJamCode, jamParticipants, joinJam } from '@bekofy/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Share2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Alert, Share, type TextInputInstance, View } from 'react-native';
import { Avatar } from '@/components/avatar';
import { PageTitle } from '@/components/blocks';
import { Field } from '@/components/field';
import { Screen, Section } from '@/components/screen';
import { Button, IconButton, Notice, T } from '@/components/ui';
import { enterJam, exitJam, useJam } from '@/lib/jam';
import { usePlayer } from '@/lib/player';
import { routes } from '@/lib/routes';
import { useAuthed } from '@/lib/session';
import { sb } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import { useTheme } from '@/theme';

export default function Jam() {
  const t = useTheme();
  const { user } = useAuthed();
  const jam = useJam();
  const p = usePlayer();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const codeRef = useRef<TextInputInstance>(null);
  const participants = useQuery({
    queryKey: ['jam-people', jam.session?.id],
    enabled: Boolean(jam.session),
    queryFn: () => jamParticipants(sb, jam.session!.id),
    refetchInterval: 10_000,
  });

  async function start() {
    setBusy('create');
    setError(null);
    try {
      await enterJam(user.id, await createJam(sb, user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Jam başlatılamadı.');
    } finally {
      setBusy(null);
    }
  }

  async function join() {
    setCodeError(null);
    setError(null);
    setBusy('join');
    try {
      const session = await findJamByCode(sb, code);
      if (!session) {
        setCodeError('Bu kodla bir Jam bulunamadı. Kodu kontrol et: 6 karakter, örnek ABC-234.');
        codeRef.current?.focus();
        return;
      }
      await joinJam(sb, session.id, user.id);
      await enterJam(user.id, session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Jam'e katılınamadı.");
    } finally {
      setBusy(null);
    }
  }

  if (!jam.session) {
    return (
      <Screen back>
        <PageTitle>Jam</PageTitle>
        <T tone="secondary" style={{ marginTop: -t.space[4] }}>
          Jam'de oturum sahibinin çaldığı şarkı herkeste aynı anda ilerler. Başlat ve kodu paylaş ya da bir arkadaşının koduyla katıl.
        </T>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Section title="Jam başlat">
          <T tone="secondary">Sen çalarsın, arkadaşların dinler.</T>
          <Button label="Jam başlat" loading={busy === 'create'} onPress={() => void start()} />
        </Section>
        <Section title="Koda katıl">
          <Field
            ref={codeRef}
            label="Jam kodu"
            hint="Örnek: ABC-234"
            error={codeError}
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            returnKeyType="go"
            onSubmitEditing={() => void join()}
          />
          <Button label="Katıl" variant="secondary" loading={busy === 'join'} onPress={() => void join()} />
        </Section>
      </Screen>
    );
  }

  const pretty = formatJamCode(jam.session.code);
  return (
    <Screen back>
      <PageTitle>Jam</PageTitle>
      <View style={{ gap: t.space[4], padding: t.space[5], borderRadius: t.radius.xl, backgroundColor: t.c.glass.panel.bg, borderColor: t.c.glass.edge, borderWidth: t.size.border.hairline }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.space[3] }}>
          <T variant="titleLg" accessibilityRole="header" style={{ flex: 1 }}>
            {jam.isHost ? 'Jam’in açık' : 'Jam’e katıldın'}
          </T>
          <T variant="labelSm" accessibilityLiveRegion="polite" tone={jam.connected ? 'accent' : 'secondary'}>
            {jam.connected ? 'Bağlı' : 'Bağlanıyor'}
          </T>
        </View>
        <T tone="secondary">{jam.isHost ? 'Arkadaşların bu kodla katılır. Ne çalarsan herkeste aynı anda çalar.' : 'Oturum sahibinin çaldığı şarkı sende de çalar.'}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[1], alignSelf: 'flex-start', paddingLeft: t.space[4], borderRadius: t.radius.full, backgroundColor: t.c.fill.subtle }}>
          <T variant="titleLg" accessibilityLabel={`Katılım kodu ${jam.session.code.split('').join(' ')}`} style={{ letterSpacing: 2 }}>
            {pretty}
          </T>
          <IconButton icon={Share2} label="Kodu paylaş" onPress={() => void Share.share({ message: `Bekofy'de Jam'ime katıl: ${pretty}` })} />
        </View>
        {p.current ? (
          <T variant="bodySm">{`Çalıyor: ${p.current.title} · ${p.current.artist}`}</T>
        ) : jam.isHost ? (
          <View style={{ gap: t.space[2] }}>
            <T variant="bodySm" tone="secondary">
              Bir şarkı çal; Jam'dekiler de duyar.
            </T>
            <Button label="Şarkı ara" variant="secondary" onPress={() => router.navigate(routes.search)} />
          </View>
        ) : (
          <T variant="bodySm" tone="secondary">
            Oturum sahibi henüz bir şey çalmıyor.
          </T>
        )}
      </View>

      <Section title="Katılımcılar">
        <View style={{ gap: t.space[3] }}>
          {participants.data?.map((u) => (
            <View key={u.id} accessible style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3] }}>
              <Avatar uri={u.avatar_url} name={u.username} />
              <View>
                <T variant="labelMd">{u.username ?? 'adsız'}</T>
                {u.id === jam.session?.host_id ? (
                  <T variant="caption" tone="secondary">
                    Oturum sahibi
                  </T>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </Section>

      <Button
        variant={jam.isHost ? 'destructive' : 'secondary'}
        label={jam.isHost ? "Jam'i bitir" : "Jam'den ayrıl"}
        onPress={() =>
          Alert.alert(jam.isHost ? 'Jam bitirilsin mi?' : "Jam'den ayrılmak istiyor musun?", jam.isHost ? 'Herkesin bağlantısı kesilir ve kod geçersiz olur.' : 'Müzik sende çalmaya devam eder ama artık eşitlenmez.', [
            { text: 'Vazgeç', style: 'cancel' },
            { text: jam.isHost ? "Jam'i bitir" : 'Ayrıl', style: jam.isHost ? 'destructive' : 'default', onPress: () => void exitJam() },
          ])
        }
      />
    </Screen>
  );
}
