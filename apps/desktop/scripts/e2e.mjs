// Masaüstü uygulamasının uçtan uca testi: derlenmiş uygulama (out/) gerçek Electron'da, gerçek veritabanıyla.
// Geçici iki hesap (@bekofy.test) açılır; uygulama ayrı bir veri klasörüyle çalışır (gerçek oturum ve indirmelere
// dokunmaz). Sonunda hesaplar ve oluşturdukları her şey silinir, silindiği ayrıca doğrulanır.
// Kullanım: npm run build -w @bekofy/desktop && node apps/desktop/scripts/e2e.mjs

import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { _electron as electron } from 'playwright';
import { runAxe, stateChecks, textContrast } from '../../../packages/ui/scripts/a11y.mjs';

const APP = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]+$/, '');
const ROOT = join(APP, '../..');
const env = Object.fromEntries(readFileSync(join(ROOT, '.env'), 'utf8').split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
const SUPABASE_URL = readFileSync(join(ROOT, 'packages/core/src/config.ts'), 'utf8').match(/SUPABASE_URL = '([^']+)'/)[1];
const sb = createClient(SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
if (!existsSync(join(APP, 'out/main/index.js'))) throw new Error('Önce derle: npm run build -w @bekofy/desktop');

const tag = randomBytes(3).toString('hex');
const pw = () => `${randomBytes(12).toString('base64url')}9a`;
const USERS = [
  { email: `e2e-d1-${tag}@bekofy.test`, password: pw(), username: `e2e_d1_${tag}`, id: '' },
  { email: `e2e-d2-${tag}@bekofy.test`, password: pw(), username: `e2e_d2_${tag}`, id: '' },
];
const userData = mkdtempSync(join(tmpdir(), 'bekofy-desktop-e2e-'));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ ok: Boolean(ok) });
  console.log(`${ok ? 'OK  ' : 'HATA'} ${name}${ok || !detail ? '' : ` -> ${detail}`}`);
};
let win;
const step = async (name, fn) => {
  try {
    await fn();
  } catch (e) {
    const shot = join(tmpdir(), `bekofy-desktop-${Date.now()}.png`);
    await win?.screenshot({ path: shot }).catch(() => undefined);
    check(name, false, `${e.message.split('\n')[0]} (görüntü: ${shot})`);
  }
};
const toast = (text, timeout = 15000) => win.locator('[role="status"]').filter({ hasText: text }).first().waitFor({ timeout });
const go = async (hash) => {
  await win.evaluate((h) => (window.location.hash = h), hash);
  await win.waitForTimeout(600);
};
const audit = async (name) => {
  await win.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
  await win.waitForTimeout(200);
  // BEKOFY_SHOTS=<klasör> verilirse her denetlenen ekranın görüntüsü kaydedilir (gözle kontrol için).
  if (process.env.BEKOFY_SHOTS) await win.screenshot({ path: join(process.env.BEKOFY_SHOTS, `${name.replace(/[^\p{L}\d]+/gu, '-')}.png`) });
  const issues =[...(await runAxe(win)), ...(await win.evaluate(textContrast)).map((f) => `kontrast ${f}`), ...(await stateChecks(win))];
  check(`erişilebilirlik: ${name}`, !issues.length, issues.slice(0, 6).join(' | '));
};

const song = (await sb.from('songs').select('id, title, artist, album, duration').eq('status', 'approved').not('cover_url', 'is', null).order('created_at').limit(1).single()).data;
const artist = (await sb.from('song_artists').select('artist_id').eq('song_id', song.id).limit(1).maybeSingle()).data;

let app;
const errors = [];
try {
  for (const u of USERS) {
    const r = await sb.auth.admin.createUser({ email: u.email, password: u.password, email_confirm: true });
    if (r.error) throw new Error(r.error.message);
    u.id = r.data.user.id;
    const p = await sb.from('profiles').insert({ id: u.id, username: u.username });
    if (p.error) throw new Error(p.error.message);
  }

  app = await electron.launch({ executablePath: join(APP, 'node_modules/electron/dist/electron.exe'), args: [APP], env: { ...process.env, BEKOFY_USER_DATA: userData } });
  win = await app.firstWindow();
  win.on('pageerror', (e) => errors.push(e.message));
  await win.waitForSelector('h1');

  for (const theme of ['dark', 'light']) {
    await win.evaluate((t) => localStorage.setItem('bekofy-settings', JSON.stringify({ theme: t, coverColor: true, discord: true })), theme);
    await win.reload();
    await win.waitForSelector('h1');
    await step(`giriş ekranı (${theme})`, () => audit(`giriş ekranı ${theme}`));
  }
  await win.evaluate(() => localStorage.setItem('bekofy-settings', JSON.stringify({ theme: 'dark', coverColor: true, discord: true })));
  await win.reload();

  await step('giriş', async () => {
    await win.fill('#login-email', USERS[0].email);
    await win.fill('#login-password', USERS[0].password);
    await win.click('form button[type="submit"]');
    await win.getByRole('navigation', { name: 'Ana menü' }).waitFor({ timeout: 20000 });
    const logs = await sb.from('user_access_logs').select('platform, app_version').eq('user_id', USERS[0].id);
    check('giriş: uygulama açıldı, giriş kaydı "desktop" ve sürümle yazıldı', logs.data?.some((l) => l.platform === 'desktop' && l.app_version === '2.0.0'), JSON.stringify(logs.data));
  });

  await step('arama ve çalma', async () => {
    await win.fill('#top-search', song.title.slice(0, 12));
    await win.getByRole('heading', { name: 'Şarkılar' }).waitFor({ timeout: 15000 });
    await win.getByRole('button', { name: `Çal: ${song.title}` }).first().click();
    await win.getByRole('button', { name: `Duraklat: ${song.title}` }).first().waitFor({ timeout: 15000 });
    await win.waitForTimeout(3500);
    const pos = await win.getByRole('slider', { name: 'Şarkıda konum' }).inputValue();
    check('çalma: şarkı çalıyor ve ilerliyor', Number(pos) >= 1, `konum ${pos}`);
    const vol = await win.getByRole('slider', { name: 'Ses düzeyi' }).evaluate((el) => ({
      value: el.value,
      fill: el.style.getPropertyValue('--val'),
      saved: localStorage.getItem('bekofy-volume'),
      mute: document.querySelector('[aria-label="Sesi aç"], [aria-label="Sesi kapat"]')?.getAttribute('aria-label'),
      sliders: document.querySelectorAll('input[aria-label="Ses düzeyi"]').length,
    }));
    check('ses düzeyi çubuğu değeri ve dolgusu doğru (%80)', vol.value === '80' && vol.fill === '80%', JSON.stringify(vol));
  });

  await step('beğenme', async () => {
    await win.getByRole('region', { name: 'Oynatıcı' }).getByRole('button', { name: `Beğen: ${song.title}` }).click();
    await toast('beğenilenlere eklendi');
    const liked = await sb.from('liked_songs').select('song_id').eq('user_id', USERS[0].id).eq('song_id', song.id);
    check('beğenme: veritabanına yazıldı', liked.data?.length === 1);
  });

  let playlistId = '';
  await step('çalma listesi', async () => {
    await win.getByRole('button', { name: 'Yeni çalma listesi' }).click();
    await win.getByLabel('Liste adı').fill(`E2E Liste ${tag}`);
    await win.getByRole('button', { name: 'Oluştur' }).click();
    await win.waitForFunction(() => location.hash.startsWith('#/playlist/'), null, { timeout: 15000 });
    playlistId = decodeURIComponent((await win.evaluate(() => location.hash)).split('/')[2]);
    const pl = await sb.from('playlists').select('name, user_id').eq('id', playlistId).single();
    check('liste oluşturuldu ve sayfası açıldı', pl.data?.user_id === USERS[0].id && pl.data.name === `E2E Liste ${tag}`);

    await go(`#/search?q=${encodeURIComponent(song.title.slice(0, 12))}`);
    await win.getByRole('button', { name: `Diğer seçenekler: ${song.title}` }).first().click();
    await win.getByRole('button', { name: 'Çalma listesine ekle' }).click();
    await win.getByRole('button', { name: `E2E Liste ${tag}` }).click();
    await toast('listesine eklendi');
    const rows = await sb.from('playlist_songs').select('song_id').eq('playlist_id', playlistId);
    check('şarkı menüden listeye eklendi', rows.data?.length === 1 && rows.data[0].song_id === song.id);

    await go(`#/playlist/${playlistId}`);
    await win.getByRole('list', { name: `E2E Liste ${tag} şarkıları` }).waitFor();
    await step('liste sayfası', () => audit('çalma listesi'));
    await win.getByRole('button', { name: `Diğer seçenekler: ${song.title}` }).first().click();
    await win.getByRole('button', { name: 'Bu listeden çıkar' }).click();
    await toast('listeden çıkarıldı');
    const after = await sb.from('playlist_songs').select('song_id').eq('playlist_id', playlistId);
    check('şarkı listeden çıkarıldı', after.data?.length === 0);
  });

  await step('indirme ve diskten çalma', async () => {
    await go(`#/search?q=${encodeURIComponent(song.title.slice(0, 12))}`);
    await win.getByRole('button', { name: `Diğer seçenekler: ${song.title}` }).first().click();
    await win.getByRole('button', { name: 'İndir' }).click();
    await toast('indirildi', 60000);
    const file = join(userData, 'offline-songs', `${song.id}.mp3`);
    // Oynatıcının yolu: ses öğesi bekofy-media:// adresini yükler (fetch, içerik güvenlik politikasında kapalı).
    const probe = (src) =>
      win.evaluate(
        (s) =>
          new Promise((resolve) => {
            const a = new Audio();
            a.onloadedmetadata = () => resolve({ ok: true, duration: Math.round(a.duration) });
            a.onerror = () => resolve({ ok: false });
            a.src = s;
          }),
        src,
      );
    const res = await probe(`bekofy-media://song/${song.id}`);
    const blocked = await probe('bekofy-media://song/..%2F..%2Fsecret');
    check('indirme: dosya diskte, ses öğesi bekofy-media ile çalabiliyor, başka yola erişilemiyor', existsSync(file) && res.ok && res.duration > 0 && !blocked.ok, JSON.stringify({ res, blocked }));
    await go('#/library/downloads');
    await win.getByRole('list', { name: 'İndirilen şarkılar' }).waitFor();
    check('kitaplıkta indirilenler listesinde görünüyor', await win.getByRole('list', { name: 'İndirilen şarkılar' }).getByText(song.title).first().isVisible());
  });

  await step('mini oynatıcı', async () => {
    const [mini] = await Promise.all([app.waitForEvent('window', { timeout: 15000 }), win.getByRole('button', { name: 'Mini oynatıcı' }).click()]);
    await mini.waitForLoadState('domcontentloaded');
    await mini.getByText(song.title).first().waitFor({ timeout: 10000 });
    check('mini oynatıcı açıldı ve çalan şarkıyı gösteriyor', true);
    await mini.getByRole('button', { name: 'Mini oynatıcıyı kapat' }).click();
    await win.waitForTimeout(500);
    check('mini oynatıcı kapandı', (await app.windows()).length === 1);
  });

  await step('şimdi çalıyor', async () => {
    await win.getByRole('button', { name: 'Şimdi çalıyor ekranı', exact: true }).click();
    const dialog = win.getByRole('dialog', { name: 'Şimdi çalıyor' });
    await dialog.waitFor();
    await win.waitForTimeout(1500);
    await step('şimdi çalıyor ekranı', () => audit('şimdi çalıyor'));
    await win.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    check('şimdi çalıyor açılıp Escape ile kapandı', true);
  });

  await step('wrapped', async () => {
    await go('#/');
    await win.getByRole('button', { name: 'Yılının özeti' }).click();
    const d = win.getByRole('dialog', { name: /özetin/ });
    await d.waitFor();
    await win.waitForTimeout(1500);
    await step('wrapped ekranı', () => audit('wrapped'));
    await win.keyboard.press('Escape');
    await d.waitFor({ state: 'detached' });
    check('wrapped açılıp kapandı', true);
  });

  await step('jam', async () => {
    await go('#/jam');
    await win.getByRole('button', { name: 'Jam başlat' }).first().click();
    await win.getByRole('heading', { name: 'Jam’in açık' }).waitFor({ timeout: 15000 });
    const s = await sb.from('jam_sessions').select('id, code').eq('host_id', USERS[0].id);
    check('jam başladı, kod gösteriliyor', s.data?.length === 1 && (await win.getByText(`${s.data[0].code.slice(0, 3)}-${s.data[0].code.slice(3)}`).isVisible()));
    await step('jam ekranı', () => audit('jam'));
    await win.getByRole('button', { name: "Jam'i bitir" }).click();
    await win.getByRole('dialog').getByRole('button', { name: "Jam'i bitir" }).click();
    await win.getByRole('button', { name: 'Jam başlat' }).first().waitFor();
    const left = await sb.from('jam_sessions').select('id').eq('host_id', USERS[0].id);
    check('jam bitirildi, oturum silindi', left.data?.length === 0);
  });

  for (const [name, hash] of [
    ['ana sayfa', '#/'],
    ['arama', `#/search?q=${encodeURIComponent(song.title.slice(0, 12))}`],
    ['kitaplık', '#/library'],
    ['beğenilenler', '#/liked'],
    ['sanatçı', artist ? `#/artist/${artist.artist_id}` : '#/'],
    ['albüm', song.album ? `#/album/${encodeURIComponent(song.artist)}/${encodeURIComponent(song.album)}` : '#/'],
    ['profil', `#/profile/${USERS[0].id}`],
    ['ayarlar', '#/settings'],
  ]) {
    for (const theme of ['dark', 'light']) {
      await step(`${name} (${theme})`, async () => {
        await win.evaluate((t) => {
          const s = JSON.parse(localStorage.getItem('bekofy-settings') ?? '{}');
          localStorage.setItem('bekofy-settings', JSON.stringify({ ...s, theme: t }));
        }, theme);
        await win.reload();
        await win.getByRole('navigation', { name: 'Ana menü' }).waitFor({ timeout: 20000 });
        await go(hash);
        await win.waitForTimeout(1200);
        await audit(`${name} ${theme}`);
      });
    }
  }

  await step('tema ayarı', async () => {
    await go('#/settings');
    await win.getByText('Açık', { exact: true }).click();
    const light = await win.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await win.getByText('Koyu', { exact: true }).click();
    const dark = await win.evaluate(() => document.documentElement.getAttribute('data-theme'));
    check('tema ayarı anında uygulanıyor', light === 'light' && dark === null, `${light} ${dark}`);
  });

  await step('dar pencere', async () => {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(940, 620));
    await win.waitForTimeout(500);
    const over = await win.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('en dar pencerede (940x620) yatay taşma yok', over <= 1, `${over}px`);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1400, 900));
  });

  await step('hesap ekleme ve geçiş', async () => {
    await win.getByRole('button', { name: /Hesap menüsü/ }).click();
    await win.locator('#account-menu').getByRole('button', { name: 'Hesap ekle' }).click();
    await win.getByRole('heading', { name: 'Hesap ekle' }).waitFor();
    await win.fill('#login-email', USERS[1].email);
    await win.fill('#login-password', USERS[1].password);
    await win.click('form button[type="submit"]');
    await win.getByRole('navigation', { name: 'Ana menü' }).waitFor({ timeout: 20000 });
    await go('#/settings');
    const both = (await win.getByText(`@${USERS[0].username}`).count()) > 0 && (await win.getByText(`@${USERS[1].username}`).count()) > 0;
    check('ikinci hesap eklendi, ikisi de listede', both);
    await go(`#/profile/${USERS[0].id}`);
    await win.getByRole('button', { name: 'Takip et' }).click();
    await win.getByRole('button', { name: 'Takip ediliyor' }).waitFor();
    const f = await sb.from('follows').select('follower_id').eq('follower_id', USERS[1].id).eq('following_id', USERS[0].id);
    check('takip etme veritabanına yazıldı', f.data?.length === 1);
    await go('#/settings');
    await win.getByRole('button', { name: 'Bu hesaba geç' }).click();
    await win.getByRole('navigation', { name: 'Ana menü' }).waitFor({ timeout: 20000 });
    const label = await win.getByRole('button', { name: /Hesap menüsü/ }).getAttribute('aria-label');
    check('hesaplar arası geçiş: oturum yeniden açılmadan ilk hesaba dönüldü', label?.includes(USERS[0].username), label);
  });

  check('uygulamada JS hatası yok', !errors.length, [...new Set(errors)].slice(0, 3).join(' | '));
} catch (e) {
  check('test akışı', false, e.message.split('\n')[0]);
} finally {
  await app?.close().catch(() => undefined);
  const ids = USERS.map((u) => u.id).filter(Boolean);
  if (ids.length) {
    await sb.from('jam_sessions').delete().in('host_id', ids);
    await sb.from('playlists').delete().in('user_id', ids);
    await sb.from('liked_songs').delete().in('user_id', ids);
    await sb.from('follows').delete().in('follower_id', ids);
    await sb.from('listening_history').delete().in('user_id', ids);
    await sb.from('user_access_logs').delete().in('user_id', ids);
    await sb.from('profiles').delete().in('id', ids);
    for (const id of ids) await sb.auth.admin.deleteUser(id);
  }
  rmSync(userData, { recursive: true, force: true });
  const usersLeft = ((await sb.auth.admin.listUsers({ perPage: 1000 })).data?.users ?? []).filter((u) => u.email?.includes(tag)).length;
  const listsLeft = (await sb.from('playlists').select('id', { count: 'exact', head: true }).ilike('name', `%${tag}%`)).count;
  check('temizlik: hesaplar, listeler ve uygulama verisi silindi', !usersLeft && !listsLeft && !existsSync(userData), `hesap ${usersLeft}, liste ${listsLeft}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} kontrol geçti.`);
  process.exitCode = failed ? 1 : 0;
}
