// End-to-end: TV web build (yarn web, port 8082) + the deployed phone page + the real backend.
// Usage: node scripts/e2e-live.mjs     Saves shots/live-watching.png, live-replay.png, live-answer.png.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const TV = process.env.TV_BASE ?? 'http://localhost:8082/';
const SITE = process.env.SITE ?? 'https://d3igz6igrmkgis.cloudfront.net';
const NAME = process.env.VIEWER ?? 'Leo';
mkdirSync('shots', { recursive: true });

const browser = await chromium.launch();
const tv = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
for (const [n, p] of [['tv', tv], ['phone', phone]]) {
  p.on('pageerror', (e) => console.error(`${n} pageerror:`, e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.error(`${n} console error:`, m.text()); });
}
const step = (s) => console.log('-', s);

step('TV opens live mode and creates a household');
await tv.goto(TV, { waitUntil: 'networkidle', timeout: 180000 });
await tv.waitForFunction(() => /^[A-Z0-9]{6}$/.test(localStorage.getItem('courtside.code') ?? ''), null, { timeout: 60000 });
const code = await tv.evaluate(() => localStorage.getItem('courtside.code'));
await tv.waitForSelector(`text=${code}`);
await tv.evaluate(() => document.fonts.ready);
await tv.screenshot({ path: 'shots/live-watching.png' });
step(`household code ${code}`);

step('phone joins by code and adds a viewer');
await phone.goto(`${SITE}/phone.html?code=${code}`, { waitUntil: 'networkidle' });
await phone.waitForSelector('#s-pick:not([hidden])');
await phone.fill('#name', NAME);
await phone.click('#addme');
await phone.waitForSelector('#s-ask:not([hidden])');

step('TV lists the viewer within the 5 s poll, starts watching');
await tv.waitForSelector(`text=${NAME}`, { timeout: 20000 });
await tv.waitForTimeout(500);
await tv.keyboard.press('ArrowDown');
await tv.keyboard.press('Enter');
await tv.waitForSelector('text=Data: StatsBomb Open Data', { timeout: 30000 });
await tv.waitForTimeout(1500);
await tv.screenshot({ path: 'shots/live-replay.png' });

step('phone asks a text question');
await phone.fill('#question', 'Why was that offside?');
await phone.click('#send');

step('TV shows the Answer screen');
await tv.waitForSelector(`text=${NAME} asked`, { timeout: 60000 });
await tv.waitForTimeout(800);
await tv.screenshot({ path: 'shots/live-answer.png' });
console.log('answer on TV:', (await tv.locator('body').innerText()).split('\n').slice(0, 12).join(' | '));

step('a second question arrives while the first is on screen: queued, not lost');
await phone.fill('#question', 'What is a goal kick?');
await phone.click('#send');
await tv.waitForSelector('text=1 more question waiting', { timeout: 60000 });
await tv.screenshot({ path: 'shots/live-answer-queued.png' });

step('Enter dismisses the first; the second shows; 20 s later the TV returns to the replay');
await tv.keyboard.press('Enter');
await tv.waitForSelector('text=What is a goal kick?', { timeout: 10000 });
await tv.waitForSelector('text=Got it', { timeout: 30000 });
console.log('replay screens in DOM:', await tv.locator('text=Got it').count());
console.log('back on the replay after the auto-return');
await browser.close();
console.log('e2e ok');
