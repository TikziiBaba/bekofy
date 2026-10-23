import 'server-only';
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { publicUrl } from '@bekofy/core';

// R2 yalnızca sunucuda: sanatçı yüklemesi için imzalı adres, admin silmeleri için silme.
// Anahtarlar Vercel ortam değişkenlerinde; tarayıcıya hiçbir zaman gitmez.

const KEYS = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_DOMAIN'] as const;

export const CACHE_CONTROL = 'public, max-age=31536000, immutable';
/** İmzalı yükleme adresinin geçerlilik süresi (saniye). */
const UPLOAD_TTL = 600;

export interface R2 {
  bucket: string;
  domain: string;
  presignPut(key: string, contentType: string, length: number): Promise<string>;
  head(key: string): Promise<{ type: string | undefined; size: number | undefined } | null>;
  remove(key: string): Promise<void>;
  publicUrl(key: string): string;
  /** Genel adres bu bucket'a aitse nesne yolu, değilse null (eski Supabase kayıtları, dış adresler). */
  keyOf(url: string | null | undefined): string | null;
}

let cached: R2 | null | undefined;

export function missingR2Keys(): string[] {
  return KEYS.filter((k) => !process.env[k]?.trim());
}

/** Ayarlar eksikse null: çağıran, özelliğin kapalı olduğunu kullanıcıya söyler. */
export function getR2(): R2 | null {
  if (cached !== undefined) return cached;
  if (missingR2Keys().length) return (cached = null);
  const env = (k: (typeof KEYS)[number]) => process.env[k]!.trim();
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY') },
  });
  const bucket = env('R2_BUCKET_NAME');
  const domain = env('R2_PUBLIC_DOMAIN').replace(/^https?:\/\//, '').replace(/\/+$/, '');

  cached = {
    bucket,
    domain,
    presignPut: (key, contentType, length) =>
      getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: length, CacheControl: CACHE_CONTROL }), {
        expiresIn: UPLOAD_TTL,
        // Boyut ve tür imzaya girer: tarayıcı başka boyutta ya da türde dosya gönderemez.
        signableHeaders: new Set(['content-type', 'content-length', 'cache-control']),
      }),
    head: async (key) => {
      try {
        const r = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return { type: r.ContentType, size: r.ContentLength };
      } catch (e) {
        const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (status === 404 || (e as Error).name === 'NotFound') return null;
        throw e;
      }
    },
    remove: async (key) => {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    publicUrl: (key) => publicUrl(domain, key),
    keyOf: (url) => {
      if (!url) return null;
      try {
        const u = new URL(url);
        return u.host === domain && u.pathname.length > 1 ? decodeURIComponent(u.pathname.slice(1)) : null;
      } catch {
        return null;
      }
    },
  };
  return cached;
}
