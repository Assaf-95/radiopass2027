# Deploying RadioPass Anatomy

## Build

```bash
npm ci
npm run build
```

Everything to publish is in `dist/` (~41 MB, mostly imaging).

## Hosting

The app is a **static site** — upload the *contents* of `dist/` to any static
host (Hostinger, Netlify, Vercel, S3 + CloudFront, GitHub Pages, or a plain
`public_html`).

Online editing is an **optional companion service** (`server/`). Without it
the site works exactly as it always has; with it, images and labels can be
edited on the live site and the changes are saved centrally. Nothing about
the front end is tied to a particular host — see *Online editing* below.

Two decisions already made so this "just works":

- **Hash routing.** URLs look like `/#/section/spine/q/spine-p0008`. No
  rewrite rules, no 404 fallback config — a plain file server is enough.
- **Relative asset paths** (`base: './'` in `vite.config.ts`) for the bundle,
  and `assetUrl()` (`src/lib/assetUrl.ts`) for the imagery, which is written
  root-absolute in the JSON data. Both are needed: `base` cannot rewrite
  strings inside JSON, so without the helper a subfolder install served every
  film from the wrong place and the viewers came up blank with no error. The
  same `dist/` now works at a domain root, on a subdomain, and inside a
  subfolder with no rebuild — verified by serving it from `/anatomy/`.

It does **not** work by double-clicking `dist/index.html`. The bundle is an
ES module, and browsers refuse to load modules over `file://`. It has to be
served over http — by a host, or locally with `python3 -m http.server`.

### Checks after upload

1. Home page loads and the body scrolls.
2. Open a question — the film renders (images are ~40 MB total, so give the
   first load a moment on a slow connection).
3. Answer one label and submit — marking and progress should appear.

## What is stored, and where

All learner data — answers, marks, streak, quiz scores, annotation overrides
— lives in that browser's `localStorage`. Nothing is transmitted, and there
is no account server. Consequences worth stating plainly to users:

- Progress survives closing the browser and restarting the machine.
- It does **not** follow a user to another device or another browser.
- Clearing site data erases it.

If you later want cross-device sync or real accounts, that needs a backend;
none of the current code assumes one.

## Fonts

`index.html` pulls Fraunces, Inter and JetBrains Mono from Google Fonts. If
the site must work fully offline or without third-party requests, self-host
those three families and swap the `<link>` for a local stylesheet.

## Imagery and patient data

Every film served has been cropped or masked so no burned-in patient
identifier is present. Two separate checks were needed, because they catch
different things:

- **Coloured-pixel count** finds PACS annotation layers, which are coloured
  where CT/MRI pixel data is grey. Zero remain in the CT (33 slices), MRI
  (38) and chest radiographs.
- **Bright-on-dark glyph detection** finds overlay text burned into the
  collimation border. This is white on black, so the colour test is blind to
  it. It found two lines in the bottom-left corner of `radiograph-2.png`,
  now painted out. Masked rather than cropped, because the atlas positions
  its 40 structures by percentage and a crop would move every annotation.
  The `R` side marker is deliberately kept — that is anatomy, not identity. Source page furniture
(case numbers, printed question boxes) has been removed as described in
`tools/` and the audit notes. Two source "images" that are printed answer
pages are flagged `excludeFromPlay` and withheld from the question bank
rather than deleted.


---

# Online editing

Replacing an image, moving arrows, showing or hiding A/B/C/D/E, and editing
Atlas captions can all be done on the deployed site, by a signed-in editor,
without touching the repository.

The rule the whole design rests on: **there is one dataset and two interfaces
over it.** The Question Bank and the Structure Atlas both read questions
through `getSectionQuestions()`, which applies the editor's saved changes. So
a replaced image appears in the question AND in every Atlas gallery that
shows it, from one save, with nothing to rebuild and no second copy anywhere.

## It is not tied to a host

The API is a plain `Request -> Response` handler in `server/lib/handler.mjs`.
No host SDK, no platform assumptions. What varies between hosts is one small
storage driver and one entry point:

| Host | How to run it |
| --- | --- |
| VPS / shared hosting with Node / Render / Railway / Fly / Docker | `node server/server.mjs` |
| An Express app you already run | `server/adapters/express.mjs` |
| Netlify | copy `server/adapters/netlify.mjs` to `netlify/functions/content.mjs`, `npm i @netlify/blobs`, set `CONTENT_STORE=netlify-blobs` |
| Vercel | copy `server/adapters/vercel.mjs` to `api/[...path].mjs` |

Moving hosts means changing which of those you use. It does not mean
rewriting the API, the editor, or anything in `src/`. Adding a driver for a
new backend is four methods in `server/lib/stores.mjs`.

## Running it

```bash
node server/server.mjs
```

| Variable | |
| --- | --- |
| `PORT` | default 8788 |
| `CONTENT_STORE` | `fs` (default) or `netlify-blobs` |
| `CONTENT_DIR` | where `fs` storage lives. Default `./.content`. **Must be on a disk that survives redeploys.** |
| `STATIC_DIR` | optional — point at `dist/` to serve the site from the same process |
| `ATLAS_ADMIN_PASSWORD` | **required for editing.** The editor's password. Never reaches a browser. |
| `ATLAS_SESSION_SECRET` | **required for editing.** Any long random string; signs session tokens. |

Site and API from one process:

```bash
STATIC_DIR=./dist ATLAS_ADMIN_PASSWORD='...' ATLAS_SESSION_SECRET='...' node server/server.mjs
```

If the site is served from one place and the API from another, point the front
end at it with `VITE_CONTENT_API=https://api.example.com/api` at build time.

**Without the two secrets** the API still serves whatever has been saved, and
refuses new edits with a message saying so. That is deliberate: a
misconfigured deployment should be read-only, not silently accept changes it
cannot check.

## Signing in

Account menu (top right) -> **Editor sign-in**, or go to `#/admin` directly.

The password is checked by the server, so it is a real boundary — unlike the
old author passcode, which shipped inside the JavaScript. With no API
reachable the form falls back to that browser-only lock and says so; the
editing tools still work, but changes stay on that machine.

## Editing

From a question: **Edit image & labels** in the header.
From the Atlas: **Edit this film** under any image, or in the lightbox.

Both open the same editor and write the same record — it does not matter
which side you start from.

- **Replace image** — upload, preview against the current one, save. The
  answer, the structure association and the question id are untouched;
  replacing an asset is not a change of meaning.
- **Remove image** — soft. The question, its answers and its teaching stay;
  the film stops being shown in both interfaces and can be restored.
- **Arrows and labels** — place, drag, nudge with arrow keys; per label the
  pointer style, angle, length, thickness and colour.
- **Asked / In Atlas** — two separate switches per letter. Turning a letter
  off stops the candidate being asked it; the anatomy stays in the Atlas
  unless you also withdraw the association. Letters never renumber: answers
  are stored against their letter, so hiding A and B leaves C as C.
- **Atlas metadata** — description, modality, plane, sequence. The Atlas uses
  them immediately.

## Local development

`npm run dev` runs the same API over `.content-dev/` through a Vite
middleware, so the editing paths are exercised locally rather than first on
the live site. Put the two secrets in `.env.local`:

```
ATLAS_ADMIN_PASSWORD=local-editor
ATLAS_SESSION_SECRET=any-long-random-string
```

Deleting `.content-dev/` resets local edits to the bundled bank.

## What is stored where

- **Uploaded images** — in the content store, served at `/api/asset/<id>`.
  Every upload gets a new id, so a replacement can never be masked by a
  cached URL, and assets are safe to cache for a year.
- **The overlay** — one JSON document: which asset each question uses, which
  labels are shown, Atlas metadata, relationship notes. Sent with `no-store`.
- **A change log** — the last 500 edits, shown on the editor page.
- **Learner progress** — still `localStorage`, unchanged, never sent anywhere.

The browser also keeps a copy of the overlay in `localStorage` so the first
paint is not blank. That is a cache of server state, not the record: edits
survive a different browser, a different machine and a redeploy.
