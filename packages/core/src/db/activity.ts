// "Şimdi ne dinliyor": kullanıcının çalan şarkısı profiles tablosunda tutulur, arkadaşlar canlı izler.

import type { BekofyClient } from '../client';
import { check, must } from './errors';
import { SONG_FIELDS } from './songs';

export async function setNowPlaying(sb: BekofyClient, userId: string, songId: string | null, isPlaying: boolean): Promise<void> {
  check(
    await sb.from('profiles').update({ current_song_id: songId, is_playing: isPlaying, last_activity: new Date().toISOString() }).eq('id', userId),
    'Dinleme durumu güncellenemedi',
  );
}

export async function friendsActivity(sb: BekofyClient, ids: readonly string[]) {
  if (!ids.length) return [];
  return must(
    await sb.from('profiles').select(`id, username, avatar_url, is_playing, last_activity, song:songs!profiles_current_song_id_fkey(${SONG_FIELDS})`)
      .in('id', [...ids]).not('current_song_id', 'is', null).order('last_activity', { ascending: false }),
    'Arkadaş etkinliği alınamadı',
  );
}

export interface ActivityChange {
  userId: string;
  songId: string | null;
  isPlaying: boolean;
  lastActivity: string;
}

/** Arkadaşların dinleme durumu değiştikçe çağrılır. Dönen fonksiyon aboneliği kapatır. En çok 100 kişi. */
export function subscribeToActivity(sb: BekofyClient, ids: readonly string[], onChange: (change: ActivityChange) => void): () => void {
  if (!ids.length) return () => undefined;
  const channel = sb
    .channel(`activity:${ids.length}:${ids[0]}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=in.(${ids.slice(0, 100).join(',')})` }, (payload) => {
      const row = payload.new as { id: string; current_song_id: string | null; is_playing: boolean; last_activity: string };
      onChange({ userId: row.id, songId: row.current_song_id, isPlaying: row.is_playing, lastActivity: row.last_activity });
    })
    .subscribe();
  return () => void sb.removeChannel(channel);
}
