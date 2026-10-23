// Başlık çubuğu: sürükleme alanı, geri/ileri, arama, hesap menüsü. Sağda Windows'un kendi pencere düğmeleri durur.

import { IconButton } from '@bekofy/ui';
import { ChevronLeft, ChevronRight, LogOut, Plus, Search, Settings, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Avatar } from '../components/avatar';
import { href, navigate, type Route } from '../lib/router';
import { useAuthed, useSession } from '../lib/session';

export function TitleBar({ route }: { route: Route }) {
  const [q, setQ] = useState(route.name === 'search' ? route.q : '');
  useEffect(() => {
    if (route.name === 'search') setQ(route.q);
  }, [route]);

  return (
    <header className="drag flex h-(--title-bar-height) w-[env(titlebar-area-width,100%)] items-center gap-2 px-3">
      <div className="no-drag flex items-center gap-1">
        <IconButton size="sm" label="Geri" onClick={() => history.back()}>
          <ChevronLeft aria-hidden="true" />
        </IconButton>
        <IconButton size="sm" label="İleri" onClick={() => history.forward()}>
          <ChevronRight aria-hidden="true" />
        </IconButton>
      </div>
      <form
        role="search"
        className="no-drag relative flex w-full max-w-[calc(var(--size-layout-panel)*1.3)] items-center"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ name: 'search', q: q.trim() }, { replace: route.name === 'search' });
        }}
      >
        <Search aria-hidden="true" className="pointer-events-none absolute start-3 size-(--size-icon-xs) text-fg-muted" />
        <label htmlFor="top-search" className="sr-only">
          Şarkı, sanatçı, çalma listesi ya da kişi ara
        </label>
        <input
          id="top-search"
          type="search"
          autoComplete="off"
          placeholder="Ne dinlemek istersin?"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            navigate({ name: 'search', q: e.target.value }, { replace: route.name === 'search' });
          }}
          className="h-(--size-control-sm) w-full rounded-pill border border-line-strong bg-fill ps-9 pe-4 type-body-sm text-fg placeholder:text-fg-subtle hover:bg-fill-strong"
        />
      </form>
      <div className="drag h-full flex-1" />
      <AccountMenu />
    </header>
  );
}

function AccountMenu() {
  const { user, profile, slot } = useAuthed();
  const { accounts, switchTo, addAccount, signOut } = useSession();
  const others = accounts.filter((a) => a.slot !== slot);
  const item = 'flex min-h-(--size-touch) w-full items-center gap-3 rounded-ui-md px-3 text-start type-label-md hover:bg-hover';
  const close = () => document.getElementById('account-menu')?.hidePopover();

  return (
    <div className="no-drag">
      <button type="button" popoverTarget="account-menu" aria-label={`Hesap menüsü: ${profile.username ?? user.email ?? ''}`} className="grid size-(--size-control-sm) place-items-center rounded-pill [anchor-name:--account]">
        <Avatar src={profile.avatar_url} name={profile.username ?? user.email} className="size-(--size-control-sm)" />
      </button>
      <div
        id="account-menu"
        popover="auto"
        className="glass-chrome m-0 w-[calc(var(--size-layout-panel)*0.9)] rounded-ui-lg p-2 text-fg shadow-ui-lg [position-anchor:--account] [top:anchor(bottom)] [right:anchor(right)] mt-2"
      >
        <p className="truncate px-3 pb-2 pt-1 type-body-sm text-fg-muted">{user.email}</p>
        <a
          className={item}
          href={href({ name: 'profile', id: user.id })}
          onClick={close}
        >
          <User aria-hidden="true" className="size-(--size-icon-sm)" />
          Profilim
        </a>
        <a className={item} href={href({ name: 'settings' })} onClick={close}>
          <Settings aria-hidden="true" className="size-(--size-icon-sm)" />
          Ayarlar
        </a>
        {others.length ? (
          <div className="mt-1 border-t border-line pt-1">
            <p className="px-3 py-1 type-label-sm text-fg-muted">Hesap değiştir</p>
            {others.map((a) => (
              <button key={a.slot} type="button" className={item} onClick={() => switchTo(a.slot)}>
                <Avatar src={a.avatarUrl} name={a.username ?? a.email} className="size-(--size-control-sm)" />
                <span className="truncate">{a.username ? `@${a.username}` : a.email}</span>
              </button>
            ))}
          </div>
        ) : null}
        <div className="mt-1 border-t border-line pt-1">
          <button type="button" className={item} onClick={() => { close(); addAccount(); }}>
            <Plus aria-hidden="true" className="size-(--size-icon-sm)" />
            Hesap ekle
          </button>
          <button type="button" className={item} onClick={() => void signOut()}>
            <LogOut aria-hidden="true" className="size-(--size-icon-sm)" />
            Çıkış yap
          </button>
        </div>
      </div>
    </div>
  );
}
