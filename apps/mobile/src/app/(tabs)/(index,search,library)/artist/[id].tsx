import { artistFollowerCount, artistSongs, followArtist, formatCount, getArtist, isFollowingArtist, unfollowArtist } from '@bekofy/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { CollectionHead, Empty, Loadable } from '@/components/blocks';
import { Screen, Section } from '@/components/screen';
import { TrackList } from '@/components/track-list';
import { Button, PlayButton } from '@/components/ui';
import { player, usePlayer } from '@/lib/player';
import { useAuthed } from '@/lib/session';
import { sb } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import { useTheme } from '@/theme';

export default function Artist() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthed();
  const qc = useQueryClient();
  const p = usePlayer();
  const q = useQuery({
    queryKey: ['artist', id, user.id],
    queryFn: async () => {
      const [artist, songs, following, followers] = await Promise.all([getArtist(sb, id), artistSongs(sb, id, 50), isFollowingArtist(sb, user.id, id), artistFollowerCount(sb, id)]);
      return { artist, songs, following, followers };
    },
  });

  return (
    <Screen back title={q.data?.artist.name} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Loadable query={q} label="Sanatçı">
        {({ artist, songs, following, followers }) => (
          <>
            <CollectionHead kind="Sanatçı" title={artist.name} cover={artist.avatar_url ?? songs[0]?.cover_url} round meta={`${formatCount(followers)} takipçi`} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3] }}>
              {songs.length ? <PlayButton size={t.size.control.xl} playing={p.contextId === id && p.isPlaying} label={artist.name} onPress={() => (p.contextId === id ? player.toggle() : player.playList(songs, 0, id))} /> : null}
              <Button
                variant="secondary"
                label={following ? 'Takip ediliyor' : 'Takip et'}
                accessibilityLabel={following ? `${artist.name} takip ediliyor, takipten çıkmak için dokun` : `${artist.name} takip et`}
                onPress={async () => {
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
              />
            </View>
            <Section title="Şarkılar">{songs.length ? <TrackList tracks={songs} contextId={id} /> : <Empty title="Henüz yayında şarkı yok" />}</Section>
          </>
        )}
      </Loadable>
    </Screen>
  );
}
