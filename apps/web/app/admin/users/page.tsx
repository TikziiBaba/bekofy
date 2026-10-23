import { admin, formatRelative } from '@bekofy/core';
import { Button, buttonVariants, Input } from '@bekofy/ui';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { UserControls } from '@/components/admin/user-row';
import { Avatar } from '@/components/avatar';
import { PageHead } from '@/components/panel';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/viewer';

export const metadata = { title: 'Kullanıcılar' };

const PAGE_SIZE = 30;

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams;
  const q = params.q?.trim() ?? '';
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const [sb, viewer] = await Promise.all([createClient(), getViewer()]);
  const users = await admin.listUsers(sb, { search: q, limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE }).catch(() => null);
  const hasNext = (users?.length ?? 0) > PAGE_SIZE;
  const list = users?.slice(0, PAGE_SIZE) ?? [];
  const pageHref = (p: number) => `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString()}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Kullanıcılar" description="Rol, Premium ve askı durumu. Premium ödemeleri açılana kadar Premium buradan elle verilir." />
      <form action="/admin/users" role="search" className="flex max-w-(--size-layout-measure) gap-2">
        <label htmlFor="user-search" className="sr-only">
          Kullanıcı adıyla ara
        </label>
        <Input id="user-search" name="q" type="search" defaultValue={q} placeholder="Kullanıcı adı" />
        <Button type="submit" variant="secondary" aria-label="Ara">
          <Search aria-hidden="true" />
        </Button>
      </form>

      {users === null ? <p className="text-danger-fg">Kullanıcılar alınamadı. Sayfayı yenile.</p> : null}
      {list.length ? (
        <ul className="flex flex-col gap-2">
          {list.map((u) => (
            <li key={u.id} className="glass-panel flex flex-col gap-4 rounded-ui-lg p-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar src={u.avatar_url} name={u.username} />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate type-label-md">{u.username ? `@${u.username}` : 'Kullanıcı adı yok'}</span>
                  <span className="truncate type-body-sm text-fg-muted">
                    Katıldı {formatRelative(u.created_at)} · son etkinlik {formatRelative(u.last_activity)}
                  </span>
                </div>
              </div>
              <UserControls id={u.id} username={u.username ?? 'adsız'} role={u.role} premium={u.is_premium} banned={u.is_banned} self={u.id === viewer?.user.id} />
            </li>
          ))}
        </ul>
      ) : users ? (
        <p className="text-fg-muted">{q ? `“${q}” ile eşleşen kullanıcı yok.` : 'Kullanıcı yok.'}</p>
      ) : null}

      {page > 1 || hasNext ? (
        <nav aria-label="Sayfalar" className="flex justify-between gap-3">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              Önceki
            </Link>
          ) : (
            <span />
          )}
          {hasNext ? (
            <Link href={pageHref(page + 1)} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              Sonraki
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
