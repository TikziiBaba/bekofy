import { BekofyLogo } from '@bekofy/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AdminNav } from '@/components/admin/admin-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { ToastRegion } from '@/components/toast';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/viewer';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Admin · Bekofy' }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  const sb = await createClient();
  const [songs, requests] = await Promise.all([
    sb.from('songs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('artist_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  return (
    <div className="relative isolate min-h-dvh lg:grid lg:grid-cols-[var(--size-layout-sidebar)_minmax(0,1fr)] lg:gap-2 lg:p-2">
      <div aria-hidden="true" className="ambient pointer-events-none fixed inset-0 -z-10" />
      <nav aria-label="Admin menüsü" className="glass-chrome sticky top-0 z-(--z-sticky) flex flex-col gap-3 border-x-0 border-t-0 px-3 py-3 lg:top-2 lg:h-[calc(100dvh-var(--space-4))] lg:gap-6 lg:rounded-ui-card lg:border lg:px-3 lg:py-5">
        <div className="flex items-center justify-between gap-2 px-1 lg:px-2">
          <Link href="/" aria-label="Bekofy siteye dön" className="rounded-ui-sm">
            <BekofyLogo />
          </Link>
          <ThemeToggle />
        </div>
        <AdminNav badges={{ '/admin/songs': songs.count ?? 0, '/admin/artist-requests': requests.count ?? 0 }} />
        <div className="mt-auto hidden flex-col gap-1 rounded-ui-control bg-fill p-3 type-body-sm lg:flex">
          <Link href="/account" className="text-accent-fg hover:underline">
            Hesabıma dön
          </Link>
        </div>
      </nav>
      <main id="main" tabIndex={-1} className="min-w-0 px-4 py-6 outline-none sm:px-6 lg:glass-panel lg:rounded-ui-card lg:p-8">
        {children}
      </main>
      <ToastRegion />
    </div>
  );
}
