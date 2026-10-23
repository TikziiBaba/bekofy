// Bir şarkının seçenekleri (alt sayfa). onRemove verilirse "Bu listeden çıkar" görünür.

import { artistByName } from '@bekofy/core';
import { router } from 'expo-router';
import { ChevronLeft, CircleCheck, Disc3, Download, ListEnd, ListPlus, ListStart, MicVocal, Plus, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { useAddToPlaylist, useCreatePlaylist, usePlaylists } from '@/lib/data';
import { canDownload, downloadTrack, removeDownload, useOffline } from '@/lib/offline';
import { player, type Track } from '@/lib/player';
import { routes } from '@/lib/routes';
import { sb } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import { NamePrompt } from './name-prompt';
import { Sheet, SheetItem } from './sheet';

/** mode 'playlist': doğrudan "Hangi listeye?" adımında açılır (satırı sola çekince). */
export function SongSheet({ track, mode = 'menu', onClose, onRemove }: { track: Track | null; mode?: 'menu' | 'playlist'; onClose: () => void; onRemove?: (t: Track) => void }) {
  const playlists = usePlaylists();
  const add = useAddToPlaylist();
  const create = useCreatePlaylist();
  const offline = useOffline();
  const [picking, setPicking] = useState(false);
  const [naming, setNaming] = useState(false);

  // Her açılışta istenen adımla başla (kapanırken değiştirilmez: içerik kayarken atlamasın).
  useEffect(() => {
    if (track) setPicking(mode === 'playlist');
  }, [track, mode]);

  const close = onClose;
  // Kapanış animasyonu sürerken içerik boşalmasın: son şarkı tutulur.
  const last = useRef(track);
  if (track) last.current = track;
  const t = last.current;
  if (!t) return null;
  const run = (fn: () => void) => () => {
    fn();
    close();
  };
  const downloaded = t ? offline.songs.some((s) => s.id === t.id) : false;

  return (
    <>
      <Sheet open={Boolean(track) && !naming} onClose={close} title={t ? (picking ? 'Hangi listeye?' : `${t.title} · ${t.artist}`) : undefined}>
        {t && picking ? (
          <ScrollView>
            <SheetItem icon={Plus} label="Yeni çalma listesi" onPress={() => setNaming(true)} />
            {playlists.data?.map((p) => <SheetItem key={p.id} label={p.name} onPress={run(() => add.mutate({ playlistId: p.id, songIds: [t.id], name: p.name }))} />)}
            <SheetItem icon={ChevronLeft} label="Geri" onPress={() => setPicking(false)} />
          </ScrollView>
        ) : t ? (
          <ScrollView>
            <SheetItem icon={ListStart} label="Sıradaki çal" onPress={run(() => { player.playNextTrack(t); showToast(`${t.title} sıradaki olarak eklendi`); })} />
            <SheetItem icon={ListEnd} label="Sıranın sonuna ekle" onPress={run(() => { player.addToQueue(t); showToast(`${t.title} sıraya eklendi`); })} />
            <SheetItem icon={ListPlus} label="Çalma listesine ekle" onPress={() => setPicking(true)} />
            {onRemove ? <SheetItem icon={Trash2} label="Bu listeden çıkar" tone="danger" onPress={run(() => onRemove(t))} /> : null}
            {downloaded ? (
              <SheetItem icon={CircleCheck} label="İndirileni sil" onPress={run(() => void removeDownload(t.id).then(() => showToast(`${t.title} cihazdan silindi`)))} />
            ) : (
              <SheetItem
                icon={Download}
                label={canDownload() ? 'İndir' : 'İndir (Premium)'}
                onPress={run(() => void downloadTrack(t).then((err) => showToast(err ?? `${t.title} indirildi; internetsiz de çalar`)))}
              />
            )}
            <SheetItem
              icon={MicVocal}
              label="Sanatçıya git"
              onPress={run(() =>
                void artistByName(sb, t.artist.split(',')[0]?.trim() ?? t.artist).then((a) => (a ? router.push(routes.artist(a.id)) : showToast('Sanatçı sayfası bulunamadı'))),
              )}
            />
            {t.album ? <SheetItem icon={Disc3} label="Albüme git" onPress={run(() => router.push(routes.album(t.artist, t.album!)))} /> : null}
          </ScrollView>
        ) : null}
      </Sheet>
      <NamePrompt
        open={naming}
        title="Yeni çalma listesi"
        label="Liste adı"
        confirmLabel="Oluştur ve ekle"
        onClose={() => setNaming(false)}
        onSubmit={async (name) => {
          const list = await create.mutateAsync(name);
          if (t) add.mutate({ playlistId: list.id, songIds: [t.id], name });
          setNaming(false);
          close();
        }}
      />
    </>
  );
}
