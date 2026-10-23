// Hash tabanlı yönlendirme (dosyadan yüklenen uygulamada sunucu yok). Geri/ileri tarayıcı geçmişiyle çalışır.

import { useSyncExternalStore, type AnchorHTMLAttributes, type ReactNode } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'search'; q: string }
  | { name: 'library'; filter: LibraryFilter }
  | { name: 'liked' }
  | { name: 'playlist'; id: string }
  | { name: 'artist'; id: string }
  | { name: 'album'; artist: string; title: string }
  | { name: 'profile'; id: string }
  | { name: 'settings' }
  | { name: 'jam' };

export type LibraryFilter = 'all' | 'playlists' | 'artists' | 'downloads';
const FILTERS: LibraryFilter[] = ['all', 'playlists', 'artists', 'downloads'];

export function parse(hash: string): Route {
  const [path = '', query = ''] = hash.replace(/^#\/?/, '').split('?');
  const [head, ...rest] = path.split('/').map((p) => decodeURIComponent(p));
  const params = new URLSearchParams(query);
  switch (head) {
    case 'search':
      return { name: 'search', q: params.get('q') ?? '' };
    case 'library': {
      const f = rest[0] as LibraryFilter | undefined;
      return { name: 'library', filter: f && FILTERS.includes(f) ? f : 'all' };
    }
    case 'liked':
      return { name: 'liked' };
    case 'playlist':
      return rest[0] ? { name: 'playlist', id: rest[0] } : { name: 'home' };
    case 'artist':
      return rest[0] ? { name: 'artist', id: rest[0] } : { name: 'home' };
    case 'album':
      return rest[0] && rest[1] ? { name: 'album', artist: rest[0], title: rest[1] } : { name: 'home' };
    case 'profile':
      return rest[0] ? { name: 'profile', id: rest[0] } : { name: 'home' };
    case 'settings':
      return { name: 'settings' };
    case 'jam':
      return { name: 'jam' };
    default:
      return { name: 'home' };
  }
}

const enc = encodeURIComponent;
export function href(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'search':
      return route.q ? `#/search?q=${enc(route.q)}` : '#/search';
    case 'library':
      return route.filter === 'all' ? '#/library' : `#/library/${route.filter}`;
    case 'liked':
      return '#/liked';
    case 'playlist':
      return `#/playlist/${enc(route.id)}`;
    case 'artist':
      return `#/artist/${enc(route.id)}`;
    case 'album':
      return `#/album/${enc(route.artist)}/${enc(route.title)}`;
    case 'profile':
      return `#/profile/${enc(route.id)}`;
    case 'settings':
      return '#/settings';
    case 'jam':
      return '#/jam';
  }
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const getHash = () => window.location.hash;

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, getHash);
  return parse(hash);
}

export function navigate(route: Route, { replace = false } = {}): void {
  const target = href(route);
  if (replace) window.location.replace(target);
  else window.location.hash = target;
}

export function Link({ to, children, ...props }: { to: Route; children: ReactNode } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return (
    <a href={href(to)} {...props}>
      {children}
    </a>
  );
}

export const sameRoute = (a: Route, b: Route) => href(a) === href(b);
