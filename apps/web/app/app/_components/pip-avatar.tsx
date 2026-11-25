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
import { moodOfPose, PipPoseProps, type PipPose } from './pip-pose';
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
  return {
    back: matrix(frame.root),
    face: matrix(face),
    front: `${matrix(frame.root)} ${matrix(face)}`,
  };
}

/*
 * Pip is the globe: dotted continents (like the landing's halftone world) painted on the body, around the face so
 * they never cover the eyes. They move with the face, so the globe seems to turn towards whatever Pip looks at,
 * and are clipped to the body.
 */
/** Two parallels and two meridians, wide of the eyes: the lines that say "globe" at a glance. */
const GRID = [
  'M20.5 45 Q48 51.5 75.5 45',
  'M20 75 Q48 83 76 75',
  'M48 31 Q13 60 48 89',
  'M48 31 Q83 60 48 89',
];
const LAND = [
  // North America and Greenland, top left
  'M21 50 C20 41 27 33 37 31 C44 30 50 32 49 37 C48 41 43 41 40 44 C38 47 33 48 30 47 C27 49 24 51 21 50Z',
  'M49 31.5 C52 30 56 31 56 34 C56 37 52 38 50 37 C48 36 47.5 33 49 31.5Z',
  // Europe and Asia, top right
  'M57 34 C63 31 72 34 76 42 C78 47 75 50 71 48 C68 47 66 47.5 63 46.5 C59 45 55 41 57 34Z',
  // South America, left edge
  'M20 55 C24 52 29 54 28.5 60 C28 67 26 73 23 78 C20 73 18.5 63 20 55Z',
  // Africa, right edge
  'M69.5 50 C75 49 78.5 54 78 61 C77.5 68 73 73 70.5 71 C68.5 66 68.5 56 69.5 50Z',
  // Australia, islands and the ice at the bottom
  'M51 77 C56 74 63 75 64 80 C65 85 59 88 54 87 C49 86 47 81 51 77Z',
  'M37 79 a2.2 2.2 0 1 0 0.1 0Z',
  'M42 84 a1.6 1.6 0 1 0 0.1 0Z',
  'M28 86 C38 91 58 92 68 86 L68 96 L28 96Z',
];

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
  pose = 'idle',
  mood: moodProp,
  followPointer = false,
  still = false,
  bare = false,
  className,
}: {
  size?: number;
  look?: PipLook;
  /** One of the six states of the character brief; it also sets the mood unless `mood` is given. */
  pose?: PipPose;
  mood?: PipMood;
  followPointer?: boolean;
  still?: boolean;
  /** Just the globe: no hat, outfit or bag (the landing and onboarding show Pip as itself). */
  bare?: boolean;
  className?: string;
}) {
  // A page may dress Pip itself; otherwise it wears the person's own look (or the default outside the app).
  const saved = usePipLook();
  const mood = moodProp ?? moodOfPose(pose);
  const look = lookProp ?? saved.look;
  const clip = `pip-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const host = useRef<HTMLSpanElement>(null);
  const back = useRef<SVGGElement>(null);
  const front = useRef<SVGGElement>(null);
  const globe = useRef<SVGGElement>(null);
  const globeFace = useRef<SVGGElement>(null);
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
        globe.current?.setAttribute('transform', next.back);
        globeFace.current?.setAttribute('transform', next.face);
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
      {size >= 40 && !bare ? (
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
      <svg className={`${styles.layer} ${styles.globe}`} viewBox="0 0 100 100">
        <defs>
          <pattern id={`${clip}-dots`} width="3.2" height="3.2" patternUnits="userSpaceOnUse">
            <circle cx="1.6" cy="1.6" r="1.25" fill="#BFDBFE" />
          </pattern>
          <clipPath id={`${clip}-body`}>
            <circle cx="48" cy="60" r="28.6" />
          </clipPath>
        </defs>
        <g ref={globe} transform={at.back}>
          <g clipPath={`url(#${clip}-body)`}>
            <g ref={globeFace} transform={at.face} fill={`url(#${clip}-dots)`}>
              {LAND.map((d) => (
                <path key={d} d={d} />
              ))}
              <g className={styles.grid}>
                {GRID.map((d) => (
                  <path key={d} d={d} />
                ))}
              </g>
            </g>
          </g>
        </g>
      </svg>
      {bare ? null : (
        <svg className={`${styles.layer} ${styles.front}`} viewBox="0 0 100 100">
          <g ref={front} transform={at.front}>
            <g transform={FROM_HANDOFF}>
              <defs>
                <clipPath id={clip}>
                  <circle cx="105" cy="118" r="62" />
                </clipPath>
              </defs>
              <g clipPath={`url(#${clip})`}>
                <Outfit kind={look.outfit} />
              </g>
              {look.outfit === 'scarf' ? (
                <g fill="#EF4444" stroke={INK} strokeWidth="2.5" strokeLinejoin="round">
                  <path d="M136 152 L139 188 L150 186 L146 151Z" />
                  <path d="M143 151 L153 182 L163 177 L151 149Z" />
                  <circle cx="142" cy="150" r="6.5" />
                </g>
              ) : null}
              <g transform="rotate(-7 105 64)">
                <Hat kind={look.hat} />
              </g>
            </g>
          </g>
        </svg>
      )}
      {size >= 40 && pose !== 'idle' ? (
        <svg className={styles.pose} viewBox="0 0 100 100" data-pose={pose}>
          <PipPoseProps pose={pose} />
        </svg>
      ) : null}
    </span>
  );
}

/*
 * Outfits, worn on the globe (handoff box: centre 105,118, radius 58). Each garment hugs the lower half of the body:
 * a curved neckline on top and an arc a hair outside the body below, so it reads as clothing, not a stripe.
 */
const R = 59;
/** The two points where a garment's neckline at height `y` meets the body's outline. */
const edge = (y: number) => {
  const dx = Math.sqrt(R * R - (y - 118) ** 2);
  return [+(105 - dx).toFixed(2), +(105 + dx).toFixed(2)] as const;
};
/** A garment from a neckline at `y` (sagging `sag` in the middle) down to the bottom of the body. */
const garment = (y: number, sag: number) => {
  const [left, right] = edge(y);
  return `M${left} ${y} Q105 ${y + sag} ${right} ${y} A${R} ${R} 0 0 1 ${left} ${y}Z`;
};
const bottomY = (x: number) => +(118 + Math.sqrt(R * R - (x - 105) ** 2)).toFixed(2);

function Outfit({ kind }: { kind: PipLook['outfit'] }) {
  if (kind === 'scarf') {
    const [l1, r1] = edge(134);
    const [l2, r2] = edge(149);
    return (
      <g strokeLinejoin="round">
        <path
          d={`M${l1} 134 Q105 151 ${r1} 134 A${R} ${R} 0 0 1 ${r2} 149 Q105 167 ${l2} 149 A${R} ${R} 0 0 1 ${l1} 134Z`}
          fill="#EF4444"
          stroke={INK}
          strokeWidth="2.5"
        />
        <path
          d="M64 143 Q105 160 146 143"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeDasharray="7 9"
          strokeLinecap="round"
          opacity=".75"
        />
      </g>
    );
  }
  if (kind === 'aloha')
    return (
      <g strokeLinejoin="round">
        <path d={garment(140, 18)} fill="#F59E0B" stroke={INK} strokeWidth="2.5" />
        {[
          [72, 153],
          [86, 165],
          [124, 165],
          [138, 153],
          [105, 172],
        ].map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r="4.5" fill="#FFFFFF" />
            <circle cx={x} cy={y} r="1.8" fill="#EC4899" />
          </g>
        ))}
        <path
          d="M89 148 L105 164 L121 148 L113 146 L105 156 L97 146Z"
          fill="#FEF3C7"
          stroke={INK}
          strokeWidth="2.2"
        />
      </g>
    );
  if (kind === 'vest') {
    const [left, right] = edge(139);
    return (
      <g strokeLinejoin="round">
        {/* the shirt under the vest */}
        <path d={garment(140, 16)} fill="#F8FAFC" stroke={INK} strokeWidth="2.2" />
        <path d="M93 151 L105 160 L100 166Z M117 151 L105 160 L110 166Z" fill="#E2E8F0" />
        <path
          d={`M${left} 139 Q72 149 92 151 L101 ${bottomY(101)} A${R} ${R} 0 0 1 ${left} 139Z`}
          fill="#B08654"
          stroke={INK}
          strokeWidth="2.5"
        />
        <path
          d={`M${right} 139 Q138 149 118 151 L109 ${bottomY(109)} A${R} ${R} 0 0 0 ${right} 139Z`}
          fill="#B08654"
          stroke={INK}
          strokeWidth="2.5"
        />
        <rect
          x="64"
          y="153"
          width="14"
          height="9"
          rx="2.5"
          fill="#8A6A42"
          stroke={INK}
          strokeWidth="1.8"
        />
        <rect
          x="132"
          y="153"
          width="14"
          height="9"
          rx="2.5"
          fill="#8A6A42"
          stroke={INK}
          strokeWidth="1.8"
        />
        <circle cx="96" cy="161" r="1.8" fill="#3F2A14" />
        <circle cx="98.5" cy="169" r="1.8" fill="#3F2A14" />
      </g>
    );
  }
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
