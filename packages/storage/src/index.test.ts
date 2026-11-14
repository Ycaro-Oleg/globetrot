import { describe, expect, it } from 'vitest';
import { createMemoryStorage, storageConfigFromEnv } from './index';

describe('storage settings', () => {
  it('defaults to the local SeaweedFS', () => {
    expect(storageConfigFromEnv({}, false)).toMatchObject({
      endpoint: 'http://localhost:8333',
      bucket: 'globetrot-media',
      forcePathStyle: true,
    });
  });
  it('requires real settings in production and refuses the local credentials', () => {
    expect(() => storageConfigFromEnv({}, true)).toThrow(/S3_ENDPOINT is required/);
    const env = {
      S3_ENDPOINT: 'https://s3.example.test',
      S3_BUCKET: 'photos',
      S3_ACCESS_KEY_ID: 'globetrot-dev',
      S3_SECRET_ACCESS_KEY: 'x',
    };
    expect(() => storageConfigFromEnv(env, true)).toThrow(/local development/);
    expect(() => storageConfigFromEnv({ S3_ENDPOINT: 'nope' }, false)).toThrow(/not a URL/);
    expect(() => storageConfigFromEnv({ S3_FORCE_PATH_STYLE: 'maybe' }, false)).toThrow(
      /true or false/,
    );
  });
});

describe('memory storage', () => {
  it('puts, lists by prefix, gets and deletes', async () => {
    const storage = createMemoryStorage();
    await storage.put('media/a', new Uint8Array([1]), 'image/png');
    await storage.put('other/b', new Uint8Array([2]), 'image/png');
    expect((await storage.list('media/')).keys).toEqual(['media/a']);
    await storage.delete('media/a');
    expect(await storage.get('media/a')).toBeNull();
  });
});
