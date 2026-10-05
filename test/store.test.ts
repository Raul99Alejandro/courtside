import { describe, expect, it } from 'vitest';
import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoStore, HOUSEHOLD_TTL_S, TOUCH_EVERY_S } from '../src/api/store.js';

/** A stand-in for the DynamoDB document client: one META item and a few viewers, with the condition on lastTouched. */
function fakeDoc(lastTouched?: number) {
  const meta: { lastTouched?: number; ttl?: number } = { lastTouched };
  const viewerTtl = new Map<string, number>([['VIEWER#leo', 1], ['VIEWER#ana', 1]]);
  const sent: { kind: string; sk?: string }[] = [];
  const doc = {
    async send(cmd: unknown) {
      if (cmd instanceof UpdateCommand) {
        const i = cmd.input;
        const sk = (i.Key as { sk: string }).sk;
        sent.push({ kind: 'update', sk });
        const v = i.ExpressionAttributeValues as Record<string, number>;
        if (sk === 'META') {
          if (meta.lastTouched !== undefined && !(meta.lastTouched < v[':cut']!)) throw Object.assign(new Error('c'), { name: 'ConditionalCheckFailedException' });
          meta.lastTouched = v[':t']; meta.ttl = v[':ttl'];
        } else {
          if (!viewerTtl.has(sk)) throw Object.assign(new Error('c'), { name: 'ConditionalCheckFailedException' });
          viewerTtl.set(sk, v[':ttl']!);
        }
        return {};
      }
      if (cmd instanceof QueryCommand) { sent.push({ kind: 'query' }); return { Items: [...viewerTtl.keys()].map(sk => ({ sk })) }; }
      throw new Error('unexpected command');
    },
  };
  return { doc, meta, viewerTtl, sent };
}

describe('touchHousehold (sliding TTL)', () => {
  const nowS = () => Math.floor(Date.now() / 1000);

  it('pushes META and every viewer 30 days out and records lastTouched', async () => {
    const f = fakeDoc();
    await dynamoStore('t', f.doc as never).touchHousehold('ABC234');
    expect(HOUSEHOLD_TTL_S).toBe(30 * 24 * 3600);
    expect(Math.abs(f.meta.ttl! - (nowS() + HOUSEHOLD_TTL_S))).toBeLessThan(5);
    expect(Math.abs(f.meta.lastTouched! - nowS())).toBeLessThan(5);
    for (const ttl of f.viewerTtl.values()) expect(Math.abs(ttl - (nowS() + HOUSEHOLD_TTL_S))).toBeLessThan(5);
  });

  it('does nothing when it was touched within the hour, and again after the hour', async () => {
    const recent = fakeDoc(nowS() - 60);
    await dynamoStore('t', recent.doc as never).touchHousehold('ABC234');
    expect(recent.sent.map(s => s.kind)).toEqual(['update']); // the guarded META write failed its condition: no viewer writes
    expect([...recent.viewerTtl.values()]).toEqual([1, 1]);
    const old = fakeDoc(nowS() - TOUCH_EVERY_S - 1);
    await dynamoStore('t', old.doc as never).touchHousehold('ABC234');
    expect(old.sent.filter(s => s.kind === 'update')).toHaveLength(3);
  });

  it('one viewer failing does not fail the touch', async () => {
    const f = fakeDoc();
    f.viewerTtl.delete('VIEWER#ana'); // deleted between the query and the update would fail its condition
    const real = f.doc.send.bind(f.doc);
    let first = true;
    f.doc.send = async (cmd: unknown) => { if (cmd instanceof QueryCommand && first) { first = false; await real(cmd); return { Items: [{ sk: 'VIEWER#leo' }, { sk: 'VIEWER#ana' }] }; } return real(cmd); };
    await expect(dynamoStore('t', f.doc as never).touchHousehold('ABC234')).resolves.toBeUndefined();
  });
});
