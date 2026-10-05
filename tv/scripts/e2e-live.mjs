// End-to-end: TV web build (yarn web, port 8082) + the deployed phone page + the real backend.
// Usage: node scripts/e2e-live.mjs     Saves shots/live-watching.png, live-replay.png, live-answer.png.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';

const TV = process.env.TV_BASE ?? 'http://localhost:8082/';
const SITE = process.env.SITE ?? 'https://d3igz6igrmkgis.cloudfront.net';
const NAME = process.env.VIEWER ?? 'Leo';
mkdirSync('shots', { recursive: true });
const API = JSON.parse(readFileSync(new URL('../../cdk-outputs.json', import.meta.url), 'utf8')).Courtside.HttpApiUrl.replace(/\/$/, '');
const api = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json() };
};
let failed = false;
const check = (ok, label, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` - ${detail}` : ''}`);
  if (!ok) failed = true;
};
const liveState = (page) => page.evaluate(() => window.__courtside?.state());

const browser = await chromium.launch();
const tv = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
// The TV's WebSocket goes through a route so the script can drop it: while blocked, a reconnect lands on a socket nobody pushes to.
let wsBlocked = false;
let tvSocket;
await tv.routeWebSocket(/execute-api/, (ws) => {
  tvSocket = wsBlocked ? { ws } : { ws, server: ws.connectToServer() };
});
const dropTvSocket = () => { tvSocket?.server?.close(); tvSocket?.ws.close(); };
for (const [n, p] of [['tv', tv], ['phone', phone]]) {
  p.on('pageerror', (e) => console.error(`${n} pageerror:`, e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.error(`${n} console error:`, m.text()); });
}
const step = (s) => console.log('-', s);
let householdGets = 0; // GET /households/{code} from the TV: the poll and the reconnect refresh
let socketCloses = 0;
let currentCode = '';
tv.on('request', (r) => { if (r.method() === 'GET' && currentCode && r.url().endsWith('/households/' + currentCode)) householdGets++; });
tv.on('websocket', (ws) => ws.on('close', () => socketCloses++));

step('TV opens live mode and creates a household');
await tv.goto(TV, { waitUntil: 'networkidle', timeout: 180000 });
await tv.waitForFunction(() => /^[A-Z0-9]{6}$/.test(localStorage.getItem('courtside.code') ?? ''), null, { timeout: 60000 });
const code = await tv.evaluate(() => localStorage.getItem('courtside.code'));
await tv.waitForSelector(`text=${code}`);
await tv.evaluate(() => document.fonts.ready);
await tv.screenshot({ path: 'shots/live-watching.png' });
step(`household code ${code}`);
currentCode = code;

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
await tv.waitForSelector('text=What is a goal kick?', { state: 'hidden', timeout: 40000 });
await tv.waitForSelector('text=Got it', { timeout: 30000 });
check((await tv.locator('text=Got it').count()) === 1, 'one Replay in the DOM after the auto-return');

step('a viewer added from a phone mid-session reaches the TV by push, with no polling');
const getsBefore = householdGets;
const add = await api('POST', `/households/${code}/viewers`, { name: 'Mia', level: 'fan' });
check(add.status === 200 && add.data.viewers.map((v) => v.name).join() === 'Leo,Mia', 'API lists Leo then Mia (creation order)', add.data.viewers.map((v) => v.name + ':' + v.order).join());
await tv.waitForFunction(() => window.__courtside?.state().viewers.some((v) => v.name === 'Mia'), null, { timeout: 4000 }).then(
  () => check(true, 'TV state has Mia within 4 s, session still running'),
  () => check(false, 'TV state has Mia within 4 s'),
);
await tv.waitForTimeout(7000); // longer than the 5 s poll
check(householdGets === getsBefore, 'no household polling during the session', `GETs ${getsBefore} -> ${householdGets}`);
check((await liveState(tv)).sessionId !== undefined, 'the session carried on');

step('views were counted once (seenBasic) and the question reset what it named (R-04-c end to end)');
const hh = await api('GET', `/households/${code}`);
const leo = hh.data.viewers.find((v) => v.name === 'Leo');
check(hh.data.sessionId === (await liveState(tv)).sessionId, 'GET household returns the TV session id');
check(leo.seenBasic['extra time'] === 1, 'seenBasic extra time counted once', JSON.stringify(leo.seenBasic));
check(Object.values(leo.seenBasic).every((n) => n <= 1), 'no concept counted twice', JSON.stringify(leo.seenBasic));
check(leo.seenBasic.goal === 0, 'asking "What is a goal kick?" with the session id reset goal to 0 (phone sent sessionId)', JSON.stringify(leo.seenBasic));

step('offline: Got it is kept and retried with an error toast; an answer missed offline still arrives');
await tv.context().setOffline(true);
await tv.getByText('Got it', { exact: true }).click();
await tv.waitForSelector('[data-testid="error-toast"]', { timeout: 8000 }).then(
  () => check(true, 'Replay shows the error toast while Got it is retried'),
  () => check(false, 'Replay shows the error toast while Got it is retried'),
);
await tv.screenshot({ path: 'shots/live-error-toast.png' });
await phone.fill('#question', 'Why is extra time played?');
await phone.click('#send');
await phone.waitForSelector('#answerbox:not([hidden])', { timeout: 60000 });
await tv.waitForTimeout(1500);
await tv.context().setOffline(false);
await tv.waitForSelector('text=Why is extra time played?', { timeout: 60000 }).then(
  () => check(true, 'the answer asked while the TV was offline shows up', `socket closes seen: ${socketCloses}`),
  () => check(false, 'the answer asked while the TV was offline shows up', `socket closes seen: ${socketCloses}`),
);
await tv.waitForFunction(() => window.__courtside?.state().problem === undefined, null, { timeout: 40000 }).then(
  () => check(true, 'the error toast cleared once Got it went through'),
  () => check(false, 'the error toast cleared once Got it went through'),
);
const afterGotIt = (await api('GET', `/households/${code}`)).data.viewers.find((v) => v.name === 'Leo');
check(afterGotIt.understood.includes('goal') && afterGotIt.understood.includes('extra time'), 'Got it reached the server', JSON.stringify(afterGotIt.understood));
await tv.keyboard.press('Enter');
await tv.waitForSelector('text=Why is extra time played?', { state: 'hidden', timeout: 40000 });

step('WebSocket drop: an answer pushed while the socket was down is caught up from recentAnswers on reconnect');
wsBlocked = true;
dropTvSocket();
await tv.waitForTimeout(3000); // the TV reconnects to the swallowing socket
await phone.fill('#question', 'What is a yellow card?');
await phone.click('#send');
await phone.waitForSelector('#answerbox:not([hidden])', { timeout: 60000 });
await tv.waitForTimeout(1500);
check((await tv.locator('text=What is a yellow card?').count()) === 0, 'the push really did not reach the TV');
wsBlocked = false;
dropTvSocket(); // the next reconnect is the real one
await tv.waitForSelector('text=What is a yellow card?', { timeout: 30000 }).then(
  () => check(true, 'the missed answer shows up after the reconnect'),
  () => check(false, 'the missed answer shows up after the reconnect'),
);
await tv.screenshot({ path: 'shots/live-caught-up.png' });
await tv.keyboard.press('Enter');
await tv.waitForSelector('text=What is a yellow card?', { state: 'hidden', timeout: 40000 });

step('undo works after a reload (state from the server, name not parsed from text)');
const promote = await api('POST', `/households/${code}/viewers/Leo/got-it`, { concepts: ['goal', 'shot', 'save', 'assist', 'offside'] });
check(promote.data.promotions?.[0]?.name === 'Leo', 'Leo moved up to Fan on the server', JSON.stringify(promote.data.promotions));
await tv.reload({ waitUntil: 'networkidle', timeout: 180000 });
await tv.waitForSelector('text=Mia', { timeout: 30000 });
await tv.waitForTimeout(500);
await tv.keyboard.press('ArrowDown');
await tv.keyboard.press('Enter');
await tv.waitForSelector('[data-testid="toast"]', { timeout: 30000 });
check((await tv.locator('[data-testid="toast"]').innerText()).includes('Leo moved up to Fan'), 'the toast is back after the reload');
await tv.screenshot({ path: 'shots/live-undo-after-reload.png' });
await tv.getByText('Undo', { exact: true }).click();
await tv.waitForSelector('[data-testid="toast"]', { state: 'hidden', timeout: 15000 });
const undone = (await api('GET', `/households/${code}`)).data.viewers.find((v) => v.name === 'Leo');
check(undone.level === 'beginner' && undone.autoPromotionDisabled === true, 'Undo reached the server: Leo is a beginner again for good', `${undone.level}`);

step('household gone: a stored code the server does not know is replaced, with a notice');
await tv.evaluate(() => localStorage.setItem('courtside.code', 'ZZZZZZ'));
await tv.reload({ waitUntil: 'networkidle', timeout: 180000 });
await tv.waitForSelector('text=expired', { timeout: 30000 });
const fresh = await tv.evaluate(() => localStorage.getItem('courtside.code'));
check(/^[A-Z0-9]{6}$/.test(fresh) && fresh !== 'ZZZZZZ' && fresh !== code, 'a new household code is stored', fresh);
await tv.screenshot({ path: 'shots/live-household-gone.png' });
await browser.close();
console.log(failed ? 'e2e FAILED' : 'e2e ok');
process.exit(failed ? 1 : 0);
