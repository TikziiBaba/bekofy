// Sitenin uçtan uca testi: gerçek veritabanı, gerçek R2, gerçek yerel YouTube sunucusu, tarayıcıda gerçek arayüz.
// Geçici hesaplar (@bekofy.test) açılır, akışlar denenir, sonunda her şey silinir ve silindiği ayrıca doğrulanır.
//
// Akış: kayıt -> profil -> sanatçı başvurusu -> admin onayı -> şarkı yükleme (bozuk gövde reddedilir) ->
// admin ret (R2 dosyaları silinir) -> ikinci yükleme -> onay -> düzenleme -> silme -> Premium verme ->
// YouTube'dan içe aktarma (arayüzden) -> silme -> oturumlu sayfalarda erişilebilirlik denetimi.
//
// Gerekli: çalışan site (npm run dev -w @bekofy/web), kökteki .env (SUPABASE_SERVICE_ROLE_KEY, R2_*),
// apps/web/.env.local (R2_*), npm run yt-server:setup yapılmış olmalı.
// Not: R2 bucket'ında CORS henüz ayarlı olmayabilir; tarayıcının R2 isteği test içinde sunucudan geçirilir
// (imza ve boyut denetimi yine R2'de yapılır).

import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const BASE = process.env.BEKOFY_CHECK_URL ?? 'http://localhost:3000';
const parse = (t) => Object.fromEntries(t.split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]));
const env = parse(readFileSync(join(ROOT, '.env'), 'utf8'));
const config = readFileSync(join(ROOT, 'packages/core/src/config.ts'), 'utf8');
const SUPABASE_URL = config.match(/SUPABASE_URL = '([^']+)'/)[1];
for (const k of ['SUPABASE_SERVICE_ROLE_KEY', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_DOMAIN']) {
  if (!env[k]) throw new Error(`Kökteki .env içinde ${k} eksik`);
}

const tag = randomBytes(3).toString('hex');
const ARTIST = `E2E Sanatçı ${tag}`;
const ARTIST_SLUG = `e2e-sanatci-${tag}`;
const pw = () => `${randomBytes(12).toString('base64url')}9a`;
const ACCOUNTS = {
  admin: { email: `e2e-admin-${tag}@bekofy.test`, password: pw(), username: `e2e_admin_${tag}` },
  user: { email: `e2e-user-${tag}@bekofy.test`, password: pw(), username: `e2e_user_${tag}` },
};

const sb = createClient(SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const s3 = new S3Client({ region: 'auto', endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY } });
const keyOf = (url) => (url && url.startsWith(`https://${env.R2_PUBLIC_DOMAIN}/`) ? decodeURIComponent(new URL(url).pathname.slice(1)) : null);
const r2Exists = async (key) => {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }));
    return true;
  } catch (e) {
    if (e.$metadata?.httpStatusCode === 404 || e.name === 'NotFound') return false;
    throw e;
  }
};

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'OK  ' : 'HATA'} ${name}${ok || !detail ? '' : ` -> ${detail}`}`);
};
let pages = [];
const step = async (name, fn) => {
  try {
    await fn();
  } catch (e) {
    // Sayfada görünen hata kutuları tanıya eklenir.
    const shown = [];
    for (const p of pages) shown.push(...(await p.locator('[role="alert"]').allInnerTexts().catch(() => [])));
    check(name, false, [e.message.split('\n')[0], ...shown.filter(Boolean)].join(' | '));
  }
};
const userIds = new Set();

/* ---------- Hazırlık: test dosyaları ---------- */
const work = mkdtempSync(join(tmpdir(), 'bekofy-web-e2e-'));
const ffmpeg = join(ROOT, 'apps/yt-server/bin/ffmpeg', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
if (!existsSync(ffmpeg)) throw new Error('ffmpeg yok: önce npm run yt-server:setup');
const MP3 = join(work, 'deneme-sarki.mp3');
const PNG = join(work, 'kapak.png');
spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6', '-b:a', '128k', MP3], { windowsHide: true });
spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0x2BD98A:s=320x320', '-frames:v', '1', PNG], { windowsHide: true });
if (!existsSync(MP3) || !existsSync(PNG)) throw new Error('Test dosyaları üretilemedi');

/* ---------- Yerel YouTube sunucusu ---------- */
const tsxCli = join(ROOT, 'node_modules/tsx/dist/cli.mjs');
const yt = spawn(process.execPath, [tsxCli, 'src/main.ts'], { cwd: join(ROOT, 'apps/yt-server'), windowsHide: true, env: { ...process.env } });
let ytLog = '';
const ytReady = new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`yt-server açılmadı:\n${ytLog}`)), 30_000);
  yt.stdout.on('data', (c) => { ytLog += c; if (ytLog.includes('hazır:')) { clearTimeout(t); resolve(); } });
  yt.stderr.on('data', (c) => (ytLog += c));
});

/* ---------- Tarayıcı ---------- */
// Bucket CORS'u bu anahtarla okunup yazılamıyor (panelden ayarlanır); testte tarayıcı CORS denetimi kapatılır.
const browser = await chromium.launch({ args: ['--disable-web-security'] });
const r2Puts = [];
let tamperNext = false;

async function newSession() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'tr-TR', reducedMotion: 'reduce' });
  // İmza denetimi: işaretliyse bir sonraki ses yüklemesinin türü değiştirilir; imza tutmaz, R2 403 döner.
  // continue() gövdeyi tarayıcının kendisi gönderir (Playwright dosya gövdesini okuyamaz).
  await ctx.route(/\.r2\.cloudflarestorage\.com\//, (route) => {
    const req = route.request();
    if (tamperNext && req.method() === 'PUT' && req.headers()['content-type'] === 'audio/mpeg') {
      tamperNext = false;
      return route.continue({ headers: { ...req.headers(), 'content-type': 'audio/wav' } });
    }
    return route.continue();
  });
  ctx.on('response', (res) => {
    if (res.request().method() === 'PUT' && /\.r2\.cloudflarestorage\.com\//.test(res.url())) r2Puts.push(res.status());
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { ctx, page, errors };
}

async function login(page, acc) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', acc.email);
  await page.fill('#password', acc.password);
  await page.click('form button[type="submit"]');
  await page.waitForURL(`${BASE}/account`, { timeout: 20000 });
}

const toast = (page, text) => page.locator('[role="status"]').filter({ hasText: text }).first().waitFor({ timeout: 20000 });

try {
  await ytReady;

  // Admin hesabı service role ile (rolü yalnızca service role ya da admin verebilir).
  const created = await sb.auth.admin.createUser({ email: ACCOUNTS.admin.email, password: ACCOUNTS.admin.password, email_confirm: true });
  if (created.error) throw new Error(`Admin hesabı açılamadı: ${created.error.message}`);
  userIds.add(created.data.user.id);
  const profileRes = await sb.from('profiles').insert({ id: created.data.user.id, username: ACCOUNTS.admin.username, role: 'admin' });
  if (profileRes.error) throw new Error(`Admin profili: ${profileRes.error.message}`);

  const user = await newSession();
  const admin = await newSession();
  pages = [user.page, admin.page];
  let userId = null;

  await step('kayıt: arayüzden hesap açılır', async () => {
    const { page } = user;
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await page.fill('#username', ACCOUNTS.user.username);
    await page.fill('#email', ACCOUNTS.user.email);
    await page.fill('#password', ACCOUNTS.user.password);
    await page.click('form button[type="submit"]');
    const confirmNeeded = page.getByText('E-postanı kontrol et');
    await Promise.race([page.waitForURL(`${BASE}/account`, { timeout: 20000 }), confirmNeeded.waitFor({ timeout: 20000 })]);
    const list = await sb.auth.admin.listUsers({ perPage: 200 });
    const u = list.data.users.find((x) => x.email === ACCOUNTS.user.email);
    if (!u) throw new Error('hesap oluşmadı');
    userId = u.id;
    userIds.add(u.id);
    if (await confirmNeeded.isVisible()) {
      await sb.auth.admin.updateUserById(u.id, { email_confirm: true });
      await login(page, ACCOUNTS.user);
    }
    const prof = await sb.from('profiles').select('username, role').eq('id', u.id).single();
    check('kayıt: hesap ve profil oluştu, /account açıldı', prof.data?.username === ACCOUNTS.user.username && page.url() === `${BASE}/account`, JSON.stringify(prof.data));
  });

  await step('profil kaydı', async () => {
    const { page } = user;
    await page.fill('#bio', `E2E hakkında ${tag}`);
    await page.click('form:has(#bio) button[type="submit"]');
    await page.getByText('Profilin kaydedildi.').waitFor({ timeout: 15000 });
    const prof = await sb.from('profiles').select('bio').eq('id', userId).single();
    check('profil: hakkında alanı kaydedildi', prof.data?.bio === `E2E hakkında ${tag}`);
  });

  await step('giriş kaydı', async () => {
    const logs = await sb.from('user_access_logs').select('platform').eq('user_id', userId);
    // Kayıt anında oturum açıldıysa giriş kaydı yazılmaz; giriş formu kullanıldıysa yazılır.
    check('giriş kaydı yazılabilir (RLS)', !logs.error, logs.error?.message);
  });

  await step('sanatçı başvurusu', async () => {
    const { page } = user;
    await page.goto(`${BASE}/artist`, { waitUntil: 'networkidle' });
    await page.fill('#artist-name', ARTIST);
    await page.fill('#artist-message', 'Uçtan uca test başvurusu.');
    await page.fill('#artist-links', 'https://example.com/e2e');
    await page.click('form button[type="submit"]');
    await page.getByText('Başvurun değerlendiriliyor').waitFor({ timeout: 15000 });
    const req = await sb.from('artist_requests').select('status, artist_name').eq('user_id', userId).single();
    check('başvuru: kayıt pending, sayfa durum gösteriyor', req.data?.status === 'pending' && req.data.artist_name === ARTIST);
  });

  await step('admin girişi ve başvuru onayı', async () => {
    const { page } = admin;
    await login(page, ACCOUNTS.admin);
    await page.goto(`${BASE}/admin/artist-requests`, { waitUntil: 'networkidle' });
    const card = page.locator('li').filter({ hasText: ARTIST });
    await card.getByRole('button', { name: 'Onayla' }).click();
    await toast(page, 'onaylandı');
    const prof = await sb.from('profiles').select('role').eq('id', userId).single();
    const art = await sb.from('artists').select('name, profile_id').eq('name', ARTIST).maybeSingle();
    check('onay: kullanıcı sanatçı oldu, sanatçı kaydı hesaba bağlı', prof.data?.role === 'artist' && art.data?.profile_id === userId, JSON.stringify({ role: prof.data?.role, art: art.data }));
  });

  const upload = async (title, { tamper = false } = {}) => {
    const { page } = user;
    await page.goto(`${BASE}/artist`, { waitUntil: 'networkidle' });
    await page.setInputFiles('#song-audio', MP3);
    await page.setInputFiles('#song-cover', PNG);
    await page.fill('#song-title', title);
    await page.fill('#song-genre', 'Test');
    tamperNext = tamper;
    await page.click('form:has(#song-audio) button[type="submit"]');
  };
  const songByTitle = async (title) => (await sb.from('songs').select('*').eq('title', title).maybeSingle()).data;

  await step('bozuk yükleme reddedilir', async () => {
    const title = `E2E Bozuk ${tag}`;
    const before = r2Puts.length;
    await upload(title, { tamper: true });
    await user.page.getByText('Dosya yüklenemedi').waitFor({ timeout: 30000 });
    const list = await s3.send(new ListObjectsV2Command({ Bucket: env.R2_BUCKET_NAME, Prefix: `music/${ARTIST_SLUG}/` }));
    check('imzalı adres: türü değişen dosyayı R2 reddeder, yarım dosya kalmaz', r2Puts.slice(before).includes(403) && !(await songByTitle(title)) && !list.KeyCount, `PUT ${r2Puts.slice(before)} | nesne ${list.KeyCount}`);
  });

  let first;
  await step('şarkı yükleme', async () => {
    const title = `E2E Şarkı ${tag}`;
    await upload(title);
    await user.page.getByText(`${title} gönderildi`).waitFor({ timeout: 60000 });
    first = await songByTitle(title);
    const link = await sb.from('song_artists').select('artist:artists(name)').eq('song_id', first?.id ?? '');
    const audioKey = keyOf(first?.file_path);
    const coverKey = keyOf(first?.cover_url);
    check(
      'yükleme: kayıt pending, yükleyen ve sanatçı bağlı, ses ve kapak R2de',
      first?.status === 'pending' && first.uploaded_by === userId && first.duration === 6 && link.data?.[0]?.artist?.name === ARTIST && audioKey?.startsWith(`music/${ARTIST_SLUG}/`) && (await r2Exists(audioKey)) && coverKey && (await r2Exists(coverKey)),
      JSON.stringify({ status: first?.status, dur: first?.duration, audioKey, coverKey }),
    );
    await user.page.goto(`${BASE}/artist`, { waitUntil: 'networkidle' });
    check('sanatçı paneli: şarkı "Onay bekliyor" olarak listelenir', await user.page.locator('tr').filter({ hasText: title }).getByText('Onay bekliyor').isVisible());
  });

  await step('admin ret: dosyalar silinir', async () => {
    const { page } = admin;
    await page.goto(`${BASE}/admin/songs?status=pending`, { waitUntil: 'networkidle' });
    const row = page.locator('li').filter({ hasText: first.title });
    await row.getByRole('button', { name: `Reddet: ${first.title}` }).click();
    await page.getByRole('button', { name: 'Reddet ve dosyaları sil' }).click();
    await toast(page, 'reddedildi');
    const after = await songByTitle(first.title);
    check('ret: kayıt rejected, R2 ses ve kapak silindi', after?.status === 'rejected' && !(await r2Exists(keyOf(first.file_path))) && !(await r2Exists(keyOf(first.cover_url))));
  });

  let second;
  await step('onay, düzenleme, silme', async () => {
    const title = `E2E İkinci ${tag}`;
    await upload(title);
    await user.page.getByText(`${title} gönderildi`).waitFor({ timeout: 60000 });
    second = await songByTitle(title);
    const { page } = admin;
    await page.goto(`${BASE}/admin/songs/${second.id}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: `Onayla: ${title}` }).click();
    await toast(page, 'yayına alındı');
    check('onay: şarkı yayında', (await songByTitle(title))?.status === 'approved');

    const renamed = `E2E Düzenlendi ${tag}`;
    await page.fill('#title', renamed);
    await page.fill('#artists', `${ARTIST}, E2E Konuk ${tag}`);
    await page.click('form:has(#title) button[type="submit"]');
    await toast(page, 'Şarkı kaydedildi.');
    const edited = (await sb.from('songs').select('title, artist, song_artists(position, artist:artists(name))').eq('id', second.id).single()).data;
    const names = edited?.song_artists.sort((a, b) => a.position - b.position).map((x) => x.artist?.name);
    check('düzenleme: ad, sanatçı metni ve iki sanatçı bağı', edited?.title === renamed && edited.artist === `${ARTIST}, E2E Konuk ${tag}` && names?.join('|') === `${ARTIST}|E2E Konuk ${tag}`, JSON.stringify(edited));

    await page.getByRole('button', { name: `Sil: ${renamed}` }).click();
    await page.getByRole('button', { name: 'Kalıcı olarak sil' }).click();
    await page.waitForURL(`${BASE}/admin/songs`, { timeout: 20000 });
    const gone = !(await sb.from('songs').select('id').eq('id', second.id).maybeSingle()).data;
    check('silme: kayıt ve R2 dosyaları silindi, listeye dönüldü', gone && !(await r2Exists(keyOf(second.file_path))) && !(await r2Exists(keyOf(second.cover_url))));
  });

  await step('kullanıcı yönetimi', async () => {
    const { page } = admin;
    await page.goto(`${BASE}/admin/users?q=${ACCOUNTS.user.username}`, { waitUntil: 'networkidle' });
    const row = page.locator('li').filter({ hasText: `@${ACCOUNTS.user.username}` });
    await row.getByRole('switch', { name: 'Premium' }).click();
    await toast(page, 'Premium oldu');
    const prof = await sb.from('profiles').select('is_premium').eq('id', userId).single();
    await page.goto(`${BASE}/admin/users?q=${ACCOUNTS.admin.username}`, { waitUntil: 'networkidle' });
    const self = page.locator('li').filter({ hasText: `@${ACCOUNTS.admin.username}` });
    check('Premium verildi; admin kendi rolünü ve askısını değiştiremez', prof.data?.is_premium === true && (await self.locator('select').isDisabled()) && (await self.getByRole('switch', { name: 'Askıda' }).isDisabled()));
    await user.page.goto(`${BASE}/account`, { waitUntil: 'networkidle' });
    check('hesap sayfası Premium gösterir', await user.page.getByText('Premium üyesin').isVisible());
  });

  await step('yetkisiz erişim', async () => {
    const res = await user.page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
    check('admin olmayan /admin -> 404', res?.status() === 404);
    const anon = await browser.newPage();
    await anon.goto(`${BASE}/account`, { waitUntil: 'networkidle' });
    check('oturumsuz /account -> girişe yönlendirilir', anon.url().startsWith(`${BASE}/login?next=%2Faccount`));
    await anon.close();
  });

  let imported;
  await step('YouTube içe aktarma (arayüzden)', async () => {
    const { page } = admin;
    await page.goto(`${BASE}/admin/import`, { waitUntil: 'networkidle' });
    await page.getByText('Yerel sunucu: bağlı').waitFor({ timeout: 15000 });
    await page.fill('#yt-url', 'youtu.be/jNQXAC9IVRw');
    await page.click('form button[type="submit"]');
    await page.locator('#imp-title').waitFor({ timeout: 60000 });
    await page.fill('#imp-title', `E2E YouTube ${tag}`);
    await page.fill('#imp-artists', `E2E YT ${tag}`);
    await page.getByRole('button', { name: 'Kütüphaneye ekle' }).click();
    await page.getByText(`E2E YouTube ${tag} eklendi`).waitFor({ timeout: 120000 });
    imported = await songByTitle(`E2E YouTube ${tag}`);
    check('içe aktarma: arayüzde ilerleme bitti, kayıt yayında, R2de dosya var', imported?.status === 'approved' && (await r2Exists(keyOf(imported.file_path))));
    await page.goto(`${BASE}/admin/songs/${imported.id}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: `Sil: E2E YouTube ${tag}` }).click();
    await page.getByRole('button', { name: 'Kalıcı olarak sil' }).click();
    await page.waitForURL(`${BASE}/admin/songs`, { timeout: 20000 });
    check('içe aktarılan şarkı silindi (kayıt + R2)', !(await songByTitle(`E2E YouTube ${tag}`)) && !(await r2Exists(keyOf(imported.file_path))));
  });

  for (const s of [user, admin]) for (const e of new Set(s.errors)) check('tarayıcı JS hatası yok', false, e.split('\n')[0]);
  await user.ctx.close();
  await admin.ctx.close();

  // Oturumlu sayfaların erişilebilirlik denetimi (admin hesabıyla).
  await step('oturumlu sayfalar denetimi', async () => {
    const r = spawnSync(process.execPath, [join(ROOT, 'apps/web/scripts/check.mjs'), '--auth'], {
      env: { ...process.env, BEKOFY_CHECK_EMAIL: ACCOUNTS.admin.email, BEKOFY_CHECK_PASSWORD: ACCOUNTS.admin.password },
      encoding: 'utf8',
      timeout: 20 * 60_000,
    });
    const out = `${r.stdout}${r.stderr}`;
    console.log(out.trim().split('\n').slice(-25).join('\n'));
    check('erişilebilirlik, kontrast, odak ve taşma (oturumlu + oturumsuz)', r.status === 0, out.split('\n').find((l) => l.startsWith('SORUN')) ?? `çıkış ${r.status}`);
  });
} catch (e) {
  check('test akışı', false, e.message.split('\n')[0]);
} finally {
  await browser.close().catch(() => undefined);
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(yt.pid), '/T', '/F'], { windowsHide: true });
  else yt.kill();

  // Temizlik: bu çalıştırmanın etiketiyle oluşan her şey.
  const problems = [];
  const all = await sb.auth.admin.listUsers({ perPage: 1000 });
  for (const u of all.data?.users ?? []) if (u.email?.endsWith('@bekofy.test') && u.email.includes(tag)) userIds.add(u.id);
  const ids = [...userIds];
  const songs = (await sb.from('songs').select('id, file_path, cover_url').or(`title.ilike.%${tag}%${ids.length ? `,uploaded_by.in.(${ids.join(',')})` : ''}`)).data ?? [];
  for (const s of songs) {
    for (const key of [keyOf(s.file_path), keyOf(s.cover_url)].filter(Boolean)) {
      await s3.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key })).catch((e) => problems.push(`R2 ${key}: ${e.message}`));
    }
    await sb.from('songs').delete().eq('id', s.id);
  }
  for (const prefix of [`music/${ARTIST_SLUG}/`, `music/e2e-yt-${tag}/`]) {
    const list = await s3.send(new ListObjectsV2Command({ Bucket: env.R2_BUCKET_NAME, Prefix: prefix }));
    for (const o of list.Contents ?? []) await s3.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: o.Key }));
  }
  await sb.from('artists').delete().ilike('name', `%${tag}%`);
  if (ids.length) {
    await sb.from('artist_requests').delete().in('user_id', ids);
    await sb.from('user_access_logs').delete().in('user_id', ids);
    await sb.from('profiles').delete().in('id', ids);
    for (const id of ids) {
      const r = await sb.auth.admin.deleteUser(id);
      if (r.error) problems.push(`hesap ${id}: ${r.error.message}`);
    }
  }
  rmSync(work, { recursive: true, force: true });

  const songsLeft = (await sb.from('songs').select('id', { count: 'exact', head: true }).ilike('title', `%${tag}%`)).count;
  const artistsLeft = (await sb.from('artists').select('id', { count: 'exact', head: true }).ilike('name', `%${tag}%`)).count;
  const usersLeft = ((await sb.auth.admin.listUsers({ perPage: 1000 })).data?.users ?? []).filter((u) => u.email?.includes(tag)).length;
  const filesLeft = (await s3.send(new ListObjectsV2Command({ Bucket: env.R2_BUCKET_NAME, Prefix: `music/${ARTIST_SLUG}/` }))).KeyCount;
  check('temizlik: şarkı, sanatçı, R2 dosyası ve hesap kalmadı', !songsLeft && !artistsLeft && !usersLeft && !filesLeft && !problems.length, problems.join('; ') || `şarkı ${songsLeft}, sanatçı ${artistsLeft}, hesap ${usersLeft}, dosya ${filesLeft}`);

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} kontrol geçti.`);
  process.exitCode = failed ? 1 : 0;
}
