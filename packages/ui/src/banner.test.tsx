import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Banner } from './banner';

describe('Banner', () => {
  it('renders the caller-provided text without announcing it automatically', () => {
    const html = renderToStaticMarkup(<Banner tone="error">Could not save</Banner>);
    expect(html).toContain('Could not save');
    expect(html).toContain('gt-banner--error');
    expect(html).not.toContain('role="alert"');
  });
});
