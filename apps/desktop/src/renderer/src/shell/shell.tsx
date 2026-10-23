// Uygulama iskeleti: başlık çubuğu, kenar menüsü, içerik, sağ panel, oynatıcı çubuğu ve katmanlar.

import { useEffect, useRef } from 'react';
import { ToastRegion } from '../components/toast';
import { bridge } from '../lib/bridge';
import { refreshOffline } from '../lib/offline';
import { player } from '../lib/player';
import { useRoute, type Route } from '../lib/router';
import { setUi, useUi } from '../lib/ui';
import { AlbumScreen } from '../screens/album';
import { ArtistScreen } from '../screens/artist';
import { HomeScreen } from '../screens/home';
import { JamScreen } from '../screens/jam';
import { LibraryScreen } from '../screens/library';
import { LikedScreen } from '../screens/liked';
import { NowPlaying } from '../screens/now-playing';
import { PlaylistScreen } from '../screens/playlist';
import { ProfileScreen } from '../screens/profile';
import { SearchScreen } from '../screens/search';
import { SettingsScreen } from '../screens/settings';
import { Wrapped } from '../screens/wrapped';
import { PlayerBar } from './player-bar';
import { RightPanel } from './right-panel';
import { Sidebar } from './sidebar';
import { TitleBar } from './title-bar';
import { UpdateBanner } from './update-banner';

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'home':
      return <HomeScreen />;
    case 'search':
      return <SearchScreen q={route.q} />;
    case 'library':
      return <LibraryScreen filter={route.filter} />;
    case 'liked':
      return <LikedScreen />;
    case 'playlist':
      return <PlaylistScreen id={route.id} />;
    case 'artist':
      return <ArtistScreen id={route.id} />;
    case 'album':
      return <AlbumScreen artist={route.artist} title={route.title} />;
    case 'profile':
      return <ProfileScreen id={route.id} />;
    case 'settings':
      return <SettingsScreen />;
    case 'jam':
      return <JamScreen />;
  }
}

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

export function Shell() {
  const route = useRoute();
  const ui = useUi();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    void refreshOffline();
    return bridge?.mini.onVisibility((open) => setUi({ miniOpen: open }));
  }, []);

  // Sayfa değişince içerik başa kayar ve odak içeriğe gider (ekran okuyucu yeni sayfayı okur).
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  }, [route]);

  // Kısayollar: Boşluk çal/duraklat, Ctrl+F ara, Ctrl+sağ/sol sonraki/önceki; fare geri/ileri düğmeleri.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement)) {
        e.preventDefault();
        player.toggle();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        document.getElementById('top-search')?.focus();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') player.next();
      else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') player.previous();
    };
    const onMouse = (e: MouseEvent) => {
      if (e.button === 3) history.back();
      if (e.button === 4) history.forward();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mouseup', onMouse);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mouseup', onMouse);
    };
  }, []);

  return (
    <div className="relative isolate grid h-full grid-rows-[var(--title-bar-height)_minmax(0,1fr)_var(--size-layout-player)]">
      <div aria-hidden="true" className="ambient pointer-events-none absolute inset-0 -z-10" />
      <TitleBar route={route} />
      <div className="grid min-h-0 grid-cols-[var(--size-layout-rail)_minmax(0,1fr)] gap-2 px-2 lg:grid-cols-[var(--size-layout-sidebar)_minmax(0,1fr)] xl:has-[[data-panel]]:grid-cols-[var(--size-layout-sidebar)_minmax(0,1fr)_var(--size-layout-panel)]">
        <Sidebar route={route} />
        <main ref={mainRef} id="main" tabIndex={-1} className="glass-panel scroll-thin relative min-w-0 overflow-y-auto rounded-ui-card outline-none">
          <UpdateBanner />
          <div className="mx-auto w-full max-w-(--size-layout-content) px-6 pb-16 pt-6 xl:px-8">
            <Screen route={route} />
          </div>
        </main>
        {ui.panel ? <RightPanel tab={ui.panel} /> : null}
      </div>
      <PlayerBar />
      {ui.nowPlaying ? <NowPlaying tab={ui.nowPlaying} /> : null}
      {ui.wrapped ? <Wrapped /> : null}
      <ToastRegion />
    </div>
  );
}
