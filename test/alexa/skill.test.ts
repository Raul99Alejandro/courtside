import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { newViewer, type Viewer } from '../../src/core/index.js';
import { FALLBACK_ANSWER } from '../../src/explain/answer.js';
import { GUEST, handleSkill, NOT_LINKED_TEXT, spokenCode, TOO_SLOW_TEXT, type SkillDeps } from '../../src/alexa/skill.js';
import type { AlexaStore } from '../../src/alexa/store.js';
import { createRequestVerifier } from '../../src/alexa/verify.js';
import { MAX_GLOBAL_QUESTIONS_PER_HOUR, MAX_QUESTIONS_PER_HOUR } from '../../src/api/http.js';
import type { RecentAnswer, Session } from '../../src/api/store.js';

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const NOW = new Date('2026-10-07T12:00:00Z');
const SKILL = 'amzn1.ask.skill.test';
const USER = 'amzn1.ask.account.user1';
const CODE = 'ABC234';

type Slots = Record<string, string>;
const bodyOf = (request: unknown, opts: { appId?: string; personId?: string; userId?: string } = {}) => JSON.stringify({
  version: '1.0',
  session: { application: { applicationId: opts.appId ?? SKILL }, user: { userId: opts.userId ?? USER } },
  context: { System: { application: { applicationId: opts.appId ?? SKILL }, user: { userId: opts.userId ?? USER }, ...(opts.personId ? { person: { personId: opts.personId } } : {}) } },
  request,
});
const intent = (name: string, slots: Slots = {}, timestamp = NOW.toISOString()) =>
  ({ type: 'IntentRequest', timestamp, intent: { name, slots: Object.fromEntries(Object.entries(slots).map(([k, value]) => [k, { name: k, value }])) } });
type Resp = { response: { outputSpeech?: { text: string }; card?: { content: string }; shouldEndSession?: boolean } };

function fakeStore(viewers: Viewer[] = [newViewer('Leo', 'beginner', 1), newViewer('Raul', 'expert', 2)]) {
  const households = new Map<string, Viewer[]>([[CODE, viewers]]);
  const links = new Map<string, string>();
  const voices = new Map<string, string>();
  const answers: RecentAnswer[] = [];
  const sessions = new Map<string, Session>();
  const removed: string[] = [];
  const counts = { household: 0, hour: 0, day: 0 };
  let latest: { sessionId: string } | undefined;
  const store: AlexaStore = {
    async createHousehold() { return { householdId: 'h', code: CODE }; },
    async getViewers(code) { return households.get(code); },
    async putViewer() {}, async getViewer() { return undefined; }, async putViewerIf() { return false; },
    async getSession(code, id) { return sessions.get(`${code}#${id}`); },
    async putSession(code, id, s) { sessions.set(`${code}#${id}`, s); },
    async claimShown() { return true; }, async releaseShown() {},
    async latestSession() { return latest; },
    async setLatestSession(_c, l) { latest = l; },
    async addAnswer(_c, a) { answers.push(a); },
    async recentAnswers() { return answers; },
    async touchHousehold() {}, async addConnection() {},
    async removeConnection(id) { removed.push(id); },
    async connections() { return ['c1', 'c2']; },
    async countHousehold() { return ++counts.household; },
    async countGlobal() { return { hour: ++counts.hour, day: ++counts.day }; },
    async linkHousehold(u, c) { links.set(u, c); },
    async linkedHousehold(u) { return links.get(u); },
    async linkVoice(c, p, n) { voices.set(`${c}#${p}`, n); },
    async voiceViewer(c, p) { return voices.get(`${c}#${p}`); },
  };
  return { store, links, voices, answers, sessions, removed, counts, setLatest: (id: string, present: string[]) => { latest = { sessionId: id }; sessions.set(`${CODE}#${id}`, { present }); } };
}

describe('Courtside Alexa skill', () => {
  let f: ReturnType<typeof fakeStore>;
  let asked: { question: string; layer: string; viewerName: string }[];
  let pushed: { ids: string[]; payload: Record<string, unknown> }[];
  let verified: number;
  let answerFn: SkillDeps['answer'];
  const deps = (over: Partial<SkillDeps> = {}): SkillDeps => ({
    skillId: SKILL, deadlineAt: Date.now() + 5000, store: f.store,
    verify: async () => { verified++; return true; },
    answer: i => { asked.push(i); return answerFn(i); },
    push: async (ids, payload) => { pushed.push({ ids, payload: payload as Record<string, unknown> }); return []; },
    ...over,
  });
  const run = (body: string, d = deps()) => handleSkill(d, {}, Buffer.from(body));
  const speech = (r: { body: unknown }) => (r.body as Resp).response.outputSpeech!.text;

  beforeEach(() => {
    f = fakeStore(); asked = []; pushed = []; verified = 0;
    answerFn = async () => 'Offside means a player is ahead of the defenders.';
  });

  it('links a household from a spoken code, and says so when the code is unknown', async () => {
    const ok = await run(bodyOf(intent('LinkHouseholdIntent', { code: 'a b c two three four' })));
    expect(speech(ok)).toMatch(/^Linked/);
    expect(f.links.get(USER)).toBe(CODE);
    const bad = await run(bodyOf(intent('LinkHouseholdIntent', { code: 'z z z z z z' }), { userId: 'other' }));
    expect(speech(bad)).toMatch(/couldn't find/);
    expect(f.links.has('other')).toBe(false);
  });

  it('turns spoken codes into household codes', () => {
    expect(spokenCode('a b c two three four')).toBe('ABC234');
    expect(spokenCode('ABC-234')).toBe('ABC234');
    expect(spokenCode('abc 234.')).toBe('ABC234');
  });

  it('links a voice to a viewer of the linked household, case-insensitively', async () => {
    f.links.set(USER, CODE);
    const r = await run(bodyOf(intent('LinkVoiceIntent', { name: 'leo' }), { personId: 'amzn1.ask.person.p1' }));
    expect(speech(r)).toBe('Nice to meet you, Leo. I will remember your voice.');
    expect(f.voices.get(`${CODE}#amzn1.ask.person.p1`)).toBe('Leo');
  });

  it('refuses to link a voice for an unknown viewer, an unlinked account, or when no voice is recognised', async () => {
    f.links.set(USER, CODE);
    expect(speech(await run(bodyOf(intent('LinkVoiceIntent', { name: 'Zed' }), { personId: 'p' })))).toMatch(/don't know Zed/);
    expect(f.voices.size).toBe(0);
    expect(speech(await run(bodyOf(intent('LinkVoiceIntent', { name: 'Leo' }))))).toMatch(/can't tell voices apart/);
    expect(speech(await run(bodyOf(intent('LinkVoiceIntent', { name: 'Leo' }), { personId: 'p', userId: 'nobody' })))).toBe(NOT_LINKED_TEXT);
  });

  it('R-06: a known speaker is answered at their layer, labelled with their name, pushed to the TVs and kept', async () => {
    f.links.set(USER, CODE); f.voices.set(`${CODE}#p1`, 'Raul');
    const r = await run(bodyOf(intent('AskCourtsideIntent', { query: 'offside' }), { personId: 'p1' }));
    expect(asked).toEqual([{ question: 'offside', layer: 'tactical', viewerName: 'Raul' }]);
    expect(speech(r)).toBe("It's on your TV, Raul.");
    expect(pushed).toHaveLength(1);
    expect(pushed[0]!.ids).toEqual(['c1', 'c2']);
    expect(pushed[0]!.payload).toMatchObject({ type: 'answer', label: 'Raul', layer: 'tactical', question: 'offside', answer: 'Offside means a player is ahead of the defenders.' });
    expect(typeof pushed[0]!.payload.id).toBe('string');
    expect(typeof pushed[0]!.payload.at).toBe('number');
    expect(f.answers).toEqual([{ id: pushed[0]!.payload.id, label: 'Raul', layer: 'tactical', question: 'offside', answer: 'Offside means a player is ahead of the defenders.', at: pushed[0]!.payload.at }]);
  });

  it('a beginner speaker gets the basic layer', async () => {
    f.links.set(USER, CODE); f.voices.set(`${CODE}#p1`, 'Leo');
    await run(bodyOf(intent('AskCourtsideIntent', { query: 'why was that offside' }), { personId: 'p1' }));
    expect(asked[0]).toMatchObject({ layer: 'basic', viewerName: 'Leo' });
  });

  it('an unknown speaker is Guest, at the lowest layer present in the newest session (R-08-b)', async () => {
    f.links.set(USER, CODE);
    f.setLatest('s1', ['Raul', 'Leo']);
    const r = await run(bodyOf(intent('AskCourtsideIntent', { query: 'offside' })));
    expect(asked[0]).toEqual({ question: 'offside', layer: 'basic', viewerName: GUEST });
    expect(pushed[0]!.payload).toMatchObject({ label: GUEST, layer: 'basic' });
    expect(speech(r)).toBe("It's on your TV.");
    f.setLatest('s2', ['Raul']);
    await run(bodyOf(intent('AskCourtsideIntent', { query: 'offside' })));
    expect(asked[1]!.layer).toBe('tactical');
  });

  it('Guest with no session answers at basic', async () => {
    f.links.set(USER, CODE);
    await run(bodyOf(intent('AskCourtsideIntent', { query: 'offside' }), { personId: 'stranger' }));
    expect(asked[0]).toMatchObject({ layer: 'basic', viewerName: GUEST });
  });

  it('a voice linked to a viewer who was removed is Guest', async () => {
    f.links.set(USER, CODE); f.voices.set(`${CODE}#p1`, 'Gone');
    await run(bodyOf(intent('AskCourtsideIntent', { query: 'offside' }), { personId: 'p1' }));
    expect(asked[0]!.viewerName).toBe(GUEST);
  });

  it('asks to link first when the account has no household, and answers nothing', async () => {
    const r = await run(bodyOf(intent('AskCourtsideIntent', { query: 'offside' })));
    expect(speech(r)).toBe(NOT_LINKED_TEXT);
    expect(asked).toEqual([]);
    expect(f.counts.household).toBe(0);
  });

  it('counts each question against the household and service caps, and stops at them without calling the model', async () => {
    f.links.set(USER, CODE);
    await run(bodyOf(intent('AskCourtsideIntent', { query: 'offside' })));
    expect(f.counts).toEqual({ household: 1, hour: 1, day: 1 });
    f.counts.household = MAX_QUESTIONS_PER_HOUR;
    expect(speech(await run(bodyOf(intent('AskCourtsideIntent', { query: 'offside' }))))).toMatch(/a lot of questions/);
    f.counts.household = 0; f.counts.hour = MAX_GLOBAL_QUESTIONS_PER_HOUR;
    expect(speech(await run(bodyOf(intent('AskCourtsideIntent', { query: 'offside' }))))).toMatch(/busy/);
    expect(asked).toHaveLength(1);
  });

  it('does not push or keep a failed answer', async () => {
    f.links.set(USER, CODE);
    answerFn = async () => FALLBACK_ANSWER;
    expect(speech(await run(bodyOf(intent('AskCourtsideIntent', { query: 'offside' }))))).toBe(FALLBACK_ANSWER);
    answerFn = async () => { throw new Error('boom'); };
    expect(speech(await run(bodyOf(intent('AskCourtsideIntent', { query: 'offside' }))))).toBe(FALLBACK_ANSWER);
    expect(pushed).toEqual([]);
    expect(f.answers).toEqual([]);
  });

  it('still answers when the push fails, and forgets gone connections', async () => {
    f.links.set(USER, CODE);
    expect(speech(await run(bodyOf(intent('AskCourtsideIntent', { query: 'offside' })), deps({ push: async () => { throw new Error('ws down'); } })))).toBe("It's on your TV.");
    expect(f.answers).toHaveLength(1);
    await run(bodyOf(intent('AskCourtsideIntent', { query: 'offside' })), deps({ push: async () => ['c2'] }));
    expect(f.removed).toEqual(['c2']);
  });

  it('says "taking too long" when the model misses the shared deadline', async () => {
    f.links.set(USER, CODE);
    const r = await run(bodyOf(intent('AskCourtsideIntent', { query: 'offside' })), deps({ answer: () => new Promise<never>(() => {}), deadlineAt: Date.now() + 40 }));
    expect(speech(r)).toBe(TOO_SLOW_TEXT);
    expect(pushed).toEqual([]);
  });

  it('checks the skill id before any certificate work or table read', async () => {
    const r = await run(bodyOf(intent('AskCourtsideIntent', { query: 'x' }), { appId: 'amzn1.ask.skill.other' }));
    expect(r.status).toBe(400);
    expect(verified).toBe(0);
    expect(f.counts.household).toBe(0);
  });

  it('rejects unverified requests, a missing skill id and bad JSON before touching data', async () => {
    f.links.set(USER, CODE);
    const body = bodyOf(intent('AskCourtsideIntent', { query: 'x' }));
    expect((await run(body, deps({ verify: async () => false }))).status).toBe(400);
    expect((await run(body, deps({ skillId: '' }))).status).toBe(400);
    expect((await run('not json')).status).toBe(400);
    expect(asked).toEqual([]);
    expect(f.counts.household).toBe(0);
  });

  it('handles launch, help, an empty question, stop and session end', async () => {
    const say = async (req: unknown) => ((await run(bodyOf(req))).body as Resp).response;
    expect((await say({ type: 'LaunchRequest', timestamp: NOW.toISOString() })).shouldEndSession).toBe(false);
    expect((await say(intent('AMAZON.HelpIntent'))).shouldEndSession).toBe(false);
    expect((await say(intent('AskCourtsideIntent'))).shouldEndSession).toBe(false);
    expect((await say(intent('AMAZON.StopIntent'))).shouldEndSession).toBe(true);
    expect((await run(bodyOf({ type: 'SessionEndedRequest', timestamp: NOW.toISOString() }))).status).toBe(200);
  });

  it('end to end with a signed request from the fixture certificate', async () => {
    f.links.set(USER, CODE);
    const body = bodyOf(intent('AskCourtsideIntent', { query: 'offside' }));
    const verify = createRequestVerifier({ fetchChain: async () => fx('leaf.pem'), now: () => NOW, roots: [fx('ca.pem')] });
    const headers = { signaturecertchainurl: 'https://s3.amazonaws.com/echo.api/echo-api-cert.pem', 'signature-256': createSign('RSA-SHA256').update(body).sign(fx('leaf.key'), 'base64') };
    const ok = await handleSkill(deps({ verify }), headers, Buffer.from(body));
    expect(speech(ok)).toBe("It's on your TV.");
    const tampered = await handleSkill(deps({ verify }), headers, Buffer.from(body.replace('offside', 'corner')));
    expect(tampered.status).toBe(400);
    expect(asked).toHaveLength(1);
  });
});
