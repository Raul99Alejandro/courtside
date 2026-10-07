import { createSign, generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { createRequestVerifier, MAX_NEGATIVE_ENTRIES, validChainUrl } from '../../src/alexa/verify.js';

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const URL_OK = 'https://s3.amazonaws.com/echo.api/echo-api-cert.pem';
const NOW = new Date('2026-10-07T12:00:00Z');
const SKILL = 'amzn1.ask.skill.test';

const bodyOf = (request: unknown, appId = SKILL) => JSON.stringify({ version: '1.0', session: { application: { applicationId: appId } }, context: { System: { application: { applicationId: appId } } }, request });
const intent = (name: string, query?: string, timestamp = NOW.toISOString()) =>
  ({ type: 'IntentRequest', timestamp, intent: { name, slots: query ? { query: { name: 'query', value: query } } : {} } });
const sign = (body: string, algo = 'RSA-SHA256') => createSign(algo).update(body).sign(fx('leaf.key'), 'base64');

const verifier = (pem = fx('leaf.pem'), now = NOW) => createRequestVerifier({ fetchChain: async () => pem, now: () => now, roots: [fx('ca.pem')] });
const signed = (body: string) => ({ signaturecertchainurl: URL_OK, 'signature-256': sign(body) });

describe('Alexa request verification', () => {
  it('rejects a chain whose intermediate is not a CA', async () => {
    const body = bodyOf(intent('AskWhyIntent', 'nova'));
    const v = createRequestVerifier({ fetchChain: async () => fx('nonca-chain.pem'), now: () => NOW, roots: [fx('ca2.pem')] });
    expect(await v(signed(body), Buffer.from(body))).toBe(false);
  });
  it('downloads a certificate once, and remembers failures for a while', async () => {
    const body = bodyOf(intent('AskWhyIntent', 'nova'));
    let fetches = 0;
    const good = createRequestVerifier({ fetchChain: async () => { fetches++; return fx('leaf.pem'); }, now: () => NOW, roots: [fx('ca.pem')] });
    expect(await good(signed(body), Buffer.from(body))).toBe(true);
    expect(await good(signed(body), Buffer.from(body))).toBe(true);
    expect(fetches).toBe(1);
    let badFetches = 0;
    let now = NOW;
    const bad = createRequestVerifier({ fetchChain: async () => { badFetches++; return fx('bad.pem'); }, now: () => now, roots: [fx('ca.pem')] });
    await bad(signed(body), Buffer.from(body)); await bad(signed(body), Buffer.from(body));
    expect(badFetches).toBe(1);
    now = new Date(NOW.getTime() + 61_000);
    await bad(signed(body), Buffer.from(body));
    expect(badFetches).toBe(2);
  });
  it('accepts a correctly signed, fresh request (SHA-256 and legacy SHA-1)', async () => {
    const body = bodyOf(intent('AskWhyIntent', 'nova'));
    expect(await verifier()(signed(body), Buffer.from(body))).toBe(true);
    expect(await verifier()({ signaturecertchainurl: URL_OK, signature: sign(body, 'RSA-SHA1') }, Buffer.from(body))).toBe(true);
  });
  it('rejects a tampered body', async () => {
    const body = bodyOf(intent('AskWhyIntent', 'nova'));
    expect(await verifier()(signed(body), Buffer.from(body.replace('nova', 'other')))).toBe(false);
  });
  it('rejects a stale or future timestamp', async () => {
    for (const ts of ['2026-10-07T11:55:00Z', '2026-10-07T12:05:00Z']) {
      const body = bodyOf(intent('AskWhyIntent', 'nova', ts));
      expect(await verifier()(signed(body), Buffer.from(body))).toBe(false);
    }
  });
  it('rejects missing headers, bad certificate URLs, and a certificate for another name', async () => {
    const body = bodyOf(intent('AskWhyIntent', 'nova'));
    expect(await verifier()({}, Buffer.from(body))).toBe(false);
    for (const u of ['http://s3.amazonaws.com/echo.api/c.pem', 'https://s3.amazonaws.com.evil.com/echo.api/c.pem', 'https://s3.amazonaws.com/evil/c.pem', 'https://s3.amazonaws.com:8443/echo.api/c.pem', 'not a url'])
      expect(await verifier()({ ...signed(body), signaturecertchainurl: u }, Buffer.from(body)), u).toBe(false);
    expect(validChainUrl(URL_OK)).toBe(true);
    expect(await verifier(fx('bad.pem'))(signed(body), Buffer.from(body))).toBe(false);
  });
  it('rejects a chain that does not lead to a trusted root, and an expired certificate', async () => {
    const body = bodyOf(intent('AskWhyIntent', 'nova'));
    expect(await createRequestVerifier({ fetchChain: async () => fx('leaf.pem'), now: () => NOW, roots: [] })(signed(body), Buffer.from(body))).toBe(false);
    expect(await verifier(fx('leaf.pem'), new Date('2200-01-01T00:00:00Z'))(signed(body), Buffer.from(body))).toBe(false);
  });
  it('rejects a signature made with another key', async () => {
    const body = bodyOf(intent('AskWhyIntent', 'nova'));
    const other = createSign('RSA-SHA256').update(body).sign(generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey, 'base64');
    expect(await verifier()({ signaturecertchainurl: URL_OK, 'signature-256': other }, Buffer.from(body))).toBe(false);
  });
  it('keeps at most a bounded number of remembered failures', async () => {
    const body = bodyOf(intent('AskWhyIntent', 'nova'));
    let fetches = 0;
    const v = createRequestVerifier({ fetchChain: async () => { fetches++; return fx('bad.pem'); }, now: () => NOW, roots: [fx('ca.pem')] });
    const url = (i: number) => `https://s3.amazonaws.com/echo.api/c${i}.pem`;
    for (let i = 0; i < MAX_NEGATIVE_ENTRIES + 5; i++) await v({ ...signed(body), signaturecertchainurl: url(i) }, Buffer.from(body));
    expect(fetches).toBe(MAX_NEGATIVE_ENTRIES + 5);
    await v({ ...signed(body), signaturecertchainurl: url(MAX_NEGATIVE_ENTRIES + 4) }, Buffer.from(body)); // newest is still remembered
    expect(fetches).toBe(MAX_NEGATIVE_ENTRIES + 5);
    await v({ ...signed(body), signaturecertchainurl: url(0) }, Buffer.from(body)); // oldest was evicted, so it is fetched again
    expect(fetches).toBe(MAX_NEGATIVE_ENTRIES + 6);
  });
});
