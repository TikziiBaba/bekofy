import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AdminSession } from './auth';
import { HttpError } from './errors';
import { createAppServer } from './http';
import type { ImportEvent } from './importer';

const ADMIN = 'admin-token-aaaaaaaaaaaaaaaaaaaa';
const USER = 'user-token-bbbbbbbbbbbbbbbbbbbbb';
const ORIGIN = 'https://bekofy.bekirr.dev';
const body = { url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Yaz Sonu', artists: ['Ayaz Kaya'] };

let release: () => void = () => undefined;
let mode: 'ok' | 'fail-early' | 'fail-late' | 'slow' = 'ok';
let port = 0;
const server = createAppServer({
  port: 0,
  allowedOrigins: [ORIGIN],
  verifyAdmin: async (token) => {
    if (token === ADMIN) return { userId: 'u1', username: 'admin', sb: {} as AdminSession['sb'] };
    if (token === USER) throw new HttpError(403, 'Bu işlem yalnızca admin içindir.');
    throw new HttpError(401, 'Oturumun geçersiz ya da süresi dolmuş.');
  },
  health: async () => ({ ok: true }),
  preview: async (url) => ({ echo: url }),
  runImport: async (_req, _session, emit: (e: ImportEvent) => void) => {
    if (mode === 'fail-early') throw new HttpError(409, 'Bu video zaten eklenmiş.');
    emit({ type: 'progress', stage: 'download', percent: 10 });
    if (mode === 'slow') await new Promise<void>((r) => (release = r));
    if (mode === 'fail-late') throw new HttpError(502, "R2'ye yüklenemedi.");
    emit({ type: 'done', song: { id: 's1', title: 'Yaz Sonu', artist: 'Ayaz Kaya', album: null, duration: 219, cover_url: null, file_path: 'https://x/y.mp3' } });
  },
});

beforeAll(async () => {
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  port = (server.address() as AddressInfo).port;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

interface Res { status: number; headers: Record<string, string | string[] | undefined>; text: string }
function call(method: string, path: string, { headers = {}, json, raw }: { headers?: Record<string, string>; json?: unknown; raw?: string } = {}): Promise<Res> {
  const payload = raw ?? (json === undefined ? undefined : JSON.stringify(json));
  return new Promise((resolve, reject) => {
    // Sunucu port 0 ile kurulduğundan Host denetimi "127.0.0.1:0" bekler.
    const req = request({ host: '127.0.0.1', port, method, path, headers: { Host: `127.0.0.1:0`, ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}), ...headers } }, (res) => {
      let text = '';
      res.on('data', (c: Buffer) => (text += c.toString('utf8')));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, text }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}
const auth = (token: string) => ({ Authorization: `Bearer ${token}`, Origin: ORIGIN });

describe('HTTP güvenliği', () => {
  it('yanlış Host reddedilir (DNS rebinding)', async () => {
    const res = await call('GET', '/health', { headers: { Host: 'evil.example:4317' } });
    expect(res.status).toBe(421);
  });
  it('izinsiz Origin reddedilir, izinli Origin CORS başlığı alır', async () => {
    expect((await call('GET', '/health', { headers: { Origin: 'https://evil.example' } })).status).toBe(403);
    const ok = await call('GET', '/health', { headers: { Origin: ORIGIN } });
    expect(ok.status).toBe(200);
    expect(ok.headers['access-control-allow-origin']).toBe(ORIGIN);
  });
  it('ön istek: yöntemler, başlıklar ve yerel ağ izni', async () => {
    const res = await call('OPTIONS', '/import', { headers: { Origin: ORIGIN, 'Access-Control-Request-Private-Network': 'true' } });
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-headers']).toContain('authorization');
    expect(res.headers['access-control-allow-private-network']).toBe('true');
  });
  it('oturum yoksa 401, admin değilse 403', async () => {
    expect((await call('POST', '/preview', { json: { url: 'x' }, headers: { Origin: ORIGIN } })).status).toBe(401);
    expect((await call('POST', '/preview', { json: { url: 'x' }, headers: auth(USER) })).status).toBe(403);
  });
  it('JSON olmayan gövde 415, çok büyük gövde 413, bozuk JSON 400', async () => {
    expect((await call('POST', '/preview', { raw: 'url=x', headers: { ...auth(ADMIN), 'Content-Type': 'text/plain' } })).status).toBe(415);
    expect((await call('POST', '/preview', { json: { url: 'a'.repeat(20000) }, headers: auth(ADMIN) })).status).toBe(413);
    expect((await call('POST', '/preview', { raw: '{bozuk', headers: auth(ADMIN) })).status).toBe(400);
  });
  it('bilinmeyen uç 404', async () => {
    expect((await call('GET', '/yok', { headers: { Origin: ORIGIN } })).status).toBe(404);
  });
});

describe('önizleme ve içe aktarma', () => {
  it('önizleme admin için çalışır', async () => {
    const res = await call('POST', '/preview', { json: { url: 'https://youtu.be/dQw4w9WgXcQ' }, headers: auth(ADMIN) });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.text)).toEqual({ echo: 'https://youtu.be/dQw4w9WgXcQ' });
  });
  it('içe aktarma ilerlemeyi satır satır akıtır', async () => {
    mode = 'ok';
    const res = await call('POST', '/import', { json: body, headers: auth(ADMIN) });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/x-ndjson');
    const lines = res.text.trim().split('\n').map((l) => JSON.parse(l) as ImportEvent);
    expect(lines.map((l) => l.type)).toEqual(['progress', 'done']);
  });
  it('geçersiz istek akış başlamadan 400 döner', async () => {
    const res = await call('POST', '/import', { json: { ...body, artists: [] }, headers: auth(ADMIN) });
    expect(res.status).toBe(400);
    expect(JSON.parse(res.text).error.message).toBe('En az bir sanatçı yaz.');
  });
  it('akış başlamadan hata: durum koduyla JSON', async () => {
    mode = 'fail-early';
    const res = await call('POST', '/import', { json: body, headers: auth(ADMIN) });
    expect(res.status).toBe(409);
    expect(JSON.parse(res.text).error.message).toContain('zaten eklenmiş');
  });
  it('akış ortasında hata: son satır error olayı', async () => {
    mode = 'fail-late';
    const res = await call('POST', '/import', { json: body, headers: auth(ADMIN) });
    const lines = res.text.trim().split('\n').map((l) => JSON.parse(l) as ImportEvent);
    expect(lines.at(-1)).toEqual({ type: 'error', message: "R2'ye yüklenemedi." });
  });
  it('aynı anda ikinci içe aktarma 409 alır, ilki bitince yeniden açılır', async () => {
    mode = 'slow';
    const first = call('POST', '/import', { json: body, headers: auth(ADMIN) });
    await new Promise((r) => setTimeout(r, 100));
    const second = await call('POST', '/import', { json: body, headers: auth(ADMIN) });
    expect(second.status).toBe(409);
    release();
    expect((await first).status).toBe(200);
    mode = 'ok';
    expect((await call('POST', '/import', { json: body, headers: auth(ADMIN) })).status).toBe(200);
  });
});
