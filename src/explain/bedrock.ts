import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

export const PRE_MODELS = ['us.anthropic.claude-sonnet-4-6', 'us.anthropic.claude-haiku-4-5-20251001-v1:0'];
export const LIVE_MODELS = ['us.anthropic.claude-haiku-4-5-20251001-v1:0', 'us.amazon.nova-2-lite-v1:0'];

export interface ConverseResult { text: string; modelId: string; inputTokens?: number; outputTokens?: number }
export type Converse = (modelIds: string[], system: string, user: string, maxTokens: number) => Promise<ConverseResult>;

let client: BedrockRuntimeClient | undefined;

/** Tries the model ids in order; any failure (throttling, 5xx, access denied) moves on to the next. */
export const converse: Converse = async (modelIds, system, user, maxTokens) => {
  client ??= new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
  let last: unknown;
  for (const modelId of modelIds) {
    try {
      const r = await client.send(new ConverseCommand({
        modelId,
        system: [{ text: system }],
        messages: [{ role: 'user', content: [{ text: user }] }],
        inferenceConfig: { maxTokens },
      }));
      const text = (r.output?.message?.content ?? []).map(c => c.text ?? '').join('').trim();
      if (!text) throw new Error(`empty response from ${modelId}`);
      return { text, modelId, inputTokens: r.usage?.inputTokens, outputTokens: r.usage?.outputTokens };
    } catch (err) { last = err; }
  }
  throw last ?? new Error('no model ids given');
};
