import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSaltProvider } from './salt';

const ssmMock = mockClient(SSMClient);
const NAME = '/proof-and-poise/test/ip-hash-salt';

beforeEach(() => ssmMock.reset());

describe('createSaltProvider (Req 16.3)', () => {
  it('reads the decrypted parameter once and caches it', async () => {
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: 'x'.repeat(64) } });
    const salt = createSaltProvider(new SSMClient({ region: 'us-east-1' }), NAME);
    await expect(salt()).resolves.toBe('x'.repeat(64));
    await salt();
    expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(1);
    expect(ssmMock.commandCalls(GetParameterCommand)[0]?.args[0].input).toEqual({
      Name: NAME,
      WithDecryption: true,
    });
  });

  it('rejects a missing or short salt and retries on the next call', async () => {
    ssmMock.on(GetParameterCommand).resolvesOnce({ Parameter: { Value: 'short' } });
    const salt = createSaltProvider(new SSMClient({ region: 'us-east-1' }), NAME);
    await expect(salt()).rejects.toThrow();
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: 'y'.repeat(64) } });
    await expect(salt()).resolves.toBe('y'.repeat(64));
  });
});
