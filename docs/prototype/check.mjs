// Prototipin tüm ekranlarını koyu ve açık temada, masaüstü ve mobil genişlikte denetler:
// axe-core (WCAG 2.2 A/AA), görünen her metnin gerçek kontrastı (yarı saydam zeminler birleştirilerek)
// ve mobilde 280/320/414 piksel genişlikte yatay taşma. Kullanım: node docs/prototype/check.mjs

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const URL_BASE = pathToFileURL(resolve('docs/prototype/index.html')).href;
const LOCAL_AXE = resolve('node_modules/axe-core/axe.min.js');
const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const click = (sel) => async (p) => { await p.click(sel, { timeout: 5000 }); await p.waitForTimeout(300); };
const STATES = [
  ['ana sayfa', '#home'],
  ['çalma listesi', '#playlist/pl1'],
  ['albüm', '#album/al3'],
  ['sanatçı', '#artist/ar3'],
  ['arama: göz at', '#search'],
  ['arama: sonuç', '#search', async (p) => { await p.fill((await p.isVisible('#page-search')) ? '#page-search' : '#top-search', 'ku'); }],
  ['arama: sonuç yok', '#search', async (p) => { await p.fill((await p.isVisible('#page-search')) ? '#page-search' : '#top-search', 'zzzz'); }],
  ['kitaplık', '#library'],
  ['kitaplık: indirilenler (boş)', '#library', click('[data-filter="downloads"]')],
  ['profil', '#profile'],
  ['ayarlar', '#settings'],
  ['ayarlar: silme onayı', '#settings', click('[data-action="confirm-delete"]')],
  ['jam', '#jam'],
  ['şimdi çalıyor: sözler', '#home', async (p) => { await p.click((await p.isVisible('.mini-open')) ? '.mini-open' : '.player [data-action="open-np"]'); await p.waitForTimeout(500); }],
  ['şimdi çalıyor: sıradaki', '#home', async (p) => { await p.click((await p.isVisible('.mini-open')) ? '.mini-open' : '.player [data-action="open-np"]'); await p.click('[data-np-tab="queue"]'); }],
  ...[0, 1, 2, 3, 4].map((i) => [`wrapped ${i + 1}`, '#wrapped', async (p) => { for (let k = 0; k < i; k++) await p.click('[data-action="story-next"]'); }]),
  ['site: tanıtım', '#landing'],
  ['admin: boş form', '#admin'],
  ['admin: hatalı bağlantı', '#admin', async (p) => { await p.fill('#yt-url', 'https://example.com/video'); await p.click('form[data-action="imp-fetch"] [type="submit"]'); }],
  ['admin: önizleme', '#admin', async (p) => { await p.click('[data-action="imp-example"]'); await p.click('form[data-action="imp-fetch"] [type="submit"]'); await p.waitForSelector('#f-title'); }],
  ['admin: aktarılıyor', '#admin', async (p) => { await p.click('[data-action="imp-example"]'); await p.click('form[data-action="imp-fetch"] [type="submit"]'); await p.waitForSelector('#f-title'); await p.click('form[data-action="imp-start"] [type="submit"]'); await p.waitForTimeout(1200); }],
  ['admin: tamamlandı', '#admin', async (p) => { await p.click('[data-action="imp-example"]'); await p.click('form[data-action="imp-fetch"] [type="submit"]'); await p.waitForSelector('#f-title'); await p.click('form[data-action="imp-start"] [type="submit"]'); await p.waitForSelector('.notice.success', { timeout: 10000 }); }],
  ['admin: sunucu kapalı', '#admin', click('[data-action="imp-toggle-online"]')],
];

/** Görünen her metin öğesinin kontrastı; zemin, yarı saydam katmanlar üst üste birleştirilerek bulunur. */
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
  const fails = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('[inert], [aria-hidden="true"], svg')) continue;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity === 0 || !el.getClientRects().length) continue;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true' || el.closest('[aria-disabled="true"]')) continue;
    const fg = toRGBA(cs.color);
    const bg = bgOf(el);
    const [l1, l2] = [lum(fg), lum(bg)];
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const px = parseFloat(cs.fontSize);
    const need = px >= 24 || (px >= 18.66 && parseInt(cs.fontWeight, 10) >= 700) ? 3 : 4.5;
    if (ratio < need) fails.push(`"${el.textContent.trim().slice(0, 30)}" ${ratio.toFixed(2)} < ${need}`);
  }
  return fails;
}

const browser = await chromium.launch();
const problems = [];
let checks = 0;
for (const [width, height, label] of [[1440, 900, 'masaüstü'], [390, 844, 'mobil']]) {
  for (const theme of ['dark', 'light']) {
    const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    await ctx.addInitScript((t) => { try { localStorage.setItem('bekofy-proto-theme', t); } catch (e) { /* yok */ } }, theme);
    const page = await ctx.newPage();
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));
    for (const [name, hash, act] of STATES) {
      const where = `${label} ${theme} | ${name}`;
      await page.goto('about:blank');
      await page.goto(URL_BASE + hash, { waitUntil: 'networkidle' });
      await page.addStyleTag({ content: '*{transition:none!important;animation:none!important}' });
      try { if (act) await act(page); } catch (e) { problems.push(`${where}: etkileşim başarısız (${e.message.split('\n')[0]})`); continue; }
      await page.waitForTimeout(150);
      if (existsSync(LOCAL_AXE)) await page.addScriptTag({ path: LOCAL_AXE });
      else await page.addScriptTag({ url: AXE_CDN });
      const axe = await page.evaluate(async (tags) => (await window.axe.run(document, { runOnly: { type: 'tag', values: tags } })).violations
        .map((v) => `axe ${v.impact} ${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(', ')}`), AXE_TAGS);
      const contrast = (await page.evaluate(textContrast)).map((f) => `kontrast ${f}`);
      const overflow = [];
      if (label === 'mobil') {
        for (const w of [280, 320, 414]) {
          await page.setViewportSize({ width: w, height });
          const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          if (over > 1) overflow.push(`taşma ${w}px: ${over}px`);
        }
        await page.setViewportSize({ width, height });
      }
      checks++;
      for (const issue of [...axe, ...contrast, ...overflow]) problems.push(`${where}: ${issue}`);
    }
    for (const e of new Set(jsErrors)) problems.push(`${label} ${theme}: JS hatası ${e}`);
    await ctx.close();
  }
}
await browser.close();

console.log(`${checks} ekran durumu denetlendi (${STATES.length} durum x 2 tema x 2 genişlik).`);
if (problems.length) {
  console.log(`\nSORUN: ${problems.length}`);
  problems.forEach((p) => console.log(`  ${p}`));
  process.exit(1);
}
console.log('OK: axe 0 ihlal, tüm metinler WCAG AA, mobilde 280/320/414 piksel taşma yok, JS hatası yok.');
