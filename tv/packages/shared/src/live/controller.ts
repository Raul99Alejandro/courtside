import type { Concept, Layer, Viewer } from '@courtside/core';
import { isGone, type ApiResult, type Client, type ViewersReply } from '../api/client';

export interface KeyValueStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface SocketHandlers {
  onOpen: () => void;
  onMessage: (m: { type?: string; [k: string]: unknown }) => void;
  onGone: () => void;
  onState: (connected: boolean) => void;
}

export interface Backend {
  client: Client;
  /** Where the phone page lives (the QR points at `${siteUrl}/phone.html?code=...`). */
  siteUrl: string;
  openSocket: (code: string, handlers: SocketHandlers) => { start: () => void; stop: () => void };
}

export interface AnswerItem {
  id: number;
  label: string;
  layer: Layer;
  question: string;
  answer: string;
}

export interface LiveState {
  /** A household exists and its viewers are loaded. */
  ready: boolean;
  code?: string;
  siteUrl?: string;
  viewers: Viewer[];
  sessionId?: string;
  present: string[];
  /** "Leo moved up to Fan" messages the toast is showing. */
  promotions: string[];
  /** Answers pushed from phones; the first is on screen, the rest wait their turn. */
  answers: AnswerItem[];
  /** The moment the TV shows now (the pitch behind an answer). */
  momentId?: string;
  /** A message for Who's watching (household replaced, session ended, ...). */
  notice?: string;
  connected: boolean;
}

export const CODE_KEY = 'courtside.code';
const LEVEL_LABEL = { beginner: 'Beginner', fan: 'Fan', expert: 'Expert' } as const;
const RETRY_MS = 5000;

const NOTICE = {
  householdGone: "This TV's code expired. Here is a new code - add viewers again from your phone.",
  sessionEnded: 'That session ended. Pick who is watching.',
  viewerGone: (name: string) => `${name} is no longer in this household. Pick who is watching.`,
  viewerGoneAny: 'Someone is no longer in this household. Pick who is watching.',
};

export interface ControllerDeps {
  backend: () => Promise<Backend>;
  storage: KeyValueStorage;
  pollMs?: number;
}

const promotionMessage = (v: Viewer) => `${v.name} moved up to ${LEVEL_LABEL[v.level]}`;

/**
 * The live session: one household, who is watching, what was shown, answers waiting for the screen.
 * All viewer learning state comes from the backend; the TV only reports what it showed.
 */
export function createController(deps: ControllerDeps) {
  const pollMs = deps.pollMs ?? RETRY_MS;
  let state: LiveState = { ready: false, viewers: [], present: [], promotions: [], answers: [], connected: false };
  const listeners = new Set<() => void>();
  let backend: Backend | undefined;
  let socket: { start: () => void; stop: () => void } | undefined;
  let bootTimer: ReturnType<typeof setTimeout> | undefined;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let booting = false;
  let seq = 0;
  let answerId = 0;
  let lastShown: string | undefined;
  let pendingShown: { momentId: string; concepts: Concept[] }[] = [];
  let reqCounter = 0;
  let lastApplied = 0;
  let replacing: Promise<void> | undefined;

  const set = (patch: Partial<LiveState>) => {
    state = { ...state, ...patch };
    listeners.forEach(l => l());
  };

  /** Applies a viewers snapshot unless a newer one already landed; ends the session if someone in it is gone. */
  function applyViewers(viewers: Viewer[], req: number, promotions?: string[]) {
    if (req < lastApplied) return;
    lastApplied = req;
    const patch: Partial<LiveState> = { viewers };
    if (promotions?.length) patch.promotions = promotions;
    set(patch);
    if (state.sessionId) {
      const missing = state.present.find(n => !viewers.some(v => v.name === n));
      if (missing) endSession(NOTICE.viewerGone(missing));
    }
  }

  function endSession(notice?: string) {
    seq = 0;
    lastShown = undefined;
    pendingShown = [];
    set({ sessionId: undefined, present: [], promotions: [], momentId: undefined, notice });
    ensurePoll();
  }

  function ensurePoll() {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      if (!state.sessionId && state.ready) void refresh();
    }, pollMs);
  }

  async function refresh() {
    if (!backend || !state.code) return;
    const req = ++reqCounter;
    const r = await backend.client.getHousehold(state.code);
    if (r.ok) applyViewers(r.data.viewers, req);
    else await handleFailure(r);
  }

  /** Household or session or viewer vanished: say so and go back to Who's watching. Returns true when handled. */
  async function handleFailure(r: ApiResult<unknown>): Promise<boolean> {
    const gone = isGone(r);
    if (gone === 'household') {
      await replaceHousehold();
      return true;
    }
    if (gone === 'session') {
      endSession(NOTICE.sessionEnded);
      return true;
    }
    if (gone === 'viewer') {
      endSession(NOTICE.viewerGoneAny);
      await refresh();
      return true;
    }
    return false;
  }

  /** The stored household is gone (expired): start a fresh one so the TV is never stuck. */
  function replaceHousehold(): Promise<void> {
    replacing ??= (async () => {
      socket?.stop();
      socket = undefined;
      await deps.storage.remove(CODE_KEY);
      endSession();
      set({ ready: false, code: undefined, viewers: [], connected: false });
      lastApplied = reqCounter;
      await boot(NOTICE.householdGone);
    })().finally(() => {
      replacing = undefined;
    });
    return replacing;
  }

  async function boot(notice?: string): Promise<void> {
    if (booting) return;
    booting = true;
    if (bootTimer) clearTimeout(bootTimer);
    const retry = () => {
      booting = false;
      bootTimer = setTimeout(() => void boot(notice), RETRY_MS);
    };
    try {
      backend ??= await deps.backend();
    } catch {
      return retry();
    }
    let code = await deps.storage.get(CODE_KEY).catch(() => null);
    let viewers: Viewer[] = [];
    let message = notice;
    if (code) {
      const r = await backend.client.getHousehold(code);
      if (r.ok) viewers = r.data.viewers;
      else if (isGone(r) === 'household') {
        code = null;
        message = NOTICE.householdGone;
        await deps.storage.remove(CODE_KEY).catch(() => undefined);
      } else return retry();
    }
    if (!code) {
      const r = await backend.client.createHousehold();
      if (!r.ok) return retry();
      code = r.data.code;
      await deps.storage.set(CODE_KEY, code).catch(() => undefined);
    }
    // After a reload the toast comes back from server state: the last automatic promotion can still be undone (R-07).
    const promotions = viewers.filter(v => v.promotedAutomatically).map(promotionMessage).slice(-1);
    lastApplied = ++reqCounter;
    set({ ready: true, code, siteUrl: backend.siteUrl, viewers, promotions, notice: message });
    socket?.stop();
    socket = backend.openSocket(code, {
      onOpen: () => {
        void refresh();
        void flushPending();
      },
      onMessage,
      onGone: () => void replaceHousehold(),
      onState: connected => set({ connected }),
    });
    socket.start();
    ensurePoll();
    booting = false;
  }

  function onMessage(m: { type?: string; [k: string]: unknown }) {
    if (m.type === 'answer') {
      const { label, layer, question, answer } = m as Record<string, unknown>;
      if (typeof label !== 'string' || typeof question !== 'string' || typeof answer !== 'string') return;
      const item: AnswerItem = { id: ++answerId, label, layer: (typeof layer === 'string' ? layer : 'basic') as Layer, question, answer };
      set({ answers: [...state.answers, item] });
    } else if (m.type === 'viewers' && Array.isArray(m.viewers)) {
      applyViewers(m.viewers as Viewer[], ++reqCounter, Array.isArray(m.promotions) ? (m.promotions as string[]) : undefined);
    }
  }

  async function flushPending() {
    if (!state.sessionId || !pendingShown.length) return;
    const todo = pendingShown;
    pendingShown = [];
    for (const p of todo) await send(p.momentId, p.concepts);
  }

  async function send(momentId: string, concepts: Concept[]) {
    if (!backend || !state.code || !state.sessionId) return;
    const req = ++reqCounter;
    const r = await backend.client.shown(state.code, state.sessionId, { momentId, concepts, seq: ++seq });
    if (r.ok) applyViewers(r.data.viewers, req, r.data.promotions);
    else if (r.status === 0) pendingShown.push({ momentId, concepts });
    else await handleFailure(r);
  }

  return {
    getState: () => state,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    boot: () => boot(),
    refresh,
    clearNotice: () => set({ notice: undefined }),

    async startSession(names: string[]): Promise<{ ok: true } | { ok: false; message: string }> {
      if (!backend || !state.code) return { ok: false, message: 'Courtside is still connecting - try again in a moment.' };
      const r = await backend.client.createSession(state.code, names);
      if (!r.ok) {
        if (isGone(r) === 'household') {
          await replaceHousehold();
        } else if (isGone(r) === 'viewer') await refresh();
        return { ok: false, message: isGone(r) === 'viewer' ? 'Someone in that list is no longer here. Pick again.' : isGone(r) === 'household' ? NOTICE.householdGone : r.message };
      }
      seq = 0;
      lastShown = undefined;
      pendingShown = [];
      const fresh = state.viewers.map(v => r.data.viewers.find(x => x.name === v.name) ?? v);
      set({ sessionId: r.data.sessionId, present: r.data.viewers.map(v => v.name), viewers: fresh, momentId: undefined, notice: undefined });
      return { ok: true };
    },

    /** Reports the moment on screen; the server counts views once per viewer per moment per session. */
    async shown(momentId: string, concepts: Concept[]) {
      if (!state.sessionId || momentId === lastShown) return;
      if (lastShown !== undefined && state.promotions.length) set({ promotions: [] });
      lastShown = momentId;
      set({ momentId });
      await send(momentId, concepts);
    },

    async gotIt(names: string[], concepts: Concept[]) {
      if (!backend || !state.code) return;
      const promotions: string[] = [];
      for (const name of names) {
        const req = ++reqCounter;
        const r: ApiResult<ViewersReply> = await backend.client.gotIt(state.code, name, concepts);
        if (r.ok) {
          promotions.push(...r.data.promotions);
          applyViewers(r.data.viewers, req, promotions);
        } else if (await handleFailure(r)) return;
        else set({ notice: r.message });
      }
    },

    async undo(name: string) {
      if (!backend || !state.code) return;
      const req = ++reqCounter;
      const r = await backend.client.undoPromotion(state.code, name);
      if (r.ok) {
        applyViewers(r.data.viewers, req);
        set({ promotions: [] });
      } else if (!(await handleFailure(r))) set({ notice: r.message });
    },

    /** Drops the answer on screen. With an id, only if it is still the one on screen (a timer and Back may both fire). */
    dismissAnswer(id?: number) {
      const cur = state.answers[0];
      if (!cur || (id !== undefined && cur.id !== id)) return;
      set({ answers: state.answers.slice(1) });
    },

    stop() {
      socket?.stop();
      if (pollTimer) clearInterval(pollTimer);
      if (bootTimer) clearTimeout(bootTimer);
      pollTimer = bootTimer = undefined;
    },
  };
}

export type Controller = ReturnType<typeof createController>;
