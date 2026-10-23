// Yerel YouTube içe aktarma sunucusunun (apps/yt-server) tarayıcı istemcisi.
// Sunucu adminin bilgisayarında çalışır; istekler admin oturumunun erişim anahtarıyla gider.

export const YT_SERVER_URL = (process.env.NEXT_PUBLIC_YT_SERVER_URL ?? 'http://127.0.0.1:4317').replace(/\/+$/, '');

export interface Health {
  ok: boolean;
  version: string;
  ytDlp: boolean;
  ffmpeg: boolean;
  r2: { configured: boolean; missing: string[] };
}

export interface Preview {
  videoId: string;
  url: string;
  rawTitle: string;
  channel: string;
  duration: number;
  thumbnail: string | null;
  suggestion: { title: string; artists: string[]; album: string | null };
  existing: { id: string; title: string } | null;
  problem: string | null;
}

export type ImportEvent =
  | { type: 'progress'; stage: 'download' | 'convert' | 'cover' | 'upload' | 'save'; percent: number }
  | { type: 'done'; song: { id: string; title: string; artist: string } }
  | { type: 'error'; message: string };

export class YtServerError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'YtServerError';
  }
}

const OFFLINE = 'Yerel sunucuya bağlanılamadı. Bilgisayarında "npm run yt-server" komutunu çalıştır, sonra tekrar dene.';

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${YT_SERVER_URL}${path}`, { ...init, cache: 'no-store' });
  } catch {
    throw new YtServerError(OFFLINE, 0);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new YtServerError(body?.error?.message ?? `Yerel sunucu isteği reddetti (${res.status}).`, res.status);
  }
  return res;
}

export async function health(): Promise<Health> {
  return (await call('/health')).json();
}

const authed = (token: string, body: unknown): RequestInit => ({
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export async function preview(token: string, url: string): Promise<Preview> {
  return (await call('/preview', authed(token, { url }))).json();
}

/** İçe aktarmayı başlatır; satır satır gelen olayları bildirir. Son olay "done" ya da "error". */
export async function runImport(
  token: string,
  body: { url: string; title: string; artists: string[]; album: string | null; cover: { kind: 'youtube' } | { kind: 'upload'; dataUrl: string } },
  onEvent: (e: ImportEvent) => void,
): Promise<void> {
  const res = await call('/import', authed(token, body));
  if (!res.body) throw new YtServerError('Yerel sunucudan yanıt alınamadı.', 0);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line) as ImportEvent);
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as ImportEvent);
}
