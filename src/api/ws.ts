import { normaliseCode } from '../core/index.js';
import { dynamoStore, type Store } from './store.js';

export interface WsEvent {
  requestContext: { routeKey: string; connectionId: string };
  queryStringParameters?: Record<string, string | undefined> | null;
}
export interface WsResult { statusCode: number; body?: string }

export function makeWsHandler(store: Store) {
  return async (event: WsEvent): Promise<WsResult> => {
    const { routeKey, connectionId } = event.requestContext;
    if (routeKey === '$connect') {
      const code = normaliseCode(event.queryStringParameters?.code ?? '');
      if (event.queryStringParameters?.role !== 'tv' || !code) return { statusCode: 400, body: 'role=tv and code are required' };
      if (!(await store.getViewers(code))) return { statusCode: 404, body: 'Unknown code' };
      await store.addConnection(code, connectionId);
      return { statusCode: 200 };
    }
    if (routeKey === '$disconnect') {
      await store.removeConnection(connectionId);
      return { statusCode: 200 };
    }
    return { statusCode: 200, body: 'ok' }; // $default: keep-alive pings
  };
}

export const handler = (event: WsEvent) => makeWsHandler(dynamoStore())(event);
