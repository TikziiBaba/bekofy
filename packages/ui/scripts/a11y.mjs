// Sayfa denetimleri (Playwright): web sitesi ve masaüstü uygulaması aynı ölçümleri kullanır.
// - textContrast: görünen her metnin gerçek kontrastı (yarı saydam zeminler birleştirilerek)
// - stateChecks: Tab ile gerçek klavye odağı (halka + kontrast) ve üzerine gelme durumları
// - runAxe: axe-core WCAG 2.2 A/AA
// - overflowAt: verilen genişliklerde yatay taşma

const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

export function textContrast() {
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
export async function stateChecks(page) {
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
      // Chromium kalınlığı tam ekran pikseline yuvarlar (%125 ölçekte 2px -> 1.6 CSS px = 2 ekran pikseli).
      const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) * window.devicePixelRatio >= 1.99) || cs.boxShadow !== 'none';
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

let axeSource = null;

export async function runAxe(page, { exclude = [] } = {}) {
  // Betik etiketi yerine doğrudan çalıştırılır: uygulamanın içerik güvenlik politikası dış betikleri engeller.
  axeSource ??= await (await fetch(AXE_CDN)).text();
  if (!(await page.evaluate(() => Boolean(window.axe)))) await page.evaluate(axeSource);
  return page.evaluate(
    async ({ tags, exclude }) =>
      (await window.axe.run({ exclude }, { runOnly: { type: 'tag', values: tags } })).violations.map(
        (v) => `axe ${v.impact} ${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(', ')}`,
      ),
    { tags: AXE_TAGS, exclude },
  );
}

export async function overflowAt(page, widths, height) {
  const out = [];
  const original = page.viewportSize();
  for (const w of widths) {
    await page.setViewportSize({ width: w, height });
    await page.waitForTimeout(100);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 1) out.push(`taşma ${w}px: ${over}px`);
  }
  if (original) await page.setViewportSize(original);
  return out;
}
