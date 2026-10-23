import { newReleases, recentlyPlayed } from '@bekofy/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Heart, Settings } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Avatar } from '@/components/avatar';
import { Card, Shelf } from '@/components/blocks';
import { Cover } from '@/components/cover';
import { FriendsActivity } from '@/components/friends';
import { LikeButton } from '@/components/like-button';
import { Screen, Section } from '@/components/screen';
import { Button, IconButton, PlayButton, T } from '@/components/ui';
import { usePlaylists } from '@/lib/data';
import { player, usePlayer, type Track } from '@/lib/player';
import { routes } from '@/lib/routes';
import { useAuthed } from '@/lib/session';
import { sb } from '@/lib/supabase';
import { useTheme } from '@/theme';

const greeting = () => {
  const h = new Date().getHours();
  return h < 6 ? 'İyi geceler' : h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar';
};

const songHref = (t: Track) => (t.album ? routes.album(t.artist, t.album) : routes.search);

export default function Home() {
  const t = useTheme();
  const { user, profile } = useAuthed();
  const p = usePlayer();
  const playlists = usePlaylists();
  const recent = useQuery({ queryKey: ['recent', user.id], queryFn: () => recentlyPlayed(sb, user.id, 20) });
  const fresh = useQuery({ queryKey: ['new-releases'], queryFn: () => newReleases(sb, 20) });
  const resume = p.current ?? recent.data?.[0] ?? null;
  const refreshing = recent.isRefetching || fresh.isRefetching || playlists.isRefetching;

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        void recent.refetch();
        void fresh.refetch();
        void playlists.refetch();
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.space[3] }}>
        <T variant="titleXl" accessibilityRole="header" style={{ flex: 1 }}>
          {greeting()}
          {profile.username ? `, ${profile.username}` : ''}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconButton icon={Settings} label="Ayarlar" onPress={() => router.push(routes.settings)} />
          <Pressable accessibilityRole="button" accessibilityLabel="Profilin" onPress={() => router.push(routes.profile(user.id))} hitSlop={4} style={{ padding: t.space[1] }}>
            <Avatar uri={profile.avatar_url} name={profile.username} size={t.size.control.md} />
          </Pressable>
        </View>
      </View>

      {resume ? (
        <View style={{ flexDirection: 'row', gap: t.space[4], alignItems: 'center', padding: t.space[4], borderRadius: t.radius.xl, backgroundColor: t.c.glass.panel.bg, borderColor: t.c.glass.edge, borderWidth: t.size.border.hairline }}>
          <Cover uri={resume.cover_url} size={t.size.artwork.md + t.space[6]} />
          <View style={{ flex: 1, minWidth: 0, gap: t.space[1] }}>
            <T variant="labelSm" tone="secondary">
              {p.current ? 'Şimdi çalıyor' : 'Kaldığın yerden devam et'}
            </T>
            <T variant="titleMd" numberOfLines={2}>
              {resume.title}
            </T>
            <T variant="bodySm" tone="secondary" numberOfLines={1}>
              {resume.artist}
            </T>
          </View>
          <View style={{ alignItems: 'center' }}>
            <PlayButton size={t.size.control.lg} playing={p.current?.id === resume.id && p.isPlaying} label={resume.title} onPress={() => (p.current?.id === resume.id ? player.toggle() : player.playList(recent.data ?? [resume], 0, 'recent'))} />
            <LikeButton songId={resume.id} title={resume.title} />
          </View>
        </View>
      ) : (
        <View style={{ gap: t.space[3], padding: t.space[6], borderRadius: t.radius.xl, backgroundColor: t.c.glass.panel.bg, borderColor: t.c.glass.edge, borderWidth: t.size.border.hairline }}>
          <T variant="titleLg" accessibilityRole="header">
            Müziğe başla
          </T>
          <T tone="secondary">Ara, bir şarkı çal; dinlediklerin burada birikir.</T>
          <Button label="Aramaya git" onPress={() => router.navigate(routes.search)} />
        </View>
      )}

      <View accessibilityLabel="Hızlı erişim" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2] }}>
        <QuickLink title="Beğenilen şarkılar" onPress={() => router.push(routes.liked)} art={<View style={{ width: t.size.artwork.sm, height: t.size.artwork.sm, backgroundColor: t.c.accent.default, alignItems: 'center', justifyContent: 'center' }}><Heart color={t.c.accent.on} fill={t.c.accent.on} size={t.size.icon.sm} /></View>} />
        {playlists.data?.slice(0, 5).map((pl) => (
          <QuickLink key={pl.id} title={pl.name} onPress={() => router.push(routes.playlist(pl.id))} art={<Cover uri={pl.cover_url} size={t.size.artwork.sm} style={{ borderRadius: 0 }} />} />
        ))}
      </View>

      <FriendsActivity />

      {recent.data?.length ? (
        <Section title="Son dinlediklerin">
          <Shelf label="Son dinlediklerin">
            {recent.data.map((s, i) => (
              <Card key={s.id} index={i} href={songHref(s)} cover={s.cover_url} title={s.title} sub={s.artist} onPlay={() => player.playList(recent.data, i, 'recent')} />
            ))}
          </Shelf>
        </Section>
      ) : null}

      <Section title="Yeni eklenenler">
        {fresh.data?.length ? (
          <Shelf label="Yeni eklenenler">
            {fresh.data.map((s, i) => (
              <Card key={s.id} index={i} href={songHref(s)} cover={s.cover_url} title={s.title} sub={s.artist} onPlay={() => player.playList(fresh.data, i, 'new')} />
            ))}
          </Shelf>
        ) : (
          <T tone="secondary">{fresh.isLoading ? 'Yükleniyor' : 'Henüz şarkı yok.'}</T>
        )}
      </Section>

      <View style={{ gap: t.space[4], padding: t.space[6], borderRadius: t.radius.xl, backgroundColor: t.c.surface.inverse }}>
        <T variant="titleLg" tone="inverse" accessibilityRole="header">
          Arkadaşlarınla aynı anda dinle
        </T>
        <T tone="inverse">Jam başlat, kodu paylaş; çalan şarkı herkeste aynı anda ilerler.</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[3] }}>
          <Button label="Jam başlat" onPress={() => router.push(routes.jam)} />
          <Button label="Yılının özeti" variant="inverseOutline" onPress={() => router.push(routes.wrapped)} />
        </View>
      </View>
    </Screen>
  );
}

function QuickLink({ title, art, onPress }: { title: string; art: React.ReactNode; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={title}
      onPress={onPress}
      android_ripple={{ color: t.c.state.pressed }}
      style={{ flexBasis: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: t.space[3], overflow: 'hidden', borderRadius: t.radius.md, backgroundColor: t.c.fill.subtle }}
    >
      <View accessible={false}>{art}</View>
      <T variant="labelMd" numberOfLines={2} style={{ flex: 1, paddingRight: t.space[2] }}>
        {title}
      </T>
    </Pressable>
  );
}
