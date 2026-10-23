// Mobil uygulamanın uçtan uca testi: emülatöre kurulu sürüm (com.bekofy.app), gerçek veritabanıyla.
// Ekran uiautomator ile okunur, dokunma ve yazma adb ile yapılır; arka plan çalma ve kilit ekranı denetimleri
// Android'in medya oturumu üzerinden denetlenir. Geçici iki hesap (@bekofy.test) açılır, sonunda hesaplar ve
// oluşturdukları her şey silinir, silindiği ayrıca doğrulanır. Uygulama verisi (oturum, indirmeler) de silinir.
// Kullanım: emülatör açıkken ve APK kuruluyken  node apps/mobile/scripts/e2e.mjs
// BEKOFY_SHOTS=<klasör> verilirse denetlenen her ekranın görüntüsü kaydedilir (gözle kontrol için).

import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const PKG = 'com.bekofy.app';
const SDK = process.env.ANDROID_HOME ?? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk');
const ADB = join(SDK, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
const env = Object.fromEntries(readFileSync(join(ROOT, '.env'), 'utf8').split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
const config = readFileSync(join(ROOT, 'packages/core/src/config.ts'), 'utf8');
const SUPABASE_URL = config.match(/SUPABASE_URL = '([^']+)'/)[1];
const ANON = config.match(/SUPABASE_ANON_KEY = '([^']+)'/)[1];
const admin = createClient(SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const tag = randomBytes(3).toString('hex');
// adb "input text" özel karakterleri bozar: parola yalnızca harf ve rakam.
const pw = () => `${randomBytes(12).toString('hex')}Aa9`;
const USERS = [
  { email: `e2e-m1-${tag}@bekofy.test`, password: pw(), username: `e2e_m1_${tag}`, id: '' },
  { email: `e2e-m2-${tag}@bekofy.test`, password: pw(), username: `e2e_m2_${tag}`, id: '' },
];
const LIST = `E2E liste ${tag}`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ ok: Boolean(ok) });
  console.log(`${ok ? 'OK  ' : 'HATA'} ${name}${ok || !detail ? '' : ` -> ${detail}`}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const adb = (...args) => execFileSync(ADB, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const shell = (...args) => adb('shell', ...args);

/* ---------- Ekranı okuma ---------- */
const unescapeXml = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#10;/g, '\n').replace(/&amp;/g, '&');

function parse(xml) {
  const root = { attrs: {}, children: [], parent: null };
  const stack = [root];
  const all = [];
  for (const m of xml.matchAll(/<node\b([^>]*?)(\/?)>|<\/node>/g)) {
    if (m[0] === '</node>') {
      stack.pop();
      continue;
    }
    const attrs = Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => [a[1], unescapeXml(a[2])]));
    const b = attrs.bounds?.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/)?.slice(1).map(Number) ?? [0, 0, 0, 0];
    const node = { attrs, children: [], parent: stack.at(-1), text: attrs.text ?? '', desc: attrs['content-desc'] ?? '', bounds: b, clickable: attrs.clickable === 'true', selected: attrs.selected === 'true', checked: attrs.checked === 'true', cls: attrs.class ?? '' };
    stack.at(-1).children.push(node);
    all.push(node);
    if (!m[2]) stack.push(node);
  }
  return all;
}

function dump() {
  for (let i = 0; i < 4; i++) {
    try {
      const out = shell('uiautomator', 'dump', '/sdcard/bekofy-ui.xml');
      if (!out.includes('dumped')) throw new Error(out);
      return parse(adb('exec-out', 'cat', '/sdcard/bekofy-ui.xml'));
    } catch {
      // Ekran sürekli güncellenirken (çalan şarkının süresi) boşta durumu beklenemeyebilir; yeniden dene.
    }
  }
  throw new Error('Ekran okunamadı (uiautomator)');
}

const matches = (n, q) => (q instanceof RegExp ? q.test(n.desc) || q.test(n.text) : n.desc === q || n.text === q);
const label = (n) => n.desc || n.text || n.children.map(label).filter(Boolean).join(' ');

async function waitFor(q, { timeout = 15000, gone = false } = {}) {
  const end = Date.now() + timeout;
  let nodes = [];
  while (Date.now() < end) {
    nodes = dump();
    const hit = nodes.find((n) => matches(n, q) && n.bounds[2] > n.bounds[0]);
    if (gone ? !hit : hit) return hit ?? true;
    await sleep(500);
  }
  throw new Error(`${gone ? 'kaybolmadı' : 'bulunamadı'}: ${q}`);
}

function center(n) {
  const [x1, y1, x2, y2] = n.bounds;
  return [Math.round((x1 + x2) / 2), Math.round((y1 + y2) / 2)];
}

async function tap(q, opts) {
  const n = typeof q === 'object' && !(q instanceof RegExp) ? q : await waitFor(q, opts);
  const [x, y] = center(n);
  shell('input', 'tap', String(x), String(y));
  await sleep(700);
}

/** Görünene kadar aşağı kaydır. */
async function scrollTo(q, max = 8) {
  const { w, h } = screen();
  for (let i = 0; i < max; i++) {
    const hit = dump().find((n) => matches(n, q) && n.bounds[3] < h * 0.85 && n.bounds[1] > h * 0.08);
    if (hit) return hit;
    shell('input', 'swipe', String(w / 2), String(h * 0.7), String(w / 2), String(h * 0.3), '300');
    await sleep(600);
  }
  throw new Error(`kaydırınca bulunamadı: ${q}`);
}

async function type(text) {
  shell('input', 'text', text.replace(/ /g, '%s'));
  await sleep(300);
}

let size;
function screen() {
  if (!size) {
    const [w, h] = shell('wm', 'size').match(/(\d+)x(\d+)/).slice(1).map(Number);
    const density = Number(shell('wm', 'density').match(/(\d+)\s*$/m)[1]) / 160;
    size = { w, h, density };
  }
  return size;
}

/** Android medya oturumu: çalıyor mu, ne çalıyor (bildirim ve kilit ekranı bunu gösterir). */
function media() {
  const out = shell('dumpsys', 'media_session');
  const start = out.indexOf(`package=${PKG}`);
  if (start < 0) return { exists: false };
  const block = out.slice(start, start + 4000);
  const state = block.match(/state=PlaybackState \{state=(\w+)(?:\((\d+)\))?, position=(-?\d+)/);
  return {
    exists: true,
    active: /active=true/.test(block),
    playing: state ? state[1] === 'PLAYING' || state[1] === '3' || state[2] === '3' : false,
    position: state ? Number(state[3]) : 0,
    description: block.match(/description=([^\n]+)/)?.[1]?.trim() ?? '',
  };
}

/* ---------- Erişilebilirlik ---------- */
/** Dokunulabilir her öğenin bir adı olmalı (TalkBack okur) ve en az 44dp olmalı. */
function a11y(nodes) {
  const { density } = screen();
  const issues = [];
  for (const n of nodes) {
    if (!n.clickable || n.attrs.package !== PKG) continue;
    const name = label(n);
    const [x1, y1, x2, y2] = n.bounds;
    const w = (x2 - x1) / density;
    const h = (y2 - y1) / density;
    if (!name.trim()) issues.push(`adsız dokunulabilir öğe [${n.attrs.bounds}]`);
    // Ekran kenarında kırpılan (kaydırılan) öğeler ölçülmez.
    const clipped = x1 <= 0 || x2 >= screen().w || y1 <= 0 || y2 >= screen().h;
    if (!clipped && (w < 44 || h < 44)) issues.push(`küçük hedef ${Math.round(w)}x${Math.round(h)}dp: ${name.slice(0, 40)}`);
  }
  return issues;
}

async function audit(name) {
  await sleep(500);
  const nodes = dump();
  if (process.env.BEKOFY_SHOTS) writeFileSync(join(process.env.BEKOFY_SHOTS, `${name.replace(/[^\p{L}\d]+/gu, '-')}.png`), execFileSync(ADB, ['exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 }));
  const issues = a11y(nodes);
  check(`erişilebilirlik: ${name}`, !issues.length, [...new Set(issues)].slice(0, 6).join(' | '));
}

const step = async (name, fn) => {
  try {
    await fn();
  } catch (e) {
    check(name, false, e.message.split('\n')[0]);
  }
};

const launch = async () => {
  shell('monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1');
  await sleep(1500);
};
const back = async () => {
  shell('input', 'keyevent', 'KEYCODE_BACK');
  await sleep(700);
};
const settled = async (fn, timeout = 15000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await fn()) return true;
    await sleep(700);
  }
  return false;
};

/* ---------- Veri ---------- */
const songs = (await admin.from('songs').select('id, title, artist, album, duration').eq('status', 'approved').order('created_at', { ascending: false }).limit(3)).data ?? [];
if (songs.length < 3) throw new Error('En az üç yayında şarkı gerekli');
const [first, second, third] = songs;
// Aramada kullanılacak terim: Türkçe karakter içermeyen ilk kelime (adb yalnızca ASCII yazar).
const searchWord = (first.title.match(/[A-Za-z0-9]{3,}/) ?? first.artist.match(/[A-Za-z0-9]{3,}/))?.[0];

const ANIM_KEYS = ['window_animation_scale', 'transition_animation_scale', 'animator_duration_scale'];
const animScales = {};

let host;
try {
  for (const u of USERS) {
    const r = await admin.auth.admin.createUser({ email: u.email, password: u.password, email_confirm: true });
    if (r.error) throw new Error(r.error.message);
    u.id = r.data.user.id;
    const p = await admin.from('profiles').insert({ id: u.id, username: u.username });
    if (p.error) throw new Error(p.error.message);
  }
  const [me, friend] = USERS;

  // Android testlerinde olağan: sistem animasyonları kapatılır (uiautomator ekranı ancak durgunken okur). Uygulama bunu
  // "animasyonları azalt" olarak algılar ve sürekli oynayan göstergeleri durdurur. Sonda eski değerler geri yüklenir.
  for (const k of ANIM_KEYS) animScales[k] = shell('settings', 'get', 'global', k).trim();
  for (const k of ANIM_KEYS) shell('settings', 'put', 'global', k, '0');
  shell('pm', 'clear', PKG);
  shell('logcat', '-c');
  await launch();

  await step('giriş ekranı açıldı', async () => {
    await waitFor('Giriş yap', { timeout: 90000 });
    check('giriş ekranı açıldı', true);
    await audit('giriş');
  });

  await step('boş giriş: alan hataları gösterildi', async () => {
    await tap(dump().filter((n) => n.desc === 'Giriş yap' && n.clickable).at(-1));
    await waitFor('E-posta gerekli.');
    check('boş giriş: alan hataları gösterildi', dump().some((n) => n.text === 'Şifre gerekli.'));
  });

  await step('e-posta ve şifreyle giriş', async () => {
    await tap(dump().find((n) => n.desc === 'E-posta' && n.cls.includes('EditText')));
    await type(me.email);
    await tap(dump().find((n) => n.desc === 'Şifre' && n.cls.includes('EditText')));
    await type(me.password);
    shell('input', 'keyevent', 'KEYCODE_ENTER');
    await waitFor(new RegExp(me.username), { timeout: 30000 });
    check('e-posta ve şifreyle giriş', true);
    await audit('ana sayfa (koyu)');
  });

  await step('şarkı çalındı, mini oynatıcı ve medya oturumu', async () => {
    await scrollTo(`Çal: ${first.title}`);
    await tap(`Çal: ${first.title}`);
    await waitFor(`Şimdi çalıyor: ${first.title}, ${first.artist}`, { timeout: 20000 });
    const ok = await settled(() => {
      const m = media();
      return m.playing && m.description.includes(first.title);
    }, 20000);
    check('şarkı çalındı, mini oynatıcı ve medya oturumu', ok, JSON.stringify(media()));
  });

  await step('arka planda çalmaya devam ediyor', async () => {
    shell('input', 'keyevent', 'KEYCODE_HOME');
    const before = media().position;
    await sleep(6000);
    const m = media();
    check('arka planda çalmaya devam ediyor', m.playing && m.position > before + 3000, JSON.stringify({ before, ...m }));
  });

  await step('bildirim/kilit ekranından sonraki şarkı', async () => {
    shell('cmd', 'media_session', 'dispatch', 'next');
    const ok = await settled(() => media().description.includes(second.title), 15000);
    await launch();
    await waitFor(`Şimdi çalıyor: ${second.title}, ${second.artist}`, { timeout: 15000 });
    check('bildirim/kilit ekranından sonraki şarkı', ok, media().description);
  });

  await step('bildirimden duraklat ve sürdür', async () => {
    shell('cmd', 'media_session', 'dispatch', 'pause');
    const paused = await settled(() => !media().playing, 10000);
    await waitFor(`Çal: ${second.title}`);
    shell('cmd', 'media_session', 'dispatch', 'play');
    const playing = await settled(() => media().playing, 10000);
    check('bildirimden duraklat ve sürdür', paused && playing);
  });

  // Bu ekranda süre sayacı her saniye değişir; uiautomator ekranı ancak duraklatılmışken okuyabilir.
  await step('şimdi çalıyor: sözler ve sıradaki', async () => {
    shell('cmd', 'media_session', 'dispatch', 'pause');
    await settled(() => !media().playing, 8000);
    await tap(`Şimdi çalıyor: ${second.title}, ${second.artist}`);
    await waitFor('Sözler');
    await audit('şimdi çalıyor');
    await tap('Sıradaki');
    await waitFor(new RegExp(`^${third.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, `));
    check('şimdi çalıyor: sözler ve sıradaki', true);
    await tap(`Çal: ${second.title}`);
    check('şimdi çalıyor: çal düğmesi çalmayı sürdürdü', await settled(() => media().playing, 8000));
    shell('cmd', 'media_session', 'dispatch', 'pause');
    await settled(() => !media().playing, 8000);
    await tap('Kapat');
    await waitFor('Ana sayfa');
  });

  await step('beğen: veritabanına yazıldı', async () => {
    await scrollTo(new RegExp(`^Beğen: ${second.title}`));
    await tap(new RegExp(`^Beğen: ${second.title}`));
    await waitFor(`${second.title} beğenilenlere eklendi`);
    const row = await admin.from('liked_songs').select('song_id').eq('user_id', me.id).eq('song_id', second.id).maybeSingle();
    check('beğen: veritabanına yazıldı', Boolean(row.data));
  });

  await step('arama: sonuçlar ve seçenekler', async () => {
    await tap('Ara');
    await tap(dump().find((n) => n.cls.includes('EditText')));
    await type(searchWord);
    await waitFor(new RegExp(`^Diğer seçenekler: `), { timeout: 20000 });
    await audit('arama');
    check('arama: sonuçlar ve seçenekler', true);
  });

  await step('indirme Premium değilken kapalı', async () => {
    await tap(dump().find((n) => /^Diğer seçenekler: /.test(n.desc)));
    await tap('İndir (Premium)');
    await waitFor(/Premium'a özel/);
    check('indirme Premium değilken kapalı', true);
  });

  await step('Oluştur menüsü: yeni liste oluşturuldu', async () => {
    await tap('Kitaplık');
    await audit('kitaplık');
    await tap('Oluştur');
    await waitFor(/^Çalma listesi. /);
    await audit('oluştur menüsü');
    await tap(/^Çalma listesi. /);
    await tap(dump().find((n) => n.desc === 'Liste adı' && n.cls.includes('EditText')));
    await type(LIST);
    await tap(dump().filter((n) => n.desc === 'Oluştur').at(-1));
    await waitFor(LIST);
    const row = await admin.from('playlists').select('id').eq('user_id', me.id).eq('name', LIST).maybeSingle();
    check('Oluştur menüsü: yeni liste oluşturuldu', Boolean(row.data));
    await audit('çalma listesi (boş)');
    await back();
  });

  /** Satırı yatay çeker: dir 1 sağa, -1 sola. */
  const swipeRow = (row, dir) => {
    const [x1, y1, x2, y2] = row.bounds;
    const y = Math.round((y1 + y2) / 2);
    const from = dir > 0 ? x1 + 40 : x2 - 160;
    shell('input', 'swipe', String(from), String(y), String(from + dir * 420), String(y), '350');
  };
  const songRow = () => dump().find((n) => n.clickable && n.desc.startsWith(`${first.title}, `));

  await step('satırı sağa çekince sıradaki olarak eklendi', async () => {
    await tap('Ara');
    await waitFor(/^Diğer seçenekler: /, { timeout: 20000 });
    swipeRow(songRow(), 1);
    await waitFor(`${first.title} sıradaki olarak eklendi`);
    check('satırı sağa çekince sıradaki olarak eklendi', true);
  });

  await step('satırı sola çekince listeye ekleme açıldı ve eklendi', async () => {
    await waitFor(new RegExp(`^${first.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, `));
    swipeRow(songRow(), -1);
    await waitFor('Hangi listeye?');
    await tap(LIST);
    await waitFor(`${LIST} listesine eklendi`);
    const list = (await admin.from('playlists').select('id').eq('name', LIST).single()).data;
    const { count } = await admin.from('playlist_songs').select('song_id', { count: 'exact', head: true }).eq('playlist_id', list.id);
    check('satırı sola çekince listeye ekleme açıldı ve eklendi', count === 1, `satır ${count}`);
  });

  await step('liste düzenleme: açıklama, gizlilik, ortak düzenleyici kaydedildi', async () => {
    await tap('Kitaplık');
    await tap(new RegExp(`^${LIST}, `));
    await tap('Listeyi düzenle');
    await waitFor('Listeyi düzenle');
    await audit('liste düzenleme');
    await tap(dump().find((n) => n.desc === 'Açıklama' && n.cls.includes('EditText')));
    await type('Uctan uca test aciklamasi');
    await tap(dump().find((n) => n.desc === 'Herkese açık' && n.cls.includes('Switch')));
    await tap('Kişi ekle');
    await tap(dump().find((n) => n.desc === 'Kullanıcı adı ara' && n.cls.includes('EditText')));
    await type(friend.username);
    await tap(`Ekle: @${friend.username}`, { timeout: 20000 });
    await waitFor(`@${friend.username} artık bu listeyi düzenleyebilir`);
    await tap(dump().filter((n) => n.desc === 'Kaydet').at(-1));
    await waitFor('Liste kaydedildi', { timeout: 20000 });
    const list = (await admin.from('playlists').select('id, description, is_public').eq('name', LIST).single()).data;
    const collab = await admin.from('playlist_collaborators').select('user_id').eq('playlist_id', list.id).eq('user_id', friend.id);
    check('liste düzenleme: açıklama, gizlilik, ortak düzenleyici kaydedildi', list.description === 'Uctan uca test aciklamasi' && list.is_public && collab.data?.length === 1, JSON.stringify({ ...list, collab: collab.data?.length }));
    await back();
  });

  await step("Jam: koda katılınca oturum sahibinin şarkısı çaldı", async () => {
    host = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    await host.auth.signInWithPassword({ email: friend.email, password: friend.password });
    const code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
    const jam = (await host.from('jam_sessions').insert({ code, host_id: friend.id, current_song_id: third.id, is_playing: true, current_position: 5 }).select('*').single()).data;
    host.jam = jam;
    await tap('Ana sayfa');
    await scrollTo('Jam başlat');
    await tap(dump().filter((n) => n.desc === 'Jam başlat' && n.clickable).at(-1));
    await tap(dump().find((n) => n.desc === 'Jam kodu' && n.cls.includes('EditText')));
    await type(`${code.slice(0, 3)}-${code.slice(3)}`);
    await tap('Katıl');
    await waitFor('Jam’e katıldın', { timeout: 20000 });
    await waitFor(`Şimdi çalıyor: ${third.title}, ${third.artist}`, { timeout: 20000 });
    check("Jam: koda katılınca oturum sahibinin şarkısı çaldı", await settled(() => media().playing, 10000));
    await audit('jam');
  });

  await step('Jam: oturum sahibinin şarkı değişikliği anında geldi', async () => {
    const channel = host.channel(`jam:${host.jam.id}`, { config: { broadcast: { self: false } } });
    await new Promise((resolve, reject) => {
      channel.subscribe((s) => (s === 'SUBSCRIBED' ? resolve() : s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' ? reject(new Error(s)) : undefined));
    });
    await channel.send({ type: 'broadcast', event: 'jam_sync', payload: { type: 'track', songId: first.id, position: 0, isPlaying: true, at: Date.now() } });
    await waitFor(`Şimdi çalıyor: ${first.title}, ${first.artist}`, { timeout: 20000 });
    check('Jam: oturum sahibinin şarkı değişikliği anında geldi', true);
    await host.removeChannel(channel);
    await tap("Jam'den ayrıl");
    await tap(dump().filter((n) => /^AYRIL$|^Ayrıl$/.test(n.text)).at(-1));
    await waitFor('Koda katıl');
    const left = await admin.from('jam_participants').select('user_id').eq('session_id', host.jam.id).eq('user_id', me.id);
    check("Jam: ayrılınca katılımcı kaydı silindi", !left.data?.length, JSON.stringify(left.data));
  });

  await step('Premium: çıkış, yeniden giriş ve indirme', async () => {
    await admin.from('profiles').update({ is_premium: true }).eq('id', me.id);
    await back();
    await tap('Ayarlar');
    await scrollTo('Çıkış yap');
    await tap(dump().filter((n) => n.desc === 'Çıkış yap').at(-1));
    await tap(dump().filter((n) => /^ÇIKIŞ YAP$|^Çıkış yap$/.test(n.text) && n.cls.includes('Button')).at(-1));
    await waitFor('Giriş yap', { timeout: 20000 });
    check('çıkış yapınca oynatıcı durdu', await settled(() => !media().playing, 8000));
    await tap(dump().find((n) => n.desc === 'E-posta' && n.cls.includes('EditText')));
    await type(me.email);
    await tap(dump().find((n) => n.desc === 'Şifre' && n.cls.includes('EditText')));
    await type(me.password);
    shell('input', 'keyevent', 'KEYCODE_ENTER');
    await waitFor(new RegExp(me.username), { timeout: 30000 });
    await tap('Ara');
    await tap(dump().find((n) => n.cls.includes('EditText')));
    await type(searchWord);
    const opt = await waitFor(/^Diğer seçenekler: /, { timeout: 20000 });
    const title = opt.desc.replace('Diğer seçenekler: ', '');
    await tap(opt);
    await tap('İndir');
    await waitFor(`${title} indirildi; internetsiz de çalar`, { timeout: 60000 });
    await tap('Kitaplık');
    await tap('İndirilenler');
    await waitFor(new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, .*indirildi`));
    check('Premium: çıkış, yeniden giriş ve indirme', true);
    await audit('indirilenler');
  });

  await step('açık tema', async () => {
    await tap('Ana sayfa');
    await tap('Ayarlar');
    await tap('Açık');
    check('açık tema seçildi', dump().find((n) => n.desc === 'Açık')?.checked);
    await audit('ayarlar (açık)');
    await back();
    await audit('ana sayfa (açık)');
    await tap('Ayarlar');
    await tap('Koyu');
    await back();
  });

  await step('profil ve yıl özeti', async () => {
    await tap('Profilin');
    await waitFor(`@${me.username}`);
    await audit('profil');
    await back();
    await scrollTo('Yılının özeti');
    await tap('Yılının özeti');
    await waitFor(`Bekofy ${new Date().getFullYear()}`, { timeout: 20000 });
    await audit('yıl özeti');
    await tap('Kapat');
    await waitFor('Ana sayfa');
    check('profil ve yıl özeti açılıp kapandı', true);
  });

  const errors = adb('logcat', '-d', '-s', 'ReactNativeJS:E', 'AndroidRuntime:E').split('\n').filter((l) => / E /.test(l));
  check('uygulamada JS ya da çökme hatası yok', !errors.length, errors.slice(0, 3).join(' | '));
} catch (e) {
  check('test akışı', false, e.message.split('\n')[0]);
} finally {
  try {
    for (const k of ANIM_KEYS) if (animScales[k]) shell('settings', 'put', 'global', k, animScales[k] === 'null' ? '1' : animScales[k]);
    shell('pm', 'clear', PKG);
  } catch {
    // Emülatör kapanmışsa uygulama verisi zaten erişilemez.
  }
  await host?.auth.signOut().catch(() => undefined);
  const ids = USERS.map((u) => u.id).filter(Boolean);
  if (ids.length) {
    await admin.from('jam_sessions').delete().in('host_id', ids);
    await admin.from('playlist_collaborators').delete().in('user_id', ids);
    await admin.from('playlists').delete().in('user_id', ids);
    await admin.from('liked_songs').delete().in('user_id', ids);
    await admin.from('follows').delete().in('follower_id', ids);
    await admin.from('listening_history').delete().in('user_id', ids);
    await admin.from('user_access_logs').delete().in('user_id', ids);
    await admin.from('profiles').delete().in('id', ids);
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  }
  const usersLeft = ((await admin.auth.admin.listUsers({ perPage: 1000 })).data?.users ?? []).filter((u) => u.email?.includes(tag)).length;
  const listsLeft = (await admin.from('playlists').select('id', { count: 'exact', head: true }).ilike('name', `%${tag}%`)).count;
  check('temizlik: hesaplar, listeler ve uygulama verisi silindi', !usersLeft && !listsLeft, `hesap ${usersLeft}, liste ${listsLeft}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} kontrol geçti.`);
  process.exitCode = failed ? 1 : 0;
}
