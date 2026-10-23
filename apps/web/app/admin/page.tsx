import { admin, formatCount, formatRelative } from '@bekofy/core';
import { buttonVariants } from '@bekofy/ui';
import Link from 'next/link';
import { PageHead, Panel, Stat } from '@/components/panel';
import { SongStatus } from '@/components/song-status';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Genel bakış' };

export default async function AdminHome() {
  const sb = await createClient();
  const [stats, pending, requests] = await Promise.all([
    admin.dashboardStats(sb),
    sb.from('songs').select('id, title, artist, status, created_at').eq('status', 'pending').order('created_at').limit(5),
    sb.from('artist_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHead
        title="Genel bakış"
        actions={
          <Link href="/admin/import" className={buttonVariants()}>
            YouTube’dan şarkı ekle
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Yayındaki şarkı" value={formatCount(stats.songs)} />
        <Stat label="Onay bekleyen" value={formatCount(stats.pendingSongs)} />
        <Stat label="Kullanıcı" value={formatCount(stats.users)} />
        <Stat label="Çalma listesi" value={formatCount(stats.playlists)} />
        <Stat label="Jam oturumu" value={formatCount(stats.jams)} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel
          id="pending-songs"
          title="Onay bekleyen şarkılar"
          action={
            <Link href="/admin/songs?status=pending" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              Tümü
            </Link>
          }
        >
          {pending.data?.length ? (
            <ul className="flex flex-col gap-1">
              {pending.data.map((s) => (
                <li key={s.id}>
                  <Link href={`/admin/songs/${s.id}`} className="flex items-center gap-3 rounded-ui-md p-2 hover:bg-hover">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate type-label-md">{s.title}</span>
                      <span className="truncate type-body-sm text-fg-muted">
                        {s.artist} · {formatRelative(s.created_at)}
                      </span>
                    </span>
                    <SongStatus status={s.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-fg-muted">Onay bekleyen şarkı yok.</p>
          )}
        </Panel>
        <Panel
          id="pending-requests"
          title="Sanatçı başvuruları"
          action={
            <Link href="/admin/artist-requests" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              Aç
            </Link>
          }
        >
          <p className="text-fg-muted">{requests.count ? `${requests.count} başvuru değerlendirmeni bekliyor.` : 'Bekleyen başvuru yok.'}</p>
        </Panel>
      </div>
    </div>
  );
}
