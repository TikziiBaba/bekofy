import { artistFollowerCount, artistSongs, followArtist, formatCount, getArtist, isFollowingArtist, unfollowArtist } from '@bekofy/core';
import { Button } from '@bekofy/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CollectionHead, Empty, Loadable, Section } from '../components/blocks';
import { showToast } from '../components/toast';
import { TrackList } from '../components/track-list';
import { player, usePlayer } from '../lib/player';
import { useAuthed } from '../lib/session';
import { PlayButton } from '../shell/player-bar';

export function ArtistScreen({ id }: { id: string }) {
  const { sb, user } = useAuthed();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['artist', id, user.id],
    queryFn: async () => {
      const [artist, songs, following, followers] = await Promise.all([getArtist(sb, id), artistSongs(sb, id, 50), isFollowingArtist(sb, user.id, id), artistFollowerCount(sb, id)]);
      return { artist, songs, following, followers };
    },
  });
  const p = usePlayer();

  return (
    <Loadable query={q} label="Sanatçı">
      {({ artist, songs, following, followers }) => (
        <div className="flex flex-col gap-8">
          <CollectionHead kind="Sanatçı" title={artist.name} cover={artist.avatar_url ?? songs[0]?.cover_url} round meta={<span>{formatCount(followers)} takipçi</span>} />
          <div className="flex flex-wrap items-center gap-3">
            <PlayButton size="xl" playing={p.queue.contextId === id && p.isPlaying} label={artist.name} disabled={!songs.length} onClick={() => (p.queue.contextId === id ? player.toggle() : player.playList(songs, 0, id))} />
            <Button
              variant="secondary"
              aria-pressed={following}
              onClick={async () => {
                try {
                  if (following) await unfollowArtist(sb, user.id, id);
                  else await followArtist(sb, user.id, id);
                  showToast(following ? `${artist.name} takipten çıkarıldı` : `${artist.name} takip ediliyor`);
                  void qc.invalidateQueries({ queryKey: ['artist', id] });
                  void qc.invalidateQueries({ queryKey: ['followed-artists', user.id] });
                } catch {
                  showToast('Değiştirilemedi. Tekrar dene.');
                }
              }}
            >
              {following ? 'Takip ediliyor' : 'Takip et'}
            </Button>
          </div>
          <Section id="artist-songs" title="Şarkılar">
            {songs.length ? <TrackList tracks={songs} label={`${artist.name} şarkıları`} contextId={id} /> : <Empty title="Henüz yayında şarkı yok" />}
          </Section>
        </div>
      )}
    </Loadable>
  );
}
