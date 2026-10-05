import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newViewer, type Viewer } from '@courtside/core';
import type { Client } from '../api/client';
import { createController, type Backend, type SocketHandlers } from './controller';

const ok = <T>(data: T) => ({ ok: true as const, data });
const err = (status: number, message: string) => ({ ok: false as const, status, message });
const leo = newViewer('Leo', 'beginner');
const ana = newViewer('Ana', 'beginner');
const raul = newViewer('Raul', 'expert');

function memoryStorage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return { m, get: async (k: string) => m.get(k) ?? null, set: async (k: string, v: string) => void m.set(k, v), remove: async (k: string) => void m.delete(k) };
}

function setup(over: Partial<Record<keyof Client, ReturnType<typeof vi.fn>>> = {}, stored: Record<string, string> = { 'courtside.code': 'ABC234' }) {
  const client = {
    createHousehold: vi.fn(async () => ok({ householdId: 'h2', code: 'NEW234' })),
    getHousehold: vi.fn(async () => ok({ viewers: [leo, ana, raul] })),
    createSession: vi.fn(async (_c: string, present: string[]) => ok({ sessionId: 's1', viewers: [leo, ana, raul].filter(v => present.includes(v.name)) })),
    shown: vi.fn(async () => ok({ viewers: [leo, ana, raul], promotions: [] as string[] })),
    gotIt: vi.fn(async () => ok({ viewers: [leo, ana, raul], promotions: [] as string[] })),
    undoPromotion: vi.fn(async () => ok({ viewers: [leo, ana, raul], promotions: [] as string[] })),
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
    const { live } = setup({ shown: vi.fn(async () => ok({ viewers: [promoted, ana, raul], promotions: ['Leo moved up to Fan'] })) });
    await live.boot();
    await live.startSession(['Leo']);
    await live.shown('m1', ['offside']);
    expect(live.getState().viewers[0]).toEqual(promoted);
    expect(live.getState().promotions).toEqual(['Leo moved up to Fan']);
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
      .mockResolvedValueOnce(ok({ viewers: [leo, ana, raul], promotions: ['Leo moved up to Fan'] }))
      .mockResolvedValueOnce(ok({ viewers: [leo, ana, raul], promotions: [] }));
    const { live } = setup({ gotIt });
    await live.boot();
    await live.startSession(['Leo', 'Ana']);
    await live.gotIt(['Leo', 'Ana'], ['offside']);
    expect(gotIt.mock.calls.map(c => [c[1], c[2]])).toEqual([['Leo', ['offside']], ['Ana', ['offside']]]);
    expect(live.getState().promotions).toEqual(['Leo moved up to Fan']);
  });

  it('undo calls the server and clears the toast', async () => {
    const { live, client } = setup({ shown: vi.fn(async () => ok({ viewers: [leo, ana, raul], promotions: ['Leo moved up to Fan'] })) });
    await live.boot();
    await live.startSession(['Leo']);
    await live.shown('m1', ['offside']);
    await live.undo('Leo');
    expect(client.undoPromotion).toHaveBeenCalledWith('ABC234', 'Leo');
    expect(live.getState().promotions).toEqual([]);
  });

  it('review 4: after a reload the last automatic promotion is still undoable (state comes from the server)', async () => {
    const promoted: Viewer = { ...leo, level: 'fan', promotedAutomatically: true };
    const { live, client } = setup({ getHousehold: vi.fn(async () => ok({ viewers: [promoted, ana] })) });
    await live.boot();
    expect(live.getState().promotions).toEqual(['Leo moved up to Fan']);
    await live.undo('Leo');
    expect(client.undoPromotion).toHaveBeenCalledWith('ABC234', 'Leo');
    expect(live.getState().promotions).toEqual([]);
  });

  it('the toast ends when the viewers move to another moment', async () => {
    const shown = vi.fn().mockResolvedValueOnce(ok({ viewers: [leo], promotions: ['Leo moved up to Fan'] })).mockResolvedValue(ok({ viewers: [leo], promotions: [] }));
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
