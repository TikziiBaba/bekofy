import { cn } from '@bekofy/ui';
import type { ReactNode } from 'react';

/** Hesap, sanatçı ve admin sayfalarındaki bölüm kartı: başlık, isteğe bağlı açıklama ve sağda eylem. */
export function Panel({
  id,
  title,
  description,
  action,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className={cn('glass-panel flex flex-col gap-6 rounded-ui-xl p-5 sm:p-6', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={`${id}-title`} className="type-title-md">
            {title}
          </h2>
          {description ? <p className="type-body-sm text-fg-muted">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Sayfa başlığı: h1 + açıklama + eylemler. */
export function PageHead({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="type-title-xl">{title}</h1>
        {description ? <p className="max-w-(--size-layout-measure) text-fg-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** Sayı kartı (istatistik). */
export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-ui-lg bg-fill p-4">
      <span className="type-body-sm text-fg-muted">{label}</span>
      <strong className="font-display text-(length:--font-size-3xl) leading-none font-bold">{value}</strong>
      {hint ? <span className="type-caption text-fg-muted">{hint}</span> : null}
    </div>
  );
}
