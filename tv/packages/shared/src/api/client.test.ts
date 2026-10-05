import { describe, expect, it, vi } from 'vitest';
import { createClient, isGone } from './client';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function setup(res: () => Response | Promise<Response>) {
  const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => res());
  return { fetchImpl, client: createClient('https://api.test/', fetchImpl as unknown as typeof fetch) };
}

describe('api client', () => {
  it('creates a household with POST /households', async () => {
    const { client, fetchImpl } = setup(() => json(200, { householdId: 'h', code: 'ABC234' }));
    expect(await client.createHousehold()).toEqual({ ok: true, data: { householdId: 'h', code: 'ABC234' } });
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://api.test/households');
    expect(fetchImpl.mock.calls[0]![1]!.method).toBe('POST');
  });

  it('sends JSON bodies and encodes path parts', async () => {
    const { client, fetchImpl } = setup(() => json(200, { viewers: [], promotions: [] }));
    await client.gotIt('ABC234', 'Ana Maria', ['goal']);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.test/households/ABC234/viewers/Ana%20Maria/got-it');
    expect(JSON.parse(init!.body as string)).toEqual({ concepts: ['goal'] });
    expect((init!.headers as Record<string, string>)['content-type']).toBe('application/json');
  });

  it('posts shown with seq', async () => {
    const { client, fetchImpl } = setup(() => json(200, { viewers: [], promotions: [] }));
    await client.shown('ABC234', 'sid', { momentId: 'm1', concepts: ['offside'], seq: 3 });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.test/households/ABC234/sessions/sid/shown');
    expect(JSON.parse(init!.body as string)).toEqual({ momentId: 'm1', concepts: ['offside'], seq: 3 });
  });

  it('turns an error status into the server message', async () => {
    const { client } = setup(() => json(400, { message: 'Up to 3 viewers at a time' }));
    expect(await client.createSession('ABC234', ['a', 'b', 'c', 'd'])).toEqual({ ok: false, status: 400, message: 'Up to 3 viewers at a time' });
  });

  it('reports a network failure as status 0 with a friendly message', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const client = createClient('https://api.test', fetchImpl as unknown as typeof fetch);
    const r = await client.getHousehold('ABC234');
    expect(r).toMatchObject({ ok: false, status: 0 });
    expect((r as { message: string }).message).toMatch(/reach Courtside/);
  });

  it('survives a non-JSON reply', async () => {
    const { client } = setup(() => new Response('<html>bad gateway</html>', { status: 502 }));
    expect(await client.getHousehold('ABC234')).toMatchObject({ ok: false, status: 502 });
  });

  it('classifies the three "gone" cases', () => {
    expect(isGone({ ok: false, status: 404, message: 'Unknown code' })).toBe('household');
    expect(isGone({ ok: false, status: 404, message: 'Session expired' })).toBe('session');
    expect(isGone({ ok: false, status: 404, message: 'Unknown viewer' })).toBe('viewer');
    expect(isGone({ ok: false, status: 400, message: 'Pick who you are first' })).toBe('viewer');
    expect(isGone({ ok: false, status: 500, message: 'x' })).toBeUndefined();
    expect(isGone({ ok: true, data: 1 })).toBeUndefined();
  });
});
