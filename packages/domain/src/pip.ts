/**
 * Pip's look: each person dresses their own Pip (design handoff v2, "Pip mascot"). The options are fixed lists so
 * a stored look can always be drawn; anything unknown falls back to the default for that part.
 */
export const PIP_HATS = ['straw', 'helmet', 'cap', 'none'] as const;
export const PIP_OUTFITS = ['none', 'scarf', 'aloha', 'vest'] as const;
export const PIP_BAGS = ['trolley', 'backpack', 'vintage'] as const;
export const PIP_BAG_COLORS = ['amber', 'cyan', 'pink'] as const;

export type PipHat = (typeof PIP_HATS)[number];
export type PipOutfit = (typeof PIP_OUTFITS)[number];
export type PipBag = (typeof PIP_BAGS)[number];
export type PipBagColor = (typeof PIP_BAG_COLORS)[number];

export interface PipLook {
  hat: PipHat;
  outfit: PipOutfit;
  bag: PipBag;
  bagColor: PipBagColor;
}

export const DEFAULT_PIP_LOOK: PipLook = {
  hat: 'straw',
  outfit: 'none',
  bag: 'trolley',
  bagColor: 'amber',
};

function pick<T extends string>(options: readonly T[], value: unknown, fallback: T): T {
  return typeof value === 'string' && (options as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** A complete look from any partial or untrusted input; unknown parts keep the default. */
export function toPipLook(input: unknown): PipLook {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  return {
    hat: pick(PIP_HATS, source.hat, DEFAULT_PIP_LOOK.hat),
    outfit: pick(PIP_OUTFITS, source.outfit, DEFAULT_PIP_LOOK.outfit),
    bag: pick(PIP_BAGS, source.bag, DEFAULT_PIP_LOOK.bag),
    bagColor: pick(PIP_BAG_COLORS, source.bagColor, DEFAULT_PIP_LOOK.bagColor),
  };
}
