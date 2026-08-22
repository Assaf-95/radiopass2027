# Deploying RadioPass on Cloudflare Pages

Replaces the drag-a-folder-onto-the-host method. You push to GitHub; Cloudflare
builds and publishes. Every deploy is versioned and can be rolled back in one
click, and every pull request gets its own preview URL.

Repository: `Assaf-95/radiopass2027` — branch `main` is production.

---

## 1. One-time setup

Cloudflare dashboard -> **Workers & Pages** -> **Create** -> **Pages** ->
**Connect to Git** -> pick `Assaf-95/radiopass2027`.

Then set exactly this:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Framework preset | **None** |
| Root directory | `radiopass-website` |
| Build command | `npm run package` |
| Build output directory | `deploy` |

**Root directory matters.** The app is not at the top of the repository. Leave
it blank and the build fails with "no package.json found".

**Build output is `deploy`, not `dist`.** `npm run package` typechecks, builds,
then *verifies* the result — that the anatomy media reached the bundle and the
host-config files came with it. A missing film on the live site is the failure
it exists to catch, so it is worth the extra step over a plain `vite build`.

Node version comes from `radiopass-website/.nvmrc` (currently `22`). Cloudflare
reads that file automatically. Without it Pages picks an old default and the
build fails on Vite.

---

## 2. Environment variables — the step that silently breaks everything

`radiopass-website/.env` is **not** in the repository, and it should never be.
So Cloudflare has no copy of it, and a build without these produces a site that
looks completely normal and has **no login, no saved progress, and no editable
content** — because the Supabase client is simply `null`.

In **Settings -> Environment variables**, add to **both** Production and Preview:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://zrjhdpgkwiotkforjiin.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | your `sb_publishable_...` key |

These are safe to store here. The publishable key is designed to be readable by
every visitor — it is already compiled into the JavaScript the browser
downloads. What protects the data is row-level security in Supabase, not the
secrecy of this key.

Do **not** set `VITE_CONTENT_API`. There is no Node API on Cloudflare, and
leaving it unset is what makes the app use the Supabase content backend, which
is the one you actually edit through.

After adding variables, **redeploy** — they are read at build time, so an
existing deployment will not pick them up.

---

## 3. Publishing a change

```bash
git add -A && git commit -m "what changed" && git push
```

Cloudflare builds within a minute or two and publishes automatically. Watch it
under **Deployments**.

Content edits made in the admin pages do **not** need a deploy. They are stored
in Supabase and appear immediately — that is the point of the overlay.
A deploy is only for code changes.

---

## 4. If a deploy goes wrong

**Deployments** -> find the last good one -> **Rollback to this deployment**.
Live again in seconds. This is the main thing the old drag-and-drop method
could not do.

The GitHub Actions gate (`.github/workflows/ci.yml`) runs the typecheck, the
question-map validators and the full test suite on every push. If it is red,
treat the deploy as suspect even if Cloudflare published it — Pages does not
wait for tests.

---

## 5. Custom domain

**Custom domains** -> **Set up a domain** -> `radiopass.co.uk`, then repeat for
`www.radiopass.co.uk`.

DNS is at GoDaddy (`ns23/ns24.domaincontrol.com`), so Cloudflare will give you
records to add there rather than doing it itself. There are no MX records on
this domain and no mail, so DNS changes here cannot break an inbox.

---

## 6. What carried over unchanged

`public/_redirects` and `public/_headers` were written for Netlify, and
Cloudflare Pages reads both in the same format:

- `/*  /index.html  200` — deep links like `/anatomy/atlas` fall back to the
  app shell instead of 404ing.
- hashed assets cached forever, `index.html` never cached — so a new deploy is
  picked up immediately rather than after a browser cache expires.

`public/.htaccess` is ignored by Cloudflare. It stays for the cPanel/GoDaddy
host and costs nothing. If you change one file's intent, change the other to
match, or the same build behaves differently depending where it lands.
