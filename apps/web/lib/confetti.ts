/**
 * A short confetti burst from a point inside `host` (GSAP, loaded on demand). Pieces are plain spans removed when
 * they land. Does nothing when the person asked for less motion.
 */
export async function confetti(host: HTMLElement, at: { x: number; y: number }, pieces = 22) {
  if (
    document.documentElement.dataset.motion === 'reduced' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
    return;
  const { gsap } = await import('gsap');
  const colors = ['#f97316', '#2563eb', '#10b981', '#f59e0b', '#ec4899'];
  for (let i = 0; i < pieces; i++) {
    const bit = document.createElement('span');
    Object.assign(bit.style, {
      position: 'absolute',
      left: `${at.x}px`,
      top: `${at.y}px`,
      width: '8px',
      height: '12px',
      borderRadius: '2px',
      background: colors[i % colors.length],
      pointerEvents: 'none',
      zIndex: '5',
    });
    host.appendChild(bit);
    gsap.to(bit, {
      x: (Math.random() - 0.5) * 320,
      y: -60 - Math.random() * 140,
      rotate: Math.random() * 540,
      opacity: 0,
      duration: 1.1 + Math.random() * 0.6,
      ease: 'power2.out',
      onComplete: () => bit.remove(),
    });
  }
}
