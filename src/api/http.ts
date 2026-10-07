import { randomUUID } from 'node:crypto';
import { addViewer, byCreation, layerFor, markGotIt, newViewer, nextOrder, normaliseCode, pickViewer, recordAsked, recordBasicShown, routeQuestion, undoPromotion, type Concept, type Layer, type Level, type Viewer } from '../core/index.js';
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

/** A moved-up notice with the viewer it is about, so the TV never has to read a name out of the text. */
export interface Promotion { name: string; message: string }

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
export const MAX_FAILED_JOINS_PER_HOUR = 200; // wrong household codes, whole service
const LEVELS: Level[] = ['beginner', 'fan', 'expert'];
const CONCEPTS: Concept[] = ['penalty kick', 'offside', 'yellow card', 'red card', 'assist', 'shot on goal', 'shot', 'goal', 'extra time', 'penalty shoot-out', 'save'];
const MAX_MOMENT_ID_CHARS = 64;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_EXPIRED = 'Session expired';
/** A session id sent by a client (path or body): absent is fine, anything that is not a UUID is an expired session. */
const badSessionId = (v: unknown) => v !== undefined && v !== null && v !== '' && !(typeof v === 'string' && UUID.test(v));

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

    const item = { id: randomUUID(), label: route.label, layer: route.layer, question: text, answer, at: Date.now() };
    await store.addAnswer(code, item).catch(() => undefined); // best effort: a TV that missed the push catches up from this
    const ids = await store.connections(code);
    if (ids.length) {
      try {
        const gone = await deps.push(ids, { type: 'answer', ...item });
        await Promise.all(gone.map(id => store.removeConnection(id)));
      } catch { /* the phone still gets its answer */ }
    }
    return reply(200, { ok: true, answer });
  }

  async function question(code: string, viewers: Viewers, raw: Record<string, unknown>): Promise<HttpResult> {
    if (badSessionId(raw.sessionId)) return fail(404, SESSION_EXPIRED);
    const text = typeof raw.question === 'string' ? raw.question.trim() : '';
    if (!text) return fail(400, 'Ask a question first');
    if (text.length > MAX_QUESTION_CHARS) return fail(400, `Keep the question under ${MAX_QUESTION_CHARS} characters`);
    const route = await admit(code, viewers, raw);
    return 'layer' in route ? deliverAndNote(code, viewers, raw, route, text) : route;
  }

  async function audioQuestion(code: string, viewers: Viewers, raw: Record<string, unknown>): Promise<HttpResult> {
    if (badSessionId(raw.sessionId)) return fail(404, SESSION_EXPIRED);
    if (typeof raw.wavBase64 !== 'string' || !raw.wavBase64) return fail(400, 'Hold the button and ask first');
    const wav = parseWav(new Uint8Array(Buffer.from(raw.wavBase64, 'base64')));
    if (!wav.ok) return fail(400, wav.message);
    const route = await admit(code, viewers, raw);
    if (!('layer' in route)) return route;
    let text = '';
    try { text = (await (deps.transcribe ??= makeTranscriber())(wav.pcm)).trim().slice(0, MAX_QUESTION_CHARS); }
    catch { /* treated as not heard */ }
    if (!text) return reply(200, { ok: false, message: DIDNT_CATCH });
    return deliverAndNote(code, viewers, raw, route, text);
  }

  /** A household in use does not expire: each visit pushes its items' TTL out (at most once an hour, best effort). */
  const touch = (code: string) => store.touchHousehold(code).catch(() => undefined);

  const findViewer = (viewers: Viewers, name: unknown) =>
    typeof name === 'string' ? viewers.find(v => v.name.toLowerCase() === name.trim().toLowerCase()) : undefined;

  const parseConcepts = (v: unknown): Concept[] | undefined =>
    Array.isArray(v) && v.length <= CONCEPTS.length && v.every(c => CONCEPTS.includes(c as Concept)) ? [...new Set(v as Concept[])] : undefined;

  /** The updated viewers go back to the caller and to every TV; promotions carry the "moved up" messages. */
  async function viewersReply(code: string, viewers: Viewers, promotions: Promotion[]): Promise<HttpResult> {
    await pushViewers(code, viewers, promotions);
    return reply(200, { viewers, promotions });
  }

  async function pushViewers(code: string, viewers: Viewers, promotions: Promotion[]) {
    try {
      const ids = await store.connections(code);
      if (!ids.length) return;
      const gone = await deps.push(ids, { type: 'viewers', viewers, promotions });
      await Promise.all(gone.map(id => store.removeConnection(id)));
    } catch { /* the caller still gets the state */ }
  }

  /** Viewers in creation order (scarf colours follow it). */
  const loadViewers = async (code: string) => { const v = await store.getViewers(code); return v && byCreation(v); };

  /** Read-modify-write one viewer with an optimistic version check; retries once on a conflicting write. */
  async function mutate<T extends { viewer: Viewer }>(code: string, name: string, fn: (v: Viewer) => T): Promise<T | undefined> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const cur = await store.getViewer(code, name);
      if (!cur) return undefined;
      const r = fn(cur.viewer);
      if (await store.putViewerIf(code, r.viewer, cur.version)) return r;
    }
    throw new ConflictError();
  }
  class ConflictError extends Error {}
  const busy = () => fail(409, 'Courtside was busy saving - try again');
  const freshViewers = async (code: string, fallback: Viewers) => (await loadViewers(code)) ?? fallback;

  async function createSession(code: string, viewers: Viewers, raw: Record<string, unknown>): Promise<HttpResult> {
    if (!Array.isArray(raw.present) || raw.present.length === 0) return fail(400, 'Pick who is watching');
    let present: string[] = [];
    for (const n of raw.present) {
      const viewer = findViewer(viewers, n);
      if (!viewer) return fail(400, 'Pick who you are first');
      const r = pickViewer(present, viewer.name);
      if (!r.ok) return fail(400, r.message);
      present = r.present;
    }
    const sessionId = randomUUID();
    await store.putSession(code, sessionId, { present });
    await store.setLatestSession(code, { sessionId });
    await touch(code);
    return reply(200, { sessionId, viewers: present.map(n => viewers.find(v => v.name === n)!) });
  }

  /** The TV says what it showed; the server decides each viewer's layer from stored state (R-02) and counts basic views (R-04). */
  async function shown(code: string, sessionId: string, viewers: Viewers, raw: Record<string, unknown>): Promise<HttpResult> {
    if (badSessionId(sessionId) || !sessionId) return fail(404, SESSION_EXPIRED);
    const momentId = typeof raw.momentId === 'string' ? raw.momentId.trim() : '';
    if (!momentId || momentId.length > MAX_MOMENT_ID_CHARS) return fail(400, 'Missing moment');
    const concepts = parseConcepts(raw.concepts);
    if (!concepts || concepts.length === 0) return fail(400, 'Unknown concept');
    const session = await store.getSession(code, sessionId);
    if (!session) return fail(404, SESSION_EXPIRED);
    const promotions: Promotion[] = [];
    try {
      for (const name of session.present) {
        const viewer = viewers.find(v => v.name === name);
        if (!viewer || layerFor(viewer, concepts) !== 'basic') continue; // removed mid-session, or not shown a basic row
        if (!await store.claimShown(code, sessionId, momentId, name)) continue; // a second TV or a stale tab: already counted
        try {
          // Re-check the layer on every attempt: a conflicting write may have changed what this viewer understands.
          const r = await mutate(code, name, v => layerFor(v, concepts) === 'basic' ? recordBasicShown(v, concepts) : { viewer: v });
          if (r && 'promotion' in r && r.promotion) promotions.push({ name, message: r.promotion });
        } catch (e) {
          await store.releaseShown(code, sessionId, momentId, name).catch(() => undefined); // so a retry still counts the view
          throw e;
        }
      }
    } catch (e) { if (e instanceof ConflictError) return busy(); throw e; }
    const seq = typeof raw.seq === 'number' && Number.isFinite(raw.seq) ? raw.seq : undefined;
    const stale = seq !== undefined && session.seq !== undefined && seq <= session.seq; // an older moment must not replace the current one
    if (!stale) {
      await store.putSession(code, sessionId, { ...session, momentId, concepts, ...(seq !== undefined ? { seq } : {}) });
      const latest = await store.latestSession(code);
      if (!latest || latest.sessionId === sessionId) await store.setLatestSession(code, { sessionId, momentId });
    }
    return viewersReply(code, await freshViewers(code, viewers), promotions);
  }

  async function gotIt(code: string, viewers: Viewers, name: string, raw: Record<string, unknown>): Promise<HttpResult> {
    const viewer = findViewer(viewers, name);
    if (!viewer) return fail(404, 'Unknown viewer');
    const concepts = parseConcepts(raw.concepts);
    if (!concepts || concepts.length === 0) return fail(400, 'Unknown concept');
    try {
      const r = await mutate(code, viewer.name, v => {
        let cur = v; const promotions: Promotion[] = [];
        for (const c of concepts) { const g = markGotIt(cur, c); cur = g.viewer; if (g.promotion) promotions.push({ name: viewer.name, message: g.promotion }); }
        return { viewer: cur, promotions };
      });
      return viewersReply(code, await freshViewers(code, viewers), r?.promotions ?? []);
    } catch (e) { if (e instanceof ConflictError) return busy(); throw e; }
  }

  async function undo(code: string, viewers: Viewers, name: string): Promise<HttpResult> {
    const viewer = findViewer(viewers, name);
    if (!viewer) return fail(404, 'Unknown viewer');
    try {
      await mutate(code, viewer.name, v => ({ viewer: undoPromotion(v) }));
      return viewersReply(code, await freshViewers(code, viewers), []);
    } catch (e) { if (e instanceof ConflictError) return busy(); throw e; }
  }

  /** R-04-c: a question that names a concept of the moment on screen (whole words, simple plurals) resets that concept's view count for the asker. */
  async function noteAsked(code: string, viewers: Viewers, raw: Record<string, unknown>, text: string) {
    if (typeof raw.sessionId !== 'string') return;
    const asker = findViewer(viewers, raw.viewerName);
    const session = await store.getSession(code, raw.sessionId);
    if (!asker || !session?.concepts || !session.present.includes(asker.name)) return;
    const named = session.concepts.filter(c => new RegExp(`(?<![a-z0-9])${c}(?:e?s)?(?![a-z0-9])`, 'i').test(text));
    if (!named.length) return;
    await mutate(code, asker.name, v => ({ viewer: named.reduce((x, c) => recordAsked(x, c as Concept), v) }));
  }

  async function deliverAndNote(code: string, viewers: Viewers, raw: Record<string, unknown>, route: Route, text: string) {
    const res = await deliver(code, route, text);
    if (res.statusCode === 200 && (JSON.parse(res.body) as { ok?: boolean }).ok === true) await noteAsked(code, viewers, raw, text).catch(() => undefined);
    return res;
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
    // Guessing codes is the only way in without one: after too many wrong codes in an hour, every code lookup waits.
    if (await store.failedJoins().catch(() => 0) >= MAX_FAILED_JOINS_PER_HOUR) return fail(429, 'Too many wrong codes - try again later');
    const viewers = await loadViewers(code);
    if (!viewers) { await store.addFailedJoin().catch(() => undefined); return fail(404, 'Unknown code'); }

    if (parts.length === 2 && method === 'GET') {
      await touch(code);
      // sessionId: the newest session, so a phone can send it with its questions; recentAnswers: for a TV whose socket dropped
      const [latest, recentAnswers] = await Promise.all([store.latestSession(code), store.recentAnswers(code)]);
      return reply(200, { viewers, ...(latest ? { sessionId: latest.sessionId } : {}), recentAnswers });
    }
    if (parts.length === 3 && parts[2] === 'viewers' && method === 'POST') {
      const level = raw.level as Level;
      if (!LEVELS.includes(level)) return fail(400, 'Pick a level');
      if (viewers.length >= MAX_PROFILES_PER_HOUSEHOLD) return fail(400, `A household can have up to ${MAX_PROFILES_PER_HOUSEHOLD} viewers`);
      const name = typeof raw.name === 'string' ? raw.name.slice(0, 30) : '';
      const r = addViewer(viewers, newViewer(name, level, nextOrder(viewers)));
      if (!r.ok) return fail(400, r.message);
      await store.putViewer(code, r.profiles[r.profiles.length - 1]!);
      const sorted = byCreation(r.profiles);
      await pushViewers(code, sorted, []); // TVs on Who's watching show the newcomer without polling
      return reply(200, { viewers: sorted });
    }
    if (parts.length === 3 && parts[2] === 'questions' && method === 'POST') return question(code, viewers, raw);
    if (parts.length === 4 && parts[2] === 'questions' && parts[3] === 'audio' && method === 'POST') return audioQuestion(code, viewers, raw);
    if (parts[2] === 'sessions' && method === 'POST') {
      if (parts.length === 3) return createSession(code, viewers, raw);
      if (parts.length === 5 && parts[4] === 'shown') return shown(code, parts[3]!, viewers, raw);
    }
    if (parts[2] === 'viewers' && parts.length === 5 && method === 'POST') {
      if (parts[4] === 'got-it') return gotIt(code, viewers, parts[3]!, raw);
      if (parts[4] === 'undo-promotion') return undo(code, viewers, parts[3]!);
    }
    return fail(404, 'Not found');
  };
}

export const handler = (event: HttpEvent) =>
  makeHttpHandler({ store: dynamoStore(), answer: answerQuestion, push: postToConnections() })(event);
