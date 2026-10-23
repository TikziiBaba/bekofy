// Uçtan uca test: gerçek sunucu + geçici admin hesabı + gerçek R2 + gerçek veritabanı.
// "Me at the zoo" (19 sn) içe aktarılır, sonuç veritabanında, R2'de ve genel adreste doğrulanır;
// sonunda şarkı, sanatçı, R2 dosyaları ve hesap silinir. Kullanım: npm run test:e2e -w @bekofy/yt-server
// Gerekli (kökteki .env): SUPABASE_SERVICE_ROLE_KEY ve R2_* ayarları.

import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { DeleteObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

const root = new URL('../../../', import.meta.url);
const parse = (t) => Object.fromEntries(t.split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]));
const env = existsSync(new URL('.env', root)) ? parse(readFileSync(new URL('.env', root), 'utf8')) : {};
const config = readFileSync(new URL('packages/core/src/config.ts', root), 'utf8');
const SUPABASE_URL = config.match(/SUPABASE_URL = '([^']+)'/)[1];
const ANON = config.match(/SUPABASE_ANON_KEY = '([^']+)'/)[1];
const need = ['SUPABASE_SERVICE_ROLE_KEY', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_DOMAIN'].filter((k) => !env[k]);
if (need.length) {
  console.error(`Kökteki .env içinde eksik: ${need.join(', ')}`);
  process.exit(1);
}

const PORT = 4318;
const BASE = `http://127.0.0.1:${PORT}`;
const ORIGIN = 'http://localhost:4400';
const VIDEO = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
const tag = randomBytes(3).toString('hex');
const TITLE = `E2E Deneme ${tag}`;
const ARTIST = `E2E Sanatçı ${tag}`;
// Çekirdekteki slugify ile aynı sonuç (yalnızca bu adlardaki harfler için).
const slug = (s) => s.toLocaleLowerCase('tr-TR').replace(/ç/g, 'c').replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const EXPECTED_AUDIO = `music/${slug(ARTIST)}/${slug(TITLE)}-jnqxac9ivrw.mp3`;
const EXPECTED_COVER = `music/${slug(ARTIST)}/covers/${slug(TITLE)}-jnqxac9ivrw.jpg`;

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, noSession);
const s3 = new S3Client({ region: 'auto', endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY } });
const head = async (Key) => {
  try {
    const r = await s3.send(new HeadObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key }));
    return { exists: true, type: r.ContentType, size: r.ContentLength };
  } catch (e) {
    if (e.$metadata?.httpStatusCode === 404 || e.name === 'NotFound') return { exists: false };
    throw e;
  }
};

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });
const created = { userId: null, songId: null };

function startServer() {
  const tsxCli = createRequire(import.meta.url).resolve('tsx/cli');
  const child = spawn(process.execPath, [tsxCli, 'src/main.ts'], { cwd: fileURLToPath(new URL('../', import.meta.url)), env: { ...process.env, PORT: String(PORT) }, windowsHide: true });
  let log = '';
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Sunucu 30 sn içinde açılmadı:\n${log}`)), 30_000);
    child.stdout.on('data', (c) => {
      log += c.toString();
      if (log.includes('hazır:')) { clearTimeout(timer); resolve(); }
    });
    child.stderr.on('data', (c) => (log += c.toString()));
    child.on('exit', (code) => reject(new Error(`Sunucu kapandı (${code}):\n${log}`)));
  });
  return { child, ready, log: () => log };
}

const server = startServer();
try {
  await server.ready;

  // Geçici admin: service role ile açılır, rolü service role verir (tetikleyici yalnız ona ve admine izin verir).
  const password = randomBytes(18).toString('base64url');
  const email = `e2e-${tag}@bekofy.test`;
  const user = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (user.error) throw new Error(`Test hesabı açılamadı: ${user.error.message}`);
  created.userId = user.data.user.id;
  const prof = await admin.from('profiles').insert({ id: created.userId, username: `e2e_${tag}`, role: 'admin' });
  if (prof.error) throw new Error(`Test profili oluşturulamadı: ${prof.error.message}`);
  const login = await createClient(SUPABASE_URL, ANON, noSession).auth.signInWithPassword({ email, password });
  if (login.error) throw new Error(`Test hesabıyla giriş yapılamadı: ${login.error.message}`);
  const headers = { Origin: ORIGIN, Authorization: `Bearer ${login.data.session.access_token}`, 'Content-Type': 'application/json' };

  const health = await (await fetch(`${BASE}/health`, { headers: { Origin: ORIGIN } })).json();
  check('sağlık: yt-dlp, ffmpeg ve R2 hazır', health.ytDlp && health.ffmpeg && health.r2?.configured, JSON.stringify(health));

  const preview = await fetch(`${BASE}/preview`, { method: 'POST', headers, body: JSON.stringify({ url: 'youtu.be/jNQXAC9IVRw' }) });
  const p = await preview.json();
  check('önizleme: admin oturumuyla bilgi gelir', preview.status === 200 && p.videoId === 'jNQXAC9IVRw' && p.duration === 19 && !p.existing && !p.problem, JSON.stringify(p).slice(0, 200));

  const started = Date.now();
  const res = await fetch(`${BASE}/import`, { method: 'POST', headers, body: JSON.stringify({ url: VIDEO, title: TITLE, artists: [ARTIST], album: null, cover: { kind: 'youtube' } }) });
  check('içe aktarma akışı başlar (200, NDJSON)', res.status === 200 && res.headers.get('content-type')?.includes('ndjson'), `${res.status}`);
  const events = [];
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) if (line.trim()) events.push(JSON.parse(line));
  }
  const percents = events.filter((e) => e.type === 'progress').map((e) => e.percent);
  const stages = [...new Set(events.filter((e) => e.type === 'progress').map((e) => e.stage))];
  check('ilerleme artarak 100 olur, tüm aşamalardan geçer', percents.at(-1) === 100 && percents.every((v, i) => i === 0 || v >= percents[i - 1]) && ['download', 'upload', 'save'].every((s) => stages.includes(s)), `${stages.join(' > ')} | ${percents.length} olay`);
  const done = events.find((e) => e.type === 'done');
  const failed = events.find((e) => e.type === 'error');
  if (!done) throw new Error(`İçe aktarma bitmedi: ${failed?.message ?? 'olay yok'}`);
  created.songId = done.song.id;
  console.log(`  içe aktarma ${((Date.now() - started) / 1000).toFixed(1)} sn sürdü`);

  const audioKey = new URL(done.song.file_path).pathname.slice(1);
  const coverKey = done.song.cover_url ? new URL(done.song.cover_url).pathname.slice(1) : null;
  check('R2 yolları Türkçe karakter katlanmış ve video kimlikli', audioKey === EXPECTED_AUDIO && coverKey === EXPECTED_COVER, `${audioKey} | ${coverKey}`);

  const row = await admin.from('songs').select('title, artist, status, duration, file_path, cover_url, song_artists(position, artist:artists(name))').eq('id', created.songId).single();
  check('kayıt: onaylı, doğru ad, sanatçı ve süre', row.data?.status === 'approved' && row.data.title === TITLE && row.data.artist === ARTIST && row.data.duration === 19, JSON.stringify(row.data ?? row.error).slice(0, 200));
  check('sanatçı bağı kuruldu (yeni sanatçı oluşturuldu)', row.data?.song_artists?.length === 1 && row.data.song_artists[0].artist?.name === ARTIST);
  check('adres genel alan adında', new URL(done.song.file_path).host === env.R2_PUBLIC_DOMAIN.replace(/^https?:\/\//, ''), done.song.file_path);

  const audio = await head(audioKey);
  const cover = coverKey ? await head(coverKey) : { exists: false };
  check('R2: ses dosyası audio/mpeg olarak yüklendi', audio.exists && audio.type === 'audio/mpeg' && audio.size > 100_000, JSON.stringify(audio));
  check('R2: kapak image/jpeg olarak yüklendi', cover.exists && cover.type === 'image/jpeg', JSON.stringify(cover));

  // Önbelleğe test adresi girmesin diye benzersiz sorgu parametresiyle.
  const pub = await fetch(`${done.song.file_path}?e2e=${tag}`, { method: 'HEAD' });
  check('genel adresten çalınabilir (HTTP 200, audio/mpeg)', pub.status === 200 && pub.headers.get('content-type') === 'audio/mpeg', `${pub.status} ${pub.headers.get('content-type')}`);

  const dup = await fetch(`${BASE}/import`, { method: 'POST', headers, body: JSON.stringify({ url: VIDEO, title: TITLE, artists: [ARTIST] }) });
  const dupBody = await dup.json().catch(() => ({}));
  check('aynı video ikinci kez eklenemez (409)', dup.status === 409 && /zaten eklenmiş/.test(dupBody.error?.message ?? ''), `${dup.status} ${dupBody.error?.message ?? ''}`);
} catch (e) {
  check('test akışı', false, e.message);
} finally {
  // Temizlik: ne olursa olsun.
  const problems = [];
  if (created.songId) await admin.from('songs').delete().eq('id', created.songId);
  await admin.from('artists').delete().eq('name', ARTIST);
  for (const Key of [EXPECTED_AUDIO, EXPECTED_COVER]) {
    await s3.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key })).catch((e) => problems.push(`R2 ${Key}: ${e.message}`));
  }
  if (created.userId) {
    await admin.from('profiles').delete().eq('id', created.userId);
    const r = await admin.auth.admin.deleteUser(created.userId);
    if (r.error) problems.push(`hesap: ${r.error.message}`);
  }
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(server.child.pid), '/T', '/F'], { windowsHide: true });
  else server.child.kill();

  const songsLeft = (await admin.from('songs').select('id', { count: 'exact', head: true }).ilike('title', `%${tag}%`)).count ?? 0;
  const artistsLeft = (await admin.from('artists').select('id', { count: 'exact', head: true }).eq('name', ARTIST)).count ?? 0;
  const filesLeft = (await Promise.all([EXPECTED_AUDIO, EXPECTED_COVER].map(head))).filter((h) => h.exists).length;
  const userLeft = created.userId ? !(await admin.auth.admin.getUserById(created.userId)).error : false;
  check('temizlik: şarkı, sanatçı, R2 dosyaları ve hesap silindi', !songsLeft && !artistsLeft && !filesLeft && !userLeft && !problems.length, problems.join('; ') || `şarkı ${songsLeft}, sanatçı ${artistsLeft}, dosya ${filesLeft}, hesap ${userLeft ? 1 : 0}`);

  for (const r of results) console.log(`${r.ok ? 'OK  ' : 'HATA'} ${r.name}${r.ok || !r.detail ? '' : ` -> ${r.detail}`}`);
  const failedCount = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failedCount}/${results.length} kontrol geçti.`);
  process.exitCode = failedCount ? 1 : 0;
}
