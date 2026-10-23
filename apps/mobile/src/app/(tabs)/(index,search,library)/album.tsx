import { likeExact, SONG_FIELDS } from '@bekofy/core';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { CollectionHead, Empty, Loadable, songCount } from '@/components/blocks';
import { Screen } from '@/components/screen';
import { TrackList } from '@/components/track-list';
import { PlayButton } from '@/components/ui';
import { player, usePlayer, type Track } from '@/lib/player';
import { sb } from '@/lib/supabase';
import { useTheme } from '@/theme';

/** Albüm ayrı bir tablo değil: aynı sanatçı metni ve albüm adını taşıyan yayındaki şarkılar. */
export default function Album() {
  const t = useTheme();
  const { artist = '', title = '' } = useLocalSearchParams<{ artist: string; title: string }>();
  const ctx = `album:${artist}:${title}`;
  const p = usePlayer();
  const q = useQuery({
    queryKey: ['album', artist, title],
    queryFn: async () => {
      const res = await sb.from('songs').select(SONG_FIELDS).eq('status', 'approved').ilike('album', likeExact(title)).ilike('artist', likeExact(artist)).order('created_at');
      if (res.error) throw new Error('Albüm alınamadı');
      return res.data as Track[];
    },
  });

  return (
    <Screen back title={title} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Loadable query={q} label="Albüm">
        {(songs) =>
          songs.length ? (
            <>
              <CollectionHead kind="Albüm" title={title} cover={songs[0]?.cover_url} meta={`${artist} · ${songCount(songs)}`} />
              <PlayButton size={t.size.control.xl} playing={p.contextId === ctx && p.isPlaying} label={title} onPress={() => (p.contextId === ctx ? player.toggle() : player.playList(songs, 0, ctx))} />
              <TrackList tracks={songs} contextId={ctx} />
            </>
          ) : (
            <Empty title="Albüm bulunamadı">Bu albümde yayında şarkı yok.</Empty>
          )
        }
      </Loadable>
    </Screen>
  );
}
