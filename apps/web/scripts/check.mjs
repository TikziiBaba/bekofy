// Sitenin sayfalarını çalışan sunucuda denetler: koyu ve açık tema, masaüstü ve mobil genişlik.
// - axe-core (WCAG 2.2 A/AA)
// - görünen her metnin gerçek kontrastı (yarı saydam zeminler birleştirilerek)
// - etkileşimli öğelerin üzerine gelme ve odak durumlarında kontrast, odak halkasının görünmesi
// - 280/320/414 piksel genişlikte yatay taşma
// - tarayıcı JS hataları
// Kullanım: önce "npm run dev -w @bekofy/web" (ya da build + start), sonra:
//   node apps/web/scripts/check.mjs                      (oturumsuz sayfalar)
//   BEKOFY_CHECK_EMAIL=.. BEKOFY_CHECK_PASSWORD=.. node apps/web/scripts/check.mjs --auth   (oturumlu sayfalar da)

import { chromium } from 'playwright';
import { overflowAt, runAxe, stateChecks, textContrast } from '../../../packages/ui/scripts/a11y.mjs';

const BASE = process.env.BEKOFY_CHECK_URL ?? 'http://localhost:3000';
const auth = process.argv.includes('--auth');
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);

const submit = (sel = 'form button[type="submit"]') => async (p) => {
  await p.click(sel);
  await p.waitForTimeout(400);
};

/** [ad, yol, isteğe bağlı etkileşim] */
const PUBLIC = [
  ['tanıtım', '/'],
  ['premium', '/premium'],
  ['giriş', '/login'],
  ['giriş: boş gönderim', '/login', submit()],
  ['giriş: bağlantı hatası', '/login?error=link'],
  ['kayıt', '/register'],
  ['kayıt: boş gönderim', '/register', submit()],
  ['şifremi unuttum', '/forgot-password'],
  ['yeni şifre: oturum yok', '/reset-password'],
  ['404', '/boyle-bir-sayfa-yok'],
];

const AUTHED = [
  ['hesabım', '/account'],
  ['ödeme', '/checkout'],
  ['sanatçı paneli', '/artist'],
  ['admin: genel', '/admin'],
  ['admin: şarkılar', '/admin/songs'],
  ['admin: onay bekleyen', '/admin/songs?status=pending'],
  ['admin: arama sonuç yok', '/admin/songs?q=zzzzzz'],
  ['admin: şarkı düzenle', '/admin/songs', async (p) => { await p.click('a[href^="/admin/songs/"]'); await p.waitForURL(/\/admin\/songs\/[0-9a-f-]{36}/); await p.waitForLoadState('networkidle'); }],
  ['admin: silme onayı', '/admin/songs', async (p) => { await p.click('button:has-text("Sil")'); await p.waitForTimeout(300); }],
  ['admin: youtube', '/admin/import', async (p) => { await p.waitForTimeout(1500); }],
  ['admin: youtube hatalı bağlantı', '/admin/import', async (p) => { await p.waitForTimeout(1500); await p.fill('#yt-url', 'https://example.com/x'); await p.click('form button[type="submit"]'); await p.waitForTimeout(300); }],
  ['admin: kullanıcılar', '/admin/users'],
  ['admin: başvurular', '/admin/artist-requests'],
  ['admin: giriş kayıtları', '/admin/logs'],
];


async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', process.env.BEKOFY_CHECK_EMAIL);
  await page.fill('#password', process.env.BEKOFY_CHECK_PASSWORD);
  await page.click('form button[type="submit"]');
  await page.waitForURL(`${BASE}/account`, { timeout: 20000 });
}

const pick = (list) => list.filter(([name]) => !only || name.includes(only));
// Oturumsuz sayfalar oturumsuz tarayıcıda: oturum açıkken giriş/kayıt sayfaları hesaba yönlendirir.
const groups = [
  { signedIn: false, states: pick(PUBLIC) },
  ...(auth ? [{ signedIn: true, states: pick(AUTHED) }] : []),
].filter((g) => g.states.length);
const states = groups.flatMap((g) => g.states);
const browser = await chromium.launch();
const problems = [];
let checks = 0;
for (const [width, height, label] of [[1440, 900, 'masaüstü'], [390, 844, 'mobil']]) {
  for (const theme of ['dark', 'light']) for (const group of groups) {
    const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', locale: 'tr-TR' });
    await ctx.addInitScript((t) => { try { localStorage.setItem('bekofy-theme', t); } catch { /* yok */ } }, theme);
    const page = await ctx.newPage();
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));
    if (group.signedIn) await login(page);
    let previous = 'giriş';
    for (const [name, path, act] of group.states) {
      const where = `${label} ${theme} | ${name}`;
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
      // Oturumlu sayfa girişe yönlendirdiyse oturum düşmüştür: hangi durumdan sonra olduğu yazılır, yeniden girilir.
      if (group.signedIn && new URL(page.url()).pathname === '/login') {
        problems.push(`${where}: oturum düştü ("${previous}" durumundan sonra)`);
        await login(page);
        await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
      }
      previous = name;
      await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
      try {
        if (act) await act(page);
      } catch (e) {
        const shot = `${process.env.TEMP ?? '/tmp'}/bekofy-check-${checks}-${Date.now()}.png`;
        await page.screenshot({ path: shot }).catch(() => undefined);
        problems.push(`${where}: etkileşim başarısız (${e.message.split('\n')[0]}) adres ${page.url()} görüntü ${shot}`);
        continue;
      }
      await page.waitForTimeout(150);
      const axe = await runAxe(page);
      const contrast = (await page.evaluate(textContrast)).map((f) => `kontrast ${f}`);
      const interactive = label === 'masaüstü' ? await stateChecks(page) : [];
      const overflow = label === 'mobil' ? await overflowAt(page, [280, 320, 414], height) : [];
      checks++;
      for (const issue of [...axe, ...contrast, ...interactive, ...overflow]) problems.push(`${where}: ${issue}`);
    }
    for (const e of new Set(jsErrors)) problems.push(`${label} ${theme}: JS hatası ${e.split('\n')[0]}`);
    await ctx.close();
  }
}
await browser.close();

console.log(`${checks} sayfa durumu denetlendi (${states.length} durum x 2 tema x 2 genişlik).`);
if (problems.length) {
  console.log(`\nSORUN: ${problems.length}`);
  problems.forEach((p) => console.log(`  ${p}`));
  process.exit(1);
}
console.log('OK: axe 0 ihlal, tüm metinler ve etkileşim durumları WCAG AA, odak halkaları görünür, 280/320/414 piksel taşma yok, JS hatası yok.');
