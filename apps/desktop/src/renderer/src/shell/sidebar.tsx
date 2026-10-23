import { BekofyLogo, BekofyMark, cn, IconButton } from '@bekofy/ui';
import { Heart, House, Library, Plus, Search, Users, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Cover } from '../components/cover';
import { NamePrompt } from '../components/name-prompt';
import { showToast } from '../components/toast';
import { useCreatePlaylist, usePlaylists } from '../lib/data';
import { href, navigate, type Route } from '../lib/router';

const NAV: Array<{ route: Route; label: string; Icon: LucideIcon; match: Route['name'][] }> = [
  { route: { name: 'home' }, label: 'Ana sayfa', Icon: House, match: ['home'] },
  { route: { name: 'search', q: '' }, label: 'Ara', Icon: Search, match: ['search'] },
  { route: { name: 'library', filter: 'all' }, label: 'Kitaplığın', Icon: Library, match: ['library'] },
  { route: { name: 'jam' }, label: 'Jam', Icon: Users, match: ['jam'] },
];

export function Sidebar({ route }: { route: Route }) {
  const playlists = usePlaylists();
  const create = useCreatePlaylist();
  const [naming, setNaming] = useState(false);

  return (
    <nav aria-label="Ana menü" className="glass-panel scroll-thin flex min-h-0 flex-col gap-6 overflow-y-auto rounded-ui-card px-2 py-4 lg:px-3 lg:py-5">
      <a href={href({ name: 'home' })} aria-label="Bekofy ana sayfa" className="flex justify-center rounded-ui-sm lg:justify-start lg:px-3">
        <BekofyLogo className="hidden lg:inline-flex" />
        <BekofyMark className="lg:hidden" />
      </a>
      <ul className="flex flex-col gap-1">
        {NAV.map(({ route: to, label, Icon, match }) => {
          const active = match.includes(route.name);
          return (
            <li key={label}>
              <a
                href={href(to)}
                aria-current={active ? 'page' : undefined}
                title={label}
                className={cn(
                  'relative flex min-h-(--size-touch) items-center justify-center gap-3 rounded-ui-control px-3 type-label-md text-fg-muted hover:bg-hover hover:text-fg lg:justify-start',
                  active && 'bg-fill text-fg before:absolute before:inset-y-3 before:start-0 before:w-0.5 before:rounded-pill before:bg-accent-fg',
                )}
              >
                <Icon aria-hidden="true" className="size-(--size-icon-sm) shrink-0" />
                <span className="sr-only lg:not-sr-only">{label}</span>
              </a>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="side-lists" className="hidden min-h-0 flex-col gap-2 lg:flex">
        <div className="flex items-center justify-between px-3">
          <h2 id="side-lists" className="type-label-md text-fg-muted">
            Çalma listelerin
          </h2>
          <IconButton size="sm" label="Yeni çalma listesi" onClick={() => setNaming(true)}>
            <Plus aria-hidden="true" />
          </IconButton>
        </div>
        <ul className="flex flex-col gap-0.5">
          <li>
            <a href={href({ name: 'liked' })} aria-current={route.name === 'liked' ? 'page' : undefined} className="flex items-center gap-3 rounded-ui-control px-3 py-1.5 hover:bg-hover aria-[current=page]:bg-fill">
              <span aria-hidden="true" className="grid size-(--size-artwork-sm) shrink-0 place-items-center rounded-art-sm bg-accent text-on-accent">
                <Heart className="size-(--size-icon-sm) fill-current" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate type-label-md">Beğenilen şarkılar</span>
                <span className="truncate type-body-sm text-fg-muted">Çalma listesi</span>
              </span>
            </a>
          </li>
          {playlists.data?.map((p) => (
            <li key={p.id}>
              <a
                href={href({ name: 'playlist', id: p.id })}
                aria-current={route.name === 'playlist' && route.id === p.id ? 'page' : undefined}
                className="flex items-center gap-3 rounded-ui-control px-3 py-1.5 hover:bg-hover aria-[current=page]:bg-fill"
              >
                <Cover src={p.cover_url} className="size-(--size-artwork-sm) rounded-art-sm" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate type-label-md">{p.name}</span>
                  <span className="truncate type-body-sm text-fg-muted">{p.is_public ? 'Herkese açık liste' : 'Gizli liste'}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
      <NamePrompt
        open={naming}
        title="Yeni çalma listesi"
        label="Liste adı"
        confirmLabel="Oluştur"
        busy={create.isPending}
        onClose={() => setNaming(false)}
        onSubmit={async (name) => {
          const p = await create.mutateAsync(name);
          setNaming(false);
          showToast(`${p.name} oluşturuldu`);
          navigate({ name: 'playlist', id: p.id });
        }}
      />
    </nav>
  );
}
