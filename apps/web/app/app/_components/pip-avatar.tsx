'use client';

import { renderAvatarSvg, type AvatarDefinition } from 'open-bot-avatar';
import { mountAvatar, type MountedAvatar } from 'open-bot-avatar/dom';
import { useEffect, useRef } from 'react';
import styles from './pip-avatar.module.css';

/**
 * Pip as an open-bot-avatar definition: a round globe wearing a tourist hat, in a 0..100 box. One silhouette, so
 * it reads from a 24 px button to the 190 px celebration. Colours are the brand's airmail blue with cream eyes.
 */
export const PIP_AVATAR: AvatarDefinition = {
  version: 1,
  id: 'pip',
  name: 'Pip',
  body: {
    path: 'M19 61 A31 31 0 1 1 81 61 A31 31 0 1 1 19 61 Z M38 30 L40 15 C40 12 42 11 45 11 H55 C58 11 60 12 60 15 L62 30 Z M24 27 H76 A4 4 0 0 1 76 35 H24 A4 4 0 0 1 24 35 Z',
  },
  eyes: { x: 50, y: 62, spacing: 17, scale: 1.15 },
};

export const PIP_COLORS = { color: '#2B45C4', eyeColor: '#FFF5E1' } as const;

export type PipMood = 'idle' | 'thinking' | 'happy';

function reducedMotion(): boolean | 'system' {
  return document.documentElement.dataset.motion === 'reduced' ? true : 'system';
}

/**
 * Pip's avatar. It is decorative (hidden from assistive technology): the text next to it always says what is
 * going on. The server renders a still frame; in the browser a live avatar (blinks, idle motion, mood, optional
 * gaze) replaces it, unless `still` is set. Reduced motion (the app's setting or the system's) keeps it calm.
 */
export function PipAvatar({
  size = 96,
  mood = 'idle',
  followPointer = false,
  still = false,
  className,
}: {
  size?: number;
  mood?: PipMood;
  followPointer?: boolean;
  still?: boolean;
  className?: string;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const avatar = useRef<MountedAvatar | null>(null);
  const frame = renderAvatarSvg(PIP_AVATAR, { ...PIP_COLORS, size, motion: mood });

  useEffect(() => {
    const element = host.current;
    if (still || !element) return;
    try {
      avatar.current = mountAvatar(element, {
        definition: PIP_AVATAR,
        ...PIP_COLORS,
        mood,
        followPointer,
        reducedMotion: reducedMotion(),
        label: '',
      });
      element.dataset.live = '';
    } catch {
      // No canvas or an old browser: the still frame stays.
    }
    return () => {
      avatar.current?.destroy();
      avatar.current = null;
      delete element.dataset.live;
    };
    // Mount once per still/live switch; mood and gaze are updated below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still]);

  useEffect(() => {
    avatar.current?.update({ mood, followPointer });
  }, [mood, followPointer]);

  return (
    <span
      className={[styles.pip, className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {still ? null : <span ref={host} className={styles.live} />}
      <span className={styles.still} dangerouslySetInnerHTML={{ __html: frame }} />
    </span>
  );
}
