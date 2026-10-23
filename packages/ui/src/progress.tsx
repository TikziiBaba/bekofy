import { cn } from './cn';

/** İlerleme çubuğu (0-100). Adı label ile verilir; yüzde ekran okuyucuya aria-valuenow ile gider. */
export function Progress({ value, label, className }: { value: number; label: string; className?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} className={cn('h-2 overflow-hidden rounded-pill bg-fill-strong', className)}>
      <div className="h-full rounded-pill bg-accent-fg transition-[width] duration-(--duration-base) ease-standard" style={{ width: `${v}%` }} />
    </div>
  );
}
