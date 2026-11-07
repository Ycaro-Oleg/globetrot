import type { Preview } from '@storybook/react-vite';
import '@globetrot/tokens/tokens.css';
import '../src/styles.css';

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Theme',
      toolbar: { title: 'Theme', items: ['day', 'red-eye'], dynamicTitle: true },
    },
    locale: {
      description: 'Locale',
      toolbar: { title: 'Locale', items: ['en', 'pt-BR'], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: 'day', locale: 'en' },
  decorators: [
    (Story, context) => (
      <div
        data-theme={context.globals.theme}
        lang={context.globals.locale}
        style={{
          minHeight: '100vh',
          padding: '2rem',
          background: 'var(--gt-semantic-color-surface-page)',
          color: 'var(--gt-semantic-color-text)',
        }}
      >
        <Story />
      </div>
    ),
  ],
  parameters: { a11y: { test: 'error' } },
};

export default preview;
