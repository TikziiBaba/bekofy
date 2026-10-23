import { cn } from '@bekofy/ui';
import { useState } from 'react';

/** Şarkı, liste ya da sanatçı görseli; yoksa ya da yüklenemezse desen. Süs: ad yanında yazılıdır. */
export function Cover({ src, className, round = false }: { src?: string | null; className?: string; round?: boolean }) {
  const [failed, setFailed] = useState(false);
  const shape = round ? 'rounded-pill' : 'rounded-art-md';
  if (!src || failed) return <span aria-hidden="true" className={cn('art block shrink-0', shape, className)} />;
  return <img src={src} alt="" loading="lazy" draggable={false} onError={() => setFailed(true)} className={cn('aspect-square shrink-0 object-cover', shape, className)} />;
}
