import { recentAccessLogs } from '@bekofy/core';
import { PageHead } from '@/components/panel';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Giriş kayıtları' };

const PLATFORM: Record<string, string> = { desktop: 'Masaüstü', web: 'Site', android: 'Android', ios: 'iOS' };
const time = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Istanbul' });

export default async function LogsPage() {
  const sb = await createClient();
  const logs = await recentAccessLogs(sb, { limit: 100 }).catch(() => null);

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Giriş kayıtları" description="Son 100 giriş. IP adresi ve konum tutulmaz." />
      {logs === null ? <p className="text-danger-fg">Kayıtlar alınamadı. Sayfayı yenile.</p> : null}
      {logs?.length ? (
        <div className="glass-panel overflow-x-auto rounded-ui-xl" tabIndex={0} role="region" aria-label="Giriş kayıtları tablosu">
          <table className="w-full min-w-[calc(var(--size-layout-panel)*2)] border-collapse type-body-sm">
            <caption className="sr-only">Son girişler, yeniden eskiye</caption>
            <thead className="text-fg-muted">
              <tr className="border-b border-line">
                <th scope="col" className="px-4 py-3 text-start font-medium">Kullanıcı</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">Nereden</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">Sürüm</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">Zaman</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">{l.user?.username ? `@${l.user.username}` : 'adsız'}</td>
                  <td className="px-4 py-3">{PLATFORM[l.platform] ?? l.platform}</td>
                  <td className="px-4 py-3 text-fg-muted">{l.app_version ?? '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-fg-muted">{time.format(new Date(l.created_at))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : logs ? (
        <p className="text-fg-muted">Henüz giriş kaydı yok. Uygulamalar ve site her girişte kayıt yazar.</p>
      ) : null}
    </div>
  );
}
