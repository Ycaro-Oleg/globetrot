import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MOTION_CHOICE,
  DEFAULT_THEME_CHOICE,
  isMotionChoice,
  isThemeChoice,
  MOTION_CHOICES,
  resolveMotion,
  resolveTheme,
  THEME_CHOICES,
} from './preferences';

describe('theme', () => {
  it('names the two designed themes and the system choice', () => {
    expect(THEME_CHOICES).toEqual(['day', 'red-eye', 'system']);
    expect(DEFAULT_THEME_CHOICE).toBe('system');
  });

  it('an explicit choice wins over the system setting', () => {
    expect(resolveTheme('day', true)).toBe('day');
    expect(resolveTheme('red-eye', false)).toBe('red-eye');
  });

  it('system follows the operating system', () => {
    expect(resolveTheme('system', false)).toBe('day');
    expect(resolveTheme('system', true)).toBe('red-eye');
  });

  it('recognises only known choices', () => {
    expect(isThemeChoice('system')).toBe(true);
    for (const value of ['night', 'DAY', '', null, undefined, 3])
      expect(isThemeChoice(value)).toBe(false);
  });
});

describe('motion', () => {
  it('has full as the default', () => {
    expect(MOTION_CHOICES).toEqual(['full', 'reduced']);
    expect(DEFAULT_MOTION_CHOICE).toBe('full');
  });

  it('the operating system asking for reduced motion always wins', () => {
    expect(resolveMotion('full', true)).toBe('reduced');
    expect(resolveMotion('reduced', true)).toBe('reduced');
  });

  it('otherwise the choice stands', () => {
    expect(resolveMotion('full', false)).toBe('full');
    expect(resolveMotion('reduced', false)).toBe('reduced');
  });

  it('recognises only known choices', () => {
    expect(isMotionChoice('reduced')).toBe(true);
    for (const value of ['none', 'REDUCED', '', null, undefined])
      expect(isMotionChoice(value)).toBe(false);
  });
});
