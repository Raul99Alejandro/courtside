import { addViewer, newViewer, normaliseCode, routeQuestion, type Layer, type Level } from '../core/index.js';
import { answerQuestion, FALLBACK_ANSWER } from '../explain/answer.js';
import { postToConnections, type Push } from './push.js';
import { dynamoStore, type Store } from './store.js';
import { DIDNT_CATCH, makeTranscriber, MAX_WAV_BYTES, parseWav, type Transcriber } from './transcribe.js';

export interface HttpEvent {
  rawPath: string;
  body?: string | null;
  isBase64Encoded?: boolean;
  requestContext: { http: { method: string } };
}
export interface HttpResult { statusCode: number; headers: Record<string, string>; body: string }

export interface Deps {
  store: Store;
  answer: (i: { question: string; layer: Layer; viewerName: string }) => Promise<string>;
  push: Push;
  transcribe?: Transcriber;
}

export const MAX_BODY_BYTES = 2048;
export const MAX_AUDIO_BODY_BYTES = Math.ceil(MAX_WAV_BYTES / 3) * 4 + 1024; // base64 of the largest WAV + JSON envelope
export const MAX_QUESTION_CHARS = 300;
export const MAX_QUESTIONS_PER_HOUR = 30;
export const MAX_GLOBAL_QUESTIONS_PER_HOUR = 300; // cost cap for the whole service
export const MAX_GLOBAL_QUESTIONS_PER_DAY = 600;
export const MAX_PROFILES_PER_HOUSEHOLD = 10;
const LEVELS: Level[] = ['beginner', 'fan', 'expert'];

const reply = (statusCode: number, data: unknown): HttpResult => ({ statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
const fail = (statusCode: number, message: string) => reply(statusCode, { message });

export function makeHttpHandler(deps: Deps) {
  const { store } = deps;

  type Viewers = Awaited<ReturnType<Store['getViewers']>> & object;
  type Route = Extract<ReturnType<typeof routeQuestion>, { ok: true }>;

  /** Who is asking, and are we under the caps? Shared by the text and audio routes. */
  async function admit(code: string, viewers: Viewers, raw: Record<string, unknown>): Promise<Route | HttpResult> {
    const name = typeof raw.viewerName === 'string' ? raw.viewerName.trim().toLowerCase() : '';
    // R-06-b: no name, or a name that is not in this household, both mean "pick who you are".
    const viewer = viewers.find(v => v.name.toLowerCase() === name);
    const route = routeQuestion({ viewer });
    if (!route.ok) return fail(400, route.phoneMessage);
    // Household first: a capped household must not eat the service-wide budget.
    if (await store.countHousehold(code) > MAX_QUESTIONS_PER_HOUR) return fail(429, 'Too many questions this hour - try again later');
    const global = await store.countGlobal();
    if (global.hour > MAX_GLOBAL_QUESTIONS_PER_HOUR || global.day > MAX_GLOBAL_QUESTIONS_PER_DAY) return fail(429, 'Courtside is busy right now - try again in a little while');
    return route;
  }

  async function deliver(code: string, route: Route, text: string): Promise<HttpResult> {
    let answer: string;
    try { answer = await deps.answer({ question: text, layer: route.layer, viewerName: route.label }); }
    catch { answer = FALLBACK_ANSWER; }
    if (!answer || answer === FALLBACK_ANSWER) return reply(200, { ok: false, message: FALLBACK_ANSWER });

    const ids = await store.connections(code);
    if (ids.length) {
      try {
        const gone = await deps.push(ids, { type: 'answer', label: route.label, layer: route.layer, question: text, answer });
        await Promise.all(gone.map(id => store.removeConnection(id)));
      } catch { /* the phone still gets its answer */ }
    }
    return reply(200, { ok: true, answer });
  }

  async function question(code: string, viewers: Viewers, raw: Record<string, unknown>): Promise<HttpResult> {
    const text = typeof raw.question === 'string' ? raw.question.trim() : '';
    if (!text) return fail(400, 'Ask a question first');
    if (text.length > MAX_QUESTION_CHARS) return fail(400, `Keep the question under ${MAX_QUESTION_CHARS} characters`);
    const route = await admit(code, viewers, raw);
    return 'layer' in route ? deliver(code, route, text) : route;
  }

  async function audioQuestion(code: string, viewers: Viewers, raw: Record<string, unknown>): Promise<HttpResult> {
    if (typeof raw.wavBase64 !== 'string' || !raw.wavBase64) return fail(400, 'Hold the button and ask first');
    const wav = parseWav(new Uint8Array(Buffer.from(raw.wavBase64, 'base64')));
    if (!wav.ok) return fail(400, wav.message);
    const route = await admit(code, viewers, raw);
    if (!('layer' in route)) return route;
    let text = '';
    try { text = (await (deps.transcribe ??= makeTranscriber())(wav.pcm)).trim().slice(0, MAX_QUESTION_CHARS); }
    catch { /* treated as not heard */ }
    if (!text) return reply(200, { ok: false, message: DIDNT_CATCH });
    return deliver(code, route, text);
  }

  return async (event: HttpEvent): Promise<HttpResult> => {
    const method = event.requestContext.http.method;
    let parts: string[];
    try { parts = event.rawPath.split('/').filter(Boolean).map(decodeURIComponent); }
    catch { return fail(404, 'Unknown code'); }
    if (parts[0] !== 'households') return fail(404, 'Not found');

    if (parts.length === 1) {
      if (method !== 'POST') return fail(404, 'Not found');
      return reply(200, await store.createHousehold());
    }

    let raw: Record<string, unknown> = {};
    if (method === 'POST') {
      const body = event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body) : '';
      const isAudio = parts.length === 4 && parts[2] === 'questions' && parts[3] === 'audio';
      if (Buffer.byteLength(body) > (isAudio ? MAX_AUDIO_BODY_BYTES : MAX_BODY_BYTES)) return fail(400, 'Request is too big');
      try {
        const p: unknown = body ? JSON.parse(body) : {};
        raw = p && typeof p === 'object' && !Array.isArray(p) ? p as Record<string, unknown> : {};
      } catch { return fail(400, 'Request is not valid JSON'); }
    }

    const code = normaliseCode(parts[1] ?? '');
    const viewers = await store.getViewers(code);
    if (!viewers) return fail(404, 'Unknown code');

    if (parts.length === 2 && method === 'GET') return reply(200, { viewers });
    if (parts.length === 3 && parts[2] === 'viewers' && method === 'POST') {
      const level = raw.level as Level;
      if (!LEVELS.includes(level)) return fail(400, 'Pick a level');
      if (viewers.length >= MAX_PROFILES_PER_HOUSEHOLD) return fail(400, `A household can have up to ${MAX_PROFILES_PER_HOUSEHOLD} viewers`);
      const name = typeof raw.name === 'string' ? raw.name.slice(0, 30) : '';
      const r = addViewer(viewers, newViewer(name, level));
      if (!r.ok) return fail(400, r.message);
      await store.putViewer(code, r.profiles[r.profiles.length - 1]!);
      return reply(200, { viewers: r.profiles });
    }
    if (parts.length === 3 && parts[2] === 'questions' && method === 'POST') return question(code, viewers, raw);
    if (parts.length === 4 && parts[2] === 'questions' && parts[3] === 'audio' && method === 'POST') return audioQuestion(code, viewers, raw);
    return fail(404, 'Not found');
  };
}

export const handler = (event: HttpEvent) =>
  makeHttpHandler({ store: dynamoStore(), answer: answerQuestion, push: postToConnections() })(event);
