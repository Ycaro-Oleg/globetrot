/**
 * Feature flags read from the environment.
 *
 * Read per request (the app's pages are rendered on demand), so one image behaves differently in each
 * environment. A flag is on only for the exact value `true`; anything else, including a missing variable, is off.
 * Documented in docs/engineering/configuration.md.
 */
export function isPipEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env.FEATURE_PIP === 'true';
}

/**
 * The community (feed, posts, people). Off until there are enough travellers for a feed worth opening: its pages
 * answer 404 and it leaves the navigation. The API keeps its routes; nothing in the app reaches them.
 */
export function isCommunityEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env.FEATURE_COMMUNITY === 'true';
}
