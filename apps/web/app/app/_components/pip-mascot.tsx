import { useId } from 'react';
import styles from './pip-mascot.module.css';

/**
 * Pip, the companion mascot (design handoff v2, `Pip.dc.html`): a little globe with a straw hat and a trolley.
 * Art direction, not final art. Decorative: always `aria-hidden`; the surrounding text says what matters.
 * The idle bob and wave stop under reduced motion (CSS).
 */
export function PipMascot({ size = 96 }: { size?: number }) {
  const clip = useId();
  return (
    <svg
      viewBox="0 0 220 230"
      width={size}
      height={(size * 230) / 220}
      className={styles.pip}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={clip}>
          <circle cx="105" cy="118" r="56" />
        </clipPath>
      </defs>
      <ellipse cx="105" cy="216" rx="50" ry="7" fill="#0F172A" opacity=".16" />
      <g className={styles.bob}>
        <path
          d="M90 170 L86 200"
          stroke="#1E293B"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M120 170 L124 200"
          stroke="#1E293B"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
        />
        <ellipse cx="82" cy="203" rx="11" ry="6" fill="#1E293B" />
        <ellipse cx="128" cy="203" rx="11" ry="6" fill="#1E293B" />
        <path
          d="M166 166 V150 M180 166 V150"
          stroke="#475569"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path d="M163 150 H183" stroke="#1E293B" strokeWidth="5" strokeLinecap="round" />
        <rect
          x="150"
          y="166"
          width="46"
          height="44"
          rx="9"
          fill="#F59E0B"
          stroke="#1E293B"
          strokeWidth="3.5"
        />
        <path
          d="M163 172 V204 M173 172 V204 M183 172 V204"
          stroke="#B45309"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="159" cy="213" r="4.5" fill="#1E293B" />
        <circle cx="187" cy="213" r="4.5" fill="#1E293B" />
        <circle cx="105" cy="118" r="58" fill="#3B82F6" stroke="#1E293B" strokeWidth="4" />
        <g clipPath={`url(#${clip})`}>
          <path
            d="M58 92 Q70 76 90 84 Q102 96 88 106 Q78 120 64 112 Q50 104 58 92Z"
            fill="#34D399"
          />
          <path
            d="M118 70 Q142 68 152 86 Q158 102 142 104 Q128 100 122 90 Q110 80 118 70Z"
            fill="#34D399"
          />
          <path d="M140 128 Q156 122 166 132 L166 150 Q150 152 142 142Z" fill="#34D399" />
          <ellipse
            cx="105"
            cy="118"
            rx="27"
            ry="58"
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity=".22"
            strokeWidth="2"
          />
          <path d="M45 118 H165" stroke="#FFFFFF" strokeOpacity=".22" strokeWidth="2" />
          <ellipse
            cx="82"
            cy="86"
            rx="15"
            ry="8"
            fill="#FFFFFF"
            opacity=".28"
            transform="rotate(-25 82 86)"
          />
        </g>
        <circle cx="105" cy="118" r="58" fill="none" stroke="#1E293B" strokeWidth="4" />
        <ellipse
          cx="89"
          cy="113"
          rx="9.5"
          ry="11.5"
          fill="#FFFFFF"
          stroke="#1E293B"
          strokeWidth="2.5"
        />
        <ellipse
          cx="121"
          cy="113"
          rx="9.5"
          ry="11.5"
          fill="#FFFFFF"
          stroke="#1E293B"
          strokeWidth="2.5"
        />
        <circle cx="91" cy="116" r="5" fill="#1E293B" />
        <circle cx="123" cy="116" r="5" fill="#1E293B" />
        <circle cx="93" cy="113" r="1.8" fill="#FFFFFF" />
        <circle cx="125" cy="113" r="1.8" fill="#FFFFFF" />
        <ellipse cx="76" cy="131" rx="7" ry="4" fill="#F9A8D4" />
        <ellipse cx="134" cy="131" rx="7" ry="4" fill="#F9A8D4" />
        <path
          d="M96 131 Q105 141 114 131"
          stroke="#1E293B"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M157 132 Q168 142 171 156"
          stroke="#1E293B"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="172" cy="156" r="6.5" fill="#FFFFFF" stroke="#1E293B" strokeWidth="3" />
        <g className={styles.wave}>
          <path
            d="M53 124 Q36 112 31 92"
            stroke="#1E293B"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="30" cy="89" r="6.5" fill="#FFFFFF" stroke="#1E293B" strokeWidth="3" />
        </g>
        <g transform="rotate(-7 105 64)">
          <ellipse
            cx="105"
            cy="66"
            rx="56"
            ry="12"
            fill="#FDE68A"
            stroke="#1E293B"
            strokeWidth="3"
          />
          <path
            d="M79 66 Q80 38 105 36 Q130 38 131 66Z"
            fill="#FCD34D"
            stroke="#1E293B"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M79.5 57 Q105 63 130.5 57 L131 66 Q105 72 79 66Z"
            fill="#2563EB"
            stroke="#1E293B"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </g>
      </g>
    </svg>
  );
}
