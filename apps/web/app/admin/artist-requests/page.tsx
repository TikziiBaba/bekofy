import { formatRelative, pendingArtistRequests } from '@bekofy/core';
import { RequestActions } from '@/components/admin/request-actions';
import { Avatar } from '@/components/avatar';
import { PageHead } from '@/components/panel';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Sanatçı başvuruları' };

export default async function ArtistRequestsPage() {
  const sb = await createClient();
  const requests = await pendingArtistRequests(sb).catch(() => null);

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Sanatçı başvuruları" description="Onaylanan kullanıcı sanatçı olur ve sitedeki sanatçı panelinden şarkı yükleyebilir." />
      {requests === null ? <p className="text-danger-fg">Başvurular alınamadı. Sayfayı yenile.</p> : null}
      {requests?.length ? (
        <ul className="flex flex-col gap-3">
          {requests.map((r) => {
            const username = r.applicant?.username ?? 'adsız';
            return (
              <li key={r.id} className="glass-panel flex flex-col gap-4 rounded-ui-xl p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar src={r.applicant?.avatar_url} name={username} />
                    <div className="flex min-w-0 flex-col">
                      <h2 className="truncate type-title-sm">{r.artist_name}</h2>
                      <span className="type-body-sm text-fg-muted">
                        @{username} · {formatRelative(r.created_at)}
                      </span>
                    </div>
                  </div>
                  <RequestActions id={r.id} artistName={r.artist_name} username={username} />
                </div>
                {r.message ? <p className="max-w-(--size-layout-measure) whitespace-pre-line text-fg-muted">{r.message}</p> : null}
                {r.links?.length ? (
                  <ul className="flex flex-col gap-1 type-body-sm">
                    {r.links.map((l) => (
                      <li key={l} className="[overflow-wrap:anywhere]">
                        <a href={l} target="_blank" rel="noopener noreferrer nofollow" className="text-accent-fg hover:underline">
                          {l}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : requests ? (
        <p className="text-fg-muted">Bekleyen başvuru yok.</p>
      ) : null}
    </div>
  );
}
