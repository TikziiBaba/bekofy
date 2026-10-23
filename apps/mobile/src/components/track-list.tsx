// Şarkı listesi: satıra dokununca çalar; beğen ve seçenekler ayrı düğmeler. Ekran okuyucuda satır tek öğedir.
// Sağa çek: sıradaki olarak çal. Sola çek: çalma listesine ekle. İkisi ekran okuyucuda satırın özel eylemleridir.

import { formatDuration } from '@bekofy/core';
import { EllipsisVertical, ListPlus, ListStart } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { haptic } from '@/lib/motion';
import { useOffline } from '@/lib/offline';
import { player, usePlayer, type Track } from '@/lib/player';
import { showToast } from '@/lib/toast';
import { useTheme } from '@/theme';
import { enter } from './blocks';
import { Cover } from './cover';
import { Equalizer } from './equalizer';
import { LikeButton } from './like-button';
import { SongSheet } from './song-sheet';
import { SwipeRow } from './swipe-row';
import { IconButton, T } from './ui';

export const playNext = (track: Track) => {
  player.playNextTrack(track);
  showToast(`${track.title} sıradaki olarak eklendi`);
};

export function TrackList({ tracks, contextId = null, onRemove }: { tracks: readonly Track[]; contextId?: string | null; onRemove?: (t: Track) => void }) {
  const t = useTheme();
  const p = usePlayer();
  const offline = useOffline();
  const downloaded = new Set(offline.songs.map((s) => s.id));
  const [menu, setMenu] = useState<{ track: Track; mode: 'menu' | 'playlist' } | null>(null);
  const open = (track: Track, mode: 'menu' | 'playlist') => setMenu({ track, mode });

  return (
    <View style={{ marginHorizontal: -t.space[2] }}>
      {tracks.map((track, i) => {
        const current = p.current?.id === track.id;
        const playing = current && p.isPlaying;
        const isDown = downloaded.has(track.id);
        const duration = track.duration ? formatDuration(track.duration) : null;
        return (
          <Animated.View key={`${track.id}-${i}`} entering={i < 12 ? enter(i) : undefined}>
            <SwipeRow left={{ icon: ListStart, label: 'Sıradaki çal', run: () => playNext(track) }} right={{ icon: ListPlus, label: 'Çalma listesine ekle', run: () => open(track, 'playlist') }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={[track.title, track.artist, isDown ? 'indirildi' : null, duration, current ? (playing ? 'çalıyor' : 'duraklatıldı') : null].filter(Boolean).join(', ')}
                  accessibilityHint={current ? 'Çalmayı duraklatır ya da sürdürür' : 'Çalar'}
                  accessibilityActions={[
                    { name: 'playNext', label: 'Sıradaki çal' },
                    { name: 'addToPlaylist', label: 'Çalma listesine ekle' },
                  ]}
                  onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'playNext' ? playNext(track) : open(track, 'playlist'))}
                  onPress={() => (current ? player.toggle() : player.playList(tracks, i, contextId))}
                  onLongPress={() => {
                    haptic.heavy();
                    open(track, 'menu');
                  }}
                  android_ripple={{ color: t.c.state.pressed }}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.space[3], minHeight: t.size.control.xl, paddingHorizontal: t.space[2] }}
                >
                  <View>
                    <Cover uri={track.cover_url} size={t.size.artwork.sm} />
                    {playing ? (
                      <View style={{ position: 'absolute', inset: 0, borderRadius: t.radius.artwork.sm, backgroundColor: t.c.scrim, alignItems: 'center', justifyContent: 'center' }}>
                        <Equalizer />
                      </View>
                    ) : null}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T variant="labelMd" numberOfLines={1} style={current ? { color: t.c.accent.text } : undefined}>
                      {track.title}
                    </T>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space['1-5'] }}>
                      {isDown ? (
                        <T variant="labelSm" style={{ backgroundColor: t.c.fill.muted, paddingHorizontal: t.space[1], borderRadius: t.radius.xs, overflow: 'hidden' }}>
                          İndirildi
                        </T>
                      ) : null}
                      <T variant="bodySm" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
                        {track.artist}
                      </T>
                    </View>
                  </View>
                </Pressable>
                <LikeButton songId={track.id} title={track.title} />
                <IconButton icon={EllipsisVertical} label={`Diğer seçenekler: ${track.title}`} size={t.size.icon.sm} onPress={() => open(track, 'menu')} />
              </View>
            </SwipeRow>
          </Animated.View>
        );
      })}
      <SongSheet track={menu?.track ?? null} mode={menu?.mode} onClose={() => setMenu(null)} onRemove={onRemove} />
    </View>
  );
}
