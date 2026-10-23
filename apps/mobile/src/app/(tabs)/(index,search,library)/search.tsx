import { searchArtists, searchProfiles, searchPublicPlaylists, searchSongs } from '@bekofy/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Search as SearchIcon, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Avatar } from '@/components/avatar';
import { Card, Empty, PageTitle, Shelf } from '@/components/blocks';
import { Screen, Section } from '@/components/screen';
import { TrackList } from '@/components/track-list';
import { IconButton, T } from '@/components/ui';
import { routes } from '@/lib/routes';
import { useAuthed } from '@/lib/session';
import { sb } from '@/lib/supabase';
import { useTheme } from '@/theme';

/** Yazarken her tuşta değil, kısa bir bekleme sonrası arar. */
function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export default function Search() {
  const t = useTheme();
  const { user } = useAuthed();
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim());
  const enabled = term.length >= 2;
  const res = useQuery({
    queryKey: ['search', term],
    enabled,
    queryFn: async () => {
      const [songs, artists, playlists, people] = await Promise.all([
        searchSongs(sb, term, 20),
        searchArtists(sb, term, 10),
        searchPublicPlaylists(sb, term, 10),
        searchProfiles(sb, term, { excludeId: user.id, limit: 10 }),
      ]);
      return { songs, artists, playlists, people };
    },
  });
  const d = enabled ? res.data : undefined;
  const nothing = d && !d.songs.length && !d.artists.length && !d.playlists.length && !d.people.length;

  return (
    <Screen>
      <PageTitle>Ara</PageTitle>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[2], paddingLeft: t.space[4], borderRadius: t.radius.full, backgroundColor: t.c.fill.muted, borderColor: t.c.border.strong, borderWidth: t.size.border.hairline, minHeight: t.size.control.lg + t.space[1] }}>
        <SearchIcon color={t.c.text.secondary} size={t.size.icon.sm} />
        <TextInput
          value={q}
          onChangeText={setQ}
          accessibilityLabel="Şarkı, sanatçı, liste ya da kişi ara"
          placeholder="Ne dinlemek istersin?"
          placeholderTextColor={t.c.text.secondary}
          selectionColor={t.c.accent.default}
          cursorColor={t.c.accent.text}
          returnKeyType="search"
          autoCorrect={false}
          style={[t.type.bodyMd, { flex: 1, color: t.c.text.primary, minHeight: t.size.control.lg }]}
        />
        {q ? <IconButton icon={X} label="Aramayı temizle" color={t.c.text.primary} onPress={() => setQ('')} /> : null}
      </View>
      <T accessibilityLiveRegion="polite" variant="bodySm" tone="secondary" style={{ marginTop: -t.space[5] }}>
        {!enabled ? 'En az iki harf yaz: şarkı, sanatçı, herkese açık liste ya da kişi.' : res.isFetching ? 'Aranıyor' : d ? `${d.songs.length} şarkı, ${d.artists.length} sanatçı, ${d.playlists.length} liste, ${d.people.length} kişi` : ''}
      </T>

      {enabled && res.error ? <Empty title="Arama yapılamadı">İnternet bağlantını kontrol edip tekrar dene.</Empty> : null}
      {nothing ? <Empty title="Sonuç yok">Yazımı kontrol et ya da sanatçı adıyla dene.</Empty> : null}
      {d?.songs.length ? (
        <Section title="Şarkılar">
          <TrackList tracks={d.songs} contextId="search" />
        </Section>
      ) : null}
      {d?.artists.length ? (
        <Section title="Sanatçılar">
          <Shelf label="Bulunan sanatçılar">
            {d.artists.map((a, i) => (
              <Card key={a.id} index={i} href={routes.artist(a.id)} cover={a.avatar_url} round title={a.name} sub="Sanatçı" />
            ))}
          </Shelf>
        </Section>
      ) : null}
      {d?.playlists.length ? (
        <Section title="Çalma listeleri">
          <Shelf label="Bulunan çalma listeleri">
            {d.playlists.map((p, i) => (
              <Card key={p.id} index={i} href={routes.playlist(p.id)} cover={p.cover_url} title={p.name} sub="Herkese açık liste" />
            ))}
          </Shelf>
        </Section>
      ) : null}
      {d?.people.length ? (
        <Section title="Kişiler">
          <View style={{ gap: t.space[1] }}>
            {d.people.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="link"
                accessibilityLabel={`@${p.username}`}
                onPress={() => router.push(routes.profile(p.id))}
                android_ripple={{ color: t.c.state.pressed }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3], minHeight: t.size.control.xl, paddingHorizontal: t.space[1], borderRadius: t.radius.md }}
              >
                <Avatar uri={p.avatar_url} name={p.username} />
                <T variant="labelMd" numberOfLines={1}>
                  @{p.username}
                </T>
              </Pressable>
            ))}
          </View>
        </Section>
      ) : null}
    </Screen>
  );
}
