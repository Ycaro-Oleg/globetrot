import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Toast } from './toast';

describe('Toast', () => {
  it('announces the message and exposes localized actions', () => {
    const html = renderToStaticMarkup(
      <Toast
        message="Stop removed"
        undoLabel="Undo"
        dismissLabel="Dismiss"
        onUndo={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('Stop removed');
    expect(html).toContain('Undo');
    expect(html).toContain('Dismiss');
  });
});
