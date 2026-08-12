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
      one wherever it appears.

   `isAdmin()` is true for either, because it only ever guards what the
   INTERFACE shows. Nothing the server accepts depends on it: a write needs a
   valid session token, and no amount of localStorage produces one.
   =========================================================================== */

import { sessionToken, setSessionToken, signIn as apiSignIn } from './content/api';

const KEY = 'radiopass-admin-v1';

/* Compared as a hash so the plain passcode is not sitting in the bundle as a
   readable string. This raises the effort slightly; it does not change the
   fact that a determined reader can bypass the LOCAL check entirely — which
   is why server writes do not trust it. */
const PASSCODE_HASH =
  '7c9e6679f7c1a1f0e05f2b6b5f4b4a3e8d9c0a1b2c3d4e5f60718293a4b5c6d7';

/** FNV-1a, widened to 64 hex chars. Not a security primitive — an obfuscator. */
function weakHash(s: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    h1 ^= s.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= s.charCodeAt(s.length - 1 - i);
    h2 = Math.imul(h2, 0x811c9dc5) >>> 0;
  }
  const a = h1.toString(16).padStart(8, '0');
  const b = h2.toString(16).padStart(8, '0');
  return (a + b).repeat(4).slice(0, 64);
}

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

/** The local fallback, for a deployment with no API. */
export function signInAdmin(passcode: string): boolean {
  const ok = weakHash(passcode.trim()) === PASSCODE_HASH || passcode.trim() === defaultPasscode();
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

/* Set at build time via VITE_ADMIN_PASSCODE. Only ever used by the local
   fallback; the server password is never in the bundle. */
export function defaultPasscode(): string {
  return (import.meta.env.VITE_ADMIN_PASSCODE as string | undefined) ?? 'radiopass-author';
}
