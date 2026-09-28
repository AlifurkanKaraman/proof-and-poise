/**
 * tech-dictionary.ts
 * Dictionary of technical terms for novel-term detection.
 * These are terms that should be grounded in source materials.
 */

import { normalizeKeyword } from '../grounding/normalize.js';

/**
 * Set of known technical terms (pre-normalized).
 * Used to identify terms that should be verified for grounding.
 */
const TECH_TERMS_RAW = [
  // Programming languages
  'javascript',
  'typescript',
  'python',
  'java',
  'c',
  'cpp',
  'csharp',
  'go',
  'golang',
  'rust',
  'ruby',
  'php',
  'swift',
  'kotlin',
  'scala',
  'r',
  'matlab',
  'perl',
  'haskell',
  'elixir',
  'clojure',
  'dart',

  // Frameworks & Libraries
  'react',
  'angular',
  'vue',
  'svelte',
  'nextjs',
  'nuxtjs',
  'express',
  'fastapi',
  'django',
  'flask',
  'spring',
  'springboot',
  'rails',
  'laravel',
  'symfony',
  'aspnet',
  'jquery',
  'bootstrap',
  'tailwind',
  'materialui',
  'chakraui',

  // Cloud & Infrastructure
  'aws',
  'azure',
  'gcp',
  'lambda',
  's3',
  'ec2',
  'rds',
  'dynamodb',
  'cloudfront',
  'apigateway',
  'ecs',
  'eks',
  'fargate',
  'cloudformation',
  'terraform',
  'ansible',
  'puppet',
  'chef',
  'docker',
  'kubernetes',
  'k8s',
  'helm',
  'istio',
  'openshift',
  'heroku',
  'netlify',
  'vercel',
  'digitalocean',

  // Databases
  'postgresql',
  'mysql',
  'mongodb',
  'redis',
  'elasticsearch',
  'cassandra',
  'couchdb',
  'neo4j',
  'influxdb',
  'mariadb',
  'sqlite',
  'oracle',
  'sqlserver',
  'cosmosdb',
  'firestore',

  // DevOps & CI/CD
  'jenkins',
  'gitlab',
  'github',
  'bitbucket',
  'circleci',
  'travisci',
  'teamcity',
  'bamboo',
  'githubactions',
  'argocd',
  'spinnaker',
  'terraform',

  // Monitoring & Observability
  'prometheus',
  'grafana',
  'datadog',
  'newrelic',
  'splunk',
  'elk',
  'kibana',
  'logstash',
  'cloudwatch',
  'sentry',
  'rollbar',
  'pagerduty',

  // Testing
  'jest',
  'mocha',
  'chai',
  'jasmine',
  'pytest',
  'junit',
  'testng',
  'selenium',
  'cypress',
  'playwright',
  'puppeteer',
  'postman',

  // Version Control
  'git',
  'svn',
  'mercurial',
  'perforce',

  // Message Queues & Streaming
  'kafka',
  'rabbitmq',
  'activemq',
  'redis',
  'sqs',
  'sns',
  'kinesis',
  'pubsub',

  // API & Integration
  'rest',
  'graphql',
  'grpc',
  'soap',
  'websocket',
  'webhook',
  'oauth',
  'jwt',
  'saml',
  'openapi',
  'swagger',

  // Methodologies
  'agile',
  'scrum',
  'kanban',
  'devops',
  'cicd',
  'tdd',
  'bdd',
  'ddd',
  'microservices',
  'serverless',
  'jamstack',

  // Data & ML
  'machinelearning',
  'deeplearning',
  'tensorflow',
  'pytorch',
  'scikitlearn',
  'pandas',
  'numpy',
  'jupyter',
  'spark',
  'hadoop',
  'airflow',
  'dbt',
  'snowflake',
  'redshift',
  'bigquery',

  // Mobile
  'ios',
  'android',
  'reactnative',
  'flutter',
  'ionic',
  'cordova',
  'xamarin',

  // Security
  'oauth',
  'saml',
  'jwt',
  'ssl',
  'tls',
  'https',
  'vpn',
  'firewall',
  'waf',
  'iam',
  'mfa',
  'sso',
  'pen testing',
  'vulnerability scanning',
];

const TECH_TERMS: Set<string> = new Set(TECH_TERMS_RAW.map(normalizeKeyword));

/**
 * Check if a term is in the technical dictionary.
 */
export function isTechTerm(term: string): boolean {
  return TECH_TERMS.has(normalizeKeyword(term));
}

/**
 * Get all tech terms (for testing/debugging).
 */
export function getAllTechTerms(): string[] {
  return Array.from(TECH_TERMS);
}
