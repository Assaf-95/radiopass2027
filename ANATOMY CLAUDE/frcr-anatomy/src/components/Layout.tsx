import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import SignIn from './SignIn';
import { hasServerSession, isAdmin } from '../lib/admin';
import { contentState, loadContent, subscribeContent } from '../lib/content/store';
import {
  currentStreak,
  getAccount,
  getActivity,
  PLAN_LABEL,
  signOut,
  type Account,
} from '../lib/account';
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

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export default function Layout() {
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const isQuestionRoute = /\/q\//.test(location.pathname);

  const [account, setAccount] = useState<Account | null>(() => getAccount());
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

  const refresh = useCallback(() => setAccount(getAccount()), []);

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

  /* Another tab in the same browser is the same account, so a sign-out or a
     new submission there should be reflected here rather than diverging. */
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

  if (!account) return <SignIn onSignedIn={refresh} />;

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
                  <span className="account-avatar">{initials(account.name)}</span>
                  <span className="account-plan mono">{PLAN_LABEL[account.plan]}</span>
                </button>
                {menuOpen && (
                  <div className="account-menu" role="menu">
                    <p className="account-name">{account.name}</p>
                    <p className="account-email">{account.email}</p>
                    <dl className="account-facts mono">
                      <div>
                        <dt>Plan</dt>
                        <dd>{PLAN_LABEL[account.plan]}</dd>
                      </div>
                      <div>
                        <dt>Member since</dt>
                        <dd>{account.memberSince}</dd>
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
                    <button
                      type="button"
                      className="account-link account-signout"
                      onClick={() => {
                        signOut();
                        setMenuOpen(false);
                        refresh();
                      }}
                    >
                      Sign out
                    </button>
                    <p className="account-note">
                      Signing out keeps your work. It is still here next time.
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
