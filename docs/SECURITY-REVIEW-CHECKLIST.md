# Security Review — Checklist

For the reviewing developer. Tick each, and write your finding next to it. **"Looks fine" is not a finding — say what you checked and how.**

Scope: `radiopass-website/` and `ANATOMY CLAUDE/frcr-anatomy/`. Everything else in the parent folder is an old backup and out of scope.

Severity: **CRITICAL** (fix before launch) · **HIGH** (fix before taking payments) · **MEDIUM** (fix within a month) · **LOW** (log it) · **OK**.

---

## A. Secrets and configuration

| # | Check | Finding | Severity |
|---|---|---|---|
| A1 | `.env` is gitignored and has never been committed anywhere | | |
| A2 | Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present; nothing else has leaked into client env | | |
| A3 | No secret is reachable in the built `dist/` output (grep the bundles) | | |
| A4 | Any `VITE_`-prefixed variable is safe to be public — by definition it ships to the browser | | |
| A5 | Supabase **service role key** appears nowhere in this repo or any build | | |

## B. Database — the real security boundary

The anon key is public by design. **Row Level Security is the only thing protecting user data.** Source: `radiopass-website/supabase/schema.sql`.

| # | Check | Finding | Severity |
|---|---|---|---|
| B1 | RLS is enabled on all three tables **in the live Supabase project**, not just in the schema file | | |
| B2 | Each policy restricts both read and write to `auth.uid() = user_id` | | |
| B3 | The `anon` role has no table grants | | |
| B4 | **Test it live:** sign in as user A, attempt to read user B's row. It must fail. | | |
| B5 | No other tables exist in the live project that the schema file doesn't mention | | |
| B6 | Storage buckets (if any) are not public | | |

## C. Authentication

| # | Check | Finding | Severity |
|---|---|---|---|
| C1 | Email confirmation required on signup | | |
| C2 | Rate limiting on signup and sign-in | | |
| C3 | Password policy is sane | | |
| C4 | Session handling — token refresh, sign-out clears state properly | | |
| C5 | Password reset flow cannot be abused to enumerate accounts | | |
| C6 | Nothing sensitive is stored in `localStorage` | | |

## D. Known issue — anatomy admin gate

`ANATOMY CLAUDE/frcr-anatomy/src/lib/admin.ts`. We believe this is **LOW** severity because that app makes no network writes and admin edits are localStorage-only. **Confirm or correct us.**

| # | Check | Finding | Severity |
|---|---|---|---|
| D1 | Confirm the app truly makes no authenticated or write requests anywhere | | |
| D2 | Confirm admin actions cannot affect any other user | | |
| D3 | Hardcoded fallback passcode `'radiopass-author'` — advise whether to remove | | |
| D4 | Advise what must change **before** any server-backed authoring is added | | |

## E. Application code

| # | Check | Finding | Severity |
|---|---|---|---|
| E1 | `dangerouslySetInnerHTML` — every use, and whether input can ever be user-controlled | | |
| E2 | Any user-supplied content rendered without escaping | | |
| E3 | URL parameters used unsafely (open redirect, injection into fetch) | | |
| E4 | `src/reference/` (~132 archived prototypes) genuinely excluded from the build | | |
| E5 | No debug or developer backdoor routes reachable in production | | |
| E6 | Error messages don't leak internals to the user | | |

## F. Dependencies and build

| # | Check | Finding | Severity |
|---|---|---|---|
| F1 | `npm audit` — we saw 0 vulnerabilities on 9 Aug 2026; re-run and confirm | | |
| F2 | Dev dependencies are not shipped in the production bundle | | |
| F3 | Any unmaintained or suspicious package among the 7 production dependencies | | |
| F4 | `package-lock.json` is committed and consistent | | |

## G. Deployment

`npm run package` produces `deploy/` — physics at root, anatomy at `/anatomy/`, plus a generated `.htaccess`.

| # | Check | Finding | Severity |
|---|---|---|---|
| G1 | `.htaccess` — HTTPS redirect, directory listing disabled, sensible headers | | |
| G2 | Security headers: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy | | |
| G3 | No source maps exposing original source in production | | |
| G4 | Nothing sensitive included in `deploy/` (no `.env`, no `.git`, no notes) | | |
| G5 | 404 handling doesn't leak server details | | |

## H. Before it takes money

Payments are not built yet. Please advise on what the review will need to cover once they are.

| # | Check | Finding | Severity |
|---|---|---|---|
| H1 | Requirements for integrating Paddle as merchant of record | | |
| H2 | How entitlement (paid vs free) should be enforced — must be server-side, never client-side | | |
| H3 | Webhook verification requirements | | |
| H4 | What personal data will be stored, and the GDPR implications | | |

---

## Summary

**Overall verdict:**

**Must fix before launch:**

**Must fix before taking payments:**

**Recommended within a month:**

**Anything the founder should know that wasn't asked about:**

---

*Reviewer:* ............................  *Date:* ....................
