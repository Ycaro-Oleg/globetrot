import { describe, expect, it } from 'vitest';
import { compileTokens, cssFrom } from './build.mjs';
import { contrastReport } from './contrast.mjs';

describe('token build', () => {
  it('resolves themed aliases for application consumers (design handoff v2)', () => {
    const tokens = compileTokens();
    expect(tokens.day['semantic.color.surface-page']).toBe('#EEF1F4');
    expect(tokens['red-eye']['semantic.color.surface-page']).toBe('#0B1220');
    expect(tokens.day['component.hit-target']).toBe('44px');
    expect(tokens.day['component.button-radius']).toBe('99px');
    expect(tokens.day['semantic.color.primary']).toBe('#2563EB');
    expect(tokens.day['semantic.color.cta']).toBe('#F97316');
    expect(tokens.day['semantic.color.on-cta']).toBe('#0F172A');
    expect(tokens['red-eye']['semantic.color.cta']).toBe('#FB923C');
    expect(tokens.day['semantic.color.ripple']).toBe('#FFFFFF29');
    expect(tokens.day['primitive.duration.pin-enter']).toBe('700ms');
    expect(tokens.day['primitive.shadow.button']).toBe('0px 0px 0px 0px #0F172A');
    expect(tokens.day['primitive.shadow.modal']).toBe('0px 20px 50px -12px #0F172A59');
    expect(tokens.day['primitive.type.page']).toBe('clamp(30px, 3.4vw, 38px)');
    expect(tokens.day['primitive.type.page-tracking']).toBe('-0.025em');
    expect(tokens.day['primitive.radius.circle']).toBe('50%');
    expect(tokens.day['primitive.font.body']).toBe('"Instrument Sans", system-ui, sans-serif');
    expect(tokens.day['primitive.font.display']).toBe(
      '"Bricolage Grotesque", "Instrument Sans", system-ui, sans-serif',
    );
    expect(tokens['red-eye']['semantic.color.rail-title']).toBe('#F1F5F9');
  });

  it('emits theme selectors and always-light scoping in CSS', () => {
    const css = cssFrom(compileTokens());
    expect(css).toContain('[data-theme="red-eye"]');
    expect(css).toContain('--gt-semantic-color-surface-page: #0B1220');
    expect(css).toContain('[data-always-light]');
    expect(css).toContain(
      '--gt-semantic-color-text-tertiary: var(--gt-semantic-color-always-light-text-tertiary)',
    );
  });
});

describe('contrast coverage', () => {
  it('checks tertiary text on the alternate page surface in both themes', () => {
    const checks = contrastReport().filter(
      (item) => item.fg === 'text-tertiary' && item.bg === 'surface-page-alt',
    );
    expect(checks).toHaveLength(2);
    expect(checks.every((item) => item.pass)).toBe(true);
  });
});
