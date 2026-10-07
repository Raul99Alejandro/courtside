// End-to-end: an Alexa question (ASK simulator, no Echo) arrives on a TV session, labelled with the speaker.
// Needs `yarn web` running (port 8082), the ASK CLI signed in, and the skill id in ../cdk.json.
// Usage: node scripts/e2e-alexa.mjs "why was that offside"     Saves shots/alexa-answer.png.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';

const TV = process.env.TV_BASE ?? 'http://localhost:8082/';
const QUESTION = process.argv[2] ?? 'why was that offside';
const root = new URL('../../', import.meta.url);
const API = JSON.parse(readFileSync(new URL('cdk-outputs.json', root), 'utf8')).Courtside.HttpApiUrl.replace(/\/$/, '');
const SKILL = JSON.parse(readFileSync(new URL('cdk.json', root), 'utf8')).context.alexaSkillId;
mkdirSync('shots', { recursive: true });

const api = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json() };
};
const ask = (...args) => JSON.parse(execFileSync('ask', args, { encoding: 'utf8', shell: true }));
/** Says one thing to the skill in the ASK simulator and returns what Alexa answered. */
async function simulate(utterance) {
  const sim = ask('smapi', 'simulate-skill', '--skill-id', SKILL, '--stage', 'development', '--device-locale', 'en-US', '--session-mode', 'FORCE_NEW_SESSION', '--input-content', `"${utterance}"`);
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const r = ask('smapi', 'get-skill-simulation', '--skill-id', SKILL, '--stage', 'development', '--simulation-id', sim.id);
    if (r.status === 'SUCCESSFUL' || r.status === 'FAILED') {
      const res = r.result?.skillExecutionInfo?.invocations?.[0]?.invocationResponse?.body?.response;
      return { status: r.status, speech: res?.outputSpeech?.text, error: r.result?.error?.message };
    }
  }
  return { status: 'TIMEOUT' };
}
let failed = false;
const check = (ok, label, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` - ${detail}` : ''}`); if (!ok) failed = true; };

const browser = await chromium.launch();
const tv = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
await tv.goto(TV, { waitUntil: 'networkidle', timeout: 180000 });
await tv.waitForFunction(() => /^[A-Z0-9]{6}$/.test(localStorage.getItem('courtside.code') ?? ''), null, { timeout: 60000 });
const code = await tv.evaluate(() => localStorage.getItem('courtside.code'));
console.log('household code', code);
await api('POST', `/households/${code}/viewers`, { name: 'Leo', level: 'beginner' });
await tv.waitForSelector('text=Leo', { timeout: 20000 });
await tv.waitForTimeout(500);
await tv.keyboard.press('ArrowDown');
await tv.keyboard.press('Enter');
await tv.waitForSelector('text=Data: StatsBomb Open Data', { timeout: 30000 });
console.log('TV session running');

const spoken = code.split('').join(' ').toLowerCase();
const link = await simulate(`ask court side to link household ${spoken}`);
console.log('simulator, link household:', JSON.stringify(link));
check(link.status === 'SUCCESSFUL' && /^Linked/.test(link.speech ?? ''), 'link household');

const q = await simulate(`ask court side ${QUESTION}`);
console.log('simulator, question:', JSON.stringify(q));
check(q.status === 'SUCCESSFUL' && /^It's on your TV/.test(q.speech ?? ''), 'Alexa speaks the one-line acknowledgement');

await tv.waitForSelector('text=Guest asked', { timeout: 30000 }).then(
  () => check(true, 'the TV shows the answer labelled Guest'),
  () => check(false, 'the TV shows the answer labelled Guest'),
);
await tv.waitForTimeout(800);
await tv.screenshot({ path: 'shots/alexa-answer.png' });
console.log('on TV:', (await tv.locator('body').innerText()).split('\n').slice(0, 12).join(' | '));
const recent = (await api('GET', `/households/${code}`)).data.recentAnswers ?? [];
check(recent.some((a) => a.label === 'Guest' && a.layer === 'basic'), 'recentAnswers has the Guest answer at the basic layer', JSON.stringify(recent.map((a) => ({ label: a.label, layer: a.layer }))));
await browser.close();
process.exit(failed ? 1 : 0);
