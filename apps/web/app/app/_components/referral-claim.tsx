'use client';

import { useEffect } from 'react';
import { REFERRAL_COOKIE } from '../../../lib/referral';
import { claimKeptReferral } from './referral-actions';

/** On a signed-in page, hands a kept referral code to the account once (ADR-0029). */
export function ReferralClaim() {
  useEffect(() => {
    if (document.cookie.split('; ').some((part) => part.startsWith(`${REFERRAL_COOKIE}=`))) {
      void claimKeptReferral();
    }
  }, []);
  return null;
}
