import { randomInt, randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { Viewer } from '../core/index.js';

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const HOUSEHOLD_TTL_S = 7 * 24 * 3600;
export const CONNECTION_TTL_S = 24 * 3600;

/** What the handlers need from storage; tests pass a fake. */
export interface Store {
  createHousehold(): Promise<{ householdId: string; code: string }>;
  /** Undefined when the household does not exist. */
  getViewers(code: string): Promise<Viewer[] | undefined>;
  putViewer(code: string, v: Viewer): Promise<void>;
  addConnection(code: string, connectionId: string): Promise<void>;
  removeConnection(connectionId: string): Promise<void>;
  connections(code: string): Promise<string[]>;
  /** Counts one question in the current hour for the household and for the whole service; returns both new counts (rate limits). */
  countQuestion(code: string): Promise<{ household: number; global: number }>;
}

const now = () => Math.floor(Date.now() / 1000);
export const newCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');

export function dynamoStore(table = process.env.TABLE ?? '', doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } })): Store {
  const hh = (code: string) => `HH#${code}`;
  return {
    async createHousehold() {
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = newCode();
        const householdId = randomUUID();
        try {
          await doc.send(new PutCommand({
            TableName: table, ConditionExpression: 'attribute_not_exists(pk)',
            Item: { pk: hh(code), sk: 'META', householdId, createdAt: new Date().toISOString(), ttl: now() + HOUSEHOLD_TTL_S },
          }));
          return { householdId, code };
        } catch (err) {
          if ((err as { name?: string }).name !== 'ConditionalCheckFailedException') throw err;
        }
      }
      throw new Error('could not allocate a household code');
    },
    async getViewers(code) {
      const meta = await doc.send(new GetCommand({ TableName: table, Key: { pk: hh(code), sk: 'META' } }));
      if (!meta.Item) return undefined;
      const r = await doc.send(new QueryCommand({
        TableName: table, KeyConditionExpression: 'pk = :pk AND begins_with(sk, :p)',
        ExpressionAttributeValues: { ':pk': hh(code), ':p': 'VIEWER#' },
      }));
      return (r.Items ?? []).map(i => i.viewer as Viewer);
    },
    async putViewer(code, v) {
      await doc.send(new PutCommand({ TableName: table, Item: { pk: hh(code), sk: `VIEWER#${v.name.toLowerCase()}`, viewer: v, ttl: now() + HOUSEHOLD_TTL_S } }));
    },
    async addConnection(code, connectionId) {
      const ttl = now() + CONNECTION_TTL_S;
      await doc.send(new PutCommand({ TableName: table, Item: { pk: hh(code), sk: `CONN#${connectionId}`, connectionId, ttl } }));
      await doc.send(new PutCommand({ TableName: table, Item: { pk: `CONN#${connectionId}`, sk: 'CODE', code, ttl } }));
    },
    async removeConnection(connectionId) {
      const r = await doc.send(new GetCommand({ TableName: table, Key: { pk: `CONN#${connectionId}`, sk: 'CODE' } }));
      const code = r.Item?.code as string | undefined;
      if (code) await doc.send(new DeleteCommand({ TableName: table, Key: { pk: hh(code), sk: `CONN#${connectionId}` } }));
      await doc.send(new DeleteCommand({ TableName: table, Key: { pk: `CONN#${connectionId}`, sk: 'CODE' } }));
    },
    async connections(code) {
      const r = await doc.send(new QueryCommand({
        TableName: table, KeyConditionExpression: 'pk = :pk AND begins_with(sk, :p)',
        ExpressionAttributeValues: { ':pk': hh(code), ':p': 'CONN#' },
      }));
      return (r.Items ?? []).map(i => i.connectionId as string);
    },
    async countQuestion(code) {
      const hour = Math.floor(now() / 3600);
      const bump = async (pk: string, sk: string) => {
        const r = await doc.send(new UpdateCommand({
          TableName: table, Key: { pk, sk },
          UpdateExpression: 'ADD #n :one SET #ttl = :ttl', ExpressionAttributeNames: { '#n': 'n', '#ttl': 'ttl' },
          ExpressionAttributeValues: { ':one': 1, ':ttl': (hour + 2) * 3600 }, ReturnValues: 'UPDATED_NEW',
        }));
        return Number(r.Attributes?.n ?? 1);
      };
      const stamp = new Date(hour * 3600 * 1000).toISOString().slice(0, 13); // yyyy-mm-ddThh
      const [household, global] = await Promise.all([bump(hh(code), `RATE#${hour}`), bump(`GLOBAL#${stamp}`, 'COUNT')]);
      return { household, global };
    },
  };
}
