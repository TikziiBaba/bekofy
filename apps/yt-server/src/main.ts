// Bekofy yerel YouTube içe aktarma sunucusu. Başlat: npm run yt-server (kök dizinde).

import { readFileSync } from 'node:fs';
import { verifyAdmin } from './auth';
import { loadConfig } from './config';
import { HttpError } from './errors';
import { createAppServer } from './http';
import { preview, runImport } from './importer';
import { createR2 } from './r2';
import { ytDlpVersion } from './ytdlp';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
const config = loadConfig();
const ytVersion = await ytDlpVersion(config.ytDlpPath);
const storage = config.r2 ? createR2(config.r2) : null;

const server = createAppServer({
  port: config.port,
  allowedOrigins: config.allowedOrigins,
  verifyAdmin,
  health: async () => ({
    ok: true,
    version: pkg.version,
    ytDlp: ytVersion,
    ffmpeg: Boolean(config.ffmpegPath),
    r2: { configured: Boolean(storage), missing: config.r2Missing },
  }),
  preview: (url, session) => preview(url, session, { ytDlpPath: config.ytDlpPath }),
  runImport: async (request, session, emit) => {
    if (!storage) throw new HttpError(503, `R2 ayarları eksik: ${config.r2Missing.join(', ')}. apps/yt-server/.env dosyasını doldur.`);
    if (!config.ffmpegPath) throw new HttpError(503, 'ffmpeg bulunamadı. "npm install" komutunu tekrar çalıştır.');
    console.log(`İçe aktarılıyor: ${request.title} (${request.url}) - ${session.username ?? session.userId}`);
    await runImport(request, session, { ytDlpPath: config.ytDlpPath, ffmpegPath: config.ffmpegPath, storage }, (event) => {
      if (event.type === 'done') console.log(`Eklendi: ${event.song.title} - ${event.song.artist}`);
      emit(event);
    });
  },
});

server.listen(config.port, '127.0.0.1', () => {
  console.log(`Bekofy içe aktarma sunucusu hazır: http://127.0.0.1:${config.port}`);
  console.log(`  yt-dlp: ${ytVersion ?? 'KURULU DEĞİL -> npm run setup -w @bekofy/yt-server'}`);
  console.log(`  ffmpeg: ${config.ffmpegPath ? 'hazır' : 'BULUNAMADI -> npm install'}`);
  console.log(`  R2: ${storage ? 'hazır' : `eksik ayarlar: ${config.r2Missing.join(', ')} (apps/yt-server/.env)`}`);
  console.log(`  İzinli adresler: ${config.allowedOrigins.join(', ')}`);
  console.log('Kapatmak için Ctrl+C.');
});
server.on('error', (e: NodeJS.ErrnoException) => {
  console.error(e.code === 'EADDRINUSE' ? `${config.port} portu kullanımda. Sunucu zaten açık olabilir.` : `Sunucu başlatılamadı: ${e.message}`);
  process.exit(1);
});
