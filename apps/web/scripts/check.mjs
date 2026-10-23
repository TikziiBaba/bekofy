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

const BASE = process.env.BEKOFY_CHECK_URL ?? 'http://localhost:3000';
const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
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

function textContrast() {
  const toRGBA = (s) => { const m = s && s.match(/[\d.]+/g); if (!m) return null; const k = s.startsWith('color(') ? 255 : 1; return [+m[0] * k, +m[1] * k, +m[2] * k, m[3] !== undefined ? +m[3] : 1]; };
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const bgOf = (n) => {
    const stack = [];
    while (n) { const c = toRGBA(getComputedStyle(n).backgroundColor); if (c && c[3] > 0) { stack.push(c); if (c[3] >= 1) break; } n = n.parentElement; }
    let base = toRGBA(getComputedStyle(document.body).backgroundColor) || [255, 255, 255];
    for (let i = stack.length - 1; i >= 0; i--) { const [r, g, b, a] = stack[i]; base = [r * a + base[0] * (1 - a), g * a + base[1] * (1 - a), b * a + base[2] * (1 - a)]; }
    return base;
  };
  const ratioOf = (el) => {
    const cs = getComputedStyle(el);
    const fg = toRGBA(cs.color);
    const bg = bgOf(el);
    const a = fg[3] ?? 1;
    const mixed = [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a)];
    const [l1, l2] = [lum(mixed), lum(bg)];
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const need = (el) => { const cs = getComputedStyle(el); const px = parseFloat(cs.fontSize); return px >= 24 || (px >= 18.66 && parseInt(cs.fontWeight, 10) >= 700) ? 3 : 4.5; };
  const fails = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('[inert], [aria-hidden="true"], svg, script, style, [role="progressbar"]')) continue;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity === 0 || !el.getClientRects().length) continue;
    if (el.closest(':disabled, [aria-disabled="true"], fieldset:disabled')) continue;
    if (el.closest('.sr-only, nextjs-portal')) continue;
    const r = ratioOf(el);
    if (r < need(el)) fails.push(`"${el.textContent.trim().slice(0, 30)}" ${r.toFixed(2)} < ${need(el)}`);
  }
  window.__ratioOf = ratioOf;
  window.__need = need;
  return fails;
}

/**
 * Etkileşimli öğeler. Odak: gerçek Tab tuşuyla sırayla gezilir (programatik odak :focus-visible'ı tetiklemez);
 * her durakta görünür halka ve metin kontrastı ölçülür. Üzerine gelme: her öğenin hover durumunda kontrast.
 */
async function stateChecks(page) {
  const fails = [];
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await page.mouse.move(0, 0);
  const seen = new Set();
  for (let i = 0; i < 45; i++) {
    await page.keyboard.press('Tab');
    const res = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el.tagName === 'NEXTJS-PORTAL') return null;
      const cs = getComputedStyle(el);
      const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) || cs.boxShadow !== 'none';
      const t = [el, ...el.querySelectorAll('*')].find((x) => [...x.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()));
      const key = el.outerHTML.slice(0, 160);
      const label = (el.getAttribute('aria-label') || el.textContent || el.id || el.tagName).trim().slice(0, 28);
      return { key, label, ring, r: t ? [window.__ratioOf(t), window.__need(t)] : null };
    });
    if (!res || seen.has(res.key)) break;
    seen.add(res.key);
    if (!res.ring) fails.push(`odak halkası yok "${res.label}"`);
    if (res.r && res.r[0] < res.r[1]) fails.push(`odak "${res.label}" ${res.r[0].toFixed(2)} < ${res.r[1]}`);
  }
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());

  const handles = await page.$$('main a[href], main button, header a[href], header button, nav a[href], [role="switch"], summary');
  let n = 0;
  for (const h of handles) {
    if (n >= 40) break;
    const visible = await h.evaluate((el) => {
      if (el.closest('[aria-hidden="true"], [inert], :disabled, [aria-disabled="true"]')) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    }).catch(() => false);
    if (!visible) continue;
    n++;
    try {
      await h.hover({ timeout: 1000 });
      const hover = await h.evaluate((el) => {
        const t = [el, ...el.querySelectorAll('*')].find((x) => [...x.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()));
        return t ? [window.__ratioOf(t), window.__need(t), (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 28)] : null;
      });
      if (hover && hover[0] < hover[1]) fails.push(`üzerine gelme "${hover[2]}" ${hover[0].toFixed(2)} < ${hover[1]}`);
    } catch {
      // Öğe başka bir şeyin altında kaldıysa (yapışkan başlık) atlanır.
    }
  }
  await page.mouse.move(0, 0);
  return fails;
}

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
      await page.addScriptTag({ url: AXE_CDN });
      const axe = await page.evaluate(async (tags) => (await window.axe.run(document, { runOnly: { type: 'tag', values: tags } })).violations
        .map((v) => `axe ${v.impact} ${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(', ')}`), AXE_TAGS);
      const contrast = (await page.evaluate(textContrast)).map((f) => `kontrast ${f}`);
      const interactive = label === 'masaüstü' ? await stateChecks(page) : [];
      const overflow = [];
      if (label === 'mobil') {
        for (const w of [280, 320, 414]) {
          await page.setViewportSize({ width: w, height });
          await page.waitForTimeout(100);
          const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          if (over > 1) overflow.push(`taşma ${w}px: ${over}px`);
        }
        await page.setViewportSize({ width, height });
      }
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
