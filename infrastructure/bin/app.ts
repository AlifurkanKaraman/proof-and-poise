import { App } from 'aws-cdk-lib';
import { REGION, resolveConfig } from '../lib/config';
import { ProofAndPoiseStack } from '../lib/proof-and-poise-stack';

const app = new App();
const config = resolveConfig(app);
const account = process.env['CDK_DEFAULT_ACCOUNT'];

new ProofAndPoiseStack(app, `ProofAndPoise-${config.stage}`, {
  config,
  env: account ? { account, region: REGION } : { region: REGION },
  description: `Proof & Poise (${config.stage})`,
});
