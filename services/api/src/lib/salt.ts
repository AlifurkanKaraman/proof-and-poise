/**
 * IP-hash salt from SSM Parameter Store (Req 16.3, design §11). Fetched once per cold
 * start and cached; a failed fetch isn't cached, so the next request retries.
 */
import { GetParameterCommand, type SSMClient } from '@aws-sdk/client-ssm';

const MIN_SALT_LENGTH = 32;

export type SaltProvider = () => Promise<string>;

export function createSaltProvider(ssm: SSMClient, parameterName: string): SaltProvider {
  let cached: Promise<string> | null = null;
  return () => {
    cached ??= ssm
      .send(new GetParameterCommand({ Name: parameterName, WithDecryption: true }))
      .then((res) => {
        const value = res.Parameter?.Value;
        if (!value || value.length < MIN_SALT_LENGTH) throw new Error('IP hash salt missing');
        return value;
      })
      .catch((err: unknown) => {
        cached = null;
        throw err;
      });
    return cached;
  };
}
