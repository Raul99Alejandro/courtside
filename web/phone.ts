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

function showAnswer(d: { ok?: boolean; answer?: string; message?: string }) {
  if (d.ok && d.answer) { text(msg, ''); text($('answer'), d.answer); $('answer').className = 'card'; }
  else text(msg, d.message ?? 'Something went wrong');
}

async function send() {
  text(msg, 'Thinking...');
  const body: Record<string, string> = { question: $<HTMLInputElement>('question').value };
  if (me) body.viewerName = me;
  const r = await call<{ ok?: boolean; answer?: string; message?: string }>('POST', `/households/${encodeURIComponent(code)}/questions`, body);
  showAnswer(r.data);
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
let stopTimer: ReturnType<typeof setTimeout> | undefined;

async function startTalk() {
  if (held) return;
  held = true;
  try {
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
      $('talk').textContent = 'Hold to ask';
      if (chunks.length) void sendAudio(new Blob(chunks, { type: rec.mimeType }));
    };
    recorder = rec;
    rec.start();
    text(msg, 'Listening...');
    $('talk').textContent = 'Listening - let go to send';
    stopTimer = setTimeout(stopTalk, MAX_RECORD_MS);
  } catch { held = false; text(msg, 'Microphone not available - type your question instead.'); }
}

function stopTalk() {
  held = false;
  clearTimeout(stopTimer);
  if (recorder && recorder.state === 'recording') recorder.stop();
}

const talk = $('talk');
talk.addEventListener('pointerdown', e => { e.preventDefault(); void startTalk(); });
['pointerup', 'pointercancel', 'pointerleave'].forEach(n => talk.addEventListener(n, stopTalk));
talk.addEventListener('contextmenu', e => e.preventDefault());

$('join').onclick = () => void join();
$('addme').onclick = () => void addMe();
$('send').onclick = () => void send();
if ($<HTMLInputElement>('code').value) void join();
