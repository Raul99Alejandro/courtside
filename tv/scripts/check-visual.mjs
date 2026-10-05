// Automated visual checks for gate 2. Needs `yarn web` (port 8082) and the phone page (`npm run web:dev -- --port 5199`) running.
// Usage: node scripts/check-visual.mjs [--tv] [--phone]  (phone states run at 390 and 360 px wide)   Exit code 1 when any problem is found.
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const TV = process.env.TV_BASE ?? 'http://localhost:8082';
const PHONE = process.env.PHONE_BASE ?? 'http://localhost:5199';
const tvScreens = [
  ['watching', 'Who'],
  ['replay', 'Data: StatsBomb Open Data'],
  ['answer', 'Leo asked'],
  ['levelup', 'moved up'],
];
const phoneStates = ['join', 'pick', 'ask', 'preperm', 'blocked-safari', 'blocked-chrome', 'answer'];
const args = process.argv.slice(2);
const doTv = !args.includes('--phone');
const doPhone = !args.includes('--tv');

// Runs inside the page. Returns raw measurements; verdicts are made in Node.
function measure({ isTv, W, H }) {
  const out = { small: [], outside: [], overflow: [], targets: [], overlap: [], hscroll: false };
  const label = (el) => `${el.tagName.toLowerCase()}${el.getAttribute('data-testid') ? '#' + el.getAttribute('data-testid') : ''} "${(el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 32)}"`;
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const hasOwnText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const all = [...document.body.querySelectorAll('*')].filter((e) => !e.closest('svg') || e.tagName.toLowerCase() === 'svg');
  out.hscroll = document.documentElement.scrollWidth > W + 1;
  const mx = W * 0.05, my = H * 0.05;
  for (const el of all) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const text = hasOwnText(el);
    if (text) {
      const fs = parseFloat(cs.fontSize);
      if (isTv && fs < 28) out.small.push(`${label(el)} ${fs}px`);
      // clipped / overflowing text
      if (el.scrollWidth > el.clientWidth + 1 && cs.overflowX !== 'visible' && el.clientWidth > 0) out.overflow.push(`${label(el)} clipped horizontally`);
      if (el.scrollHeight > el.clientHeight + 1 && ['hidden', 'clip'].includes(cs.overflowY) && el.clientHeight > 0) out.overflow.push(`${label(el)} clipped vertically`);
      if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) out.overflow.push(`${label(el)} ellipsised`);
      // text that spills out of its nearest bounded parent
      const p = el.parentElement;
      if (p) {
        const pr = p.getBoundingClientRect();
        const pcs = getComputedStyle(p);
        if (pcs.overflow !== 'visible' && (r.right > pr.right + 1 || r.bottom > pr.bottom + 1 || r.left < pr.left - 1)) out.overflow.push(`${label(el)} spills out of its parent`);
      }
    }
    // safe area applies to anything that carries content (text, controls, images, svg), not to full-bleed backgrounds
    // full-bleed svg is a background (pitch band, stripes); focus-scaled elements are held to the 3.5 % action-safe area
    const bleed = el.tagName.toLowerCase() === 'svg' && r.width >= W - 2;
    const scaled = cs.transform !== 'none';
    const content = !bleed && (text || el.matches('button,a,input,textarea,select,img,svg,canvas,[role=button],[tabindex]'));
    const sx = scaled ? W * 0.035 : mx, sy = scaled ? H * 0.035 : my;
    if (isTv && content && (r.left < sx - 1 || r.top < sy - 1 || r.right > W - sx + 1 || r.bottom > H - sy + 1)) {
      out.outside.push(`${label(el)} [${Math.round(r.left)},${Math.round(r.top)} - ${Math.round(r.right)},${Math.round(r.bottom)}]`);
    }
    if (!isTv && el.matches('button,a[href],input:not([type=hidden]),textarea,select,[role=button]')) {
      // a radio or checkbox is operated through its wrapping label
      const t = el.matches('input[type=radio],input[type=checkbox]') ? el.closest('label') ?? el : el;
      const tr = t.getBoundingClientRect();
      if (tr.width < 48 || tr.height < 48) out.targets.push(`${label(t)} ${Math.round(tr.width)}x${Math.round(tr.height)}`);
    }
  }
  // the level-up toast must not cover any other text
  const toast = document.querySelector('[data-testid=toast]');
  if (toast) {
    const t = toast.getBoundingClientRect();
    for (const el of all) {
      if (toast.contains(el) || el.contains(toast) || !visible(el) || !hasOwnText(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top) out.overlap.push(`toast covers ${label(el)}`);
    }
  }
  return out;
}

async function checkPage(page, { isTv, W, H }) {
  const problems = [];
  const axe = await new AxeBuilder({ page }).analyze();
  for (const v of axe.violations.filter((x) => ['serious', 'critical'].includes(x.impact))) {
    const nodes = v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('; ');
    problems.push({ kind: v.id === 'color-contrast' ? 'contrast' : 'axe', msg: `${v.id} (${v.nodes.length}): ${nodes}` });
  }
  const m = await page.evaluate(measure, { isTv, W, H });
  for (const s of m.small) problems.push({ kind: 'font', msg: s });
  for (const s of m.outside) problems.push({ kind: 'safe', msg: s });
  for (const s of m.overflow) problems.push({ kind: 'overflow', msg: s });
  if (m.hscroll) problems.push({ kind: 'overflow', msg: 'page scrolls horizontally' });
  for (const s of m.targets) problems.push({ kind: 'touch', msg: s });
  for (const s of m.overlap) problems.push({ kind: 'overlap', msg: s });
  return problems;
}

const browser = await chromium.launch();
const rows = [];
const kinds = ['axe', 'contrast', 'font', 'safe', 'overflow', 'touch', 'overlap'];

async function run(name, url, ctxOpts, wait, opts) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 180000 });
  if (wait) await page.waitForSelector(`text=${wait}`, { timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  const problems = await checkPage(page, opts);
  rows.push({ name, problems });
  await ctx.close();
}

if (doTv) {
  for (const [s, wait] of tvScreens) {
    await run(`tv ${s}`, `${TV}/?screen=${s}`, { viewport: { width: 1920, height: 1080 } }, wait, { isTv: true, W: 1920, H: 1080 });
  }
}
if (doPhone) {
  for (const s of phoneStates) for (const W of [390, 360]) {
    await run(`phone ${s} ${W}`, `${PHONE}/phone.html?demo=${s}`, { viewport: { width: W, height: 844 }, deviceScaleFactor: 2, hasTouch: true }, null, { isTv: false, W, H: 844 });
  }
}
await browser.close();

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('screen', 22) + kinds.map((k) => pad(k, 10)).join(''));
let total = 0;
for (const r of rows) {
  const c = Object.fromEntries(kinds.map((k) => [k, r.problems.filter((p) => p.kind === k).length]));
  total += r.problems.length;
  console.log(pad(r.name, 22) + kinds.map((k) => pad(c[k] || '.', 10)).join(''));
}
if (total) {
  console.log(`\n${total} problems:`);
  for (const r of rows) for (const p of r.problems) console.log(`- ${r.name} [${p.kind}] ${p.msg}`);
  process.exit(1);
}
console.log('\nAll checks pass.');
