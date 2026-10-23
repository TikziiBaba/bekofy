// Çevrimdışı şarkılar. Klasör ve biçim eski uygulamayla aynı (userData/offline-songs/<id>.mp3 + <id>.json):
// 1.x'te indirilen şarkılar güncellemeden sonra da çalar.

import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { app, net, protocol } from 'electron';
import { isUuid, MEDIA_SCHEME, type DownloadEvent, type DownloadRequest, type OfflineSong } from '../shared/ipc';
import { MEDIA_HOSTS } from './config';

const dir = () => join(app.getPath('userData'), 'offline-songs');
const MAX_BYTES = 60 * 1024 * 1024;

export function isMediaUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && MEDIA_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}

export async function listOffline(): Promise<OfflineSong[]> {
  if (!existsSync(dir())) return [];
  const files = (await readdir(dir())).filter((f) => f.endsWith('.json'));
  const songs = await Promise.all(
    files.map(async (f) => {
      try {
        const meta = JSON.parse(await readFile(join(dir(), f), 'utf8')) as OfflineSong;
        return isUuid(meta.id) && existsSync(join(dir(), `${meta.id}.mp3`)) ? meta : null;
      } catch {
        return null;
      }
    }),
  );
  return songs.filter((s): s is OfflineSong => s !== null).sort((a, b) => b.downloaded_at.localeCompare(a.downloaded_at));
}

/** İndirir; yarım dosya önce .part olarak yazılır, bitince yerine taşınır. */
export async function download(req: DownloadRequest, emit: (e: DownloadEvent) => void): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isUuid(req.id)) return { ok: false, error: 'Geçersiz şarkı.' };
  if (!isMediaUrl(req.url)) return { ok: false, error: 'Bu şarkı indirilemiyor.' };
  await mkdir(dir(), { recursive: true });
  const target = join(dir(), `${req.id}.mp3`);
  const part = `${target}.part`;
  try {
    if (!existsSync(target)) {
      const res = await net.fetch(req.url);
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const total = Number(res.headers.get('content-length')) || 0;
      if (total > MAX_BYTES) throw new Error('çok büyük');
      let received = 0;
      let last = -1;
      const body = Readable.fromWeb(res.body as import('node:stream/web').ReadableStream);
      body.on('data', (chunk: Buffer) => {
        received += chunk.length;
        if (received > MAX_BYTES) body.destroy(new Error('çok büyük'));
        const percent = total ? Math.floor((received / total) * 100) : 0;
        if (percent !== last) {
          last = percent;
          emit({ id: req.id, state: 'progress', percent });
        }
      });
      await pipeline(body, createWriteStream(part));
      await rename(part, target);
    }
    const meta: OfflineSong = {
      id: req.id,
      title: String(req.title).slice(0, 200),
      artist: String(req.artist).slice(0, 200),
      album: req.album ? String(req.album).slice(0, 200) : null,
      cover_url: req.cover_url && isMediaUrl(req.cover_url) ? req.cover_url : null,
      duration: typeof req.duration === 'number' ? req.duration : null,
      downloaded_at: new Date().toISOString(),
    };
    await writeFile(join(dir(), `${req.id}.json`), JSON.stringify(meta));
    emit({ id: req.id, state: 'done' });
    return { ok: true };
  } catch (err) {
    await rm(part, { force: true });
    const message = 'İndirilemedi. İnternet bağlantını kontrol edip tekrar dene.';
    console.error('[offline] indirme', req.id, err);
    emit({ id: req.id, state: 'error', message });
    return { ok: false, error: message };
  }
}

export async function remove(id: unknown): Promise<void> {
  if (!isUuid(id)) return;
  await rm(join(dir(), `${id}.mp3`), { force: true });
  await rm(join(dir(), `${id}.json`), { force: true });
}

/** app ready öncesinde: akış ve sarma (seek) için ayrıcalıklı şema. */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([{ scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } }]);
}

/** bekofy-media://song/<uuid> -> indirilen dosya. Başka hiçbir dosyaya erişilemez. */
export function handleMediaScheme(): void {
  protocol.handle(MEDIA_SCHEME, (request) => {
    const url = new URL(request.url);
    const id = decodeURIComponent(url.pathname.replace(/^\//, ''));
    if (url.hostname !== 'song' || !isUuid(id)) return new Response('Bulunamadı', { status: 404 });
    const file = join(dir(), `${id}.mp3`);
    if (!existsSync(file)) return new Response('Bulunamadı', { status: 404 });
    return net.fetch(pathToFileURL(file).toString(), { headers: request.headers });
  });
}
