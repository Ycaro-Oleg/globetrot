/**
 * @globetrot/i18n: ICU message catalogs (en, pt-BR) and locale helpers (ADR-0008, docs/architecture/i18n.md).
 */
export {
  catalogs,
  flattenMessages,
  lookupMessage,
  type MessageKey,
  type MessageKeyOf,
  type Messages,
  type MessageTree,
} from './catalog';
export {
  formatLocalDate,
  formatMessage,
  formatYearMonth,
  MissingMessageError,
  type MessageValues,
} from './format';
export {
  DEFAULT_LOCALE,
  isSupportedLocale,
  LOCALE_COOKIE,
  localeFromCookieHeader,
  negotiateLocale,
  parseAcceptLanguage,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from './locales';
export { describeProblem, validateCatalogs, type CatalogProblem } from './validate';
