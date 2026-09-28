/**
 * alias-map.ts
 * Keyword alias mappings for matching (e.g., k8s ↔ Kubernetes, JS ↔ JavaScript).
 */

import { normalizeKeyword } from '../grounding/normalize.js';

/**
 * Alias map: canonical term → array of aliases
 * All terms are pre-normalized.
 */
const ALIAS_MAP: Record<string, string[]> = {
  kubernetes: ['k8s', 'kube'],
  javascript: ['js', 'ecmascript'],
  typescript: ['ts'],
  postgresql: ['postgres', 'psql'],
  mongodb: ['mongo'],
  amazon: ['aws'],
  'continuous integration': ['ci', 'ci/cd'],
  'continuous deployment': ['cd', 'ci/cd'],
  'machine learning': ['ml'],
  'artificial intelligence': ['ai'],
  'natural language processing': ['nlp'],
  react: ['reactjs', 'react.js'],
  angular: ['angularjs', 'angular.js'],
  vue: ['vuejs', 'vue.js'],
  'node.js': ['nodejs', 'node'],
  python: ['py'],
  'c++': ['cpp'],
  'c#': ['csharp', 'c-sharp'],
  docker: ['containerization'],
  terraform: ['iac', 'infrastructure as code'],
  ansible: ['config management'],
  jenkins: ['ci/cd'],
  github: ['gh'],
  gitlab: ['gl'],
  jira: ['issue tracking'],
  agile: ['scrum', 'kanban'],
  rest: ['restful', 'rest api'],
  graphql: ['gql'],
  api: ['application programming interface'],
  sql: ['structured query language'],
  nosql: ['non-relational database'],
  html: ['html5', 'hypertext markup language'],
  css: ['css3', 'cascading style sheets'],
  sass: ['scss'],
  webpack: ['bundler'],
  git: ['version control', 'vcs'],
  redis: ['cache', 'in-memory database'],
  rabbitmq: ['message queue', 'mq'],
  kafka: ['event streaming'],
  elasticsearch: ['search engine', 'elk'],
  aws: ['amazon web services', 'amazon'],
  gcp: ['google cloud platform', 'google cloud'],
  azure: ['microsoft azure'],
  lambda: ['aws lambda', 'serverless functions'],
  s3: ['simple storage service', 'object storage'],
  ec2: ['elastic compute cloud', 'virtual machines'],
  rds: ['relational database service'],
  dynamodb: ['nosql database', 'dynamo'],
};

/**
 * Reverse map: alias → canonical term (built from ALIAS_MAP)
 */
const REVERSE_MAP: Map<string, string> = new Map();
for (const [canonical, aliases] of Object.entries(ALIAS_MAP)) {
  const normalizedCanonical = normalizeKeyword(canonical);
  REVERSE_MAP.set(normalizedCanonical, normalizedCanonical);
  for (const alias of aliases) {
    REVERSE_MAP.set(normalizeKeyword(alias), normalizedCanonical);
  }
}

/**
 * Get all aliases for a keyword (including the canonical form).
 */
export function getKeywordAliases(keyword: string): string[] {
  const normalized = normalizeKeyword(keyword);
  const canonical = REVERSE_MAP.get(normalized);

  if (!canonical) {
    return [normalized];
  }

  const aliases = ALIAS_MAP[canonical] || [];
  return [canonical, ...aliases.map(normalizeKeyword)];
}

/**
 * Check if two keywords are aliases of each other.
 */
export function areKeywordAliases(keyword1: string, keyword2: string): boolean {
  const norm1 = normalizeKeyword(keyword1);
  const norm2 = normalizeKeyword(keyword2);

  if (norm1 === norm2) return true;

  const canonical1 = REVERSE_MAP.get(norm1);
  const canonical2 = REVERSE_MAP.get(norm2);

  return canonical1 !== undefined && canonical1 === canonical2;
}

/**
 * Get the canonical form of a keyword.
 */
export function getCanonicalKeyword(keyword: string): string {
  const normalized = normalizeKeyword(keyword);
  return REVERSE_MAP.get(normalized) || normalized;
}
