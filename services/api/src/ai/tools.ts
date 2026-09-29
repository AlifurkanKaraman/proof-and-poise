/**
 * Tool specs for Bedrock Converse forced tool use (design §7.1). The JSON Schema comes from
 * the shared Zod model-output schema via Zod 4's native `z.toJSONSchema`, so the tool
 * definition and the validator can't drift apart.
 */
import type { Tool } from '@aws-sdk/client-bedrock-runtime';
import { z } from 'zod';

type JsonSchema = Record<string, unknown>;

/** Draft-7 JSON Schema without the `$schema` marker (Bedrock wants a bare schema object). */
export function toolInputSchema(schema: z.ZodType): JsonSchema {
  const { $schema: _ignored, ...json } = z.toJSONSchema(schema, {
    target: 'draft-7',
    unrepresentable: 'any',
  }) as JsonSchema;
  return json;
}

export function toolSpec(name: string, description: string, schema: z.ZodType): Tool {
  return {
    toolSpec: {
      name,
      description,
      // DocumentType is a JSON value; the schema is plain JSON.
      inputSchema: { json: toolInputSchema(schema) as never },
    },
  };
}
