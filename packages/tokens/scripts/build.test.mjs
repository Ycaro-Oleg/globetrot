import { describe, expect, it } from 'vitest';
import { compileTokens, cssFrom } from './build.mjs';

describe('token build', () => {
  it('resolves themed aliases for application consumers', () => {
    const tokens = compileTokens();
    expect(tokens.day['semantic.color.surface-page']).toBe('#FFF5E1');
    expect(tokens['red-eye']['semantic.color.surface-page']).toBe('#1D1A35');
    expect(tokens.day['component.hit-target']).toBe('44px');
    expect(tokens['red-eye']['semantic.color.rail-title']).toBe('#FFF5E1');
  });

  it('emits theme selectors and always-light scoping in CSS', () => {
    const css = cssFrom(compileTokens());
    expect(css).toContain('[data-theme="red-eye"]');
    expect(css).toContain('--gt-semantic-color-surface-page: #1D1A35');
    expect(css).toContain('[data-always-light]');
  });
});
