import { newReleases, recentlyPlayed } from '@bekofy/core';
import { Button, buttonVariants } from '@bekofy/ui';
import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { Card, Section, Shelf } from '../components/blocks';
import { Cover } from '../components/cover';
import { LikeButton } from '../components/like-button';
import { usePlaylists } from '../lib/data';
import { player, usePlayer, type Track } from '../lib/player';
import { href } from '../lib/router';
import { useAuthed } from '../lib/session';
import { setUi } from '../lib/ui';
import { PlayButton } from '../shell/player-bar';

const greeting = () => {
  const h = new Date().getHours();
  return h < 6 ? 'İyi geceler' : h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar';
};

const songHref = (t: Track) => (t.album ? href({ name: 'album', artist: t.artist, title: t.album }) : href({ name: 'search', q: t.artist }));

export function HomeScreen() {
  const { sb, user, profile } = useAuthed();
  const p = usePlayer();
  const playlists = usePlaylists();
  const recent = useQuery({ queryKey: ['recent', user.id], queryFn: () => recentlyPlayed(sb, user.id, 20) });
  const fresh = useQuery({ queryKey: ['new-releases'], queryFn: () => newReleases(sb, 20) });
  const resume = p.current ?? recent.data?.[0] ?? null;

  return (
    <div className="flex flex-col gap-12 motion-safe:animate-[rise_var(--duration-slow)_var(--easing-emphasized)]">
      <h1 className="font-display text-[clamp(var(--font-size-4xl),5vw,var(--font-size-6xl))] leading-(--font-line-height-display) font-bold tracking-(--font-letter-spacing-display) text-balance">
        {greeting()}
        {profile.username ? `, ${profile.username}` : ''}
      </h1>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {resume ? (
          <section aria-labelledby="resume-title" className="glass-panel flex flex-col items-start gap-6 rounded-ui-xl p-6 sm:flex-row sm:items-end">
            <Cover src={resume.cover_url} className="w-(--size-artwork-lg) rounded-art-lg shadow-ui-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="type-label-md text-fg-muted">{p.current ? 'Şimdi çalıyor' : 'Kaldığın yerden devam et'}</span>
              <h2 id="resume-title" className="font-display text-(length:--font-size-4xl) leading-(--font-line-height-tight) font-bold tracking-(--font-letter-spacing-tight) [overflow-wrap:anywhere]">
                {resume.title}
              </h2>
              <span className="truncate text-fg-muted">{resume.artist}</span>
              <div className="mt-3 flex items-center gap-3">
                <PlayButton size="xl" playing={p.current?.id === resume.id && p.isPlaying} label={resume.title} onClick={() => (p.current?.id === resume.id ? player.toggle() : player.playList(recent.data ?? [resume], 0, 'recent'))} />
                <LikeButton songId={resume.id} title={resume.title} size="md" />
              </div>
            </div>
          </section>
        ) : (
          <section className="glass-panel flex flex-col items-start gap-3 rounded-ui-xl p-6">
            <h2 className="type-title-lg">Müziğe başla</h2>
            <p className="text-fg-muted">Ara, bir şarkı çal; dinlediklerin burada birikir.</p>
            <a href={href({ name: 'search', q: '' })} className={buttonVariants()}>
              Aramaya git
            </a>
          </section>
        )}
        <nav aria-label="Hızlı erişim" className="grid grid-cols-1 content-start gap-2 sm:grid-cols-2">
          <a href={href({ name: 'liked' })} className="glass-panel flex min-w-0 items-center gap-3 overflow-hidden rounded-ui-md pe-3 type-label-md hover:bg-glass">
            <span aria-hidden="true" className="grid size-(--size-artwork-md) shrink-0 place-items-center bg-accent text-on-accent">
              <Heart className="size-(--size-icon-md) fill-current" />
            </span>
            <span className="truncate">Beğenilen şarkılar</span>
          </a>
          {playlists.data?.slice(0, 5).map((pl) => (
            <a key={pl.id} href={href({ name: 'playlist', id: pl.id })} className="glass-panel flex min-w-0 items-center gap-3 overflow-hidden rounded-ui-md pe-3 type-label-md hover:bg-glass">
              <Cover src={pl.cover_url} className="size-(--size-artwork-md) rounded-none" />
              <span className="truncate">{pl.name}</span>
            </a>
          ))}
        </nav>
      </div>

      {recent.data?.length ? (
        <Section id="recent" title="Son dinlediklerin">
          <Shelf label="Son dinlediklerin">
            {recent.data.map((t, i) => (
              <Card key={t.id} href={songHref(t)} cover={t.cover_url} title={t.title} sub={t.artist} onPlay={() => player.playList(recent.data, i, 'recent')} />
            ))}
          </Shelf>
        </Section>
      ) : null}

      <Section id="fresh" title="Yeni eklenenler">
        {fresh.data?.length ? (
          <Shelf label="Yeni eklenenler">
            {fresh.data.map((t, i) => (
              <Card key={t.id} href={songHref(t)} cover={t.cover_url} title={t.title} sub={t.artist} onPlay={() => player.playList(fresh.data, i, 'new')} />
            ))}
          </Shelf>
        ) : (
          <p className="text-fg-muted">{fresh.isLoading ? 'Yükleniyor' : 'Henüz şarkı yok.'}</p>
        )}
      </Section>

      <section aria-labelledby="jam-band" className="flex flex-wrap items-center justify-between gap-6 rounded-ui-xl bg-inverse p-8 text-fg-inverse">
        <div className="flex flex-col gap-2">
          <h2 id="jam-band" className="font-display text-(length:--font-size-3xl) leading-(--font-line-height-tight) font-bold">
            Arkadaşlarınla aynı anda dinle
          </h2>
          <p>Jam başlat, kodu paylaş; çalan şarkı herkeste aynı anda ilerler.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href={href({ name: 'jam' })} className={buttonVariants()}>
            Jam başlat
          </a>
          <Button variant="ghost" className="text-fg-inverse hover:bg-[color-mix(in_srgb,currentColor_8%,transparent)]" onClick={() => setUi({ wrapped: true })}>
            Yılının özeti
          </Button>
        </div>
      </section>
    </div>
  );
}
