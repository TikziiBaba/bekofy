import { BekofyLogo, buttonVariants } from '@bekofy/ui';
import Link from 'next/link';
import { getViewer } from '@/lib/viewer';
import { ThemeToggle } from './theme-toggle';

const NAV = [
  { href: '/#features', label: 'Özellikler' },
  { href: '/premium', label: 'Premium' },
  { href: '/#download', label: 'İndir' },
];

export async function SiteHeader() {
  const viewer = await getViewer();
  return (
    <header className="sticky top-0 z-(--z-sticky) glass-chrome border-x-0 border-t-0">
      {/* Çok dar ekranda (288 pikselden dar içerik) yazı gizlenir, işaret kalır. */}
      <div className="@container mx-auto flex w-full max-w-(--size-layout-content) items-center gap-1 px-3 py-3 sm:gap-6 sm:px-6">
        <Link href="/" aria-label="Bekofy ana sayfa" className="rounded-ui-sm">
          <BekofyLogo wordmarkClassName="@max-2xs:sr-only" />
        </Link>
        <nav aria-label="Site" className="hidden gap-1 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {viewer ? (
            <>
              {viewer.isAdmin ? (
                <Link href="/admin" className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'hidden sm:inline-flex' })}>
                  Admin
                </Link>
              ) : null}
              <Link href="/account" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                Hesabım
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                Giriş yap
              </Link>
              <Link href="/register" className={buttonVariants({ variant: 'primary', size: 'sm', className: 'hidden sm:inline-flex' })}>
                Kayıt ol
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
