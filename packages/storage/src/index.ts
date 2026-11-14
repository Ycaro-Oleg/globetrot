/**
 * @globetrot/storage: the application's `StoragePort` over any S3-compatible service (SeaweedFS locally), with
 * signed requests (SigV4, `aws4fetch`), plus an in-memory store for tests. Used by the API and the worker.
 * Decision record: docs/architecture/adr/0014-photos-and-storage.md.
 */
import type { StoragePort } from '@globetrot/application';
import { AwsClient } from 'aws4fetch';

export interface StorageConfig {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  /** `bucket` in the path (SeaweedFS, most self-hosted S3) rather than in the host name. */
  readonly forcePathStyle: boolean;
}

/** The local storage's credentials from `.env.example`. Production refuses them. */
export const DEV_STORAGE_KEY = 'globetrot-dev';
export const DEV_STORAGE_SECRET = 'globetrot-dev-secret';

/** Thrown for a missing or unsafe setting. Messages name the setting, never its value. */
export class StorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageConfigError';
  }
}

/**
 * Reads the `S3_*` settings. In production every setting is required and the local credentials are refused, so
 * photos never land in a local bucket or under published credentials.
 */
export function storageConfigFromEnv(
  env: Readonly<Record<string, string | undefined>>,
  isProduction: boolean,
): StorageConfig {
  const value = (name: string) => (env[name] === '' ? undefined : env[name]);
  if (isProduction) {
    for (const name of ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) {
      if (value(name) === undefined)
        throw new StorageConfigError(`${name} is required in production`);
    }
    if (
      value('S3_ACCESS_KEY_ID') === DEV_STORAGE_KEY ||
      value('S3_SECRET_ACCESS_KEY') === DEV_STORAGE_SECRET
    ) {
      throw new StorageConfigError(
        'S3 credentials must not be the local development ones in production',
      );
    }
  }
  const endpoint = value('S3_ENDPOINT') ?? 'http://localhost:8333';
  try {
    new URL(endpoint);
  } catch {
    throw new StorageConfigError('S3_ENDPOINT is not a URL');
  }
  const pathStyle = value('S3_FORCE_PATH_STYLE') ?? 'true';
  if (pathStyle !== 'true' && pathStyle !== 'false') {
    throw new StorageConfigError('S3_FORCE_PATH_STYLE must be true or false');
  }
  return {
    endpoint,
    region: value('S3_REGION') ?? 'us-east-1',
    bucket: value('S3_BUCKET') ?? 'globetrot-media',
    accessKeyId: value('S3_ACCESS_KEY_ID') ?? DEV_STORAGE_KEY,
    secretAccessKey: value('S3_SECRET_ACCESS_KEY') ?? DEV_STORAGE_SECRET,
    forcePathStyle: pathStyle === 'true',
  };
}

/** Thrown when storage answers with an error. Messages carry the status only, never a key or a credential. */
export class StorageError extends Error {
  constructor(status: number) {
    super(`storage answered ${status}`);
    this.name = 'StorageError';
  }
}

const decodeXml = (text: string) =>
  text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');

export function createS3Storage(config: StorageConfig): StoragePort {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: config.region,
    service: 's3',
  });
  const bucketUrl = () => {
    const base = new URL(config.endpoint);
    if (config.forcePathStyle) return new URL(`/${config.bucket}`, base);
    base.hostname = `${config.bucket}.${base.hostname}`;
    return new URL('/', base);
  };
  const urlOf = (key: string) => {
    const base = bucketUrl();
    const path = key.split('/').map(encodeURIComponent).join('/');
    return `${base.toString().replace(/\/$/, '')}/${path}`;
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
    async list(prefix, after) {
      const url = bucketUrl();
      url.searchParams.set('list-type', '2');
      url.searchParams.set('prefix', prefix);
      url.searchParams.set('max-keys', '1000');
      if (after) url.searchParams.set('continuation-token', after);
      const response = await client.fetch(url.toString());
      if (!response.ok) throw new StorageError(response.status);
      const xml = await response.text();
      const keys = [...xml.matchAll(/<Key>([^<]*)<\/Key>/g)].map((match) => decodeXml(match[1]!));
      const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
      const next = /<NextContinuationToken>([^<]*)<\/NextContinuationToken>/.exec(xml)?.[1];
      return { keys, next: truncated && next ? decodeXml(next) : null };
    },
  };
}

/** In memory, for tests and for describing the contract. */
export function createMemoryStorage(): StoragePort & { readonly keys: () => string[] } {
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
    async list(prefix) {
      return {
        keys: [...objects.keys()].filter((key) => key.startsWith(prefix)).sort(),
        next: null,
      };
    },
    keys: () => [...objects.keys()],
  };
}
