import { beforeEach, describe, expect, it } from 'vitest';
import { newViewer, PROMOTE_AT, type Viewer } from '../src/core/index.js';
import { makeHttpHandler, type HttpEvent } from '../src/api/http.js';
import type { Session, Store } from '../src/api/store.js';
import { wav } from './wav.js';

const FALLBACK = "I couldn't answer that right now - try again in a moment.";

function fakeStore(rateStart = 0, globalStart = 0, dayStart = 0) {
  const households = new Map<string, Viewer[]>();
  const conns = new Map<string, string[]>();
  let rate = rateStart;
  let globalRate = globalStart;
  let dayRate = dayStart;
  const removed: string[] = [];
  const sessions = new Map<string, Session>();
  const claims = new Set<string>();
  const store: Store = {
    async createHousehold() { households.set('ABC234', []); return { householdId: 'hh-1', code: 'ABC234' }; },
    async getViewers(code) { return households.get(code); },
    async putViewer(code, v) {
      const list = households.get(code) ?? [];
      const i = list.findIndex(x => x.name.toLowerCase() === v.name.toLowerCase());
      households.set(code, i < 0 ? [...list, v] : list.map((x, j) => j === i ? v : x));
    },
    async getSession(code, id) { return sessions.get(`${code}#${id}`); },
    async putSession(code, id, session) { sessions.set(`${code}#${id}`, session); },
    async claimShown(code, sid, mid, viewer) { const k = `${code}#${sid}#${mid}#${viewer}`; if (claims.has(k)) return false; claims.add(k); return true; },
    async addConnection(code, id) { conns.set(code, [...(conns.get(code) ?? []), id]); },
    async removeConnection(id) { removed.push(id); },
    async connections(code) { return conns.get(code) ?? []; },
    async countHousehold() { return ++rate; },
    async countGlobal() { return { hour: ++globalRate, day: ++dayRate }; },
  };
  return { store, households, conns, sessions, removed, counters: () => ({ rate, globalRate, dayRate }) };
}

const ev = (method: string, path: string, body?: unknown): HttpEvent => ({
  rawPath: path, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  requestContext: { http: { method } },
});
const json = (r: { body?: string }) => JSON.parse(r.body ?? '{}');

describe('http handler', () => {
  let f: ReturnType<typeof fakeStore>;
  let pushed: { ids: string[]; payload: unknown }[];
  let asked: { question: string; layer: string; viewerName: string }[];
  let answerFn: (i: { question: string; layer: 'basic' | 'intermediate' | 'tactical'; viewerName: string }) => Promise<string>;
  const handler = () => makeHttpHandler({
    store: f.store,
    answer: i => { asked.push(i); return answerFn(i); },
    push: async (ids, payload) => { pushed.push({ ids, payload }); return []; },
  });

  beforeEach(() => {
    f = fakeStore(); pushed = []; asked = [];
    answerFn = async () => 'An offside is when a player is ahead of the defenders.';
    f.households.set('ABC234', [newViewer('Leo', 'beginner')]);
    f.conns.set('ABC234', ['c1', 'c2']);
  });

  it('creates a household', async () => {
    const r = await handler()(ev('POST', '/households'));
    expect(r.statusCode).toBe(200);
    expect(json(r)).toEqual({ householdId: 'hh-1', code: 'ABC234' });
  });

  it('unknown code is 404', async () => {
    const r = await handler()(ev('GET', '/households/ZZZZZZ'));
    expect(r.statusCode).toBe(404);
    expect(json(r)).toEqual({ message: 'Unknown code' });
  });

  it('resolves a lower-case code with spaces', async () => {
    const r = await handler()(ev('GET', '/households/abc%20234'));
    expect(r.statusCode).toBe(200);
    expect(json(r).viewers).toHaveLength(1);
  });

  it('adds a viewer and rejects duplicates and bad levels', async () => {
    const ok = await handler()(ev('POST', '/households/ABC234/viewers', { name: 'Mia', level: 'fan' }));
    expect(ok.statusCode).toBe(200);
    expect(json(ok).viewers.map((v: Viewer) => v.name)).toEqual(['Leo', 'Mia']);
    const dup = await handler()(ev('POST', '/households/ABC234/viewers', { name: 'leo', level: 'fan' }));
    expect(dup.statusCode).toBe(400);
    expect(json(dup).message).toBe('leo already exists');
    const bad = await handler()(ev('POST', '/households/ABC234/viewers', { name: 'Zed', level: 'god' }));
    expect(bad.statusCode).toBe(400);
  });

  it('a question without viewerName is 400 Pick who you are first (R-06-b)', async () => {
    const r = await handler()(ev('POST', '/households/ABC234/questions', { question: 'What is offside?' }));
    expect(r.statusCode).toBe(400);
    expect(json(r).message).toBe('Pick who you are first');
    expect(asked).toHaveLength(0);
  });

  it('a viewerName that is not in the household is 400 Pick who you are first', async () => {
    const r = await handler()(ev('POST', '/households/ABC234/questions', { viewerName: 'Nobody', question: 'What is offside?' }));
    expect(r.statusCode).toBe(400);
    expect(json(r).message).toBe('Pick who you are first');
  });

  it('answers a known viewer, pushes once to each TV and returns the answer', async () => {
    const r = await handler()(ev('POST', '/households/abc234/questions', { viewerName: 'leo', question: 'What is offside?' }));
    expect(r.statusCode).toBe(200);
    expect(json(r)).toEqual({ ok: true, answer: 'An offside is when a player is ahead of the defenders.' });
    expect(asked).toEqual([{ question: 'What is offside?', layer: 'basic', viewerName: 'Leo' }]);
    expect(pushed).toHaveLength(1);
    expect(pushed[0]!.ids).toEqual(['c1', 'c2']);
    expect(pushed[0]!.payload).toEqual({ type: 'answer', label: 'Leo', layer: 'basic', question: 'What is offside?', answer: 'An offside is when a player is ahead of the defenders.' });
  });

  it('forgets connections the push reports gone', async () => {
    const h = makeHttpHandler({ store: f.store, answer: async () => 'ok', push: async () => ['c2'] });
    await h(ev('POST', '/households/ABC234/questions', { viewerName: 'Leo', question: 'Why?' }));
    expect(f.removed).toEqual(['c2']);
  });

  it('answer failure is a friendly 200 and nothing is pushed', async () => {
    answerFn = async () => { throw new Error('bedrock down'); };
    const r = await handler()(ev('POST', '/households/ABC234/questions', { viewerName: 'Leo', question: 'What is offside?' }));
    expect(r.statusCode).toBe(200);
    expect(json(r)).toEqual({ ok: false, message: FALLBACK });
    expect(pushed).toHaveLength(0);
  });

  it('the friendly fallback text from answerQuestion is not pushed either', async () => {
    answerFn = async () => FALLBACK;
    const r = await handler()(ev('POST', '/households/ABC234/questions', { viewerName: 'Leo', question: 'What is offside?' }));
    expect(json(r).ok).toBe(false);
    expect(pushed).toHaveLength(0);
  });

  it('rejects a body over 2 KB, a question over 300 characters, an empty one and bad JSON', async () => {
    const big = await handler()(ev('POST', '/households/ABC234/questions', { viewerName: 'Leo', question: 'x'.repeat(3000) }));
    expect(big.statusCode).toBe(400);
    const long = await handler()(ev('POST', '/households/ABC234/questions', { viewerName: 'Leo', question: 'x'.repeat(301) }));
    expect(long.statusCode).toBe(400);
    const empty = await handler()(ev('POST', '/households/ABC234/questions', { viewerName: 'Leo', question: '  ' }));
    expect(empty.statusCode).toBe(400);
    const junk = await handler()(ev('POST', '/households/ABC234/questions', '{not json'));
    expect(junk.statusCode).toBe(400);
  });

  it('allows 30 questions an hour and refuses the 31st', async () => {
    f = fakeStore(29);
    f.households.set('ABC234', [newViewer('Leo', 'beginner')]);
    const q = () => handler()(ev('POST', '/households/ABC234/questions', { viewerName: 'Leo', question: 'Why?' }));
    expect((await q()).statusCode).toBe(200);
    const r = await q();
    expect(r.statusCode).toBe(429);
    expect(json(r).message).toMatch(/too many questions/i);
  });

  it('refuses with a friendly 429 once the service-wide hourly cap of 300 is reached', async () => {
    f = fakeStore(0, 299);
    f.households.set('ABC234', [newViewer('Leo', 'beginner')]);
    const q = () => handler()(ev('POST', '/households/ABC234/questions', { viewerName: 'Leo', question: 'Why?' }));
    expect((await q()).statusCode).toBe(200);
    const r = await q();
    expect(r.statusCode).toBe(429);
    expect(json(r).message).toMatch(/busy/i);
    expect(asked).toHaveLength(1);
  });

  it('a capped household does not consume the global budget', async () => {
    f = fakeStore(30);
    f.households.set('ABC234', [newViewer('Leo', 'beginner')]);
    const r = await handler()(ev('POST', '/households/ABC234/questions', { viewerName: 'Leo', question: 'Why?' }));
    expect(r.statusCode).toBe(429);
    expect(f.counters().globalRate).toBe(0);
    expect(f.counters().dayRate).toBe(0);
  });

  it('refuses with the friendly 429 once the daily cap of 600 is reached', async () => {
    f = fakeStore(0, 0, 599);
    f.households.set('ABC234', [newViewer('Leo', 'beginner')]);
    const q = () => handler()(ev('POST', '/households/ABC234/questions', { viewerName: 'Leo', question: 'Why?' }));
    expect((await q()).statusCode).toBe(200);
    const r = await q();
    expect(r.statusCode).toBe(429);
    expect(json(r).message).toMatch(/busy/i);
  });

  it('caps a household at 10 profiles with a friendly 400', async () => {
    f = fakeStore();
    f.households.set('ABC234', Array.from({ length: 10 }, (_, i) => newViewer(`V${i}`, 'fan')));
    const r = await handler()(ev('POST', '/households/ABC234/viewers', { name: 'Extra', level: 'fan' }));
    expect(r.statusCode).toBe(400);
    expect(json(r).message).toMatch(/up to 10/);
  });

  it('a malformed percent-encoding in the code is 404 Unknown code', async () => {
    const r = await handler()(ev('GET', '/households/%E0%A4%A'));
    expect(r.statusCode).toBe(404);
    expect(json(r)).toEqual({ message: 'Unknown code' });
  });

  it('unknown route is 404', async () => {
    expect((await handler()(ev('GET', '/nope'))).statusCode).toBe(404);
  });
  describe('learning state', () => {
    const post = (path: string, body?: unknown) => handler()(ev('POST', `/households/ABC234${path}`, body));
    const startSession = async (present: string[]) => json(await post('/sessions', { present })).sessionId as string;
    const leo = () => f.households.get('ABC234')!.find(v => v.name === 'Leo')!;

    it('creates a session for known viewers (any case) and returns them', async () => {
      const r = await post('/sessions', { present: ['leo'] });
      expect(r.statusCode).toBe(200);
      expect(json(r).sessionId).toMatch(/[0-9a-f-]{36}/);
      expect(json(r).viewers.map((v: Viewer) => v.name)).toEqual(['Leo']);
    });

    it('refuses an unknown viewer, an empty list and a fourth viewer (R-09)', async () => {
      for (const n of ['Mia', 'Zed', 'Kim']) await post('/viewers', { name: n, level: 'fan' });
      expect((await post('/sessions', { present: ['Nobody'] })).statusCode).toBe(400);
      expect((await post('/sessions', { present: [] })).statusCode).toBe(400);
      expect((await post('/sessions', {})).statusCode).toBe(400);
      const four = await post('/sessions', { present: ['Leo', 'Mia', 'Zed', 'Kim'] });
      expect(four.statusCode).toBe(400);
      expect(json(four).message).toBe('Up to 3 viewers at a time');
      expect((await post('/sessions', { present: ['Leo', 'leo', 'Mia', 'Zed'] })).statusCode).toBe(200);
    });

    it('shown counts a basic view once per moment, however often it is sent (two TVs)', async () => {
      const sessionId = await startSession(['Leo']);
      const body = { momentId: 'm1', concepts: ['offside'], layerByViewer: { Leo: 'basic' } };
      const a = await post(`/sessions/${sessionId}/shown`, body);
      const b = await post(`/sessions/${sessionId}/shown`, body);
      expect(a.statusCode).toBe(200);
      expect(json(a)).toMatchObject({ promotions: [] });
      expect(json(b).viewers[0].seenBasic).toEqual({ offside: 1 });
      expect(leo().seenBasic).toEqual({ offside: 1 });
      await post(`/sessions/${sessionId}/shown`, { ...body, momentId: 'm2' });
      expect(leo().understood).toEqual(['offside']); // second view makes it understood (R-04)
    });

    it('shown ignores viewers whose layer was not basic', async () => {
      const sessionId = await startSession(['Leo']);
      await post(`/sessions/${sessionId}/shown`, { momentId: 'm1', concepts: ['offside'], layerByViewer: { Leo: 'intermediate' } });
      expect(leo().seenBasic).toEqual({});
    });

    it('shown pushes viewers and promotions to every TV', async () => {
      f.households.set('ABC234', [{ ...newViewer('Leo', 'beginner'), understood: ['goal', 'shot', 'save', 'assist'] }]);
      const sessionId = await startSession(['Leo']);
      const body = { concepts: ['offside'], layerByViewer: { Leo: 'basic' } };
      await post(`/sessions/${sessionId}/shown`, { ...body, momentId: 'm1' });
      const r = await post(`/sessions/${sessionId}/shown`, { ...body, momentId: 'm2' });
      expect(json(r).promotions).toEqual(['Leo moved up to Fan']);
      expect(leo().level).toBe('fan');
      const last = pushed[pushed.length - 1]!;
      expect(last.ids).toEqual(['c1', 'c2']);
      expect(last.payload).toMatchObject({ type: 'viewers', promotions: ['Leo moved up to Fan'] });
    });

    it('shown: bad input, unknown or expired session', async () => {
      const sessionId = await startSession(['Leo']);
      expect((await post(`/sessions/${sessionId}/shown`, { concepts: ['offside'], layerByViewer: {} })).statusCode).toBe(400);
      expect((await post(`/sessions/${sessionId}/shown`, { momentId: 'm', concepts: ['bogus'], layerByViewer: {} })).statusCode).toBe(400);
      const gone = await post('/sessions/nope/shown', { momentId: 'm', concepts: ['offside'], layerByViewer: { Leo: 'basic' } });
      expect(gone.statusCode).toBe(404);
      expect(json(gone).message).toBe('Session expired');
    });

    it('shown skips a viewer removed mid-session', async () => {
      const sessionId = await startSession(['Leo']);
      f.households.set('ABC234', [newViewer('Mia', 'beginner')]);
      const r = await post(`/sessions/${sessionId}/shown`, { momentId: 'm', concepts: ['offside'], layerByViewer: { Leo: 'basic' } });
      expect(r.statusCode).toBe(200);
      expect(json(r).viewers.map((v: Viewer) => v.name)).toEqual(['Mia']);
    });

    it('got-it marks understood, promotes at 5, and undo-promotion reverses it for good', async () => {
      const concepts = ['goal', 'shot', 'save', 'assist', 'offside'];
      expect(concepts).toHaveLength(PROMOTE_AT);
      const r = await post('/viewers/leo/got-it', { concepts });
      expect(json(r).promotions).toEqual(['Leo moved up to Fan']);
      expect(leo()).toMatchObject({ level: 'fan', promotedAutomatically: true });
      const u = await post('/viewers/Leo/undo-promotion');
      expect(json(u).viewers[0]).toMatchObject({ level: 'beginner', autoPromotionDisabled: true });
      await post('/viewers/Leo/got-it', { concepts: ['red card'] });
      expect(leo().level).toBe('beginner');
    });

    it('got-it and undo: unknown viewer is 404, bad concept is 400, unknown household is 404', async () => {
      expect((await post('/viewers/Nobody/got-it', { concepts: ['goal'] })).statusCode).toBe(404);
      expect((await post('/viewers/Nobody/undo-promotion')).statusCode).toBe(404);
      expect((await post('/viewers/Leo/got-it', { concepts: ['bogus'] })).statusCode).toBe(400);
      expect((await post('/viewers/Leo/got-it', {})).statusCode).toBe(400);
      expect((await handler()(ev('POST', '/households/ZZZZZZ/sessions', { present: ['Leo'] }))).statusCode).toBe(404);
      expect((await handler()(ev('POST', '/households/ZZZZZZ/viewers/Leo/got-it', { concepts: ['goal'] }))).statusCode).toBe(404);
    });

    it('a question naming a concept of the current moment resets its view count (R-04-c)', async () => {
      const sessionId = await startSession(['Leo']);
      await post(`/sessions/${sessionId}/shown`, { momentId: 'm1', concepts: ['offside'], layerByViewer: { Leo: 'basic' } });
      expect(leo().seenBasic).toEqual({ offside: 1 });
      await post('/questions', { viewerName: 'Leo', question: 'What is offside?', sessionId });
      expect(leo().seenBasic).toEqual({ offside: 0 });
    });

    it('a question about something else, or without a session, leaves the counts alone', async () => {
      const sessionId = await startSession(['Leo']);
      await post(`/sessions/${sessionId}/shown`, { momentId: 'm1', concepts: ['offside'], layerByViewer: { Leo: 'basic' } });
      await post('/questions', { viewerName: 'Leo', question: 'Who is the referee?', sessionId });
      await post('/questions', { viewerName: 'Leo', question: 'What is offside?' });
      expect(leo().seenBasic).toEqual({ offside: 1 });
    });
  });
});

describe('audio question route', () => {
  const wavB64 = (samples = 16000) => Buffer.from(wav(samples)).toString('base64');
  let f: ReturnType<typeof fakeStore>;
  let pushed: unknown[]; let asked: string[]; let heard: string;
  const handler = (tr?: (pcm: Uint8Array) => Promise<string>) => makeHttpHandler({
    store: f.store,
    answer: async i => { asked.push(i.question); return 'Offside is being ahead of the last defender.'; },
    push: async (_ids, payload) => { pushed.push(payload); return []; },
    transcribe: tr ?? (async () => heard),
  });
  const post = (body: unknown) => ev('POST', '/households/ABC234/questions/audio', body);

  beforeEach(() => {
    f = fakeStore(); pushed = []; asked = []; heard = 'what is offside';
    f.households.set('ABC234', [newViewer('Leo', 'beginner')]);
    f.conns.set('ABC234', ['c1']);
  });

  it('transcribes, then answers and pushes like the text route', async () => {
    const r = await handler()(post({ viewerName: 'Leo', wavBase64: wavB64() }));
    expect(r.statusCode).toBe(200);
    expect(json(r)).toEqual({ ok: true, answer: 'Offside is being ahead of the last defender.' });
    expect(asked).toEqual(['what is offside']);
    expect(pushed).toHaveLength(1);
  });
  it('empty transcript is a friendly not-ok and asks nothing', async () => {
    heard = '  ';
    const r = await handler()(post({ viewerName: 'Leo', wavBase64: wavB64() }));
    expect(json(r)).toEqual({ ok: false, message: "I didn't catch that - try again or type it." });
    expect(asked).toEqual([]);
  });
  it('a Transcribe failure is also not-ok', async () => {
    const r = await handler(async () => { throw new Error('boom'); })(post({ viewerName: 'Leo', wavBase64: wavB64() }));
    expect(json(r)).toEqual({ ok: false, message: "I didn't catch that - try again or type it." });
    expect(r.body).not.toContain('boom');
  });
  it('trims a transcript over 300 chars before asking', async () => {
    heard = 'a'.repeat(400);
    await handler()(post({ viewerName: 'Leo', wavBase64: wavB64() }));
    expect(asked[0]).toHaveLength(300);
  });
  it('silence (under 0.1 s) is rejected before caps and Transcribe', async () => {
    let called = false;
    f = fakeStore(); f.households.set('ABC234', [newViewer('Leo', 'beginner')]);
    let counted = 0; const orig = f.store.countHousehold; f.store.countHousehold = async c => { counted++; return orig(c); };
    const r = await handler(async () => { called = true; return 'x'; })(post({ viewerName: 'Leo', wavBase64: wavB64(100) }));
    expect(r.statusCode).toBe(400);
    expect([called, counted]).toEqual([false, 0]);
  });
  it('needs a viewer and does not transcribe without one', async () => {
    let called = false;
    const r = await handler(async () => { called = true; return 'x'; })(post({ wavBase64: wavB64() }));
    expect(r.statusCode).toBe(400);
    expect(json(r).message).toBe('Pick who you are first');
    expect(called).toBe(false);
  });
  it('rejects missing, invalid and too-long audio', async () => {
    expect((await handler()(post({ viewerName: 'Leo' }))).statusCode).toBe(400);
    expect((await handler()(post({ viewerName: 'Leo', wavBase64: 'AAAA' }))).statusCode).toBe(400);
    expect((await handler()(post({ viewerName: 'Leo', wavBase64: wavB64(16000 * 9) }))).statusCode).toBe(400);
  });
  it('accepts an 8 s body here but the text route keeps 2 KB', async () => {
    expect((await handler()(post({ viewerName: 'Leo', wavBase64: wavB64(16000 * 8) }))).statusCode).toBe(200);
    const t = await handler()(ev('POST', '/households/ABC234/questions', { viewerName: 'Leo', question: 'x'.repeat(3000) }));
    expect(json(t).message).toBe('Request is too big');
  });
  it('applies the household cap', async () => {
    f = fakeStore(30); f.households.set('ABC234', [newViewer('Leo', 'beginner')]);
    expect((await handler()(post({ viewerName: 'Leo', wavBase64: wavB64() }))).statusCode).toBe(429);
  });

});
