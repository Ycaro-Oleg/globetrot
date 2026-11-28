import { randomBytes } from 'node:crypto';

/**
 * A tiny client for Mailpit's HTTP API, for integration tests that read the mail the API really sent over SMTP.
 * Start it with `pnpm services:up` (CI runs it as a service). Every test uses its own random address, so tests
 * never see each other's mail and nothing has to be cleaned up.
 */
const BASE = process.env.MAILPIT_URL ?? `http://localhost:${process.env.MAILPIT_UI_PORT ?? '8025'}`;

export interface Mail {
  readonly id: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  readonly from: string;
  readonly to: string[];
}

export const randomAddress = (prefix: string) =>
  `${prefix}-${randomBytes(5).toString('hex')}@example.test`;

async function api<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`);
  } catch {
    throw new Error(`Mailpit is not reachable at ${BASE}. Start it with "pnpm services:up".`);
  }
  if (!response.ok) throw new Error(`Mailpit answered ${response.status} for ${path}`);
  return (await response.json()) as T;
}

/** Every message sent to `address` so far, oldest first. */
export async function mailsFor(address: string): Promise<Mail[]> {
  const found = await api<{ messages: { ID: string; Created: string }[] | null }>(
    `/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`,
  );
  const created = new Map((found.messages ?? []).map((message) => [message.ID, message.Created]));
  const messages = await Promise.all(
    (found.messages ?? []).map((message) =>
      api<{
        ID: string;
        Subject: string;
        Text: string;
        HTML: string;
        From: { Address: string; Name: string };
        To: { Address: string }[];
      }>(`/api/v1/message/${message.ID}`),
    ),
  );
  return messages
    .map((message) => ({
      created: created.get(message.ID) ?? '',
      mail: {
        id: message.ID,
        subject: message.Subject,
        text: message.Text,
        html: message.HTML,
        from: `${message.From.Name} <${message.From.Address}>`,
        to: message.To.map((to) => to.Address),
      },
    }))
    .sort((a, b) => a.created.localeCompare(b.created))
    .map((entry) => entry.mail);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Waits until `count` messages have arrived for `address` (delivery happens in the background). */
export async function waitForMails(
  address: string,
  count = 1,
  timeoutMs = 10_000,
): Promise<Mail[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const mails = await mailsFor(address);
    if (mails.length >= count) return mails;
    if (Date.now() > deadline) {
      throw new Error(
        `Expected ${count} email(s) for ${address}, found ${mails.length} after ${timeoutMs} ms`,
      );
    }
    await sleep(100);
  }
}

/** Gives delivery time to happen, then asserts nothing arrived. */
export async function mailsAfterWaiting(address: string, waitMs = 1500): Promise<Mail[]> {
  await sleep(waitMs);
  return mailsFor(address);
}

/** A message's headers, as Mailpit reports them (each name with its values). */
export async function headersOf(id: string): Promise<Record<string, string[]>> {
  return api<Record<string, string[]>>(`/api/v1/message/${id}/headers`);
}

/** The first http(s) link in a plain-text email. */
export function linkIn(text: string): string {
  const match = /https?:\/\/[^\s"<>]+/.exec(text);
  if (!match) throw new Error('No link in the email');
  return match[0];
}

/** The path and query of a link, to call the app in-process: `http://x/api/auth/verify-email?t=1` -> `/api/auth/...`. */
export const pathOf = (link: string) => {
  const url = new URL(link);
  return `${url.pathname}${url.search}`;
};
