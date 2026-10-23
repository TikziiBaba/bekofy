'use client';

import { cn } from '@bekofy/ui';
import { ChartColumn, Clapperboard, History, Music, UserPlus, Users, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS: Array<{ href: string; label: string; Icon: LucideIcon }> = [
  { href: '/admin', label: 'Genel bakış', Icon: ChartColumn },
  { href: '/admin/songs', label: 'Şarkılar', Icon: Music },
  { href: '/admin/import', label: 'YouTube’dan ekle', Icon: Clapperboard },
  { href: '/admin/users', label: 'Kullanıcılar', Icon: Users },
  { href: '/admin/artist-requests', label: 'Sanatçı başvuruları', Icon: UserPlus },
  { href: '/admin/logs', label: 'Giriş kayıtları', Icon: History },
];

export function AdminNav({ badges }: { badges: Partial<Record<string, number>> }) {
  const path = usePathname();
  const current = (href: string) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(`${href}/`));
  return (
    <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = current(href);
        const count = badges[href];
        return (
          <li key={href} className="shrink-0">
            <Link
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex min-h-(--size-touch) items-center gap-3 rounded-ui-control px-3 type-label-md whitespace-nowrap text-fg-muted hover:bg-hover hover:text-fg',
                active && 'bg-fill text-fg before:absolute before:inset-y-3 before:start-0 before:w-0.5 before:rounded-pill before:bg-accent-fg',
              )}
            >
              <Icon aria-hidden="true" className="size-(--size-icon-sm) shrink-0" />
              <span>{label}</span>
              {count ? (
                <span className="ms-auto rounded-pill bg-accent px-2 type-label-sm text-on-accent">
                  {count}
                  <span className="sr-only"> bekleyen</span>
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
