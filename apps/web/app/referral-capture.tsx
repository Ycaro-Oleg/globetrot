'use client';

import { useEffect } from 'react';
import { isReferralCode, REFERRAL_COOKIE, REFERRAL_DAYS } from '../lib/referral';

/**
 * Keeps the code of a referral link (`?ref=`) for 30 days, so a person who signs up later still counts for the
 * friend who sent them (ADR-0029). Only the code is kept, nothing about the visitor.
 */
export function ReferralCapture() {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('ref');
    if (!isReferralCode(code)) return;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${REFERRAL_COOKIE}=${code}; Max-Age=${REFERRAL_DAYS * 86_400}; Path=/; SameSite=Lax${secure}`;
  }, []);
  return null;
}
