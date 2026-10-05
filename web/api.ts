export interface Config { httpApiUrl: string; wsUrl: string }
export interface ViewerInfo { name: string; level: string }

let config: Promise<Config> | undefined;
// config.json only exists on a deployed site (the stack generates it). For local dev, copy a config.json
// (httpApiUrl and wsUrl, taken from cdk-outputs.json after a deploy) into web/public/; it is gitignored.
export const loadConfig = (): Promise<Config> => (config ??= fetch('/config.json').then(r => {
  if (!r.ok) throw new Error('config.json missing');
  return r.json() as Promise<Config>;
}).catch(err => {
  const el = document.getElementById('msg');
  if (el) el.textContent = 'No config.json: this page only works on the deployed site (the deploy writes the API addresses).';
  throw err;
}));

export const NETWORK_ERROR = 'Could not reach Courtside - check your connection and try again.';

/** Calls the API; network failures and non-JSON replies come back as { status: 0, data: { message } } instead of throwing. */
export async function call<T>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T & { message?: string } }> {
  try {
    const { httpApiUrl } = await loadConfig();
    const r = await fetch(httpApiUrl.replace(/\/$/, '') + path, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: (await r.json()) as T & { message?: string } };
  } catch {
    return { status: 0, data: { message: NETWORK_ERROR } as T & { message?: string } };
  }
}

export const text = (el: HTMLElement, s: string): void => { el.textContent = s; };
