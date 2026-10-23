import { follow, followCounts, formatCount, getPublicProfile, isFollowing, recentSummary, unfollow, userBadges } from '@bekofy/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Award, ExternalLink } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Avatar } from '@/components/avatar';
import { Card, CollectionHead, Loadable, Shelf } from '@/components/blocks';
import { Screen, Section } from '@/components/screen';
import { Button, T } from '@/components/ui';
import { routes } from '@/lib/routes';
import { useAuthed } from '@/lib/session';
import { sb } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import { useTheme } from '@/theme';

export default function Profile() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthed();
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
    <Screen back title={q.data?.profile.username ? `@${q.data.profile.username}` : undefined} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Loadable query={q} label="Profil">
        {({ profile, counts, following, badges, lists, summary }) => (
          <>
            <CollectionHead
              kind="Profil"
              title={profile.username ? `@${profile.username}` : 'Kullanıcı'}
              description={profile.bio || null}
              meta={`${formatCount(counts.followers)} takipçi · ${formatCount(counts.following)} takip`}
              art={<Avatar uri={profile.avatar_url} name={profile.username} size={t.size.artwork.xl} />}
            />
            {me ? (
              <Button variant="secondary" icon={ExternalLink} label="Profili sitede düzenle" onPress={() => void WebBrowser.openBrowserAsync('https://bekofy.bekirr.dev/account')} />
            ) : (
              <Button
                variant={following ? 'secondary' : 'primary'}
                label={following ? 'Takip ediliyor' : 'Takip et'}
                onPress={async () => {
                  try {
                    if (following) await unfollow(sb, user.id, id);
                    else await follow(sb, user.id, id);
                    void qc.invalidateQueries({ queryKey: ['profile', id] });
                  } catch {
                    showToast('Değiştirilemedi. Tekrar dene.');
                  }
                }}
              />
            )}

            {summary && summary.topArtists.length ? (
              <Section title="Bu ay en çok dinlediklerin">
                <View style={{ gap: t.space[1] }}>
                  {summary.topArtists.map((a, i) => (
                    <Pressable
                      key={a.id}
                      accessibilityRole="link"
                      accessibilityLabel={`${i + 1}. ${a.name}, ${a.minutes} dakika`}
                      onPress={() => router.push(routes.artist(a.id))}
                      android_ripple={{ color: t.c.state.pressed }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3], minHeight: t.size.control.lg, paddingHorizontal: t.space[3], borderRadius: t.radius.md, backgroundColor: t.c.fill.subtle }}
                    >
                      <T variant="labelMd" tone="secondary" style={{ width: t.space[6], textAlign: 'right' }}>
                        {i + 1}
                      </T>
                      <T variant="labelMd" numberOfLines={1} style={{ flex: 1 }}>
                        {a.name}
                      </T>
                      <T variant="bodySm" tone="secondary">
                        {a.minutes} dk
                      </T>
                    </Pressable>
                  ))}
                </View>
              </Section>
            ) : null}

            {badges.length ? (
              <Section title="Rozetler">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2] }}>
                  {badges.map((b) => (
                    <View
                      key={b.id}
                      accessible
                      accessibilityLabel={b.description ? `${b.name}: ${b.description}` : b.name}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: t.space['1-5'], minHeight: t.size.control.sm, paddingHorizontal: t.space[3], borderRadius: t.radius.full, borderColor: t.c.border.strong, borderWidth: t.size.border.hairline }}
                    >
                      <Award color={t.c.accent.text} size={t.size.icon.xs} />
                      <T variant="labelSm">{b.name}</T>
                    </View>
                  ))}
                </View>
              </Section>
            ) : null}

            <Section title="Herkese açık çalma listeleri">
              {lists.length ? (
                <Shelf label="Herkese açık çalma listeleri">
                  {lists.map((l, i) => (
                    <Card key={l.id} index={i} href={routes.playlist(l.id)} cover={l.cover_url} title={l.name} sub="Çalma listesi" />
                  ))}
                </Shelf>
              ) : (
                <T tone="secondary">{me ? 'Herkese açık listen yok. Bir listenin sayfasında "Herkese açık"ı aç.' : 'Herkese açık listesi yok.'}</T>
              )}
            </Section>
          </>
        )}
      </Loadable>
    </Screen>
  );
}
