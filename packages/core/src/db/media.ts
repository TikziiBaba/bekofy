// Görsel yükleme: profil fotoğrafı ve kapak (avatars), çalma listesi kapağı ve kapak görseli (media).

import type { BekofyClient } from '../client';
import { DataError } from './errors';

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Yüklemeden önce: tür ve boyut. Sorun varsa kullanıcıya gösterilecek mesaj, yoksa null. */
export function imageProblem(file: { type: string; size: number }): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return 'Yalnızca JPG, PNG ya da WebP yükleyebilirsin.';
  if (file.size > MAX_IMAGE_BYTES) return 'Görsel en fazla 5 MB olabilir.';
  return null;
}

async function upload(sb: BekofyClient, bucket: 'avatars' | 'media', path: string, file: Blob): Promise<string> {
  const problem = imageProblem(file);
  if (problem) throw new DataError(problem);
  const res = await sb.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: true, cacheControl: '31536000' });
  if (res.error) throw new DataError('Görsel yüklenemedi. Tekrar dene.', undefined, res.error);
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Ad sonuna zaman eklenir: önbellekteki eski görsel gösterilmez. */
const stamp = (type: string) => `${Date.now()}.${EXT[type] ?? 'jpg'}`;

export function uploadAvatar(sb: BekofyClient, userId: string, file: Blob): Promise<string> {
  return upload(sb, 'avatars', `${userId}/avatar-${stamp(file.type)}`, file);
}

export function uploadBanner(sb: BekofyClient, userId: string, file: Blob): Promise<string> {
  return upload(sb, 'avatars', `${userId}/banner-${stamp(file.type)}`, file);
}

export function uploadPlaylistCover(sb: BekofyClient, playlistId: string, file: Blob): Promise<string> {
  return upload(sb, 'media', `playlists/${playlistId}-${stamp(file.type)}`, file);
}
