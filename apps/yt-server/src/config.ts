// Ayarlar: apps/yt-server/.env (yoksa ortam değişkenleri). Supabase anahtarı gerekmez.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicDomain: string;
}

export interface Config {
  port: number;
  allowedOrigins: string[];
  r2: R2Config | null;
  /** Doldurulmamış R2 ayarlarının adları (sunucu açılırken bildirilir). */
  r2Missing: string[];
  ytDlpPath: string;
  /** ffmpeg ikili dosyası; ffprobe aynı klasörde olmalı (yt-dlp ikisini birlikte arar). */
  ffmpegPath: string | null;
}

const exe = (name: string) => (process.platform === 'win32' ? `${name}.exe` : name);

/** Önce setup betiğinin kurduğu bin/ffmpeg, yoksa PATH'teki ffmpeg (macOS: brew). */
function findFfmpeg(): string | null {
  const local = fileURLToPath(new URL(`../bin/ffmpeg/${exe('ffmpeg')}`, import.meta.url));
  if (existsSync(local) && existsSync(local.replace(/ffmpeg(\.exe)?$/, exe('ffprobe')))) return local;
  try {
    const found = execFileSync(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg'], { windowsHide: true }).toString().split(/\r?\n/)[0]?.trim();
    return found || null;
  } catch {
    return null;
  }
}

const DEFAULT_ORIGINS = ['https://bekofy.bekirr.dev', 'http://localhost:3000', 'http://localhost:4400'];
const R2_KEYS = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_DOMAIN'] as const;

/** Basit .env okuyucu: KEY=değer satırları; tırnaklar ve yorumlar atılır. */
export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m?.[1]) out[m[1]] = (m[2] ?? '').replace(/^["']|["']$/g, '');
  }
  return out;
}

const readEnvFile = (file: URL): Record<string, string> => (existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {});

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  // Öncelik: ortam değişkenleri > apps/yt-server/.env > kökteki .env. Kökten yalnızca R2_ ayarları alınır.
  const rootR2 = Object.fromEntries(Object.entries(readEnvFile(new URL('../../../.env', import.meta.url))).filter(([k]) => k.startsWith('R2_')));
  const values = { ...rootR2, ...readEnvFile(new URL('../.env', import.meta.url)), ...stripEmpty(env) };
  const missing = R2_KEYS.filter((k) => !values[k] || /^(cloudflare-hesap|r2-erisim|r2-gizli|your-)/.test(values[k] ?? ''));
  const r2 = missing.length
    ? null
    : {
        accountId: values.R2_ACCOUNT_ID as string,
        accessKeyId: values.R2_ACCESS_KEY_ID as string,
        secretAccessKey: values.R2_SECRET_ACCESS_KEY as string,
        bucket: values.R2_BUCKET_NAME as string,
        publicDomain: values.R2_PUBLIC_DOMAIN as string,
      };
  const bin = new URL(`../bin/${exe('yt-dlp')}`, import.meta.url);
  return {
    port: Number(values.PORT) || 4317,
    allowedOrigins: values.ALLOWED_ORIGINS ? values.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean) : DEFAULT_ORIGINS,
    r2,
    r2Missing: [...missing],
    ytDlpPath: fileURLToPath(bin),
    ffmpegPath: findFfmpeg(),
  };
}

function stripEmpty(env: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(env).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1] !== ''));
}
