import { BekofyMark } from '@bekofy/ui';
import Link from 'next/link';
import { RELEASES_URL } from '@/lib/site';

const LINKS = [
  { href: '/#features', label: 'Özellikler' },
  { href: '/premium', label: 'Premium' },
  { href: '/#download', label: 'İndir' },
  { href: '/artist', label: 'Sanatçılar için' },
  { href: '/account', label: 'Hesabım' },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-(--size-layout-content) flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-8">
        <div className="flex items-center gap-2 text-fg-muted type-body-sm">
          <BekofyMark className="size-(--size-icon-md)" />
          <span>© {new Date().getFullYear()} Bekofy</span>
        </div>
        <nav aria-label="Alt bilgi">
          <ul className="flex flex-wrap gap-x-6 gap-y-3 type-body-sm">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-fg-muted hover:text-fg hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <a href={RELEASES_URL} className="text-fg-muted hover:text-fg hover:underline" rel="noopener">
                Sürüm notları
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
