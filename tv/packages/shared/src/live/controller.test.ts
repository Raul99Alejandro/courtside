import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newViewer, type Viewer } from '@courtside/core';
import type { Client, Promotion, RecentAnswer } from '../api/client';
import { createController, MAX_PENDING, restorablePromotion, type Backend, type SocketHandlers } from './controller';

const ok = <T>(data: T) => ({ ok: true as const, data });
const err = (status: number, message: string) => ({ ok: false as const, status, message });
const leo = newViewer('Leo', 'beginner', 1);
const ana = newViewer('Ana', 'beginner', 2);
const raul = newViewer('Raul', 'expert', 3);
const leoUp = { name: 'Leo', message: 'Leo moved up to Fan' };
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

function memoryStorage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return { m, get: async (k: string) => m.get(k) ?? null, set: async (k: string, v: string) => void m.set(k, v), remove: async (k: string) => void m.delete(k) };
}

function setup(over: Partial<Record<keyof Client, ReturnType<typeof vi.fn>>> = {}, stored: Record<string, string> = { 'courtside.code': 'ABC234' }) {
  const client = {
    createHousehold: vi.fn(async () => ok({ householdId: 'h2', code: 'NEW234' })),
    getHousehold: vi.fn(async () => ok({ viewers: [leo, ana, raul], recentAnswers: [] as RecentAnswer[] })),
    createSession: vi.fn(async (_c: string, present: string[]) => ok({ sessionId: 's1', viewers: [leo, ana, raul].filter(v => present.includes(v.name)) })),
    shown: vi.fn(async () => ok({ viewers: [leo, ana, raul], promotions: [] as Promotion[] })),
    gotIt: vi.fn(async () => ok({ viewers: [leo, ana, raul], promotions: [] as Promotion[] })),
    undoPromotion: vi.fn(async () => ok({ viewers: [leo, ana, raul], promotions: [] as Promotion[] })),
    ...over,
  };
  let handlers!: SocketHandlers;
  const socket = { start: vi.fn(), stop: vi.fn() };
  const backend: Backend = {
    client: client as unknown as Client,
    siteUrl: 'https://site.test',
    openSocket: (_code, h) => {
      handlers = h;
      return socket;
    },
  };
  const storage = memoryStorage(stored);
  const live = createController({ backend: async () => backend, storage, pollMs: 5000 });
  return { live, client, storage, socket, handlers: () => handlers };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
const settle = () => vi.advanceTimersByTimeAsync(0);

describe('boot', () => {
  it('reuses the stored code, loads viewers and opens the socket', async () => {
    const { live, client, socket } = setup();
    await live.boot();
    expect(live.getState()).toMatchObject({ ready: true, code: 'ABC234', viewers: [leo, ana, raul] });
    expect(client.createHousehold).not.toHaveBeenCalled();
    expect(socket.start).toHaveBeenCalled();
  });

  it('creates a household on first launch and stores its code', async () => {
    const { live, storage } = setup({}, {});
    await live.boot();
    expect(live.getState().code).toBe('NEW234');
    expect(storage.m.get('courtside.code')).toBe('NEW234');
  });

  it('replaces an expired code with a new household and says so', async () => {
    const { live, storage } = setup({ getHousehold: vi.fn(async () => err(404, 'Unknown code')) });
    await live.boot();
    expect(live.getState().code).toBe('NEW234');
    expect(live.getState().notice).toMatch(/new code/i);
    expect(storage.m.get('courtside.code')).toBe('NEW234');
  });

  it('keeps the code and retries when offline', async () => {
    const getHousehold = vi.fn().mockResolvedValueOnce(err(0, 'offline')).mockResolvedValue(ok({ viewers: [leo] }));
    const { live, storage } = setup({ getHousehold });
    await live.boot();
    expect(live.getState().ready).toBe(false);
    expect(storage.m.get('courtside.code')).toBe('ABC234');
    await vi.advanceTimersByTimeAsync(5000);
    expect(live.getState()).toMatchObject({ ready: true, viewers: [leo] });
  });

  it('polls viewers every 5 s until a session starts (the phone adds viewers without a push)', async () => {
    const { live, client } = setup();
    await live.boot();
    client.getHousehold.mockClear();
    await vi.advanceTimersByTimeAsync(5000);
    expect(client.getHousehold).toHaveBeenCalledTimes(1);
    await live.startSession(['Leo']);
    await vi.advanceTimersByTimeAsync(20000);
    expect(client.getHousehold).toHaveBeenCalledTimes(1);
  });
});

describe('session', () => {
  it('starts a session with the picked viewers', async () => {
    const { live, client } = setup();
    await live.boot();
    expect(await live.startSession(['Leo', 'Ana'])).toEqual({ ok: true });
    expect(client.createSession).toHaveBeenCalledWith('ABC234', ['Leo', 'Ana']);
    expect(live.getState()).toMatchObject({ sessionId: 's1', present: ['Leo', 'Ana'] });
  });

  it('returns the server message when the session is refused (R-09)', async () => {
    const { live } = setup({ createSession: vi.fn(async () => err(400, 'Up to 3 viewers at a time')) });
    await live.boot();
    expect(await live.startSession(['Leo', 'Ana', 'Raul', 'X'])).toEqual({ ok: false, message: 'Up to 3 viewers at a time' });
    expect(live.getState().sessionId).toBeUndefined();
  });

  it('review 2: a viewer removed before the session starts refreshes the list and stays on Who is watching', async () => {
    const { live, client } = setup({ createSession: vi.fn(async () => err(400, 'Pick who you are first')) });
    await live.boot();
    client.getHousehold.mockResolvedValue(ok({ viewers: [ana] }));
    const r = await live.startSession(['Leo']);
    expect(r.ok).toBe(false);
    expect(live.getState().viewers).toEqual([ana]);
  });
});

describe('shown', () => {
  it('sends momentId, concepts and an increasing seq, once per consecutive moment (review 1)', async () => {
    const { live, client } = setup();
    await live.boot();
    await live.startSession(['Leo']);
    await live.shown('m1', ['offside']);
    await live.shown('m1', ['offside']); // strict-mode double effect
    await live.shown('m2', ['goal']);
    await live.shown('m1', ['offside']);
    expect(client.shown.mock.calls.map(c => [c[2].momentId, c[2].seq])).toEqual([['m1', 1], ['m2', 2], ['m1', 3]]);
    expect(client.shown.mock.calls[0]![1]).toBe('s1');
  });

  it('takes viewers and promotions from the response', async () => {
    const promoted: Viewer = { ...leo, level: 'fan', promotedAutomatically: true };
    const { live } = setup({ shown: vi.fn(async () => ok({ viewers: [promoted, ana, raul], promotions: [leoUp] })) });
    await live.boot();
    await live.startSession(['Leo']);
    await live.shown('m1', ['offside']);
    expect(live.getState().viewers[0]).toEqual(promoted);
    expect(live.getState().promotions).toEqual([leoUp]);
  });

  it('review 3: a failed send is retried when the socket reconnects', async () => {
    const shown = vi.fn().mockResolvedValueOnce(err(0, 'offline')).mockResolvedValue(ok({ viewers: [leo, ana, raul], promotions: [] }));
    const { live, handlers } = setup({ shown });
    await live.boot();
    await live.startSession(['Leo']);
    await live.shown('m1', ['offside']);
    expect(shown).toHaveBeenCalledTimes(1);
    handlers().onOpen();
    await settle();
    expect(shown).toHaveBeenCalledTimes(2);
    expect(shown.mock.calls[1]![2]).toMatchObject({ momentId: 'm1', concepts: ['offside'] });
    handlers().onOpen();
    await settle();
    expect(shown).toHaveBeenCalledTimes(2);
  });

  it('review 2: an expired session sends the TV back to Who is watching with a message', async () => {
    const { live } = setup({ shown: vi.fn(async () => err(404, 'Session expired')) });
    await live.boot();
    await live.startSession(['Leo']);
    await live.shown('m1', ['offside']);
    expect(live.getState().sessionId).toBeUndefined();
    expect(live.getState().notice).toMatch(/pick who/i);
  });

  it('review 2: a viewer missing from a viewers update ends the session with their name', async () => {
    const { live, handlers } = setup();
    await live.boot();
    await live.startSession(['Leo', 'Ana']);
    handlers().onMessage({ type: 'viewers', viewers: [ana, raul], promotions: [] });
    expect(live.getState().sessionId).toBeUndefined();
    expect(live.getState().notice).toBe('Leo is no longer in this household. Pick who is watching.');
    expect(live.getState().viewers).toEqual([ana, raul]);
  });
});

describe('got it and undo', () => {
  it('marks got-it for each viewer in turn and keeps every promotion', async () => {
    const gotIt = vi
      .fn()
      .mockResolvedValueOnce(ok({ viewers: [leo, ana, raul], promotions: [leoUp] }))
      .mockResolvedValueOnce(ok({ viewers: [leo, ana, raul], promotions: [] }));
    const { live } = setup({ gotIt });
    await live.boot();
    await live.startSession(['Leo', 'Ana']);
    await live.gotIt(['Leo', 'Ana'], ['offside']);
    expect(gotIt.mock.calls.map(c => [c[1], c[2]])).toEqual([['Leo', ['offside']], ['Ana', ['offside']]]);
    expect(live.getState().promotions).toEqual([leoUp]);
  });

  it('undo calls the server and clears the toast', async () => {
    const { live, client } = setup({ shown: vi.fn(async () => ok({ viewers: [leo, ana, raul], promotions: [leoUp] })) });
    await live.boot();
    await live.startSession(['Leo']);
    await live.shown('m1', ['offside']);
    await live.undo('Leo');
    expect(client.undoPromotion).toHaveBeenCalledWith('ABC234', 'Leo');
    expect(live.getState().promotions).toEqual([]);
  });

  it('review 4: after a reload a recent promotion is still undoable once Leo is in the session (state comes from the server)', async () => {
    const promoted: Viewer = { ...leo, level: 'fan', promotedAutomatically: true, promotedAt: minutesAgo(5) };
    const { live, client } = setup({
      getHousehold: vi.fn(async () => ok({ viewers: [promoted, ana] })),
      createSession: vi.fn(async () => ok({ sessionId: 's1', viewers: [promoted] })),
    });
    await live.boot();
    expect(live.getState().promotions).toEqual([]); // no session yet, so nobody is "in the session"
    await live.startSession(['Leo']);
    expect(live.getState().promotions).toEqual([leoUp]);
    await live.undo('Leo');
    expect(client.undoPromotion).toHaveBeenCalledWith('ABC234', 'Leo');
    expect(live.getState().promotions).toEqual([]);
  });

  it('the toast ends when the viewers move to another moment', async () => {
    const shown = vi.fn().mockResolvedValueOnce(ok({ viewers: [leo], promotions: [leoUp] })).mockResolvedValue(ok({ viewers: [leo], promotions: [] }));
    const { live } = setup({ shown });
    await live.boot();
    await live.startSession(['Leo']);
    await live.shown('m1', ['offside']);
    await live.shown('m2', ['goal']);
    expect(live.getState().promotions).toEqual([]);
  });
});

describe('answers queue', () => {
  const answer = (q: string) => ({ type: 'answer', label: 'Leo', layer: 'basic', question: q, answer: `A: ${q}` });

  it('review 5: an answer arriving while another is on screen waits its turn and is never lost', async () => {
    const { live, handlers } = setup();
    await live.boot();
    handlers().onMessage(answer('one'));
    handlers().onMessage(answer('two'));
    handlers().onMessage(answer('three'));
    expect(live.getState().answers.map(a => a.question)).toEqual(['one', 'two', 'three']);
    const first = live.getState().answers[0]!;
    live.dismissAnswer(first.id);
    expect(live.getState().answers.map(a => a.question)).toEqual(['two', 'three']);
  });

  it('dismissing a stale id does not drop the answer now on screen', async () => {
    const { live, handlers } = setup();
    await live.boot();
    handlers().onMessage(answer('one'));
    const first = live.getState().answers[0]!;
    live.dismissAnswer(first.id);
    handlers().onMessage(answer('two'));
    live.dismissAnswer(first.id); // timer or Back from the screen that showed "one"
    expect(live.getState().answers.map(a => a.question)).toEqual(['two']);
  });

  it('ignores malformed pushes', async () => {
    const { live, handlers } = setup();
    await live.boot();
    handlers().onMessage({ type: 'answer', label: 'Leo' });
    handlers().onMessage({ type: 'nonsense' });
    expect(live.getState().answers).toEqual([]);
  });

  it('keeps queued answers when the session ends', async () => {
    const { live, handlers } = setup({ shown: vi.fn(async () => err(404, 'Session expired')) });
    await live.boot();
    await live.startSession(['Leo']);
    handlers().onMessage(answer('one'));
    await live.shown('m1', ['offside']);
    expect(live.getState().answers).toHaveLength(1);
  });
});

describe('household gone', () => {
  it('review 2: the socket reporting a gone household starts a fresh one and returns to Who is watching', async () => {
    const { live, handlers, storage, socket } = setup();
    await live.boot();
    await live.startSession(['Leo']);
    handlers().onGone();
    await settle();
    expect(socket.stop).toHaveBeenCalled();
    expect(live.getState()).toMatchObject({ code: 'NEW234', sessionId: undefined, viewers: [] });
    expect(live.getState().notice).toMatch(/new code/i);
    expect(storage.m.get('courtside.code')).toBe('NEW234');
  });

  it('a call that finds the household gone does the same', async () => {
    const { live } = setup({ gotIt: vi.fn(async () => err(404, 'Unknown code')) });
    await live.boot();
    await live.startSession(['Leo']);
    await live.gotIt(['Leo'], ['offside']);
    await settle();
    expect(live.getState()).toMatchObject({ code: 'NEW234', sessionId: undefined });
  });

  it('exposes whether the socket is connected', async () => {
    const { live, handlers } = setup();
    await live.boot();
    handlers().onState(true);
    expect(live.getState().connected).toBe(true);
    handlers().onState(false);
    expect(live.getState().connected).toBe(false);
  });
});

describe('fix round 1: Got it and Undo that cannot get through', () => {
  const okViewers = (promotions: Promotion[] = []) => ok({ viewers: [leo, ana, raul], promotions });

  it('offline Got it is queued, shows the retry problem, and is sent again with backoff (1 s, then 2 s)', async () => {
    const gotIt = vi.fn().mockResolvedValueOnce(err(0, 'offline')).mockResolvedValueOnce(err(0, 'offline')).mockResolvedValue(okViewers([leoUp]));
    const { live } = setup({ gotIt });
    await live.boot();
    await live.startSession(['Leo']);
    await live.gotIt(['Leo'], ['offside']);
    expect(gotIt).toHaveBeenCalledTimes(1);
    expect(live.getState().problem).toMatch(/trying again/i);
    await vi.advanceTimersByTimeAsync(999);
    expect(gotIt).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(gotIt).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(gotIt).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(gotIt).toHaveBeenCalledTimes(3);
    expect(live.getState().problem).toBeUndefined();
    expect(live.getState().promotions).toEqual([leoUp]);
  });

  it('a 5xx is retried the same way', async () => {
    const gotIt = vi.fn().mockResolvedValueOnce(err(503, 'Courtside had a problem')).mockResolvedValue(okViewers());
    const { live } = setup({ gotIt });
    await live.boot();
    await live.startSession(['Leo']);
    await live.gotIt(['Leo'], ['offside']);
    expect(live.getState().problem).toBeDefined();
    await vi.advanceTimersByTimeAsync(1000);
    expect(gotIt).toHaveBeenCalledTimes(2);
    expect(live.getState().problem).toBeUndefined();
  });

  it('keeps the order of what waits: a failed Got it for Leo goes out before Ana', async () => {
    const gotIt = vi.fn().mockResolvedValueOnce(err(0, 'offline')).mockResolvedValue(okViewers());
    const { live } = setup({ gotIt });
    await live.boot();
    await live.startSession(['Leo', 'Ana']);
    await live.gotIt(['Leo', 'Ana'], ['offside']);
    expect(gotIt).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(gotIt.mock.calls.map(c => c[1])).toEqual(['Leo', 'Leo', 'Ana']);
  });

  it('a socket reconnect sends it at once instead of waiting for the timer', async () => {
    const gotIt = vi.fn().mockResolvedValueOnce(err(0, 'offline')).mockResolvedValue(okViewers());
    const { live, handlers } = setup({ gotIt });
    await live.boot();
    await live.startSession(['Leo']);
    await live.gotIt(['Leo'], ['offside']);
    handlers().onOpen();
    await settle();
    expect(gotIt).toHaveBeenCalledTimes(2);
    expect(live.getState().problem).toBeUndefined();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(gotIt).toHaveBeenCalledTimes(2);
  });

  it('offline Undo is queued and retried, and the toast clears once it lands', async () => {
    const undoPromotion = vi.fn().mockResolvedValueOnce(err(0, 'offline')).mockResolvedValue(okViewers());
    const { live } = setup({ undoPromotion, shown: vi.fn(async () => okViewers([leoUp])) });
    await live.boot();
    await live.startSession(['Leo']);
    await live.shown('m1', ['offside']);
    await live.undo('Leo');
    expect(live.getState().problem).toBeDefined();
    expect(live.getState().promotions).toEqual([leoUp]); // still undoable while it is retried
    await vi.advanceTimersByTimeAsync(1000);
    expect(undoPromotion).toHaveBeenCalledTimes(2);
    expect(live.getState().promotions).toEqual([]);
    expect(live.getState().problem).toBeUndefined();
  });

  it('a refusal that is not worth retrying (400) is dropped with the server message', async () => {
    const gotIt = vi.fn(async () => err(400, 'Unknown concept'));
    const { live } = setup({ gotIt });
    await live.boot();
    await live.startSession(['Leo']);
    await live.gotIt(['Leo'], ['offside']);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(gotIt).toHaveBeenCalledTimes(1);
    expect(live.getState().notice).toBe('Unknown concept');
    expect(live.getState().problem).toBeUndefined();
  });

  it('a household that vanished while retrying drops the queue and starts fresh', async () => {
    const gotIt = vi.fn().mockResolvedValueOnce(err(0, 'offline')).mockResolvedValue(err(404, 'Unknown code'));
    const { live } = setup({ gotIt });
    await live.boot();
    await live.startSession(['Leo']);
    await live.gotIt(['Leo'], ['offside']);
    await vi.advanceTimersByTimeAsync(1000);
    await settle();
    expect(live.getState().code).toBe('NEW234');
    expect(live.getState().problem).toBeUndefined();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(gotIt).toHaveBeenCalledTimes(2);
  });

  it('stop() ends the retries', async () => {
    const gotIt = vi.fn(async () => err(0, 'offline'));
    const { live, socket } = setup({ gotIt });
    await live.boot();
    await live.startSession(['Leo']);
    await live.gotIt(['Leo'], ['offside']);
    live.stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(gotIt).toHaveBeenCalledTimes(1);
    expect(socket.stop).toHaveBeenCalled();
  });
});

describe('fix round 1: shown retried with backoff', () => {
  it('a 5xx on shown is retried by timer (no reconnect needed), keeping its seq', async () => {
    const shown = vi.fn().mockResolvedValueOnce(err(500, 'oops')).mockResolvedValue(ok({ viewers: [leo, ana, raul], promotions: [] as Promotion[] }));
    const { live } = setup({ shown });
    await live.boot();
    await live.startSession(['Leo']);
    await live.shown('m1', ['offside']);
    expect(live.getState().problem).toBeUndefined(); // shown retries stay quiet
    await vi.advanceTimersByTimeAsync(1000);
    expect(shown).toHaveBeenCalledTimes(2);
    expect(shown.mock.calls.map(c => [c[2].momentId, c[2].seq])).toEqual([['m1', 1], ['m1', 1]]);
  });

  it('final review: an unsent older moment is replaced by the newer one while offline', async () => {
    const shown = vi.fn().mockResolvedValueOnce(err(0, 'offline')).mockResolvedValue(ok({ viewers: [leo, ana, raul], promotions: [] as Promotion[] }));
    const { live } = setup({ shown });
    await live.boot();
    await live.startSession(['Leo']);
    await live.shown('m1', ['offside']);
    await live.shown('m2', ['goal']);
    await vi.advanceTimersByTimeAsync(2000);
    expect(shown.mock.calls.map(c => [c[2].momentId, c[2].seq])).toEqual([['m1', 1], ['m2', 2]]);
  });
});

describe('fix round 1: boot and replace', () => {
  it('a replace that lands while a boot is in flight waits for it and still ends with a ready TV on a new household', async () => {
    let release!: (v: unknown) => void;
    const getHousehold = vi
      .fn()
      .mockResolvedValueOnce(ok({ viewers: [leo] }))
      .mockImplementationOnce(() => new Promise(r => (release = r)));
    const { live, handlers, storage } = setup({ getHousehold });
    await live.boot();
    const first = handlers();
    const second = live.boot(); // e.g. the app resumed: a boot is in flight with the old socket still open
    await settle();
    first.onGone(); // the old socket learns the household is gone, mid-boot
    await settle();
    release(ok({ viewers: [leo] }));
    await second;
    await settle();
    await settle();
    expect(live.getState()).toMatchObject({ ready: true, code: 'NEW234', viewers: [] });
    expect(live.getState().notice).toMatch(/new code/i);
    expect(storage.m.get('courtside.code')).toBe('NEW234');
  });

  it('a boot that fails offline during a replace keeps retrying instead of sticking', async () => {
    const createHousehold = vi.fn().mockResolvedValueOnce(err(0, 'offline')).mockResolvedValue(ok({ householdId: 'h2', code: 'NEW234' }));
    const { live, handlers } = setup({ createHousehold });
    await live.boot();
    handlers().onGone();
    await settle();
    expect(live.getState().ready).toBe(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(live.getState()).toMatchObject({ ready: true, code: 'NEW234' });
  });

  it('boot after stop() starts the socket again (app remount)', async () => {
    const { live, socket } = setup();
    await live.boot();
    live.stop();
    await live.boot();
    expect(socket.start).toHaveBeenCalledTimes(2);
  });
});

describe('fix round 1: reconnect, viewers and missed answers', () => {
  it('onOpen after a reconnect fetches the household again', async () => {
    const { live, client, handlers } = setup();
    await live.boot();
    client.getHousehold.mockClear();
    client.getHousehold.mockResolvedValue(ok({ viewers: [leo, ana, raul, newViewer('Mia', 'fan', 4)], recentAnswers: [] }));
    handlers().onOpen();
    await settle();
    expect(client.getHousehold).toHaveBeenCalledWith('ABC234');
    expect(live.getState().viewers.map(v => v.name)).toEqual(['Leo', 'Ana', 'Raul', 'Mia']);
  });

  it('a viewer added from a phone mid-session appears from the push, with no polling', async () => {
    const { live, client, handlers } = setup();
    await live.boot();
    await live.startSession(['Leo']);
    client.getHousehold.mockClear();
    const mia = newViewer('Mia', 'fan', 4);
    handlers().onMessage({ type: 'viewers', viewers: [leo, ana, raul, mia], promotions: [] });
    expect(live.getState().viewers.map(v => v.name)).toEqual(['Leo', 'Ana', 'Raul', 'Mia']);
    expect(live.getState().sessionId).toBe('s1'); // the session carries on
    await vi.advanceTimersByTimeAsync(60_000);
    expect(client.getHousehold).not.toHaveBeenCalled();
  });

  it('viewers are kept in creation order, whatever order they arrive in', async () => {
    const { live, handlers } = setup();
    await live.boot();
    handlers().onMessage({ type: 'viewers', viewers: [raul, ana, leo], promotions: [] });
    expect(live.getState().viewers.map(v => v.name)).toEqual(['Leo', 'Ana', 'Raul']);
  });

  const rec = (id: string, q: string): RecentAnswer => ({ id, label: 'Leo', layer: 'basic', question: q, answer: `A: ${q}`, at: 1 });

  it('answers that came while the socket was down are queued on reconnect, oldest first, once', async () => {
    const { live, client, handlers } = setup();
    await live.boot();
    client.getHousehold.mockResolvedValue(ok({ viewers: [leo], recentAnswers: [rec('a1', 'one'), rec('a2', 'two')] }));
    handlers().onOpen();
    await settle();
    expect(live.getState().answers.map(a => a.question)).toEqual(['one', 'two']);
    handlers().onOpen();
    await settle();
    expect(live.getState().answers).toHaveLength(2);
  });

  it('an answer already shown from the push is not queued again by the catch-up', async () => {
    const { live, client, handlers } = setup();
    await live.boot();
    handlers().onMessage({ type: 'answer', id: 'a1', label: 'Leo', layer: 'basic', question: 'one', answer: 'A: one' });
    live.dismissAnswer(live.getState().answers[0]!.id);
    client.getHousehold.mockResolvedValue(ok({ viewers: [leo], recentAnswers: [rec('a1', 'one'), rec('a2', 'two')] }));
    handlers().onOpen();
    await settle();
    expect(live.getState().answers.map(a => a.question)).toEqual(['two']);
  });

  it('a push that arrives after the catch-up already queued it is ignored', async () => {
    const { live, client, handlers } = setup();
    await live.boot();
    client.getHousehold.mockResolvedValue(ok({ viewers: [leo], recentAnswers: [rec('a1', 'one')] }));
    handlers().onOpen();
    await settle();
    handlers().onMessage({ type: 'answer', id: 'a1', label: 'Leo', layer: 'basic', question: 'one', answer: 'A: one' });
    expect(live.getState().answers).toHaveLength(1);
  });

  it('answers the server still holds when the TV starts are not replayed', async () => {
    const { live } = setup({ getHousehold: vi.fn(async () => ok({ viewers: [leo], recentAnswers: [rec('a1', 'old')] })) });
    await live.boot();
    await vi.advanceTimersByTimeAsync(10_000); // a poll too
    expect(live.getState().answers).toEqual([]);
  });
});

describe('final review: shown queue, retries, flash, promotion recency', () => {
  it('only the newest unsent shown survives a long offline stretch', async () => {
    let offline = true;
    const reply = () => (offline ? err(0, 'offline') : ok({ viewers: [leo, ana, raul], promotions: [] as Promotion[] }));
    const shown = vi.fn(async (_c: string, _s: string, _b: { momentId: string; seq: number }) => reply());
    const { live } = setup({ shown });
    await live.boot();
    await live.startSession(['Leo']);
    for (const m of ['a', 'b', 'c', 'd']) await live.shown(m, ['goal']);
    offline = false;
    shown.mockClear();
    await vi.advanceTimersByTimeAsync(30_000);
    const sent = shown.mock.calls.map(c => c[2].momentId);
    expect(sent).toEqual(['d']);
  });

  it('keeps Got it queued in order while shown moments are replaced', async () => {
    let offline = true;
    const reply = () => (offline ? err(0, 'offline') : ok({ viewers: [leo, ana, raul], promotions: [] as Promotion[] }));
    const gotIt = vi.fn(async (_c: string, _n: string, _k: unknown[]) => reply());
    const shown = vi.fn(async (_c: string, _s: string, _b: { momentId: string; seq: number }) => reply());
    const { live } = setup({ gotIt, shown });
    await live.boot();
    await live.startSession(['Leo']);
    await live.gotIt(['Leo', 'Ana'], ['offside']);
    await live.shown('m1', ['goal']);
    await live.shown('m2', ['goal']);
    offline = false;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(gotIt.mock.calls.slice(-2).map(c => c[1])).toEqual(['Leo', 'Ana']);
    expect(shown.mock.calls.map(c => c[2].momentId).filter(m => m === 'm1')).toEqual([]);
    expect(shown.mock.calls.map(c => c[2].momentId)).toContain('m2');
  });

  it('caps the pending queue at 20, dropping the oldest', async () => {
    const gotIt = vi.fn().mockResolvedValueOnce(err(0, 'offline')).mockResolvedValue(ok({ viewers: [leo, ana, raul], promotions: [] as Promotion[] }));
    const { live } = setup({ gotIt });
    await live.boot();
    await live.startSession(['Leo']);
    const names = Array.from({ length: 30 }, (_, i) => 'V' + i);
    await live.gotIt(names, ['goal']);
    await vi.advanceTimersByTimeAsync(1000);
    const sent = gotIt.mock.calls.slice(1).map(c => c[1]);
    expect(MAX_PENDING).toBe(20);
    expect(sent).toHaveLength(20);
    expect(sent[sent.length - 1]).toBe('V29');
  });

  it('a 429 is retried like a busy server', async () => {
    const shown = vi.fn().mockResolvedValueOnce(err(429, 'slow down')).mockResolvedValue(ok({ viewers: [leo, ana, raul], promotions: [] as Promotion[] }));
    const { live } = setup({ shown });
    await live.boot();
    await live.startSession(['Leo']);
    await live.shown('m1', ['offside']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(shown).toHaveBeenCalledTimes(2);
  });

  it('a refused Got it (400) is also a problem toast for a few seconds', async () => {
    const { live } = setup({ gotIt: vi.fn(async () => err(400, 'Unknown concept')) });
    await live.boot();
    await live.startSession(['Leo']);
    await live.gotIt(['Leo'], ['offside']);
    expect(live.getState().problem).toBe('Unknown concept');
    expect(live.getState().notice).toBe('Unknown concept');
    await vi.advanceTimersByTimeAsync(4900);
    expect(live.getState().problem).toBe('Unknown concept');
    await vi.advanceTimersByTimeAsync(200);
    expect(live.getState().problem).toBeUndefined();
  });

  it('something queued while a flush ends is sent without waiting for a reconnect', async () => {
    let release!: (v: unknown) => void;
    const gotIt = vi
      .fn()
      .mockImplementationOnce(() => new Promise(res => (release = res)))
      .mockResolvedValue(ok({ viewers: [leo, ana, raul], promotions: [] as Promotion[] }));
    const { live } = setup({ gotIt });
    await live.boot();
    await live.startSession(['Leo']);
    const first = live.gotIt(['Leo'], ['goal']);
    await settle();
    void live.gotIt(['Ana'], ['goal']);
    release(ok({ viewers: [leo, ana, raul], promotions: [] }));
    await first;
    await settle();
    expect(gotIt.mock.calls.map(c => c[1])).toEqual(['Leo', 'Ana']);
  });

  it('does not restore an old promotion, one without a time, or one of someone not in the session', async () => {
    const old: Viewer = { ...leo, level: 'fan', promotedAutomatically: true, promotedAt: minutesAgo(31) };
    const legacy: Viewer = { ...ana, level: 'fan', promotedAutomatically: true };
    const recentAbsent: Viewer = { ...raul, level: 'fan', promotedAutomatically: true, promotedAt: minutesAgo(1) };
    const { live } = setup({ getHousehold: vi.fn(async () => ok({ viewers: [old, legacy, recentAbsent] })) });
    await live.boot();
    await live.startSession(['Leo', 'Ana']);
    expect(live.getState().promotions).toEqual([]);
  });

  it('restorablePromotion picks the most recent fresh one among those present', () => {
    const a: Viewer = { ...leo, level: 'fan', promotedAutomatically: true, promotedAt: minutesAgo(20) };
    const b: Viewer = { ...ana, level: 'fan', promotedAutomatically: true, promotedAt: minutesAgo(2) };
    const c: Viewer = { ...raul, level: 'fan', promotedAutomatically: true, promotedAt: minutesAgo(1) };
    expect(restorablePromotion([a, b, c], ['Leo', 'Ana'], Date.now())).toEqual({ name: 'Ana', message: 'Ana moved up to Fan' });
    expect(restorablePromotion([a, b, c], [], Date.now())).toBeUndefined();
  });
});
