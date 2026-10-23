// Cloudflare R2 (S3 uyumlu) yükleme ve silme.

import { createReadStream, statSync } from 'node:fs';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { publicUrl } from '@bekofy/core';
import type { R2Config } from './config';
import { HttpError } from './errors';

export interface Storage {
  upload(key: string, file: string, contentType: string, onProgress?: (ratio: number) => void): Promise<string>;
  remove(key: string): Promise<void>;
}

export function createR2(cfg: R2Config): Storage {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
  return {
    async upload(key, file, contentType, onProgress) {
      const total = statSync(file).size;
      const upload = new Upload({
        client,
        params: { Bucket: cfg.bucket, Key: key, Body: createReadStream(file), ContentType: contentType, ContentLength: total, CacheControl: 'public, max-age=31536000, immutable' },
      });
      upload.on('httpUploadProgress', (p) => onProgress?.(Math.min(1, (p.loaded ?? 0) / (p.total ?? total))));
      try {
        await upload.done();
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (/access denied|forbidden|invalidaccesskeyid|signaturedoesnotmatch/i.test(message)) {
          throw new HttpError(502, 'R2 yüklemeyi reddetti. .env içindeki R2 anahtarlarını ve bucket iznini kontrol et.');
        }
        throw new HttpError(502, `R2'ye yüklenemedi: ${message.slice(0, 160)}`);
      }
      return publicUrl(cfg.publicDomain, key);
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
    },
  };
}
