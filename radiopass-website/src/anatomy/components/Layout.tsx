import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigationType } from 'react-router-dom';
import { hasServerSession, isAdmin } from '../lib/admin';
import { contentState, loadContent, subscribeContent } from '../lib/content/store';
import { currentStreak, getActivity, storageWorks } from '../lib/account';
import { useAuth } from '../../lib/auth';
import './Layout.css';

/* Deliberately a new key. The previous one was written on every mount, so
   every browser that ever loaded the old dark-by-default build has "dark"
   stored whether or not anyone chose it — reading that back would keep the
   house style from ever appearing. Under this key only an actual toggle
   writes, so a stored value now means a real preference. */
const THEME_KEY = 'radiopass-theme-v2';


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
  /* THE SAME LEARNER AS PHYSICS. Before the merge anatomy was a separate
     build and could not see the account at all, so its header could only ever
     talk about "this browser". It now reads the one RadioPass session. */
  const { user, signOut, configured } = useAuth();

  return (
    <div className="app-shell">
      {!isQuestionRoute && (
        <header className={scrolled ? "app-header is-scrolled" : "app-header"}>
          <div className="app-header-inner">
            {/* The wordmark only. The sub-label used to read "Anatomy" beside
                it, which since the nav gained real branch links said the same
                word twice AND physically overlapped the "Anatomy" link 34px to
                its right. Which branch you are in is the nav's job now, and it
                marks it as current. */}
            <Link to="/anatomy" className="rpa-brand">
              <span className="rpa-brand-mark">RadioPass</span>
            </Link>

            {/* ONE NAVIGATION LANGUAGE ACROSS BOTH BRANCHES.
                The same shape the physics header uses: the two branches
                first, then the tools of the branch you are actually in, then
                the trial. That anatomy is a separate Vite build is an
                implementation detail and must never be something the learner
                can feel — so the first group and the trial entry are
                identical on both sides, and only the middle group differs. */}
            <nav className="app-nav">
              <Link className="app-nav-branch is-here" to="/anatomy">Anatomy</Link>
              {/* A plain <a> because it leaves this build. */}
              <Link className="app-nav-branch" to="/physics">Physics</Link>
              <span className="app-nav-divider" aria-hidden="true" />

              {/* Anatomy's own tools — the four that match the branch's four
                  destinations, and no more. The cross-sectional viewers and
                  the disputes list moved to the home page: thirteen items in
                  this bar crushed the wordmark to nothing at 1280px and still
                  overflowed the container by 97px. */}
              <Link to="/anatomy?goto=modules">Question bank</Link>
              <Link to="/anatomy/atlas">Atlas</Link>
              <Link to="/anatomy/volume">Scout</Link>
              <Link to="/anatomy/dashboard">Progress</Link>
              {isAdmin() && <Link to="/anatomy/admin">Editor</Link>}

              <span className="app-nav-divider" aria-hidden="true" />
              {/* Same destination the physics header offers, so the trial is
                  reachable from anywhere in the product. */}
              <Link className="app-nav-trial" to="/free-trial">Free trial</Link>
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

              <Link className="app-cta" to="/anatomy?goto=modules">
                Start Learning
                <span aria-hidden="true">→</span>
              </Link>

              <div className="app-account" ref={menuRef}>
                <button
                  type="button"
                  className="rpa-account-chip"
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
                    {/* One account across both branches. The study numbers
                        below are real either way — they are written when the
                        learner does the work — but WHOSE they are is now a
                        question the app can answer. */}
                    <p className="account-name">{user ? 'Signed in' : 'Your study record'}</p>
                    <p className="account-email">
                      {user ? user.email : configured ? 'Not signed in' : 'Kept on this browser'}
                    </p>
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
                    <Link to="/anatomy/dashboard" className="account-link" onClick={() => setMenuOpen(false)}>
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
                    <Link to="/anatomy/admin" className="account-link" onClick={() => setMenuOpen(false)}>
                      {isAdmin()
                        ? (hasServerSession() ? 'Editor tools · live' : 'Editor tools · this browser')
                        : 'Editor sign-in'}
                    </Link>
                    {/* One sign-in, one sign-out, for the whole product. */}
                    {configured && (user ? (
                      <button
                        type="button"
                        className="account-link account-signout"
                        onClick={() => { setMenuOpen(false); void signOut(); }}
                      >
                        Sign out
                      </button>
                    ) : (
                      <Link to="/login" className="account-link" onClick={() => setMenuOpen(false)}>
                        Sign in
                      </Link>
                    ))}
                    <p className="account-note">
                      {user
                        ? 'Your progress follows this account between devices.'
                        : storageWorks()
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
