import type { ReactNode } from 'react';
import { SignedInFrame } from '../app/_components/signed-in-frame';

// Depends on the visitor's cookies, so it is rendered per request.
export const dynamic = 'force-dynamic';

/** The account's settings live in the same shell as the rest of the signed-in app. */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <SignedInFrame returnTo="/settings">{children}</SignedInFrame>;
}
