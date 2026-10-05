import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backoffDelay, createSocket, type SocketOptions } from './socket';

class FakeWs {
  static all: FakeWs[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen?: () => void;
  onmessage?: (e: { data: string }) => void;
  onclose?: () => void;
  onerror?: () => void;
  constructor(public url: string) {
    FakeWs.all.push(this);
  }
  send(s: string) {
    this.sent.push(s);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
}

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  FakeWs.all = [];
});
afterEach(() => vi.useRealTimers());

function make(over: Partial<SocketOptions> = {}) {
  const events = { open: vi.fn(), message: vi.fn(), gone: vi.fn(), state: vi.fn() };
  const s = createSocket({
    url: 'wss://ws.test?code=ABC234&role=tv',
    WebSocketImpl: FakeWs as never,
    onOpen: events.open,
    onMessage: events.message,
    onGone: events.gone,
    onState: events.state,
    isGone: async () => false,
    ...over,
  });
  return { s, events };
}

describe('backoffDelay', () => {
  it('doubles from 1 s up to 30 s', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 10].map(backoffDelay)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });
});

describe('createSocket', () => {
  it('delivers parsed messages and ignores junk', () => {
    const { s, events } = make();
    s.start();
    FakeWs.all[0]!.open();
    FakeWs.all[0]!.onmessage!({ data: JSON.stringify({ type: 'answer', answer: 'x' }) });
    FakeWs.all[0]!.onmessage!({ data: 'not json' });
    expect(events.message).toHaveBeenCalledTimes(1);
    expect(events.message).toHaveBeenCalledWith({ type: 'answer', answer: 'x' });
  });

  it('reconnects with growing delays and calls onOpen every time (so the TV refreshes viewers)', async () => {
    const { s, events } = make();
    s.start();
    FakeWs.all[0]!.open();
    expect(events.open).toHaveBeenCalledTimes(1);
    FakeWs.all[0]!.drop();
    await flush();
    expect(FakeWs.all).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeWs.all).toHaveLength(2);
    FakeWs.all[1]!.drop(); // never opened: the next wait is longer
    await flush();
    await vi.advanceTimersByTimeAsync(1999);
    expect(FakeWs.all).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeWs.all).toHaveLength(3);
    FakeWs.all[2]!.open();
    expect(events.open).toHaveBeenCalledTimes(2);
  });

  it('resets the backoff after a successful open', async () => {
    const { s } = make();
    s.start();
    FakeWs.all[0]!.drop();
    await flush();
    await vi.advanceTimersByTimeAsync(1000);
    FakeWs.all[1]!.drop();
    await flush();
    await vi.advanceTimersByTimeAsync(2000);
    FakeWs.all[2]!.open();
    FakeWs.all[2]!.drop();
    await flush();
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeWs.all).toHaveLength(4);
  });

  it('reports connection state', async () => {
    const { s, events } = make();
    s.start();
    FakeWs.all[0]!.open();
    FakeWs.all[0]!.drop();
    await flush();
    expect(events.state.mock.calls.map(c => c[0])).toEqual([true, false]);
  });

  it('stops and reports gone when the household no longer exists', async () => {
    const { s, events } = make({ isGone: async () => true });
    s.start();
    FakeWs.all[0]!.open();
    FakeWs.all[0]!.drop();
    await flush();
    expect(events.gone).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60000);
    expect(FakeWs.all).toHaveLength(1);
  });

  it('keeps retrying when the gone-check itself fails (offline)', async () => {
    const { s, events } = make({
      isGone: async () => {
        throw new Error('offline');
      },
    });
    s.start();
    FakeWs.all[0]!.drop();
    await flush();
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeWs.all).toHaveLength(2);
    expect(events.gone).not.toHaveBeenCalled();
  });

  it('pings every 5 minutes while open and stops pinging after stop()', async () => {
    const { s } = make();
    s.start();
    const ws = FakeWs.all[0]!;
    ws.open();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(ws.sent).toEqual(['ping']);
    s.stop();
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(ws.sent).toEqual(['ping']);
  });

  it('does not reconnect after stop()', async () => {
    const { s } = make();
    s.start();
    s.stop();
    await vi.advanceTimersByTimeAsync(60000);
    expect(FakeWs.all).toHaveLength(1);
  });

  it('final review: a socket that is no longer current is ignored (replaced after a drop, or stopped)', async () => {
    const { s, events } = make();
    s.start();
    const old = FakeWs.all[0]!;
    old.open();
    old.drop();
    await flush();
    await vi.advanceTimersByTimeAsync(1000);
    const fresh = FakeWs.all[1]!;
    fresh.open();
    old.onmessage!({ data: JSON.stringify({ type: 'answer', answer: 'stale' }) });
    expect(events.message).not.toHaveBeenCalled();
    fresh.onmessage!({ data: JSON.stringify({ type: 'answer', answer: 'now' }) });
    expect(events.message).toHaveBeenCalledTimes(1);
    s.stop();
    fresh.onmessage!({ data: JSON.stringify({ type: 'answer', answer: 'after stop' }) });
    expect(events.message).toHaveBeenCalledTimes(1);
  });
});
