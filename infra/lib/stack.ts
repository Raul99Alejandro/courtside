import { fileURLToPath } from 'node:url';
import { CfnOutput, Duration, RemovalPolicy, Stack, Tags, type StackProps } from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { NagSuppressions } from 'cdk-nag';
import type { Construct } from 'constructs';

export interface CourtsideStackProps extends StackProps {
  /** Directory with the built web pages (npm run web:build). */
  readonly webDir?: string;
}

/** Live answers: Claude Haiku 4.5 first, Nova 2 Lite as the fallback (src/explain/bedrock.ts LIVE_MODELS). */
const PROFILES = ['us.anthropic.claude-haiku-4-5-20251001-v1:0', 'us.amazon.nova-2-lite-v1:0'];
const FOUNDATION_MODELS = ['anthropic.claude-haiku-4-5-20251001-v1:0', 'amazon.nova-2-lite-v1:0'];
const WS_STAGE = 'prod';
const root = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url));

export class CourtsideStack extends Stack {
  constructor(scope: Construct, id: string, props: CourtsideStackProps = {}) {
    // Stack tags reach every resource through CloudFormation, including the CDK helper functions that Tags.of cannot see.
    super(scope, id, { ...props, tags: { ...props.tags, project: 'courtside' } });
    const ownerEmail = this.node.tryGetContext('ownerEmail') as string | undefined;
    if (!ownerEmail) throw new Error('Pass the owner email as context: -c ownerEmail=you@example.com');

    const table = new dynamodb.Table(this, 'Table', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: false },
      deletionProtection: false,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const fn = (name: string, entry: string, memorySize: number, timeout: Duration, environment: Record<string, string>) => {
      const logGroup = new logs.LogGroup(this, `${name}Logs`, { retention: logs.RetentionDays.ONE_MONTH, removalPolicy: RemovalPolicy.DESTROY });
      return new nodejs.NodejsFunction(this, name, {
        entry: root(entry), handler: 'handler', runtime: lambda.Runtime.NODEJS_22_X, architecture: lambda.Architecture.ARM_64,
        memorySize, timeout, logGroup, environment: { TABLE: table.tableName, ...environment },
        bundling: {
          forceDockerBundling: false, format: nodejs.OutputFormat.ESM, target: 'node22', minify: true, sourceMap: false,
          mainFields: ['module', 'main'], externalModules: [],
          // Bundled CommonJS dependencies may call require(); ESM output needs it defined.
          banner: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
        },
      });
    };

    // WebSocket API first: the http function needs its callback endpoint, the ws function does not need the http one (no cycle).
    const wsFn = fn('Ws', 'src/api/ws.ts', 256, Duration.seconds(10), {});
    table.grantReadWriteData(wsFn);
    const wsApi = new apigw.WebSocketApi(this, 'WsApi', {
      apiName: 'courtside-ws',
      connectRouteOptions: { integration: new integrations.WebSocketLambdaIntegration('WsConnect', wsFn) },
      disconnectRouteOptions: { integration: new integrations.WebSocketLambdaIntegration('WsDisconnect', wsFn) },
      defaultRouteOptions: { integration: new integrations.WebSocketLambdaIntegration('WsDefault', wsFn) },
    });
    const wsStage = new apigw.WebSocketStage(this, 'WsStage', { webSocketApi: wsApi, stageName: WS_STAGE, autoDeploy: true });

    const httpFn = fn('Http', 'src/api/http.ts', 256, Duration.seconds(25), { WS_ENDPOINT: wsStage.callbackUrl });
    table.grantReadWriteData(httpFn);
    const bedrockInvoke = () => new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: [
        ...PROFILES.map(p => `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/${p}`),
        // The us. cross-region profiles route to several US regions, so the model ARN needs a region wildcard.
        ...FOUNDATION_MODELS.map(m => `arn:aws:bedrock:*::foundation-model/${m}`),
      ],
    });
    const manageConnections = () => new iam.PolicyStatement({
      actions: ['execute-api:ManageConnections'],
      resources: [`arn:aws:execute-api:${this.region}:${this.account}:${wsApi.apiId}/${WS_STAGE}/POST/@connections/*`],
    });
    httpFn.addToRolePolicy(bedrockInvoke());
    httpFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['transcribe:StartStreamTranscription'],
      resources: ['*'], // Transcribe streaming has no resource-level permissions
    }));
    httpFn.addToRolePolicy(manageConnections());

    // Alexa skill endpoint (HTTPS Function URL). Public by design: Alexa cannot sign with IAM, so the function itself checks the
    // Alexa certificate chain, signature, timestamp and skill id before touching any data. The skill id comes from the
    // `alexaSkillId` context (cdk.json or -c) once the skill exists; without it every request is rejected.
    // Table access is limited to the item operations it needs (no Scan, no batch writes).
    const alexaFn = fn('Alexa', 'src/alexa/handler.ts', 256, Duration.seconds(8), {
      WS_ENDPOINT: wsStage.callbackUrl, ALEXA_SKILL_ID: (this.node.tryGetContext('alexaSkillId') as string | undefined) ?? '',
    });
    alexaFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem', 'dynamodb:Query'], resources: [table.tableArn],
    }));
    // The URL is public: a flood of unsigned requests may use at most 5 concurrent executions (and so a bounded Bedrock/table bill).
    // Lambda keeps at least 10 unreserved, so an account whose limit is still the new-account 10 cannot reserve any:
    // cdk.json sets alexaReservedConcurrency to "off" for such an account until the quota is raised.
    const reserve = this.node.tryGetContext('alexaReservedConcurrency') as number | string | undefined;
    if (reserve !== 'off') (alexaFn.node.defaultChild as lambda.CfnFunction).reservedConcurrentExecutions = typeof reserve === 'number' ? reserve : 5;
    alexaFn.addToRolePolicy(bedrockInvoke());
    alexaFn.addToRolePolicy(manageConnections());
    const alexaUrl = alexaFn.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE });

    const httpApi = new apigw.HttpApi(this, 'HttpApi', {
      apiName: 'courtside-http',
      // The site and the API are different origins; the household code is the only secret, so any origin may call.
      corsPreflight: { allowOrigins: ['*'], allowMethods: [apigw.CorsHttpMethod.GET, apigw.CorsHttpMethod.POST], allowHeaders: ['content-type'], maxAge: Duration.hours(1) },
    });
    // GET/POST only: an ANY route would also catch OPTIONS and break the CORS preflight answered by API Gateway.
    httpApi.addRoutes({ path: '/{proxy+}', methods: [apigw.HttpMethod.GET, apigw.HttpMethod.POST], integration: new integrations.HttpLambdaIntegration('HttpIntegration', httpFn) });
    // Throttle both APIs (10 rps, burst 20); the question caps (300/hour, 600/day for the service) bound the Bedrock bill.
    const throttle = { throttlingRateLimit: 10, throttlingBurstLimit: 20 };
    (httpApi.defaultStage!.node.defaultChild as apigw.CfnStage).defaultRouteSettings = throttle;
    (wsStage.node.defaultChild as apigw.CfnStage).defaultRouteSettings = throttle;

    // Site: private bucket behind CloudFront with an origin access control.
    const bucket = new s3.Bucket(this, 'Site', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, enforceSSL: true, encryption: s3.BucketEncryption.S3_MANAGED,
      autoDeleteObjects: true, removalPolicy: RemovalPolicy.DESTROY,
    });
    const headers = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      securityHeadersBehavior: {
        strictTransportSecurity: { accessControlMaxAge: Duration.days(365), includeSubdomains: true, override: true },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: { referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN, override: true },
      },
    });
    // The TV web app (Expo export) lives under /tv/. A viewer-request function on that path only serves /tv/index.html for the
    // folder and for deep links (no file extension), so /config.json, /phone.html and real 404s elsewhere are untouched.
    const tvRouter = new cloudfront.Function(this, 'TvRouter', {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      comment: 'SPA fallback for /tv/* deep links',
      code: cloudfront.FunctionCode.fromInline(`function handler(event) {
  var request = event.request;
  var last = request.uri.split('/').pop();
  if (last.indexOf('.') === -1) request.uri = '/tv/index.html';
  return request;
}`),
    });
    const siteOrigin = origins.S3BucketOrigin.withOriginAccessControl(bucket);
    const distribution = new cloudfront.Distribution(this, 'Cdn', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: siteOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, responseHeadersPolicy: headers,
      },
      additionalBehaviors: {
        '/tv/*': {
          origin: siteOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, responseHeadersPolicy: headers,
          functionAssociations: [{ function: tvRouter, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
        },
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    const helperLogs = (name: string) => new logs.LogGroup(this, name, { retention: logs.RetentionDays.ONE_MONTH, removalPolicy: RemovalPolicy.DESTROY });
    new s3deploy.BucketDeployment(this, 'Deploy', {
      destinationBucket: bucket, distribution, distributionPaths: ['/*'], logGroup: helperLogs('DeployLogs'),
      sources: [
        s3deploy.Source.asset(props.webDir ?? root('dist-web')),
        s3deploy.Source.jsonData('config.json', { httpApiUrl: httpApi.apiEndpoint, wsUrl: wsStage.url }),
      ],
    });

    new budgets.CfnBudget(this, 'Budget', {
      budget: { budgetName: 'courtside-monthly', budgetType: 'COST', timeUnit: 'MONTHLY', budgetLimit: { amount: 20, unit: 'USD' } },
      notificationsWithSubscribers: [80, 100].map(threshold => ({
        notification: { notificationType: 'ACTUAL', comparisonOperator: 'GREATER_THAN', threshold, thresholdType: 'PERCENTAGE' },
        subscribers: [{ subscriptionType: 'EMAIL', address: ownerEmail }],
      })),
    });

    new CfnOutput(this, 'SiteUrl', { value: `https://${distribution.distributionDomainName}/` });
    new CfnOutput(this, 'HttpApiUrl', { value: httpApi.apiEndpoint });
    new CfnOutput(this, 'WsUrl', { value: wsStage.url });
    new CfnOutput(this, 'AlexaEndpoint', { value: alexaUrl.url });

    Tags.of(this).add('project', 'courtside');

    // IAM5 is acknowledged per role and per finding, so any new wildcard fails the stack test.
    NagSuppressions.addResourceSuppressions([httpFn.role!, alexaFn.role!], [{
      id: 'AwsSolutions-IAM5',
      appliesTo: [
        ...FOUNDATION_MODELS.map(m => `Resource::arn:aws:bedrock:*::foundation-model/${m}`),
        'Resource::*',
        { regex: '/^Resource::arn:aws:execute-api:.+\\/prod\\/POST\\/@connections\\/\\*$/' },
      ],
      reason: 'Bedrock: the us. cross-region inference profiles route to several US regions, so the foundation-model ARN needs a region wildcard (the model ids are fixed). Transcribe: StartStreamTranscription does not support resource-level permissions. execute-api: connection ids are unknown in advance, so the ARN ends in @connections/* on our one WebSocket API stage.',
    }], true);
    const deployHandler = 'Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C';
    NagSuppressions.addResourceSuppressionsByPath(this, `/${this.stackName}/${deployHandler}/ServiceRole/DefaultPolicy/Resource`, [{
      id: 'AwsSolutions-IAM5',
      reason: 'CDK BucketDeployment handler: copies the web build from the CDK assets bucket into our site bucket and invalidates our distribution (CloudFront invalidation has no resource-level scoping).',
      appliesTo: ['Action::s3:Abort*', 'Action::s3:DeleteObject*', 'Action::s3:GetBucket*', 'Action::s3:GetObject*', 'Action::s3:List*', 'Resource::*',
        `Resource::<${this.getLogicalId(bucket.node.defaultChild as s3.CfnBucket)}.Arn>/*`, { regex: '/^Resource::arn:<AWS::Partition>:s3:::cdk-[a-z0-9]+-assets-.+\\/\\*$/' }],
    }]);
    this.suppress();
  }

  /** cdk-nag findings accepted on purpose, each with its reason. */
  private suppress() {
    NagSuppressions.addStackSuppressions(this, [
      { id: 'AwsSolutions-IAM4', appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'], reason: 'Lambda functions (ours and the CDK helper handlers) use the AWS managed AWSLambdaBasicExecutionRole only to write their own CloudWatch logs.' },
      { id: 'AwsSolutions-L1', reason: 'The brief pins our functions to Node.js 22 (supported until 2027); the BucketDeployment handler runtime is chosen by the CDK.' },
      { id: 'AwsSolutions-APIG1', reason: 'API Gateway access logs are off for cost and to avoid storing caller IPs; the Lambda functions log every request, and both stages are throttled.' },
      { id: 'AwsSolutions-APIG4', reason: 'No user accounts in this demo: the six-character household code gates the household, and the cost is bounded by 30 questions/hour per household, 300/hour and 600/day for the whole service and a 10 rps stage throttle.' },
      { id: 'AwsSolutions-S1', reason: 'Server access logging is off for cost; the bucket only holds the public static web build.' },
      { id: 'AwsSolutions-CFR1', reason: 'No geo restriction: the demo is meant for hackathon judges anywhere.' },
      { id: 'AwsSolutions-CFR2', reason: 'AWS WAF is out of the USD 20 budget; CloudFront only serves static pages, and the APIs are protected by the household code, the global question caps and a 10 rps throttle.' },
      { id: 'AwsSolutions-CFR3', reason: 'CloudFront access logging is off for cost and to avoid storing viewer IPs.' },
      { id: 'AwsSolutions-CFR4', reason: 'The default cloudfront.net certificate is used (no custom domain), so the minimum TLS version cannot be raised.' },
    ]);
  }
}
