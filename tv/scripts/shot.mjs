// Usage: node scripts/shot.mjs [url] [outfile] [width] [height]
// Defaults: http://localhost:8082, shots/replay-a.png, 1920x1080. Needs `yarn web` running.
// Pass ?direction=a|b|c in the url to pick the visual direction.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [url = 'http://localhost:8082/?direction=a', out = 'shots/replay-a.png', w = '1920', h = '1080'] = process.argv.slice(2);
mkdirSync(dirname(out), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
page.on('pageerror', (e) => console.error('pageerror:', e.message));
await page.goto(url, { waitUntil: 'networkidle', timeout: 180000 });
await page.waitForSelector('text=Data: StatsBomb Open Data', { timeout: 120000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1000);
await page.screenshot({ path: out });
await browser.close();
console.log('saved', out);
