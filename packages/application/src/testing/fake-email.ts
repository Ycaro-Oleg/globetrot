import type { EmailMessage, EmailPort } from '../email/templates';

export interface FakeEmail {
  readonly port: EmailPort;
  /** Every message handed to the port, oldest first. */
  readonly sent: EmailMessage[];
  /** Makes the next sends fail, like an SMTP server that is down. */
  fail(error?: Error): void;
}

/** A recording `EmailPort` for tests that need to see what would have been sent. */
export function createFakeEmail(): FakeEmail {
  const sent: EmailMessage[] = [];
  let failure: Error | undefined;
  return {
    sent,
    fail(error = new Error('SMTP is down')) {
      failure = error;
    },
    port: {
      async send(message) {
        if (failure) throw failure;
        sent.push(message);
      },
    },
  };
}
