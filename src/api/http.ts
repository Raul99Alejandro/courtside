import { addViewer, newViewer, normaliseCode, routeQuestion, type Layer, type Level } from '../core/index.js';
import { answerQuestion, FALLBACK_ANSWER } from '../explain/answer.js';
import { postToConnections, type Push } from './push.js';
import { dynamoStore, type Store } from './store.js';

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
}

export const MAX_BODY_BYTES = 2048;
export const MAX_QUESTION_CHARS = 300;
export const MAX_QUESTIONS_PER_HOUR = 30;
const LEVELS: Level[] = ['beginner', 'fan', 'expert'];

const reply = (statusCode: number, data: unknown): HttpResult => ({ statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
const fail = (statusCode: number, message: string) => reply(statusCode, { message });

export function makeHttpHandler(deps: Deps) {
  const { store } = deps;

  async function question(code: string, viewers: Awaited<ReturnType<Store['getViewers']>> & object, raw: Record<string, unknown>): Promise<HttpResult> {
    const text = typeof raw.question === 'string' ? raw.question.trim() : '';
    if (!text) return fail(400, 'Ask a question first');
    if (text.length > MAX_QUESTION_CHARS) return fail(400, `Keep the question under ${MAX_QUESTION_CHARS} characters`);
    const name = typeof raw.viewerName === 'string' ? raw.viewerName.trim().toLowerCase() : '';
    // R-06-b: no name, or a name that is not in this household, both mean "pick who you are".
    const viewer = viewers.find(v => v.name.toLowerCase() === name);
    const route = routeQuestion({ viewer });
    if (!route.ok) return fail(400, route.phoneMessage);
    if (await store.countQuestion(code) > MAX_QUESTIONS_PER_HOUR) return fail(429, 'Too many questions this hour - try again later');

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

  return async (event: HttpEvent): Promise<HttpResult> => {
    const method = event.requestContext.http.method;
    const parts = event.rawPath.split('/').filter(Boolean).map(decodeURIComponent);
    if (parts[0] !== 'households') return fail(404, 'Not found');

    if (parts.length === 1) {
      if (method !== 'POST') return fail(404, 'Not found');
      return reply(200, await store.createHousehold());
    }

    let raw: Record<string, unknown> = {};
    if (method === 'POST') {
      const body = event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body) : '';
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) return fail(400, 'Request is too big');
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
      const name = typeof raw.name === 'string' ? raw.name.slice(0, 30) : '';
      const r = addViewer(viewers, newViewer(name, level));
      if (!r.ok) return fail(400, r.message);
      await store.putViewer(code, r.profiles[r.profiles.length - 1]!);
      return reply(200, { viewers: r.profiles });
    }
    if (parts.length === 3 && parts[2] === 'questions' && method === 'POST') return question(code, viewers, raw);
    return fail(404, 'Not found');
  };
}

export const handler = (event: HttpEvent) =>
  makeHttpHandler({ store: dynamoStore(), answer: answerQuestion, push: postToConnections() })(event);
