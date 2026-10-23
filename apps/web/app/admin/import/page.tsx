import { formatRelative } from '@bekofy/core';
import { YouTubeImport } from '@/components/admin/youtube-import';
import { PageHead, Panel } from '@/components/panel';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'YouTube’dan ekle' };

export default async function ImportPage() {
  const sb = await createClient();
  const recent = await sb.from('songs').select('id, title, artist, cover_url, created_at').order('created_at', { ascending: false }).limit(5);
  return (
    <div className="flex flex-col gap-8">
      <PageHead
        title="YouTube’dan şarkı ekle"
        description="Bağlantıyı yapıştır, bilgileri düzelt, ekle. İndirme ve yükleme senin bilgisayarındaki yerel sunucuda yapılır."
      />
      <YouTubeImport />
      <Panel id="recent" title="Son eklenenler">
        {recent.data?.length ? (
          <ul className="flex flex-col gap-1">
            {recent.data.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-ui-md p-2">
                {s.cover_url ? (
                  <img src={s.cover_url} alt="" loading="lazy" className="size-(--size-artwork-sm) shrink-0 rounded-art-sm object-cover" />
                ) : (
                  <span aria-hidden="true" className="art art-1 size-(--size-artwork-sm) shrink-0 rounded-art-sm" />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate type-label-md">{s.title}</span>
                  <span className="truncate type-body-sm text-fg-muted">{s.artist}</span>
                </span>
                <span className="shrink-0 type-caption text-fg-muted">{formatRelative(s.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-fg-muted">Henüz şarkı yok.</p>
        )}
      </Panel>
    </div>
  );
}
