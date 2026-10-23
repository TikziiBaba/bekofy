import { formatCount, managedArtist, recentSummary } from '@bekofy/core';
import { Button, buttonVariants, Notice, StatusPill } from '@bekofy/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { signOutAction } from '@/app/actions/auth';
import { PasswordForm } from '@/components/account/password-form';
import { ProfileForm } from '@/components/account/profile-form';
import { Avatar } from '@/components/avatar';
import { PageHead, Panel, Stat } from '@/components/panel';
import { createClient } from '@/lib/supabase/server';
import { requireViewer } from '@/lib/viewer';

export const metadata: Metadata = { title: 'Hesabım', robots: { index: false } };

export default async function AccountPage() {
  const viewer = await requireViewer('/account');
  const { user, profile } = viewer;
  const sb = await createClient();
  const [summary, artist] = await Promise.all([
    recentSummary(sb, user.id, 30).catch(() => null),
    managedArtist(sb, user.id).catch(() => null),
  ]);
  const providers = new Set((user.identities ?? []).map((i) => i.provider));
  const name = profile?.username ?? user.email ?? 'Hesabın';

  return (
    <div className="mx-auto flex w-full max-w-(--size-layout-content) flex-col gap-8 px-4 py-10 sm:px-8">
      <PageHead
        title="Hesabım"
        actions={
          <form action={signOutAction}>
            <Button type="submit" variant="ghost">
              Çıkış yap
            </Button>
          </form>
        }
      />

      {profile?.is_banned ? <Notice tone="danger" title="Hesabın askıya alındı">Uygulamalarda giriş yapamazsın. Destek için bizimle iletişime geç.</Notice> : null}

      <div className="flex flex-wrap items-center gap-4">
        <Avatar src={profile?.avatar_url} name={name} className="size-(--size-artwork-md)" />
        <div className="flex min-w-0 flex-col gap-2">
          <p className="truncate type-title-lg">{profile?.username ? `@${profile.username}` : 'Kullanıcı adı seçilmedi'}</p>
          <div className="flex flex-wrap gap-2">
            {viewer.isPremium ? <StatusPill tone="ok">Premium</StatusPill> : <StatusPill>Ücretsiz plan</StatusPill>}
            {artist ? <StatusPill tone="info">Sanatçı: {artist.name}</StatusPill> : null}
            {viewer.isAdmin ? <StatusPill tone="info">Admin</StatusPill> : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Panel id="profile" title="Profil" description="Uygulamada arkadaşlarının gördüğü ad ve görsel.">
            <ProfileForm userId={user.id} username={profile?.username ?? null} bio={profile?.bio ?? ''} avatarUrl={profile?.avatar_url ?? null} />
          </Panel>
          <Panel id="security" title="Güvenlik" description={`Giriş e-postan: ${user.email ?? 'yok'}`}>
            <p className="type-body-sm text-fg-muted">
              Giriş yöntemlerin: {[providers.has('email') ? 'e-posta ve şifre' : null, providers.has('google') ? 'Google' : null].filter(Boolean).join(', ') || 'e-posta'}
            </p>
            <PasswordForm />
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel id="plan" title="Üyelik">
            {viewer.isPremium ? (
              <p>Premium üyesin: indirme, avatar çerçeveleri ve Premium rozeti açık.</p>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-fg-muted">Ücretsiz plandasın. Premium ile şarkıları indirip internetsiz dinleyebilirsin.</p>
                <Link href="/premium" className={buttonVariants({ className: 'self-start' })}>
                  Premium'u incele
                </Link>
              </div>
            )}
          </Panel>

          <Panel id="listening" title="Son 30 gün" description="Uygulamalarda dinlediklerinden.">
            {summary && summary.plays > 0 ? (
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Dinleme" value={formatCount(summary.plays)} />
                  <Stat label="Dakika" value={formatCount(summary.totalMinutes)} />
                </div>
                {summary.topSongs.length ? (
                  <div className="flex flex-col gap-2">
                    <h3 className="type-label-md">En çok dinlediğin şarkılar</h3>
                    <ol className="flex flex-col gap-1">
                      {summary.topSongs.map((s, i) => (
                        <li key={s.id} className="flex items-center gap-3 type-body-sm">
                          <span className="w-5 text-end text-fg-muted">{i + 1}</span>
                          <span className="min-w-0 flex-1 truncate">{s.title}</span>
                          <span className="text-fg-muted">{s.plays} kez</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-fg-muted">Henüz dinleme yok. Uygulamada şarkı çaldıkça özetin burada görünür.</p>
            )}
          </Panel>

          <Panel id="more" title="Diğer">
            <div className="flex flex-wrap gap-2">
              <Link href="/artist" className={buttonVariants({ variant: 'secondary' })}>
                {artist ? 'Sanatçı paneli' : 'Sanatçı ol'}
              </Link>
              {viewer.isAdmin ? (
                <Link href="/admin" className={buttonVariants({ variant: 'secondary' })}>
                  Admin paneli
                </Link>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
