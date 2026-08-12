# Deploying RadioPass

One command builds everything into one folder:

```bash
npm run package
```

That produces **`deploy/`** — the entire product as a static tree:

```
deploy/
  index.html, assets/, favicon.svg, .htaccess, 404.html   ← physics + portal, at the domain root
  anatomy/                                                ← the anatomy site, at /anatomy/
```

## To go live

Copy the **contents** of `deploy/` into the host's web root (`public_html` on
Hostinger/GoDaddy-style shared hosting). That is the whole deployment — no
build step on the server, no configuration panel, no environment variables.

- Make sure the copy includes the **hidden `.htaccess` file** — some FTP
  clients skip dotfiles by default. Without it, refreshing a deep link like
  `/mri/slice-selection` returns a 404.
- The portal at `/` links Anatomy to `/anatomy/` automatically. Both halves
  share the domain, so the author passcode unlock works across both.

## Why it works on a plain host

- The physics site is a single-page app. The shipped `.htaccess` sends any
  path that is not a real file back to the app shell (Apache/LiteSpeed — what
  the shared hosts run). `404.html` is a copy of the shell for hosts that use
  a 404 document instead of rewrites.
- The anatomy site routes with URL hashes (`/anatomy/#/section/…`) and is
  built with relative asset paths, so it works from any folder with no server
  help at all.

## Notes for later

- **Hosting anatomy separately again** (e.g. its own subdomain): build the
  physics site with `VITE_ANATOMY_URL=https://anatomy.example.com` so the
  portal and admin console point across, and the anatomy site with
  `VITE_PHYSICS_URL=https://example.com` so its header's "Physics ↗" link
  points back. Defaults are `/anatomy` and `/` — correct for shared hosting.
- **The old Netlify password gate does not carry over.** The anatomy site's
  own sign-in and author passcode still work (they live in the app), but the
  HTTP Basic Auth in front of the whole site was a Netlify Edge Function. The
  shared-host equivalent is a directory password on the folder — real
  server-side protection, one panel setting.
- **The Netlify sites are gone.** Both RadioPass deployments were deleted
  from the Netlify account on 2026-08-09 at the owner's request; the six
  unrelated sites on the account were left alone. `netlify.toml` and
  `_redirects` remain in the repo (harmless on other hosts) in case Netlify
  is ever used again — but until `deploy/` is copied to the new host, the
  product is not live anywhere.
- Supabase (accounts, progress sync) is origin-independent — no change needed
  for a new domain, but add the new domain to the Supabase project's allowed
  redirect URLs so password-reset emails link back correctly.
