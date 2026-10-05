// Usage: node scripts/shot.mjs [url] [outfile] [width] [height]
// Defaults: http://localhost:8082, shots/hello.png, 1920x1080. Needs `yarn web` running.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [url = 'http://localhost:8082', out = 'shots/hello.png', w = '1920', h = '1080'] = process.argv.slice(2);
mkdirSync(dirname(out), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
page.on('pageerror', (e) => console.error('pageerror:', e.message));
await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForSelector('text=Courtside', { timeout: 60000 });
await page.waitForTimeout(800);
await page.keyboard.press('ArrowRight'); // D-pad right closes the drawer, as on a remote
await page.waitForTimeout(800);
await page.screenshot({ path: out });
await browser.close();
console.log('saved', out);
