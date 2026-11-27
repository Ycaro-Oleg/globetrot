'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type { PipAvatar } from './pip-avatar';

type Props = ComponentProps<typeof PipAvatar>;

const Live = dynamic(() => import('./pip-avatar').then((module) => module.PipAvatar), {
  ssr: false,
});

/**
 * Pip for pages where the first load must stay light (the landing): the avatar runtime arrives after the page is
 * interactive. The box keeps Pip's size meanwhile, so nothing moves when it appears.
 */
export function LazyPipAvatar({ className, ...props }: Props) {
  const size = props.size ?? 96;
  return (
    <span
      className={className}
      style={{ display: 'inline-block', flex: 'none', width: size, height: size }}
      aria-hidden="true"
    >
      <Live {...props} />
    </span>
  );
}
