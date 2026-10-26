import { likedSongs } from '@bekofy/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { View } from 'react-native';
import { CollectionHead, Empty, Loadable, songCount } from '@/components/blocks';
import { Screen } from '@/components/screen';
import { TrackList } from '@/components/track-list';
import { Button, PlayButton } from '@/components/ui';
import { keys } from '@/lib/data';
import { player, usePlayer } from '@/lib/player';
import { routes } from '@/lib/routes';
import { useAuthed } from '@/lib/session';
import { sb } from '@/lib/supabase';
import { useTheme } from '@/theme';

export default function Liked() {
  const t = useTheme();
  const { user, profile } = useAuthed();
  const q = useQuery({ queryKey: keys.likedSongs(user.id), queryFn: () => likedSongs(sb, user.id) });
  const p = usePlayer();
  const here = p.contextId === 'liked';
  const art = t.size.artwork.xl;

  return (
    <Screen
      back
      title="Beğenilen şarkılar"
      actions={q.data?.length ? <PlayButton size={t.size.control.md} playing={here && p.isPlaying} label="Beğenilen şarkılar" onPress={() => (here ? player.toggle() : player.playList(q.data, 0, 'liked'))} /> : null}
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
    >
      <CollectionHead
        kind="Çalma listesi"
        title="Beğenilen şarkılar"
        meta={`${profile.username ?? 'Sen'}${q.data ? ` · ${songCount(q.data)}` : ''}`}
        art={
          <View style={{ width: art, height: art, borderRadius: t.radius.artwork.lg, backgroundColor: t.c.accent.default, boxShadow: t.shadow.lg, alignItems: 'center', justifyContent: 'center' }}>
            <Heart color={t.c.accent.on} fill={t.c.accent.on} size={t.size.artwork.sm} />
          </View>
        }
      />
      <Loadable query={q} label="Beğenilen şarkılar">
        {(songs) =>
          songs.length ? (
            <>
              <PlayButton size={t.size.control.xl} playing={here && p.isPlaying} label="Beğenilen şarkılar" onPress={() => (here ? player.toggle() : player.playList(songs, 0, 'liked'))} />
              <TrackList tracks={songs} contextId="liked" />
            </>
          ) : (
            <Empty title="Henüz beğendiğin şarkı yok" action={<Button label="Şarkı ara" variant="secondary" onPress={() => router.navigate(routes.search)} />}>
              Bir şarkının yanındaki kalbe dokun; burada toplanır.
            </Empty>
          )
        }
      </Loadable>
    </Screen>
  );
}
