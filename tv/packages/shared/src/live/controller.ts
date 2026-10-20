import { byCreation, promotionMessage, type Concept, type Layer, type Viewer } from '@courtside/core';
import { isGone, type ApiResult, type Client, type Promotion, type RecentAnswer } from '../api/client';

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
  /** The server's id for the answer, so one that came by push and again from the catch-up list shows once. */
  key?: string;
  label: string;
  layer: Layer;
  question: string;
  answer: string;
  /** 'alexa' when asked through the Alexa skill; otherwise it came from a phone. */
  via?: 'alexa';
}

/** Only the one known source is kept, so an unexpected value is treated as the phone. */
const viaOf = (v: unknown): 'alexa' | undefined => (v === 'alexa' ? 'alexa' : undefined);

export type { Promotion };

export interface LiveState {
  /** A household exists and its viewers are loaded. */
  ready: boolean;
  code?: string;
  siteUrl?: string;
  /** In creation order (scarf colours follow it). */
  viewers: Viewer[];
  sessionId?: string;
  present: string[];
  /** "Leo moved up to Fan" notices the toast is showing: who, and the server's message. */
  promotions: Promotion[];
  /** Answers pushed from phones; the first is on screen, the rest wait their turn. */
  answers: AnswerItem[];
  /** The moment the TV shows now (the pitch behind an answer). */
  momentId?: string;
  /** A message for Who's watching (household replaced, session ended, ...). */
  notice?: string;
  /** Set while a Got it or Undo could not be saved and is being retried; Replay shows it as a toast. */
  problem?: string;
  connected: boolean;
}

export const CODE_KEY = 'courtside.code';
export const PROBLEM = 'Could not save that - trying again';
const RETRY_MS = 5000;
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 30_000;
const SEEN_KEYS = 50;
export const MAX_PENDING = 20;
const PROBLEM_FLASH_MS = 5000;
/** A moved-up toast is only worth showing again for this long after the promotion (R-07). */
export const PROMOTION_FRESH_MS = 30 * 60 * 1000;

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
  /** Epoch ms; tests pass a fixed clock. */
  now?: () => number;
}

/** Something to tell the server that could not get through yet; kept, in order, until it does. */
type Pending =
  | { kind: 'shown'; momentId: string; concepts: Concept[]; seq: number }
  | { kind: 'gotIt'; name: string; concepts: Concept[] }
  | { kind: 'undo'; name: string };

/** Offline, a timeout, a busy server: worth another try. Anything else is the server's answer. */
const retryable = (r: { status: number }) => r.status === 0 || r.status === 409 || r.status === 429 || r.status >= 500;

/** The toast to bring back: the most recent automatic promotion (by promotedAt) that is under 30 minutes old, of a viewer in the session. */
export function restorablePromotion(viewers: Viewer[], present: string[], nowMs: number): Promotion | undefined {
  const fresh = viewers
    .filter(v => v.promotedAutomatically && present.includes(v.name) && v.promotedAt && nowMs - Date.parse(v.promotedAt) < PROMOTION_FRESH_MS && Date.parse(v.promotedAt) <= nowMs + 60_000)
    .sort((a, b) => Date.parse(a.promotedAt!) - Date.parse(b.promotedAt!));
  const v = fresh[fresh.length - 1];
  return v ? { name: v.name, message: promotionMessage(v) } : undefined;
}

const validPromotions = (v: unknown): Promotion[] | undefined =>
  Array.isArray(v) ? v.filter((p): p is Promotion => !!p && typeof p.name === 'string' && typeof p.message === 'string') : undefined;

/**
 * The live session: one household, who is watching, what was shown, answers waiting for the screen.
 * All viewer learning state comes from the backend; the TV only reports what it showed.
 */
export function createController(deps: ControllerDeps) {
  const pollMs = deps.pollMs ?? RETRY_MS;
  const now = deps.now ?? (() => Date.now());
  let state: LiveState = { ready: false, viewers: [], present: [], promotions: [], answers: [], connected: false };
  const listeners = new Set<() => void>();
  let backend: Backend | undefined;
  let socket: { start: () => void; stop: () => void } | undefined;
  let bootTimer: ReturnType<typeof setTimeout> | undefined;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let bootRun: Promise<void> | undefined;
  let seq = 0;
  let answerId = 0;
  let lastShown: string | undefined;
  let pending: Pending[] = [];
  let flushing: Promise<void> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retryDelay = RETRY_BASE_MS;
  let inFlight: Pending | undefined;
  let flashTimer: ReturnType<typeof setTimeout> | undefined;
  let reqCounter = 0;
  let lastApplied = 0;
  let replacing: Promise<void> | undefined;
  const seenKeys: string[] = [];

  const set = (patch: Partial<LiveState>) => {
    state = { ...state, ...patch };
    listeners.forEach(l => l());
  };

  const markSeen = (key: string) => {
    if (seenKeys.includes(key)) return false;
    seenKeys.push(key);
    if (seenKeys.length > SEEN_KEYS) seenKeys.shift();
    return true;
  };

  /** Applies a viewers snapshot unless a newer one already landed; ends the session if someone in it is gone. */
  function applyViewers(viewers: Viewer[], req: number, promotions?: Promotion[]) {
    if (req < lastApplied) return;
    lastApplied = req;
    const sorted = byCreation(viewers);
    const patch: Partial<LiveState> = { viewers: sorted };
    if (promotions?.length) patch.promotions = promotions;
    set(patch);
    if (state.sessionId) {
      const missing = state.present.find(n => !sorted.some(v => v.name === n));
      if (missing) endSession(NOTICE.viewerGone(missing));
    }
  }

  function endSession(notice?: string) {
    seq = 0;
    lastShown = undefined;
    pending = pending.filter(p => p.kind !== 'shown'); // what a finished session was shown no longer matters
    set({ sessionId: undefined, present: [], promotions: [], momentId: undefined, notice });
    ensurePoll();
  }

  function ensurePoll() {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      if (!state.sessionId && state.ready) void refresh();
    }, pollMs);
  }

  /** Answers the server kept that this TV never saw (its socket was down): they join the queue, oldest first. */
  function catchUp(recent: RecentAnswer[] | undefined) {
    const fresh = (recent ?? []).filter(a => typeof a.id === 'string' && markSeen(a.id));
    if (!fresh.length) return;
    const items = fresh.map<AnswerItem>(a => ({ id: ++answerId, key: a.id, label: a.label, layer: a.layer ?? 'basic', question: a.question, answer: a.answer, via: viaOf(a.via) }));
    set({ answers: [...state.answers, ...items] });
  }

  async function refresh() {
    if (!backend || !state.code) return;
    const req = ++reqCounter;
    const r = await backend.client.getHousehold(state.code);
    if (r.ok) {
      applyViewers(r.data.viewers, req);
      catchUp(r.data.recentAnswers);
    } else await handleFailure(r);
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
      // A boot that is still running may be using the old code: let it finish, then replace what it made.
      await bootRun?.catch(() => undefined);
      socket?.stop();
      socket = undefined;
      await deps.storage.remove(CODE_KEY);
      pending = [];
      clearRetry();
      endSession();
      set({ ready: false, code: undefined, viewers: [], connected: false, problem: undefined });
      lastApplied = reqCounter;
      await boot(NOTICE.householdGone);
    })().finally(() => {
      replacing = undefined;
    });
    return replacing;
  }

  /** One boot at a time; a second call (or a replace) waits for the one in flight instead of being dropped. */
  function boot(notice?: string): Promise<void> {
    bootRun ??= doBoot(notice).finally(() => {
      bootRun = undefined;
    });
    return bootRun;
  }

  async function doBoot(notice?: string): Promise<void> {
    if (bootTimer) clearTimeout(bootTimer);
    bootTimer = undefined;
    const retry = () => {
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
      if (r.ok) {
        viewers = r.data.viewers;
        (r.data.recentAnswers ?? []).forEach(a => markSeen(a.id)); // old answers are not replayed at start
      } else if (isGone(r) === 'household') {
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
    viewers = byCreation(viewers);
    // After a reload the toast comes back from server state, but only a recent promotion of someone in the session (R-07).
    const restored = restorablePromotion(viewers, state.present, now());
    const promotions = restored ? [restored] : [];
    lastApplied = ++reqCounter;
    set({ ready: true, code, siteUrl: backend.siteUrl, viewers, promotions, notice: message });
    socket?.stop();
    socket = backend.openSocket(code, {
      onOpen: () => {
        void refresh(); // viewers and answers that arrived while the socket was down
        retryDelay = RETRY_BASE_MS;
        void flush();
      },
      onMessage,
      onGone: () => void replaceHousehold(),
      onState: connected => set({ connected }),
    });
    socket.start();
    ensurePoll();
  }

  function onMessage(m: { type?: string; [k: string]: unknown }) {
    if (m.type === 'answer') {
      const { label, layer, question, answer, id, via } = m as Record<string, unknown>;
      if (typeof label !== 'string' || typeof question !== 'string' || typeof answer !== 'string') return;
      const key = typeof id === 'string' ? id : undefined;
      if (key && !markSeen(key)) return; // already shown (it came with a catch-up)
      const item: AnswerItem = { id: ++answerId, key, label, layer: (typeof layer === 'string' ? layer : 'basic') as Layer, question, answer, via: viaOf(via) };
      set({ answers: [...state.answers, item] });
    } else if (m.type === 'viewers' && Array.isArray(m.viewers)) {
      applyViewers(m.viewers as Viewer[], ++reqCounter, validPromotions(m.promotions));
    }
  }

  function clearRetry() {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = undefined;
    retryDelay = RETRY_BASE_MS;
  }

  function scheduleRetry() {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void flush();
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
  }

  /** Sends what is waiting, oldest first; stops at the first failure that is worth retrying and tries again later. */
  function flush(): Promise<void> {
    flushing ??= run().finally(() => {
      flushing = undefined;
      inFlight = undefined;
      // Something was queued as the run ended and no retry is waiting for it: send it now.
      if (pending.length && !retryTimer && backend && state.code) void flush();
    });
    return flushing;
  }

  function flashProblem(message: string) {
    if (flashTimer) clearTimeout(flashTimer);
    set({ problem: message });
    flashTimer = setTimeout(() => {
      flashTimer = undefined;
      if (state.problem === message) set({ problem: undefined });
    }, PROBLEM_FLASH_MS);
  }

  /** A newer `shown` replaces one that has not gone out yet; the queue never holds more than MAX_PENDING (oldest `shown` goes first). */
  function enqueue(p: Pending) {
    if (p.kind === 'shown') pending = pending.filter(x => x.kind !== 'shown' || x === inFlight);
    pending.push(p);
    while (pending.length > MAX_PENDING) {
      const i = pending.findIndex(x => x !== inFlight && x.kind === 'shown');
      pending.splice(i >= 0 ? i : pending.findIndex(x => x !== inFlight), 1);
    }
  }

  async function run() {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = undefined;
    const promotions: Promotion[] = [];
    while (pending.length) {
      const p = pending[0]!;
      const code = state.code;
      if (!backend || !code) return;
      if (p.kind === 'shown' && !state.sessionId) {
        pending = pending.filter(x => x !== p);
        continue;
      }
      const req = ++reqCounter;
      inFlight = p;
      let r: ApiResult<{ viewers: Viewer[]; promotions?: Promotion[] }>;
      if (p.kind === 'shown') r = await backend.client.shown(code, state.sessionId!, { momentId: p.momentId, concepts: p.concepts, seq: p.seq });
      else if (p.kind === 'gotIt') r = await backend.client.gotIt(code, p.name, p.concepts);
      else r = await backend.client.undoPromotion(code, p.name);
      if (!pending.includes(p)) continue; // the household was replaced while this was in the air
      if (r.ok) {
        pending = pending.filter(x => x !== p);
        if (p.kind === 'undo') {
          applyViewers(r.data.viewers, req);
          set({ promotions: [] });
        } else {
          if (p.kind === 'gotIt') promotions.push(...(r.data.promotions ?? []));
          applyViewers(r.data.viewers, req, p.kind === 'gotIt' ? promotions : r.data.promotions);
        }
        continue;
      }
      if (retryable(r)) {
        set({ problem: pending.some(x => x.kind !== 'shown') ? PROBLEM : undefined });
        scheduleRetry();
        return;
      }
      pending = pending.filter(x => x !== p);
      if (!(await handleFailure(r)) && p.kind !== 'shown') {
        set({ notice: r.message });
        flashProblem(r.message); // Replay is on screen: show it there too, for a few seconds
      }
    }
    retryDelay = RETRY_BASE_MS;
    if (state.problem && !flashTimer) set({ problem: undefined });
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
      pending = pending.filter(p => p.kind !== 'shown');
      const fresh = state.viewers.map(v => r.data.viewers.find(x => x.name === v.name) ?? v);
      const present = r.data.viewers.map(v => v.name);
      const restored = restorablePromotion(fresh, present, now()); // a promotion from minutes ago can still be undone; an old one stays quiet
      set({ sessionId: r.data.sessionId, present, viewers: fresh, promotions: restored ? [restored] : [], momentId: undefined, notice: undefined });
      return { ok: true };
    },

    /** Reports the moment on screen; the server counts views once per viewer per moment per session. A failed send is retried. */
    async shown(momentId: string, concepts: Concept[]) {
      if (!state.sessionId || momentId === lastShown) return;
      if (lastShown !== undefined && state.promotions.length) set({ promotions: [] });
      lastShown = momentId;
      set({ momentId });
      enqueue({ kind: 'shown', momentId, concepts, seq: ++seq });
      await flush();
    },

    /** "Got it" for each viewer on the basic row. Offline or a server error: kept and retried, with a toast on Replay. */
    async gotIt(names: string[], concepts: Concept[]) {
      if (!backend || !state.code) return;
      for (const name of names) enqueue({ kind: 'gotIt', name, concepts });
      await flush();
    },

    async undo(name: string) {
      if (!backend || !state.code) return;
      enqueue({ kind: 'undo', name });
      await flush();
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
      if (retryTimer) clearTimeout(retryTimer);
      if (flashTimer) clearTimeout(flashTimer);
      pollTimer = bootTimer = retryTimer = flashTimer = undefined;
    },
  };
}

export type Controller = ReturnType<typeof createController>;
