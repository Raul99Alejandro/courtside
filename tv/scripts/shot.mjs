// Usage: node scripts/shot.mjs [url] [outfile] [width] [height]
// Defaults: http://localhost:8082, shots/replay.png, 1920x1080. Needs `yarn web` running.
// Pass ?screen=watching|replay|answer|levelup in the url to pick the screen.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [url = 'http://localhost:8082/?screen=replay', out = 'shots/replay.png', w = '1920', h = '1080'] = process.argv.slice(2);
mkdirSync(dirname(out), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
page.on('pageerror', (e) => console.error('pageerror:', e.message));
await page.goto(url, { waitUntil: 'networkidle', timeout: 180000 });
await page.waitForSelector(`text=${process.env.WAIT ?? 'Data: StatsBomb Open Data'}`, { timeout: 120000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1000);
for (const k of (process.env.KEYS ?? '').split(',').filter(Boolean)) { await page.keyboard.press(k); await page.waitForTimeout(300); }
await page.waitForTimeout(400);
await page.screenshot({ path: out });
await browser.close();
console.log('saved', out);
