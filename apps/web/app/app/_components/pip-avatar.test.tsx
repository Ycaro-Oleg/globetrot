import { validateAvatar } from 'open-bot-avatar';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PIP_AVATAR, PipAvatar } from './pip-avatar';

describe('PipAvatar', () => {
  it('has a valid open-bot-avatar definition', () => {
    const result = validateAvatar(PIP_AVATAR);
    expect(result.ok).toBe(true);
  });

  it('renders a decorative still frame on the server, at the asked size', () => {
    const html = renderToStaticMarkup(<PipAvatar size={48} still />);
    expect(html).toMatch(/^<span[^>]*aria-hidden="true"/);
    expect(html).toContain('width:48px');
    expect(html).toContain('<svg');
    expect(html).not.toContain('<script');
  });

  it('leaves a host for the live avatar unless it is still', () => {
    expect(renderToStaticMarkup(<PipAvatar />).match(/<span/g)?.length).toBe(3);
    expect(renderToStaticMarkup(<PipAvatar still />).match(/<span/g)?.length).toBe(2);
  });
});
