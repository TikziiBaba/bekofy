import { followedArtists } from '@bekofy/core';
import { cn } from '@bekofy/ui';
import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { Empty, PageTitle } from '../components/blocks';
import { Cover } from '../components/cover';
import { TrackList } from '../components/track-list';
import { isDesktop } from '../lib/bridge';
import { usePlaylists } from '../lib/data';
import { offlineAsTrack, useOffline } from '../lib/offline';
import { href, type LibraryFilter } from '../lib/router';
import { useAuthed } from '../lib/session';

const FILTERS: Array<[LibraryFilter, string]> = [
  ['all', 'Tümü'],
  ['playlists', 'Çalma listeleri'],
  ['artists', 'Sanatçılar'],
  ['downloads', 'İndirilenler'],
];

export function LibraryScreen({ filter }: { filter: LibraryFilter }) {
  const { sb, user, profile } = useAuthed();
  const playlists = usePlaylists();
  const artists = useQuery({ queryKey: ['followed-artists', user.id], queryFn: () => followedArtists(sb, user.id) });
  const offline = useOffline();

  const rows = [
    ...(filter === 'all' || filter === 'playlists'
      ? [
          { key: 'liked', href: href({ name: 'liked' }), cover: null as string | null, liked: true, title: 'Beğenilen şarkılar', meta: 'Çalma listesi' },
          ...(playlists.data ?? []).map((p) => ({ key: p.id, href: href({ name: 'playlist', id: p.id }), cover: p.cover_url, liked: false, title: p.name, meta: `Çalma listesi · ${p.user_id === user.id ? (profile.username ?? 'sen') : 'ortak'}` })),
        ]
      : []),
    ...(filter === 'all' || filter === 'artists'
      ? (artists.data ?? []).map((a) => ({ key: a.id, href: href({ name: 'artist', id: a.id }), cover: a.avatar_url, liked: false, title: a.name, meta: 'Sanatçı', round: true }))
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Kitaplığın</PageTitle>
      <nav aria-label="Kitaplığı süz" className="flex flex-wrap gap-2">
        {FILTERS.map(([f, label]) => (
          <a
            key={f}
            href={href({ name: 'library', filter: f })}
            aria-current={filter === f ? 'page' : undefined}
            className={cn('inline-flex min-h-(--size-control-sm) items-center rounded-pill bg-fill px-3.5 type-label-md hover:bg-fill-strong', filter === f && 'bg-inverse text-fg-inverse hover:bg-inverse')}
          >
            {label}
          </a>
        ))}
      </nav>

      {filter === 'downloads' ? (
        !isDesktop ? (
          <Empty title="İndirme masaüstünde">İnternetsiz dinleme yalnızca masaüstü uygulamasında var.</Empty>
        ) : offline.songs.length ? (
          <TrackList tracks={offline.songs.map(offlineAsTrack)} label="İndirilen şarkılar" contextId="downloads" />
        ) : (
          <Empty title="Henüz indirdiğin şarkı yok">Bir şarkının seçeneklerinden ya da bir listenin indir düğmesinden indir; internet yokken de çalar.</Empty>
        )
      ) : rows.length ? (
        <ul className="flex flex-col gap-1">
          {rows.map((r) => (
            <li key={r.key}>
              <a href={r.href} className="flex min-w-0 items-center gap-3 rounded-ui-md p-2 hover:bg-hover">
                {r.liked ? (
                  <span aria-hidden="true" className="grid size-(--size-artwork-sm) shrink-0 place-items-center rounded-art-sm bg-accent text-on-accent">
                    <Heart className="size-(--size-icon-sm) fill-current" />
                  </span>
                ) : (
                  <Cover src={r.cover} round={'round' in r} className="size-(--size-artwork-sm)" />
                )}
                <span className="flex min-w-0 flex-col">
                  <span className="truncate type-label-md">{r.title}</span>
                  <span className="truncate type-body-sm text-fg-muted">{r.meta}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <Empty title={filter === 'artists' ? 'Takip ettiğin sanatçı yok' : 'Kitaplığın boş'}>
          {filter === 'artists' ? 'Bir sanatçının sayfasında "Takip et"e bas.' : 'Kenar menüsünden yeni bir çalma listesi oluştur.'}
        </Empty>
      )}
    </div>
  );
}
