import { validateAvatar } from 'open-bot-avatar';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PIP_AVATAR, PipAvatar } from './pip-avatar';

describe('PipAvatar', () => {
  it('has a valid open-bot-avatar definition', () => {
    expect(validateAvatar(PIP_AVATAR).ok).toBe(true);
  });

  it('renders a decorative still frame on the server, at the asked size', () => {
    const html = renderToStaticMarkup(<PipAvatar size={48} still />);
    expect(html).toMatch(/^<span[^>]*aria-hidden="true"/);
    expect(html).toContain('width:48px');
    expect(html).toContain('<svg');
    expect(html).not.toContain('<script');
  });

  it('leaves a host for the live avatar unless it is still', () => {
    expect(renderToStaticMarkup(<PipAvatar />)).toContain('live');
    expect(renderToStaticMarkup(<PipAvatar still />)).not.toMatch(/class="[^"]*live/);
  });

  it('wears the default look: a straw hat and an amber trolley', () => {
    const html = renderToStaticMarkup(<PipAvatar size={96} still />);
    expect(html).toContain('#FDE68A'); // straw brim
    expect(html).toContain('#F59E0B'); // amber bag
  });

  it('dresses in the chosen hat, outfit and bag', () => {
    const html = renderToStaticMarkup(
      <PipAvatar
        size={96}
        still
        look={{ hat: 'cap', outfit: 'vest', bag: 'vintage', bagColor: 'pink' }}
      />,
    );
    expect(html).toContain('#DC2626'); // cap
    expect(html).toContain('#B08654'); // vest
    expect(html).toContain('#EC4899'); // pink bag
    expect(html).not.toContain('#FDE68A');
  });

  it('can go without a hat and an outfit, and leaves the bag out when tiny', () => {
    const bare = renderToStaticMarkup(
      <PipAvatar
        size={96}
        still
        look={{ hat: 'none', outfit: 'none', bag: 'trolley', bagColor: 'cyan' }}
      />,
    );
    expect(bare).not.toMatch(/#FDE68A|#E7D7B5|#DC2626|#EF4444|#B08654/);
    expect(bare).toContain('#06B6D4');
    expect(renderToStaticMarkup(<PipAvatar size={26} still />)).not.toContain('#F59E0B');
  });
});
