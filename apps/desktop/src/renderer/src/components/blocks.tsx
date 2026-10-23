// Ekranların ortak yapı taşları.

import { formatTotalDuration } from '@bekofy/core';
import { Button, cn } from '@bekofy/ui';
import type { ReactNode } from 'react';
import { Cover } from './cover';

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="type-title-xl">{children}</h1>;
}

export function Section({ id, title, action, children, className }: { id: string; title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={id} className="type-title-lg">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Yatay kaydırılan kart rafı. */
export function Shelf({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="scroll-thin -mx-2 grid auto-cols-(--size-artwork-lg) grid-flow-col gap-4 overflow-x-auto px-2 pb-2">
      {children}
    </ul>
  );
}

/** Kapaklı kart; tüm kart bağlantıdır, çal düğmesi ayrı. */
export function Card({ href, cover, title, sub, round = false, onPlay, playLabel }: { href: string; cover: string | null | undefined; title: string; sub: string; round?: boolean; onPlay?: () => void; playLabel?: string }) {
  return (
    <li className="group relative flex min-w-0 flex-col gap-3 rounded-ui-lg p-2 hover:bg-hover">
      <Cover src={cover} round={round} className={cn('w-full shadow-ui-md', round ? 'rounded-pill' : 'rounded-art-md')} />
      <a href={href} className="flex min-w-0 flex-col after:absolute after:inset-0 after:rounded-ui-lg">
        <span className="truncate type-label-md">{title}</span>
        <span className="truncate type-body-sm text-fg-muted">{sub}</span>
      </a>
      {onPlay ? (
        <button
          type="button"
          aria-label={playLabel ?? `Çal: ${title}`}
          onClick={onPlay}
          className="absolute end-4 top-[calc(var(--size-artwork-lg)-var(--size-control-md)-var(--space-2))] z-(--z-raised) grid size-(--size-control-md) translate-y-2 place-items-center rounded-pill bg-accent text-on-accent opacity-0 shadow-ui-md transition-[opacity,transform] duration-(--duration-base) ease-enter group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-(--size-icon-sm) fill-current">
            <path d="M8 5.5v13l10.5-6.5z" />
          </svg>
        </button>
      ) : null}
    </li>
  );
}

/** Çalma listesi, albüm, sanatçı, profil başlığı. */
export function CollectionHead({ kind, title, cover, round = false, meta, description, children }: { kind: string; title: string; cover?: string | null; round?: boolean; meta?: ReactNode; description?: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-8">
      {children ?? <Cover src={cover} round={round} className="w-(--size-artwork-xl) max-w-full shadow-ui-lg rounded-art-lg" />}
      <div className="flex min-w-0 flex-col gap-3">
        <span className="type-label-md text-fg-muted">{kind}</span>
        <h1 className="font-display text-[clamp(var(--font-size-4xl),5vw,var(--font-size-6xl))] leading-(--font-line-height-display) font-bold tracking-(--font-letter-spacing-display) [overflow-wrap:anywhere]">{title}</h1>
        {description ? <p className="max-w-(--size-layout-measure) text-fg-muted">{description}</p> : null}
        {meta ? <div className="flex flex-wrap items-center gap-2 type-body-sm text-fg-muted">{meta}</div> : null}
      </div>
    </header>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="glass-panel flex flex-col items-start gap-3 rounded-ui-xl p-8">
      <h2 className="type-title-md">{title}</h2>
      {children ? <p className="max-w-(--size-layout-measure) text-fg-muted">{children}</p> : null}
      {action}
    </div>
  );
}

/** Yükleniyor ve hata durumları; veri gelince çocuklar çizilir. */
export function Loadable<T>({ query, children, label }: { query: { data: T | undefined; isLoading: boolean; error: unknown; refetch: () => unknown }; children: (data: T) => ReactNode; label: string }) {
  if (query.isLoading) {
    return (
      <div role="status" aria-label={`${label} yükleniyor`} className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-(--size-control-lg) animate-pulse rounded-ui-md bg-fill" />
        ))}
      </div>
    );
  }
  if (query.error || query.data === undefined) {
    return (
      <Empty title={`${label} alınamadı`} action={<Button variant="secondary" onClick={() => void query.refetch()}>Tekrar dene</Button>}>
        {query.error instanceof Error ? query.error.message : 'İnternet bağlantını kontrol edip tekrar dene.'}
      </Empty>
    );
  }
  return <>{children(query.data)}</>;
}

/** "12 şarkı, 48 dk". Süresi bilinmeyen eski kayıtlar varsa ve toplam bir dakikanın altındaysa süre yazılmaz. */
export function songCount(tracks: ReadonlyArray<{ duration: number | null }>): string {
  const total = tracks.reduce((s, t) => s + (t.duration ?? 0), 0);
  return total >= 60 ? `${tracks.length} şarkı, ${formatTotalDuration(total)}` : `${tracks.length} şarkı`;
}
