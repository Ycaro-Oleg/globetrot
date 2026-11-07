// IANA names look like "America/Sao_Paulo", "Asia/Kolkata" or "UTC": letters, digits, `_`, `+`, `-` and `/`.
// This keeps out offsets ("+01:00") and arbitrary text that `Intl` might also accept.
const SHAPE = /^(?:utc|[a-z][a-z0-9_+-]*(?:\/[a-z0-9_+-]+)+)$/i;

let listed: ReadonlyMap<string, string> | undefined;

/** The platform's own spelling of each time zone it lists, by lower-case name. Built on first use. */
function spellings(): ReadonlyMap<string, string> {
  listed ??= new Map(
    [...Intl.supportedValuesOf('timeZone'), 'UTC'].map((zone) => [zone.toLowerCase(), zone]),
  );
  return listed;
}

/**
 * The spelling to store for an IANA time-zone name, or `null` when it is not one. `Intl` is the registry, so
 * the answer follows the platform's tz database. Case is fixed to the platform's listing
 * ("america/sao_paulo" becomes "America/Sao_Paulo"); the name is never replaced by a different one, so
 * "America/Argentina/Buenos_Aires" stays as chosen even though ICU prefers an older link name internally.
 */
export function canonicalTimeZone(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 64 || !SHAPE.test(value)) return null;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
  } catch {
    return null;
  }
  return spellings().get(value.toLowerCase()) ?? value;
}

export function isTimeZone(value: unknown): value is string {
  return canonicalTimeZone(value) !== null;
}
