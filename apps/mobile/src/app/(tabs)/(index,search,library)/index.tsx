import { newReleases, recentlyPlayed } from '@bekofy/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Heart, Radio, Settings } from 'lucide-react-native';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Avatar } from '@/components/avatar';
import { Card, Shelf } from '@/components/blocks';
import { Cover } from '@/components/cover';
import { FriendsActivity } from '@/components/friends';
import { LikeButton } from '@/components/like-button';
import { Screen, Section } from '@/components/screen';
import { Tappable } from '@/components/tappable';
import { Button, IconButton, PlayButton, T } from '@/components/ui';
import { usePlaylists } from '@/lib/data';
import { enter } from '@/lib/motion';
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
  // Bir şey çalıyorsa mini oynatıcı zaten gösteriyor; kart yalnızca kaldığın yeri hatırlatır.
  const resume = p.current ? null : (recent.data?.[0] ?? null);
  const refreshing = recent.isRefetching || fresh.isRefetching || playlists.isRefetching;
  const panel = { borderRadius: t.radius.xl, backgroundColor: t.c.glass.panel.bg, borderColor: t.c.glass.edge, borderWidth: t.size.border.hairline };

  return (
    <Screen
      largeTitle={`${greeting()}${profile.username ? `, ${profile.username}` : ''}`}
      title="Ana sayfa"
      trailing={
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconButton icon={Settings} label="Ayarlar" onPress={() => router.push(routes.settings)} />
          <Tappable accessibilityRole="button" accessibilityLabel="Profilin" onPress={() => router.push(routes.profile(user.id))} hitSlop={4} scaleTo={0.9} style={{ padding: t.space[1] }}>
            <Avatar uri={profile.avatar_url} name={profile.username} size={t.size.control.md} />
          </Tappable>
        </View>
      }
      refreshing={refreshing}
      onRefresh={() => {
        void recent.refetch();
        void fresh.refetch();
        void playlists.refetch();
      }}
    >
      {resume ? (
        <Animated.View entering={enter(0)} style={[panel, { flexDirection: 'row', gap: t.space[4], alignItems: 'center', padding: t.space[4] }]}>
          <Cover uri={resume.cover_url} size={t.size.artwork.md + t.space[6]} shadow={t.shadow.md} />
          <View style={{ flex: 1, minWidth: 0, gap: t.space[1] }}>
            <T variant="labelSm" tone="secondary">
              Kaldığın yerden devam et
            </T>
            <T variant="titleMd" numberOfLines={2}>
              {resume.title}
            </T>
            <T variant="bodySm" tone="secondary" numberOfLines={1}>
              {resume.artist}
            </T>
          </View>
          <View style={{ alignItems: 'center' }}>
            <PlayButton size={t.size.control.lg} playing={false} label={resume.title} onPress={() => player.playList(recent.data ?? [resume], 0, 'recent')} />
            <LikeButton songId={resume.id} title={resume.title} />
          </View>
        </Animated.View>
      ) : !p.current && !recent.isLoading ? (
        <Animated.View entering={enter(0)} style={[panel, { gap: t.space[3], padding: t.space[6] }]}>
          <T variant="titleLg" accessibilityRole="header">
            Müziğe başla
          </T>
          <T tone="secondary">Ara, bir şarkı çal; dinlediklerin burada birikir.</T>
          <Button label="Aramaya git" onPress={() => router.navigate(routes.search)} />
        </Animated.View>
      ) : null}

      <View accessibilityLabel="Hızlı erişim" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2] }}>
        <QuickLink
          index={0}
          title="Beğenilen şarkılar"
          onPress={() => router.push(routes.liked)}
          art={
            <View style={{ width: t.size.artwork.sm, height: t.size.artwork.sm, backgroundColor: t.c.accent.default, alignItems: 'center', justifyContent: 'center' }}>
              <Heart color={t.c.accent.on} fill={t.c.accent.on} size={t.size.icon.sm} />
            </View>
          }
        />
        {playlists.data?.slice(0, 5).map((pl, i) => (
          <QuickLink key={pl.id} index={i + 1} title={pl.name} onPress={() => router.push(routes.playlist(pl.id))} art={<Cover uri={pl.cover_url} size={t.size.artwork.sm} style={{ borderRadius: 0 }} />} />
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

      {/* Koyu zeminde göz alan beyaz bir blok yerine cam panel; vurgu rengi yalnızca köşedeki ışıkta. */}
      <View
        style={[
          panel,
          {
            gap: t.space[4],
            padding: t.space[6],
            overflow: 'hidden',
            backgroundImage: `radial-gradient(ellipse 90% 80% at 100% 0%, ${t.c.accent.default}33 0%, ${t.c.accent.default}00 70%)`,
          },
        ]}
      >
        <View style={{ width: t.size.control.lg, height: t.size.control.lg, borderRadius: t.radius.full, backgroundColor: t.c.accent.default, alignItems: 'center', justifyContent: 'center' }}>
          <Radio color={t.c.accent.on} size={t.size.icon.md} />
        </View>
        <View style={{ gap: t.space[2] }}>
          <T variant="titleLg" accessibilityRole="header">
            Arkadaşlarınla aynı anda dinle
          </T>
          <T tone="secondary">Jam başlat, kodu paylaş; çalan şarkı herkeste aynı anda ilerler.</T>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[3] }}>
          <Button label="Jam başlat" onPress={() => router.push(routes.jam)} />
          <Button label="Yılının özeti" variant="secondary" onPress={() => router.push(routes.wrapped)} />
        </View>
      </View>
    </Screen>
  );
}

function QuickLink({ title, art, onPress, index }: { title: string; art: React.ReactNode; onPress: () => void; index: number }) {
  const t = useTheme();
  return (
    <Animated.View entering={enter(index)} style={{ flexBasis: '48%', flexGrow: 1 }}>
      <Tappable
        accessibilityRole="link"
        accessibilityLabel={title}
        onPress={onPress}
        scaleTo={0.97}
        android_ripple={{ color: t.c.state.pressed }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3], overflow: 'hidden', borderRadius: t.radius.md, backgroundColor: t.c.fill.subtle }}
      >
        <View accessible={false}>{art}</View>
        <T variant="labelMd" numberOfLines={2} style={{ flex: 1, paddingRight: t.space[2] }}>
          {title}
        </T>
      </Tappable>
    </Animated.View>
  );
}
