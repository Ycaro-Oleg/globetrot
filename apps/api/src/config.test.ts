import { describe, expect, it } from 'vitest';
import { ApiConfigError, INSECURE_DEV_SECRET, loadApiConfig, MIN_SECRET_LENGTH } from './config';

const DATABASE_URL = 'postgres://globetrot:globetrot@localhost:5455/globetrot';
const STRONG_SECRET = 'a'.repeat(MIN_SECRET_LENGTH);
const production = (extra: Record<string, string> = {}) => ({
  NODE_ENV: 'production',
  DATABASE_URL,
  BETTER_AUTH_URL: 'https://app.example.test',
  BETTER_AUTH_SECRET: STRONG_SECRET,
  SMTP_HOST: 'smtp.example.test',
  EMAIL_FROM: 'Globetrot <hello@example.test>',
  S3_ENDPOINT: 'https://s3.example.test',
  S3_BUCKET: 'globetrot-photos',
  S3_ACCESS_KEY_ID: 'production-key',
  S3_SECRET_ACCESS_KEY: 'production-secret',
  ...extra,
});

describe('development defaults', () => {
  const config = loadApiConfig({ DATABASE_URL });

  it('work with only DATABASE_URL, using the public development secret', () => {
    expect(config.nodeEnv).toBe('development');
    expect(config.isProduction).toBe(false);
    expect(config.usingInsecureSecret).toBe(true);
    expect(config.auth.secret).toBe(INSECURE_DEV_SECRET);
    expect(config.auth.secureCookies).toBe(false);
    expect(config.databaseUrl).toBe(DATABASE_URL);
  });

  it('document their values: web origin, 30-day sessions renewed daily, 5 attempts a minute, port 4000', () => {
    expect(config.auth.baseURL).toBe('http://localhost:3000');
    expect(config.auth.trustedOrigins).toEqual(['http://localhost:3000']);
    expect(config.auth.sessionExpiresIn).toBe(60 * 60 * 24 * 30);
    expect(config.auth.sessionUpdateAge).toBe(60 * 60 * 24);
    expect(config.auth.signInAttemptsPerMinute).toBe(5);
    expect(config.auth.signUpAttemptsPerMinute).toBe(5);
    expect(config.port).toBe(4000);
  });
});

describe('environment parsing', () => {
  it.each([
    ['production', 'production'],
    ['test', 'test'],
    ['development', 'development'],
    ['staging', 'development'],
    [undefined, 'development'],
  ])('maps NODE_ENV=%s to %s', (value, expected) => {
    const env =
      value === 'production'
        ? production()
        : { DATABASE_URL, ...(value ? { NODE_ENV: value } : {}) };
    expect(loadApiConfig(env).nodeEnv).toBe(expected);
  });

  it('prefers PORT (set by the platform) over API_PORT (local .env)', () => {
    expect(loadApiConfig({ DATABASE_URL, API_PORT: '4100' }).port).toBe(4100);
    expect(loadApiConfig({ DATABASE_URL, API_PORT: '4100', PORT: '8080' }).port).toBe(8080);
  });

  it('treats an empty value (KEY= in a .env file) as unset', () => {
    const config = loadApiConfig({
      DATABASE_URL,
      BETTER_AUTH_SECRET: '',
      BETTER_AUTH_URL: '',
      PORT: '',
    });
    expect(config.usingInsecureSecret).toBe(true);
    expect(config.auth.baseURL).toBe('http://localhost:3000');
    expect(config.port).toBe(4000);
  });

  it('turns TRUSTED_ORIGINS into unique origins, always including the web origin', () => {
    const config = loadApiConfig({
      DATABASE_URL,
      BETTER_AUTH_URL: 'http://localhost:3000/some/path',
      TRUSTED_ORIGINS:
        ' http://localhost:3000 , https://preview.example.test/app,,https://preview.example.test ',
    });
    expect(config.auth.baseURL).toBe('http://localhost:3000');
    expect(config.auth.trustedOrigins).toEqual([
      'http://localhost:3000',
      'https://preview.example.test',
    ]);
  });

  it('applies numeric overrides', () => {
    const config = loadApiConfig({
      DATABASE_URL,
      SESSION_EXPIRES_IN_SECONDS: '3600',
      SESSION_UPDATE_AGE_SECONDS: '600',
      AUTH_SIGN_IN_ATTEMPTS_PER_MINUTE: '3',
      AUTH_SIGN_UP_ATTEMPTS_PER_MINUTE: '2',
    });
    expect(config.auth).toMatchObject({
      sessionExpiresIn: 3600,
      sessionUpdateAge: 600,
      signInAttemptsPerMinute: 3,
      signUpAttemptsPerMinute: 2,
    });
  });

  it.each([
    ['SESSION_EXPIRES_IN_SECONDS', '10'],
    ['SESSION_UPDATE_AGE_SECONDS', 'soon'],
    ['AUTH_SIGN_IN_ATTEMPTS_PER_MINUTE', '0'],
    ['PORT', '70000'],
    ['BETTER_AUTH_URL', 'not a url'],
  ])('rejects an invalid %s and names it', (key, value) => {
    expect(() => loadApiConfig({ DATABASE_URL, [key]: value })).toThrow(ApiConfigError);
    expect(() => loadApiConfig({ DATABASE_URL, [key]: value })).toThrow(new RegExp(key));
  });

  it('rejects a TRUSTED_ORIGINS entry that is not a URL', () => {
    expect(() =>
      loadApiConfig({ DATABASE_URL, TRUSTED_ORIGINS: 'https://ok.example.test,nope' }),
    ).toThrow(/TRUSTED_ORIGINS/);
  });

  it('requires a valid DATABASE_URL', () => {
    expect(() => loadApiConfig({})).toThrow(/DATABASE_URL/);
    expect(() => loadApiConfig({ DATABASE_URL: 'mysql://localhost/app' })).toThrow(/DATABASE_URL/);
  });
});

describe('production refuses to start with an unsafe setup', () => {
  it('accepts a strong secret over https', () => {
    const config = loadApiConfig(production());
    expect(config.isProduction).toBe(true);
    expect(config.usingInsecureSecret).toBe(false);
    expect(config.auth.secureCookies).toBe(true);
    expect(config.auth.secret).toBe(STRONG_SECRET);
  });

  it('refuses a missing secret', () => {
    const env: Record<string, string | undefined> = production();
    delete env.BETTER_AUTH_SECRET;
    expect(() => loadApiConfig(env)).toThrow(/BETTER_AUTH_SECRET is required in production/);
    expect(() => loadApiConfig({ ...env, BETTER_AUTH_SECRET: '' })).toThrow(
      /required in production/,
    );
  });

  it('refuses the public development secret (what a copied .env.example contains)', () => {
    expect(() => loadApiConfig(production({ BETTER_AUTH_SECRET: INSECURE_DEV_SECRET }))).toThrow(
      /must not be the public development secret/,
    );
  });

  it('refuses a secret that is too short', () => {
    expect(() =>
      loadApiConfig(production({ BETTER_AUTH_SECRET: 'a'.repeat(MIN_SECRET_LENGTH - 1) })),
    ).toThrow(/at least 32 characters/);
  });

  it('refuses an http base URL, because session cookies are Secure there', () => {
    expect(() => loadApiConfig(production({ BETTER_AUTH_URL: 'http://app.example.test' }))).toThrow(
      /must use https/,
    );
  });

  it('never repeats the secret in an error message', () => {
    const leaked = 'hunter2-hunter2';
    try {
      loadApiConfig(production({ BETTER_AUTH_SECRET: leaked }));
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain(leaked);
    }
  });
});

describe('email and verification settings', () => {
  const dev = (extra: Record<string, string> = {}) => loadApiConfig({ DATABASE_URL, ...extra });

  it('defaults to Mailpit, a verified-email requirement and the documented lifetimes', () => {
    const config = dev();
    expect(config.email).toEqual({
      host: 'localhost',
      port: 1025,
      from: 'Globetrot <hello@globetrot.local>',
      user: undefined,
      password: undefined,
    });
    expect(config.auth).toMatchObject({
      requireVerifiedEmail: true,
      verificationExpiresIn: 24 * 60 * 60,
      resetPasswordExpiresIn: 60 * 60,
      emailCooldownSeconds: 30,
      emailRequestsPerMinute: 5,
    });
  });

  it('reads every setting, and the verified-email requirement can be turned off', () => {
    const config = dev({
      REQUIRE_VERIFIED_EMAIL: 'false',
      VERIFICATION_EXPIRES_IN_SECONDS: '600',
      RESET_PASSWORD_EXPIRES_IN_SECONDS: '300',
      EMAIL_COOLDOWN_SECONDS: '45',
      AUTH_EMAIL_REQUESTS_PER_MINUTE: '3',
      SMTP_HOST: 'smtp.example.test',
      SMTP_PORT: '587',
      SMTP_USER: 'mailer',
      SMTP_PASSWORD: 'not-a-real-password',
      EMAIL_FROM: 'Globetrot <no-reply@example.test>',
    });
    expect(config.auth).toMatchObject({
      requireVerifiedEmail: false,
      verificationExpiresIn: 600,
      resetPasswordExpiresIn: 300,
      emailCooldownSeconds: 45,
      emailRequestsPerMinute: 3,
    });
    expect(config.email).toEqual({
      host: 'smtp.example.test',
      port: 587,
      from: 'Globetrot <no-reply@example.test>',
      user: 'mailer',
      password: 'not-a-real-password',
    });
  });

  it.each([
    ['REQUIRE_VERIFIED_EMAIL', 'maybe'],
    ['VERIFICATION_EXPIRES_IN_SECONDS', '0'],
    ['RESET_PASSWORD_EXPIRES_IN_SECONDS', '-5'],
    ['EMAIL_COOLDOWN_SECONDS', '0'],
    ['AUTH_EMAIL_REQUESTS_PER_MINUTE', '0'],
    ['SMTP_PORT', '70000'],
  ])('refuses %s=%s, naming the setting', (name, value) => {
    expect(() => dev({ [name]: value })).toThrow(new RegExp(name));
  });

  it('requires a real mail server and sender in production, because the defaults never reach an inbox', () => {
    const without = (name: string) => {
      const env: Record<string, string | undefined> = production();
      delete env[name];
      return env;
    };
    expect(() => loadApiConfig(without('SMTP_HOST'))).toThrow(
      /SMTP_HOST is required in production/,
    );
    expect(() => loadApiConfig(without('EMAIL_FROM'))).toThrow(
      /EMAIL_FROM is required in production/,
    );
    expect(() => loadApiConfig({ ...production(), SMTP_HOST: '' })).toThrow(/SMTP_HOST/);
    expect(loadApiConfig(production()).email.host).toBe('smtp.example.test');
  });

  it('requires real object storage in production, never the local credentials', () => {
    for (const name of ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) {
      const env: Record<string, string | undefined> = production();
      delete env[name];
      expect(() => loadApiConfig(env)).toThrow(new RegExp(`${name} is required in production`));
    }
    expect(() => loadApiConfig(production({ S3_ACCESS_KEY_ID: 'globetrot-dev' }))).toThrow(
      /local development ones/,
    );
    expect(loadApiConfig(production()).storage).toMatchObject({
      endpoint: 'https://s3.example.test',
      bucket: 'globetrot-photos',
    });
  });
});

describe('Google sign-in settings', () => {
  const base = { DATABASE_URL: 'postgres://u:p@localhost:5432/db' };

  it('is off with no credentials', () => {
    expect(loadApiConfig(base).auth.google).toBeNull();
    expect(
      loadApiConfig({ ...base, GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' }).auth.google,
    ).toBeNull();
  });

  it('is on with both credentials', () => {
    const config = loadApiConfig({
      ...base,
      GOOGLE_CLIENT_ID: 'id.apps.example',
      GOOGLE_CLIENT_SECRET: 'secret-value',
    });
    expect(config.auth.google).toEqual({
      clientId: 'id.apps.example',
      clientSecret: 'secret-value',
    });
  });

  it.each([{ GOOGLE_CLIENT_ID: 'id' }, { GOOGLE_CLIENT_SECRET: 'secret-value' }])(
    'refuses to start with only one of the two (%j), naming the settings and never a value',
    (env) => {
      const attempt = () => loadApiConfig({ ...base, ...env });
      expect(attempt).toThrow(/GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together/);
      expect(attempt).not.toThrow(/secret-value/);
    },
  );
});
