import { useEffect, useState } from 'react'

/* The one theme mechanism for the whole product.
 *
 * Lifted verbatim from the anatomy Layout (which owned theming while only
 * anatomy had a light palette) so that every header — portal, physics,
 * question bank, anatomy — offers the same toggle writing the same key.
 *
 * Deliberately a new key when introduced ('-v2'): the previous one was
 * written on every mount, so every browser that ever loaded the old
 * dark-by-default build had "dark" stored whether or not anyone chose it.
 * Under this key only an actual toggle writes, so a stored value means a
 * real preference. Dark is the RadioPass house style; light is the
 * explicit choice. */
const THEME_KEY = 'radiopass-theme-v2'

export type Theme = 'light' | 'dark'

function readStored(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* Storage can be denied (private mode, embeds); the default stands. */
  }
  return 'dark'
}

/* Two headers never render at once, but a toggle in one must not be
   forgotten by the next: state initialises from the attribute if a
   previous surface already stamped it this session. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stamped = document.documentElement.getAttribute('data-theme')
    if (stamped === 'light' || stamped === 'dark') return stamped
    return readStored()
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return {
    theme,
    toggle: () =>
      setTheme((t) => {
        const next: Theme = t === 'dark' ? 'light' : 'dark'
        try {
          localStorage.setItem(THEME_KEY, next)
        } catch {
          /* If storage is denied the choice still applies to this page. */
        }
        return next
      }),
  }
}

/* The control itself: one quiet icon button, same everywhere. The caller
   passes its surface's class so each header keeps its own sizing rules
   (anatomy already styles .theme-toggle; the shared header styles
   .rp-theme-toggle). */
export function ThemeToggle({ className = 'rp-theme-toggle' }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      className={className}
      onClick={toggle}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? (
        /* Moon — shown while dark, meaning "currently dark". */
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      ) : (
        /* Sun — shown while light. */
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )}
    </button>
  )
}
