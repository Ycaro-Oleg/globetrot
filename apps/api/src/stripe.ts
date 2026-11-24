import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  BillingReader,
  PaymentEvent,
  PaymentEvents,
  PaymentsPort,
  SubscriptionRecord,
} from '@globetrot/application';
import type { StripeConfig } from './config';

/**
 * Adapter: payments on Stripe (ADR-0019), over its HTTP API with `fetch` (no SDK). Checkout and the Customer
 * Portal are Stripe-hosted pages; the webhook verifies Stripe's signature, reads the subscription's current
 * state from Stripe and hands it to the application. Logs carry event types only, never ids, emails or amounts.
 */

const API = 'https://api.stripe.com/v1';
/** Pinned so a dashboard upgrade cannot change the shapes read here. */
const STRIPE_VERSION = '2024-06-20';
/** How old a signed webhook may be before it is refused (replays). */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

type Fetch = typeof fetch;

function form(values: Record<string, string | undefined>) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== undefined) body.set(key, value);
  return body;
}

function client(config: StripeConfig, call: Fetch) {
  const headers = {
    authorization: `Bearer ${config.secretKey}`,
    'stripe-version': STRIPE_VERSION,
  };
  return {
    async post(path: string, values: Record<string, string | undefined>) {
      const response = await call(`${API}${path}`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/x-www-form-urlencoded' },
        body: form(values),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`stripe ${path.split('/')[1]} ${response.status}`);
      return (await response.json()) as Record<string, unknown>;
    },
    async get(path: string) {
      const response = await call(`${API}${path}`, {
        headers,
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`stripe ${path.split('/')[1]} ${response.status}`);
      return (await response.json()) as Record<string, unknown>;
    },
  };
}

export function createStripePayments(
  config: StripeConfig | null,
  billing: Pick<BillingReader, 'findProviderCustomer'>,
  options: { readonly fetch?: Fetch | undefined } = {},
): PaymentsPort {
  if (!config) return { checkoutUrl: async () => null, portalUrl: async () => null };
  const stripe = client(config, options.fetch ?? fetch);
  const back = `${config.returnOrigin}/app/plan`;
  return {
    async checkoutUrl({ userId, email, item, interval }) {
      const customer = await billing.findProviderCustomer(userId);
      const who = customer ? { customer } : { customer_email: email };
      const common = {
        ...who,
        client_reference_id: userId,
        'metadata[userId]': userId,
        'metadata[item]': item,
        'line_items[0][quantity]': '1',
        success_url: `${back}?paid=${item}`,
        cancel_url: back,
      };
      const session =
        item === 'top-up'
          ? await stripe.post('/checkout/sessions', {
              ...common,
              mode: 'payment',
              'line_items[0][price]': config.prices.topUp,
              'payment_intent_data[metadata][userId]': userId,
              ...(customer ? {} : { customer_creation: 'always' }),
            })
          : await stripe.post('/checkout/sessions', {
              ...common,
              mode: 'subscription',
              'line_items[0][price]': config.prices[item][interval],
              'subscription_data[metadata][userId]': userId,
              allow_promotion_codes: 'true',
            });
      return typeof session.url === 'string' ? session.url : null;
    },
    async portalUrl({ providerCustomerId }) {
      const session = await stripe.post('/billing_portal/sessions', {
        customer: providerCustomerId,
        return_url: back,
      });
      return typeof session.url === 'string' ? session.url : null;
    },
  };
}

/** Checks a `Stripe-Signature` header against the raw body. */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds: number,
): boolean {
  if (!header) return false;
  const parts = header.split(',').map((part) => part.trim().split('='));
  const timestamp = Number(parts.find(([key]) => key === 't')?.[1]);
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value ?? '');
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;
  const expected = Buffer.from(
    createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex'),
  );
  return signatures.some((signature) => {
    const given = Buffer.from(signature);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

type Json = Record<string, unknown>;
const object = (value: unknown): Json =>
  typeof value === 'object' && value !== null ? (value as Json) : {};
const text = (value: unknown) => (typeof value === 'string' && value !== '' ? value : null);
const idOf = (value: unknown) => text(value) ?? text(object(value).id);

/** A Stripe subscription as ours, or null for a price we do not sell or a state that grants nothing yet. */
export function toSubscriptionRecord(
  subscription: Json,
  prices: StripeConfig['prices'],
): SubscriptionRecord | null {
  const item = object((object(subscription.items).data as unknown[] | undefined)?.[0]);
  const priceId = idOf(item.price);
  const match = (['explorer', 'voyager'] as const).flatMap((plan) =>
    (['month', 'year'] as const)
      .filter((interval) => prices[plan][interval] === priceId)
      .map((interval) => ({ plan, interval })),
  )[0];
  if (!match) return null;
  const raw = text(subscription.status);
  const status =
    raw === 'active' || raw === 'trialing'
      ? 'active'
      : raw === 'past_due' || raw === 'unpaid'
        ? 'past_due'
        : raw === 'canceled' || raw === 'incomplete_expired' || raw === 'paused'
          ? 'canceled'
          : null;
  // `incomplete`: the first payment has not gone through, so there is nothing to grant yet.
  if (!status) return null;
  const periodEnd = Number(subscription.current_period_end ?? item.current_period_end);
  const startedAt = Number(subscription.start_date);
  if (!Number.isFinite(periodEnd) || !Number.isFinite(startedAt)) return null;
  return {
    ...match,
    status,
    startedAt: new Date(startedAt * 1000),
    currentPeriodEnd: new Date(periodEnd * 1000),
    providerCustomerId: idOf(subscription.customer),
    providerSubscriptionId: text(subscription.id),
  };
}

export interface StripeWebhook {
  /** Answers the HTTP status for Stripe: 400 for a bad signature, 500 to be retried, 200 otherwise. */
  handle(rawBody: string, signature: string | null): Promise<number>;
}

export function createStripeWebhook(
  config: StripeConfig | null,
  events: PaymentEvents,
  options: { readonly fetch?: Fetch | undefined; readonly now?: () => number } = {},
): StripeWebhook {
  return {
    async handle(rawBody, signature) {
      if (!config) return 404;
      const now = Math.floor((options.now ?? Date.now)() / 1000);
      if (!verifyStripeSignature(rawBody, signature, config.webhookSecret, now)) return 400;
      let event: Json;
      try {
        event = object(JSON.parse(rawBody));
      } catch {
        return 400;
      }
      const type = text(event.type) ?? '';
      const data = object(object(event.data).object);
      const stripe = client(config, options.fetch ?? fetch);

      const fromSubscription = async (subscriptionId: string | null, userId: string | null) => {
        if (!subscriptionId) return null;
        const record = toSubscriptionRecord(
          await stripe.get(`/subscriptions/${encodeURIComponent(subscriptionId)}`),
          config.prices,
        );
        return record ? ({ kind: 'subscription', userId, record } as const) : null;
      };

      try {
        let payment: PaymentEvent | null = null;
        if (
          type === 'checkout.session.completed' ||
          type === 'checkout.session.async_payment_succeeded'
        ) {
          const userId = text(data.client_reference_id) ?? text(object(data.metadata).userId);
          if (data.mode === 'subscription') {
            payment = await fromSubscription(idOf(data.subscription), userId);
          } else if (
            data.mode === 'payment' &&
            data.payment_status === 'paid' &&
            object(data.metadata).item === 'top-up' &&
            userId
          ) {
            payment = {
              kind: 'top-up',
              userId,
              paymentId: idOf(data.payment_intent) ?? text(data.id) ?? '',
            };
          }
        } else if (type.startsWith('customer.subscription.')) {
          payment = await fromSubscription(text(data.id), text(object(data.metadata).userId));
        } else if (type === 'invoice.paid' || type === 'invoice.payment_failed') {
          const nested = object(object(data.parent).subscription_details).subscription;
          payment = await fromSubscription(idOf(data.subscription) ?? idOf(nested), null);
        }
        if (payment && (payment.kind !== 'top-up' || payment.paymentId)) {
          const outcome = await events.apply(payment);
          console.info(`stripe ${type}: ${outcome}`);
        }
        return 200;
      } catch (error) {
        console.error(
          `stripe ${type}: failed (${error instanceof Error ? error.message : 'unknown'})`,
        );
        return 500;
      }
    },
  };
}
