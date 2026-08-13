# frcr-anatomy — retired application, retained evidence

**The anatomy application is no longer here.** It was merged into the one RadioPass
application and now lives at:

```
radiopass-website/src/anatomy/      source
radiopass-website/public/anatomy/   images, CT/MRI/CXR media
radiopass-website/server/           the content API, unchanged
radiopass-website/scripts/          anatomy:verify, questions:validate, build-hero-frames
```

`/anatomy` is a route of that application. There is one React root, one router, one account,
one entitlement model and one learner event log. Old `/anatomy/#/…` links still resolve — the
app redirects them to real paths.

The app scaffolding here (its `index.html`, `vite.config.ts`, tsconfigs, `package.json` and
`src/` entry files) has been removed, because keeping a second buildable copy of an application
is how the two drift apart.

## What is still here, and why

| Folder | Kept because |
|---|---|
| `qa/copyright/` | The image provenance and copyright audit. Evidence, and a live decision the owner has not made. Not to be modified or moved as a side effect of engineering work. |
| `qa/duplicates/` | The duplicate-question audit, same reasoning. |
| `tools/` | The Python skull-frame pipeline (`prepare_frames.py`). Run by hand; its output feeds `public/anatomy/images/hero/skull`. |
| `source-material/` | Extraction inputs. |
| `netlify/edge-functions/gate.ts` | The HTTP Basic gate used by one deployment target. |
| `DEPLOY.md` | Deployment notes for the anatomy content API, still accurate for `server/`. |

Nothing in this folder is built, imported or served. If you are looking for anatomy code,
it is in `radiopass-website/src/anatomy/`.
