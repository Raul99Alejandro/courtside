import { App, Aspects } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { CourtsideStack } from '../lib/stack.js';

const app = new App();
new CourtsideStack(app, 'Courtside', { env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' } });
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
