/**
 * @proof-and-poise/shared
 * Pure TypeScript shared library for domain logic, schemas, and contracts.
 * No DOM or Node APIs - compatible with React Native.
 */

// Limits
export * from './limits.js';

// Schemas (Zod)
export * from './schemas/index.js';

// Contracts (API)
export * from './contracts/index.js';

// Scoring (deterministic functions)
export * from './scoring/index.js';

// Grounding (truthfulness verification)
export * from './grounding/index.js';

// Interview (composition and follow-up logic)
export * from './interview/index.js';

// Keywords (aliases and tech dictionary)
export * from './keywords/index.js';
