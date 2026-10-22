// Çalma listeleri, içerikleri (playlist_songs) ve ortak düzenleyiciler.

import type { BekofyClient } from '../client';
import type { Tables, TablesUpdate } from './database.types';
import { check, DataError, must, searchTerm } from './errors';
import { SONG_FIELDS, type SongSummary } from './songs';

export type Playlist = Tables<'playlists'>;

/** Kullanıcının kendi listeleri ve ortak düzenleyici olduğu listeler; en yeni başta. */
export async function userPlaylists(sb: BekofyClient, userId: string): Promise<Playlist[]> {
  const [owned, collab] = await Promise.all([
    sb.from('playlists').select('*').eq('user_id', userId),
    sb.from('playlist_collaborators').select('playlist:playlists(*)').eq('user_id', userId),
  ]);
  const own = must(owned, 'Çalma listeleri alınamadı');
  const shared = must(collab, 'Ortak çalma listeleri alınamadı').flatMap((r) => (r.playlist ? [r.playlist] : []));
  const unique = new Map([...own, ...shared].map((p) => [p.id, p]));
  return [...unique.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getPlaylist(sb: BekofyClient, id: string): Promise<Playlist> {
  return must(await sb.from('playlists').select('*').eq('id', id).single(), 'Çalma listesi alınamadı');
}

/** Listedeki şarkılar, sıra numarasına göre. */
export async function playlistSongs(sb: BekofyClient, playlistId: string): Promise<SongSummary[]> {
  const rows = must(
    await sb.from('playlist_songs').select(`position, song:songs(${SONG_FIELDS})`).eq('playlist_id', playlistId)
      .order('position', { ascending: true, nullsFirst: false }),
    'Çalma listesi şarkıları alınamadı',
  );
  return rows.flatMap((r) => (r.song ? [r.song] : []));
}

export async function createPlaylist(
  sb: BekofyClient,
  { userId, name, description = null, isPublic = false }: { userId: string; name: string; description?: string | null; isPublic?: boolean },
): Promise<Playlist> {
  const clean = name.trim();
  if (!clean) throw new DataError('Çalma listesine bir ad ver.');
  return must(
    await sb.from('playlists').insert({ user_id: userId, name: clean.slice(0, 100), description, is_public: isPublic }).select('*').single(),
    'Çalma listesi oluşturulamadı',
  );
}

export async function updatePlaylist(sb: BekofyClient, id: string, patch: Pick<TablesUpdate<'playlists'>, 'name' | 'description' | 'is_public' | 'cover_url'>): Promise<Playlist> {
  return must(await sb.from('playlists').update(patch).eq('id', id).select('*').single(), 'Çalma listesi güncellenemedi');
}

export async function deletePlaylist(sb: BekofyClient, id: string): Promise<void> {
  check(await sb.from('playlists').delete().eq('id', id), 'Çalma listesi silinemedi');
}

/** Şarkıları listenin sonuna ekler; listede zaten olanlar atlanır. */
export async function addSongsToPlaylist(sb: BekofyClient, playlistId: string, songIds: readonly string[]): Promise<number> {
  const existing = must(await sb.from('playlist_songs').select('song_id, position').eq('playlist_id', playlistId), 'Çalma listesi okunamadı');
  const have = new Set(existing.map((r) => r.song_id));
  const fresh = [...new Set(songIds)].filter((id) => !have.has(id));
  if (!fresh.length) return 0;
  const start = existing.reduce((max, r) => Math.max(max, r.position ?? -1), -1) + 1;
  check(
    await sb.from('playlist_songs').insert(fresh.map((song_id, i) => ({ playlist_id: playlistId, song_id, position: start + i }))),
    'Şarkılar listeye eklenemedi',
  );
  return fresh.length;
}

export async function removeSongFromPlaylist(sb: BekofyClient, playlistId: string, songId: string): Promise<void> {
  check(await sb.from('playlist_songs').delete().eq('playlist_id', playlistId).eq('song_id', songId), 'Şarkı listeden çıkarılamadı');
}

/** Sürükle-bırak sonrası yeni sıra: songIds yeni sırayla verilir. */
export async function reorderPlaylist(sb: BekofyClient, playlistId: string, songIds: readonly string[]): Promise<void> {
  check(
    await sb.from('playlist_songs').upsert(songIds.map((song_id, position) => ({ playlist_id: playlistId, song_id, position }))),
    'Sıralama kaydedilemedi',
  );
}

/** Kuyruğu yeni bir çalma listesi olarak kaydeder. */
export async function saveQueueAsPlaylist(sb: BekofyClient, userId: string, name: string, songIds: readonly string[]): Promise<Playlist> {
  const playlist = await createPlaylist(sb, { userId, name });
  await addSongsToPlaylist(sb, playlist.id, songIds);
  return playlist;
}

export async function searchPublicPlaylists(sb: BekofyClient, query: string, limit = 20): Promise<Playlist[]> {
  const term = searchTerm(query);
  if (!term) return [];
  return must(await sb.from('playlists').select('*').eq('is_public', true).ilike('name', `%${term}%`).limit(limit), 'Çalma listeleri aranamadı');
}

export async function playlistCollaborators(sb: BekofyClient, playlistId: string) {
  const rows = must(
    await sb.from('playlist_collaborators').select('added_at, profile:profiles(id, username, avatar_url)').eq('playlist_id', playlistId),
    'Düzenleyiciler alınamadı',
  );
  return rows.flatMap((r) => (r.profile ? [{ ...r.profile, added_at: r.added_at }] : []));
}

export async function addCollaborator(sb: BekofyClient, playlistId: string, userId: string): Promise<void> {
  check(await sb.from('playlist_collaborators').insert({ playlist_id: playlistId, user_id: userId }), 'Düzenleyici eklenemedi');
}

export async function removeCollaborator(sb: BekofyClient, playlistId: string, userId: string): Promise<void> {
  check(await sb.from('playlist_collaborators').delete().eq('playlist_id', playlistId).eq('user_id', userId), 'Düzenleyici çıkarılamadı');
}
