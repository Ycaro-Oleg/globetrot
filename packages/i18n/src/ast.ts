import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';

export interface MessageShape {
  /** Placeholder names, e.g. `count` in `{count, plural, …}` or `city` in `{city}`. */
  readonly args: ReadonlySet<string>;
  /** Rich-text tag names, e.g. `strong` in `<strong>…</strong>`. */
  readonly tags: ReadonlySet<string>;
}

function walk(
  elements: readonly MessageFormatElement[],
  args: Set<string>,
  tags: Set<string>,
): void {
  for (const el of elements) {
    switch (el.type) {
      case TYPE.argument:
      case TYPE.number:
      case TYPE.date:
      case TYPE.time:
        args.add(el.value);
        break;
      case TYPE.select:
      case TYPE.plural:
        args.add(el.value);
        for (const option of Object.values(el.options)) walk(option.value, args, tags);
        break;
      case TYPE.tag:
        tags.add(el.value);
        walk(el.children, args, tags);
        break;
      default:
        break; // literals and `#`
    }
  }
}

/** Parses an ICU message (throws on syntax errors) and returns its placeholders and tags. */
export function messageShape(message: string): MessageShape {
  const args = new Set<string>();
  const tags = new Set<string>();
  walk(parse(message, { requiresOtherClause: true }), args, tags);
  return { args, tags };
}
