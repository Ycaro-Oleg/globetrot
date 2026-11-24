import en from '../messages/en.json';
import ptBR from '../messages/pt-BR.json';
import type { SupportedLocale } from './locales';

/** The message tree. `en` is the source catalog; every other locale must have the same shape. */
export type Messages = typeof en;

/** A nested catalog: leaves are ICU message strings. */
export interface MessageTree {
  readonly [key: string]: string | MessageTree;
}

type Join<Prefix extends string, Key extends string> = Prefix extends '' ? Key : `${Prefix}.${Key}`;

/** Dot-separated paths to every message leaf, e.g. `"nextSteps.planEmptyDays"`. */
export type MessageKeyOf<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? Join<Prefix, K>
    : MessageKeyOf<T[K], Join<Prefix, K>>;
}[keyof T & string];

export type MessageKey = MessageKeyOf<Messages>;

/**
 * All catalogs. The `Messages` annotation makes TypeScript reject a locale that is missing a key;
 * `scripts/check-messages.ts` additionally rejects extra keys, ICU syntax errors and argument mismatches.
 */
export const catalogs: Readonly<Record<SupportedLocale, Messages>> = {
  en,
  'pt-BR': ptBR,
};

/** Looks up a message by dot path. Returns `undefined` for unknown paths or non-leaf nodes. */
export function lookupMessage(tree: MessageTree, key: string): string | undefined {
  let node: string | MessageTree | undefined = tree;
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string' || !Object.hasOwn(node, part))
      return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Flattens a catalog into `[dotPath, message]` pairs (leaves only), in document order. */
export function flattenMessages(tree: MessageTree, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string'
      ? [[path, value] as [string, string]]
      : flattenMessages(value, path);
  });
}
