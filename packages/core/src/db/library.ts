// Beğenilen şarkılar.

import type { BekofyClient } from '../client';
import { check, must } from './errors';
import { SONG_FIELDS, type SongSummary } from './songs';

export async function likedSongIds(sb: BekofyClient, userId: string): Promise<Set<string>> {
  const rows = must(await sb.from('liked_songs').select('song_id').eq('user_id', userId), 'Beğeniler alınamadı');
  return new Set(rows.map((r) => r.song_id));
}

/** En son beğenilen başta. */
export async function likedSongs(sb: BekofyClient, userId: string): Promise<Array<SongSummary & { liked_at: string }>> {
  const rows = must(
    await sb.from('liked_songs').select(`created_at, song:songs(${SONG_FIELDS})`).eq('user_id', userId).order('created_at', { ascending: false }),
    'Beğenilen şarkılar alınamadı',
  );
  return rows.flatMap((r) => (r.song ? [{ ...r.song, liked_at: r.created_at }] : []));
}

export async function likeSong(sb: BekofyClient, userId: string, songId: string): Promise<void> {
  check(await sb.from('liked_songs').upsert({ user_id: userId, song_id: songId }, { ignoreDuplicates: true }), 'Şarkı beğenilemedi');
}

export async function unlikeSong(sb: BekofyClient, userId: string, songId: string): Promise<void> {
  check(await sb.from('liked_songs').delete().eq('user_id', userId).eq('song_id', songId), 'Beğeni kaldırılamadı');
}
