// Mini oynatıcı penceresi: her zaman üstte, küçük. Durum ana pencereden gelir, komutlar ana pencereye gider.

import { formatDuration } from '@bekofy/core';
import { IconButton } from '@bekofy/ui';
import { Maximize2, Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { PlayerSnapshot } from '../../shared/ipc';
import { Cover } from './components/cover';
import { bridge } from './lib/bridge';
import './lib/settings';
import './styles.css';

function Mini() {
  const [snap, setSnap] = useState<PlayerSnapshot | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => bridge?.miniWindow.onSnapshot(setSnap), []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const song = snap?.song ?? null;
  const position = snap ? Math.min(snap.position + (snap.isPlaying ? (now - snap.at) / 1000 : 0), song?.duration || Infinity) : 0;
  const pct = song?.duration ? (position / song.duration) * 100 : 0;
  const cmd = (c: Parameters<NonNullable<typeof bridge>['miniWindow']['command']>[0]) => bridge?.miniWindow.command(c);

  return (
    <main className="drag relative grid h-full grid-cols-[var(--size-artwork-md)_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden bg-raised px-3">
      <Cover src={song?.coverUrl} className="size-(--size-artwork-md) rounded-art-sm" />
      <div className="flex min-w-0 flex-col">
        <span className="truncate type-label-md">{song?.title ?? 'Bir şey çalmıyor'}</span>
        <span className="truncate type-body-sm text-fg-muted">{song ? `${song.artist} · ${formatDuration(position)}` : 'Bekofy'}</span>
      </div>
      <div className="no-drag flex items-center gap-0.5">
        <IconButton size="sm" label="Önceki" onClick={() => cmd('previous')} disabled={!song}>
          <SkipBack aria-hidden="true" className="fill-current" />
        </IconButton>
        <button
          type="button"
          aria-label={snap?.isPlaying ? 'Duraklat' : 'Çal'}
          onClick={() => cmd('toggle-play')}
          disabled={!song}
          className="grid size-(--size-control-md) place-items-center rounded-pill bg-accent text-on-accent hover:bg-accent-hover disabled:opacity-(--opacity-disabled)"
        >
          {snap?.isPlaying ? <Pause aria-hidden="true" className="size-(--size-icon-sm) fill-current" /> : <Play aria-hidden="true" className="size-(--size-icon-sm) fill-current" />}
        </button>
        <IconButton size="sm" label="Sonraki" onClick={() => cmd('next')} disabled={!song}>
          <SkipForward aria-hidden="true" className="fill-current" />
        </IconButton>
        <IconButton size="sm" label="Büyük pencereye dön" onClick={() => cmd('open-main')}>
          <Maximize2 aria-hidden="true" />
        </IconButton>
        <IconButton size="sm" label="Mini oynatıcıyı kapat" onClick={() => cmd('close')}>
          <X aria-hidden="true" />
        </IconButton>
      </div>
      <div aria-hidden="true" className="absolute inset-x-3 bottom-1 h-0.5 rounded-pill bg-fill-strong">
        <div className="h-full rounded-pill bg-accent-fg" style={{ width: `${pct}%` }} />
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Mini />
  </StrictMode>,
);
