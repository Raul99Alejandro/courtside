import { randomInt, randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { Viewer } from '../core/index.js';

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const HOUSEHOLD_TTL_S = 7 * 24 * 3600;
export const CONNECTION_TTL_S = 24 * 3600;
export const SESSION_TTL_S = 24 * 3600;

/** A viewing session: who is in the room and the moment the TV shows now (so a question can reset that concept's view count, R-04-c). */
export interface Session { present: string[]; momentId?: string; concepts?: string[] }

/** What the handlers need from storage; tests pass a fake. */
export interface Store {
  createHousehold(): Promise<{ householdId: string; code: string }>;
  /** Undefined when the household does not exist. */
  getViewers(code: string): Promise<Viewer[] | undefined>;
  putViewer(code: string, v: Viewer): Promise<void>;
  getSession(code: string, sessionId: string): Promise<Session | undefined>;
  putSession(code: string, sessionId: string, s: Session): Promise<void>;
  /** True the first time (session, moment, viewer) is claimed, false on every repeat: the idempotency key for "shown". */
  claimShown(code: string, sessionId: string, momentId: string, viewer: string): Promise<boolean>;
  addConnection(code: string, connectionId: string): Promise<void>;
  removeConnection(connectionId: string): Promise<void>;
  connections(code: string): Promise<string[]>;
  /** Counts one question in the current hour for the household; returns the new count. */
  countHousehold(code: string): Promise<number>;
  /** Counts one question for the whole service (this hour and today, UTC); call only after the household passed its cap. */
  countGlobal(): Promise<{ hour: number; day: number }>;
}

const now = () => Math.floor(Date.now() / 1000);
export const newCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');

export function dynamoStore(table = process.env.TABLE ?? '', doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } })): Store {
  const hh = (code: string) => `HH#${code}`;
  const bump = async (pk: string, sk: string, ttl: number) => {
    const r = await doc.send(new UpdateCommand({
      TableName: table, Key: { pk, sk },
      UpdateExpression: 'ADD #n :one SET #ttl = :ttl', ExpressionAttributeNames: { '#n': 'n', '#ttl': 'ttl' },
      ExpressionAttributeValues: { ':one': 1, ':ttl': ttl }, ReturnValues: 'UPDATED_NEW',
    }));
    return Number(r.Attributes?.n ?? 1);
  };
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
    async getSession(code, sessionId) {
      const r = await doc.send(new GetCommand({ TableName: table, Key: { pk: hh(code), sk: `SESSION#${sessionId}` } }));
      return r.Item?.session as Session | undefined;
    },
    async putSession(code, sessionId, session) {
      await doc.send(new PutCommand({ TableName: table, Item: { pk: hh(code), sk: `SESSION#${sessionId}`, session, ttl: now() + SESSION_TTL_S } }));
    },
    async claimShown(code, sessionId, momentId, viewer) {
      try {
        await doc.send(new PutCommand({
          TableName: table, ConditionExpression: 'attribute_not_exists(pk)',
          Item: { pk: hh(code), sk: `SHOWN#${sessionId}#${momentId}#${viewer.toLowerCase()}`, ttl: now() + SESSION_TTL_S },
        }));
        return true;
      } catch (err) {
        if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return false;
        throw err;
      }
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
    async countHousehold(code) {
      return bump(hh(code), `RATE#${Math.floor(now() / 3600)}`, (Math.floor(now() / 3600) + 2) * 3600);
    },
    async countGlobal() {
      const hour = Math.floor(now() / 3600);
      const stamp = new Date(hour * 3600 * 1000).toISOString();
      const [h, day] = await Promise.all([
        bump(`GLOBAL#${stamp.slice(0, 13)}`, 'COUNT', (hour + 2) * 3600),
        bump(`GLOBAL_DAY#${stamp.slice(0, 10)}`, 'COUNT', now() + 2 * 24 * 3600),
      ]);
      return { hour: h, day };
    },
  };
}
