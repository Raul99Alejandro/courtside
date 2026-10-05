// Smoke test for the deployed walking skeleton. Reads the stack outputs from cdk-outputs.json
// (deploy with --outputs-file cdk-outputs.json) and calls the real URLs. Node 24: fetch and WebSocket are global.
import { readFileSync } from 'node:fs';

const out = JSON.parse(readFileSync(new URL('../cdk-outputs.json', import.meta.url), 'utf8')).Courtside;
const site = out.SiteUrl;
const api = out.HttpApiUrl.replace(/\/$/, '');
const ws = out.WsUrl;

let failed = false;
const check = (ok, label, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` - ${detail}` : ''}`);
  if (!ok) failed = true;
};
const call = async (method, path, body) => {
  const r = await fetch(api + path, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json() };
};

const home = await fetch(site);
check(home.status === 200, 'site answers 200', `${site} -> ${home.status}`);
const config = await (await fetch(new URL('config.json', site))).json();
check(config.httpApiUrl === out.HttpApiUrl && config.wsUrl === ws, 'config.json points at the deployed APIs');

const created = await call('POST', '/households');
check(created.status === 200 && /^[A-HJ-NP-Z2-9]{6}$/.test(created.data.code), 'create household', created.data.code);
const code = created.data.code;

const added = await call('POST', `/households/${code}/viewers`, { name: 'Leo', level: 'beginner' });
check(added.status === 200 && added.data.viewers?.[0]?.name === 'Leo', 'add viewer Leo (beginner)');

let phoneCheck;
const pushed = new Promise((resolve, reject) => {
  const socket = new WebSocket(`${ws}?code=${code}&role=tv`);
  const timer = setTimeout(() => { socket.close(); reject(new Error('no answer pushed within 10 s')); }, 10_000);
  socket.onmessage = e => { clearTimeout(timer); socket.close(); resolve(JSON.parse(String(e.data))); };
  socket.onerror = () => { clearTimeout(timer); reject(new Error('websocket error')); };
  socket.onopen = () => {
    // Give $connect a moment to store the connection, then ask as Leo.
    phoneCheck = new Promise(r => setTimeout(r, 500))
      .then(() => call('POST', `/households/${code}/questions`, { viewerName: 'Leo', question: 'What is offside?' }))
      .then(asked => check(asked.status === 200 && asked.data.ok === true && !!asked.data.answer, 'phone gets the answer', asked.data.answer ?? asked.data.message));
  };
});
try {
  const m = await pushed;
  check(m.type === 'answer' && m.layer === 'basic' && m.label === 'Leo', 'TV receives the pushed answer (layer basic, label Leo)', JSON.stringify(m));
} catch (err) {
  check(false, 'TV receives the pushed answer', err.message);
}
await phoneCheck;

const anon = await call('POST', `/households/${code}/questions`, { question: 'What is offside?' });
check(anon.status === 400 && anon.data.message === 'Pick who you are first', 'question without a viewer is refused', anon.data.message);
const stranger = await call('POST', `/households/${code}/questions`, { viewerName: 'Nobody', question: 'What is offside?' });
check(stranger.status === 400 && stranger.data.message === 'Pick who you are first', 'question from a name not in the household is refused', stranger.data.message);

console.log(failed ? '\nSMOKE FAILED' : '\nSMOKE OK');
process.exit(failed ? 1 : 0);
