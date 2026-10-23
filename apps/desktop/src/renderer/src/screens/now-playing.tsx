// Şimdi çalıyor: tam ekran katman. Yerleşik <dialog>: odak içeride kalır, Escape kapatır.

import { activeLineIndex, fetchLyrics, getSong, storedLyrics } from '@bekofy/core';
import { cn, IconButton } from '@bekofy/ui';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Cover } from '../components/cover';
import { LikeButton } from '../components/like-button';
import { QueueList } from '../components/queue-list';
import { player, usePlayer } from '../lib/player';
import { useAuthed } from '../lib/session';
import { setUi } from '../lib/ui';
import { PlayButton, Seek } from '../shell/player-bar';

export function NowPlaying({ tab }: { tab: 'lyrics' | 'queue' }) {
  const ref = useRef<HTMLDialogElement>(null);
  const p = usePlayer();
  const t = p.current;

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const close = () => setUi({ nowPlaying: null });

  return (
    <dialog
      ref={ref}
      aria-label="Şimdi çalıyor"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none overflow-hidden bg-page p-0 text-fg backdrop:bg-transparent motion-safe:animate-[rise_var(--duration-moderate)_var(--easing-emphasized)]"
    >
      <div aria-hidden="true" className="ambient pointer-events-none absolute inset-0" />
      <div className="relative flex h-full flex-col">
        <div className="drag flex h-(--title-bar-height) shrink-0 items-center px-3">
          <IconButton size="sm" label="Kapat" className="no-drag" onClick={close} autoFocus>
            <ChevronDown aria-hidden="true" />
          </IconButton>
        </div>
        {t ? (
          <div className="mx-auto grid min-h-0 w-full max-w-(--size-layout-content) flex-1 grid-cols-1 gap-12 px-12 pb-8 lg:grid-cols-2">
            <div className="flex min-h-0 flex-col justify-center gap-6">
              <Cover src={t.cover_url} className={cn('w-[min(100%,var(--size-artwork-2xl))] self-center rounded-art-lg shadow-ui-lg transition-transform duration-(--duration-slow) ease-emphasized', !p.isPlaying && 'scale-92')} />
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 flex-col">
                  <h2 className="font-display text-(length:--font-size-3xl) leading-(--font-line-height-tight) font-bold tracking-(--font-letter-spacing-tight) [overflow-wrap:anywhere]">{t.title}</h2>
                  <p className="truncate type-body-lg text-fg-muted">{t.artist}</p>
                </div>
                <LikeButton songId={t.id} title={t.title} size="md" />
              </div>
              <Seek />
              <div className="flex items-center justify-center gap-6">
                <IconButton label="Karışık çal" aria-pressed={p.queue.shuffle} onClick={() => player.toggleShuffle()}>
                  <Shuffle aria-hidden="true" />
                </IconButton>
                <IconButton label="Önceki" onClick={() => player.previous()}>
                  <SkipBack aria-hidden="true" className="fill-current" />
                </IconButton>
                <PlayButton size="xl" playing={p.isPlaying} label={t.title} onClick={() => player.toggle()} />
                <IconButton label="Sonraki" onClick={() => player.next()}>
                  <SkipForward aria-hidden="true" className="fill-current" />
                </IconButton>
                <IconButton label={p.queue.repeat === 'one' ? 'Tekrar: bu şarkı' : p.queue.repeat === 'all' ? 'Tekrar: tüm liste' : 'Tekrar: kapalı'} aria-pressed={p.queue.repeat !== 'off'} onClick={() => player.cycleRepeat()}>
                  {p.queue.repeat === 'one' ? <Repeat1 aria-hidden="true" /> : <Repeat aria-hidden="true" />}
                </IconButton>
              </div>
            </div>
            <div className="flex min-h-0 flex-col gap-4">
              <div role="group" aria-label="Görünüm" className="flex gap-1 self-start rounded-pill bg-fill p-1">
                {(['lyrics', 'queue'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={tab === k}
                    onClick={() => setUi({ nowPlaying: k })}
                    className={cn('min-h-(--size-control-sm) rounded-pill px-4 type-label-md text-fg-muted hover:text-fg', tab === k && 'bg-glass text-fg shadow-ui-sm')}
                  >
                    {k === 'lyrics' ? 'Sözler' : 'Sıradaki'}
                  </button>
                ))}
              </div>
              <div className={cn('min-h-0 flex-1', tab === 'lyrics' ? 'overflow-hidden' : 'scroll-thin overflow-y-auto')}>{tab === 'lyrics' ? <Lyrics songId={t.id} /> : <QueueList />}</div>
            </div>
          </div>
        ) : (
          <p className="p-12 text-fg-muted">Şu an bir şey çalmıyor.</p>
        )}
      </div>
    </dialog>
  );
}

function Lyrics({ songId }: { songId: string }) {
  const { sb } = useAuthed();
  const p = usePlayer();
  const box = useRef<HTMLDivElement>(null);
  const q = useQuery({
    queryKey: ['lyrics', songId],
    staleTime: Infinity,
    queryFn: async () => {
      const song = await getSong(sb, songId);
      return storedLyrics(song) ?? (await fetchLyrics(song));
    },
  });
  const synced = q.data?.synced ?? null;
  const active = synced ? activeLineIndex(synced, p.position + 0.2) : -1;

  // Etkin satırı kutunun ortasına getir (yalnızca söz kutusu kayar, sayfa kaymaz).
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>(`[data-line="${active}"]`);
    const b = box.current;
    if (!el || !b) return;
    const target = el.offsetTop - b.clientHeight / 2 + el.clientHeight / 2;
    b.scrollTo({ top: target, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [active]);

  if (q.isLoading) return <p className="text-fg-muted">Sözler aranıyor</p>;
  if (!q.data) return <p className="text-fg-muted">Bu şarkının sözleri bulunamadı.</p>;
  if (!synced) return <p className="selectable scroll-thin h-full overflow-y-auto whitespace-pre-line type-body-lg">{q.data.plain}</p>;

  return (
    <div ref={box} className="scroll-thin relative flex h-full flex-col gap-3 overflow-x-hidden overflow-y-auto pe-6 pb-24">
      {synced.map((line, i) => (
        <button
          key={`${line.time}-${i}`}
          type="button"
          data-line={i}
          aria-current={i === active ? 'true' : undefined}
          onClick={() => player.seek(line.time)}
          className={cn(
            'origin-left text-start font-display text-(length:--font-size-2xl) leading-(--font-line-height-snug) font-bold tracking-(--font-letter-spacing-tight) text-fg-muted transition-[color,transform] duration-(--duration-base) ease-standard hover:text-fg',
            i === active && 'scale-103 text-fg',
          )}
        >
          {line.text || '...'}
        </button>
      ))}
    </div>
  );
}
