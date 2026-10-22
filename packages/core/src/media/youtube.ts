// YouTube bağlantılarını çözer ve video başlığından sanatçı/şarkı adını ayıklar.
// Site admin paneli (doğrulama) ve yerel içe aktarma sunucusu aynı kuralları kullanır.

export type YouTubeLinkError = 'empty' | 'not-youtube' | 'playlist' | 'no-video-id';
export type YouTubeLink = { ok: true; videoId: string; url: string } | { ok: false; reason: YouTubeLinkError };

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be']);
const PATH_ID = /^\/(?:shorts|embed|live|v)\/([^/?#]+)/;

/** Kullanıcıya gösterilecek Türkçe hata metinleri. */
export const YOUTUBE_LINK_MESSAGES: Record<YouTubeLinkError, string> = {
  empty: 'Bir YouTube bağlantısı yapıştır.',
  'not-youtube': 'Bu bir YouTube bağlantısı değil. youtube.com, youtu.be veya music.youtube.com ile başlamalı.',
  playlist: 'Bu bir çalma listesi bağlantısı. Tek bir şarkının bağlantısını yapıştır.',
  'no-video-id': 'Bağlantıda video bulunamadı. Videonun kendi sayfasındaki bağlantıyı kopyala.',
};

/** Bağlantıyı doğrular, video kimliğini ve standart izleme adresini döndürür. */
export function parseYouTubeLink(input: string): YouTubeLink {
  const raw = input.trim();
  if (!raw) return { ok: false, reason: 'empty' };
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, reason: 'not-youtube' };
  }
  const host = url.hostname.toLowerCase();
  if (!HOSTS.has(host)) return { ok: false, reason: 'not-youtube' };

  let id: string | null = null;
  if (host.endsWith('youtu.be')) id = url.pathname.slice(1).split('/')[0] ?? null;
  else if (url.pathname === '/watch') id = url.searchParams.get('v');
  else id = url.pathname.match(PATH_ID)?.[1] ?? null;

  if (!id && url.searchParams.has('list')) return { ok: false, reason: 'playlist' };
  if (!id || !VIDEO_ID.test(id)) return { ok: false, reason: 'no-video-id' };
  return { ok: true, videoId: id, url: `https://www.youtube.com/watch?v=${id}` };
}

const NOISE = [
  /\((?:official\s+)?(?:music\s+)?(?:video|audio|visualizer|visualiser|lyric(?:s)?(?:\s+video)?|klip|resmi\s+(?:video|klip|ses))\)/gi,
  /\[(?:official\s+)?(?:music\s+)?(?:video|audio|visualizer|lyric(?:s)?(?:\s+video)?|hd|4k|klip)\]/gi,
  /\((?:official|hd|4k|remastered(?:\s+\d{4})?|resmi)\)/gi,
  /\|\s*official.*$/i,
];

const clean = (s: string) => s.replace(/\s{2,}/g, ' ').replace(/^[\s\-–—:|]+|[\s\-–—:|]+$/g, '').trim();

/** Kanal adındaki "- Topic", "VEVO", "Official" gibi ekleri atar. */
export function cleanChannelName(channel: string): string {
  return clean(channel.replace(/\s*-\s*topic$/i, '').replace(/vevo$/i, '').replace(/\s+official$/i, ''));
}

/**
 * "Sanatçı - Şarkı (Official Audio)" biçimindeki başlığı ayırır.
 * Ayraç yoksa sanatçı kanal adından alınır. Sonuç admin panelinde düzenlenebilir bir öneri olarak kullanılır.
 */
export function parseYouTubeTitle(rawTitle: string, channel = ''): { artist: string; title: string } {
  let title = rawTitle;
  for (const re of NOISE) title = title.replace(re, '');
  title = clean(title);
  const sep = title.match(/\s[-–—]\s/);
  if (sep && sep.index !== undefined) {
    const artist = clean(title.slice(0, sep.index));
    const song = clean(title.slice(sep.index + sep[0].length));
    if (artist && song) return { artist, title: song };
  }
  return { artist: cleanChannelName(channel), title };
}
