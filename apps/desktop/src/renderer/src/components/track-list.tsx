// Şarkı listesi: sıra/çal, kapak + ad + sanatçı, albüm, beğen, süre, seçenekler. Dar alanda albüm ve süre gizlenir.

import { formatDuration } from '@bekofy/core';
import { cn } from '@bekofy/ui';
import { AudioLines, Clock3, Pause, Play } from 'lucide-react';
import { player, usePlayer, type Track } from '../lib/player';
import { href } from '../lib/router';
import { useOffline } from '../lib/offline';
import { Cover } from './cover';
import { LikeButton } from './like-button';
import { SongMenu } from './song-menu';

const COLS = 'grid-cols-[var(--space-8)_minmax(0,2fr)_minmax(0,1fr)_var(--size-control-sm)_var(--space-12)_var(--size-control-sm)] @max-xl:grid-cols-[var(--size-control-sm)_minmax(0,1fr)_var(--size-control-sm)_var(--size-control-sm)]';

export function TrackList({
  tracks,
  label,
  contextId = null,
  showAlbum = true,
  onRemove,
}: {
  tracks: readonly Track[];
  label: string;
  contextId?: string | null;
  showAlbum?: boolean;
  onRemove?: (track: Track) => void;
}) {
  const p = usePlayer();
  const offline = useOffline();
  const downloaded = new Set(offline.songs.map((s) => s.id));

  return (
    <div className="@container">
      <div aria-hidden="true" className={cn('grid gap-4 border-b border-line px-3 pb-2 type-label-sm text-fg-muted', COLS)}>
        <span className="text-center @max-xl:hidden">#</span>
        <span className="@max-xl:col-span-2">Başlık</span>
        <span className="@max-xl:hidden">{showAlbum ? 'Albüm' : ''}</span>
        <span />
        <span className="flex justify-end @max-xl:hidden">
          <Clock3 className="size-(--size-icon-xs)" />
        </span>
        <span />
      </div>
      <ol aria-label={label} className="mt-2 flex flex-col">
        {tracks.map((t, i) => {
          const current = p.current?.id === t.id;
          const playing = current && p.isPlaying;
          const play = () => (current ? player.toggle() : player.playList(tracks, i, contextId));
          return (
            <li
              key={`${t.id}-${i}`}
              aria-current={current ? 'true' : undefined}
              onDoubleClick={play}
              className={cn('group grid min-h-(--size-control-xl) items-center gap-4 rounded-ui-md px-3 hover:bg-hover @max-xl:gap-2 @max-xl:px-1', COLS)}
            >
              <span className="relative grid place-items-center text-center type-body-sm text-fg-muted">
                <span className={cn('group-hover:invisible group-focus-within:invisible @max-xl:invisible', current && 'text-accent-fg')}>
                  {playing ? <AudioLines aria-hidden="true" className="mx-auto size-(--size-icon-sm)" /> : i + 1}
                </span>
                <button
                  type="button"
                  onClick={play}
                  aria-label={`${playing ? 'Duraklat' : 'Çal'}: ${t.title}`}
                  className="absolute inset-0 m-auto grid size-(--size-control-sm) place-items-center rounded-pill text-fg opacity-0 group-hover:opacity-100 focus-visible:opacity-100 @max-xl:opacity-100"
                >
                  {playing ? <Pause aria-hidden="true" className="size-(--size-icon-sm) fill-current" /> : <Play aria-hidden="true" className="size-(--size-icon-sm) fill-current" />}
                </button>
              </span>
              <span className="flex min-w-0 items-center gap-3">
                <Cover src={t.cover_url} className="size-(--size-artwork-xs) rounded-art-sm" />
                <span className="flex min-w-0 flex-col">
                  <span className={cn('truncate type-label-md', current && 'text-accent-fg')}>{t.title}</span>
                  <span className="truncate type-body-sm text-fg-muted">
                    {downloaded.has(t.id) ? <span className="me-1.5 rounded-ui-xs bg-fill px-1 type-label-sm">İndirildi</span> : null}
                    {t.artist}
                  </span>
                </span>
              </span>
              <span className="min-w-0 truncate type-body-sm text-fg-muted @max-xl:hidden">
                {showAlbum && t.album ? (
                  <a href={href({ name: 'album', artist: t.artist, title: t.album })} className="hover:text-fg hover:underline">
                    {t.album}
                  </a>
                ) : null}
              </span>
              <LikeButton songId={t.id} title={t.title} />
              <span className="text-end type-body-sm text-fg-muted @max-xl:hidden">{t.duration ? formatDuration(t.duration) : <><span aria-hidden="true">-</span><span className="sr-only">Süre bilinmiyor</span></>}</span>
              <SongMenu track={t} onRemove={onRemove ? () => onRemove(t) : undefined} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
