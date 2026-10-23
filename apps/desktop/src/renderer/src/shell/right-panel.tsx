// Sağ panel (geniş pencerede): sıradaki şarkılar ya da arkadaşların ne dinlediği.

import { formatRelative, friendIds, friendsActivity, subscribeToActivity } from '@bekofy/core';
import { cn, IconButton } from '@bekofy/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AudioLines, X } from 'lucide-react';
import { useEffect } from 'react';
import { Avatar } from '../components/avatar';
import { QueueList } from '../components/queue-list';
import { href } from '../lib/router';
import { useAuthed } from '../lib/session';
import { setUi } from '../lib/ui';

export function RightPanel({ tab }: { tab: 'queue' | 'friends' }) {
  return (
    <aside data-panel aria-label="Yan panel" className="glass-panel scroll-thin hidden min-h-0 flex-col gap-5 overflow-y-auto rounded-ui-card px-4 py-5 xl:flex">
      <div className="flex items-center gap-2">
        <div role="group" aria-label="Panel" className="flex flex-1 gap-1 rounded-pill bg-fill p-1">
          {(['friends', 'queue'] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tab === t}
              onClick={() => setUi({ panel: t })}
              className={cn('flex-1 min-h-(--size-control-sm) rounded-pill type-label-md text-fg-muted hover:text-fg', tab === t && 'bg-glass text-fg shadow-ui-sm')}
            >
              {t === 'friends' ? 'Arkadaşlar' : 'Sıradaki'}
            </button>
          ))}
        </div>
        <IconButton size="sm" label="Paneli kapat" onClick={() => setUi({ panel: null })}>
          <X aria-hidden="true" />
        </IconButton>
      </div>
      {tab === 'queue' ? <QueueList /> : <FriendsActivity />}
    </aside>
  );
}

function FriendsActivity() {
  const { sb, user } = useAuthed();
  const qc = useQueryClient();
  const ids = useQuery({ queryKey: ['friend-ids', user.id], queryFn: () => friendIds(sb, user.id) });
  const activity = useQuery({
    queryKey: ['friend-activity', user.id, ids.data?.length ?? 0],
    queryFn: () => friendsActivity(sb, ids.data ?? []),
    enabled: Boolean(ids.data),
  });

  // Canlı: bir arkadaşın çaldığı şarkı değişince liste yenilenir.
  useEffect(() => {
    if (!ids.data?.length) return;
    return subscribeToActivity(sb, ids.data, () => void qc.invalidateQueries({ queryKey: ['friend-activity', user.id] }));
  }, [sb, ids.data, qc, user.id]);

  if (ids.isLoading || activity.isLoading) return <p className="text-fg-muted">Yükleniyor</p>;
  if (!ids.data?.length)
    return (
      <div className="flex flex-col gap-2">
        <h3 className="type-title-sm">Arkadaşlarını bul</h3>
        <p className="type-body-sm text-fg-muted">Birini takip ettiğinde ve o da seni takip ettiğinde ne dinlediğini burada görürsün. Aramadan kişileri bulabilirsin.</p>
      </div>
    );
  if (!activity.data?.length) return <p className="type-body-sm text-fg-muted">Arkadaşların şu an bir şey dinlemiyor.</p>;

  return (
    <ul className="flex flex-col gap-1">
      {activity.data.map((f) => (
        <li key={f.id}>
          <a href={href({ name: 'profile', id: f.id })} className="flex min-w-0 items-center gap-3 rounded-ui-md p-2 hover:bg-hover">
            <Avatar src={f.avatar_url} name={f.username} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate type-label-md">{f.username ?? 'adsız'}</span>
              <span className="truncate type-body-sm text-fg-muted">{f.song ? `${f.song.title} · ${f.song.artist}` : ''}</span>
            </span>
            {f.is_playing ? (
              <AudioLines aria-label="Şu an dinliyor" className="size-(--size-icon-sm) shrink-0 text-accent-fg" />
            ) : (
              <span className="shrink-0 type-caption text-fg-muted">{formatRelative(f.last_activity)}</span>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}
