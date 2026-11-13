'use client';

import type { PipLook } from '@globetrot/domain';
import {
  avatarFrame,
  createAnimator,
  pointerGaze,
  renderAvatarSvg,
  type AvatarDefinition,
  type AvatarFrame,
  type Matrix,
} from 'open-bot-avatar';
import { mountAvatar, subscribeFrames, type MountedAvatar } from 'open-bot-avatar/dom';
import { useEffect, useId, useRef } from 'react';
import { usePipLook } from './pip-look';
import styles from './pip-avatar.module.css';

/**
 * Pip's body as an open-bot-avatar definition: a round globe in a 0..100 box, low enough to leave room for a hat
 * and beside it a bag. The runtime gives it volume, blinking, moods and gaze; the look (hat, outfit, bag) is drawn
 * over it and follows the same motion every frame.
 */
export const PIP_AVATAR: AvatarDefinition = {
  version: 1,
  id: 'pip',
  name: 'Pip',
  body: { path: 'M19 60 A29 29 0 1 1 77 60 A29 29 0 1 1 19 60 Z' },
  eyes: { x: 48, y: 60, spacing: 16, scale: 1.1 },
};

export const PIP_COLORS = { color: '#2B45C4', eyeColor: '#FFF5E1' } as const;

export type PipMood = 'idle' | 'thinking' | 'happy';

const INK = '#1E293B';
const BAG_COLORS: Record<PipLook['bagColor'], [string, string]> = {
  amber: ['#F59E0B', '#B45309'],
  cyan: ['#06B6D4', '#0E7490'],
  pink: ['#EC4899', '#BE185D'],
};
/** The handoff draws Pip in a 220×230 box with the globe at (105, 118), radius 58: map it onto this globe. */
const FROM_HANDOFF = 'translate(-4.5 1) scale(.5)';
const BAG_FROM_HANDOFF = 'translate(-6 -12) scale(.5)';
/** Same as the live renderer: small avatars redraw at 30 frames a second. */
const SMALL_SIZE = 128;
const SMALL_STEP = 1 / 30 - 0.004;

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const matrix = (m: Matrix) => `matrix(${m.map((n) => +n.toFixed(4)).join(' ')})`;

/** Where the look sits in a frame: the bag moves with the body, outfit and hat with the face. */
function placement(frame: AvatarFrame) {
  const face = frame.shapes.find((shape) => shape.kind === 'eye')?.matrix ?? IDENTITY;
  return { back: matrix(frame.root), front: `${matrix(frame.root)} ${matrix(face)}` };
}

function reducedMotion(): boolean {
  return (
    document.documentElement.dataset.motion === 'reduced' ||
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Pip's avatar, dressed in the person's look. Decorative (hidden from assistive technology): the text next to it
 * always says what is going on. The server renders a still frame; in the browser the live avatar replaces it,
 * unless `still` is set. Reduced motion (the app's setting or the system's) keeps it calm.
 */
export function PipAvatar({
  size = 96,
  look: lookProp,
  mood = 'idle',
  followPointer = false,
  still = false,
  className,
}: {
  size?: number;
  look?: PipLook;
  mood?: PipMood;
  followPointer?: boolean;
  still?: boolean;
  className?: string;
}) {
  // A page may dress Pip itself; otherwise it wears the person's own look (or the default outside the app).
  const saved = usePipLook();
  const look = lookProp ?? saved.look;
  const clip = `pip-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const host = useRef<HTMLSpanElement>(null);
  const back = useRef<SVGGElement>(null);
  const front = useRef<SVGGElement>(null);
  const avatar = useRef<MountedAvatar | null>(null);
  const settings = useRef({ mood, followPointer });
  useEffect(() => {
    settings.current = { mood, followPointer };
    avatar.current?.update({ mood, followPointer });
  }, [mood, followPointer]);

  const rest = avatarFrame(PIP_AVATAR, { motion: mood, reducedMotion: true });
  const at = placement(rest);
  const body = renderAvatarSvg(PIP_AVATAR, {
    ...PIP_COLORS,
    size,
    motion: mood,
    reducedMotion: true,
  });
  const [bag, bagDark] = BAG_COLORS[look.bagColor];

  useEffect(() => {
    const element = host.current;
    if (still || !element) return;
    const reduced = reducedMotion();
    try {
      avatar.current = mountAvatar(element, {
        definition: PIP_AVATAR,
        ...PIP_COLORS,
        mood: settings.current.mood,
        followPointer: settings.current.followPointer,
        reducedMotion: reduced,
        label: '',
      });
      element.dataset.live = '';
    } catch {
      return; // No canvas or an old browser: the still frame stays.
    }

    // The look follows the body: same clock, same gaze easing, same frame maths as the live renderer.
    const animator = createAnimator();
    let box: DOMRect | null = null;
    const unsubscribe = subscribeFrames({
      measure: () => {
        box = settings.current.followPointer ? element.getBoundingClientRect() : null;
      },
      draw: (time, pointer) => {
        const { mood: motion, followPointer: follow } = settings.current;
        const target =
          follow && pointer && box && box.width > 0
            ? pointerGaze(pointer, box, { x: 0.48, y: 0.6 })
            : null;
        const step = animator.step({
          now: performance.now(),
          motion,
          target,
          reducedMotion: reduced,
        });
        const frame = avatarFrame(PIP_AVATAR, {
          time,
          motion,
          reducedMotion: reduced,
          ...(step.motionBlend ? { motionBlend: step.motionBlend } : {}),
          ...(step.gaze ? { gaze: step.gaze } : {}),
        });
        const next = placement(frame);
        back.current?.setAttribute('transform', next.back);
        front.current?.setAttribute('transform', next.front);
        const more = !reduced || step.moving;
        return more && size < SMALL_SIZE ? SMALL_STEP : more;
      },
    });
    return () => {
      unsubscribe();
      avatar.current?.destroy();
      avatar.current = null;
      delete element.dataset.live;
    };
  }, [still, size]);

  return (
    <span
      className={[styles.pip, className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {size >= 40 ? (
        <svg className={styles.layer} viewBox="0 0 100 100">
          <g ref={back} transform={at.back}>
            <g transform={BAG_FROM_HANDOFF}>
              <Bag kind={look.bag} color={bag} dark={bagDark} />
            </g>
          </g>
        </svg>
      ) : null}
      {still ? null : <span ref={host} className={styles.live} />}
      <span className={styles.still} dangerouslySetInnerHTML={{ __html: body }} />
      <svg className={styles.layer} viewBox="0 0 100 100">
        <g ref={front} transform={at.front}>
          <g transform={FROM_HANDOFF}>
            <defs>
              <clipPath id={clip}>
                <circle cx="105" cy="118" r="55" />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clip})`}>
              <Outfit kind={look.outfit} />
            </g>
            {look.outfit === 'scarf' ? (
              <path
                d="M134 156 L144 186 L156 182 L146 154Z"
                fill="#EF4444"
                stroke={INK}
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            ) : null}
            <g transform="rotate(-7 105 64)">
              <Hat kind={look.hat} />
            </g>
          </g>
        </g>
      </svg>
    </span>
  );
}

/** Outfits, from the handoff's Pip, clipped to the globe. */
function Outfit({ kind }: { kind: PipLook['outfit'] }) {
  if (kind === 'scarf')
    return (
      <g>
        <rect x="40" y="146" width="130" height="15" fill="#EF4444" />
        {[62, 86, 110, 134].map((x) => (
          <rect key={x} x={x} y="146" width="7" height="15" fill="#FFFFFF" opacity=".7" />
        ))}
        <path d="M40 146 H170 M40 161 H170" stroke={INK} strokeWidth="2.5" />
      </g>
    );
  if (kind === 'aloha')
    return (
      <g>
        <rect x="40" y="148" width="130" height="40" fill="#F59E0B" />
        {[
          [66, 164],
          [98, 176],
          [132, 162],
          [152, 178],
        ].map(([x, y]) => (
          <g key={x}>
            <circle cx={x} cy={y} r="5" fill="#FFFFFF" />
            <circle cx={x} cy={y} r="2" fill="#EC4899" />
          </g>
        ))}
        <path d="M40 148 H170" stroke={INK} strokeWidth="2.5" />
        <path
          d="M89 148 L105 166 L121 148Z"
          fill="#FEF3C7"
          stroke={INK}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </g>
    );
  if (kind === 'vest')
    return (
      <g>
        <path d="M40 140 H91 V192 H40Z" fill="#B08654" />
        <path d="M119 140 H170 V192 H119Z" fill="#B08654" />
        <path
          d="M91 140 V192 M119 140 V192 M40 140 H91 M119 140 H170"
          stroke={INK}
          strokeWidth="2.5"
        />
        <rect
          x="62"
          y="158"
          width="20"
          height="15"
          rx="3"
          fill="#8A6A42"
          stroke={INK}
          strokeWidth="2"
        />
        <rect
          x="128"
          y="158"
          width="20"
          height="15"
          rx="3"
          fill="#8A6A42"
          stroke={INK}
          strokeWidth="2"
        />
      </g>
    );
  return null;
}

function Hat({ kind }: { kind: PipLook['hat'] }) {
  if (kind === 'straw')
    return (
      <g>
        <ellipse cx="105" cy="66" rx="56" ry="12" fill="#FDE68A" stroke={INK} strokeWidth="3" />
        <path
          d="M79 66 Q80 38 105 36 Q130 38 131 66Z"
          fill="#FCD34D"
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M79.5 57 Q105 63 130.5 57 L131 66 Q105 72 79 66Z"
          fill="#2563EB"
          stroke={INK}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </g>
    );
  if (kind === 'helmet')
    return (
      <g>
        <ellipse cx="105" cy="68" rx="50" ry="10" fill="#E7D7B5" stroke={INK} strokeWidth="3" />
        <path
          d="M67 68 Q68 30 105 28 Q142 30 143 68Z"
          fill="#F1E4C6"
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M67.5 60 Q105 66 142.5 60 L143 68 Q105 74 67 68Z"
          fill="#8A6A42"
          stroke={INK}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <circle cx="105" cy="28" r="4" fill="#8A6A42" stroke={INK} strokeWidth="2" />
      </g>
    );
  if (kind === 'cap')
    return (
      <g>
        <path
          d="M120 64 Q152 58 170 70 Q150 80 120 72Z"
          fill="#B91C1C"
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M70 70 Q71 36 105 34 Q139 36 140 70 Q105 64 70 70Z"
          fill="#DC2626"
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M105 35 V66" stroke={INK} strokeWidth="2" opacity=".5" />
        <circle cx="105" cy="34" r="4" fill="#DC2626" stroke={INK} strokeWidth="2" />
        <circle cx="88" cy="54" r="7" fill="#F8F9FA" stroke={INK} strokeWidth="2" />
        <path d="M85 54 H91" stroke="#2563EB" strokeWidth="2.5" />
      </g>
    );
  return null;
}

/** Bags, from the handoff's Pip, standing beside the globe. */
function Bag({ kind, color, dark }: { kind: PipLook['bag']; color: string; dark: string }) {
  if (kind === 'backpack')
    return (
      <g>
        <path
          d="M164 164 Q173 150 182 164"
          stroke={INK}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        <rect
          x="151"
          y="162"
          width="44"
          height="48"
          rx="15"
          fill={color}
          stroke={INK}
          strokeWidth="3.5"
        />
        <path d="M151 182 Q173 172 195 182" stroke={INK} strokeWidth="3" fill="none" />
        <rect
          x="160"
          y="188"
          width="26"
          height="16"
          rx="5"
          fill={dark}
          stroke={INK}
          strokeWidth="2.5"
        />
        <circle cx="173" cy="180" r="2.5" fill={INK} />
      </g>
    );
  if (kind === 'vintage')
    return (
      <g>
        <path
          d="M164 168 Q173 154 182 168"
          stroke={INK}
          strokeWidth="4.5"
          fill="none"
          strokeLinecap="round"
        />
        <rect
          x="146"
          y="168"
          width="54"
          height="38"
          rx="6"
          fill={color}
          stroke={INK}
          strokeWidth="3.5"
        />
        <rect x="156" y="168" width="7" height="38" fill={dark} />
        <rect x="183" y="168" width="7" height="38" fill={dark} />
        <circle cx="174" cy="184" r="6" fill="#F8F9FA" stroke={INK} strokeWidth="2" />
        <path d="M171 184 L177 184 M174 181 L174 187" stroke="#2563EB" strokeWidth="2" />
        <rect
          x="150"
          y="194"
          width="12"
          height="7"
          rx="2"
          fill="#F8F9FA"
          stroke={INK}
          strokeWidth="1.5"
        />
      </g>
    );
  return (
    <g>
      <path
        d="M166 166 V150 M180 166 V150"
        stroke="#475569"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path d="M163 150 H183" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <rect
        x="150"
        y="166"
        width="46"
        height="44"
        rx="9"
        fill={color}
        stroke={INK}
        strokeWidth="3.5"
      />
      <path
        d="M163 172 V204 M173 172 V204 M183 172 V204"
        stroke={dark}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="159" cy="213" r="4.5" fill={INK} />
      <circle cx="187" cy="213" r="4.5" fill={INK} />
    </g>
  );
}
