import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigationType } from 'react-router-dom';
import { hasServerSession, isAdmin } from '../lib/admin';
import { contentState, loadContent, subscribeContent } from '../lib/content/store';
import { currentStreak, getActivity, storageWorks } from '../lib/account';
import './Layout.css';

/* Deliberately a new key. The previous one was written on every mount, so
   every browser that ever loaded the old dark-by-default build has "dark"
   stored whether or not anyone chose it — reading that back would keep the
   house style from ever appearing. Under this key only an actual toggle
   writes, so a stored value now means a real preference. */
const THEME_KEY = 'radiopass-theme-v2';

/* Where the physics half of RadioPass lives. Detected at runtime rather than
   fixed at build time, so ONE build of this app links correctly from both of
   its homes: served under /anatomy/ on the combined host, physics is the same
   domain's root; served at a domain root of its own (the split Netlify pair),
   '/' would be this app's own homepage — a link that goes nowhere — so it
   crosses to the physics deployment instead. VITE_PHYSICS_URL overrides both. */
const PHYSICS_URL =
  (import.meta.env.VITE_PHYSICS_URL as string | undefined)
  ?? (typeof window !== 'undefined' && window.location.pathname.startsWith('/anatomy')
    ? '/'
    : 'https://radiopass.co.uk');

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    // The RadioPass house style is the charcoal reading room, as on Physics.
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return {
    theme,
    toggle: () =>
      setTheme((t) => {
        const next = t === 'dark' ? 'light' : 'dark';
        localStorage.setItem(THEME_KEY, next);
        return next;
      }),
  };
}

/* A new page starts at the top.
 *
 * Nothing was resetting the scroll on navigation, so following a link from
 * halfway down one page landed halfway down the next — most visibly in the
 * Atlas, where clicking a related structure from the bottom of a long gallery
 * dropped you straight into the bottom of the next one.
 *
 * Back and forward are left alone: returning to a page you have already
 * scrolled should put you back where you were, which is what the browser's
 * own restoration does. Only a NEW navigation resets.
 *
 * useLayoutEffect, not useEffect, so the jump happens before the browser
 * paints — and so that a page with a deliberate scroll of its own (the home
 * page honouring ?goto=modules) runs after this and wins. */
function useScrollToTopOnNavigate(pathname: string) {
  const navigationType = useNavigationType();
  useLayoutEffect(() => {
    if (navigationType === 'POP') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, navigationType]);
}

export default function Layout() {
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const isQuestionRoute = /\/q\//.test(location.pathname);
  useScrollToTopOnNavigate(location.pathname);

  /* Bumped to re-read the study record below. It lives in localStorage, not in
     React state, so a submission in this tab or another one needs a nudge to
     show up in the header. */
  const [, setRecordRev] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* The nav floats over the hero with nothing behind it and only takes its
     bar once the page has moved, exactly as the home-page mock-ups show. */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const refresh = useCallback(() => setRecordRev((n) => n + 1), []);

  /* Every route renders inside this component, so subscribing here is what
     makes a content change repaint the whole site — the question a candidate
     is looking at, the Atlas gallery behind them, and the editor's own page
     the instant it saves. Without it a replaced image only appeared after a
     manual reload, which is exactly the "did that save?" doubt the online
     editor exists to remove. */
  const [, setContentRev] = useState(() => contentState().overlay.rev);
  useEffect(
    () => subscribeContent(() => setContentRev(contentState().overlay.rev)),
    []
  );

  /* Coming back to the tab re-reads the content, so a change made on another
     device — or in the editor in a second tab — is picked up without a
     reload. Cheap: one small JSON request, and only when the tab is shown. */
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') loadContent(true);
    }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  /* Another tab in the same browser writes to the same study record, so a
     submission there should be reflected here rather than diverging. */
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === null || e.key.startsWith('radiopass-')) refresh();
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const activity = getActivity();
  const streak = currentStreak(activity.days);

  return (
    <div className="app-shell">
      {!isQuestionRoute && (
        <header className={scrolled ? "app-header is-scrolled" : "app-header"}>
          <div className="app-header-inner">
            <Link to="/" className="brand">
              <span className="brand-mark">RadioPass</span>
              {/* Which half of the product this is. The portal's doors and the
                  physics module headers use the same two words. */}
              <span className="brand-sub">Anatomy</span>
            </Link>

            <nav className="app-nav">
              {/* Information first: the syllabus leads, the labs follow. */}
              <Link to="/?goto=modules">Modules</Link>
              {/* The second way into the same material: structure first
                  rather than question first. */}
              <Link to="/atlas">Atlas</Link>
              {/* The third way in: region first. A scout down the body that
                  hands you into that region's questions. */}
              <Link to="/volume">Scout</Link>
              <Link to="/cxr">X-ray</Link>
              <Link to="/mri/head-bone">CT</Link>
              <Link to="/mri/hip-axial-t1">MRI</Link>
              <Link to="/dashboard">Progress</Link>
              <Link to="/disputes">Disputes</Link>
              {isAdmin() && <Link to="/admin">Editor</Link>}
              {/* The other half of RadioPass. A plain <a> because it leaves
                  this app: '/' is the physics site when both halves share a
                  domain (the drop-in deploy); override for split hosting. */}
              <a className="app-nav-physics" href={PHYSICS_URL}>Physics ↗</a>
            </nav>

            <div className="app-header-actions">
              {streak > 0 && (
                <span className="app-streak" title={`${activity.days.length} days studied`}>
                  {streak}-day streak
                </span>
              )}

              <button type="button" className="theme-toggle" onClick={toggle} title="Toggle theme">
                {theme === 'dark' ? '☾' : '☀'}
              </button>

              <Link className="app-cta" to="/?goto=modules">
                Start Learning
                <span aria-hidden="true">→</span>
              </Link>

              <div className="app-account" ref={menuRef}>
                <button
                  type="button"
                  className="account-chip"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                >
                  <span className="account-avatar" aria-hidden="true">
                    {streak > 0 ? streak : '·'}
                  </span>
                  <span className="account-plan mono">Progress</span>
                </button>
                {menuOpen && (
                  <div className="account-menu" role="menu">
                    {/* What this browser has recorded. No name, no email and no
                        plan: this app has no server to check any of them
                        against, and the sign-in that used to collect them
                        checked nothing. Study numbers are real — every one of
                        these is written when the learner actually does the
                        work. */}
                    <p className="account-name">Your study record</p>
                    <p className="account-email">Kept on this browser</p>
                    <dl className="account-facts mono">
                      <div>
                        <dt>Day streak</dt>
                        <dd>{streak}</dd>
                      </div>
                      <div>
                        <dt>Days studied</dt>
                        <dd>{activity.days.length}</dd>
                      </div>
                      <div>
                        <dt>Submitted</dt>
                        <dd>{activity.submissions}</dd>
                      </div>
                    </dl>
                    <Link to="/dashboard" className="account-link" onClick={() => setMenuOpen(false)}>
                      Your progress
                    </Link>
                    {/* The way into the editing tools, and the fix for a real
                        lockout: the only link to /admin used to be the nav
                        item above, which renders only for someone ALREADY
                        signed in. On a new browser — or on the deployed site,
                        where the flag had never been set — there was no way
                        to reach the sign-in page at all, and every editing
                        tool behind it was unreachable with it. This entry is
                        always present, and quiet enough to stay out of a
                        candidate's way. */}
                    <Link to="/admin" className="account-link" onClick={() => setMenuOpen(false)}>
                      {isAdmin()
                        ? (hasServerSession() ? 'Editor tools · live' : 'Editor tools · this browser')
                        : 'Editor sign-in'}
                    </Link>
                    <p className="account-note">
                      {storageWorks()
                        ? 'Your work stays in this browser on this machine. It survives closing the tab, but it does not follow you to another device.'
                        : 'This browser is not storing data — private browsing, most likely. You can work, but nothing will be here when you come back.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
      )}
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
