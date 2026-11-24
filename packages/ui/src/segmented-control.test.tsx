import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SegmentedControl } from './segmented-control';

describe('SegmentedControl', () => {
  it('renders a named radio group and selected option', () => {
    const html = renderToStaticMarkup(
      <SegmentedControl
        label="Appearance"
        options={[
          { id: 'day', label: 'Day' },
          { id: 'night', label: 'Night' },
        ]}
        defaultValue="day"
      />,
    );
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('type="radio"');
    expect(html).toContain('checked');
    expect(html).toContain('Appearance');
  });
});
