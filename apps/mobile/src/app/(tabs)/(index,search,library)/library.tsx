import { followedArtists } from '@bekofy/core';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Heart, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Empty, PageTitle } from '@/components/blocks';
import { Cover } from '@/components/cover';
import { NamePrompt } from '@/components/name-prompt';
import { Screen } from '@/components/screen';
import { TrackList } from '@/components/track-list';
import { IconButton, T } from '@/components/ui';
import { useCreatePlaylist, usePlaylists } from '@/lib/data';
import { offlineAsTrack, useOffline } from '@/lib/offline';
import { routes } from '@/lib/routes';
import { useAuthed } from '@/lib/session';
import { sb } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import { useTheme } from '@/theme';

type Filter = 'all' | 'playlists' | 'artists' | 'downloads';
const FILTERS: Array<[Filter, string]> = [
  ['all', 'Tümü'],
  ['playlists', 'Çalma listeleri'],
  ['artists', 'Sanatçılar'],
  ['downloads', 'İndirilenler'],
];

interface Row {
  key: string;
  href: Href;
  cover: string | null;
  liked?: boolean;
  round?: boolean;
  title: string;
  meta: string;
}

export default function Library() {
  const t = useTheme();
  const { user, profile } = useAuthed();
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(false);
  const playlists = usePlaylists();
  const create = useCreatePlaylist();
  const artists = useQuery({ queryKey: ['followed-artists', user.id], queryFn: () => followedArtists(sb, user.id) });
  const offline = useOffline();

  const rows: Row[] = [
    ...(filter === 'all' || filter === 'playlists'
      ? [
          { key: 'liked', href: routes.liked, cover: null, liked: true, title: 'Beğenilen şarkılar', meta: 'Çalma listesi' },
          ...(playlists.data ?? []).map((p) => ({ key: p.id, href: routes.playlist(p.id), cover: p.cover_url, title: p.name, meta: `Çalma listesi · ${p.user_id === user.id ? (profile.username ?? 'sen') : 'ortak'}` })),
        ]
      : []),
    ...(filter === 'all' || filter === 'artists' ? (artists.data ?? []).map((a) => ({ key: a.id, href: routes.artist(a.id), cover: a.avatar_url, round: true, title: a.name, meta: 'Sanatçı' })) : []),
  ];

  return (
    <Screen
      refreshing={playlists.isRefetching || artists.isRefetching}
      onRefresh={() => {
        void playlists.refetch();
        void artists.refetch();
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <PageTitle>Kitaplığın</PageTitle>
        <IconButton icon={Plus} label="Yeni çalma listesi" color={t.c.text.primary} onPress={() => setCreating(true)} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" style={{ marginHorizontal: -t.space[4], marginTop: -t.space[4] }} contentContainerStyle={{ gap: t.space[2], paddingHorizontal: t.space[4] }}>
        {FILTERS.map(([f, label]) => {
          const on = filter === f;
          return (
            <Pressable
              key={f}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => setFilter(f)}
              style={{ minHeight: t.size.control.md, justifyContent: 'center', paddingHorizontal: t.space[4], borderRadius: t.radius.full, backgroundColor: on ? t.c.surface.inverse : t.c.fill.subtle }}
            >
              <T variant="labelMd" tone={on ? 'inverse' : 'primary'}>
                {label}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>

      {filter === 'downloads' ? (
        offline.songs.length ? (
          <TrackList tracks={offline.songs.map(offlineAsTrack)} contextId="downloads" />
        ) : (
          <Empty title="Henüz indirdiğin şarkı yok">Bir şarkının seçeneklerinden ya da bir listenin indir düğmesinden indir; internet yokken de çalar.</Empty>
        )
      ) : rows.length ? (
        <View style={{ gap: t.space[1], marginHorizontal: -t.space[2] }}>
          {rows.map((r) => (
            <Pressable
              key={r.key}
              accessibilityRole="link"
              accessibilityLabel={`${r.title}, ${r.meta}`}
              onPress={() => router.push(r.href)}
              android_ripple={{ color: t.c.state.pressed }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3], minHeight: t.size.control.xl, paddingHorizontal: t.space[2], borderRadius: t.radius.md }}
            >
              {r.liked ? (
                <View style={{ width: t.size.artwork.sm, height: t.size.artwork.sm, borderRadius: t.radius.artwork.sm, backgroundColor: t.c.accent.default, alignItems: 'center', justifyContent: 'center' }}>
                  <Heart color={t.c.accent.on} fill={t.c.accent.on} size={t.size.icon.sm} />
                </View>
              ) : (
                <Cover uri={r.cover} size={t.size.artwork.sm} round={r.round} />
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <T variant="labelMd" numberOfLines={1}>
                  {r.title}
                </T>
                <T variant="bodySm" tone="secondary" numberOfLines={1}>
                  {r.meta}
                </T>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <Empty title={filter === 'artists' ? 'Takip ettiğin sanatçı yok' : 'Kitaplığın boş'}>
          {filter === 'artists' ? 'Bir sanatçının sayfasında "Takip et"e dokun.' : 'Sağ üstteki artı düğmesiyle yeni bir çalma listesi oluştur.'}
        </Empty>
      )}

      <NamePrompt
        open={creating}
        title="Yeni çalma listesi"
        label="Liste adı"
        confirmLabel="Oluştur"
        onClose={() => setCreating(false)}
        onSubmit={async (name) => {
          const list = await create.mutateAsync(name);
          setCreating(false);
          showToast(`${name} oluşturuldu`);
          router.push(routes.playlist(list.id));
        }}
      />
    </Screen>
  );
}
