import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TextField } from './text-field';

describe('TextField', () => {
  it('renders an associated label and description', () => {
    const html = renderToStaticMarkup(<TextField label="Trip name" description="Choose a name" />);
    expect(html).toContain('<label');
    expect(html).toContain('<input');
    expect(html).toContain('aria-describedby');
    expect(html).toContain('Choose a name');
  });

  it('exposes an invalid field and its error', () => {
    const html = renderToStaticMarkup(
      <TextField label="Trip name" isInvalid errorMessage="Enter a name" />,
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('Enter a name');
  });

  it('renders a textarea when multiline is requested', () => {
    const html = renderToStaticMarkup(<TextField label="Notes" multiline />);
    expect(html).toContain('<textarea');
  });
});
