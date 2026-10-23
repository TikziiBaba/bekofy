// HTTP katmanı: Host ve CORS denetimi, kimlik, gövde sınırı, tek seferde bir içe aktarma, satır satır (NDJSON) ilerleme.
// EventSource yetki başlığı gönderemediği için ilerleme, POST /import yanıtı olarak akıtılır; panel fetch ile okur.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { bearerToken, type AdminSession, type VerifyAdmin } from './auth';
import { HttpError } from './errors';
import { parseImportRequest, type ImportEvent, type ImportRequest } from './importer';

export interface ServerDeps {
  port: number;
  allowedOrigins: readonly string[];
  verifyAdmin: VerifyAdmin;
  health(): Promise<Record<string, unknown>>;
  preview(url: string, session: AdminSession): Promise<unknown>;
  runImport(req: ImportRequest, session: AdminSession, emit: (e: ImportEvent) => void): Promise<void>;
}

/** DNS rebinding'e karşı: yalnızca doğrudan localhost üzerinden gelen istekler. */
export function hostAllowed(host: string | undefined, port: number): boolean {
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

/** Origin yoksa (curl, sunucu içi) "none"; izinli listede ise "allowed"; değilse "denied". */
export function originStatus(origin: string | undefined, allowed: readonly string[]): 'none' | 'allowed' | 'denied' {
  if (!origin) return 'none';
  return allowed.includes(origin) ? 'allowed' : 'denied';
}

export const PREVIEW_BODY_LIMIT = 16 * 1024;
export const IMPORT_BODY_LIMIT = 8 * 1024 * 1024;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

const sendError = (res: ServerResponse, status: number, message: string) => sendJson(res, status, { error: { message } });

function readJson(req: IncomingMessage, limit: number): Promise<unknown> {
  if (!/^application\/json\b/i.test(req.headers['content-type'] ?? '')) return Promise.reject(new HttpError(415, 'İstek JSON olmalı.'));
  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > limit) return Promise.reject(new HttpError(413, 'İstek çok büyük.'));
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, 'İstek çok büyük.'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'İstek gövdesi geçerli JSON değil.'));
      }
    });
    req.on('error', reject);
  });
}

export function createAppServer(deps: ServerDeps): Server {
  let importing = false;

  return createServer(async (req, res) => {
    if (!hostAllowed(req.headers.host, deps.port)) return sendError(res, 421, 'Bu sunucuya yalnızca bu bilgisayardan erişilebilir.');
    const origin = req.headers.origin;
    const status = originStatus(origin, deps.allowedOrigins);
    if (status === 'denied') return sendError(res, 403, 'Bu adresten gelen isteklere izin verilmiyor.');
    if (status === 'allowed' && origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
      res.setHeader('Access-Control-Max-Age', '600');
      if (req.headers['access-control-request-private-network'] === 'true') res.setHeader('Access-Control-Allow-Private-Network', 'true');
      res.writeHead(204);
      return res.end();
    }

    const path = (req.url ?? '/').split('?')[0];
    let started = false;
    try {
      if (req.method === 'GET' && path === '/health') return sendJson(res, 200, await deps.health());

      if (req.method === 'POST' && path === '/preview') {
        const session = await deps.verifyAdmin(bearerToken(req.headers.authorization));
        const body = (await readJson(req, PREVIEW_BODY_LIMIT)) as { url?: unknown };
        if (typeof body?.url !== 'string') throw new HttpError(400, 'Bir YouTube bağlantısı gönder.');
        return sendJson(res, 200, await deps.preview(body.url, session));
      }

      if (req.method === 'POST' && path === '/import') {
        const session = await deps.verifyAdmin(bearerToken(req.headers.authorization));
        if (importing) throw new HttpError(409, 'Başka bir içe aktarma sürüyor. Bitince tekrar dene.');
        const request = parseImportRequest(await readJson(req, IMPORT_BODY_LIMIT));
        if (importing) throw new HttpError(409, 'Başka bir içe aktarma sürüyor. Bitince tekrar dene.');
        importing = true;
        try {
          await deps.runImport(request, session, (event) => {
            if (!started) {
              res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
              started = true;
            }
            res.write(`${JSON.stringify(event)}\n`);
          });
        } finally {
          importing = false;
        }
        return res.end();
      }

      return sendError(res, 404, 'Böyle bir uç yok.');
    } catch (e) {
      const httpError = e instanceof HttpError ? e : null;
      if (!httpError) console.error('Beklenmeyen hata:', e);
      const message = httpError?.message ?? 'Beklenmeyen bir hata oluştu. Sunucu penceresindeki kayda bak.';
      if (started) {
        res.write(`${JSON.stringify({ type: 'error', message } satisfies ImportEvent)}\n`);
        return res.end();
      }
      return sendError(res, httpError?.status ?? 500, message);
    }
  });
}
