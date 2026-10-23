// Sanatçılar: sayfa, şarkılar (song_artists bağı), takip, sanatçı hesabının sanatçı kaydı.

import type { BekofyClient } from '../client';
import type { Tables } from './database.types';
import { check, likeExact, must, searchTerm } from './errors';
import { SONG_FIELDS, type SongSummary } from './songs';

export type Artist = Tables<'artists'>;
export type ArtistRef = Pick<Artist, 'id' | 'name'>;

export async function getArtist(sb: BekofyClient, id: string): Promise<Artist> {
  return must(await sb.from('artists').select('*').eq('id', id).single(), 'Sanatçı alınamadı');
}

/** Ada göre (büyük/küçük harf duyarsız, tam eşleşme). */
export async function artistByName(sb: BekofyClient, name: string): Promise<Artist | null> {
  const res = await sb.from('artists').select('*').ilike('name', likeExact(name.trim())).maybeSingle();
  if (res.error) must(res, 'Sanatçı alınamadı');
  return res.data;
}

export async function searchArtists(sb: BekofyClient, query: string, limit = 10): Promise<Artist[]> {
  const term = searchTerm(query);
  if (!term) return [];
  return must(await sb.from('artists').select('*').ilike('name', `%${term}%`).order('name').limit(limit), 'Sanatçılar aranamadı');
}

/** Sanatçının onaylı şarkıları (konuk olduğu şarkılar dahil), en yeni başta. */
export async function artistSongs(sb: BekofyClient, artistId: string, limit = 50): Promise<SongSummary[]> {
  const rows = must(
    await sb.from('song_artists').select(`song:songs!inner(${SONG_FIELDS})`).eq('artist_id', artistId).eq('song.status', 'approved').limit(limit),
    'Sanatçının şarkıları alınamadı',
  );
  return rows.map((r) => r.song).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Şarkı kimliği -> sanatçılar (sırasıyla). Listelerde sanatçı adlarını bağlantı yapmak için. */
export async function artistsForSongs(sb: BekofyClient, songIds: readonly string[]): Promise<Map<string, ArtistRef[]>> {
  const map = new Map<string, ArtistRef[]>();
  if (!songIds.length) return map;
  const rows = must(
    await sb.from('song_artists').select('song_id, position, artist:artists(id, name)').in('song_id', [...new Set(songIds)]).order('position'),
    'Sanatçılar alınamadı',
  );
  for (const r of rows) {
    if (!r.artist) continue;
    map.set(r.song_id, [...(map.get(r.song_id) ?? []), r.artist]);
  }
  return map;
}

/** Bir şarkıyı sanatçılarına bağlar (admin; yükleme sonrası). Sıra verilen diziye göre. */
export async function setSongArtists(sb: BekofyClient, songId: string, artistIds: readonly string[]): Promise<void> {
  check(await sb.from('song_artists').delete().eq('song_id', songId), 'Sanatçı bağı güncellenemedi');
  if (!artistIds.length) return;
  check(
    await sb.from('song_artists').insert(artistIds.map((artist_id, position) => ({ song_id: songId, artist_id, position }))),
    'Sanatçı bağı güncellenemedi',
  );
}

/** Admin: adı verilen sanatçıyı bulur, yoksa oluşturur. */
export async function ensureArtist(sb: BekofyClient, name: string): Promise<Artist> {
  const existing = await artistByName(sb, name);
  if (existing) return existing;
  return must(await sb.from('artists').insert({ name: name.trim() }).select('*').single(), 'Sanatçı oluşturulamadı');
}

/** Sanatçı hesabının yönettiği sanatçı kaydı; sanatçı değilse null. */
export async function managedArtist(sb: BekofyClient, userId: string): Promise<Artist | null> {
  const res = await sb.from('artists').select('*').eq('profile_id', userId).maybeSingle();
  if (res.error) must(res, 'Sanatçı kaydı alınamadı');
  return res.data;
}

/* ---------- Takip ---------- */

export async function followArtist(sb: BekofyClient, userId: string, artistId: string): Promise<void> {
  check(await sb.from('artist_follows').upsert({ user_id: userId, artist_id: artistId }, { ignoreDuplicates: true }), 'Sanatçı takip edilemedi');
}

export async function unfollowArtist(sb: BekofyClient, userId: string, artistId: string): Promise<void> {
  check(await sb.from('artist_follows').delete().eq('user_id', userId).eq('artist_id', artistId), 'Sanatçı takibi bırakılamadı');
}

export async function isFollowingArtist(sb: BekofyClient, userId: string, artistId: string): Promise<boolean> {
  return must(await sb.from('artist_follows').select('artist_id').eq('user_id', userId).eq('artist_id', artistId).limit(1), 'Takip durumu alınamadı').length > 0;
}

export async function followedArtists(sb: BekofyClient, userId: string): Promise<Artist[]> {
  const rows = must(
    await sb.from('artist_follows').select('created_at, artist:artists(*)').eq('user_id', userId).order('created_at', { ascending: false }),
    'Takip edilen sanatçılar alınamadı',
  );
  return rows.flatMap((r) => (r.artist ? [r.artist] : []));
}

export async function artistFollowerCount(sb: BekofyClient, artistId: string): Promise<number> {
  const res = await sb.from('artist_follows').select('user_id', { count: 'exact', head: true }).eq('artist_id', artistId);
  check(res, 'Takipçi sayısı alınamadı');
  return res.count ?? 0;
}
