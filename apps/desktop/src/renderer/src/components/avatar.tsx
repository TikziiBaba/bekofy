import { cn } from '@bekofy/ui';
import { useState } from 'react';

/** Profil görseli; yoksa adın ilk harfi. Ad yanında yazılı olduğundan süstür. */
export function Avatar({ src, name, className }: { src?: string | null; name?: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  const initial = (name ?? '?').replace(/^@/, '').trim().charAt(0).toLocaleUpperCase('tr-TR') || '?';
  if (src && !failed) return <img src={src} alt="" draggable={false} onError={() => setFailed(true)} className={cn('size-(--size-control-lg) shrink-0 rounded-pill object-cover', className)} />;
  return (
    <span aria-hidden="true" className={cn('grid size-(--size-control-lg) shrink-0 place-items-center rounded-pill bg-inverse type-label-md text-fg-inverse', className)}>
      {initial}
    </span>
  );
}
