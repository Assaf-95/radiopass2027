/* ===========================================================================
   Editor access.

   There are now TWO ways in, because there are two ways this site gets
   deployed and they need different things:

   1. SERVER SESSION — the real one. The password lives in the deployment's
      environment (ATLAS_ADMIN_PASSWORD), never in the bundle; sign-in
      exchanges it for a signed token, and every write is re-checked by the
      API. Changes are saved centrally and are visible to everyone, on every
      device, immediately. This is what runs when the content API is
      reachable, which is the deployed site.

   2. LOCAL LOCK — the legacy one, kept deliberately. On a plain static host
      with no API there is nowhere to check a secret and nowhere to save, but
      the authoring tools still work against this browser's own storage, and
      losing that would be a regression. It is a UI lock and is labelled as
      one wherever it appears. Its passcode comes from VITE_ADMIN_PASSCODE and
      has NO default: unset, the local lock is unavailable rather than opening
      to a string anyone could read out of the bundle.

   `isAdmin()` is true for either, because it only ever guards what the
   INTERFACE shows. Nothing the server accepts depends on it: a write needs a
   valid session token, and no amount of localStorage produces one.
   =========================================================================== */

import { sessionToken, setSessionToken, signIn as apiSignIn } from './content/api';

const KEY = 'radiopass-admin-v1';

/** Signed in by either route. Governs what the interface offers, never what
 *  the server accepts. */
export function isAdmin(): boolean {
  if (hasServerSession()) return true;
  try {
    return localStorage.getItem(KEY) === 'yes';
  } catch {
    return false;
  }
}

/** Signed in against the API, so edits will be saved centrally. */
export function hasServerSession(): boolean {
  return sessionToken().length > 0;
}

/** The real sign-in. Throws with the server's own message on failure, so a
 *  deployment that has not been given a password says exactly that rather
 *  than "wrong passcode". */
export async function signInEditor(password: string): Promise<void> {
  const { token } = await apiSignIn(password);
  setSessionToken(token);
}

/** The local fallback, for a deployment with no API. Unavailable unless a
 *  passcode has actually been configured — see localPasscode(). */
export function signInAdmin(passcode: string): boolean {
  const configured = localPasscode();
  if (!configured) return false;
  const ok = passcode.trim() === configured;
  if (ok) localStorage.setItem(KEY, 'yes');
  return ok;
}

export function signOutAdmin(): void {
  setSessionToken(null);
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

/**
 * The local lock's passcode, supplied at build time. There is deliberately NO
 * fallback value.
 *
 * It used to fall back to a literal string, which meant the production
 * passcode was committed to the repository and shipped inside the JavaScript
 * bundle. A default is worse than nothing here: it is a known credential that
 * unlocks every deployment that forgot to set the real one.
 *
 * Unset, the local lock is simply unavailable — the safe failure, and a cheap
 * one, because this gate only governs what the INTERFACE offers. Every write
 * is re-checked against a server session, which no amount of localStorage can
 * produce.
 */
export function localPasscode(): string {
  return ((import.meta.env.VITE_ADMIN_PASSCODE as string | undefined) ?? '').trim();
}

/** Whether the local lock can be used at all on this deployment. */
export function localLockConfigured(): boolean {
  return localPasscode().length > 0;
}
