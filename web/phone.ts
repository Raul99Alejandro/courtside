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
  if (!name.trim()) { text(msg, 'Type your name first.'); return; }
  text(msg, 'Adding...');
  const level = $<HTMLSelectElement>('level').value;
  const r = await call<Reply>('POST', `/households/${encodeURIComponent(code)}/viewers`, { name, level });
  if (r.status !== 200 || !r.data.viewers) { text(msg, r.data.message ?? 'Something went wrong'); return; }
  me = name.trim();
  text(msg, '');
  renderProfiles(r.data.viewers);
}

function showAnswer(d: { ok?: boolean; answer?: string; message?: string }) {
  if (d.ok && d.answer) { text(msg, ''); text($('answer'), d.answer); $('answer').className = 'card'; }
  else text(msg, d.message ?? 'Something went wrong');
}

async function send() {
  text(msg, 'Thinking...');
  const body: Record<string, string> = { question: $<HTMLInputElement>('question').value };
  if (me) body.viewerName = me;
  try {
    const r = await call<{ ok?: boolean; answer?: string; message?: string }>('POST', `/households/${encodeURIComponent(code)}/questions`, body);
    showAnswer(r.data);
  } catch { text(msg, 'Could not reach Courtside - check your connection and try again.'); }
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
  text(msg, 'Thinking...');
  try {
    const wav = await toWav(blob);
    const body: Record<string, string> = { wavBase64: toBase64(wav) };
    if (me) body.viewerName = me;
    const r = await call<{ ok?: boolean; answer?: string; message?: string }>('POST', `/households/${encodeURIComponent(code)}/questions/audio`, body);
    showAnswer(r.data);
  } catch { text(msg, "I didn't catch that - try again or type it."); }
}

let recorder: MediaRecorder | undefined;
let held = false;
let starting = false; // a recorder is being set up: a second press must not start another
let stopTimer: ReturnType<typeof setTimeout> | undefined;

const DICTATE_TIP = 'Voice works through your keyboard here: tap the question box and press the microphone key to dictate.';
const micSupported = () => window.isSecureContext && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

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

async function startTalk() {
  if (held || starting) return;
  held = true;
  starting = true;
  try {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('unsupported');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (!held) { stream.getTracks().forEach(t => t.stop()); return; } // let go before the mic was ready
    const type = ['audio/mp4', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = e => chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      recorder = undefined;
      held = false;
      $('talk').textContent = 'Tap to ask';
      if (chunks.length) void sendAudio(new Blob(chunks, { type: rec.mimeType }));
    };
    recorder = rec;
    rec.start();
    text(msg, 'Listening...');
    $('talk').textContent = 'Listening - tap to send';
    stopTimer = setTimeout(stopTalk, MAX_RECORD_MS);
  } catch (err) { held = false; text(msg, micProblem(err)); }
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
talk.addEventListener('click', () => { if (recorder && recorder.state === 'recording') stopTalk(); else void startTalk(); });

$('join').onclick = () => void join();
$('addme').onclick = () => void addMe();
$('send').onclick = () => void send();
if ($<HTMLInputElement>('code').value) void join();
