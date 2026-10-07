import { randomUUID } from 'node:crypto';
import { answerLayerForQuestion, lowestLayer, normaliseCode, routeQuestion, type Layer, type Viewer } from '../core/index.js';
import { FALLBACK_ANSWER } from '../explain/answer.js';
import { MAX_GLOBAL_QUESTIONS_PER_DAY, MAX_GLOBAL_QUESTIONS_PER_HOUR, MAX_QUESTIONS_PER_HOUR, MAX_QUESTION_CHARS } from '../api/http.js';
import type { Push } from '../api/push.js';
import type { AlexaStore } from './store.js';

export type SkillDeps = {
  skillId: string;
  verify: (headers: Record<string, string | undefined>, rawBody: Buffer, signal?: AbortSignal) => Promise<boolean>;
  store: AlexaStore;
  answer: (i: { question: string; layer: Layer; viewerName: string }) => Promise<string>;
  push: Push;
  /** Absolute time (ms since epoch) by which a reply must be sent: Alexa gives a skill 8 seconds from the request. */
  deadlineAt: number;
  clock?: () => number;
};

export type SkillResult = { status: number; body: unknown };
const NAME = 'Courtside';
export const GUEST = 'Guest';
export const TOO_SLOW_TEXT = 'That is taking too long right now. Please try again.';
export const NOT_LINKED_TEXT = 'First link your household. Say: link household, then the six character code from your TV.';
const HELP = 'Say: link household, and the code on your TV. Then ask, for example: why was that offside.';

const reply = (speech: string, opts: { end?: boolean; card?: string; reprompt?: string } = {}) => ({
  version: '1.0',
  response: {
    outputSpeech: { type: 'PlainText', text: speech },
    ...(opts.card ? { card: { type: 'Simple', title: NAME, content: opts.card } } : {}),
    ...(opts.reprompt ? { reprompt: { outputSpeech: { type: 'PlainText', text: opts.reprompt } } } : {}),
    shouldEndSession: opts.end ?? true,
  },
});
const say = (speech: string, opts?: Parameters<typeof reply>[1]): SkillResult => ({ status: 200, body: reply(speech, opts) });

type AlexaBody = {
  session?: { application?: { applicationId?: string }; user?: { userId?: string } };
  context?: { System?: { application?: { applicationId?: string }; user?: { userId?: string }; person?: { personId?: string } } };
  request?: { type?: string; intent?: { name?: string; slots?: Record<string, { value?: string } | undefined> } };
};

const DIGITS: Record<string, string> = { zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9' };

/** Spoken codes arrive as "a b c two three four" or "ABC 234": letters and digits only, number words turned into digits. */
export function spokenCode(raw: string): string {
  const words = raw.toLowerCase().replace(/[.,-]/g, ' ').split(/\s+/).filter(Boolean).map(w => DIGITS[w] ?? w);
  return normaliseCode(words.join(''));
}

export async function handleSkill(deps: SkillDeps, headers: Record<string, string | undefined>, rawBody: Buffer): Promise<SkillResult> {
  const denied = { status: 400, body: { error: 'bad request' } };
  const clock = deps.clock ?? Date.now;
  if (!deps.skillId) return denied;
  let body: AlexaBody;
  try { body = JSON.parse(rawBody.toString('utf8')) as AlexaBody; } catch { return denied; }
  // Cheap check first: a request for another skill never causes a certificate download or a table read.
  const appId = body.context?.System?.application?.applicationId ?? body.session?.application?.applicationId;
  if (appId !== deps.skillId) return denied;
  const signal = AbortSignal.timeout(Math.max(1, deps.deadlineAt - clock()));
  const tooSlow = say(TOO_SLOW_TEXT, { card: TOO_SLOW_TEXT });
  const ok = await deps.verify(headers, rawBody, signal);
  if (!ok) return signal.aborted ? tooSlow : denied;

  const type = body.request?.type;
  if (type === 'LaunchRequest') return say(`Welcome to ${NAME}. ${HELP}`, { end: false, reprompt: HELP });
  if (type === 'SessionEndedRequest') return { status: 200, body: { version: '1.0', response: {} } };
  if (type !== 'IntentRequest') return denied;

  const userId = body.context?.System?.user?.userId ?? body.session?.user?.userId;
  const personId = body.context?.System?.person?.personId;
  const name = body.request?.intent?.name;
  const slot = (n: string) => body.request?.intent?.slots?.[n]?.value?.trim();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const withDeadline = async (work: () => Promise<SkillResult>): Promise<SkillResult> => {
    try {
      return await Promise.race([
        work(),
        new Promise<SkillResult>(resolve => { timer = setTimeout(() => resolve(tooSlow), Math.max(0, deps.deadlineAt - clock())); }),
      ]);
    } catch { return tooSlow; } finally { clearTimeout(timer); }
  };

  if (name === 'LinkHouseholdIntent') {
    if (!userId) return denied;
    const code = spokenCode(slot('code') ?? '');
    if (!code) return say('Which household code? Say: link household, and the six character code.', { end: false, reprompt: 'Say the six character code from your TV.' });
    return withDeadline(async () => {
      if (!(await deps.store.getViewers(code))) return say("I couldn't find that household code. Check the code on your TV and try again.", { end: false, reprompt: 'Say the six character code from your TV.' });
      await deps.store.linkHousehold(userId, code);
      return say('Linked. Now ask me a soccer question, and the answer will show on your TV.', { end: false, reprompt: 'Ask, for example: why was that offside.' });
    });
  }

  if (name === 'LinkVoiceIntent') {
    if (!userId) return denied;
    const who = slot('name');
    if (!who) return say('Say: I am, and your name.', { end: false, reprompt: 'Say: I am, and your name.' });
    if (!personId) return say("I can't tell voices apart here yet. I will answer as Guest, at the easiest level on your TV.");
    return withDeadline(async () => {
      const code = await deps.store.linkedHousehold(userId);
      if (!code) return say(NOT_LINKED_TEXT, { end: false, reprompt: NOT_LINKED_TEXT });
      const viewer = (await deps.store.getViewers(code))?.find(v => v.name.toLowerCase() === who.toLowerCase());
      if (!viewer) return say(`I don't know ${who} in this household yet. Add them on the phone first.`);
      await deps.store.linkVoice(code, personId, viewer.name);
      return say(`Nice to meet you, ${viewer.name}. I will remember your voice.`);
    });
  }

  if (name === 'AskCourtsideIntent') {
    if (!userId) return denied;
    const question = slot('query')?.slice(0, MAX_QUESTION_CHARS);
    if (!question) return say(HELP, { end: false, reprompt: HELP });
    return withDeadline(async () => {
      const { store } = deps;
      const code = await store.linkedHousehold(userId);
      const viewers = code ? await store.getViewers(code) : undefined;
      if (!code || !viewers) return say(NOT_LINKED_TEXT, { end: false, reprompt: NOT_LINKED_TEXT });

      // R-06: a known speaker is answered at their own layer and labelled with their name; anyone else is Guest at the lowest layer present (R-08-b).
      const spoken = personId ? await store.voiceViewer(code, personId) : undefined;
      const speaker: Viewer | undefined = spoken ? viewers.find(v => v.name.toLowerCase() === spoken.toLowerCase()) : undefined;
      const route = routeQuestion({ viewer: speaker });
      const label = route.ok ? route.label : GUEST;
      const layer: Layer = route.ok ? route.layer : await guestLayer(store, code, viewers);

      // The same caps as the phone: the household first, so a capped household does not eat the service budget.
      if (await store.countHousehold(code) > MAX_QUESTIONS_PER_HOUR) return say('This household has asked a lot of questions this hour. Try again later.');
      const global = await store.countGlobal();
      if (global.hour > MAX_GLOBAL_QUESTIONS_PER_HOUR || global.day > MAX_GLOBAL_QUESTIONS_PER_DAY) return say('Courtside is busy right now. Try again in a little while.');

      let text: string;
      try { text = await deps.answer({ question, layer, viewerName: label }); } catch { text = FALLBACK_ANSWER; }
      if (!text || text === FALLBACK_ANSWER) return say(FALLBACK_ANSWER, { card: FALLBACK_ANSWER });

      const item = { id: randomUUID(), label, layer, question, answer: text, at: Date.now() };
      await store.addAnswer(code, item).catch(() => undefined); // best effort: a TV that missed the push catches up from this
      const ids = await store.connections(code);
      if (ids.length) {
        try { await Promise.all((await deps.push(ids, { type: 'answer', ...item })).map(id => store.removeConnection(id))); } catch { /* recentAnswers still has it */ }
      }
      const line = label === GUEST ? "It's on your TV." : `It's on your TV, ${label}.`;
      return say(line, { card: `${label} asked: ${question}\n\n${text}` });
    });
  }

  if (name === 'AMAZON.StopIntent' || name === 'AMAZON.CancelIntent') return say('Goodbye.');
  return say(HELP, { end: false, reprompt: HELP });
}

/** R-08-b: the lowest layer among the people in the household's newest session; basic when nobody is known. */
async function guestLayer(store: AlexaStore, code: string, viewers: Viewer[]): Promise<Layer> {
  try {
    const latest = await store.latestSession(code);
    const session = latest ? await store.getSession(code, latest.sessionId) : undefined;
    const layers = (session?.present ?? []).flatMap(n => { const v = viewers.find(x => x.name === n); return v ? [answerLayerForQuestion(v)] : []; });
    return layers.length ? lowestLayer(layers) : 'basic';
  } catch { return 'basic'; }
}
