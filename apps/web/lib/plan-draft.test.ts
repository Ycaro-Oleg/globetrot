import { describe, expect, it } from 'vitest';
import { readDraft } from './plan-draft';

const cookie = (value: unknown) => encodeURIComponent(JSON.stringify(value));

describe('readDraft', () => {
  it('reads the landing page numbers', () => {
    expect(readDraft(cookie({ cost: '3000', saved: '500', monthly: '300' }))).toEqual({
      cost: '3000',
      saved: '500',
      monthly: '300',
    });
  });
  it('ignores anything that is not three plain amounts', () => {
    expect(readDraft(undefined)).toBeNull();
    expect(readDraft('not json')).toBeNull();
    expect(readDraft(cookie({ cost: '3000', saved: '500' }))).toBeNull();
    expect(readDraft(cookie({ cost: '<script>', saved: '1', monthly: '1' }))).toBeNull();
    expect(readDraft(cookie({ cost: 3000, saved: '1', monthly: '1' }))).toBeNull();
  });
});
