import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AdminSession } from './auth';
import { HttpError } from './errors';
import { runImport, type ImportDeps, type ImportEvent, type ImportRequest } from './importer';
import type { Storage } from './r2';
import type { VideoInfo } from './ytdlp';

type Result = { data?: unknown; error?: { code?: string; message?: string } | null };

/** Zincirlenebilir sahte Supabase istemcisi: her sorgu (tablo, çağrılan yöntemler) için sonucu handler belirler. */
function fakeSb(handler: (table: string, calls: Array<[string, unknown[]]>) => Result) {
  const log: Array<{ table: string; calls: Array<[string, unknown[]]> }> = [];
  const sb = {
    from(table: string) {
      const calls: Array<[string, unknown[]]> = [];
      log.push({ table, calls });
      const chain: unknown = new Proxy({}, {
        get(_t, prop) {
          if (prop === 'then') {
            return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
              Promise.resolve({ data: null, error: null, ...handler(table, calls) }).then(resolve, reject);
          }
          return (...args: unknown[]) => {
            calls.push([String(prop), args]);
            return chain;
          };
        },
      });
      return chain;
    },
  };
  return { sb: sb as unknown as AdminSession['sb'], log };
}

const has = (calls: Array<[string, unknown[]]>, name: string) => calls.some(([n]) => n === name);
const info: VideoInfo = { id: 'dQw4w9WgXcQ', title: 'x', channel: 'x', duration: 219, thumbnail: null, isLive: false, track: null, artist: null, album: null };
const request: ImportRequest = { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Ağustos Böceği', artists: ['Ayaz Kaya', 'Selin Aras'], album: 'Ağustos', cover: { kind: 'youtube' } };

function setup({ existing = false, insertFails = false, downloadFails = false } = {}) {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'bekofy-test-'));
  const uploads: Array<{ key: string; type: string }> = [];
  const removed: string[] = [];
  const storage: Storage = {
    upload: async (key, _file, type, onProgress) => {
      onProgress?.(0.5);
      onProgress?.(1);
      uploads.push({ key, type });
      return `https://music.bekirr.dev/${key}`;
    },
    remove: async (key) => void removed.push(key),
  };
  let artistSeq = 0;
  const { sb, log } = fakeSb((table, calls) => {
    if (table === 'songs' && has(calls, 'ilike')) return { data: existing ? [{ id: 'eski', title: 'Yaz Sonu' }] : [] };
    if (table === 'songs' && has(calls, 'insert')) {
      if (insertFails) return { error: { code: '42501', message: 'rls' } };
      const row = calls.find(([n]) => n === 'insert')?.[1][0] as Record<string, unknown>;
      return { data: { id: 'yeni', ...row } };
    }
    if (table === 'artists' && has(calls, 'maybeSingle')) return { data: null };
    if (table === 'artists' && has(calls, 'insert')) return { data: { id: `a${++artistSeq}` } };
    return {};
  });
  const deps: ImportDeps = {
    ytDlpPath: 'yt-dlp',
    ffmpegPath: 'ffmpeg',
    storage,
    tmpRoot,
    probe: async () => info,
    download: async (_b, _f, _u, dir, onEvent) => {
      if (downloadFails) throw new HttpError(422, 'Video bulunamadı ya da kaldırılmış.');
      onEvent({ kind: 'download', ratio: 0.5 });
      onEvent({ kind: 'download', ratio: 1 });
      onEvent({ kind: 'convert' });
      writeFileSync(join(dir, 'audio.mp3'), 'ses');
      writeFileSync(join(dir, 'cover.jpg'), 'kapak');
      return { audio: join(dir, 'audio.mp3'), thumbnail: join(dir, 'cover.jpg') };
    },
    cropCover: async (_f, input, output) => copyFile(input, output),
  };
  const session: AdminSession = { userId: 'admin', username: 'admin', sb };
  return { deps, session, uploads, removed, log, tmpRoot };
}

describe('içe aktarma akışı', () => {
  it('başarılı: ilerleme artarak 100 olur, dosyalar doğru yola, kayıt ve sanatçı bağları yazılır', async () => {
    const t = setup();
    const events: ImportEvent[] = [];
    await runImport(request, t.session, t.deps, (e) => events.push(e));
    const percents = events.flatMap((e) => (e.type === 'progress' ? [e.percent] : []));
    expect(percents).toEqual([...percents].sort((a, b) => a - b));
    expect(percents.at(-1)).toBe(100);
    expect(t.uploads).toEqual([
      { key: 'music/ayaz-kaya/agustos-bocegi-dqw4w9wgxcq.mp3', type: 'audio/mpeg' },
      { key: 'music/ayaz-kaya/covers/agustos-bocegi-dqw4w9wgxcq.jpg', type: 'image/jpeg' },
    ]);
    const done = events.at(-1);
    expect(done?.type).toBe('done');
    if (done?.type === 'done') {
      expect(done.song).toMatchObject({ title: 'Ağustos Böceği', artist: 'Ayaz Kaya, Selin Aras', album: 'Ağustos', duration: 219, file_path: 'https://music.bekirr.dev/music/ayaz-kaya/agustos-bocegi-dqw4w9wgxcq.mp3' });
    }
    const link = t.log.find((q) => q.table === 'song_artists' && has(q.calls, 'insert'));
    expect(link?.calls.find(([n]) => n === 'insert')?.[1][0]).toEqual([
      { song_id: 'yeni', artist_id: 'a1', position: 0 },
      { song_id: 'yeni', artist_id: 'a2', position: 1 },
    ]);
    expect(readdirSync(t.tmpRoot)).toEqual([]);
  });

  it('aynı video ikinci kez eklenmez; indirme hiç başlamaz', async () => {
    const t = setup({ existing: true });
    await expect(runImport(request, t.session, t.deps, () => undefined)).rejects.toThrow('zaten eklenmiş');
    expect(t.uploads).toEqual([]);
  });

  it('kayıt başarısızsa R2\'ye yüklenen ses ve kapak geri silinir, geçici klasör temizlenir', async () => {
    const t = setup({ insertFails: true });
    await expect(runImport(request, t.session, t.deps, () => undefined)).rejects.toThrow('Şarkı eklenemedi');
    expect(t.removed.sort()).toEqual(t.uploads.map((u) => u.key).sort());
    expect(readdirSync(t.tmpRoot)).toEqual([]);
  });

  it('indirme başarısızsa hiçbir şey yüklenmez, geçici klasör temizlenir', async () => {
    const t = setup({ downloadFails: true });
    await expect(runImport(request, t.session, t.deps, () => undefined)).rejects.toThrow('Video bulunamadı');
    expect(t.uploads).toEqual([]);
    expect(existsSync(t.tmpRoot) && readdirSync(t.tmpRoot)).toEqual([]);
  });
});
