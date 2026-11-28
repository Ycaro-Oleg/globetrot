import { createHmac } from 'node:crypto';
import { createApplication, createPaymentEvents, type UserRecord } from '@globetrot/application';
import { createFakePorts } from '@globetrot/application/testing';
import { describe, expect, it, vi } from 'vitest';
import type { StripeConfig } from './config';
import {
  createStripePayments,
  createStripeWebhook,
  toSubscriptionRecord,
  verifyStripeSignature,
} from './stripe';

const config: StripeConfig = {
  secretKey: 'sk_test_fake',
  webhookSecret: 'whsec_test_secret',
  prices: {
    USD: {
      explorer: { month: 'price_em', year: 'price_ey' },
      voyager: { month: 'price_vm', year: 'price_vy' },
      topUp: 'price_top',
      topUpSmall: null,
      tripPass: 'price_pass',
    },
    BRL: {
      explorer: { month: 'price_em_brl', year: 'price_ey_brl' },
      voyager: { month: 'price_vm_brl', year: 'price_vy_brl' },
      topUp: 'price_top_brl',
      topUpSmall: 'price_small_brl',
      tripPass: 'price_pass_brl',
    },
  },
  returnOrigin: 'https://globetrot.example',
};
const NOW = 1_794_000_000;
const sign = (body: string, t = NOW, secret = config.webhookSecret) =>
  `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;

const subscription = (patch: Record<string, unknown> = {}) => ({
  id: 'sub_1',
  status: 'active',
  customer: 'cus_1',
  start_date: NOW - 86_400,
  current_period_end: NOW + 29 * 86_400,
  metadata: { userId: 'u-ana' },
  items: { data: [{ price: { id: 'price_vy' } }] },
  ...patch,
});

/** Stands in for Stripe's API: records calls, answers the subscription. */
function stripeApi(answer: Record<string, unknown> = subscription()) {
  const calls: { url: string; method: string; body: string }[] = [];
  const call: typeof fetch = async (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      body: String(init?.body ?? ''),
    });
    const url = String(input);
    const json = url.includes('/subscriptions/')
      ? answer
      : {
          url: url.includes('billing_portal')
            ? 'https://billing.stripe.test/p'
            : 'https://checkout.stripe.test/c',
        };
    return new Response(JSON.stringify(json), { status: 200 });
  };
  return { call, calls };
}

describe('the Stripe signature', () => {
  const body = '{"type":"ping"}';
  it('accepts Stripe’s signature and refuses anything else', () => {
    expect(verifyStripeSignature(body, sign(body), config.webhookSecret, NOW)).toBe(true);
    expect(
      verifyStripeSignature(body, sign(body, NOW, 'whsec_other'), config.webhookSecret, NOW),
    ).toBe(false);
    expect(verifyStripeSignature(`${body} `, sign(body), config.webhookSecret, NOW)).toBe(false);
    expect(verifyStripeSignature(body, null, config.webhookSecret, NOW)).toBe(false);
    expect(verifyStripeSignature(body, 't=1', config.webhookSecret, NOW)).toBe(false);
  });

  it('refuses an old signature (a replay)', () => {
    expect(verifyStripeSignature(body, sign(body, NOW - 301), config.webhookSecret, NOW)).toBe(
      false,
    );
  });
});

describe('a Stripe subscription as ours', () => {
  it('maps the price to the plan and the interval, and the status', () => {
    expect(toSubscriptionRecord(subscription(), config.prices)).toEqual({
      plan: 'voyager',
      interval: 'year',
      status: 'active',
      startedAt: new Date((NOW - 86_400) * 1000),
      currentPeriodEnd: new Date((NOW + 29 * 86_400) * 1000),
      providerCustomerId: 'cus_1',
      providerSubscriptionId: 'sub_1',
    });
    expect(toSubscriptionRecord(subscription({ status: 'unpaid' }), config.prices)?.status).toBe(
      'past_due',
    );
    expect(toSubscriptionRecord(subscription({ status: 'canceled' }), config.prices)?.status).toBe(
      'canceled',
    );
    // A plan bought in reais is the same plan.
    expect(
      toSubscriptionRecord(
        subscription({ items: { data: [{ price: { id: 'price_em_brl' } }] } }),
        config.prices,
      ),
    ).toMatchObject({ plan: 'explorer', interval: 'month' });
  });

  it('reads the period end from the item in newer API shapes, and grants nothing for unknown prices or incomplete', () => {
    const newer = subscription({
      current_period_end: undefined,
      items: { data: [{ price: { id: 'price_em' }, current_period_end: NOW + 100 }] },
    });
    expect(toSubscriptionRecord(newer, config.prices)).toMatchObject({
      plan: 'explorer',
      interval: 'month',
    });
    expect(
      toSubscriptionRecord(
        subscription({ items: { data: [{ price: { id: 'price_x' } }] } }),
        config.prices,
      ),
    ).toBeNull();
    expect(toSubscriptionRecord(subscription({ status: 'incomplete' }), config.prices)).toBeNull();
  });
});

describe('checkout and the portal', () => {
  it('opens a subscription checkout for the plan’s price, tied to the account', async () => {
    const api = stripeApi();
    const payments = createStripePayments(
      config,
      { findProviderCustomer: async () => null },
      { fetch: api.call },
    );
    expect(
      await payments.checkoutUrl({
        userId: 'u-ana',
        email: 'ana@example.com',
        item: 'explorer',
        interval: 'year',
        currency: 'USD',
      }),
    ).toBe('https://checkout.stripe.test/c');
    const sent = new URLSearchParams(api.calls[0]!.body);
    expect(api.calls[0]!.url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(sent.get('mode')).toBe('subscription');
    expect(sent.get('line_items[0][price]')).toBe('price_ey');
    expect(sent.get('client_reference_id')).toBe('u-ana');
    expect(sent.get('subscription_data[metadata][userId]')).toBe('u-ana');
    expect(sent.get('customer_email')).toBe('ana@example.com');
    expect(sent.get('success_url')).toBe('https://globetrot.example/app/plan?paid=explorer');
  });

  it('opens a one-off payment for a top-up, reusing the customer', async () => {
    const api = stripeApi();
    const payments = createStripePayments(
      config,
      { findProviderCustomer: async () => 'cus_9' },
      { fetch: api.call },
    );
    await payments.checkoutUrl({
      userId: 'u-ana',
      email: 'ana@example.com',
      item: 'top-up',
      interval: 'month',
      currency: 'USD',
    });
    const sent = new URLSearchParams(api.calls[0]!.body);
    expect(sent.get('mode')).toBe('payment');
    expect(sent.get('line_items[0][price]')).toBe('price_top');
    expect(sent.get('customer')).toBe('cus_9');
    expect(sent.has('customer_email')).toBe(false);
    expect(await payments.portalUrl({ providerCustomerId: 'cus_9' })).toBe(
      'https://billing.stripe.test/p',
    );
  });

  it('is off without settings', async () => {
    const payments = createStripePayments(null, { findProviderCustomer: async () => null });
    expect(
      await payments.checkoutUrl({
        userId: 'u',
        email: 'e',
        item: 'voyager',
        interval: 'month',
        currency: 'USD',
      }),
    ).toBeNull();
  });

  it('charges a trip pass once, in reais for someone who chose reais, and returns to the trip', async () => {
    const api = stripeApi();
    const payments = createStripePayments(
      config,
      { findProviderCustomer: async () => null },
      { fetch: api.call },
    );
    await payments.checkoutUrl({
      userId: 'u-ana',
      email: 'ana@example.com',
      item: 'trip-pass',
      interval: 'month',
      currency: 'BRL',
      tripId: 'trip-1',
    });
    const sent = new URLSearchParams(api.calls[0]!.body);
    expect(sent.get('mode')).toBe('payment');
    expect(sent.get('line_items[0][price]')).toBe('price_pass_brl');
    expect(sent.get('metadata[tripId]')).toBe('trip-1');
    expect(sent.get('success_url')).toBe(
      'https://globetrot.example/app/trips/trip-1?paid=trip-pass',
    );
    // Payment methods (Pix included) are left to the dashboard; the launch and founder coupons apply here too.
    expect(sent.has('payment_method_types[0]')).toBe(false);
    expect(sent.get('allow_promotion_codes')).toBe('true');
  });

  it('sells the small credit pack only once its Price is set', async () => {
    const api = stripeApi();
    const payments = createStripePayments(
      config,
      { findProviderCustomer: async () => null },
      { fetch: api.call },
    );
    const ask = (currency: 'USD' | 'BRL') =>
      payments.checkoutUrl({
        userId: 'u-ana',
        email: 'ana@example.com',
        item: 'top-up-small',
        interval: 'month',
        currency,
      });
    expect(await ask('USD')).toBeNull();
    expect(api.calls).toHaveLength(0);
    await ask('BRL');
    const sent = new URLSearchParams(api.calls[0]!.body);
    expect(sent.get('mode')).toBe('payment');
    expect(sent.get('line_items[0][price]')).toBe('price_small_brl');
    expect(sent.get('metadata[item]')).toBe('top-up-small');
  });
});

describe('canceling a subscription (#201)', () => {
  /** A Stripe stand-in: answers DELETE and GET with the given statuses and keeps every call. */
  function stripeFor(deleteStatus: number, current: string, getStatus = 200) {
    const calls: string[] = [];
    const call: typeof fetch = async (input, init) => {
      const method = init?.method ?? 'GET';
      calls.push(`${method} ${new URL(String(input)).pathname}`);
      const status = method === 'DELETE' ? deleteStatus : getStatus;
      const body =
        status === 404
          ? { error: { type: 'invalid_request_error', code: 'resource_missing' } }
          : { id: 'sub_1', status: current };
      return new Response(JSON.stringify(body), { status });
    };
    return { calls, call };
  }
  const billing = { findProviderCustomer: async () => null };
  const cancel = (api: ReturnType<typeof stripeFor>) =>
    createStripePayments(config, billing, { fetch: api.call }).cancelSubscription({
      providerSubscriptionId: 'sub_1',
    });

  it('cancels at once with DELETE, with no proration or refund parameters', async () => {
    const api = stripeFor(200, 'canceled');
    await expect(cancel(api)).resolves.toBe('canceled');
    expect(api.calls).toEqual(['DELETE /v1/subscriptions/sub_1']);
  });

  it('counts a subscription already canceled as done (a retry)', async () => {
    const api = stripeFor(400, 'canceled');
    await expect(cancel(api)).resolves.toBe('canceled');
    expect(api.calls).toEqual(['DELETE /v1/subscriptions/sub_1', 'GET /v1/subscriptions/sub_1']);
  });

  it('answers missing when Stripe no longer has the subscription (404 on DELETE)', async () => {
    const api = stripeFor(404, 'active');
    await expect(cancel(api)).resolves.toBe('missing');
    expect(api.calls).toEqual(['DELETE /v1/subscriptions/sub_1']);
  });

  it('answers missing when the follow-up GET is a 404 too', async () => {
    const api = stripeFor(400, 'active', 404);
    await expect(cancel(api)).resolves.toBe('missing');
  });

  it.each([500, 401, 429])('throws for a %i, so nothing gets deleted', async (status) => {
    await expect(cancel(stripeFor(status, 'active'))).rejects.toThrow();
  });

  it('throws when the network fails', async () => {
    const payments = createStripePayments(config, billing, {
      fetch: async () => {
        throw new TypeError('fetch failed');
      },
    });
    await expect(
      payments.cancelSubscription({ providerSubscriptionId: 'sub_1' }),
    ).rejects.toThrow();
  });

  it('does nothing while payments are off, and logs the kind only', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const payments = createStripePayments(null, billing);
    await expect(payments.cancelSubscription({ providerSubscriptionId: 'sub_1' })).resolves.toBe(
      'off',
    );
    expect(warn).toHaveBeenCalledWith(
      'stripe off: a renewing subscription was not canceled when its account was deleted',
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain('sub_1');
    warn.mockRestore();
  });
});

describe('the webhook', () => {
  const ana: UserRecord = {
    id: 'u-ana',
    email: 'ana@example.com',
    name: 'Ana',
    emailVerified: true,
  };
  function setup(answer?: Record<string, unknown>) {
    const fake = createFakePorts({ users: [ana] });
    const api = stripeApi(answer);
    const webhook = createStripeWebhook(config, createPaymentEvents(fake.ports), {
      fetch: api.call,
      now: () => NOW * 1000,
    });
    const send = (event: unknown) => {
      const body = JSON.stringify(event);
      return webhook.handle(body, sign(body));
    };
    return { ...fake, api, webhook, send, app: createApplication(fake.ports) };
  }

  it('records the plan from a completed subscription checkout, reading the subscription from Stripe', async () => {
    const { send, state, api } = setup();
    const status = await send({
      type: 'checkout.session.completed',
      data: {
        object: { mode: 'subscription', subscription: 'sub_1', client_reference_id: 'u-ana' },
      },
    });
    expect(status).toBe(200);
    expect(api.calls[0]!.url).toBe('https://api.stripe.com/v1/subscriptions/sub_1');
    expect(state.subscriptions.get('u-ana')).toMatchObject({ plan: 'voyager', status: 'active' });
  });

  it('follows later changes and failed invoices', async () => {
    const { send, state } = setup(subscription({ status: 'past_due' }));
    await send({
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_1', metadata: { userId: 'u-ana' } } },
    });
    expect(state.subscriptions.get('u-ana')?.status).toBe('past_due');
    expect(
      await send({ type: 'invoice.payment_failed', data: { object: { subscription: 'sub_1' } } }),
    ).toBe(200);
  });

  it('adds top-up credits once, only when paid', async () => {
    const { send, state } = setup();
    const paid = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          mode: 'payment',
          payment_status: 'paid',
          payment_intent: 'pi_1',
          client_reference_id: 'u-ana',
          metadata: { item: 'top-up', userId: 'u-ana' },
        },
      },
    };
    await send(paid);
    await send(paid);
    await send({
      ...paid,
      data: { object: { ...paid.data.object, payment_intent: 'pi_2', payment_status: 'unpaid' } },
    });
    expect(state.credits).toEqual([{ userId: 'u-ana', delta: 200, reason: 'top-up', ref: 'pi_1' }]);
  });

  it('adds the small pack’s 50 credits', async () => {
    const { send, state } = setup();
    await send({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_3',
          mode: 'payment',
          payment_status: 'paid',
          payment_intent: 'pi_small',
          client_reference_id: 'u-ana',
          metadata: { item: 'top-up-small', userId: 'u-ana' },
        },
      },
    });
    expect(state.credits).toEqual([
      { userId: 'u-ana', delta: 50, reason: 'top-up', ref: 'pi_small' },
    ]);
  });

  it('grants a trip pass when a Pix payment clears later, once', async () => {
    const { send, state, app } = setup();
    const trip = await app.createTrip.execute(
      { kind: 'user', userId: 'u-ana' },
      { title: 'Lisbon', startDate: null },
    );
    const cleared = {
      type: 'checkout.session.async_payment_succeeded',
      data: {
        object: {
          id: 'cs_2',
          mode: 'payment',
          payment_status: 'paid',
          payment_intent: 'pi_pix',
          client_reference_id: 'u-ana',
          metadata: { item: 'trip-pass', userId: 'u-ana', tripId: trip.id },
        },
      },
    };
    expect(await send(cleared)).toBe(200);
    expect(await send(cleared)).toBe(200);
    expect(state.passes.map((pass) => [pass.tripId, pass.providerRef])).toEqual([
      [trip.id, 'pi_pix'],
    ]);
    // The pass brings 50 Pip credits, once per payment.
    expect(state.credits).toEqual([
      { userId: 'u-ana', delta: 50, reason: 'grant', ref: 'trip-pass:pi_pix' },
    ]);
  });

  it('refuses a bad signature, ignores other events, and asks Stripe to retry when it cannot read', async () => {
    const { webhook, send } = setup();
    expect(await webhook.handle('{"type":"x"}', 't=1,v1=00')).toBe(400);
    expect(await send({ type: 'customer.created', data: { object: {} } })).toBe(200);
    const failing = createStripeWebhook(
      config,
      createPaymentEvents(createFakePorts({ users: [ana] }).ports),
      {
        fetch: async () => new Response('{}', { status: 500 }),
        now: () => NOW * 1000,
      },
    );
    const body = JSON.stringify({
      type: 'invoice.paid',
      data: { object: { subscription: 'sub_1' } },
    });
    expect(await failing.handle(body, sign(body))).toBe(500);
  });
});
