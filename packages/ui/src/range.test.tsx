import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Range } from './range';

describe('Range', () => {
  it('renders a labeled native range input', () => {
    const html = renderToStaticMarkup(<Range label="Monthly savings" defaultValue={40} />);
    expect(html).toContain('Monthly savings');
    expect(html).toContain('type="range"');
  });
});
