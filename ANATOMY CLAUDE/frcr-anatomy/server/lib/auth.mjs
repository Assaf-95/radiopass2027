/* ===========================================================================
   Editor sign-in.

   A real boundary this time. The previous author lock compared a passcode
   that shipped inside the JavaScript bundle — it kept a candidate from
   wandering into the authoring tools, and it stopped nothing else, because a
   static site has nowhere to check a secret. Writes now go through a
   function, so the secret can live on the server and the check can be real:

     ATLAS_ADMIN_PASSWORD   the editor's password. Never sent to a browser.
     ATLAS_SESSION_SECRET   signs session tokens. Any long random string.

   Sign-in exchanges the password for a token signed with HMAC-SHA-256 and
   carrying its own expiry. Every write re-verifies it. Nothing about the
   token is secret, so it can sit in localStorage; it just cannot be forged
   without the server secret, and it stops working on its own after a week.

   Reads are deliberately public: learners have to be able to see the current
   images, and the overlay contains nothing that is not already on the page.
   =========================================================================== */

const encoder = new TextEncoder();

/** A week. Long enough not to be a nuisance for a session of editing, short
 *  enough that a token copied off a shared machine expires by itself. */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function base64url(bytes) {
  let binary = '';
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(payload, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return base64url(mac);
}

/** Constant-time-ish comparison. Both strings are the same length in every
 *  real case, and bailing early on the first differing byte would leak how
 *  much of a guess was right. */
function equals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function adminPassword(env) {
  return env.ATLAS_ADMIN_PASSWORD ?? '';
}

export function sessionSecret(env) {
  return env.ATLAS_SESSION_SECRET ?? '';
}

/** True when the deployment has been given both secrets. Without them the
 *  API stays read-only and says so, rather than pretending to accept edits. */
export function isConfigured(env) {
  return Boolean(adminPassword(env)) && Boolean(sessionSecret(env));
}

export async function createSession(env, now = Date.now()) {
  const payload = base64url(encoder.encode(JSON.stringify({ exp: now + TTL_MS })));
  const signature = await sign(payload, sessionSecret(env));
  return { token: `${payload}.${signature}`, expiresAt: new Date(now + TTL_MS).toISOString() };
}

export async function verifySession(env, token, now = Date.now()) {
  if (!token || !isConfigured(env)) return false;
  const [payload, signature] = String(token).split('.');
  if (!payload || !signature) return false;
  if (!equals(signature, await sign(payload, sessionSecret(env)))) return false;
  try {
    const json = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
      )
    );
    return typeof json.exp === 'number' && json.exp > now;
  } catch {
    return false;
  }
}

export function checkPassword(env, given) {
  const expected = adminPassword(env);
  if (!expected) return false;
  return equals(String(given ?? ''), expected);
}

/** Pulls the bearer token off a request. */
export function bearer(request) {
  const header = request.headers.get('authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}
