import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './lib/auth'
import { EntitlementProvider } from './lib/entitlement'
import './design/tokens.css'
import './styles.css'
// Imported after every module stylesheet so its coarse-pointer rules win on
// touch devices without any of them needing !important.
import './touch.css'

// The site is split into 70+ lazily-loaded chunks (one per lab page), each
// named with a content hash. When a new version is deployed, those hashes
// change and the old chunk files are gone from the server — so a tab left
// open from before the deploy fails to fetch a lazy page the instant the
// visitor clicks into it, with no visible error, and normally never
// recovers until a manual reload picks up the current index.html. Vite
// fires this event for exactly that failure; reloading once re-fetches the
// current build and the navigation completes as if nothing happened. The
// sessionStorage guard stops a genuinely broken deploy from reload-looping.
window.addEventListener('vite:preloadError', () => {
  const key = 'rp-chunk-reload'
  if (sessionStorage.getItem(key)) return
  sessionStorage.setItem(key, '1')
  window.location.reload()
})
window.addEventListener('load', () => sessionStorage.removeItem('rp-chunk-reload'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        {/* Access sits directly on top of the account, so every route can ask
            one question — canAccess() — instead of inventing its own rule. */}
        <EntitlementProvider>
          <App />
        </EntitlementProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
