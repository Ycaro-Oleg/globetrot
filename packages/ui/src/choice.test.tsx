import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Checkbox, Switch } from './choice';

describe('choice controls', () => {
  it('renders a labeled native checkbox in the selected state', () => {
    const html = renderToStaticMarkup(<Checkbox defaultSelected>Send reminders</Checkbox>);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked');
    expect(html).toContain('Send reminders');
  });

  it('exposes switch semantics with its label', () => {
    const html = renderToStaticMarkup(<Switch>Savings reminders</Switch>);
    expect(html).toContain('role="switch"');
    expect(html).toContain('Savings reminders');
  });
});
