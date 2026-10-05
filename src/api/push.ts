import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

export type Push = (connectionIds: string[], payload: unknown) => Promise<string[]>;

/** Posts the payload to each connection; returns the ids that are gone (so the caller can forget them). */
export function postToConnections(endpoint = process.env.WS_ENDPOINT ?? ''): Push {
  const client = new ApiGatewayManagementApiClient({ endpoint });
  return async (ids, payload) => {
    const data = new TextEncoder().encode(JSON.stringify(payload));
    const gone: string[] = [];
    await Promise.all(ids.map(async id => {
      try { await client.send(new PostToConnectionCommand({ ConnectionId: id, Data: data })); }
      catch (err) { if ((err as { name?: string }).name === 'GoneException') gone.push(id); }
    }));
    return gone;
  };
}
