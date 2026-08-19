import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigationType } from 'react-router-dom';
import { hasServerSession, isAdmin } from '../lib/admin';
import { contentState, loadContent, subscribeContent } from '../lib/content/store';
import { currentStreak, getActivity, storageWorks } from '../lib/account';
import { progressSyncFailing, subscribeProgress } from '../lib/progress';
import { useAuth } from '../../lib/auth';
import { useTheme, ThemeToggle } from '../../design/theme';
import { Logo } from '../../design/logo';
import './Layout.css';

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
  /* The shared hook (same key, same attribute as the local one it replaced).
     Called here — not only inside <ThemeToggle/> — because the header does
     not render on question routes, and the attribute must still be stamped
     on <html> when a learner lands directly on a question. */
  useTheme();
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

  /* The account note below reports whether progress is actually reaching the
     account, and that answer changes after the first push or pull rather than
     at sign-in. Without this the menu would keep showing whatever was true
     when it was first painted. */
  const [, setSyncRev] = useState(0);
  useEffect(() => subscribeProgress(() => setSyncRev((n) => n + 1)), []);

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
            {/* The one lockup every header renders: convergence mark,
                RADIOPASS, and the branch word saying which half you are
                standing in — the same component the physics header mounts. */}
            <Link to="/anatomy" className="rpa-brand">
              <Logo branch="Anatomy" markHeight={22} />
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

              {/* The shared control, keeping this header's own sizing class
                  (Layout.css styles .theme-toggle). */}
              <ThemeToggle className="theme-toggle" />

              {/* The same words and the same destination as the physics
                  header. Two different primary buttons — "Start Learning"
                  here, "Start free trial" there — made the two halves look
                  like two products with two different offers. */}
              <Link className="app-cta" to="/free-trial">
                Start free trial
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
                    {/* Says what is actually true, not what is intended.
                        This line used to read "your progress follows this
                        account between devices" the moment anyone signed in,
                        while anatomy wrote to localStorage and nowhere else —
                        a promise the storage did not keep. Progress is
                        account-backed now, but "the code syncs" and "this
                        deployment's Supabase actually has the table" are
                        different things, so the signed-in wording is driven
                        by whether syncing is really working rather than by
                        the fact of being signed in. */}
                    <p className="account-note">
                      {!storageWorks()
                        ? 'This browser is not storing data — private browsing, most likely. You can work, but nothing will be here when you come back.'
                        : !user
                        ? 'Your work stays in this browser on this machine. It survives closing the tab, but it does not follow you to another device.'
                        : progressSyncFailing()
                        ? 'Signed in, but your progress is not reaching your account at the moment. It is saved in this browser, so nothing is lost.'
                        : 'Your progress follows this account between devices.'}
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
