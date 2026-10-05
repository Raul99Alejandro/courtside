import QRCode from 'qrcode';
import { call, loadConfig, text, type ViewerInfo } from './api.js';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const msg = $('msg');
let code = '';

function card(a: { label: string; layer: string; question: string; answer: string }) {
  const div = document.createElement('div');
  div.className = 'card';
  const q = document.createElement('small');
  q.textContent = `${a.label} asked: ${a.question}`;
  const p = document.createElement('p');
  p.textContent = `${a.answer} (${a.layer})`;
  div.append(q, p);
  $('cards').prepend(div);
}

async function refreshViewers() {
  const r = await call<{ viewers?: ViewerInfo[] }>('GET', `/households/${code}`);
  text($('viewers'), r.data.viewers?.length ? `Viewers: ${r.data.viewers.map(v => `${v.name} (${v.level})`).join(', ')}` : 'No viewers yet');
}

async function openSocket() {
  const { wsUrl } = await loadConfig();
  const ws = new WebSocket(`${wsUrl}?code=${code}&role=tv`);
  ws.onmessage = e => { const m = JSON.parse(String(e.data)); if (m.type === 'answer') card(m); };
  ws.onopen = () => text(msg, '');
  // API Gateway closes idle sockets after 10 minutes: ping every 5 and reconnect on close.
  const ping = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send('ping'); }, 5 * 60 * 1000);
  ws.onclose = () => { clearInterval(ping); text(msg, 'Reconnecting...'); setTimeout(() => void openSocket(), 2000); };
}

async function create() {
  const r = await call<{ code: string }>('POST', '/households');
  code = r.data.code;
  text($('code'), code);
  $('pair').hidden = false;
  $('create').hidden = true;
  const url = new URL('/phone.html', location.href);
  url.searchParams.set('code', code);
  await QRCode.toCanvas($<HTMLCanvasElement>('qr'), url.toString(), { width: 220 });
  await refreshViewers();
  setInterval(() => void refreshViewers(), 5000);
  await openSocket();
}

$('create').onclick = () => void create();
