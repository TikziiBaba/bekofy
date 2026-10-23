import type { ReactNode } from 'react';
import { cn } from './cn';

const TONES = {
  ok: 'text-success-fg',
  off: 'text-danger-fg',
  pending: 'text-warning-fg',
  info: 'text-info-fg',
  neutral: 'text-fg-muted',
} as const;

/** Durum etiketi. Renk tek başına anlam taşımaz: metin her zaman yazılır. */
export function StatusPill({ tone = 'neutral', children, className }: { tone?: keyof typeof TONES; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex min-h-(--size-control-sm) items-center gap-2 rounded-pill border border-line px-3 type-label-sm whitespace-nowrap', TONES[tone], className)}>
      <span aria-hidden="true" className="size-2 shrink-0 rounded-pill bg-current" />
      {children}
    </span>
  );
}
