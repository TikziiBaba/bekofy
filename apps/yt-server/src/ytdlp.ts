// yt-dlp sarmalayıcısı: video bilgisi, ilerlemeli ses indirme (MP3) ve kapak. YouTube'un JavaScript
// doğrulamaları için yt-dlp'ye bu sunucunun çalıştığı Node gösterilir (Node 22 ve üstü desteklenir).

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { HttpError } from './errors';

export const MAX_DURATION_SECONDS = 20 * 60;

export interface VideoInfo {
  id: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string | null;
  isLive: boolean;
  /** YouTube Music videolarında gelen müzik bilgileri. */
  track: string | null;
  artist: string | null;
  album: string | null;
}

const baseArgs = () => ['--no-playlist', '--no-warnings', '--color', 'never', '--js-runtimes', `node:${process.execPath}`];

const KNOWN_ERRORS: Array<[RegExp, string]> = [
  [/private video/i, 'Gizli videolar içe aktarılamaz.'],
  [/sign in to confirm your age|age-restricted/i, 'Yaş doğrulaması isteyen videolar içe aktarılamaz.'],
  [/video unavailable|has been removed|does not exist/i, 'Video bulunamadı ya da kaldırılmış.'],
  [/live event|is live|premieres in/i, 'Canlı yayınlar ve henüz başlamamış galalar içe aktarılamaz.'],
  [/not available in your country|geo.?restrict/i, 'Bu video bulunduğun ülkede açılmıyor.'],
  [/sign in to confirm you.?re not a bot/i, 'YouTube bu bilgisayardan gelen isteği robot sandı. Biraz bekleyip tekrar dene ya da "npm run yt-server:update" ile yt-dlp\'yi güncelle.'],
  [/unable to download|http error 4\d\d|http error 5\d\d|timed out|getaddrinfo/i, "YouTube'a ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene."],
];

/** yt-dlp'nin hata çıktısını kullanıcıya gösterilebilir Türkçe mesaja çevirir. */
export function explainYtDlpError(stderr: string): string {
  const hit = KNOWN_ERRORS.find(([re]) => re.test(stderr));
  if (hit) return hit[1];
  const last = stderr.trim().split(/\r?\n/).filter((l) => l.startsWith('ERROR')).pop() ?? '';
  return `YouTube'dan alınamadı.${last ? ` (${last.replace(/^ERROR:\s*/, '').slice(0, 160)})` : ''}`;
}

interface RunResult {
  stdout: string;
  stderr: string;
}

function run(bin: string, args: string[], { timeoutMs, onLine }: { timeoutMs: number; onLine?: (line: string) => void }): Promise<RunResult> {
  if (!existsSync(bin)) throw new HttpError(503, 'yt-dlp kurulu değil. Önce "npm run setup -w @bekofy/yt-server" komutunu çalıştır.');
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    let pending = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new HttpError(504, 'YouTube işlemi çok uzun sürdü ve durduruldu. Tekrar dene.'));
    }, timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stdout += text;
      if (!onLine) return;
      pending += text;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? '';
      lines.forEach(onLine);
    });
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf8')));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new HttpError(500, `yt-dlp çalıştırılamadı: ${e.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (pending && onLine) onLine(pending);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new HttpError(422, explainYtDlpError(stderr)));
    });
  });
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Video bilgisi (indirmeden). */
export async function probe(bin: string, url: string, timeoutMs = 60_000): Promise<VideoInfo> {
  const { stdout } = await run(bin, [...baseArgs(), '-J', '--skip-download', url], { timeoutMs });
  const j = JSON.parse(stdout) as Record<string, unknown>;
  return {
    id: String(j.id),
    title: str(j.title) ?? 'Adsız',
    channel: str(j.channel) ?? str(j.uploader) ?? '',
    duration: Math.round(Number(j.duration) || 0),
    thumbnail: str(j.thumbnail),
    isLive: j.is_live === true || j.live_status === 'is_live' || j.live_status === 'is_upcoming',
    track: str(j.track),
    artist: str(j.artist) ?? (Array.isArray(j.artists) ? str((j.artists as unknown[]).join(', ')) : null),
    album: str(j.album),
  };
}

/** Şarkı olarak eklenebilir mi? Değilse kullanıcıya gösterilecek mesaj. */
export function videoProblem(info: Pick<VideoInfo, 'isLive' | 'duration'>): string | null {
  if (info.isLive) return 'Canlı yayınlar ve henüz başlamamış galalar içe aktarılamaz.';
  if (!info.duration) return 'Videonun süresi okunamadı; içe aktarılamaz.';
  if (info.duration > MAX_DURATION_SECONDS) return 'Bu video 20 dakikadan uzun; şarkı olarak eklenemez.';
  return null;
}

export type DownloadEvent = { kind: 'download'; ratio: number } | { kind: 'convert' } | { kind: 'thumbnail' };

const PROGRESS = /^BKF (\d+)\/(\d+|NA)$/;

/** yt-dlp çıktı satırını ilerleme olayına çevirir; ilgisiz satırlarda null. */
export function parseProgressLine(line: string): DownloadEvent | null {
  const text = line.trim();
  const m = text.match(PROGRESS);
  if (m) {
    const done = Number(m[1]);
    const total = m[2] === 'NA' ? 0 : Number(m[2]);
    return total > 0 ? { kind: 'download', ratio: Math.min(1, done / total) } : null;
  }
  if (text.startsWith('[ExtractAudio]')) return { kind: 'convert' };
  if (text.startsWith('[ThumbnailsConvertor]') || text.startsWith('[info] Writing video thumbnail')) return { kind: 'thumbnail' };
  return null;
}

/** Sesi en iyi kalitede MP3 (VBR V0) olarak, kapağı JPG olarak dir klasörüne indirir. */
export async function downloadAudio(
  bin: string,
  ffmpegPath: string,
  url: string,
  dir: string,
  onEvent: (e: DownloadEvent) => void,
  timeoutMs = 10 * 60_000,
): Promise<{ audio: string; thumbnail: string | null }> {
  const args = [
    ...baseArgs(),
    '--ffmpeg-location', dirname(ffmpegPath),
    '-f', 'bestaudio/best',
    '-x', '--audio-format', 'mp3', '--audio-quality', '0',
    '--write-thumbnail', '--convert-thumbnails', 'jpg',
    '--newline', '--progress-template', 'download:BKF %(progress.downloaded_bytes)s/%(progress.total_bytes,progress.total_bytes_estimate)s',
    '-o', join(dir, 'audio.%(ext)s'),
    '-o', `thumbnail:${join(dir, 'cover.%(ext)s')}`,
    url,
  ];
  await run(bin, args, { timeoutMs, onLine: (line) => { const e = parseProgressLine(line); if (e) onEvent(e); } });
  const audio = join(dir, 'audio.mp3');
  if (!existsSync(audio)) throw new HttpError(500, 'İndirme bitti ama MP3 dosyası oluşmadı.');
  const thumbnail = join(dir, 'cover.jpg');
  return { audio, thumbnail: existsSync(thumbnail) ? thumbnail : null };
}

export async function ytDlpVersion(bin: string): Promise<string | null> {
  if (!existsSync(bin)) return null;
  try {
    return (await run(bin, ['--version'], { timeoutMs: 15_000 })).stdout.trim();
  } catch {
    return null;
  }
}
