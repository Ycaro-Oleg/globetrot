import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SelectField } from './select-field';

describe('SelectField', () => {
  it('renders a labeled select trigger with caller-supplied placeholder', () => {
    const html = renderToStaticMarkup(
      <SelectField
        label="Currency"
        placeholder="Choose a currency"
        options={[{ id: 'USD', label: 'US dollar' }]}
      />,
    );
    expect(html).toContain('Currency');
    expect(html).toContain('Choose a currency');
    expect(html).toContain('button');
  });
});
