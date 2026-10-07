import { randomInt, randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { Viewer } from '../core/index.js';

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const HOUSEHOLD_TTL_S = 30 * 24 * 3600;
/** A household's TTL is pushed out on use, but never more often than this. */
export const TOUCH_EVERY_S = 3600;
export const CONNECTION_TTL_S = 24 * 3600;
export const SESSION_TTL_S = 24 * 3600;

/** A viewing session: who is in the room and the moment the TV shows now (so a question can reset that concept's view count, R-04-c). */
export interface Session { present: string[]; momentId?: string; concepts?: string[]; /** Highest moment sequence number the TV has sent; an older one never replaces the current moment. */ seq?: number }

/** An answer pushed to the TV, kept for an hour so a TV whose socket dropped can catch up. */
export interface RecentAnswer { id: string; label: string; layer: string; question: string; answer: string; /** epoch ms */ at: number }
export const RECENT_ANSWERS = 5;
export const ANSWER_TTL_S = 3600;

/** The newest session of a household and the moment it shows now (phones send the id with their questions, R-04-c). */
export interface LatestSession { sessionId: string; momentId?: string }

/** What the handlers need from storage; tests pass a fake. */
export interface Store {
  createHousehold(): Promise<{ householdId: string; code: string }>;
  /** Undefined when the household does not exist. */
  getViewers(code: string): Promise<Viewer[] | undefined>;
  putViewer(code: string, v: Viewer): Promise<void>;
  /** One viewer with the version of its stored item (undefined for items written before versioning). */
  getViewer(code: string, name: string): Promise<{ viewer: Viewer; version?: number } | undefined>;
  /** Writes only if the item still has the version that was read; false on a conflicting write. */
  putViewerIf(code: string, v: Viewer, version: number | undefined): Promise<boolean>;
  getSession(code: string, sessionId: string): Promise<Session | undefined>;
  putSession(code: string, sessionId: string, s: Session): Promise<void>;
  /** True the first time (session, moment, viewer) is claimed, false on every repeat: the idempotency key for "shown". */
  claimShown(code: string, sessionId: string, momentId: string, viewer: string): Promise<boolean>;
  /** Gives a claim back when the write it guarded failed, so a retry counts the view. */
  releaseShown(code: string, sessionId: string, momentId: string, viewer: string): Promise<void>;
  latestSession(code: string): Promise<LatestSession | undefined>;
  setLatestSession(code: string, latest: LatestSession): Promise<void>;
  /** Remembers an answer (the last RECENT_ANSWERS, for an hour). */
  addAnswer(code: string, a: RecentAnswer): Promise<void>;
  /** The kept answers, oldest first. */
  recentAnswers(code: string): Promise<RecentAnswer[]>;
  /** Sliding TTL: pushes the household and all its viewers 30 days out; does nothing if that happened in the last hour. Best effort. */
  touchHousehold(code: string): Promise<void>;
  addConnection(code: string, connectionId: string): Promise<void>;
  removeConnection(connectionId: string): Promise<void>;
  connections(code: string): Promise<string[]>;
  /** Counts one question in the current hour for the household; returns the new count. */
  countHousehold(code: string): Promise<number>;
  /** Counts one question for the whole service (this hour and today, UTC); call only after the household passed its cap. */
  countGlobal(): Promise<{ hour: number; day: number }>;
  /** Wrong household codes this hour: from one source (an opaque hash of its IP) and from everyone. */
  failedJoins(source: string): Promise<{ source: number; global: number }>;
  addFailedJoin(source: string): Promise<void>;
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
            Item: { pk: hh(code), sk: 'META', householdId, createdAt: new Date().toISOString(), lastTouched: now(), ttl: now() + HOUSEHOLD_TTL_S },
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
    async getViewer(code, name) {
      const r = await doc.send(new GetCommand({ TableName: table, Key: { pk: hh(code), sk: `VIEWER#${name.toLowerCase()}` } }));
      return r.Item ? { viewer: r.Item.viewer as Viewer, version: r.Item.version as number | undefined } : undefined;
    },
    async putViewerIf(code, v, version) {
      try {
        await doc.send(new PutCommand({
          TableName: table,
          ConditionExpression: version === undefined ? 'attribute_exists(pk) AND attribute_not_exists(#v)' : '#v = :v',
          ExpressionAttributeNames: { '#v': 'version' },
          ...(version === undefined ? {} : { ExpressionAttributeValues: { ':v': version } }),
          Item: { pk: hh(code), sk: `VIEWER#${v.name.toLowerCase()}`, viewer: v, version: (version ?? 0) + 1, ttl: now() + HOUSEHOLD_TTL_S },
        }));
        return true;
      } catch (err) {
        if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return false;
        throw err;
      }
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
    async releaseShown(code, sessionId, momentId, viewer) {
      await doc.send(new DeleteCommand({ TableName: table, Key: { pk: hh(code), sk: `SHOWN#${sessionId}#${momentId}#${viewer.toLowerCase()}` } }));
    },
    async latestSession(code) {
      const r = await doc.send(new GetCommand({ TableName: table, Key: { pk: hh(code), sk: 'META' } }));
      return r.Item?.latest as LatestSession | undefined;
    },
    async setLatestSession(code, latest) {
      try {
        await doc.send(new UpdateCommand({
          TableName: table, Key: { pk: hh(code), sk: 'META' }, ConditionExpression: 'attribute_exists(pk)',
          UpdateExpression: 'SET #l = :l', ExpressionAttributeNames: { '#l': 'latest' }, ExpressionAttributeValues: { ':l': latest },
        }));
      } catch (err) {
        if ((err as { name?: string }).name !== 'ConditionalCheckFailedException') throw err;
      }
    },
    async addAnswer(code, a) {
      await doc.send(new PutCommand({ TableName: table, Item: { pk: hh(code), sk: `ANS#${String(a.at).padStart(15, '0')}#${a.id}`, answer: a, ttl: now() + ANSWER_TTL_S } }));
    },
    async recentAnswers(code) {
      const r = await doc.send(new QueryCommand({
        TableName: table, KeyConditionExpression: 'pk = :pk AND begins_with(sk, :p)',
        ExpressionAttributeValues: { ':pk': hh(code), ':p': 'ANS#' }, ScanIndexForward: false, Limit: RECENT_ANSWERS,
      }));
      const cutoff = Date.now() - ANSWER_TTL_S * 1000; // DynamoDB deletes expired items late
      return (r.Items ?? []).map(i => i.answer as RecentAnswer).filter(a => a.at > cutoff).reverse();
    },
    async touchHousehold(code) {
      const t = now();
      const ttl = t + HOUSEHOLD_TTL_S;
      try {
        await doc.send(new UpdateCommand({
          TableName: table, Key: { pk: hh(code), sk: 'META' },
          ConditionExpression: 'attribute_exists(pk) AND (attribute_not_exists(#lt) OR #lt < :cut)',
          UpdateExpression: 'SET #ttl = :ttl, #lt = :t', ExpressionAttributeNames: { '#ttl': 'ttl', '#lt': 'lastTouched' },
          ExpressionAttributeValues: { ':ttl': ttl, ':t': t, ':cut': t - TOUCH_EVERY_S },
        }));
      } catch (err) {
        if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return; // touched within the hour, or gone
        throw err;
      }
      const r = await doc.send(new QueryCommand({
        TableName: table, KeyConditionExpression: 'pk = :pk AND begins_with(sk, :p)', ProjectionExpression: 'sk',
        ExpressionAttributeValues: { ':pk': hh(code), ':p': 'VIEWER#' },
      }));
      await Promise.allSettled((r.Items ?? []).map(i => doc.send(new UpdateCommand({
        TableName: table, Key: { pk: hh(code), sk: i.sk as string }, ConditionExpression: 'attribute_exists(pk)', // never bring back a deleted viewer
        UpdateExpression: 'SET #ttl = :ttl', ExpressionAttributeNames: { '#ttl': 'ttl' }, ExpressionAttributeValues: { ':ttl': ttl },
      }))));
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
    async failedJoins(source) {
      const hour = Math.floor(now() / 3600);
      const get = (pk: string) => doc.send(new GetCommand({ TableName: table, Key: { pk, sk: 'COUNT' } }));
      const [s, g] = await Promise.all([get(`JOINFAIL#${source}#${hour}`), get(`GLOBAL_JOIN#${hour}`)]);
      return { source: Number(s.Item?.n ?? 0), global: Number(g.Item?.n ?? 0) };
    },
    async addFailedJoin(source) {
      const hour = Math.floor(now() / 3600);
      await Promise.all([bump(`JOINFAIL#${source}#${hour}`, 'COUNT', (hour + 2) * 3600), bump(`GLOBAL_JOIN#${hour}`, 'COUNT', (hour + 2) * 3600)]);
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
