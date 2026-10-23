import { follow, followCounts, formatCount, getPublicProfile, isFollowing, recentSummary, unfollow, userBadges } from '@bekofy/core';
import { Button } from '@bekofy/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, ExternalLink } from 'lucide-react';
import { Avatar } from '../components/avatar';
import { Card, CollectionHead, Loadable, Section, Shelf } from '../components/blocks';
import { showToast } from '../components/toast';
import { bridge } from '../lib/bridge';
import { href } from '../lib/router';
import { useAuthed } from '../lib/session';

export function ProfileScreen({ id }: { id: string }) {
  const { sb, user } = useAuthed();
  const qc = useQueryClient();
  const me = id === user.id;
  const q = useQuery({
    queryKey: ['profile', id, user.id],
    queryFn: async () => {
      const [profile, counts, following, badges, lists] = await Promise.all([
        getPublicProfile(sb, id),
        followCounts(sb, id),
        me ? Promise.resolve(false) : isFollowing(sb, user.id, id),
        userBadges(sb, id).catch(() => []),
        sb.from('playlists').select('id, name, cover_url').eq('user_id', id).eq('is_public', true).order('created_at', { ascending: false }),
      ]);
      const summary = me ? await recentSummary(sb, id, 30).catch(() => null) : null;
      return { profile, counts, following, badges, lists: lists.data ?? [], summary };
    },
  });

  return (
    <Loadable query={q} label="Profil">
      {({ profile, counts, following, badges, lists, summary }) => (
        <div className="flex flex-col gap-10">
          <CollectionHead
            kind="Profil"
            title={profile.username ? `@${profile.username}` : 'Kullanıcı'}
            description={profile.bio || undefined}
            meta={
              <span>
                <strong className="text-fg">{formatCount(counts.followers)}</strong> takipçi · <strong className="text-fg">{formatCount(counts.following)}</strong> takip
              </span>
            }
          >
            <Avatar src={profile.avatar_url} name={profile.username} className="size-(--size-artwork-lg) shadow-ui-lg type-display-lg" />
          </CollectionHead>
          <div className="flex flex-wrap gap-3">
            {me ? (
              <Button variant="secondary" onClick={() => void bridge?.openExternal('https://bekofy.bekirr.dev/account')}>
                <ExternalLink aria-hidden="true" />
                Profili sitede düzenle
              </Button>
            ) : (
              <Button
                variant={following ? 'secondary' : 'primary'}
                aria-pressed={following}
                onClick={async () => {
                  try {
                    if (following) await unfollow(sb, user.id, id);
                    else await follow(sb, user.id, id);
                    void qc.invalidateQueries({ queryKey: ['profile', id] });
                    void qc.invalidateQueries({ queryKey: ['friend-ids', user.id] });
                  } catch {
                    showToast('Değiştirilemedi. Tekrar dene.');
                  }
                }}
              >
                {following ? 'Takip ediliyor' : 'Takip et'}
              </Button>
            )}
          </div>

          {summary && summary.topArtists.length ? (
            <Section id="top" title="Bu ay en çok dinlediklerin">
              <ol className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {summary.topArtists.map((a, i) => (
                  <li key={a.id}>
                    <a href={href({ name: 'artist', id: a.id })} className="glass-panel flex items-center gap-3 rounded-ui-lg p-3 hover:bg-glass">
                      <span className="w-6 text-end type-label-md text-fg-muted">{i + 1}</span>
                      <span className="flex-1 truncate type-label-md">{a.name}</span>
                      <span className="type-body-sm text-fg-muted">{a.minutes} dk</span>
                    </a>
                  </li>
                ))}
              </ol>
            </Section>
          ) : null}

          {badges.length ? (
            <Section id="badges" title="Rozetler">
              <ul className="flex flex-wrap gap-2">
                {badges.map((b) => (
                  <li key={b.id} title={b.description ?? undefined} className="inline-flex min-h-(--size-control-sm) items-center gap-1.5 rounded-pill border border-line px-3 type-label-sm">
                    <Award aria-hidden="true" className="size-(--size-icon-xs) text-accent-fg" />
                    {b.name}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section id="public-lists" title="Herkese açık çalma listeleri">
            {lists.length ? (
              <Shelf label="Herkese açık çalma listeleri">
                {lists.map((l) => (
                  <Card key={l.id} href={href({ name: 'playlist', id: l.id })} cover={l.cover_url} title={l.name} sub="Çalma listesi" />
                ))}
              </Shelf>
            ) : (
              <p className="text-fg-muted">{me ? 'Herkese açık listen yok. Bir listenin sayfasında "Herkese açık"ı aç.' : 'Herkese açık listesi yok.'}</p>
            )}
          </Section>
        </div>
      )}
    </Loadable>
  );
}
