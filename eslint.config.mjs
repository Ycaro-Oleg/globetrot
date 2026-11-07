// Single flat config for the whole monorepo. Package-level `eslint .` resolves this file upward.
import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const FRAMEWORK_IMPORTS = [
  'react',
  'react-dom',
  'next',
  'next/*',
  'hono',
  'hono/*',
  'drizzle-orm',
  'drizzle-orm/*',
  'pg',
  'pg-boss',
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/coverage/**',
      '**/storybook-static/**',
      'design/reference/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // Architecture boundary (ADR-0006, AGENTS.md §7): the domain package is pure TypeScript.
  // Only relative imports are allowed: no frameworks, no I/O, no Node built-ins, no other packages.
  {
    files: ['packages/domain/src/**/*.ts'],
    ignores: ['packages/domain/src/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\.{1,2}/)',
              message:
                '@globetrot/domain must stay pure: only relative imports are allowed (see ADR-0006).',
            },
          ],
        },
      ],
    },
  },

  // The application layer is framework-agnostic: no UI, HTTP or database driver imports (those are adapters).
  {
    files: ['packages/application/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: FRAMEWORK_IMPORTS,
              message:
                '@globetrot/application must not depend on UI, HTTP or DB frameworks; use ports (see ADR-0006).',
            },
          ],
        },
      ],
    },
  },

  // React
  {
    files: ['apps/web/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },

  // Next.js (App Router only, so the Pages Router link rule does not apply)
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      '@next/next/no-html-link-for-pages': 'off',
    },
  },

  prettier,
);
