# 0008. ICU-based internationalization

- Status: Accepted
- Date: 2026-11-07

## Context
The product is global-first. en + pt-BR are required from day one, and more locales must be addable without refactoring, on both web and native.

## Decision
- Messages are ICU MessageFormat catalogs in `packages/i18n` (`en` as source, plus `pt-BR`).
- Web uses `next-intl`. Native uses `use-intl`. Formatting uses `Intl`.
- Locale, currency and country are independent settings.
- Marketing URLs carry locale prefixes. The app takes the locale from the user's preference.
- CI fails on missing keys.
- Details live in [`../i18n.md`](../i18n.md).

## Consequences
Every UI PR includes both languages. A translation workflow (human review of pt-BR, AI-assisted drafts for future locales) is defined when the third locale is added.
