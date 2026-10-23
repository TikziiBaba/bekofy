// Alttaki oynatıcı çubuğu: çalan şarkı, denetimler, ilerleme, ses ve paneller.

import { formatDuration } from '@bekofy/core';
import { cn, IconButton } from '@bekofy/ui';
import { ListMusic, Maximize2, MicVocal, Pause, PictureInPicture2, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from 'lucide-react';
import { Cover } from '../components/cover';
import { LikeButton } from '../components/like-button';
import { bridge } from '../lib/bridge';
import { player, usePlayer } from '../lib/player';
import { setUi, useUi } from '../lib/ui';

export function PlayButton({ playing, label, size = 'md', onClick, disabled }: { playing: boolean; label: string; size?: 'sm' | 'md' | 'xl'; onClick: () => void; disabled?: boolean }) {
  const dims = { sm: 'size-(--size-control-md)', md: 'size-(--size-control-lg)', xl: 'size-(--size-control-xl)' }[size];
  const Icon = playing ? Pause : Play;
  return (
    <button
      type="button"
      aria-label={`${playing ? 'Duraklat' : 'Çal'}: ${label}`}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'grid shrink-0 place-items-center rounded-pill bg-accent text-on-accent transition-transform duration-(--duration-fast) ease-standard hover:scale-104 hover:bg-accent-hover active:scale-96 disabled:opacity-(--opacity-disabled) disabled:hover:scale-100',
        dims,
      )}
    >
      <Icon aria-hidden="true" className="size-(--size-icon-md) fill-current" />
    </button>
  );
}

export function Seek({ compact = false }: { compact?: boolean }) {
  const p = usePlayer();
  const duration = p.duration || p.current?.duration || 0;
  const pct = duration ? (p.position / duration) * 100 : 0;
  return (
    <div className="grid w-full grid-cols-[var(--space-10)_minmax(0,1fr)_var(--space-10)] items-center gap-2">
      <time className={cn('text-center type-caption text-fg-muted', compact && 'sr-only')}>{formatDuration(p.position)}</time>
      <input
        type="range"
        className="slider"
        aria-label="Şarkıda konum"
        aria-valuetext={`${formatDuration(p.position)} / ${formatDuration(duration)}`}
        min={0}
        max={duration || 1}
        step={1}
        value={Math.min(p.position, duration || 1)}
        disabled={!p.current}
        style={{ ['--val' as string]: `${pct}%` }}
        onChange={(e) => player.seek(Number(e.target.value))}
      />
      <time className={cn('text-center type-caption text-fg-muted', compact && 'sr-only')}>{formatDuration(duration)}</time>
    </div>
  );
}

export function PlayerBar() {
  const p = usePlayer();
  const ui = useUi();
  const t = p.current;
  const repeatLabel = p.queue.repeat === 'off' ? 'Tekrar: kapalı' : p.queue.repeat === 'all' ? 'Tekrar: tüm liste' : 'Tekrar: bu şarkı';
  const VolumeIcon = p.muted || p.volume === 0 ? VolumeX : p.volume < 0.5 ? Volume1 : Volume2;

  return (
    <section aria-label="Oynatıcı" className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)] items-center gap-6 px-4">
      <div className="flex min-w-0 items-center gap-3">
        {t ? (
          <>
            <button type="button" onClick={() => setUi({ nowPlaying: 'lyrics' })} aria-label="Şimdi çalıyor ekranını aç" className="shrink-0 rounded-art-md">
              <Cover src={t.cover_url} className="size-(--size-artwork-md) rounded-art-md" />
            </button>
            <div className="flex min-w-0 flex-col">
              <span className="truncate type-label-md">{t.title}</span>
              <span className="truncate type-body-sm text-fg-muted">{t.artist}</span>
            </div>
            <LikeButton songId={t.id} title={t.title} />
          </>
        ) : (
          <p className="type-body-sm text-fg-muted">Bir şarkı seç, burada çalsın.</p>
        )}
      </div>

      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-3">
          <IconButton size="sm" label="Karışık çal" aria-pressed={p.queue.shuffle} onClick={() => player.toggleShuffle()}>
            <Shuffle aria-hidden="true" />
          </IconButton>
          <IconButton label="Önceki" onClick={() => player.previous()} disabled={!t}>
            <SkipBack aria-hidden="true" className="fill-current" />
          </IconButton>
          <PlayButton playing={p.isPlaying} label={t?.title ?? 'şarkı yok'} onClick={() => player.toggle()} disabled={!t} />
          <IconButton label="Sonraki" onClick={() => player.next()} disabled={!t}>
            <SkipForward aria-hidden="true" className="fill-current" />
          </IconButton>
          <IconButton size="sm" label={repeatLabel} aria-pressed={p.queue.repeat !== 'off'} onClick={() => player.cycleRepeat()}>
            {p.queue.repeat === 'one' ? <Repeat1 aria-hidden="true" /> : <Repeat aria-hidden="true" />}
          </IconButton>
        </div>
        <div className="w-full max-w-[calc(var(--size-layout-panel)*1.8)]">
          <Seek />
        </div>
        {p.error ? (
          <p role="alert" className="type-caption text-danger-fg">
            {p.error}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-1">
        <IconButton size="sm" label="Şarkı sözleri" aria-pressed={ui.nowPlaying === 'lyrics'} onClick={() => setUi({ nowPlaying: ui.nowPlaying ? null : 'lyrics' })} disabled={!t}>
          <MicVocal aria-hidden="true" />
        </IconButton>
        <IconButton size="sm" label="Sıradaki şarkılar" aria-pressed={ui.panel === 'queue'} className="hidden xl:inline-grid" onClick={() => setUi({ panel: ui.panel === 'queue' ? 'friends' : 'queue' })}>
          <ListMusic aria-hidden="true" />
        </IconButton>
        {bridge ? (
          <IconButton size="sm" label="Mini oynatıcı" aria-pressed={ui.miniOpen} onClick={() => bridge?.mini.toggle()}>
            <PictureInPicture2 aria-hidden="true" />
          </IconButton>
        ) : null}
        <IconButton size="sm" label={p.muted ? 'Sesi aç' : 'Sesi kapat'} onClick={() => player.toggleMute()}>
          <VolumeIcon aria-hidden="true" />
        </IconButton>
        <input
          type="range"
          className="slider hidden w-[calc(var(--size-artwork-md)+var(--space-8))] lg:block"
          aria-label="Ses düzeyi"
          aria-valuetext={`%${Math.round((p.muted ? 0 : p.volume) * 100)}`}
          min={0}
          max={100}
          value={Math.round((p.muted ? 0 : p.volume) * 100)}
          style={{ ['--val' as string]: `${(p.muted ? 0 : p.volume) * 100}%` }}
          onChange={(e) => player.setVolume(Number(e.target.value) / 100)}
        />
        <IconButton size="sm" label="Şimdi çalıyor ekranı" onClick={() => setUi({ nowPlaying: 'lyrics' })} disabled={!t}>
          <Maximize2 aria-hidden="true" />
        </IconButton>
      </div>
    </section>
  );
}
