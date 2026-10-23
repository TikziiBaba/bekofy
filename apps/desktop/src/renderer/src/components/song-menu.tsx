import { artistByName } from '@bekofy/core';
import { CircleCheck, Disc3, Download, Ellipsis, ListEnd, ListPlus, ListStart, MicVocal, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useAddToPlaylist, usePlaylists } from '../lib/data';
import { canDownload, downloadTrack, removeDownload, useOffline } from '../lib/offline';
import { player, type Track } from '../lib/player';
import { navigate } from '../lib/router';
import { useAuthed } from '../lib/session';
import { isDesktop } from '../lib/bridge';
import { Menu, menuItem } from './menu';
import { showToast } from './toast';

/** Bir şarkının seçenekleri. onRemove verilirse "Bu listeden çıkar" görünür. */
export function SongMenu({ track, onRemove }: { track: Track; onRemove?: () => void }) {
  const { sb } = useAuthed();
  const playlists = usePlaylists();
  const add = useAddToPlaylist();
  const offline = useOffline();
  const [picking, setPicking] = useState(false);
  const downloaded = offline.songs.some((s) => s.id === track.id);

  return (
    <Menu label={`Diğer seçenekler: ${track.title}`} trigger={<Ellipsis aria-hidden="true" />}>
      {(close) => {
        const run = (fn: () => void) => () => {
          fn();
          close();
          setPicking(false);
        };
        if (picking) {
          return (
            <div className="flex flex-col">
              <p className="px-3 py-2 type-label-sm text-fg-muted">Hangi listeye?</p>
              {playlists.data?.length ? (
                playlists.data.map((p) => (
                  <button key={p.id} type="button" className={menuItem} onClick={run(() => add.mutate({ playlistId: p.id, songIds: [track.id], name: p.name }))}>
                    <span className="truncate">{p.name}</span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 type-body-sm text-fg-muted">Henüz listen yok. Kenar menüsünden yeni liste oluştur.</p>
              )}
              <button type="button" className={menuItem} onClick={() => setPicking(false)}>
                Geri
              </button>
            </div>
          );
        }
        return (
          <div className="flex flex-col">
            <button type="button" className={menuItem} onClick={run(() => { player.playNextTrack(track); showToast(`${track.title} sıradaki olarak eklendi`); })}>
              <ListStart aria-hidden="true" />
              Sıradaki çal
            </button>
            <button type="button" className={menuItem} onClick={run(() => { player.addToQueue(track); showToast(`${track.title} sıraya eklendi`); })}>
              <ListEnd aria-hidden="true" />
              Sıranın sonuna ekle
            </button>
            <button type="button" className={menuItem} onClick={() => setPicking(true)}>
              <ListPlus aria-hidden="true" />
              Çalma listesine ekle
            </button>
            {onRemove ? (
              <button type="button" className={menuItem} onClick={run(onRemove)}>
                <Trash2 aria-hidden="true" />
                Bu listeden çıkar
              </button>
            ) : null}
            {isDesktop ? (
              downloaded ? (
                <button type="button" className={menuItem} onClick={run(() => void removeDownload(track.id).then(() => showToast(`${track.title} cihazdan silindi`)))}>
                  <CircleCheck aria-hidden="true" />
                  İndirileni sil
                </button>
              ) : (
                <button
                  type="button"
                  className={menuItem}
                  onClick={run(() =>
                    void downloadTrack(sb, track).then((err) => showToast(err ?? `${track.title} indirildi; internetsiz de çalar`)),
                  )}
                >
                  <Download aria-hidden="true" />
                  {canDownload() ? 'İndir' : 'İndir (Premium)'}
                </button>
              )
            ) : null}
            <button
              type="button"
              className={menuItem}
              onClick={run(() =>
                void artistByName(sb, track.artist.split(',')[0]?.trim() ?? track.artist).then((a) =>
                  a ? navigate({ name: 'artist', id: a.id }) : showToast('Sanatçı sayfası bulunamadı'),
                ),
              )}
            >
              <MicVocal aria-hidden="true" />
              Sanatçıya git
            </button>
            {track.album ? (
              <button type="button" className={menuItem} onClick={run(() => navigate({ name: 'album', artist: track.artist, title: track.album! }))}>
                <Disc3 aria-hidden="true" />
                Albüme git
              </button>
            ) : null}
          </div>
        );
      }}
    </Menu>
  );
}
