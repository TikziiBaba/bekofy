// Ekran adresleri tek yerde: sekme içindeki yığında açılırlar, sekme çubuğu ve mini oynatıcı görünür kalır.

import type { Href } from 'expo-router';

export const routes = {
  playlist: (id: string): Href => ({ pathname: '/playlist/[id]', params: { id } }),
  playlistEdit: (id: string): Href => ({ pathname: '/playlist/[id]/edit', params: { id } }),
  artist: (id: string): Href => ({ pathname: '/artist/[id]', params: { id } }),
  profile: (id: string): Href => ({ pathname: '/profile/[id]', params: { id } }),
  album: (artist: string, title: string): Href => ({ pathname: '/album', params: { artist, title } }),
  liked: '/liked' as Href,
  settings: '/settings' as Href,
  jam: '/jam' as Href,
  search: '/search' as Href,
  nowPlaying: '/now-playing' as Href,
  wrapped: '/wrapped' as Href,
};
