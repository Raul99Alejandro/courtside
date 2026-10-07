/** Default live chain (phone + Alexa questions): Claude Haiku 4.5 first, Nova 2 Lite as the fallback. */
export const DEFAULT_LIVE_MODELS = ['us.anthropic.claude-haiku-4-5-20251001-v1:0', 'us.amazon.nova-2-lite-v1:0'];

/** Comma-separated Bedrock ids to a clean list; empty or missing gives the default. */
export function parseModels(raw: string | undefined, fallback: string[] = DEFAULT_LIVE_MODELS): string[] {
  const ids = (raw ?? '').split(',').map(s => s.trim()).filter(Boolean);
  return ids.length ? ids : fallback;
}

/** The live chain: the LIVE_MODELS env var (set by the stack from the `liveModels` CDK context) or the default. */
export const liveModels = (env: Record<string, string | undefined> = process.env): string[] => parseModels(env.LIVE_MODELS);

/** Foundation model id behind an inference profile id ("us.amazon.nova-pro-v1:0" -> "amazon.nova-pro-v1:0"). */
export const foundationId = (id: string): string => id.replace(/^(us|eu|apac|us-gov|global)\./, '');
