'use client';

import { DEFAULT_PIP_LOOK, type PipLook } from '@globetrot/domain';
import { createContext, useContext, type ReactNode } from 'react';

/** The signed-in person's own Pip ("Meu Pip"): every Pip in the app wears it unless a page dresses one itself. */
const PipLookContext = createContext<{ look: PipLook; name: string | null }>({
  look: DEFAULT_PIP_LOOK,
  name: null,
});

export function PipLookProvider({
  look,
  name,
  children,
}: {
  look: PipLook;
  name: string | null;
  children: ReactNode;
}) {
  return <PipLookContext.Provider value={{ look, name }}>{children}</PipLookContext.Provider>;
}

export function usePipLook() {
  return useContext(PipLookContext);
}
