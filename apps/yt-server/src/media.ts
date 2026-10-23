// Kapak görseli: kare kırpma ve boyutlandırma (ffmpeg), panelden gelen görselin çözülmesi.

import { spawn } from 'node:child_process';
import { HttpError } from './errors';

export const MAX_COVER_BYTES = 5 * 1024 * 1024;
const COVER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** "data:image/png;base64,..." -> bayt. Tür ve boyut denetlenir. */
export function decodeImageDataUrl(dataUrl: string): { mime: string; bytes: Buffer } {
  const m = dataUrl.match(/^data:([a-z/+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!m?.[1] || !m[2]) throw new HttpError(400, 'Kapak görseli okunamadı. JPG, PNG ya da WebP yükle.');
  if (!COVER_TYPES.has(m[1])) throw new HttpError(400, 'Kapak yalnızca JPG, PNG ya da WebP olabilir.');
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > MAX_COVER_BYTES) throw new HttpError(413, 'Kapak görseli en fazla 5 MB olabilir.');
  return { mime: m[1], bytes };
}

/** Görseli ortadan kare kırpar, en fazla 1000x1000 JPG yapar. */
export function squareCover(ffmpegPath: string, input: string, output: string): Promise<void> {
  const args = ['-y', '-v', 'error', '-i', input, '-vf', "crop='min(iw,ih)':'min(iw,ih)',scale='min(1000,iw)':-2:flags=lanczos", '-frames:v', '1', '-q:v', '3', output];
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (c: Buffer) => (stderr += c.toString('utf8')));
    child.on('error', (e) => reject(new HttpError(500, `ffmpeg çalıştırılamadı: ${e.message}`)));
    child.on('close', (code) => (code === 0 ? resolve() : reject(new HttpError(422, `Kapak işlenemedi. ${stderr.trim().split(/\r?\n/).pop() ?? ''}`.trim()))));
  });
}
