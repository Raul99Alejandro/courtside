import { beforeEach, describe, expect, it } from 'vitest';
import { newViewer, type Viewer } from '../src/core/index.js';
import { makeHttpHandler, type HttpEvent } from '../src/api/http.js';
import type { Store } from '../src/api/store.js';

const FALLBACK = "I couldn't answer that right now - try again in a moment.";

function fakeStore(rateStart = 0, globalStart = 0) {
  const households = new Map<string, Viewer[]>();
  const conns = new Map<string, string[]>();
  let rate = rateStart;
  let globalRate = globalStart;
  const removed: string[] = [];
  const store: Store = {
    async createHousehold() { households.set('ABC234', []); return { householdId: 'hh-1', code: 'ABC234' }; },
    async getViewers(code) { return households.get(code); },
    async putViewer(code, v) { households.set(code, [...(households.get(code) ?? []), v]); },
    async addConnection(code, id) { conns.set(code, [...(conns.get(code) ?? []), id]); },
    async removeConnection(id) { removed.push(id); },
    async connections(code) { return conns.get(code) ?? []; },
    async countQuestion() { return { household: ++rate, global: ++globalRate }; },
  };
  return { store, households, conns, removed };
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

  it('a malformed percent-encoding in the code is 404 Unknown code', async () => {
    const r = await handler()(ev('GET', '/households/%E0%A4%A'));
    expect(r.statusCode).toBe(404);
    expect(json(r)).toEqual({ message: 'Unknown code' });
  });

  it('unknown route is 404', async () => {
    expect((await handler()(ev('GET', '/nope'))).statusCode).toBe(404);
  });
});
