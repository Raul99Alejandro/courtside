export interface SocketOptions {
  url: string;
  WebSocketImpl?: typeof WebSocket;
  /** Called on every successful (re)connect: the TV refreshes viewers here. */
  onOpen: () => void;
  onMessage: (m: { type?: string; [k: string]: unknown }) => void;
  /** The household no longer exists: reconnecting is pointless. */
  onGone: () => void;
  /** true while connected, false while not. */
  onState?: (connected: boolean) => void;
  /** Asked after every drop; a rejection (offline) means "keep trying". */
  isGone: () => Promise<boolean>;
}

/** 1 s, 2 s, 4 s ... capped at 30 s. */
export const backoffDelay = (attempt: number) => Math.min(1000 * 2 ** attempt, 30_000);
const PING_MS = 5 * 60 * 1000; // API Gateway closes idle sockets after 10 minutes

/** A WebSocket that reconnects with backoff, pings to stay alive, and stops when the household is gone. */
export function createSocket(opts: SocketOptions) {
  const WS = opts.WebSocketImpl ?? WebSocket;
  let ws: WebSocket | undefined;
  let attempt = 0;
  let stopped = true;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let ping: ReturnType<typeof setInterval> | undefined;

  function connect() {
    if (stopped) return;
    const mine = new WS(opts.url);
    ws = mine;
    mine.onopen = () => {
      if (stopped || ws !== mine) return;
      attempt = 0;
      ping = setInterval(() => {
        if (mine.readyState === 1) mine.send('ping');
      }, PING_MS);
      opts.onState?.(true);
      opts.onOpen();
    };
    mine.onmessage = e => {
      if (ws !== mine) return; // a socket that was replaced or stopped says nothing more
      try {
        const m = JSON.parse(String(e.data));
        if (m && typeof m === 'object') opts.onMessage(m);
      } catch {
        /* not ours */
      }
    };
    mine.onerror = () => undefined; // onclose follows
    mine.onclose = () => {
      if (ws !== mine) return;
      ws = undefined;
      if (ping) clearInterval(ping);
      ping = undefined;
      if (stopped) return;
      opts.onState?.(false);
      void opts.isGone().then(
        gone => {
          if (stopped) return;
          if (gone) {
            stopped = true;
            opts.onGone();
          } else schedule();
        },
        () => schedule(),
      );
    };
  }

  function schedule() {
    if (stopped) return;
    retry = setTimeout(connect, backoffDelay(attempt++));
  }

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      attempt = 0;
      connect();
    },
    stop() {
      stopped = true;
      if (retry) clearTimeout(retry);
      if (ping) clearInterval(ping);
      const w = ws;
      ws = undefined;
      try {
        w?.close();
      } catch {
        /* already closed */
      }
    },
  };
}

export type Socket = ReturnType<typeof createSocket>;
