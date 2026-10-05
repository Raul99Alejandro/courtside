import { call, text, type ViewerInfo } from './api.js';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const msg = $('msg');
let code = '';
let me = '';

$<HTMLInputElement>('code').value = new URLSearchParams(location.search).get('code') ?? '';

function renderProfiles(viewers: ViewerInfo[]) {
  $('profiles').replaceChildren(...viewers.map(v => {
    const b = document.createElement('button');
    b.className = 'chip' + (v.name === me ? ' on' : '');
    b.textContent = `${v.name} (${v.level})`;
    b.onclick = () => { me = v.name; renderProfiles(viewers); };
    return b;
  }));
  $('add').hidden = false;
  $('ask').hidden = false;
}

type Reply = { viewers?: ViewerInfo[]; message?: string };

async function join() {
  text(msg, '');
  const typed = $<HTMLInputElement>('code').value;
  const r = await call<Reply>('GET', `/households/${encodeURIComponent(typed)}`);
  if (r.status !== 200 || !r.data.viewers) { text(msg, r.data.message ?? 'Something went wrong'); return; }
  code = typed;
  renderProfiles(r.data.viewers);
}

async function addMe() {
  const name = $<HTMLInputElement>('name').value;
  const level = $<HTMLSelectElement>('level').value;
  const r = await call<Reply>('POST', `/households/${encodeURIComponent(code)}/viewers`, { name, level });
  if (r.status !== 200 || !r.data.viewers) { text(msg, r.data.message ?? 'Something went wrong'); return; }
  me = name.trim();
  text(msg, '');
  renderProfiles(r.data.viewers);
}

async function send() {
  text(msg, 'Thinking...');
  const body: Record<string, string> = { question: $<HTMLInputElement>('question').value };
  if (me) body.viewerName = me;
  const r = await call<{ ok?: boolean; answer?: string; message?: string }>('POST', `/households/${encodeURIComponent(code)}/questions`, body);
  if (r.data.ok && r.data.answer) { text(msg, ''); text($('answer'), r.data.answer); $('answer').className = 'card'; }
  else text(msg, r.data.message ?? 'Something went wrong');
}

$('join').onclick = () => void join();
$('addme').onclick = () => void addMe();
$('send').onclick = () => void send();
if ($<HTMLInputElement>('code').value) void join();
