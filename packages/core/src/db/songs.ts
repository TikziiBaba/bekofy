// Şarkılar: liste, arama, yeni çıkanlar, onay akışı (admin) ve ses adresi.

import type { BekofyClient } from '../client';
import type { Tables, TablesInsert, TablesUpdate } from './database.types';
import { check, must, searchTerm } from './errors';

export type Song = Tables<'songs'>;
export type SongStatus = 'approved' | 'pending' | 'rejected';

/** Liste görünümleri için sütunlar: söz metinleri (büyük) dahil değil. */
export const SONG_FIELDS = 'id, title, artist, album, duration, cover_url, file_path, genre, status, created_at' as const;
export type SongSummary = Pick<Song, 'id' | 'title' | 'artist' | 'album' | 'duration' | 'cover_url' | 'file_path' | 'genre' | 'status' | 'created_at'>;

export async function listSongs(
  sb: BekofyClient,
  { status = 'approved', limit = 50, offset = 0 }: { status?: SongStatus; limit?: number; offset?: number } = {},
): Promise<SongSummary[]> {
  const res = await sb.from('songs').select(SONG_FIELDS).eq('status', status)
    .order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  return must(res, 'Şarkılar alınamadı');
}

export async function getSong(sb: BekofyClient, id: string): Promise<Song> {
  return must(await sb.from('songs').select('*').eq('id', id).single(), 'Şarkı alınamadı');
}

/** Kimliklerdeki şarkılar, verilen sırayla (çalma listesi, kuyruk geri yükleme). Bulunamayanlar atlanır. */
export async function songsByIds(sb: BekofyClient, ids: readonly string[]): Promise<SongSummary[]> {
  if (!ids.length) return [];
  const rows = must(await sb.from('songs').select(SONG_FIELDS).in('id', [...new Set(ids)]), 'Şarkılar alınamadı');
  const byId = new Map(rows.map((s) => [s.id, s]));
  return ids.map((id) => byId.get(id)).filter((s): s is SongSummary => s !== undefined);
}

/** Şarkı adı ya da sanatçı metninde arar (büyük/küçük harf duyarsız). */
export async function searchSongs(sb: BekofyClient, query: string, limit = 20): Promise<SongSummary[]> {
  const term = searchTerm(query);
  if (!term) return [];
  const res = await sb.from('songs').select(SONG_FIELDS).eq('status', 'approved')
    .or(`title.ilike.%${term}%,artist.ilike.%${term}%`).limit(limit);
  return must(res, 'Arama yapılamadı');
}

export async function newReleases(sb: BekofyClient, limit = 10): Promise<SongSummary[]> {
  return listSongs(sb, { limit });
}

/** Sanatçı metnine göre şarkılar (song_artists bağı gelene kadar; "A, B" gibi çoklu adları da yakalar). */
export async function songsByArtistName(sb: BekofyClient, name: string, limit = 50): Promise<SongSummary[]> {
  const term = searchTerm(name);
  if (!term) return [];
  const res = await sb.from('songs').select(SONG_FIELDS).eq('status', 'approved').ilike('artist', `%${term}%`)
    .order('created_at', { ascending: false }).limit(limit);
  return must(res, 'Sanatçının şarkıları alınamadı');
}

/** Şarkı ekler (admin ya da sanatçı yüklemesi). Sanatçı yüklemeleri "pending" gelir, admin onaylar. */
export async function createSong(sb: BekofyClient, song: TablesInsert<'songs'>): Promise<Song> {
  return must(await sb.from('songs').insert(song).select('*').single(), 'Şarkı eklenemedi');
}

export async function updateSong(sb: BekofyClient, id: string, patch: TablesUpdate<'songs'>): Promise<Song> {
  return must(await sb.from('songs').update(patch).eq('id', id).select('*').single(), 'Şarkı güncellenemedi');
}

export async function setSongStatus(sb: BekofyClient, id: string, status: SongStatus): Promise<void> {
  check(await sb.from('songs').update({ status }).eq('id', id), 'Şarkı durumu değiştirilemedi');
}

export async function deleteSong(sb: BekofyClient, id: string): Promise<void> {
  check(await sb.from('songs').delete().eq('id', id), 'Şarkı silinemedi');
}

/**
 * Çalınacak adres. Yeni yüklemelerde file_path tam R2 adresidir; eski kayıtlarda Supabase Storage'daki
 * "songs" alanına göreli yol olabilir.
 */
export function songAudioUrl(sb: BekofyClient, song: Pick<Song, 'file_path'>): string {
  if (/^https?:\/\//i.test(song.file_path)) return song.file_path;
  return sb.storage.from('songs').getPublicUrl(song.file_path).data.publicUrl;
}
