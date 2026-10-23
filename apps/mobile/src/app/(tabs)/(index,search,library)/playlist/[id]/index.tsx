import { getPlaylist, playlistSongs, removeSongFromPlaylist } from '@bekofy/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Download, Pencil, Shuffle } from 'lucide-react-native';
import { View } from 'react-native';
import { CollectionHead, Empty, Loadable, songCount } from '@/components/blocks';
import { Screen } from '@/components/screen';
import { TrackList } from '@/components/track-list';
import { Button, IconButton, PlayButton } from '@/components/ui';
import { keys } from '@/lib/data';
import { canDownload, downloadTrack, PREMIUM_DOWNLOAD_MESSAGE } from '@/lib/offline';
import { player, usePlayer } from '@/lib/player';
import { routes } from '@/lib/routes';
import { useAuthed } from '@/lib/session';
import { sb } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import { useTheme } from '@/theme';

export default function Playlist() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthed();
  const qc = useQueryClient();
  const p = usePlayer();
  const q = useQuery({
    queryKey: keys.playlist(id),
    queryFn: async () => {
      const [list, songs] = await Promise.all([getPlaylist(sb, id), playlistSongs(sb, id)]);
      const owner = list.user_id ? (await sb.from('profiles').select('username').eq('id', list.user_id).maybeSingle()).data?.username : null;
      return { list, songs, owner };
    },
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: keys.playlist(id) });
    void qc.invalidateQueries({ queryKey: keys.playlists(user.id) });
  };

  return (
    <Screen back title={q.data?.list.name} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Loadable query={q} label="Çalma listesi">
        {({ list, songs, owner }) => {
          const mine = list.user_id === user.id;
          const here = p.contextId === id;
          return (
            <>
              <CollectionHead
                kind={list.is_public ? 'Herkese açık çalma listesi' : 'Gizli çalma listesi'}
                title={list.name}
                cover={list.cover_url ?? songs[0]?.cover_url}
                description={list.description}
                meta={`${owner ?? 'Bekofy'} · ${songCount(songs)}`}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: t.space[2] }}>
                {songs.length ? (
                  <>
                    <PlayButton size={t.size.control.xl} playing={here && p.isPlaying} label={list.name} onPress={() => (here ? player.toggle() : player.playList(songs, 0, id))} />
                    <IconButton
                      icon={Shuffle}
                      label="Karışık çal"
                      onPress={() => {
                        if (!p.shuffle) player.toggleShuffle();
                        player.playList(songs, Math.floor(Math.random() * songs.length), id);
                      }}
                    />
                  </>
                ) : null}
                {songs.length ? (
                  <IconButton
                    icon={Download}
                    label={canDownload() ? 'Tümünü indir' : 'Tümünü indir (Premium)'}
                    onPress={async () => {
                      if (!canDownload()) return showToast(PREMIUM_DOWNLOAD_MESSAGE);
                      showToast(`${songs.length} şarkı indiriliyor`);
                      let failed = 0;
                      for (const s of songs) if (await downloadTrack(s)) failed++;
                      showToast(failed ? `${failed} şarkı indirilemedi` : `${list.name} indirildi; internetsiz de çalar`);
                    }}
                  />
                ) : null}
                {mine ? <Button variant="secondary" icon={Pencil} label="Düzenle" accessibilityLabel="Listeyi düzenle" onPress={() => router.push(routes.playlistEdit(id))} style={{ marginLeft: 'auto' }} /> : null}
              </View>
              {songs.length ? (
                <TrackList
                  tracks={songs}
                  contextId={id}
                  onRemove={
                    mine
                      ? (s) =>
                          void removeSongFromPlaylist(sb, id, s.id).then(
                            () => {
                              showToast(`${s.title} listeden çıkarıldı`);
                              refresh();
                            },
                            () => showToast('Çıkarılamadı. Tekrar dene.'),
                          )
                      : undefined
                  }
                />
              ) : (
                <Empty title="Liste boş" action={<Button label="Şarkı ara" variant="secondary" onPress={() => router.navigate(routes.search)} />}>
                  Bir şarkının seçeneklerinden "Çalma listesine ekle"yi seç.
                </Empty>
              )}
            </>
          );
        }}
      </Loadable>
    </Screen>
  );
}
