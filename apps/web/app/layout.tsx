import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SITE_NAME } from './site';

export const metadata: Metadata = {
  title: SITE_NAME,
};

// The locale becomes dynamic with @globetrot/i18n (M3).
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
