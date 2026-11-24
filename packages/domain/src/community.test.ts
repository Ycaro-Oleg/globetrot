import { describe, expect, it } from 'vitest';
import { canSeePost, handleFromName, isHandle, needsBody } from './community';

const post = { authorId: 'a', audience: 'everyone', deleted: false, hidden: false } as const;
const viewer = { viewerId: 'v', follows: false, muted: false, reported: false };

describe('canSeePost', () => {
  it('shows public posts to anyone', () => {
    expect(canSeePost(post, viewer)).toBe(true);
  });
  it('shows followers-only posts to followers and the author only', () => {
    const followers = { ...post, audience: 'followers' as const };
    expect(canSeePost(followers, viewer)).toBe(false);
    expect(canSeePost(followers, { ...viewer, follows: true })).toBe(true);
    expect(canSeePost(followers, { ...viewer, viewerId: 'a' })).toBe(true);
  });
  it('hides muted, reported and report-hidden posts, but never from the author', () => {
    expect(canSeePost(post, { ...viewer, muted: true })).toBe(false);
    expect(canSeePost(post, { ...viewer, reported: true })).toBe(false);
    expect(canSeePost({ ...post, hidden: true }, viewer)).toBe(false);
    expect(canSeePost({ ...post, hidden: true }, { ...viewer, viewerId: 'a' })).toBe(true);
  });
  it('hides deleted posts from everyone', () => {
    expect(canSeePost({ ...post, deleted: true }, { ...viewer, viewerId: 'a' })).toBe(false);
  });
});

describe('handles', () => {
  it('builds one from a name without accents or symbols', () => {
    expect(handleFromName('Marina Duarte')).toBe('marina.duarte');
    expect(handleFromName('  João  da Silva! ')).toBe('joao.da.silva');
    expect(handleFromName('Ψ')).toBe('traveler');
    expect(handleFromName('A')).toBe('traveler');
    expect(handleFromName('Maximiliano Bartolomeu de Albuquerque').length).toBeLessThanOrEqual(20);
  });
  it('accepts only the handle shape', () => {
    expect(isHandle('ana.mochila')).toBe(true);
    expect(isHandle('ab')).toBe(false);
    expect(isHandle('.ana')).toBe(false);
    expect(isHandle('Ana')).toBe(false);
    expect(isHandle('a'.repeat(25))).toBe(false);
  });
  it('knows which kinds need words', () => {
    expect(needsBody('moment')).toBe(true);
    expect(needsBody('route')).toBe(false);
  });
});
