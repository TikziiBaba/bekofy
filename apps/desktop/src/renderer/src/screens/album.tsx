import { likeExact, SONG_FIELDS } from '@bekofy/core';
import { useQuery } from '@tanstack/react-query';
import { CollectionHead, Empty, Loadable, songCount } from '../components/blocks';
import { TrackList } from '../components/track-list';
import { player, usePlayer, type Track } from '../lib/player';
import { useAuthed } from '../lib/session';
import { PlayButton } from '../shell/player-bar';

/** Albüm ayrı bir tablo değil: aynı sanatçı metni ve albüm adını taşıyan yayındaki şarkılar. */
export function AlbumScreen({ artist, title }: { artist: string; title: string }) {
  const { sb } = useAuthed();
  const ctx = `album:${artist}:${title}`;
  const q = useQuery({
    queryKey: ['album', artist, title],
    queryFn: async () => {
      const res = await sb.from('songs').select(SONG_FIELDS).eq('status', 'approved').ilike('album', likeExact(title)).ilike('artist', likeExact(artist)).order('created_at');
      if (res.error) throw new Error('Albüm alınamadı');
      return res.data as Track[];
    },
  });
  const p = usePlayer();

  return (
    <Loadable query={q} label="Albüm">
      {(songs) =>
        songs.length ? (
          <div className="flex flex-col gap-8">
            <CollectionHead
              kind="Albüm"
              title={title}
              cover={songs[0]?.cover_url}
              meta={
                <>
                  <strong className="text-fg">{artist}</strong>
                  <span>
                    · {songCount(songs)}
                  </span>
                </>
              }
            />
            <div>
              <PlayButton size="xl" playing={p.queue.contextId === ctx && p.isPlaying} label={title} onClick={() => (p.queue.contextId === ctx ? player.toggle() : player.playList(songs, 0, ctx))} />
            </div>
            <TrackList tracks={songs} label={`${title} şarkıları`} contextId={ctx} showAlbum={false} />
          </div>
        ) : (
          <Empty title="Albüm bulunamadı">Bu albümde yayında şarkı yok.</Empty>
        )
      }
    </Loadable>
  );
}
