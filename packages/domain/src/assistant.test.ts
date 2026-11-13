import { describe, expect, it } from 'vitest';
import { canDecide, PIP_UNDO_HOURS } from './assistant';

const now = new Date('2026-11-13T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);

describe('canDecide', () => {
  it('applies or discards only a fresh proposal', () => {
    expect(canDecide({ status: 'proposed', decidedAt: null }, 'apply', now)).toBe(true);
    expect(canDecide({ status: 'proposed', decidedAt: null }, 'discard', now)).toBe(true);
    expect(canDecide({ status: 'applied', decidedAt: now }, 'apply', now)).toBe(false);
    expect(canDecide({ status: 'discarded', decidedAt: now }, 'discard', now)).toBe(false);
  });
  it('undoes an applied proposal within the window only', () => {
    expect(canDecide({ status: 'applied', decidedAt: hoursAgo(1) }, 'undo', now)).toBe(true);
    expect(
      canDecide({ status: 'applied', decidedAt: hoursAgo(PIP_UNDO_HOURS + 1) }, 'undo', now),
    ).toBe(false);
    expect(canDecide({ status: 'undone', decidedAt: hoursAgo(1) }, 'undo', now)).toBe(false);
    expect(canDecide({ status: 'proposed', decidedAt: null }, 'undo', now)).toBe(false);
  });
});
