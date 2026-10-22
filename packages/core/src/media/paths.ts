// R2 nesne yolları. Ses ve kapak aynı sanatçı klasöründe; ad sonuna benzersiz kimlik eklenir,
// böylece aynı adlı iki şarkı birbirinin üstüne yazılmaz.

import { slugify } from '../text/slug';

export interface SongPathInput {
  artist: string;
  title: string;
  /** Çakışmayı önleyen kimlik: YouTube video kimliği ya da rastgele kısa kimlik. */
  uniqueId: string;
}

const ext = (e: string) => e.replace(/^\./, '').toLowerCase();
const base = ({ artist, title, uniqueId }: SongPathInput) => `music/${slugify(artist)}/${slugify(title)}-${slugify(uniqueId, { maxLength: 24, fallback: 'x' })}`;

export function songAudioPath(input: SongPathInput, extension = 'mp3'): string {
  return `${base(input)}.${ext(extension)}`;
}

export function songCoverPath(input: SongPathInput, extension = 'jpg'): string {
  const { artist } = input;
  const file = base(input).slice(`music/${slugify(artist)}/`.length);
  return `music/${slugify(artist)}/covers/${file}.${ext(extension)}`;
}

/** R2 genel alan adı ile yolu birleştirir: "cdn.ornek.com" + "music/a.mp3" -> "https://cdn.ornek.com/music/a.mp3". */
export function publicUrl(domain: string, path: string): string {
  const host = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return `https://${host}/${path.replace(/^\/+/, '')}`;
}
