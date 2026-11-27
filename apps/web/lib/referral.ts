/** Where a referral code waits between the visit (`?ref=`) and the new account's first signed-in page. */
export const REFERRAL_COOKIE = 'globetrot.ref';
/** How long a visit through a link counts. */
export const REFERRAL_DAYS = 30;

export const isReferralCode = (value: string | null | undefined): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9]{6,12}$/.test(value);
