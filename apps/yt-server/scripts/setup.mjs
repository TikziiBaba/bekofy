// yt-dlp ve ffmpeg/ffprobe'u yt-dlp ekibinin resmi GitHub sürümlerinden indirir; SHA-256 özetlerini
// sürümlerdeki özet dosyalarıyla doğrular. Dosyalar apps/yt-server/bin/ altına kurulur (git'e girmez).
// Kullanım: npm run setup -w @bekofy/yt-server   (ilk kurulum; kurulu olanı atlar)
//           npm run update -w @bekofy/yt-server  (ikisini de en son sürüme günceller)

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const win = process.platform === 'win32';
const exe = (name) => (win ? `${name}.exe` : name);
const binDir = fileURLToPath(new URL('../bin/', import.meta.url));
const ffmpegDir = join(binDir, 'ffmpeg');
const update = process.argv.includes('--update');

const YTDLP_ASSET = { win32: 'yt-dlp.exe', darwin: 'yt-dlp_macos', linux: 'yt-dlp_linux' }[process.platform];
const FFMPEG_ASSET = { win32: 'ffmpeg-master-latest-win64-gpl-shared.zip', linux: 'ffmpeg-master-latest-linux64-gpl.tar.xz' }[process.platform];

async function download(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${url} indirilemedi: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Dosyayı ve özet listesini indirir; özet eşleşmezse durur. */
async function verifiedDownload(base, asset, sumsName) {
  const [file, sums] = await Promise.all([download(base + asset), download(base + sumsName)]);
  const expected = sums.toString('utf8').split('\n').map((l) => l.trim().split(/\s+/)).find(([, name]) => name?.replace(/^\*/, '') === asset)?.[0];
  const actual = createHash('sha256').update(file).digest('hex');
  if (!expected || expected.toLowerCase() !== actual) {
    throw new Error(`${asset} için SHA-256 doğrulanamadı; dosya kullanılmadı.\n  beklenen: ${expected ?? 'listede yok'}\n  gelen:    ${actual}`);
  }
  return { file, sha: actual };
}

const version = (bin, args) => execFileSync(bin, args, { windowsHide: true }).toString().split('\n')[0].trim();

async function setupYtDlp() {
  const target = join(binDir, exe('yt-dlp'));
  if (existsSync(target) && !update) return console.log(`yt-dlp zaten kurulu: ${version(target, ['--version'])}`);
  if (!YTDLP_ASSET) throw new Error(`yt-dlp bu işletim sistemini desteklemiyor: ${process.platform}`);
  console.log(`yt-dlp indiriliyor (${YTDLP_ASSET})...`);
  const { file, sha } = await verifiedDownload('https://github.com/yt-dlp/yt-dlp/releases/latest/download/', YTDLP_ASSET, 'SHA2-256SUMS');
  mkdirSync(binDir, { recursive: true });
  const temp = `${target}.indiriliyor`;
  writeFileSync(temp, file);
  if (!win) chmodSync(temp, 0o755);
  renameSync(temp, target);
  console.log(`yt-dlp ${version(target, ['--version'])} kuruldu (SHA-256 ${sha.slice(0, 16)}... doğrulandı).`);
}

async function setupFfmpeg() {
  const target = join(ffmpegDir, exe('ffmpeg'));
  if (existsSync(target) && existsSync(join(ffmpegDir, exe('ffprobe'))) && !update) return console.log(`ffmpeg zaten kurulu: ${version(target, ['-hide_banner', '-version'])}`);
  if (!FFMPEG_ASSET) {
    console.log('Bu işletim sistemi için hazır ffmpeg paketi yok. "brew install ffmpeg" ile kur; sunucu PATH\'teki ffmpeg\'i kullanır.');
    return;
  }
  console.log(`ffmpeg ve ffprobe indiriliyor (${FFMPEG_ASSET}, yaklaşık 90-150 MB)...`);
  const { file, sha } = await verifiedDownload('https://github.com/yt-dlp/FFmpeg-Builds/releases/latest/download/', FFMPEG_ASSET, 'checksums.sha256');
  const work = mkdtempSync(join(tmpdir(), 'bekofy-ffmpeg-'));
  try {
    const archive = join(work, FFMPEG_ASSET);
    writeFileSync(archive, file);
    // Windows'ta PATH'teki Git tar'ı "C:" yolunu uzak sunucu sanar ve zip açamaz; sistemin bsdtar'ı kullanılır.
    const tar = win ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
    execFileSync(tar, ['-xf', archive, '-C', work], { windowsHide: true });
    const root = readdirSync(work).map((n) => join(work, n)).find((p) => statSync(p).isDirectory() && existsSync(join(p, 'bin', exe('ffmpeg'))));
    if (!root) throw new Error('Arşivde ffmpeg bulunamadı.');
    rmSync(ffmpegDir, { recursive: true, force: true });
    mkdirSync(ffmpegDir, { recursive: true });
    cpSync(join(root, 'bin'), ffmpegDir, { recursive: true });
    if (!existsSync(join(ffmpegDir, exe('ffprobe')))) throw new Error('Arşivde ffprobe bulunamadı.');
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  console.log(`ffmpeg kuruldu: ${version(target, ['-hide_banner', '-version'])} (SHA-256 ${sha.slice(0, 16)}... doğrulandı).`);
}

try {
  await setupYtDlp();
  await setupFfmpeg();
  console.log('Hazır. Sunucuyu başlatmak için (kök dizinde): npm run yt-server');
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
