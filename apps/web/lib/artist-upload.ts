// Sanatçı yüklemesinin R2 yolları. Saf fonksiyonlar: hem imzalı adres verirken hem kaydı açarken aynı kural.

import { slugify, songAudioPath, songCoverPath } from '@bekofy/core';

export const COVER_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export function uploadKeys(artistName: string, title: string, uniqueId: string, coverType: string | null) {
  const input = { artist: artistName, title, uniqueId };
  return {
    audioKey: songAudioPath(input),
    coverKey: coverType && COVER_EXT[coverType] ? songCoverPath(input, COVER_EXT[coverType]) : null,
  };
}

/**
 * Yol bu sanatçının klasöründe mi ve beklenen biçimde mi? Sanatçı başka bir sanatçının ya da
 * admin içe aktarmasının dosyasını kendi kaydına bağlayamaz.
 */
export function ownsKey(artistName: string, key: string, kind: 'audio' | 'cover'): boolean {
  const folder = `music/${slugify(artistName)}/`;
  if (!key.startsWith(folder) || key.includes('..')) return false;
  const rest = key.slice(folder.length);
  if (kind === 'audio') return /^[a-z0-9-]+\.mp3$/.test(rest);
  return /^covers\/[a-z0-9-]+\.(jpg|png|webp)$/.test(rest);
}
