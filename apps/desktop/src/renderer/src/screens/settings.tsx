import { isAdmin, isPremium } from '@bekofy/core';
import { Button, cn, StatusPill, Switch } from '@bekofy/ui';
import { ExternalLink, LogOut, Monitor, Moon, Plus, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { Avatar } from '../components/avatar';
import { PageTitle } from '../components/blocks';
import { bridge } from '../lib/bridge';
import { useOffline } from '../lib/offline';
import { href } from '../lib/router';
import { useAuthed, useSession } from '../lib/session';
import { updateSettings, useSettings, type ThemeChoice } from '../lib/settings';

const SITE = 'https://bekofy.bekirr.dev';
const THEMES: Array<[ThemeChoice, string, typeof Moon]> = [
  ['dark', 'Koyu', Moon],
  ['light', 'Açık', Sun],
  ['system', 'Sisteme uy', Monitor],
];

function Setting({ id, title, description, control }: { id: string; title: string; description: string; control: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-ui-lg px-4 py-3">
      <span className="flex min-w-0 flex-col">
        <span id={`${id}-l`} className="type-label-md">
          {title}
        </span>
        <span id={`${id}-d`} className="type-body-sm text-fg-muted">
          {description}
        </span>
      </span>
      {control}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <legend className="mb-2 type-title-sm">{title}</legend>
      {children}
    </fieldset>
  );
}

export function SettingsScreen() {
  const s = useSettings();
  const { profile, user, slot } = useAuthed();
  const { accounts, switchTo, addAccount, signOut } = useSession();
  const offline = useOffline();

  return (
    <div className="flex max-w-[calc(var(--size-layout-panel)*2.4)] flex-col gap-10">
      <PageTitle>Ayarlar</PageTitle>

      <Group title="Görünüm">
        <div role="radiogroup" aria-label="Tema" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {THEMES.map(([value, label, Icon]) => (
            <label key={value} className={cn('relative flex cursor-pointer flex-col gap-2 rounded-ui-lg border-2 border-transparent bg-fill p-4 hover:bg-fill-strong has-checked:border-accent-fg has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring')}>
              <Icon aria-hidden="true" className="size-(--size-icon-md)" />
              <input type="radio" name="theme" value={value} checked={s.theme === value} onChange={() => updateSettings({ theme: value })} className="sr-only" />
              <span className="type-label-md">{label}</span>
            </label>
          ))}
        </div>
        <div className="glass-panel rounded-ui-xl p-1">
          <Setting
            id="cover"
            title="Kapak rengini arka planda kullan"
            description="Arka plandaki ışık çalan şarkının kapağından gelir. Vurgu rengi her zaman yeşil kalır."
            control={<Switch checked={s.coverColor} aria-labelledby="cover-l" aria-describedby="cover-d" onCheckedChange={(v) => updateSettings({ coverColor: v })} />}
          />
        </div>
      </Group>

      {bridge ? (
        <Group title="Masaüstü">
          <div className="glass-panel rounded-ui-xl p-1">
            <Setting
              id="discord"
              title="Discord'da ne dinlediğini göster"
              description="Discord açıkken profilinde “Bekofy dinliyor” ve çalan şarkı görünür."
              control={<Switch checked={s.discord} aria-labelledby="discord-l" aria-describedby="discord-d" onCheckedChange={(v) => updateSettings({ discord: v })} />}
            />
            <Setting
              id="downloads"
              title="İndirilen şarkılar"
              description={`${offline.songs.length} şarkı bu bilgisayarda; internetsiz de çalar.`}
              control={
                <a href={href({ name: 'library', filter: 'downloads' })} className="type-label-md text-accent-fg hover:underline">
                  Göster
                </a>
              }
            />
          </div>
        </Group>
      ) : null}

      <Group title="Hesaplar">
        <ul className="glass-panel flex flex-col gap-1 rounded-ui-xl p-2">
          {accounts.map((a) => (
            <li key={a.slot} className="flex items-center justify-between gap-3 rounded-ui-lg px-3 py-2">
              <span className="flex min-w-0 items-center gap-3">
                <Avatar src={a.avatarUrl} name={a.username ?? a.email} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate type-label-md">{a.username ? `@${a.username}` : 'Kullanıcı adı yok'}</span>
                  <span className="truncate type-body-sm text-fg-muted">{a.email}</span>
                </span>
              </span>
              {a.slot === slot ? (
                <StatusPill tone="ok">Etkin</StatusPill>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => switchTo(a.slot)}>
                  Bu hesaba geç
                </Button>
              )}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={addAccount}>
            <Plus aria-hidden="true" />
            Hesap ekle
          </Button>
          <Button variant="ghost" onClick={() => void signOut()}>
            <LogOut aria-hidden="true" />
            Bu hesaptan çıkış yap
          </Button>
        </div>
      </Group>

      <Group title="Üyelik ve site">
        <div className="glass-panel rounded-ui-xl p-1">
          <Setting
            id="plan"
            title={isPremium(profile) ? 'Premium üyesin' : 'Ücretsiz plan'}
            description={isPremium(profile) ? 'İndirme, avatar çerçeveleri ve Premium rozeti açık.' : 'Premium ile şarkıları indirip internetsiz dinleyebilirsin.'}
            control={
              <Button variant="secondary" size="sm" onClick={() => void bridge?.openExternal(`${SITE}/premium`)}>
                <ExternalLink aria-hidden="true" />
                Premium
              </Button>
            }
          />
          <Setting
            id="account"
            title="Hesap ve profil"
            description={`Şifre, profil görseli ve hesap ayarları sitede: ${user.email ?? ''}`}
            control={
              <Button variant="secondary" size="sm" onClick={() => void bridge?.openExternal(`${SITE}/account`)}>
                <ExternalLink aria-hidden="true" />
                Hesabım
              </Button>
            }
          />
          {isAdmin(profile) ? (
            <Setting
              id="admin"
              title="Admin paneli"
              description="Şarkı onayı, YouTube'dan ekleme ve kullanıcı yönetimi sitede."
              control={
                <Button variant="secondary" size="sm" onClick={() => void bridge?.openExternal(`${SITE}/admin`)}>
                  <ExternalLink aria-hidden="true" />
                  Aç
                </Button>
              }
            />
          ) : null}
        </div>
      </Group>

      <p className="type-body-sm text-fg-muted">Bekofy {bridge?.version || ''}</p>
    </div>
  );
}
