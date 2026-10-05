import { GENERATED_CONFIG } from '../config.generated';
import type { Config } from './config';

export type { Config };

/** On the deployed site /config.json is served next to the page; anywhere else (local dev) the bundled config is used. */
export async function loadConfig(): Promise<Config> {
  try {
    const r = await fetch('/config.json');
    if (r.ok) {
      const j = (await r.json()) as Partial<Config>;
      if (typeof j.httpApiUrl === 'string' && typeof j.wsUrl === 'string') {
        return { ...GENERATED_CONFIG, ...j, siteUrl: typeof j.siteUrl === 'string' ? j.siteUrl : window.location.origin };
      }
    }
  } catch {
    /* not on the site */
  }
  return GENERATED_CONFIG;
}
