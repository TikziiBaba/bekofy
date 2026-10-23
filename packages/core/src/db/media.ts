// Görsel yükleme. Kullanıcı yalnızca avatars alanındaki kendi klasörüne (<kullanıcı-id>/...) yazabilir (RLS).

import type { BekofyClient } from '../client';
import { DataError } from './errors';

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/**
 * Mobilde (React Native) Blob yüklemesi güvenilir değil: dosya ham bayt olarak verilir.
 * Web ve masaüstü Blob/File geçirir.
 */
export interface ImageBytes {
  type: string;
  size: number;
  bytes: ArrayBuffer;
}
type ImageFile = Blob | ImageBytes;

/** Yüklemeden önce: tür ve boyut. Sorun varsa kullanıcıya gösterilecek mesaj, yoksa null. */
export function imageProblem(file: { type: string; size: number }): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return 'Yalnızca JPG, PNG ya da WebP yükleyebilirsin.';
  if (file.size > MAX_IMAGE_BYTES) return 'Görsel en fazla 5 MB olabilir.';
  return null;
}

async function upload(sb: BekofyClient, path: string, file: ImageFile): Promise<string> {
  const problem = imageProblem(file);
  if (problem) throw new DataError(problem);
  const body = 'bytes' in file ? file.bytes : file;
  const res = await sb.storage.from('avatars').upload(path, body, { contentType: file.type, upsert: true, cacheControl: '31536000' });
  if (res.error) throw new DataError('Görsel yüklenemedi. Tekrar dene.', undefined, res.error);
  return sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

/** Ad sonuna zaman eklenir: önbellekteki eski görsel gösterilmez. */
const stamp = (type: string) => `${Date.now()}.${EXT[type] ?? 'jpg'}`;

export function uploadAvatar(sb: BekofyClient, userId: string, file: ImageFile): Promise<string> {
  return upload(sb, `${userId}/avatar-${stamp(file.type)}`, file);
}

export function uploadBanner(sb: BekofyClient, userId: string, file: ImageFile): Promise<string> {
  return upload(sb, `${userId}/banner-${stamp(file.type)}`, file);
}

/** Liste sahibinin klasörüne yüklenir; listenin cover_url alanı ayrıca updatePlaylist ile yazılır. */
export function uploadPlaylistCover(sb: BekofyClient, ownerId: string, playlistId: string, file: ImageFile): Promise<string> {
  return upload(sb, `${ownerId}/playlist-${playlistId}-${stamp(file.type)}`, file);
}
