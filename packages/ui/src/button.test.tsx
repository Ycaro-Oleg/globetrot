import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from './button';

describe('Button', () => {
  it('renders a native labeled button with the selected style', () => {
    const html = renderToStaticMarkup(<Button variant="ghost">Create trip</Button>);
    expect(html).toContain('<button');
    expect(html).toContain('gt-button--ghost');
    expect(html).toContain('Create trip');
  });

  it('uses the native disabled state', () => {
    const html = renderToStaticMarkup(<Button isDisabled>Create trip</Button>);
    expect(html).toContain('disabled');
    expect(html).toContain('data-disabled');
  });
});
