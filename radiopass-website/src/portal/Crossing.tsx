/**
 * The crossing to the anatomy half.
 *
 * The portal's anatomy door points at /anatomy — a real folder on the combined
 * host, where the server serves it and React never sees the path. But on any
 * deployment WITHOUT that folder (the dev server, the split Netlify pair), the
 * SPA fallback catches /anatomy and, until this existed, the door was simply
 * dead: the one thing the front door promises — that the two halves are one
 * product — failed the moment anyone tried it.
 *
 * This route is the self-healing half of that promise. It mounts only when the
 * folder is absent, shows the crossing for one breath so the navigation never
 * feels like an error, and carries the whole address across — subpath and hash
 * included, so an author's deep link to /anatomy/#/disputes arrives at the
 * disputes page, not the anatomy homepage.
 */

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import './portal.css'

/** Where anatomy lives when this host does not carry the folder. The Netlify
 * pair was deleted on the user's instruction (2026-08-09), so the only other
 * home is the production domain, which serves the combined deploy/. */
const ANATOMY_FALLBACK =
  (import.meta.env.VITE_ANATOMY_URL as string | undefined)?.replace(/\/$/, '')
  ?? 'https://radiopass.co.uk/anatomy'

export default function Crossing() {
  const location = useLocation()

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Crossing to Anatomy · RadioPass'
    // Everything after /anatomy belongs to the anatomy app: its hash routes
    // (#/section/…) and any subpath. Reassemble the address on the other side.
    const rest = location.pathname.replace(/^\/anatomy\/?/, '/')
    const target = `${ANATOMY_FALLBACK}${rest === '/' ? '' : rest}${location.search}${location.hash}`
    // `replace`, not `href`: the crossing must not sit in history, or the back
    // button returns to a page whose only act is to leave again.
    const t = setTimeout(() => window.location.replace(target), 450)
    // If the crossing is left before the handover fires — a back press inside
    // the 450ms, or a host that does carry the folder after all — the tab must
    // not keep announcing a crossing that never happened.
    return () => { clearTimeout(t); document.title = previousTitle }
  }, [location])

  return (
    <main className="pt-root pt-crossing">
      <div className="pt-crossing-body">
        <span className="pt-wordmark">RADIOPASS</span>
        <p className="pt-crossing-note" aria-live="polite">
          Crossing to <strong>Anatomy</strong>…
        </p>
        <span className="pt-crossing-rail" aria-hidden="true"><i /></span>
      </div>
    </main>
  )
}
