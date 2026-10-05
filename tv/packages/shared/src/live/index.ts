import { useSyncExternalStore } from 'react';
import { createClient } from '../api/client';
import { loadConfig } from '../api/config';
import { createSocket } from '../api/socket';
import { createController, type Backend, type Controller, type LiveState } from './controller';
import { storage } from './storage';

async function backend(): Promise<Backend> {
  const cfg = await loadConfig();
  const client = createClient(cfg.httpApiUrl);
  return {
    client,
    siteUrl: cfg.siteUrl,
    openSocket: (code, h) =>
      createSocket({
        url: `${cfg.wsUrl}?code=${encodeURIComponent(code)}&role=tv`,
        onOpen: h.onOpen,
        onMessage: h.onMessage,
        onGone: h.onGone,
        onState: h.onState,
        isGone: async () => {
          const r = await client.getHousehold(code);
          return !r.ok && r.status === 404 && r.message === 'Unknown code';
        },
      }),
  };
}

let controller: Controller | undefined;

/** The one live session for this app; created on first use. */
export function liveController(): Controller {
  if (!controller) {
    controller = createController({ backend, storage });
    void controller.boot();
  }
  return controller;
}

export function useLive(): { state: LiveState; live: Controller } {
  const live = liveController();
  const state = useSyncExternalStore(live.subscribe, live.getState, live.getState);
  return { state, live };
}

export type { LiveState } from './controller';
export { phoneUrl } from './phoneUrl';
