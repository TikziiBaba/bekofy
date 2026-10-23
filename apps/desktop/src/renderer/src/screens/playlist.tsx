import { deletePlaylist, getPlaylist, playlistSongs, removeSongFromPlaylist, updatePlaylist } from '@bekofy/core';
import { ConfirmDialog, IconButton, Switch } from '@bekofy/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Pencil, Shuffle, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { CollectionHead, Empty, Loadable, songCount } from '../components/blocks';
import { NamePrompt } from '../components/name-prompt';
import { showToast } from '../components/toast';
import { TrackList } from '../components/track-list';
import { isDesktop } from '../lib/bridge';
import { keys } from '../lib/data';
import { downloadTrack } from '../lib/offline';
import { player, usePlayer } from '../lib/player';
import { href, navigate } from '../lib/router';
import { useAuthed } from '../lib/session';
import { PlayButton } from '../shell/player-bar';

export function PlaylistScreen({ id }: { id: string }) {
  const { sb, user } = useAuthed();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: keys.playlist(id),
    queryFn: async () => {
      const [list, songs] = await Promise.all([getPlaylist(sb, id), playlistSongs(sb, id)]);
      const owner = list.user_id ? (await sb.from('profiles').select('username').eq('id', list.user_id).maybeSingle()).data?.username : null;
      return { list, songs, owner };
    },
  });
  const p = usePlayer();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: keys.playlist(id) });
    void qc.invalidateQueries({ queryKey: keys.playlists(user.id) });
  };

  return (
    <Loadable query={q} label="Çalma listesi">
      {({ list, songs, owner }) => {
        const mine = list.user_id === user.id;
        const playingHere = p.queue.contextId === id && p.isPlaying;
        return (
          <div className="flex flex-col gap-8">
            <CollectionHead
              kind={list.is_public ? 'Herkese açık çalma listesi' : 'Gizli çalma listesi'}
              title={list.name}
              cover={list.cover_url ?? songs[0]?.cover_url}
              description={list.description}
              meta={
                <>
                  <strong className="text-fg">{owner ?? 'Bekofy'}</strong>
                  <span>
                    · {songCount(songs)}
                  </span>
                </>
              }
            />
            <div className="flex flex-wrap items-center gap-3">
              <PlayButton size="xl" playing={playingHere} label={list.name} disabled={!songs.length} onClick={() => (p.queue.contextId === id ? player.toggle() : player.playList(songs, 0, id))} />
              <IconButton
                label="Karışık çal"
                disabled={!songs.length}
                onClick={() => {
                  if (!p.queue.shuffle) player.toggleShuffle();
                  player.playList(songs, Math.floor(Math.random() * songs.length), id);
                }}
              >
                <Shuffle aria-hidden="true" />
              </IconButton>
              {isDesktop && songs.length ? (
                <IconButton
                  label="Tümünü indir"
                  onClick={async () => {
                    showToast(`${songs.length} şarkı indiriliyor`);
                    let failed = 0;
                    for (const t of songs) if (await downloadTrack(sb, t)) failed++;
                    showToast(failed ? `${failed} şarkı indirilemedi` : `${list.name} indirildi; internetsiz de çalar`);
                  }}
                >
                  <Download aria-hidden="true" />
                </IconButton>
              ) : null}
              {mine ? (
                <>
                  <IconButton label="Adını değiştir" onClick={() => setRenaming(true)}>
                    <Pencil aria-hidden="true" />
                  </IconButton>
                  <span className="flex items-center gap-2 type-body-sm">
                    <span id="pl-public" className="text-fg-muted">
                      Herkese açık
                    </span>
                    <Switch
                      checked={list.is_public}
                      aria-labelledby="pl-public"
                      onCheckedChange={async (v) => {
                        await updatePlaylist(sb, id, { is_public: v }).then(refresh, () => showToast('Değiştirilemedi. Tekrar dene.'));
                      }}
                    />
                  </span>
                  <IconButton label="Listeyi sil" className="hover:text-danger-fg" onClick={() => setDeleting(true)}>
                    <Trash2 aria-hidden="true" />
                  </IconButton>
                </>
              ) : null}
            </div>
            {songs.length ? (
              <TrackList
                tracks={songs}
                label={`${list.name} şarkıları`}
                contextId={id}
                onRemove={
                  mine
                    ? (t) =>
                        void removeSongFromPlaylist(sb, id, t.id).then(
                          () => {
                            showToast(`${t.title} listeden çıkarıldı`);
                            refresh();
                          },
                          () => showToast('Çıkarılamadı. Tekrar dene.'),
                        )
                    : undefined
                }
              />
            ) : (
              <Empty title="Liste boş" action={<a className="type-label-md text-accent-fg hover:underline" href={href({ name: 'search', q: '' })}>Şarkı ara</a>}>
                Bir şarkının seçeneklerinden "Çalma listesine ekle"yi seç.
              </Empty>
            )}
            <NamePrompt
              open={renaming}
              title="Listeyi yeniden adlandır"
              label="Liste adı"
              initial={list.name}
              confirmLabel="Kaydet"
              busy={busy}
              onClose={() => setRenaming(false)}
              onSubmit={async (name) => {
                setBusy(true);
                try {
                  await updatePlaylist(sb, id, { name: name.slice(0, 100) });
                  setRenaming(false);
                  refresh();
                } finally {
                  setBusy(false);
                }
              }}
            />
            <ConfirmDialog
              open={deleting}
              title="Liste silinsin mi?"
              description={`${list.name} ve içindeki sıralama kalıcı olarak silinir. Şarkılar kütüphanede kalır.`}
              confirmLabel="Listeyi sil"
              tone="destructive"
              busy={busy}
              error={error}
              onClose={() => {
                setDeleting(false);
                setError(null);
              }}
              onConfirm={async () => {
                setBusy(true);
                try {
                  await deletePlaylist(sb, id);
                  setDeleting(false);
                  void qc.invalidateQueries({ queryKey: keys.playlists(user.id) });
                  showToast(`${list.name} silindi`);
                  navigate({ name: 'library', filter: 'playlists' }, { replace: true });
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Silinemedi.');
                } finally {
                  setBusy(false);
                }
              }}
            />
          </div>
        );
      }}
    </Loadable>
  );
}
