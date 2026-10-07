import { answerQuestion } from '../explain/answer.js';
import { postToConnections } from '../api/push.js';
import { createRequestVerifier, fetchChainOverHttps } from './verify.js';
import { handleSkill } from './skill.js';
import { dynamoAlexaStore } from './store.js';

export type UrlEvent = {
  requestContext: { http: { method: string } };
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
};

const store = dynamoAlexaStore();
const push = postToConnections();
const verify = createRequestVerifier({ fetchChain: fetchChainOverHttps, now: () => new Date() });
const skillId = process.env.ALEXA_SKILL_ID ?? '';

const json = (statusCode: number, body: unknown) => ({ statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

// Alexa allows 8 s from the request; leave a second to send the reply.
const BUDGET_MS = 7000;

export const handler = async (event: UrlEvent) => {
  const started = Date.now();
  if (event.requestContext.http.method !== 'POST' || !event.body) return json(404, { error: 'not found' });
  const raw = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
  const res = await handleSkill({ skillId, verify, store, push, answer: answerQuestion, deadlineAt: started + BUDGET_MS }, event.headers ?? {}, raw);
  return json(res.status, res.body);
};
