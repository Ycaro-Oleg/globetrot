/**
 * The props of Pip's six states from the character brief (docs/design/pip-character.md), drawn in the avatar's
 * 0..100 box in front of the globe: nothing for `idle`, a map for `research`, postcards for `draft`, a paper plane
 * for `deliver`, a raised stamp with confetti for `celebrate`, a question bubble for `unsure`. No words, flags or
 * prices; props are cues, never a claim that something real happened. Motion is CSS and stops under reduced motion.
 */
import styles from './pip-avatar.module.css';

export const PIP_POSES = ['idle', 'research', 'draft', 'deliver', 'celebrate', 'unsure'] as const;
export type PipPose = (typeof PIP_POSES)[number];

const INK = '#1E293B';
const NOTE = '#FFE08A';
const CREAM = '#FFF5E1';
const RED = '#E0401F';
const MARIGOLD = '#F5B31C';
const MINT = '#9AD8BF';
const BLUE = '#2B45C4';

const line = {
  stroke: INK,
  strokeWidth: 1.4,
  strokeLinejoin: 'round' as const,
  strokeLinecap: 'round' as const,
};

export function PipPoseProps({ pose }: { pose: PipPose }) {
  if (pose === 'research')
    return (
      <g className={styles.wobble} style={{ transformOrigin: '22px 82px' }}>
        {/* A folded map held up in front of the globe, a dashed route and a pin on it. */}
        <path d="M6 72 L16 69 L26 72 L36 69 L36 90 L26 93 L16 90 L6 93 Z" fill={NOTE} {...line} />
        <path d="M16 69 V90 M26 72 V93" stroke={INK} strokeWidth="0.9" opacity=".45" />
        <path
          d="M9 87 Q15 79 21 83 T33 75"
          fill="none"
          stroke={RED}
          strokeWidth="1.4"
          strokeDasharray="2.2 1.8"
          strokeLinecap="round"
        />
        <circle cx="33" cy="75" r="2.2" fill={RED} stroke={INK} strokeWidth="0.9" />
      </g>
    );
  if (pose === 'draft')
    return (
      <g className={styles.wobble} style={{ transformOrigin: '20px 88px' }}>
        {/* Three postcards fanned out, the top one with a stamp corner. */}
        {[
          [-16, '#FFFFFF'],
          [-4, CREAM],
          [8, '#FFFFFF'],
        ].map(([angle, fill], index) => (
          <g key={index} transform={`rotate(${angle} 20 88)`}>
            <rect x="8" y="70" width="24" height="16" rx="1.5" fill={fill as string} {...line} />
            <path d="M12 76 H22 M12 80 H19" stroke={INK} strokeWidth="0.9" opacity=".5" />
            {index === 2 ? (
              <rect
                x="25"
                y="72.5"
                width="5"
                height="6"
                fill={MARIGOLD}
                stroke={INK}
                strokeWidth="0.8"
              />
            ) : null}
          </g>
        ))}
      </g>
    );
  if (pose === 'deliver')
    return (
      <g className={styles.glide}>
        {/* A paper plane arriving with a dashed trail. */}
        <path
          d="M2 30 Q8 22 14 24"
          fill="none"
          stroke={INK}
          strokeWidth="1"
          strokeDasharray="1.6 1.6"
          opacity=".55"
        />
        <path d="M12 22 L34 12 L26 30 L22 23 Z" fill="#FFFFFF" {...line} />
        <path d="M22 23 L34 12" {...line} fill="none" />
        <path d="M22 23 L23.5 28 L26 30" fill={CREAM} {...line} />
      </g>
    );
  if (pose === 'celebrate')
    return (
      <g>
        {/* Restrained confetti inside the box, and a stamp held high. */}
        <g className={styles.confetti}>
          {[
            [10, 8, RED, 20],
            [26, 4, MINT, -15],
            [86, 10, MARIGOLD, 30],
            [92, 26, BLUE, -25],
            [6, 30, MARIGOLD, 45],
            [80, 2, RED, 10],
          ].map(([x, y, fill, angle], index) => (
            <rect
              key={index}
              x={x as number}
              y={y as number}
              width="4"
              height="2.2"
              rx=".6"
              fill={fill as string}
              transform={`rotate(${angle} ${x} ${y})`}
            />
          ))}
        </g>
        <g className={styles.lift} style={{ transformOrigin: '18px 30px' }}>
          <path d="M18 34 V44" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="18" cy="24" r="10" fill={MARIGOLD} {...line} />
          <circle
            cx="18"
            cy="24"
            r="6.5"
            fill="none"
            stroke={RED}
            strokeWidth="1.4"
            strokeDasharray="2 1.4"
          />
          <path
            d="M14.5 24 L17 26.5 L22 21.5"
            fill="none"
            stroke={RED}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>
    );
  if (pose === 'unsure')
    return (
      <g className={styles.bob} style={{ transformOrigin: '16px 22px' }}>
        {/* A thought bubble with a question mark, drawn as a shape. */}
        <circle cx="16" cy="20" r="11" fill={CREAM} {...line} />
        <circle cx="10" cy="35" r="2.4" fill={CREAM} {...line} />
        <circle cx="12" cy="41" r="1.4" fill={CREAM} {...line} />
        <path
          d="M12.5 17 Q12.5 12.5 16.5 12.5 Q20.5 12.5 20.5 16.2 Q20.5 18.6 17.6 19.8 Q16.3 20.4 16.3 22.6"
          fill="none"
          stroke={BLUE}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="16.3" cy="26.6" r="1.4" fill={BLUE} />
      </g>
    );
  return null;
}

/** The avatar mood that fits a pose. */
export function moodOfPose(pose: PipPose): 'idle' | 'thinking' | 'happy' {
  return pose === 'research' || pose === 'draft'
    ? 'thinking'
    : pose === 'deliver' || pose === 'celebrate'
      ? 'happy'
      : 'idle';
}
