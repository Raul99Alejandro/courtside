export interface Config { httpApiUrl: string; wsUrl: string }
export interface ViewerInfo { name: string; level: string }

let config: Promise<Config> | undefined;
export const loadConfig = (): Promise<Config> => (config ??= fetch('/config.json').then(r => r.json() as Promise<Config>));

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
