import { useEffect, type ReactNode } from 'react';
import { I18nProvider } from 'react-aria-components';
import type { Preview } from '@storybook/react-vite';
import '@globetrot/tokens/tokens.css';
import '../src/styles.css';
import '../src/tailwind.css';

function StorySurface({
  theme,
  locale,
  children,
}: {
  theme: string;
  locale: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const root = document.documentElement;
    const oldTheme = root.getAttribute('data-theme');
    const oldLang = root.lang;
    root.setAttribute('data-theme', theme);
    root.lang = locale;
    return () => {
      if (oldTheme === null) root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', oldTheme);
      root.lang = oldLang;
    };
  }, [theme, locale]);

  return (
    <div
      data-theme={theme}
      lang={locale}
      style={{
        minHeight: '100vh',
        padding: '2rem',
        background: 'var(--gt-semantic-color-surface-page)',
        color: 'var(--gt-semantic-color-text)',
      }}
    >
      {children}
    </div>
  );
}

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
  initialGlobals: { theme: 'day', locale: 'en', a11y: { manual: true } },
  decorators: [
    (Story, context) => (
      <StorySurface
        theme={context.globals.theme === 'red-eye' ? 'red-eye' : 'day'}
        locale={context.globals.locale === 'pt-BR' ? 'pt-BR' : 'en'}
      >
        <I18nProvider locale={context.globals.locale === 'pt-BR' ? 'pt-BR' : 'en'}>
          <Story />
        </I18nProvider>
      </StorySurface>
    ),
  ],
  parameters: { a11y: { test: 'error' } },
};

export default preview;
