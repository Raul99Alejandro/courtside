import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { App, Aspects } from 'aws-cdk-lib';
import { Annotations, Match, Template } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks } from 'cdk-nag';
import { CourtsideStack } from '../infra/lib/stack.js';

const webDir = mkdtempSync(join(tmpdir(), 'courtside-web-'));
writeFileSync(join(webDir, 'index.html'), '<!doctype html><title>Courtside</title>');

const app = new App({ context: { ownerEmail: 'owner@example.com' } });
const stack = new CourtsideStack(app, 'Courtside', { env: { account: '111111111111', region: 'us-east-1' }, webDir });
Aspects.of(stack).add(new AwsSolutionsChecks({ verbose: true }));
const t = Template.fromStack(stack);

type Statement = { Effect: string; Action: string | string[]; Resource: unknown };
const statements = (): Statement[] =>
  Object.values(t.findResources('AWS::IAM::Policy')).flatMap(p => p.Properties.PolicyDocument.Statement as Statement[]);

describe('Courtside stack', () => {
  it('synthesizes without cdk-nag errors', () => {
    const errors = Annotations.fromStack(stack).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    expect(errors.map(e => `${e.id}: ${JSON.stringify(e.entry.data)}`)).toEqual([]);
  });

  it('never routes OPTIONS to the Lambda, so API Gateway answers the CORS preflight', () => {
    const keys = Object.values(t.findResources('AWS::ApiGatewayV2::Route'))
      .map(r => String(r.Properties.RouteKey)).filter(k => k.includes('/'));
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) expect(k, k).toMatch(/^(GET|POST) /);
  });

  it('has exactly one table, on demand, with a ttl attribute and no PITR', () => {
    t.resourceCountIs('AWS::DynamoDB::Table', 1);
    t.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST',
      TimeToLiveSpecification: { AttributeName: 'ttl', Enabled: true },
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: false },
    });
  });

  it('lets the http Lambda invoke Bedrock models and nothing with * on Bedrock', () => {
    const bedrock = statements().filter(s => [s.Action].flat().some(a => a.startsWith('bedrock:')));
    expect(bedrock.length).toBeGreaterThan(0);
    for (const s of bedrock) {
      expect([s.Action].flat()).toEqual(['bedrock:InvokeModel']);
      expect([s.Resource].flat()).not.toContain('*');
    }
    const json = JSON.stringify(bedrock);
    expect(json).toContain('inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0');
    expect(json).toContain('inference-profile/us.amazon.nova-2-lite-v1:0');
  });

  it('lets only the http and Alexa Lambdas post to WebSocket connections, on one stage', () => {
    const manage = Object.entries(t.findResources('AWS::IAM::Policy')).filter(([, p]) => JSON.stringify(p).includes('execute-api:ManageConnections'));
    expect(manage.map(([id]) => id.replace(/ServiceRole.*$/, '').replace(/[0-9A-F]{8}$/, '')).sort()).toEqual(['Alexa', 'Http']);
    for (const [, p] of manage) expect(JSON.stringify(p)).toContain('/prod/POST/@connections/*');
  });

  it('serves the Alexa skill from a 8 s function with item-level table access, no scan, no batch, no secrets', () => {
    const [, policy] = Object.entries(t.findResources('AWS::IAM::Policy')).find(([id]) => /^Alexa/.test(id))!;
    const json = JSON.stringify(policy);
    expect(json).toContain('dynamodb:Query');
    expect(json).not.toMatch(/dynamodb:(Scan|Batch|\*)|secretsmanager|transcribe|s3:/);
    const alexa = Object.entries(t.findResources('AWS::Lambda::Function')).find(([id]) => id.startsWith('Alexa'))![1];
    expect(alexa.Properties.Timeout).toBe(8);
    expect(alexa.Properties.Environment.Variables).toHaveProperty('WS_ENDPOINT');
    const urls = Object.values(t.findResources('AWS::Lambda::Url', { Properties: { AuthType: 'NONE' } }));
    expect(urls).toHaveLength(1);
    expect(Object.keys(t.findOutputs('*'))).toContain('AlexaEndpoint');
  });

  it('lets only the http Lambda stream to Transcribe, with exactly that one action', () => {
    const tr = Object.entries(t.findResources('AWS::IAM::Policy')).filter(([, p]) => JSON.stringify(p).includes('transcribe:'));
    expect(tr).toHaveLength(1);
    expect(tr[0]![0]).toMatch(/Http/);
    const actions = statements().flatMap(s => [s.Action].flat()).filter(a => a.startsWith('transcribe:'));
    expect(actions).toEqual(['transcribe:StartStreamTranscription']);
  });

  it('serves the site from CloudFront with index.html as the root', () => {
    t.hasResourceProperties('AWS::CloudFront::Distribution', { DistributionConfig: { DefaultRootObject: 'index.html' } });
    t.hasResourceProperties('AWS::S3::Bucket', { PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true } });
    t.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
  });

  it('has an HTTP API and a WebSocket API', () => {
    t.hasResourceProperties('AWS::ApiGatewayV2::Api', { ProtocolType: 'HTTP' });
    t.hasResourceProperties('AWS::ApiGatewayV2::Api', { ProtocolType: 'WEBSOCKET' });
  });

  it('runs Node 22 Lambdas with the brief sizes', () => {
    t.hasResourceProperties('AWS::Lambda::Function', { Runtime: 'nodejs22.x', MemorySize: 256, Timeout: 25, Handler: 'index.handler' });
    t.hasResourceProperties('AWS::Lambda::Function', { Runtime: 'nodejs22.x', MemorySize: 256, Timeout: 8, Handler: 'index.handler' });
  });

  it('throttles both stages at 10 rps, burst 20', () => {
    t.hasResourceProperties('AWS::ApiGatewayV2::Stage', { DefaultRouteSettings: { ThrottlingRateLimit: 10, ThrottlingBurstLimit: 20 } });
  });

  it('has a USD 20 monthly budget that emails the owner', () => {
    t.hasResourceProperties('AWS::Budgets::Budget', {
      Budget: { BudgetType: 'COST', TimeUnit: 'MONTHLY', BudgetLimit: { Amount: 20, Unit: 'USD' } },
      NotificationsWithSubscribers: Match.arrayWith([Match.objectLike({ Subscribers: [{ SubscriptionType: 'EMAIL', Address: 'owner@example.com' }] })]),
    });
  });

  it('tags every resource with project=courtside (stack tags cover the CDK helper functions)', () => {
    expect(stack.tags.tagValues()).toEqual({ project: 'courtside' });
    for (const type of ['AWS::DynamoDB::Table', 'AWS::Lambda::Function', 'AWS::S3::Bucket']) {
      for (const [id, r] of Object.entries(t.findResources(type)).filter(([id]) => !id.startsWith('Custom'))) expect(r.Properties.Tags ?? [], id).toContainEqual({ Key: 'project', Value: 'courtside' });
    }
  });

  it('outputs SiteUrl, HttpApiUrl and WsUrl', () => {
    const outputs = Object.keys(t.findOutputs('*'));
    expect(outputs).toEqual(expect.arrayContaining(['SiteUrl', 'HttpApiUrl', 'WsUrl']));
  });

  it('refuses to synthesize without an owner email', () => {
    expect(() => new CourtsideStack(new App(), 'NoEmail', { webDir })).toThrow(/ownerEmail/);
  });
});
