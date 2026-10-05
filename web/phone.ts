import { call, text, type ViewerInfo } from './api.js';
import { scarfFor, scarfIndex } from '../src/core/scarf.js';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const msg = $('msg');
let code = '';
let me = '';
let viewers: ViewerInfo[] = [];
let sessionId = ''; // the newest viewing session on the TV; sent with questions so a question can reset what was just shown (R-04-c)

const params = new URLSearchParams(location.search);

// ---- screens and status ----
type Screen = 'join' | 'pick' | 'ask' | 'preperm' | 'blocked';
function show(s: Screen) {
  for (const n of ['join', 'pick', 'ask', 'preperm', 'blocked']) $('s-' + n).hidden = n !== s;
  document.body.dataset.screen = s;
  window.scrollTo(0, 0);
}
type Kind = 'busy' | 'error' | 'ok' | '';
function say(s: string, kind: Kind = '') { text(msg, s); msg.dataset.kind = s ? kind : ''; }
/** Disables a button and shows what it is doing while an action runs. */
async function busy<T>(btn: HTMLButtonElement, label: string, work: () => Promise<T>): Promise<T> {
  const old = btn.textContent;
  btn.disabled = true; btn.textContent = label; btn.setAttribute('aria-busy', 'true');
  try { return await work(); }
  finally { btn.disabled = false; btn.textContent = old; btn.removeAttribute('aria-busy'); }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

$<HTMLInputElement>('code').value = params.get('code') ?? '';

/** The viewer's scarf as an inline SVG (same drawing as the TV): body, two night bands, fringe. width:height is 2:3. */
function scarfSvg(index: number, width: number): SVGSVGElement {
  const { color, striped } = scarfFor(index);
  const ns = 'http://www.w3.org/2000/svg';
  const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) => {
    const n = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    return n;
  };
  const svg = el('svg', { viewBox: '0 0 40 60', width, height: (width * 3) / 2, 'aria-hidden': 'true', focusable: 'false' });
  svg.append(el('rect', { x: 4, y: 0, width: 32, height: 48, rx: 1.5, fill: color }));
  for (const y of striped ? [5, 14, 23, 32, 41] : [32, 40]) svg.append(el('rect', { x: 4, y, width: 32, height: striped ? 4.5 : 4, fill: '#0E1A14' }));
  [8.5, 14.25, 20, 25.75, 31.5].forEach((x, i) => svg.append(el('line', { x1: x, y1: 48, x2: x, y2: i % 2 ? 56 : 58.5, stroke: color, 'stroke-width': 2.6, 'stroke-linecap': 'round' })));
  return svg;
}

function setMe(name: string, level: string) {
  me = name;
  try { sessionStorage.setItem('courtside.me', name); } catch { /* private mode */ }
  text($('askas'), `Asking as ${name} (${cap(level)})`);
  // the viewer's place in creation order decides their scarf for life; an unknown profile gets the first
  const i = scarfIndex(viewers, name);
  document.body.dataset.me = name;
  document.body.style.setProperty('--scarf', scarfFor(i).color);
  $('whoscarf').replaceChildren(scarfSvg(i, 26));
  text($('whoname'), name);
  $('who').hidden = false;
}

function renderProfiles(list: ViewerInfo[]) {
  viewers = list;
  $('profiles').replaceChildren(...list.map(v => {
    const i = scarfIndex(list, v.name);
    const b = document.createElement('button');
    b.className = 'btn profile';
        b.setAttribute('aria-pressed', String(v.name === me));
    const mark = document.createElement('span'); mark.className = 'mark'; mark.setAttribute('aria-hidden', 'true'); mark.append(scarfSvg(i, 40));
    const body = document.createElement('span'); body.className = 'pbody';
    const n = document.createElement('b'); n.textContent = v.name;
    const l = document.createElement('small'); l.textContent = cap(v.level);
    body.append(n, l); b.append(mark, body);
    b.onclick = () => { setMe(v.name, v.level); say(`You are ${v.name}.`, 'ok'); show('ask'); $<HTMLInputElement>('question').focus({ preventScroll: true }); };
    return b;
  }));
  $('profiles').hidden = list.length === 0;
  show('pick');
}

type Reply = { viewers?: ViewerInfo[]; sessionId?: string; message?: string };

async function join() {
  say('');
  const typed = $<HTMLInputElement>('code').value.trim();
  if (!typed) { say('Type the code from the TV first.', 'error'); return; }
  say('Finding your room...', 'busy');
  const r = await busy($<HTMLButtonElement>('join'), 'Joining...', () => call<Reply>('GET', `/households/${encodeURIComponent(typed)}`));
  if (r.status !== 200 || !r.data.viewers) { say(r.data.message ?? 'Something went wrong. Check the code and try again.', 'error'); return; }
  code = typed;
  sessionId = r.data.sessionId ?? '';
  const u = new URL(location.href); u.searchParams.set('code', typed); history.replaceState(null, '', u);
  say(r.data.viewers.length ? 'You are in. Pick yourself, or add yourself below.' : 'You are in. Add yourself below.', 'ok');
  renderProfiles(r.data.viewers);
  let saved = ''; try { saved = sessionStorage.getItem('courtside.me') ?? ''; } catch { /* ignore */ }
  const mine = r.data.viewers.find(v => v.name === saved);
  if (mine) { setMe(mine.name, mine.level); say(`Welcome back, ${mine.name}.`, 'ok'); show('ask'); }
}

async function addMe() {
  const name = $<HTMLInputElement>('name').value;
  if (!name.trim()) { say('Type your name first.', 'error'); $('name').focus(); return; }
  const level = document.querySelector<HTMLInputElement>('input[name="lv"]:checked')?.value ?? 'beginner';
  say('Adding you...', 'busy');
  const r = await busy($<HTMLButtonElement>('addme'), 'Adding you...', () => call<Reply>('POST', `/households/${encodeURIComponent(code)}/viewers`, { name, level }));
  if (r.status !== 200 || !r.data.viewers) { say(r.data.message ?? 'Something went wrong. Try adding yourself again.', 'error'); return; }
  setMe(name.trim(), level);
  renderProfiles(r.data.viewers);
  say(`Added. You are ${name.trim()} (${cap(level)}), now on the TV.`, 'ok');
  show('ask');
}

function showAnswer(d: { ok?: boolean; answer?: string; message?: string }, asked = '') {
  if (d.ok && d.answer) {
    say('');
    text($('asked'), asked ? `You asked: ${asked}` : 'Courtside says');
    text($('answer'), d.answer);
    $('answerbox').hidden = false;
    $('answerbox').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } else say(d.message ?? 'Something went wrong. Try asking again.', 'error');
}

/** The TV may have started a session since this page loaded: ask again, and keep the old id if the call fails. */
async function currentSessionId(): Promise<string> {
  const r = await call<Reply>('GET', `/households/${encodeURIComponent(code)}`);
  if (r.status === 200) sessionId = r.data.sessionId ?? '';
  return sessionId;
}

async function send() {
  const q = $<HTMLInputElement>('question').value;
  if (!q.trim()) { say('Type a question first, or tap the microphone.', 'error'); return; }
  say('Thinking...', 'busy');
  $('answerbox').hidden = true;
  const body: Record<string, string> = { question: q };
  if (me) body.viewerName = me;
  try {
    const sid = await currentSessionId();
    if (sid) body.sessionId = sid;
    const r = await busy($<HTMLButtonElement>('send'), 'Sending...', () => call<{ ok?: boolean; answer?: string; message?: string }>('POST', `/households/${encodeURIComponent(code)}/questions`, body));
    showAnswer(r.data, q.trim());
  } catch { say('Could not reach Courtside - check your connection and try again.', 'error'); }
}

const MAX_RECORD_MS = 8000;
const TARGET_RATE = 16000;

function encodeWav(samples: Float32Array): Uint8Array {
  const out = new Uint8Array(44 + samples.length * 2);
  const v = new DataView(out.buffer);
  const tag = (o: number, s: string) => { for (let i = 0; i < 4; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  tag(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); tag(8, 'WAVE'); tag(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, TARGET_RATE, true); v.setUint32(28, TARGET_RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  tag(36, 'data'); v.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, s)) * 32767), true));
  return out;
}

/** Decode whatever the browser recorded (AAC/mp4 or webm), downmix and resample to 16 kHz mono, write PCM16 WAV. */
async function toWav(blob: Blob): Promise<Uint8Array> {
  {
    // An OfflineAudioContext decodes without needing a user gesture to be unlocked.
    const decoded = await new OfflineAudioContext(1, 1, TARGET_RATE).decodeAudioData(await blob.arrayBuffer());
    const frames = Math.max(1, Math.ceil(Math.min(decoded.duration, 8) * TARGET_RATE));
    const off = new OfflineAudioContext(1, frames, TARGET_RATE); // one channel: the graph downmixes
    const src = off.createBufferSource();
    src.buffer = decoded; src.connect(off.destination); src.start();
    return encodeWav((await off.startRendering()).getChannelData(0));
  }
}

const toBase64 = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };

async function sendAudio(blob: Blob) {
  say('Thinking...', 'busy');
  $('answerbox').hidden = true;
  try {
    const wav = await toWav(blob);
    const body: Record<string, string> = { wavBase64: toBase64(wav) };
    if (me) body.viewerName = me;
    const sid = await currentSessionId();
    if (sid) body.sessionId = sid;
    const r = await call<{ ok?: boolean; answer?: string; message?: string }>('POST', `/households/${encodeURIComponent(code)}/questions/audio`, body);
    showAnswer(r.data, 'your question by voice');
  } catch { say("I didn't catch that - try again or type it.", 'error'); }
}

let recorder: MediaRecorder | undefined;
let held = false;
let starting = false; // a recorder is being set up: a second press must not start another
let stopTimer: ReturnType<typeof setTimeout> | undefined;

const DICTATE_TIP = 'Voice works through your keyboard here: tap the question box and press the microphone key to dictate.';
const micSupported = () => window.isSecureContext && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
const MIC_KEY = 'courtside.mic';
const micExplained = () => { try { return localStorage.getItem(MIC_KEY) === '1'; } catch { return false; } };
const markExplained = () => { try { localStorage.setItem(MIC_KEY, '1'); } catch { /* private mode */ } };

/** Why the mic cannot be used, in words a viewer can act on. */
function micProblem(err: unknown): string {
  if (!window.isSecureContext) return 'Microphone needs a secure (https) page.';
  if (!navigator.mediaDevices?.getUserMedia) return DICTATE_TIP;
  if (typeof MediaRecorder === 'undefined') return 'This browser cannot record audio - update iOS or type your question.';
  const name = (err as { name?: string })?.name ?? 'Error';
  if (name === 'NotAllowedError') return /CriOS/.test(navigator.userAgent)
    ? 'Microphone is blocked for Chrome - turn it on in iPhone Settings > Chrome > Microphone, then reload.'
    : /iPhone|iPad/.test(navigator.userAgent)
      ? 'Microphone is blocked - tap aA in the address bar > Website Settings > Microphone > Allow, then reload.'
      : 'Microphone is blocked - allow it from the lock icon in the address bar, then reload.';
  if (name === 'NotFoundError') return 'No microphone found.';
  return `Microphone not available (${name}) - type your question instead.`;
}

type BlockedKind = 'safari' | 'chrome' | 'other';
const BLOCKED_STEPS: Record<BlockedKind, string[]> = {
  safari: [
    'Tap aA in the address bar, at the left.',
    'Tap Website Settings.',
    'Set Microphone to Allow.',
    'Come back here and tap the button below.',
  ],
  chrome: [
    'Open the iPhone Settings app.',
    'Scroll down and tap Chrome.',
    'Turn on Microphone.',
    'Come back here and tap the button below.',
  ],
  other: [
    'Tap the lock icon in the address bar.',
    'Open the site settings and set Microphone to Allow.',
    'Come back here and tap the button below.',
  ],
};
const blockedKind = (): BlockedKind => /CriOS/.test(navigator.userAgent) ? 'chrome' : /iPhone|iPad/.test(navigator.userAgent) ? 'safari' : 'other';

function showBlocked(kind: BlockedKind) {
  const name = kind === 'chrome' ? 'Chrome' : kind === 'safari' ? 'Safari' : 'Your browser';
  text($('blockedwhy'), `${name} is not letting Courtside use the microphone. You can switch it on again in a few taps.`);
  $('blockedsteps').replaceChildren(...BLOCKED_STEPS[kind].map(t => { const li = document.createElement('li'); li.textContent = t; return li; }));
  say('');
  show('blocked');
}

const talkLabel = (s: string) => text($('talklabel'), s);

async function startTalk() {
  if (held || starting) return;
  held = true;
  starting = true;
  try {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('unsupported');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    markExplained();
    if (!held) { stream.getTracks().forEach(t => t.stop()); return; } // let go before the mic was ready
    const type = ['audio/mp4', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = e => chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      recorder = undefined;
      held = false;
      $('talk').classList.remove('live');
      talkLabel('Ask with your voice');
      if (chunks.length) void sendAudio(new Blob(chunks, { type: rec.mimeType }));
    };
    recorder = rec;
    rec.start();
    say('Listening... tap again to send.', 'busy');
    $('talk').classList.add('live');
    talkLabel('Listening - tap to send');
    stopTimer = setTimeout(stopTalk, MAX_RECORD_MS);
  } catch (err) {
    held = false;
    if ((err as { name?: string })?.name === 'NotAllowedError' && micSupported()) showBlocked(blockedKind());
    else say(micProblem(err), 'error');
  }
  finally { starting = false; }
}

function stopTalk() {
  held = false;
  clearTimeout(stopTimer);
  if (recorder && recorder.state === 'recording') recorder.stop();
}

const talk = $('talk');
// Without in-page recording (some in-app browsers), hide the button and point to keyboard dictation, which needs no permission.
if (!micSupported()) { talk.hidden = true; text($('tip'), DICTATE_TIP); }
// Tap to start, tap to send: more reliable on iOS than hold-to-talk (the permission sheet cancels pointer holds).
talk.addEventListener('click', () => {
  if (recorder && recorder.state === 'recording') stopTalk();
  else if (!micExplained()) { say(''); show('preperm'); }
  else void startTalk();
});
// The real permission request starts inside this tap, so the browser accepts it as a user action.
$('allowmic').onclick = () => { show('ask'); void startTalk(); };
const backToAsk = () => { show('ask'); $<HTMLInputElement>('question').focus({ preventScroll: true }); };
$('typeinstead').onclick = backToAsk;
$('blockedtype').onclick = backToAsk;
$('reload').onclick = () => location.reload();
$('switch').onclick = () => { say(''); renderProfiles(viewers); };

$('join').onclick = () => void join();
$('addme').onclick = () => void addMe();
$('send').onclick = () => void send();
$<HTMLInputElement>('code').addEventListener('keydown', e => { if (e.key === 'Enter') void join(); });
$<HTMLInputElement>('question').addEventListener('keydown', e => { if (e.key === 'Enter') void send(); });

const demo = params.get('demo');
if (demo) {
  // Mock states for design review: no API calls. Loaded only when ?demo= is present.
  void import('./phone-demo.js').then(m => m.runDemo(demo, { show, say, renderProfiles, setMe, showAnswer, showBlocked }));
} else {
  show('join');
  if ($<HTMLInputElement>('code').value) void join();
}
