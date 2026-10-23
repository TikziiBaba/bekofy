// Arkadaşların ne dinliyor: karşılıklı takipleşilen kişiler. Bir arkadaşın çaldığı şarkı değişince liste canlı yenilenir.
// Şu an dinleyenin yanında küçük bir ekolayzır oynar.

import { formatRelative, friendIds, friendsActivity, subscribeToActivity } from '@bekofy/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { routes } from '@/lib/routes';
import { useAuthed } from '@/lib/session';
import { sb } from '@/lib/supabase';
import { useTheme } from '@/theme';
import { Avatar } from './avatar';
import { enter } from './blocks';
import { Equalizer } from './equalizer';
import { Section } from './screen';
import { Tappable } from './tappable';
import { T } from './ui';

export function FriendsActivity() {
  const t = useTheme();
  const { user } = useAuthed();
  const qc = useQueryClient();
  const ids = useQuery({ queryKey: ['friend-ids', user.id], queryFn: () => friendIds(sb, user.id) });
  const activity = useQuery({
    queryKey: ['friend-activity', user.id, ids.data?.length ?? 0],
    queryFn: () => friendsActivity(sb, ids.data ?? []),
    enabled: Boolean(ids.data?.length),
  });

  useEffect(() => {
    if (!ids.data?.length) return;
    return subscribeToActivity(sb, ids.data, () => void qc.invalidateQueries({ queryKey: ['friend-activity', user.id] }));
  }, [ids.data, qc, user.id]);

  // Arkadaşı olmayan ya da kimse dinlemiyorsa bölüm hiç görünmez: ana sayfa boş bir kutuyla kalabalıklaşmasın.
  const rows = (activity.data ?? []).filter((f) => f.song);
  if (!rows.length) return null;

  return (
    <Section title="Arkadaşların ne dinliyor">
      <View style={{ gap: t.space[1], marginHorizontal: -t.space[2] }}>
        {rows.slice(0, 6).map((f, i) => (
          <Animated.View key={f.id} entering={enter(i)}>
            <Tappable
              accessibilityRole="link"
              accessibilityLabel={`${f.username ?? 'adsız'}: ${f.song!.title}, ${f.song!.artist}. ${f.is_playing ? 'Şu an dinliyor' : formatRelative(f.last_activity)}`}
              onPress={() => router.push(routes.profile(f.id))}
              scaleTo={0.98}
              style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3], minHeight: t.size.control.xl, paddingHorizontal: t.space[2], borderRadius: t.radius.md }}
            >
              <View>
                <Avatar uri={f.avatar_url} name={f.username} size={t.size.artwork.sm} />
                {f.is_playing ? (
                  <View style={{ position: 'absolute', right: -2, bottom: -2, padding: 4, borderRadius: t.radius.full, backgroundColor: t.c.surface.raised }}>
                    <Equalizer />
                  </View>
                ) : null}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T variant="labelMd" numberOfLines={1}>
                  {f.username ?? 'adsız'}
                </T>
                <T variant="bodySm" tone="secondary" numberOfLines={1}>
                  {`${f.song!.title} · ${f.song!.artist}`}
                </T>
              </View>
              {f.is_playing ? null : (
                <T variant="caption" tone="secondary">
                  {formatRelative(f.last_activity)}
                </T>
              )}
            </Tappable>
          </Animated.View>
        ))}
      </View>
    </Section>
  );
}
