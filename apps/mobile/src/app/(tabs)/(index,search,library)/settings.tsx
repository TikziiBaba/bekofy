import { isAdmin, isPremium } from '@bekofy/core';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ExternalLink, LogOut, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react-native';
import { useSyncExternalStore, type ReactNode } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';
import { Avatar } from '@/components/avatar';
import { PageTitle } from '@/components/blocks';
import { Screen, Section } from '@/components/screen';
import { Button, T } from '@/components/ui';
import { useOffline } from '@/lib/offline';
import { useAuthed, useSession } from '@/lib/session';
import { getSetting, setSetting, subscribeSettings } from '@/lib/settings';
import { setThemeChoice, useTheme, type ThemeChoice } from '@/theme';

const SITE = 'https://bekofy.bekirr.dev';
const THEMES: Array<[ThemeChoice, string, LucideIcon]> = [
  ['dark', 'Koyu', Moon],
  ['light', 'Açık', Sun],
  ['system', 'Sisteme uy', Monitor],
];

function Panel({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <View style={{ borderRadius: t.radius.xl, backgroundColor: t.c.glass.panel.bg, borderColor: t.c.glass.edge, borderWidth: t.size.border.hairline, padding: t.space[1] }}>{children}</View>;
}

function Row({ title, description, control }: { title: string; description: string; control?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[4], paddingHorizontal: t.space[4], paddingVertical: t.space[3] }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T variant="labelMd">{title}</T>
        <T variant="bodySm" tone="secondary">
          {description}
        </T>
      </View>
      {control}
    </View>
  );
}

export default function Settings() {
  const t = useTheme();
  const { user, profile } = useAuthed();
  const { signOut } = useSession();
  const offline = useOffline();
  const theme = useSyncExternalStore(subscribeSettings, () => getSetting('theme'));
  const coverColor = useSyncExternalStore(subscribeSettings, () => getSetting('coverColor'));
  const open = (path: string) => void WebBrowser.openBrowserAsync(`${SITE}${path}`);

  return (
    <Screen back>
      <PageTitle>Ayarlar</PageTitle>

      <Section title="Görünüm">
        <View accessibilityRole="radiogroup" accessibilityLabel="Tema" style={{ flexDirection: 'row', gap: t.space[2] }}>
          {THEMES.map(([value, label, Icon]) => {
            const on = theme === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityState={{ checked: on }}
                onPress={() => setThemeChoice(value)}
                style={{ flex: 1, gap: t.space[2], padding: t.space[4], borderRadius: t.radius.lg, backgroundColor: t.c.fill.subtle, borderWidth: t.size.border.strong, borderColor: on ? t.c.accent.text : 'transparent' }}
              >
                <Icon color={t.c.text.primary} size={t.size.icon.md} />
                <T variant="labelMd">{label}</T>
              </Pressable>
            );
          })}
        </View>
        <Panel>
          <Row
            title="Kapak rengini arka planda kullan"
            description="Arka plandaki ışık çalan şarkının kapağından gelir. Vurgu rengi her zaman yeşil kalır."
            control={
              <Switch
                accessibilityLabel="Kapak rengini arka planda kullan"
                value={coverColor}
                trackColor={{ false: t.c.fill.muted, true: t.c.accent.default }}
                thumbColor={t.c.text.primary}
                onValueChange={(v) => setSetting('coverColor', v)}
              />
            }
          />
        </Panel>
      </Section>

      <Section title="Cihaz">
        <Panel>
          <Row
            title="İndirilen şarkılar"
            description={`${offline.songs.length} şarkı bu cihazda; internetsiz de çalar.`}
            control={<Button variant="ghost" label="Göster" onPress={() => router.navigate('/library')} />}
          />
        </Panel>
      </Section>

      <Section title="Hesap">
        <Panel>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3], padding: t.space[3] }}>
            <Avatar uri={profile.avatar_url} name={profile.username} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T variant="labelMd" numberOfLines={1}>
                {profile.username ? `@${profile.username}` : 'Kullanıcı adı yok'}
              </T>
              <T variant="bodySm" tone="secondary" numberOfLines={1}>
                {user.email}
              </T>
            </View>
          </View>
          <Row title={isPremium(profile) ? 'Premium üyesin' : 'Ücretsiz plan'} description={isPremium(profile) ? 'İndirme, avatar çerçeveleri ve Premium rozeti açık.' : 'Premium ile şarkıları indirip internetsiz dinleyebilirsin.'} control={<Button variant="secondary" icon={ExternalLink} label="Premium" accessibilityLabel="Premium'u sitede aç" onPress={() => open('/premium')} />} />
          <Row title="Hesap ve profil" description="Şifre, profil görseli ve hesap ayarları sitede." control={<Button variant="secondary" icon={ExternalLink} label="Hesabım" accessibilityLabel="Hesabımı sitede aç" onPress={() => open('/account')} />} />
          {isAdmin(profile) ? <Row title="Admin paneli" description="Şarkı onayı, YouTube'dan ekleme ve kullanıcı yönetimi sitede." control={<Button variant="secondary" icon={ExternalLink} label="Aç" accessibilityLabel="Admin panelini sitede aç" onPress={() => open('/admin')} />} /> : null}
        </Panel>
        <Button
          variant="ghost"
          icon={LogOut}
          label="Çıkış yap"
          onPress={() =>
            Alert.alert('Çıkış yapılsın mı?', 'İndirdiğin şarkılar cihazda kalır.', [
              { text: 'Vazgeç', style: 'cancel' },
              { text: 'Çıkış yap', style: 'destructive', onPress: () => void signOut() },
            ])
          }
        />
      </Section>

      <T variant="bodySm" tone="secondary">
        Bekofy {Constants.expoConfig?.version ?? ''}
      </T>
    </Screen>
  );
}
