import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { STATUS_MARKS, StatusMark } from './status-mark';

describe('StatusMark', () => {
  it.each(STATUS_MARKS)('renders the localized label and a decorative glyph for %s', (status) => {
    const html = renderToStaticMarkup(<StatusMark status={status}>Localized label</StatusMark>);
    expect(html).toContain('Localized label');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('gt-status--' + status);
  });
});
