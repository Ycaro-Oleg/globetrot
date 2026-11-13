import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PIP_LOOK,
  PIP_BAG_COLORS,
  PIP_BAGS,
  PIP_HATS,
  PIP_OUTFITS,
  toPipLook,
} from './pip';

describe('toPipLook', () => {
  it('gives the default look for nothing or garbage', () => {
    expect(toPipLook(undefined)).toEqual(DEFAULT_PIP_LOOK);
    expect(toPipLook('cap')).toEqual(DEFAULT_PIP_LOOK);
    expect(toPipLook({ hat: 'crown', bag: 42 })).toEqual(DEFAULT_PIP_LOOK);
  });

  it('keeps every known option and fills the missing parts', () => {
    expect(toPipLook({ hat: 'cap', outfit: 'vest' })).toEqual({
      ...DEFAULT_PIP_LOOK,
      hat: 'cap',
      outfit: 'vest',
    });
    for (const hat of PIP_HATS) expect(toPipLook({ hat }).hat).toBe(hat);
    for (const outfit of PIP_OUTFITS) expect(toPipLook({ outfit }).outfit).toBe(outfit);
    for (const bag of PIP_BAGS) expect(toPipLook({ bag }).bag).toBe(bag);
    for (const bagColor of PIP_BAG_COLORS) expect(toPipLook({ bagColor }).bagColor).toBe(bagColor);
  });

  it('can go without a hat or an outfit, but always has a bag', () => {
    expect(PIP_HATS).toContain('none');
    expect(PIP_OUTFITS).toContain('none');
    expect(PIP_BAGS).not.toContain('none' as never);
  });
});
