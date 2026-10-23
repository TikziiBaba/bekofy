import { cn } from '@bekofy/ui';

/** Profil görseli; yoksa kullanıcı adının ilk harfi. Adı yanında yazılı olduğundan alt metin boş. */
export function Avatar({ src, name, className }: { src?: string | null; name?: string | null; className?: string }) {
  const initial = (name ?? '?').trim().charAt(0).toLocaleUpperCase('tr-TR') || '?';
  return src ? (
    <img src={src} alt="" className={cn('size-(--size-control-lg) shrink-0 rounded-pill object-cover', className)} />
  ) : (
    <span aria-hidden="true" className={cn('grid size-(--size-control-lg) shrink-0 place-items-center rounded-pill bg-inverse type-label-md text-fg-inverse', className)}>
      {initial}
    </span>
  );
}
