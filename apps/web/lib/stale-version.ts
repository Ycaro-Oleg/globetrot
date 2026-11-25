/**
 * A tab opened before a deploy still holds the old build's Server Action ids: its next form post is refused
 * ("Server Action … was not found on the server") and the error boundary would show "Something went wrong".
 * That is not a failure of the action: the page only needs the new version. The error boundaries reload once
 * to get it, and offer a reload button if that already happened in the last 30 seconds (no reload loops).
 */
export function isStaleVersionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  return (
    name === 'UnrecognizedActionError' ||
    (typeof message === 'string' &&
      /Server Action .* was not found on the server|Failed to find Server Action/i.test(message))
  );
}

const RELOADED_AT = 'globetrot.reloaded-for-new-version';

/** Reloads the page for the new version, unless it just did. Returns whether it reloaded. */
export function reloadOnceForNewVersion(now = Date.now()): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(RELOADED_AT) ?? 0);
    if (now - last < 30_000) return false;
    window.sessionStorage.setItem(RELOADED_AT, String(now));
  } catch {
    return false; // No storage (private mode): let the person press the button instead of risking a loop.
  }
  window.location.reload();
  return true;
}
