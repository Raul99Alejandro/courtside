import type { Concept, Viewer } from '@courtside/core';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

export const NETWORK_ERROR = 'Could not reach Courtside - check the internet connection.';
const TIMEOUT_MS = 10_000;

export interface ViewersReply {
  viewers: Viewer[];
  promotions: string[];
}

/** Which thing went missing, from the backend's friendly 404/400 messages. */
export type Gone = 'household' | 'session' | 'viewer';

export function isGone(r: ApiResult<unknown>): Gone | undefined {
  if (r.ok) return undefined;
  if (r.status === 404 && r.message === 'Unknown code') return 'household';
  if (r.status === 404 && r.message === 'Session expired') return 'session';
  if ((r.status === 404 && r.message === 'Unknown viewer') || (r.status === 400 && r.message === 'Pick who you are first')) return 'viewer';
  return undefined;
}

export function createClient(baseUrl: string, fetchImpl: typeof fetch = (...a) => fetch(...a)) {
  const base = baseUrl.replace(/\/$/, '');
  const enc = encodeURIComponent;

  async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<ApiResult<T>> {
    const ctl = typeof AbortController === 'undefined' ? undefined : new AbortController();
    const timer = ctl ? setTimeout(() => ctl.abort(), TIMEOUT_MS) : undefined;
    try {
      const res = await fetchImpl(base + path, {
        method,
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctl?.signal,
      });
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        data = undefined;
      }
      if (res.ok && data !== undefined) return { ok: true, data: data as T };
      const message = (data as { message?: string } | undefined)?.message;
      return { ok: false, status: res.status, message: message ?? 'Courtside had a problem - try again in a moment.' };
    } catch {
      return { ok: false, status: 0, message: NETWORK_ERROR };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return {
    createHousehold: () => call<{ householdId: string; code: string }>('POST', '/households'),
    getHousehold: (code: string) => call<{ viewers: Viewer[] }>('GET', `/households/${enc(code)}`),
    createSession: (code: string, present: string[]) => call<{ sessionId: string; viewers: Viewer[] }>('POST', `/households/${enc(code)}/sessions`, { present }),
    shown: (code: string, sessionId: string, body: { momentId: string; concepts: Concept[]; seq: number }) =>
      call<ViewersReply>('POST', `/households/${enc(code)}/sessions/${enc(sessionId)}/shown`, body),
    gotIt: (code: string, name: string, concepts: Concept[]) => call<ViewersReply>('POST', `/households/${enc(code)}/viewers/${enc(name)}/got-it`, { concepts }),
    undoPromotion: (code: string, name: string) => call<ViewersReply>('POST', `/households/${enc(code)}/viewers/${enc(name)}/undo-promotion`),
  };
}

export type Client = ReturnType<typeof createClient>;
