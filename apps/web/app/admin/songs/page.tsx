import { formatDuration, formatRelative, searchTerm } from '@bekofy/core';
import { Button, buttonVariants, cn, Input } from '@bekofy/ui';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { SongActions } from '@/components/admin/song-actions';
import { PageHead } from '@/components/panel';
import { SongStatus } from '@/components/song-status';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Şarkılar' };

const PAGE_SIZE = 30;
const FILTERS = [
  { value: 'all', label: 'Tümü' },
  { value: 'pending', label: 'Onay bekleyen' },
  { value: 'approved', label: 'Yayında' },
  { value: 'rejected', label: 'Reddedilen' },
] as const;
type Filter = (typeof FILTERS)[number]['value'];

export default async function AdminSongs({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const params = await searchParams;
  const status: Filter = FILTERS.some((f) => f.value === params.status) ? (params.status as Filter) : 'all';
  const q = params.q?.trim() ?? '';
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const sb = await createClient();

  let query = sb.from('songs').select('*', { count: 'exact' });
  if (status !== 'all') query = query.eq('status', status);
  const term = searchTerm(q);
  if (term) query = query.or(`title.ilike.%${term}%,artist.ilike.%${term}%`);
  const res = await query.order('created_at', { ascending: status === 'pending' }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const songs = res.data ?? [];
  const total = res.count ?? 0;

  // Yükleyen kullanıcıların adları (sanatçı yüklemeleri için).
  const uploaderIds = [...new Set(songs.map((s) => s.uploaded_by).filter((x): x is string => Boolean(x)))];
  const uploaders = new Map<string, string>();
  if (uploaderIds.length) {
    const p = await sb.from('profiles').select('id, username').in('id', uploaderIds);
    for (const row of p.data ?? []) uploaders.set(row.id, row.username ?? 'adsız');
  }

  const href = (next: Partial<{ q: string; status: string; page: number }>) => {
    const sp = new URLSearchParams();
    const merged = { q, status, page: 1, ...next };
    if (merged.q) sp.set('q', merged.q);
    if (merged.status !== 'all') sp.set('status', merged.status);
    if (merged.page > 1) sp.set('page', String(merged.page));
    const s = sp.toString();
    return `/admin/songs${s ? `?${s}` : ''}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Şarkılar" description={`${total} şarkı`} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Duruma göre süz" className="flex gap-1 overflow-x-auto rounded-pill bg-fill p-1">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={href({ status: f.value })}
              aria-current={status === f.value ? 'page' : undefined}
              className={cn('flex min-h-(--size-control-sm) shrink-0 items-center rounded-pill px-4 type-label-md text-fg-muted hover:text-fg', status === f.value && 'bg-glass text-fg shadow-ui-sm')}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        <form action="/admin/songs" role="search" className="flex gap-2">
          {status !== 'all' ? <input type="hidden" name="status" value={status} /> : null}
          <label htmlFor="song-search" className="sr-only">
            Şarkı ya da sanatçı ara
          </label>
          <Input id="song-search" name="q" type="search" defaultValue={q} placeholder="Şarkı ya da sanatçı" className="lg:w-(--size-layout-panel)" />
          <Button type="submit" variant="secondary" aria-label="Ara">
            <Search aria-hidden="true" />
          </Button>
        </form>
      </div>

      {res.error ? <p className="text-danger-fg">Şarkılar alınamadı. Sayfayı yenile.</p> : null}

      {songs.length ? (
        <ul className="flex flex-col gap-2">
          {songs.map((s) => (
            <li key={s.id} className="glass-panel flex flex-col gap-3 rounded-ui-lg p-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {s.cover_url ? (
                  <img src={s.cover_url} alt="" loading="lazy" className="size-(--size-artwork-sm) shrink-0 rounded-art-sm object-cover" />
                ) : (
                  <span aria-hidden="true" className="art art-1 size-(--size-artwork-sm) shrink-0 rounded-art-sm" />
                )}
                <div className="flex min-w-0 flex-col">
                  <span className="truncate type-label-md">{s.title}</span>
                  <span className="truncate type-body-sm text-fg-muted">
                    {s.artist} · {formatDuration(s.duration)} · {formatRelative(s.created_at)}
                    {s.uploaded_by && uploaders.has(s.uploaded_by) ? ` · @${uploaders.get(s.uploaded_by)}` : ''}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                <SongStatus status={s.status} />
                <SongActions id={s.id} title={s.title} status={s.status} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="glass-panel flex flex-col items-start gap-3 rounded-ui-xl p-8">
          <h2 className="type-title-md">{q ? 'Sonuç yok' : 'Bu listede şarkı yok'}</h2>
          <p className="text-fg-muted">{q ? `“${q}” ile eşleşen şarkı bulunamadı. Başka bir ad dene.` : 'Yeni şarkı eklemek için YouTube içe aktarmayı kullan.'}</p>
          <Link href="/admin/import" className={buttonVariants({ variant: 'secondary' })}>
            YouTube’dan ekle
          </Link>
        </div>
      )}

      {total > PAGE_SIZE ? (
        <nav aria-label="Sayfalar" className="flex items-center justify-between gap-3">
          {page > 1 ? (
            <Link href={href({ page: page - 1 })} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              Önceki
            </Link>
          ) : (
            <span />
          )}
          <span className="type-body-sm text-fg-muted">
            Sayfa {page} / {Math.ceil(total / PAGE_SIZE)}
          </span>
          {page * PAGE_SIZE < total ? (
            <Link href={href({ page: page + 1 })} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              Sonraki
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
