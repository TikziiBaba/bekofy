import { cn } from './cn';

/** Bemol işareti (packages/brand/src/bekofy-mark.svg ile aynı yol). Rengi currentColor'dan alır. */
const MARK_PATH =
  'M25 14.5A6.5 6.5 0 0 1 38 14.5V85.5A6.5 6.5 0 0 1 25 85.5ZM31 48C55 34 84 42 76 64C71 79 50 88 31 92ZM38 60L38 78C48 75 62 70 65 63C68 54 52 50 38 60Z';

export function BekofyMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={cn('size-(--size-icon-lg) fill-current text-brand', className)}>
      <path d={MARK_PATH} />
    </svg>
  );
}

/** İşaret + "bekofy" yazısı. Bağlantı içinde kullanılırsa erişilebilir adı bağlantı verir. */
export function BekofyLogo({ className, wordmarkClassName }: { className?: string; wordmarkClassName?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-fg', className)}>
      <BekofyMark />
      <span className={cn('font-display text-(length:--font-size-2xl) leading-none font-bold tracking-(--font-letter-spacing-display)', wordmarkClassName)}>bekofy</span>
    </span>
  );
}
