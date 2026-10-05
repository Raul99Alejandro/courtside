// Screenshots of the phone page states in all three directions (needs `npm run web:dev -- --port 5199` running).
import { chromium } from '../tv/node_modules/playwright-core/index.mjs';
const base = process.env.BASE ?? 'http://localhost:5199';
const width = Number(process.env.W ?? 390);
const states = ['join', 'pick', 'ask', 'preperm', 'blocked-safari', 'blocked-chrome', 'answer'];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR', e.message));
for (const d of ['a', 'b', 'c']) for (const s of states) {
  await page.goto(`${base}/phone.html?direction=${d}&demo=${s}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const full = s === 'pick';
  const suffix = width === 390 ? '' : `-${width}`;
  await page.screenshot({ path: `design/shots/phone-${s}-${d}${suffix}.png`, fullPage: full });
}
await browser.close();
