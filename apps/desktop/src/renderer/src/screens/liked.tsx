import { likedSongs } from '@bekofy/core';
import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { CollectionHead, Empty, Loadable, songCount } from '../components/blocks';
import { TrackList } from '../components/track-list';
import { keys } from '../lib/data';
import { player, usePlayer } from '../lib/player';
import { href } from '../lib/router';
import { useAuthed } from '../lib/session';
import { PlayButton } from '../shell/player-bar';

export function LikedScreen() {
  const { sb, user, profile } = useAuthed();
  const q = useQuery({ queryKey: keys.likedSongs(user.id), queryFn: () => likedSongs(sb, user.id) });
  const p = usePlayer();
  const playingHere = p.queue.contextId === 'liked' && p.isPlaying;

  return (
    <div className="flex flex-col gap-8">
      <CollectionHead
        kind="Çalma listesi"
        title="Beğenilen şarkılar"
        meta={
          <>
            <strong className="text-fg">{profile.username ?? 'Sen'}</strong>
            {q.data ? <span>· {songCount(q.data)}</span> : null}
          </>
        }
      >
        <span aria-hidden="true" className="grid w-(--size-artwork-xl) max-w-full aspect-square place-items-center rounded-art-lg bg-accent text-on-accent shadow-ui-lg">
          <Heart className="size-(--size-artwork-sm) fill-current" />
        </span>
      </CollectionHead>
      <Loadable query={q} label="Beğenilen şarkılar">
        {(songs) =>
          songs.length ? (
            <>
              <div>
                <PlayButton size="xl" playing={playingHere} label="Beğenilen şarkılar" onClick={() => (p.queue.contextId === 'liked' ? player.toggle() : player.playList(songs, 0, 'liked'))} />
              </div>
              <TrackList tracks={songs} label="Beğenilen şarkılar" contextId="liked" />
            </>
          ) : (
            <Empty title="Henüz beğendiğin şarkı yok" action={<a className="type-label-md text-accent-fg hover:underline" href={href({ name: 'search', q: '' })}>Şarkı ara</a>}>
              Bir şarkının yanındaki kalbe bas; burada toplanır.
            </Empty>
          )
        }
      </Loadable>
    </div>
  );
}
