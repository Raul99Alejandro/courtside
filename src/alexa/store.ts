import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { HOUSEHOLD_TTL_S, dynamoStore, type Store } from '../api/store.js';

/** What the Alexa endpoint needs: the household storage plus the two links (Alexa account -> household, voice -> viewer). */
export interface AlexaStore extends Store {
  /** Remembers which household an Alexa account (userId) speaks for. */
  linkHousehold(userId: string, code: string): Promise<void>;
  linkedHousehold(userId: string): Promise<string | undefined>;
  /** Remembers which viewer of a household a recognised voice (personId) is. */
  linkVoice(code: string, personId: string, viewerName: string): Promise<void>;
  voiceViewer(code: string, personId: string): Promise<string | undefined>;
  /** Failed link attempts by this Alexa account in the last hour. */
  linkFailures(userId: string): Promise<number>;
  addLinkFailure(userId: string): Promise<number>;
}

const now = () => Math.floor(Date.now() / 1000);
export const LINK_FAILURE_WINDOW_S = 3600;

export function dynamoAlexaStore(table = process.env.TABLE ?? '', doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } })): AlexaStore {
  return {
    ...dynamoStore(table, doc),
    async linkHousehold(userId, code) {
      await doc.send(new PutCommand({ TableName: table, Item: { pk: `ALEXA#${userId}`, sk: 'LINK', code, ttl: now() + HOUSEHOLD_TTL_S } }));
    },
    async linkedHousehold(userId) {
      const r = await doc.send(new GetCommand({ TableName: table, Key: { pk: `ALEXA#${userId}`, sk: 'LINK' } }));
      return r.Item?.code as string | undefined;
    },
    async linkVoice(code, personId, viewerName) {
      await doc.send(new PutCommand({ TableName: table, Item: { pk: `HH#${code}`, sk: `VOICE#${personId}`, viewerName, ttl: now() + HOUSEHOLD_TTL_S } }));
    },
    async linkFailures(userId) {
      const r = await doc.send(new GetCommand({ TableName: table, Key: { pk: `ALEXA#${userId}`, sk: 'FAIL' } }));
      return r.Item && Number(r.Item.start) > now() - LINK_FAILURE_WINDOW_S ? Number(r.Item.n) : 0;
    },
    async addLinkFailure(userId) {
      const key = { pk: `ALEXA#${userId}`, sk: 'FAIL' };
      const cur = (await doc.send(new GetCommand({ TableName: table, Key: key }))).Item;
      const fresh = !cur || Number(cur.start) <= now() - LINK_FAILURE_WINDOW_S;
      const start = fresh ? now() : Number(cur!.start);
      const n = (fresh ? 0 : Number(cur!.n)) + 1;
      await doc.send(new PutCommand({ TableName: table, Item: { ...key, n, start, ttl: start + LINK_FAILURE_WINDOW_S } }));
      return n;
    },
    async voiceViewer(code, personId) {
      const r = await doc.send(new GetCommand({ TableName: table, Key: { pk: `HH#${code}`, sk: `VOICE#${personId}` } }));
      return r.Item?.viewerName as string | undefined;
    },
  };
}
