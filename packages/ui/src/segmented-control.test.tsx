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

  it('puts its help under the control and links it as the description', () => {
    const html = renderToStaticMarkup(
      <SegmentedControl
        label="Theme"
        description="Match my device follows your device."
        options={[{ id: 'day', label: 'Day' }]}
        defaultValue="day"
      />,
    );
    const group = html.match(/<div[^>]*role="radiogroup"[^>]*>/)?.[0] ?? '';
    const describedBy = group.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(describedBy).toBeTruthy();
    expect(html).toContain(`id="${describedBy}"`);
    expect(html).toContain('Match my device follows your device.');
  });
});
