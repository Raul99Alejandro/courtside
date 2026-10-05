export interface Config { httpApiUrl: string; wsUrl: string }
export interface ViewerInfo { name: string; level: string }

let config: Promise<Config> | undefined;
// config.json only exists on a deployed site (the stack generates it); in local dev say so instead of failing silently.
export const loadConfig = (): Promise<Config> => (config ??= fetch('/config.json').then(r => {
  if (!r.ok) throw new Error('config.json missing');
  return r.json() as Promise<Config>;
}).catch(err => {
  const el = document.getElementById('msg');
  if (el) el.textContent = 'No config.json: this page only works on the deployed site (the deploy writes the API addresses), or add web/public/config.json locally.';
  throw err;
}));

export async function call<T>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
  const { httpApiUrl } = await loadConfig();
  const r = await fetch(httpApiUrl.replace(/\/$/, '') + path, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, data: (await r.json()) as T };
}

export const text = (el: HTMLElement, s: string): void => { el.textContent = s; };
