import { artistSongStats, formatCount, formatDuration, formatRelative, managedArtist, myArtistRequests, type ArtistSongStat } from '@bekofy/core';
import { Notice } from '@bekofy/ui';
import type { Metadata } from 'next';
import { ApplyForm } from '@/components/artist/apply-form';
import { UploadForm } from '@/components/artist/upload-form';
import { PageHead, Panel, Stat } from '@/components/panel';
import { SongStatus } from '@/components/song-status';
import { createClient } from '@/lib/supabase/server';
import { requireViewer } from '@/lib/viewer';

export const metadata: Metadata = { title: 'Sanatçı paneli', robots: { index: false } };

export default async function ArtistPage() {
  const viewer = await requireViewer('/artist');
  const sb = await createClient();
  const artist = await managedArtist(sb, viewer.user.id);

  if (!artist) {
    const requests = await myArtistRequests(sb, viewer.user.id).catch(() => []);
    const pending = requests.find((r) => r.status === 'pending');
    const lastRejected = !pending ? requests.find((r) => r.status === 'rejected') : undefined;
    return (
      <div className="mx-auto flex w-full max-w-[calc(var(--size-layout-panel)*2.4)] flex-col gap-8 px-4 py-10 sm:px-8">
        <PageHead title="Sanatçı ol" description="Başvurun onaylanınca şarkılarını buradan yükler, dinlenme sayılarını görürsün." />
        {pending ? (
          <Notice tone="info" title="Başvurun değerlendiriliyor">
            {pending.artist_name} adıyla {formatRelative(pending.created_at)} başvurdun. Sonuç hesabına yansıyınca bu sayfa sanatçı paneline dönüşür.
          </Notice>
        ) : (
          <>
            {lastRejected ? (
              <Notice tone="warning" title="Önceki başvurun onaylanmadı">
                Bilgilerini güncelleyip yeniden başvurabilirsin.
              </Notice>
            ) : null}
            <Panel id="apply" title="Başvuru formu">
              <ApplyForm />
            </Panel>
          </>
        )}
      </div>
    );
  }

  let stats: ArtistSongStat[] | null = null;
  try {
    stats = await artistSongStats(sb);
  } catch {
    stats = null;
  }
  const total = (key: 'plays' | 'listeners' | 'plays30d') => (stats ?? []).reduce((sum, s) => sum + s[key], 0);

  return (
    <div className="mx-auto flex w-full max-w-(--size-layout-content) flex-col gap-8 px-4 py-10 sm:px-8">
      <PageHead title={artist.name} description="Sanatçı paneli: şarkı yükle, onay durumunu ve dinlenme sayılarını gör." />
      {stats === null ? <Notice tone="warning">İstatistikler şu an alınamadı. Biraz sonra sayfayı yenile.</Notice> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Toplam dinlenme" value={formatCount(total('plays'))} />
        <Stat label="Son 30 gün" value={formatCount(total('plays30d'))} />
        <Stat label="Şarkı" value={formatCount(stats?.length ?? 0)} hint={`${(stats ?? []).filter((s) => s.status === 'pending').length} onay bekliyor`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel id="upload" title="Şarkı yükle" description="Gönderdiğin şarkı, admin onayından sonra yayına girer.">
          <UploadForm artistName={artist.name} />
        </Panel>

        <Panel id="songs" title="Şarkıların">
          {stats && stats.length ? (
            <div className="-mx-2 overflow-x-auto" tabIndex={0} role="region" aria-label="Şarkıların tablosu">
              <table className="w-full min-w-[calc(var(--size-layout-panel)*1.5)] border-collapse text-start type-body-sm">
                <thead className="text-fg-muted">
                  <tr className="border-b border-line">
                    <th scope="col" className="px-2 py-2 text-start font-medium">Şarkı</th>
                    <th scope="col" className="px-2 py-2 text-start font-medium">Durum</th>
                    <th scope="col" className="px-2 py-2 text-end font-medium">Dinlenme</th>
                    <th scope="col" className="px-2 py-2 text-end font-medium">Dinleyen</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => (
                    <tr key={s.songId} className="border-b border-line last:border-0">
                      <td className="px-2 py-3">
                        <span className="block max-w-[28ch] truncate type-label-md">{s.title}</span>
                        <span className="text-fg-muted">
                          {formatDuration(s.duration)} · {formatRelative(s.createdAt)}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <SongStatus status={s.status} />
                      </td>
                      <td className="px-2 py-3 text-end">{formatCount(s.plays)}</td>
                      <td className="px-2 py-3 text-end">{formatCount(s.listeners)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-fg-muted">Henüz şarkın yok. İlk şarkını yükle; onaylanınca burada dinlenme sayılarını görürsün.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
