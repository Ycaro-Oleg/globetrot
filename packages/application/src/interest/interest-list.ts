import { INTEREST_LIST, INTEREST_SOURCES, normalizeEmail } from '@globetrot/domain';
import type { SupportedLocale } from '@globetrot/i18n';
import { z } from 'zod';
import type { EmailPort } from '../email/templates';
import { ValidationError } from '../errors';
import type { Clock, IdGenerator } from '../ports';

/**
 * The interest list (ADR-0037): visitors without an account leave an email, confirm it, and can leave in one
 * click. Public: there is no actor, so this is a service the HTTP layer calls before the session middleware,
 * not an operation. The address never leaves the store: no log, no audit metadata, no analytics.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const field = (max: number) => z.string().trim().min(1).max(max);

export const interestOriginSchema = z
  .object({
    utm_source: field(100).optional(),
    utm_medium: field(100).optional(),
    utm_campaign: field(100).optional(),
    referrer_domain: field(100)
      .regex(/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*$/, 'A host name only')
      .optional()
      .meta({ description: 'The referring site’s host name only: no scheme, path or query.' }),
    landing_path: field(200)
      .regex(/^\/[^?#\s]*$/, 'A path without a query or fragment')
      .optional()
      .meta({ description: 'The first page’s path, starting with `/`, with no query string.' }),
  })
  .meta({ description: 'Where the first visit came from. No IP address and no full URL.' });

export const joinInterestFields = z.object({
  email: z
    .email()
    .max(254)
    .meta({ description: 'A valid address without surrounding spaces; stored in lower case.' }),
  locale: z.enum(['en', 'pt-BR']).meta({ description: 'The language of the confirmation email.' }),
  consent: z
    .literal(true)
    .meta({ description: 'The consent box was ticked. Anything but `true` is refused.' }),
  source: z.enum(INTEREST_SOURCES).meta({ description: 'Which form it came from.' }),
  origin: interestOriginSchema.optional(),
  internal: z
    .boolean()
    .optional()
    .meta({ description: 'A team or test device (`?interno=1`): the entry never counts.' }),
});

export const interestTokenFields = z.object({
  token: z
    .string()
    .min(20)
    .max(200)
    .regex(/^[A-Za-z0-9_.-]+$/)
    .meta({ description: 'The token from the email’s link.' }),
});

export const joinInterestResultSchema = z.object({ accepted: z.literal(true) });
export const confirmInterestResultSchema = z.object({
  result: z.enum(['confirmed', 'already_confirmed', 'expired', 'not_found']),
  internal: z.boolean(),
});
export const leaveInterestResultSchema = z.object({ result: z.literal('unsubscribed') });

export type JoinInterestInput = z.input<typeof joinInterestFields>;
export type ConfirmInterestResult = z.output<typeof confirmInterestResultSchema>;

/** One entry as stored. `confirmHash` is the SHA-256 of the pending link's secret, never the secret. */
export interface InterestEntryRow {
  readonly id: string;
  readonly email: string;
  readonly locale: SupportedLocale;
  readonly source: (typeof INTEREST_SOURCES)[number];
  readonly utmSource: string | null;
  readonly utmMedium: string | null;
  readonly utmCampaign: string | null;
  readonly referrerDomain: string | null;
  readonly landingPath: string | null;
  readonly internal: boolean;
  readonly consentAt: Date;
  readonly consentVersion: string;
  readonly confirmedAt: Date | null;
  readonly confirmHash: string | null;
  readonly confirmExpiresAt: Date | null;
  readonly sendsWindowStart: Date | null;
  readonly sendsInWindow: number;
  readonly createdAt: Date;
}

export type InterestEntryPatch = Partial<
  Pick<
    InterestEntryRow,
    | 'locale'
    | 'internal'
    | 'consentAt'
    | 'consentVersion'
    | 'confirmedAt'
    | 'confirmHash'
    | 'confirmExpiresAt'
    | 'sendsWindowStart'
    | 'sendsInWindow'
  >
>;

/** Everything inside one transaction. `findBy*` lock the row until it ends. */
export interface InterestListTransaction {
  isSuppressed(emailHash: string): Promise<boolean>;
  findByEmail(email: string): Promise<InterestEntryRow | null>;
  findById(id: string): Promise<InterestEntryRow | null>;
  /** `false` when another request made the same address first. */
  insert(row: InterestEntryRow): Promise<boolean>;
  update(id: string, patch: InterestEntryPatch): Promise<void>;
  remove(id: string): Promise<void>;
  suppress(emailHash: string, at: Date): Promise<void>;
  /** Counts one more confirmation email on a UTC day and answers the day's total. */
  countEmail(day: string): Promise<number>;
  /** Audit with no actor (a visitor): an action, the entry's id and non-personal metadata. */
  audit(event: {
    readonly id: string;
    readonly occurredAt: Date;
    readonly action: string;
    readonly entityId: string;
    readonly metadata: Readonly<Record<string, string | number | boolean>>;
  }): Promise<void>;
}

export interface InterestListStore {
  transaction<T>(work: (tx: InterestListTransaction) => Promise<T>): Promise<T>;
}

/** Keyed hashing, implemented with a key derived from the auth secret (ADR-0037). */
export interface InterestHasher {
  /** HMAC-SHA256, base64url: the suppression hash and the unsubscribe token. */
  mac(value: string): string;
  /** SHA-256, hex: what is stored of a confirmation secret. */
  digest(value: string): string;
  /** Constant-time comparison. */
  equal(a: string, b: string): boolean;
}

/** Where the email's links point (web pages, and the one-click address the mail client posts to). */
export interface InterestLinks {
  confirmPage(token: string, locale: SupportedLocale): string;
  unsubscribePage(token: string, locale: SupportedLocale): string;
  oneClick(token: string): string;
}

export interface InterestListDependencies {
  readonly store: InterestListStore;
  readonly email: EmailPort;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly hasher: InterestHasher;
  readonly links: InterestLinks;
  /** The internal-address rule (team and reserved test addresses). */
  readonly isInternal: (email: string) => boolean;
  /** Confirmation emails for the whole list in one UTC day. */
  readonly dailyEmailCap: number;
  /** Runs a send without the caller waiting for it. Tests pass one that keeps the promise. */
  readonly background?: (task: () => Promise<void>) => void;
  /** Counts and codes only, never an address or a token. */
  readonly log?: (message: string) => void;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** `<entry id>.<secret>`; anything else is no token at all. */
function splitToken(token: string): { readonly id: string; readonly secret: string } | null {
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const id = token.slice(0, dot);
  const secret = token.slice(dot + 1);
  return UUID.test(id) && secret.length > 0 ? { id, secret } : null;
}

function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      })),
    );
  }
  return parsed.data;
}

export function createInterestList(deps: InterestListDependencies) {
  const log = deps.log ?? (() => {});
  const background =
    deps.background ??
    ((task: () => Promise<void>) => {
      void task();
    });
  const suppressionHash = (email: string) => deps.hasher.mac(`email:${email}`);
  const unsubscribeToken = (id: string) => `${id}.${deps.hasher.mac(`unsubscribe:${id}`)}`;

  return {
    /**
     * Adds or refreshes an entry and, when one is due, sends the confirmation in the background. Answers the
     * same whatever the address's state, so neither the answer nor its timing says whether it was known.
     */
    async join(raw: unknown): Promise<{ readonly accepted: true }> {
      const input = parse(joinInterestFields, raw);
      const email = normalizeEmail(input.email);
      const now = deps.clock.now();
      let ceiling: number | null = null;

      const due = await deps.store.transaction(async (tx) => {
        // A suppressed address is never emailed again by the list, whoever types it (ADR-0037).
        if (await tx.isSuppressed(suppressionHash(email))) return null;
        const existing = await tx.findByEmail(email);
        if (existing?.confirmedAt) return null;

        const windowStart = existing?.sendsWindowStart ?? null;
        const windowOpen = windowStart !== null && now.getTime() - windowStart.getTime() < DAY;
        const sentInWindow = windowOpen && existing ? existing.sendsInWindow : 0;
        let secret: string | null = null;
        if (sentInWindow < INTEREST_LIST.confirmEmailsPerDay) {
          const today = await tx.countEmail(now.toISOString().slice(0, 10));
          if (today <= deps.dailyEmailCap) secret = deps.ids.newToken();
          else ceiling = today;
        }

        const changes: InterestEntryPatch = {
          locale: input.locale,
          consentAt: now,
          consentVersion: INTEREST_LIST.consentVersion,
          internal:
            Boolean(input.internal) || deps.isInternal(email) || Boolean(existing?.internal),
          ...(secret
            ? {
                confirmHash: deps.hasher.digest(secret),
                confirmExpiresAt: new Date(now.getTime() + INTEREST_LIST.confirmHours * HOUR),
                sendsWindowStart: windowOpen ? windowStart : now,
                sendsInWindow: sentInWindow + 1,
              }
            : {}),
        };

        let id: string;
        if (existing) {
          id = existing.id;
          await tx.update(id, changes);
        } else {
          id = deps.ids.newId();
          const inserted = await tx.insert({
            id,
            email,
            source: input.source,
            utmSource: input.origin?.utm_source ?? null,
            utmMedium: input.origin?.utm_medium ?? null,
            utmCampaign: input.origin?.utm_campaign ?? null,
            referrerDomain: input.origin?.referrer_domain?.toLowerCase() ?? null,
            landingPath: input.origin?.landing_path ?? null,
            confirmedAt: null,
            confirmHash: null,
            confirmExpiresAt: null,
            sendsWindowStart: null,
            sendsInWindow: 0,
            createdAt: now,
            locale: input.locale,
            consentAt: now,
            consentVersion: INTEREST_LIST.consentVersion,
            internal: false,
            ...changes,
          });
          // The same address arrived twice at once: the other request owns the email.
          if (!inserted) return null;
        }
        await tx.audit({
          id: deps.ids.newId(),
          occurredAt: now,
          action: existing ? 'interest.rejoin' : 'interest.join',
          entityId: id,
          metadata: { source: input.source, emailed: secret !== null },
        });
        return secret ? { id, secret, locale: input.locale } : null;
      });

      if (ceiling !== null) log(`interest list: daily email ceiling reached (${ceiling} today)`);
      if (due) {
        const token = `${due.id}.${due.secret}`;
        const leave = unsubscribeToken(due.id);
        background(async () => {
          try {
            await deps.email.send({
              to: email,
              template: 'interestConfirm',
              locale: due.locale,
              data: {
                url: deps.links.confirmPage(token, due.locale),
                name: '',
                expiresInHours: INTEREST_LIST.confirmHours,
                unsubscribeUrl: deps.links.unsubscribePage(leave, due.locale),
              },
              listUnsubscribe: deps.links.oneClick(leave),
            });
          } catch (error) {
            const code = (error as { code?: unknown }).code;
            log(
              `interest list: confirmation email failed (${typeof code === 'string' ? code : 'unknown'})`,
            );
          }
        });
      }
      return { accepted: true as const };
    },

    /** Confirms an entry from the link in its email. */
    async confirm(raw: unknown): Promise<ConfirmInterestResult> {
      const { token } = parse(interestTokenFields, raw);
      const parts = splitToken(token);
      if (!parts) return { result: 'not_found', internal: false };
      const now = deps.clock.now();
      return deps.store.transaction(async (tx) => {
        const entry = await tx.findById(parts.id);
        if (
          !entry?.confirmHash ||
          !deps.hasher.equal(entry.confirmHash, deps.hasher.digest(parts.secret))
        ) {
          return { result: 'not_found', internal: false };
        }
        if (entry.confirmedAt) return { result: 'already_confirmed', internal: entry.internal };
        if (entry.confirmExpiresAt && entry.confirmExpiresAt.getTime() <= now.getTime()) {
          return { result: 'expired', internal: entry.internal };
        }
        await tx.update(entry.id, { confirmedAt: now });
        await tx.audit({
          id: deps.ids.newId(),
          occurredAt: now,
          action: 'interest.confirm',
          entityId: entry.id,
          metadata: {},
        });
        return { result: 'confirmed', internal: entry.internal };
      });
    },

    /**
     * Deletes the entry and keeps only the keyed hash of its address. The same answer for a used, unknown or
     * forged token, so the answer says nothing and running it twice is fine.
     */
    async leave(raw: unknown): Promise<{ readonly result: 'unsubscribed' }> {
      const { token } = parse(interestTokenFields, raw);
      const parts = splitToken(token);
      if (parts && deps.hasher.equal(parts.secret, deps.hasher.mac(`unsubscribe:${parts.id}`))) {
        const now = deps.clock.now();
        await deps.store.transaction(async (tx) => {
          const entry = await tx.findById(parts.id);
          if (!entry) return;
          await tx.suppress(suppressionHash(entry.email), now);
          await tx.remove(entry.id);
          await tx.audit({
            id: deps.ids.newId(),
            occurredAt: now,
            action: 'interest.unsubscribe',
            entityId: entry.id,
            metadata: {},
          });
        });
      }
      return { result: 'unsubscribed' as const };
    },

    /** The unsubscribe token of an entry, for any later list email. */
    unsubscribeToken,
  };
}

export type InterestList = ReturnType<typeof createInterestList>;
