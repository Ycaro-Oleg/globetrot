import { describe, expect, it } from 'vitest';
import { groupSavings, memberShares, settleUp, validShares } from './group';

const ana = { userId: 'ana' };
const bruno = { userId: 'bruno' };
const carla = { userId: 'carla' };

describe('memberShares', () => {
  it('splits equally and gives the leftover cents to the first people, adding up exactly', () => {
    const shares = memberShares(1000n, [ana, bruno, carla]);
    expect([...shares.values()]).toEqual([334n, 333n, 333n]);
    expect([...shares.values()].reduce((a, b) => a + b, 0n)).toBe(1000n);
  });

  it('splits by basis points when parts are set', () => {
    const shares = memberShares(10_000n, [
      { userId: 'ana', shareBp: 6000 },
      { userId: 'bruno', shareBp: 4000 },
    ]);
    expect(Object.fromEntries(shares)).toEqual({ ana: 6000n, bruno: 4000n });
    expect(validShares([6000, 4000])).toBe(true);
    expect(validShares([6000, 3000])).toBe(false);
    expect(validShares([10_500, -500])).toBe(false);
  });
});

describe('settleUp', () => {
  it('pairs debts with credits so everyone has paid their share', () => {
    const result = settleUp(
      [
        { paidBy: 'ana', amountMinor: 90_00n },
        { paidBy: 'bruno', amountMinor: 30_00n },
        { paidBy: null, amountMinor: 15_00n },
      ],
      [ana, bruno, carla],
    );
    // 120 paid by named people, 40 each: Carla owes Ana 40, Bruno owes Ana 10.
    expect(result.transfers).toEqual([
      { from: 'carla', to: 'ana', amountMinor: 40_00n },
      { from: 'bruno', to: 'ana', amountMinor: 10_00n },
    ]);
    expect(result.unassignedMinor).toBe(15_00n);
    expect(result.balances.map((b) => b.balanceMinor)).toEqual([50_00n, -10_00n, -40_00n]);
  });

  it('needs nothing when everyone is even, and leaves out people no longer on the trip', () => {
    expect(
      settleUp(
        [
          { paidBy: 'ana', amountMinor: 50n },
          { paidBy: 'bruno', amountMinor: 50n },
        ],
        [ana, bruno],
      ).transfers,
    ).toEqual([]);
    expect(settleUp([{ paidBy: 'gone', amountMinor: 70n }], [ana]).unassignedMinor).toBe(70n);
  });
});

describe('groupSavings', () => {
  it('shows each person’s share, what they saved and what is left, and the group total', () => {
    const result = groupSavings(
      3000n,
      [ana, bruno],
      [
        { userId: 'ana', savedMinor: 1500n, monthlyMinor: 300n },
        { userId: 'bruno', savedMinor: 200n, monthlyMinor: 100n },
      ],
    );
    expect(result.people).toEqual([
      {
        userId: 'ana',
        shareMinor: 1500n,
        savedMinor: 1500n,
        monthlyMinor: 300n,
        leftMinor: 0n,
        ready: true,
      },
      {
        userId: 'bruno',
        shareMinor: 1500n,
        savedMinor: 200n,
        monthlyMinor: 100n,
        leftMinor: 1300n,
        ready: false,
      },
    ]);
    expect(result.leftMinor).toBe(1300n);
  });
});

describe('edge cases of the split', () => {
  it('returns nothing for nobody, zero for parts that are all zero, and skips zero parts for leftovers', () => {
    expect(memberShares(100n, []).size).toBe(0);
    expect([
      ...memberShares(100n, [
        { userId: 'ana', shareBp: 0 },
        { userId: 'bruno', shareBp: 0 },
      ]).values(),
    ]).toEqual([0n, 0n]);
    const shares = memberShares(101n, [
      { userId: 'ana', shareBp: 0 },
      { userId: 'bruno', shareBp: 5000 },
      { userId: 'carla', shareBp: 5000 },
    ]);
    expect(Object.fromEntries(shares)).toEqual({ ana: 0n, bruno: 51n, carla: 50n });
  });

  it('treats someone who saved nothing as having saved zero, and a group with more than enough as done', () => {
    const result = groupSavings(
      100n,
      [ana, bruno],
      [{ userId: 'ana', savedMinor: 500n, monthlyMinor: 0n }],
    );
    expect(result.people[1]).toMatchObject({ savedMinor: 0n, monthlyMinor: 0n, leftMinor: 50n });
    expect(result.leftMinor).toBe(0n);
  });
});
