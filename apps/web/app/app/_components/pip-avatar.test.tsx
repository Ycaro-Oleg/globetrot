import { validateAvatar } from 'open-bot-avatar';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PIP_AVATAR, PipAvatar } from './pip-avatar';
import { moodOfPose } from './pip-pose';

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

  it('is the globe itself: dotted continents and a grid, and no hat, outfit or bag for now', () => {
    for (const html of [
      renderToStaticMarkup(<PipAvatar size={96} still />),
      renderToStaticMarkup(
        <PipAvatar
          size={96}
          still
          look={{ hat: 'cap', outfit: 'vest', bag: 'vintage', bagColor: 'pink' }}
        />,
      ),
    ]) {
      expect(html).toContain('-dots'); // the continents' dot pattern
      expect(html).toContain('<pattern');
      expect(html).not.toMatch(/#FDE68A|#E7D7B5|#DC2626|#EF4444|#B08654|#F59E0B|#EC4899/);
    }
  });

  it('draws the props of each of the six states, none for idle or when tiny', () => {
    for (const pose of ['research', 'draft', 'deliver', 'celebrate', 'unsure'] as const) {
      expect(renderToStaticMarkup(<PipAvatar size={96} pose={pose} still />)).toContain(
        `data-pose="${pose}"`,
      );
    }
    expect(renderToStaticMarkup(<PipAvatar size={96} still />)).not.toContain('data-pose');
    expect(renderToStaticMarkup(<PipAvatar size={32} pose="celebrate" still />)).not.toContain(
      'data-pose',
    );
  });

  it('moves the face to fit the pose unless told otherwise', () => {
    expect(moodOfPose('research')).toBe('thinking');
    expect(moodOfPose('draft')).toBe('thinking');
    expect(moodOfPose('deliver')).toBe('happy');
    expect(moodOfPose('celebrate')).toBe('happy');
    expect(moodOfPose('unsure')).toBe('idle');
  });
});
