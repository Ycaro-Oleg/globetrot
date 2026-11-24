import type { ReactNode } from 'react';
import { SignedInFrame } from './_components/signed-in-frame';

// Depends on the visitor's cookies, so it is rendered per request.
export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: ReactNode }) {
  return <SignedInFrame returnTo="/app">{children}</SignedInFrame>;
}
