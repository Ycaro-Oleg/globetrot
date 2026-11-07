import { describe, expect, it } from 'vitest';
import { compileTokens, cssFrom } from './build.mjs';

describe('token build', () => {
  it('resolves themed aliases for application consumers', () => {
    const tokens = compileTokens();
    expect(tokens.day['semantic.color.surface-page']).toBe('#FFF5E1');
    expect(tokens['red-eye']['semantic.color.surface-page']).toBe('#1D1A35');
    expect(tokens.day['component.hit-target']).toBe('44px');
    expect(tokens.day['primitive.duration.pin-enter']).toBe('700ms');
    expect(tokens.day['primitive.shadow.button-hover']).toBe('0px 6px 0px 0px #1D1A35');
    expect(tokens.day['primitive.type.page']).toBe('clamp(36px, 5vw, 56px)');
    expect(tokens.day['primitive.type.page-tracking']).toBe('-0.035em');
    expect(tokens.day['primitive.radius.circle']).toBe('50%');
    expect(tokens.day['primitive.shadow.button']).toBe('0px 4px 0px 0px #1D1A35');
    expect(tokens['red-eye']['primitive.shadow.button']).toBe('0px 4px 0px 0px #0C0A1A');
    expect(tokens.day['primitive.color.rule-day']).toBe('#1D1A3524');
    expect(tokens['red-eye']['semantic.color.rail-title']).toBe('#FFF5E1');
  });

  it('emits theme selectors and always-light scoping in CSS', () => {
    const css = cssFrom(compileTokens());
    expect(css).toContain('[data-theme="red-eye"]');
    expect(css).toContain('--gt-semantic-color-surface-page: #1D1A35');
    expect(css).toContain('[data-always-light]');
  });
});
