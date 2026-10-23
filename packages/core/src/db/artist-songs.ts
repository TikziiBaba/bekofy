// Sanatçı yüklemeleri. Dosyalar R2'ye site sunucusunun verdiği imzalı adresle gider;
// kayıt submit_artist_song ile açılır ve her zaman onay bekler (pending).

import type { BekofyClient } from '../client';
import { DataError, must } from './errors';
import type { SongStatus } from './songs';

export const MAX_AUDIO_BYTES = 30 * 1024 * 1024;
export const MAX_SONG_SECONDS = 30 * 60;

/** Tarayıcılar MP3'ü "audio/mpeg", bazı Windows sürümleri "audio/mp3" diye bildirir. */
export const isMp3 = (file: { type: string; name?: string }): boolean =>
  file.type === 'audio/mpeg' || file.type === 'audio/mp3' || (!file.type && /\.mp3$/i.test(file.name ?? ''));

/** Yüklemeden önce: sorun varsa kullanıcıya gösterilecek mesaj, yoksa null. */
export function audioProblem(file: { type: string; size: number; name?: string }): string | null {
  if (!isMp3(file)) return 'Yalnızca MP3 dosyası yükleyebilirsin.';
  if (file.size > MAX_AUDIO_BYTES) return 'Ses dosyası en fazla 30 MB olabilir.';
  if (file.size === 0) return 'Ses dosyası boş görünüyor. Başka bir dosya seç.';
  return null;
}

export interface ArtistSongFields {
  title: string;
  album?: string;
  genre?: string;
  /** Saniye. */
  duration: number;
}

export function artistSongProblem({ title, album = '', genre = '', duration }: ArtistSongFields): string | null {
  const name = title.trim();
  if (!name) return 'Şarkı adını yaz.';
  if (name.length > 200) return 'Şarkı adı en fazla 200 karakter olabilir.';
  if (album.trim().length > 200) return 'Albüm adı en fazla 200 karakter olabilir.';
  if (genre.trim().length > 60) return 'Tür en fazla 60 karakter olabilir.';
  if (!Number.isFinite(duration) || duration < 1) return 'Şarkının süresi okunamadı. Dosyanın bozuk olmadığından emin ol.';
  if (duration > MAX_SONG_SECONDS) return 'Şarkı en fazla 30 dakika olabilir.';
  return null;
}

export interface ArtistSongInput extends ArtistSongFields {
  filePath: string;
  coverUrl?: string | null;
}

/** Kaydı açar ve şarkıyı sanatçıya bağlar. Dönen değer yeni şarkının kimliği. */
export async function submitArtistSong(sb: BekofyClient, input: ArtistSongInput): Promise<string> {
  const problem = artistSongProblem(input);
  if (problem) throw new DataError(problem);
  const res = await sb.rpc('submit_artist_song', {
    p_title: input.title.trim(),
    p_album: input.album?.trim() ?? '',
    p_genre: input.genre?.trim() ?? '',
    p_duration: Math.round(input.duration),
    p_file_path: input.filePath,
    p_cover_url: input.coverUrl ?? '',
  });
  if (res.error?.code === '23505') throw new DataError('Bu dosya zaten bir şarkıya bağlı. Sayfayı yenileyip tekrar yükle.');
  if (res.error?.code === '42501') throw new DataError('Şarkı yüklemek için onaylanmış bir sanatçı hesabı gerekir.');
  return must(res, 'Şarkı gönderilemedi') as string;
}

export interface ArtistSongStat {
  songId: string;
  title: string;
  status: SongStatus;
  createdAt: string;
  coverUrl: string | null;
  duration: number | null;
  plays: number;
  listeners: number;
  plays30d: number;
}

interface StatRow {
  song_id: string;
  title: string;
  status: SongStatus;
  created_at: string;
  cover_url: string | null;
  duration: number | null;
  plays: number;
  listeners: number;
  plays_30d: number;
}

/** Sanatçının şarkıları ve toplam dinlenme sayıları (dinleyenlerin kimliği gelmez). */
export async function artistSongStats(sb: BekofyClient): Promise<ArtistSongStat[]> {
  const rows = must(await sb.rpc('artist_song_stats'), 'İstatistikler alınamadı') as StatRow[];
  return rows.map((r) => ({
    songId: r.song_id,
    title: r.title,
    status: r.status,
    createdAt: r.created_at,
    coverUrl: r.cover_url,
    duration: r.duration,
    plays: Number(r.plays),
    listeners: Number(r.listeners),
    plays30d: Number(r.plays_30d),
  }));
}
