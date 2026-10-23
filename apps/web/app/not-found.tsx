import { BekofyMark, buttonVariants } from '@bekofy/ui';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main" className="relative isolate grid min-h-dvh place-items-center px-4">
      <div aria-hidden="true" className="ambient pointer-events-none fixed inset-0 -z-10" />
      <div className="flex max-w-(--size-layout-measure) flex-col items-start gap-5">
        <BekofyMark className="size-(--size-control-lg)" />
        <h1 className="type-headline">Bu sayfa yok.</h1>
        <p className="text-fg-muted">Adres yanlış yazılmış ya da sayfa kaldırılmış olabilir. Ana sayfadan devam et.</p>
        <Link href="/" className={buttonVariants()}>
          Ana sayfaya dön
        </Link>
      </div>
    </main>
  );
}
