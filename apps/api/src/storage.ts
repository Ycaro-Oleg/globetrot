import type { StoragePort } from '@globetrot/application';
import { AwsClient } from 'aws4fetch';
import type { StorageConfig } from './config';

/** Thrown when storage answers with an error. Messages carry the status only, never a key or a credential. */
export class StorageError extends Error {
  constructor(status: number) {
    super(`storage answered ${status}`);
    this.name = 'StorageError';
  }
}

/**
 * Adapter: the application's `StoragePort` over any S3-compatible service (SeaweedFS locally), with signed
 * requests (SigV4, `aws4fetch`). Objects are private; the API serves them after its own access check.
 */
export function createS3Storage(config: StorageConfig): StoragePort {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: config.region,
    service: 's3',
  });
  const urlOf = (key: string) => {
    const base = new URL(config.endpoint);
    const path = key.split('/').map(encodeURIComponent).join('/');
    if (config.forcePathStyle) return new URL(`/${config.bucket}/${path}`, base).toString();
    base.hostname = `${config.bucket}.${base.hostname}`;
    return new URL(`/${path}`, base).toString();
  };
  return {
    async put(key, bytes, contentType) {
      const response = await client.fetch(urlOf(key), {
        method: 'PUT',
        body: bytes,
        headers: { 'content-type': contentType },
      });
      if (!response.ok) throw new StorageError(response.status);
    },
    async get(key) {
      const response = await client.fetch(urlOf(key));
      if (response.status === 404) return null;
      if (!response.ok) throw new StorageError(response.status);
      return new Uint8Array(await response.arrayBuffer());
    },
    async delete(key) {
      const response = await client.fetch(urlOf(key), { method: 'DELETE' });
      if (!response.ok && response.status !== 404) throw new StorageError(response.status);
    },
  };
}

/** In memory, for tests and for describing the contract. */
export function createMemoryStorage(): StoragePort {
  const objects = new Map<string, Uint8Array>();
  return {
    async put(key, bytes) {
      objects.set(key, bytes);
    },
    async get(key) {
      return objects.get(key) ?? null;
    },
    async delete(key) {
      objects.delete(key);
    },
  };
}
