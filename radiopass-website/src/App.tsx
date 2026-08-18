import { Component, lazy, Suspense, useEffect, useState, type ChangeEvent, type ComponentType, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { LEGACY_PHYSICS_ROOT, PHYSICS_HREF, PHYSICS_ROOT } from './physics/routes'
import { MoreDetail } from './design/primitives'
import { useAuth } from './lib/auth'
import { supabase } from './lib/supabase'

import './mri/mri.css'
import './us/us.css'

// Safari has a long-standing WebKit bug where a dynamic import() promise can
// hang forever — neither resolving nor rejecting — specifically for a lazy
// chunk fetched during client-side navigation (the very first import, during
// the initial full page load, is unaffected). React's Suspense boundary then
// waits forever and the visitor is left looking at the page's background
// colour with nothing on it, indistinguishable from a black screen, until a
// manual reload forces a fresh network fetch and the import resolves
// normally. Racing the import against a timeout turns that silent hang into
// an actual rejection, which triggers the same reload-once recovery already
// used for an outright failed fetch (see the vite:preloadError listener in
// main.tsx — same sessionStorage guard key, so the two cooperate).
function lazyImport<T extends { default: ComponentType<any> }>(importer: () => Promise<T>) {
  return lazy(() => {
    let settled = false
    const timeout = new Promise<T>((_, reject) => {
      setTimeout(() => {
        if (settled) return
        const key = 'rp-chunk-reload'
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1')
          window.location.reload()
        }
        reject(new Error('Chunk load timed out'))
      }, 10000)
    })
    return Promise.race([importer().then((m) => { settled = true; return m }), timeout])
  })
}

// The MRI laboratory carries the simulation engine and four canvas surfaces, so
// it is split into its own chunk and only fetched when a learner opens it.
/* The fact bank was the one page module imported eagerly, so its 54 KB of
   source — every fact of all eight topics — was parsed before the front door
   could paint, by every visitor including the ones who only ever click through
   to anatomy. Both pages are named exports rather than default ones, hence the
   mapping; they resolve to the same chunk, so opening one costs the other
   nothing. */
const FactBankPage = lazyImport(() => import('./factbank').then((m) => ({ default: m.FactBankPage })))
const FactTopicPage = lazyImport(() => import('./factbank').then((m) => ({ default: m.FactTopicPage })))

const MriFoundations = lazyImport(() => import('./mri/pages/Foundations'))
const MriT1SpinEcho = lazyImport(() => import('./mri/pages/T1SpinEcho'))
const MriT2SpinEcho = lazyImport(() => import('./mri/pages/T2SpinEcho'))
const MriProtonDensity = lazyImport(() => import('./mri/pages/ProtonDensity'))
const MriFlair = lazyImport(() => import('./mri/pages/Flair'))
const MriStir = lazyImport(() => import('./mri/pages/Stir'))
const MriGradientEcho = lazyImport(() => import('./mri/pages/GradientEcho'))
const MriFreeLab = lazyImport(() => import('./mri/pages/FreeLab'))
const MriComparison = lazyImport(() => import('./mri/pages/Comparison'))
const MriChallenge = lazyImport(() => import('./mri/pages/Challenge'))

// The ultrasound laboratory carries its own physics engine, content map and
// canvas surfaces, so each experiment is fetched only when it is opened.
const UsFundamentals = lazyImport(() => import('./us/pages/Fundamentals'))
const UsImpedance = lazyImport(() => import('./us/pages/Impedance'))
const UsReflection = lazyImport(() => import('./us/pages/Reflection'))
const UsRefraction = lazyImport(() => import('./us/pages/Refraction'))
const UsAttenuation = lazyImport(() => import('./us/pages/Attenuation'))
const UsPulseEcho = lazyImport(() => import('./us/pages/PulseEcho'))
const UsTransducer = lazyImport(() => import('./us/pages/Transducer'))
const UsBeam = lazyImport(() => import('./us/pages/Beam'))
const UsResolution = lazyImport(() => import('./us/pages/Resolution'))
const UsControls = lazyImport(() => import('./us/pages/Controls'))
const UsDoppler = lazyImport(() => import('./us/pages/Doppler'))
const UsAliasing = lazyImport(() => import('./us/pages/Aliasing'))
const UsArtefacts = lazyImport(() => import('./us/pages/Artefacts'))
const UsHarmonics = lazyImport(() => import('./us/pages/Harmonics'))
const UsContrast = lazyImport(() => import('./us/pages/Contrast'))
const UsElastography = lazyImport(() => import('./us/pages/Elastography'))
const UsSafety = lazyImport(() => import('./us/pages/Safety'))
const UsProbes = lazyImport(() => import('./us/pages/Probes'))
const UsQa = lazyImport(() => import('./us/pages/Qa'))
const UsExamLab = lazyImport(() => import('./us/pages/ExamLab'))
const UsFactBank = lazyImport(() => import('./us/pages/FactBank'))

// The cinematic homepage carries its own canvas scenes, scroll choreography
// and stylesheet, so it ships as its own chunk and never touches the shared
// page styling. It also renders its own navigation and footer.
const HomePage = lazyImport(() => import('./home/Home'))

/* /physics is now the learner's home. The cinematic page it replaced is not
   destroyed — it moves to /physics/tour and is linked from the foot of the
   learner home, because a candidate on their fourth visit needs to know where
   they were, not to be sold physics again. */
const PhysicsHome = lazyImport(() => import('./physics/Home'))

/* RadioPass Anatomy, now part of this application rather than a second build
   stitched in at deploy time. Lazy: the anatomy tree carries its own pages,
   grader and data, and none of it belongs in the first download of the master
   homepage. */
const AnatomyRoutes = lazyImport(() => import('./anatomy/AnatomyRoutes'))

// The focused lesson modules: one concept per screen, a diagram and a Next
// button. Each is a data file of steps rendered by the shared lesson player.
const CtLab = lazyImport(() => import('./labs/ct'))
const CtFilm = lazyImport(() => import('./labs/ct').then((m) => ({ default: m.CtFilm })))
const NmLab = lazyImport(() => import('./labs/nm'))
const NmFilm = lazyImport(() => import('./labs/nm').then((m) => ({ default: m.NmFilm })))
/* The MRI and ultrasound scroll scenes. Built alongside the X-ray one that
   still runs on the home page, then left with no importer — see labs/motion.tsx. */
const FreeTrialPage = lazyImport(() => import('./portal/FreeTrial'))
const MriMotion = lazyImport(() => import('./labs/motion').then((m) => ({ default: m.MriMotion })))
const UsMotion = lazyImport(() => import('./labs/motion').then((m) => ({ default: m.UsMotion })))
const XrayHub = lazyImport(() => import('./labs/xray'))
const XrayProductionLesson = lazyImport(() => import('./labs/xrayprod'))
const XraySpectrumLesson = lazyImport(() => import('./labs/xrayprod').then((m) => ({ default: m.XraySpectrumLesson })))
const XrayGeometryLesson = lazyImport(() => import('./labs/xraygeo'))
const XrayInteractionsLesson = lazyImport(() => import('./labs/xraygeo').then((m) => ({ default: m.XrayInteractionsLesson })))
const MammoLab = lazyImport(() => import('./labs/mammo'))
const FluoroLab = lazyImport(() => import('./labs/fluoro'))
const DigitalLab = lazyImport(() => import('./labs/digital'))
const UsFocusCourse = lazyImport(() => import('./labs/usfocus'))
const MriCourse = lazyImport(() => import('./labs/mriportal'))
const MriCoreLesson = lazyImport(() => import('./labs/mricore'))
const MriEncodingLesson = lazyImport(() => import('./labs/mriencoding'))
// The weighted sequences, taught on the magnetisation chamber itself. The
// laboratory pages of the same names are unchanged and still reachable — these
// come first in the course and hand over to them at the end.
const SeqT1 = lazyImport(() => import('./labs/seq/t1se'))
const SeqT2 = lazyImport(() => import('./labs/seq/t2se'))
const SeqPd = lazyImport(() => import('./labs/seq/pd'))
const SeqFlair = lazyImport(() => import('./labs/seq/flair'))
const SeqStir = lazyImport(() => import('./labs/seq/stir'))
const SeqGre = lazyImport(() => import('./labs/seq/gre'))
// Chapter 5 — the taught MRI module. Separate from /mri-lab, which is the
// simulation laboratory: this is the syllabus, section by section, and it
// links into the laboratory rather than replacing it.
const MriModule = lazyImport(() => import('./mri5/Module'))
const MriModuleHome = lazyImport(() => import('./mri5/Module').then((m) => ({ default: m.MriHome })))
const MriSection = lazyImport(() => import('./mri5/SectionRoute'))

// The front door. Anatomy and physics ship as two deployments but are one
// product to a candidate, so `/` is now the portal and the physics homepage
// moved to `/physics`. Every other physics route is untouched.
const Portal = lazyImport(() => import('./portal/Portal'))
const AdminConsole = lazyImport(() => import('./portal/Admin'))
// Mounts only where the /anatomy folder is absent (dev, split hosting): the
// combined host serves the real folder and this route is never reached. It
// forwards the whole address — subpath, query, hash — to the live anatomy
// deployment, so the portal door works on every host the code runs on.
// Imported EAGERLY, unlike every other route: a page whose whole job is a
// 450ms handover must not spend that time fetching its own chunk — lazy, the
// visitor saw the generic loading fallback instead of the crossing.

/* The course engine. Nine topics, each a primer with its simulations embedded
   and its own slice of the question bank bound to it.

   It was built at /physics-v2 as an alternative experience to be compared
   against the existing site; that comparison is over and the two are one
   product. The pages are unchanged in kind — they still render their own
   chrome (see hasOwnChrome) and still share the one question-bank record — but
   they now answer under /physics, and the old addresses redirect. */
const CourseTopicPage = lazyImport(() => import('./physics2/pages/Topic'))
const CoursePractice = lazyImport(() => import('./physics2/pages/Practice'))
const CourseReview = lazyImport(() => import('./physics2/pages/Review'))
const CourseQuestions = lazyImport(() => import('./physics2/pages/Questions'))

// The question bank shares the homepage's editorial design system and renders
// its own shell, so the site chrome stands down on its routes.
const QbIndex = lazyImport(() => import('./qbank/pages/Index'))
const QbPractice = lazyImport(() => import('./qbank/pages/Practice'))
const QbMock = lazyImport(() => import('./qbank/pages/Mock'))
const QbReview = lazyImport(() => import('./qbank/pages/Review'))
const AdrenalAdenomaTool = lazyImport(() => import('./clinical/AdrenalAdenomaTool'))

function MriLoading() {
  return (
    <main className="mri-module">
      <div className="mri-shell">
        <p className="mri-boot">Loading the laboratory…</p>
      </div>
    </main>
  )
}

type IconName =
  | 'arrow'
  | 'book'
  | 'brain'
  | 'check'
  | 'chevron'
  | 'clock'
  | 'close'
  | 'exam'
  | 'eye'
  | 'flash'
  | 'grid'
  | 'menu'
  | 'play'
  | 'shield'
  | 'spark'
  | 'target'
  | 'trend'
  | 'user'
  | 'wave'

const iconPaths: Record<IconName, ReactNode> = {
  arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M8 7h8M8 11h6"/></>,
  brain: <><path d="M9.5 4.5A3 3 0 0 0 4 6a3 3 0 0 0 .5 5.5A3 3 0 0 0 7 17a3 3 0 0 0 5 2.2V5a3 3 0 0 0-2.5-.5Z"/><path d="M14.5 4.5A3 3 0 0 1 20 6a3 3 0 0 1-.5 5.5A3 3 0 0 1 17 17a3 3 0 0 1-5 2.2V5a3 3 0 0 1 2.5-.5Z"/><path d="M7 9.5h2.5M14.5 9.5H17M8 15h1.5M14.5 15H16"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  close: <><path d="M18 6 6 18M6 6l12 12"/></>,
  exam: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></>,
  eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.5"/></>,
  flash: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z"/>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  play: <path d="m9 7 8 5-8 5V7Z"/>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
  spark: <><path d="m12 3-1.4 4.6L6 9l4.6 1.4L12 15l1.4-4.6L18 9l-4.6-1.4L12 3Z"/><path d="m5 15-.8 2.2L2 18l2.2.8L5 21l.8-2.2L8 18l-2.2-.8L5 15Z"/></>,
  target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
  trend: <><path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  wave: <path d="M2 12h3l2-6 4 12 3-9 2 6h6"/>,
}

function Icon({ name, size = 20, strokeWidth = 1.8 }: { name: IconName; size?: number; strokeWidth?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>
}


/**
 * A last line of defence around the routed page.
 *
 * React unmounts the entire tree when a render or commit error escapes, which
 * is how a single bad effect turned every navigation into a blank page that
 * only a full reload recovered from. A boundary converts that into a
 * recoverable, visible failure of one page instead of the whole application,
 * and — because the app is a chunked SPA where a stale chunk can also fail —
 * offers a reload rather than leaving the visitor stuck.
 */
class RouteErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[route error]', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="container" style={{ padding: '120px 0 90px', maxWidth: 640 }}>
        <h1 style={{ fontFamily: 'var(--display)', fontWeight: 340, fontSize: 38, margin: '0 0 14px' }}>
          This page hit a problem.
        </h1>
        <p style={{ color: 'var(--muted)', lineHeight: 1.7, margin: '0 0 22px' }}>
          The rest of the site is fine — only this page failed to render. Reloading usually
          clears it, and nothing you have saved is affected.
        </p>
        <button type="button" className="button button-primary" onClick={() => window.location.reload()}>
          Reload the page
        </button>
      </main>
    )
  }
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])
  return null
}

/**
 * The course engine's old address, forwarded to its new one.
 *
 * ONE component rather than five <Navigate> elements, because four of the five
 * cases carry state in the part of the URL a plain redirect throws away:
 *
 *   /physics-v2/xray/practice?section=tube&filter=again
 *   /physics-v2/xray#geometry
 *
 * The query IS the question set — drop it and the learner who followed their
 * own stored Continue link lands in a different set of questions than the one
 * they left, with nothing on screen to say so. The hash is how question
 * feedback returns to the section that teaches the answer.
 *
 * These arrive from three places, all of them real: a bookmark, the static HTML
 * under /public that leaves the SPA and comes back by hardcoded href, and —
 * the one that matters — Continue positions written into localStorage before
 * the merge, which are stored as full paths including the query.
 */
function LegacyCourseRedirect() {
  const location = useLocation()
  const rest = location.pathname.slice(LEGACY_PHYSICS_ROOT.length).replace(/\/+$/, '')
  return (
    <Navigate
      replace
      to={{
        // The bare root was the syllabus, which is now the dashboard itself.
        pathname: rest === '' ? PHYSICS_HREF.home : `${PHYSICS_ROOT}${rest}`,
        search: location.search,
        hash: location.hash,
      }}
    />
  )
}

/**
 * Routes that render their own navigation and so must not get the shared
 * header and footer.
 *
 * One list, used by both. It was previously written out twice, which is how a
 * route ends up with the site header stacked on top of a lesson player's own
 * bar on one of them and not the other.
 */
function hasOwnChrome(pathname: string): boolean {
  /* '/physics' is deliberately NOT here any more. It used to render the
     cinematic page, which brought its own nav and footer; it is now the
     learner's home and needs the shared header like every other page — a
     learner home with no way out is a dead end. The cinematic page kept its
     own chrome and moved to '/physics/tour', which IS listed. */
  const exact = ['/', '/physics/tour', '/admin', '/ultrasound-lab', '/mri', '/anatomy']
  const trees = [
    /* Trailing slash, and it is load-bearing. Everything UNDER /physics is the
       course engine, which brings its own header; bare '/physics' is the
       dashboard, which must keep the shared one (see the note above). A tree
       entry of '/physics' would match both and strip the dashboard's header.
       '/physics/tour' is listed exactly above and is now also covered here —
       harmless, and left in place so removing this line cannot silently give
       the cinematic page two headers. */
    '/physics/',
    '/question-bank',
    '/ct-lab',
    '/nm-lab',
    '/xray-lab',
    '/ultrasound-lab/',
    '/mri-lab/course',
    '/mri-lab/core',
    '/mri-lab/encoding',
    '/mri-lab/learn',
    // Trailing slash on purpose: a bare '/mri' prefix would also match
    // '/mri-lab/...', which must keep the site header.
    '/mri/',
    '/anatomy/',
  ]
  return exact.includes(pathname) || trees.some((tree) => pathname.startsWith(tree))
}

/* Where the anatomy build lives. Same resolution Crossing uses: '/anatomy'
   when both halves share a domain (the drop-in deploy), overridable for split
   hosting. Hash routing means the trailing '/#/' lands on its home. */
const ANATOMY_HREF =
  ((import.meta.env.VITE_ANATOMY_URL as string | undefined)?.replace(/\/$/, '') ?? '/anatomy') + '/#/'

function Header() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  const logOut = async () => { await signOut(); navigate('/') }

  if (hasOwnChrome(location.pathname)) return null

  // The learner's journey, in order: learn it, drill it, sit it, keep it.
  // Every lab lives inside Learn — nothing removed, just one clear door each.
  /* ONE NAVIGATION LANGUAGE ACROSS BOTH BRANCHES.
     The bar used to list six physics tools — Learn, Practise, Mock Exams,
     Fact Bank, Study Plan, Pricing — as if they were the product's top level,
     and carried NO link to anatomy at all. A learner inside physics could not
     reach the other half of the exam from the header.

     It now reads the way the product is shaped: the two branches first, then
     the tools of the branch you are actually in, then the trial. The anatomy
     app's header carries the same first group and the same trial entry, so
     moving between the two builds does not feel like changing website. */
  const branchLinks: [string, string][] = [
    ['Anatomy', ANATOMY_HREF],
    ['Physics', '/physics'],
  ]
  const links: [string, string][] = [
    ['Modules', '/visual-lab'],
    ['Question bank', '/question-bank'],
    ['Mock exams', '/question-bank/mock'],
    ['Simulator labs', '/ultrasound-lab'],
  ]

  return <header className="site-header">
    <div className="container nav-wrap">
      <Link to="/" className="brand" aria-label="RadioPass home">
        <span className="brand-mark"><span></span><span></span><span></span></span>
        <span>radio<span>pass</span></span>
      </Link>
      <nav className={open ? 'nav-links open' : 'nav-links'} aria-label="Primary navigation">
        {/* The two branches. Anatomy is a plain <a> because it leaves this
            build — an implementation detail the learner must never feel. */}
        <a className="nav-branch" href={ANATOMY_HREF}>{branchLinks[0][0]}</a>
        <NavLink className={({ isActive }: { isActive: boolean }) => isActive ? 'nav-branch active' : 'nav-branch'} to="/physics">Physics</NavLink>
        <span className="nav-divider" aria-hidden="true" />
        {links.map(([label, href]) => <NavLink key={href} to={href} className={({ isActive }: { isActive: boolean }) => isActive ? 'active' : ''}>{label}</NavLink>)}
        {/* No "Free trial" link here: the "Start free trial" button in the
            account group beside this nav is already that entry, and having
            both put the same destination in the bar twice. */}
        {user ? (
          <button type="button" className="mobile-login" onClick={logOut}>Log out ({user.email})</button>
        ) : (
          <>
            <Link to="/login" className="mobile-login">Log in</Link>
            <Link to="/free-trial" className="button button-small mobile-cta">Start free trial <Icon name="arrow" size={16}/></Link>
          </>
        )}
      </nav>
      <div className="nav-actions">
        {user ? (
          <>
            <span className="account-chip" title={user.email}><Icon name="user" size={14}/>{user.email}</span>
            <button type="button" className="button button-small button-outline" onClick={logOut}>Log out</button>
          </>
        ) : (
          <>
            <Link to="/login" className="login-link">Log in</Link>
            <Link to="/free-trial" className="button button-small">Start free trial <Icon name="arrow" size={16}/></Link>
          </>
        )}
        <button className="menu-button" onClick={() => setOpen(!open)} aria-label="Toggle navigation" aria-expanded={open}>
          <Icon name={open ? 'close' : 'menu'} />
        </button>
      </div>
    </div>
  </header>
}

function Footer() {
  // The ultrasound laboratory is a full-viewport instrument: an active
  // experiment must not scroll the page, so the site footer stands down
  // there. The homepage and the question bank carry their own footers to
  // match their design systems — same routes the Header above stands down for.
  const { pathname } = useLocation()
  if (hasOwnChrome(pathname)) return null
  return <footer className="footer">
    <div className="container footer-grid">
      <div>
        <Link to="/" className="brand brand-footer">
          <span className="brand-mark"><span></span><span></span><span></span></span>
          <span>radio<span>pass</span></span>
        </Link>
        <p>Visual, exam-focused physics revision for FRCR Part 1 candidates.</p>
      </div>
      <div><h4>Platform</h4><Link to="/question-bank">Question bank</Link><Link to="/fact-bank">Fact bank</Link><Link to="/visual-lab">Visual lab</Link><Link to="/mri">MRI module</Link><Link to="/mri-lab">MRI laboratory</Link><Link to="/ultrasound-lab">Ultrasound laboratory</Link><Link to="/study-plan">Study plan</Link></div>
      <div><h4>Company</h4><Link to="/about">About</Link><a href="mailto:hello@radiopass.co.uk">Contact</a><Link to="/pricing">Pricing</Link></div>
      <div><h4>Legal</h4><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><a href="#top">Back to top</a></div>
    </div>
    <div className="container footer-bottom"><span>© 2026 RadioPass. All rights reserved.</span><span>Built for radiology trainees.</span></div>
  </footer>
}

function Eyebrow({ children, icon = 'spark' }: { children: ReactNode; icon?: IconName }) {
  return <div className="eyebrow"><Icon name={icon} size={15}/>{children}</div>
}

function SectionHeading({ eyebrow, title, text, centre = false }: { eyebrow: string; title: ReactNode; text?: string; centre?: boolean }) {
  return <div className={centre ? 'section-heading centre' : 'section-heading'}>
    <Eyebrow>{eyebrow}</Eyebrow>
    <h2>{title}</h2>
    {text && <p>{text}</p>}
  </div>
}

// The slider's range. Named because `--value` below has to be the thumb's
// position within it, not the raw value: the track fill is painted at
// `--value` along the whole track, so feeding it the value while the range
// starts at 15 left the amber fill running up to 71px of a 522px track ahead
// of the thumb. Only the half-thumb inset at each end is now unaccounted for.
const DOSE_MIN = 15
const DOSE_MAX = 100

function DoseDemo() {
  const [dose, setDose] = useState(54)
  const noise = Math.round(100 / Math.sqrt(dose / 10))
  const fill = ((dose - DOSE_MIN) / (DOSE_MAX - DOSE_MIN)) * 100
  return <div className="dose-demo">
    <div className="demo-head"><div><span>CT VISUAL LAB</span><strong>mAs, dose & image noise</strong></div><span className="live-badge"><i></i>LIVE</span></div>
    <div className="ct-frame"><div className="ct-scan" style={{filter:`contrast(${0.75 + dose/180}) brightness(${0.82 + dose/500})`}}><div className="scan-centre"><span></span><span></span><span></span><span></span></div>{Array.from({length:36}).map((_,i)=><i key={i} style={{opacity: Math.max(.08,(100-dose)/100), left:`${(i*37)%94}%`, top:`${(i*61)%91}%`}}></i>)}</div><div className="scan-label"><span>LOW NOISE</span><span>HIGH NOISE</span></div></div>
    <div className="demo-control"><div className="control-label"><span>Tube current–time product</span><strong>{dose * 4} mAs</strong></div><input aria-label="Tube current-time product" type="range" min={DOSE_MIN} max={DOSE_MAX} value={dose} onChange={(e: ChangeEvent<HTMLInputElement>)=>setDose(Number(e.target.value))} style={{'--value':`${fill}%`} as CSSProperties}/><div className="range-label"><span>Lower dose</span><span>Higher dose</span></div></div>
    <div className="demo-insight"><Icon name="spark" size={18}/><p><strong>What changed?</strong> Image noise is approximately inversely proportional to the square root of mAs. Estimated noise index: <b>{noise}</b>.</p></div>
  </div>
}

function CTA() {
  return <section className="cta-section section-dark"><div className="cta-orb"></div><div className="container cta-inner"><Eyebrow icon="flash">Your next session can be different</Eyebrow><h2>Build the physics confidence<br/>your exam will demand.</h2><p>Start with the visual lab, test yourself in the question bank and let your dashboard show you the next move.</p><div className="hero-actions centre-actions"><Link to="/pricing" className="button button-primary">Start free trial <Icon name="arrow" size={18}/></Link><Link to="/study-plan" className="button button-ghost">See how it works</Link></div><small>No card required · Cancel anytime</small></div></section>
}

function PageHero({ eyebrow, title, text, children }: { eyebrow: string; title: ReactNode; text: string; children?: ReactNode }) {
  return <section className="page-hero section-dark"><div className="noise"></div><div className="container"><Eyebrow>{eyebrow}</Eyebrow><h1>{title}</h1><p>{text}</p>{children}</div></section>
}
// Card visuals for the visual-lab index, drawn in the same thin-line
// scientific language as the homepage scenes — one restrained accent per
// modality, motion that means something, nothing decorative.
function LabArt({ kind }: { kind: 'mri' | 'ct' | 'us' | 'nm' | 'xray' }) {
  if (kind === 'xray') return (
    <svg className="lab-svg" viewBox="0 0 300 180" aria-hidden="true" style={{ color: '#A8CBEA' }}>
      <circle cx="150" cy="34" r="9" />
      <line x1="150" y1="43" x2="96" y2="140" opacity=".35" />
      <line x1="150" y1="43" x2="204" y2="140" opacity=".35" />
      <line x1="150" y1="43" x2="150" y2="140" opacity=".2" />
      <line x1="123" y1="43" x2="177" y2="43" strokeWidth="2" opacity=".6" />
      <ellipse cx="150" cy="104" rx="30" ry="18" opacity=".4" />
      <line x1="88" y1="146" x2="212" y2="146" strokeWidth="3" opacity=".7" />
      <text x="150" y="166" className="lab-svg-label" textAnchor="middle">tube · patient · detector</text>
    </svg>
  )
  if (kind === 'mri') return (
    <svg className="lab-svg" viewBox="0 0 300 180" aria-hidden="true" style={{ color: '#A99EDB' }}>
      <line x1="150" y1="168" x2="150" y2="22" strokeDasharray="3 6" opacity=".4" />
      <path d="m150 16 -5 8 M150 16 l5 8" opacity=".55" />
      <text x="161" y="27" className="lab-svg-label">B₀</text>
      <ellipse cx="150" cy="52" rx="58" ry="14" opacity=".45" />
      <line x1="150" y1="140" x2="92" y2="52" opacity=".16" />
      <line x1="150" y1="140" x2="208" y2="52" opacity=".16" />
      <ellipse cx="150" cy="140" rx="80" ry="18" strokeDasharray="2 5" opacity=".2" />
      <g className="lab-svg-precess">
        <line x1="150" y1="140" x2="196" y2="58" strokeWidth="2" />
        <circle cx="196" cy="58" r="4" className="fill" />
        <circle cx="196" cy="58" r="9" opacity=".3" />
      </g>
    </svg>
  )
  if (kind === 'ct') return (
    <svg className="lab-svg" viewBox="0 0 300 180" aria-hidden="true" style={{ color: '#D9A84E' }}>
      <circle cx="150" cy="90" r="72" opacity=".5" />
      <circle cx="150" cy="90" r="57" opacity=".16" />
      <ellipse cx="150" cy="92" rx="40" ry="25" opacity=".55" />
      <ellipse cx="136" cy="90" rx="12" ry="15" opacity=".26" />
      <ellipse cx="164" cy="90" rx="12" ry="15" opacity=".26" />
      <circle cx="150" cy="106" r="4.5" opacity=".5" />
      <g className="lab-svg-gantry">
        <circle cx="150" cy="18" r="4.5" className="fill" />
        <path d="M150 18 L118 74 M150 18 L182 74" opacity=".4" strokeWidth="1" />
        <path d="M150 18 L118 74 L182 74 Z" className="fill lab-svg-beam" />
      </g>
    </svg>
  )
  if (kind === 'us') return (
    <svg className="lab-svg" viewBox="0 0 300 180" aria-hidden="true" style={{ color: '#7BCBC4' }}>
      <defs><clipPath id="lab-dop-clip"><rect x="8" y="20" width="284" height="140" /></clipPath></defs>
      {[68, 128, 188, 248].map(x => <line key={x} x1={x} y1="30" x2={x} y2="138" opacity=".08" />)}
      <line x1="8" y1="140" x2="292" y2="140" opacity=".35" />
      <g clipPath="url(#lab-dop-clip)">
        <g className="lab-svg-doppler">
          {[0, 100, 200, 300].map(x => (
            <g key={x} transform={`translate(${x})`}>
              <path d="M0 138 C 5 137 9 62 16 58 C 22 56 26 98 34 106 C 40 112 45 98 51 104 C 63 116 81 130 100 136" opacity=".9" strokeWidth="1.6" />
              <path d="M0 138 C 5 137 9 62 16 58 C 22 56 26 98 34 106 C 40 112 45 98 51 104 C 63 116 81 130 100 136 L100 140 L0 140 Z" className="fill lab-svg-trace" />
            </g>
          ))}
        </g>
      </g>
    </svg>
  )
  return (
    <svg className="lab-svg" viewBox="0 0 300 180" aria-hidden="true" style={{ color: '#A8CBEA' }}>
      <rect x="62" y="24" width="176" height="14" rx="3" opacity=".5" />
      {Array.from({ length: 22 }).map((_, n) => (
        <line key={n} x1={66 + n * 8} y1="42" x2={66 + n * 8} y2="64" opacity=".22" />
      ))}
      <circle cx="150" cy="150" r="4" className="fill" />
      <circle cx="150" cy="150" r="10" opacity=".3" />
      <line x1="150" y1="144" x2="118" y2="66" opacity=".45" />
      <line x1="150" y1="144" x2="152" y2="66" opacity=".45" />
      <line x1="150" y1="144" x2="196" y2="78" opacity=".3" strokeDasharray="3 4" />
      <path d="m192 72 8 8 M200 72 l-8 8" opacity=".5" />
      <circle cx="116" cy="32" r="4.5" className="fill lab-svg-flash" />
      <circle cx="152" cy="32" r="4.5" className="fill lab-svg-flash" style={{ animationDelay: '1.2s' }} />
    </svg>
  )
}

function VisualLabPage() {
  // One card per exam area, in syllabus order. `extras` are the other doors
  // into the same subject — film, story, focused course — so nothing hides.
  const labs: [string, string, string, string, 'xray' | 'mri' | 'ct' | 'us' | 'nm', [string, string][]][] = [
    ['X-ray techniques','Mammography, fluoroscopy, and CR/DR — the projection family, one concept at a time.','X-RAY','/xray-lab','xray',[]],
    ['CT physics — the focused lesson','From the four generations to the dose report: sixteen concepts, one at a time, each one drawn.','CT','/ct-lab','ct',[['▶ Watch the film','/ct-lab/film'],['✦ Scroll story','/ct-story.html']]],
    ['MRI — the whole module','All twenty-one syllabus sections, from the bore to safety: every mechanism animated, every control wired to the real equation. Start at the machine and follow one causal chain to the image.','MRI','/mri','mri',[['Slice selection','/mri/slice-selection'],['K-space','/mri/k-space'],['Sequence laboratory','/mri-lab/course'],['✦ Scroll story','/mri-lab/motion']]],
    ['Ultrasound — the focused course','Every ultrasound concept, one screen at a time: only the idea, the diagram and Next.','US','/ultrasound-lab/focus','us',[['Full laboratory','/ultrasound-lab'],['✦ Scroll story','/ultrasound-lab/motion']]],
    ['Nuclear medicine — the focused lesson','Generator to PET ring: twenty-one concepts, one at a time, each one drawn.','NM','/nm-lab','nm',[['▶ Watch the film','/nm-lab/film']]],
  ]
  return <main><PageHero eyebrow="Learn — the labs" title={<>Physics becomes easier<br/>when it <span>moves.</span></>} text="Five exam areas, each taught the same way: see the mechanism work, keep the rule, then go and score with it."><div className="hero-actions"><Link to="/xray-lab" className="button button-primary">Start with X-ray <Icon name="arrow" size={18}/></Link><Link to="/question-bank" className="button button-ghost">Practise questions <Icon name="arrow" size={18}/></Link></div></PageHero>
  <section className="section" id="labs"><div className="container"><SectionHeading centre eyebrow="Learn by changing the variable" title={<>The diagram answers <span>back.</span></>} text="Every lab pairs an interactive model with concise exam rules, calculations and trap checks."/><div className="labs-grid">{labs.map(([t,d,tag,href,art,extras])=><article key={t}><div className={`lab-art lab-art-${['xray','ct','mri','us','nm'].indexOf(art)+1}`}><span className="lab-tag">{tag}</span><LabArt kind={art}/></div><div><h3>{t}</h3><p>{d}</p><Link to={href}>Open the laboratory <Icon name="arrow" size={16}/></Link>{extras.length > 0 && <p className="lab-extras">{extras.map(([label, to]) => to.endsWith('.html') ? <a key={to} href={to}>{label}</a> : <Link key={to} to={to}>{label}</Link>)}</p>}</div></article>)}</div></div></section>
  <section className="section surface-section"><div className="container"><SectionHeading centre eyebrow="Inside the Ultrasound laboratory" title={<>Twenty-one experiments, <span>one physics engine.</span></>} text="From compression and rarefaction to Doppler, artefacts and safety indices — every beam, image and number is computed live from the acoustics."/><div className="module-grid">{[['Sound Fundamentals','Longitudinal waves, c = fλ, pulses and duty factor.','/ultrasound-lab'],['Acoustic Impedance','Z = ρc, and why the mismatch decides the echo.','/ultrasound-lab/impedance'],['Attenuation & TGC','Exponential loss, dB arithmetic and depth compensation.','/ultrasound-lab/attenuation'],['Pulse–Echo Imaging','From electrical pulse to B-mode pixel in ten steps.','/ultrasound-lab/pulse-echo'],['Transducer Laboratory','Piezoelectricity, damping, matching and array firing.','/ultrasound-lab/transducer'],['Doppler Laboratory','The equation, the cosine, and every Doppler mode.','/ultrasound-lab/doppler'],['Artefact Workshop','Generate every artefact by breaking its assumption.','/ultrasound-lab/artefacts'],['Bioeffects & Safety','MI, TI, cavitation, heating and ALARA — with numbers.','/ultrasound-lab/safety'],['FRCR Exam Lab','High-yield questions, trap mode and timed tests.','/ultrasound-lab/exam']].map(([t,d,href],i)=><article key={t}><span className="module-index">{String(i+1).padStart(2,'0')}</span><div className={`module-orb orb-${(i%6)+1}`}><span></span></div><h3>{t}</h3><p>{d}</p><Link to={href}>Open experiment <Icon name="arrow" size={15}/></Link></article>)}</div></div></section>
  <section className="section"><div className="container"><SectionHeading centre eyebrow="Inside the MRI laboratory" title={<>Ten connected stages, <span>one simulation engine.</span></>} text="Every grey level, curve and vector on these pages is computed from the same signal model — nothing is drawn by hand."/><div className="module-grid">{[['MRI Foundations','Net magnetisation, precession, excitation and relaxation.','/mri-lab'],['T1 spin echo','Short TR, short TE: contrast from longitudinal recovery.','/mri-lab/t1-spin-echo'],['T2 spin echo','Long TR, long TE: contrast from transverse decay.','/mri-lab/t2-spin-echo'],['Proton density','Long TR, short TE: what is left when both are removed.','/mri-lab/proton-density'],['T2 FLAIR','Inversion recovery timed to null CSF.','/mri-lab/flair'],['STIR','A short inversion time that nulls fat.','/mri-lab/stir'],['Free sequence laboratory','Build any sequence and have its contrast classified.','/mri-lab/laboratory'],['Comparison matrix','Every tissue against every sequence, live from the engine.','/mri-lab/comparison'],['Challenge mode','Identify, adjust, predict and debug.','/mri-lab/challenge']].map(([t,d,href],i)=><article key={t}><span className="module-index">{String(i+1).padStart(2,'0')}</span><div className={`module-orb orb-${(i%6)+1}`}><span></span></div><h3>{t}</h3><p>{d}</p><Link to={href}>Open stage <Icon name="arrow" size={15}/></Link></article>)}</div></div></section>
  <section className="section section-dark lab-deep-dive" id="demo"><div className="container split-grid align-centre"><div><SectionHeading eyebrow="Try it now" title={<>See the dose–noise relationship <span>for yourself.</span></>} text="Move the control, observe the image and then anchor the relationship with the exam rule."/><div className="formula-card"><span>CORE RELATIONSHIP</span><strong>Noise ∝ 1 / √mAs</strong><p>To halve quantum noise, mAs must increase by a factor of four.</p></div></div><DoseDemo/></div></section><CTA/></main>
}

function StudyPlanPage() {
  /* Week, subject and scope. The per-week "24 lessons · 180 questions" counts
     that used to sit here were invented — they summed to 960 questions against
     the 511 the bank actually holds — so they are gone rather than restated.
     When the content registry can report real per-week totals, they come back
     from it. */
  const weeks = [
    ['Week 1','Foundations & radiography','Atomic structure, X-ray production, interactions and image quality.'],
    ['Week 2','CT & dose','Reconstruction, artefacts, optimisation and practical dose metrics.'],
    ['Week 3','MRI','Signal, weighting, sequences, artefacts, instrumentation and safety.'],
    ['Week 4','Ultrasound & Doppler','Propagation, transducers, resolution, artefacts and flow.'],
    ['Week 5','Nuclear medicine','Gamma camera, radionuclides, PET/SPECT and counting statistics.'],
    ['Week 6','Protection & consolidation','UK legislation, dosimetry, mixed mocks and final weak-area repair.'],
  ]
  return <main><PageHero eyebrow="Six-week study plan" title={<>A clear route from<br/><span>overwhelmed to exam-ready.</span></>} text="A structured syllabus, daily targets and built-in consolidation so your revision keeps moving without becoming chaotic."><Link to="/pricing" className="button button-primary">Start the plan <Icon name="arrow" size={18}/></Link></PageHero>
  <section className="section"><div className="container"><SectionHeading centre eyebrow="The route" title={<>One focus each week.<br/><span>One system holding it together.</span></>} text="Each week combines visual learning, targeted questions and spaced review."/><div className="timeline">{weeks.map(([week,title,text],i)=><article key={week}><div className="timeline-marker"><span>{i+1}</span></div><div className="timeline-card"><span>{week}</span><h3>{title}</h3><p>{text}</p></div></article>)}</div></div></section>
  {/* This panel used to render a sample week — "Week 3 · MRI", "Monday 3 August"
      and four tasks, two of them ticked — styled exactly as though it were the
      reader's own record. RadioPass records none of that yet, so it was a
      fabrication wearing the interface of a fact. It states the truth instead
      until there is a progress store behind it. */}
  <section className="section surface-section"><div className="container split-grid align-centre"><div className="plan-dashboard"><div className="plan-top"><span>YOUR PLAN</span><strong>Not started</strong><small>No activity yet</small></div><p className="plan-empty">RadioPass does not track your progress yet. When it does, this is where the week you are on and the sessions still due will appear — read from your own activity, never from a sample.</p><Link to="/visual-lab" className="button button-outline">Open the laboratories <Icon name="arrow" size={16}/></Link></div><div><SectionHeading eyebrow="Designed for real rotas" title={<>Know the priority, even when time is <span>tight.</span></>} text="Six weeks, one subject at a time, each ending where the next begins — so a week missed on a busy rota is a week to slot back in, not a plan to restart."/><ul className="check-list dark-list"><li><Icon name="check"/>One subject per week, in exam order</li><li><Icon name="check"/>Visual learning, then questions, then review</li><li><Icon name="check"/>Final week for mocks and weak-area repair</li></ul></div></div></section><CTA/></main>
}

function PricingContent() {
  const [annual, setAnnual] = useState(true)
  const plans = [
    {name:'Starter',desc:'Create a free account — everything on the site today.',monthly:0,annual:0,cta:'Start free',popular:false,comingSoon:false,features:['Every visual lab','The full question bank','All three mock papers','Progress synced to your account']},
    {name:'Complete',desc:'Full preparation for your FRCR Part 1 Physics sitting.',monthly:29,annual:19,cta:'Coming soon',popular:true,comingSoon:true,features:['Everything in Starter','Six-week adaptive study plan','Weak-area review','Detailed performance dashboard']},
    {name:'Intensive',desc:'A focused final-month revision sprint.',monthly:49,annual:39,cta:'Coming soon',popular:false,comingSoon:true,features:['Everything in Complete','30-day crash plan','Daily mixed-paper sessions','High-yield trap library','Priority support']},
  ]
  return <main><PageHero eyebrow="Simple pricing" title={<>Invest in understanding.<br/><span>Carry it into the exam.</span></>} text="Every lab, the full question bank and every mock paper are free while RadioPass is in early access — create an account and everything here is already yours."><div className="billing-toggle"><button className={!annual?'active':''} onClick={()=>setAnnual(false)}>Monthly</button><button className={annual?'active':''} onClick={()=>setAnnual(true)}>Annual <span>Save 34%</span></button></div></PageHero>
  <section className="section pricing-section"><div className="container pricing-grid">{plans.map(plan=><article key={plan.name} className={plan.popular?'popular':''}>{plan.popular&&<div className="popular-label">MOST POPULAR</div>}<div className="pricing-head"><h3>{plan.name}</h3><p>{plan.desc}</p><div className="price"><span>£</span><strong>{annual?plan.annual:plan.monthly}</strong><small>{plan.monthly===0?'forever':'/ month'}</small></div>{annual&&plan.monthly>0&&<em>Billed annually</em>}</div>{plan.comingSoon ? <span className="button button-outline is-disabled" aria-disabled="true" title="Not open yet — everything is free for now">{plan.cta}</span> : <Link to="/login" className="button button-dark">{plan.cta}<Icon name="arrow" size={16}/></Link>}<ul>{plan.features.map(f=><li key={f}><Icon name="check" size={17}/>{f}</li>)}</ul></article>)}</div><p className="pricing-note">RadioPass is in early access. Prices above are what Complete and Intensive will cost at launch — nothing is charged today, and creating a free account already unlocks everything on the site.</p></section>
  <section className="section surface-section"><div className="container"><SectionHeading centre eyebrow="Common questions" title={<>Everything you need to <span>decide.</span></>}/><FAQ/></div></section><CTA/></main>
}

function FAQ() {
  const faqs = [
    ['Is this for the UK FRCR Part 1 Physics exam?','Yes. The structure, terminology and learning flow are designed around UK FRCR Part 1 Physics preparation.'],
    ['Can I use it alongside my existing textbook?','Yes. RadioPass is designed to make difficult concepts visual and provide active practice; it can sit alongside any core text or course.'],
    ['Do I need to pay to use RadioPass?','Not yet. RadioPass is in early access — every lab, the full question bank and all three mock papers are free for anyone with an account. Complete and Intensive are paid plans launching later; nothing is charged today.'],
    ['Does it work on mobile?','Yes. The website is responsive and the learning sessions are designed to work across desktop, tablet and mobile.'],
  ]
  const [open, setOpen] = useState(0)
  return <div className="faq-list">{faqs.map(([q,a],i)=><article key={q} className={open===i?'open':''}><button onClick={()=>setOpen(open===i?-1:i)}><span>{q}</span><b>{open===i?'−':'+'}</b></button><div><p>{a}</p></div></article>)}</div>
}

function LoginPage() {
  const { user, signUp, signIn, configured } = useAuth()
  const navigate = useNavigate()
  /* ?mode=signup opens straight onto the create-account form — the free
     sample's gates land here, and a visitor who just clicked "sign up"
     should not be met by a login form with one more link to find. */
  const [mode, setMode] = useState<'login' | 'signup'>(() =>
    new URLSearchParams(window.location.search).get('mode') === 'signup' ? 'signup' : 'login',
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Landing on /login while already signed in just takes you home.
  useEffect(() => { if (user) navigate('/', { replace: true }) }, [user, navigate])

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setLoading(true)
    if (mode === 'signup') {
      const result = await signUp(email, password)
      setLoading(false)
      if (result.error) { setError(result.error); return }
      if (result.needsEmailConfirmation) {
        setNotice('Account created — check your email for a confirmation link, then log in.')
        setMode('login')
      }
      // Otherwise a session came back immediately; the effect above redirects.
    } else {
      const result = await signIn(email, password)
      setLoading(false)
      if (result.error) setError(result.error)
    }
  }

  const forgotPassword = async () => {
    if (!email) { setError('Enter your email address above first.'); return }
    if (!supabase) { setError('Accounts are not set up on this deployment yet.'); return }
    setError(null)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (err) setError(err.message)
    else setNotice('Password reset email sent — check your inbox.')
  }

  return <main className="login-page section-dark">
    <div className="login-art">
      <div className="login-orbit"><span></span><span></span><span></span><b>R</b></div>
      <div>
        <Eyebrow>{mode === 'signup' ? 'Get started' : 'Welcome back'}</Eyebrow>
        {mode === 'signup'
          ? <h1>Start free.<br/><span>Keep every session.</span></h1>
          : <h1>Continue where your<br/><span>last session ended.</span></h1>}
        <p>{mode === 'signup' ? 'Your progress, flags and favourites follow you to any device.' : 'Your progress, flags and favourites are ready.'}</p>
      </div>
    </div>
    <div className="login-panel">
      <Link to="/" className="brand"><span className="brand-mark"><span></span><span></span><span></span></span><span>radio<span>pass</span></span></Link>
      <form className="login-form" onSubmit={submit}>
        <h2>{mode === 'signup' ? 'Create your account' : 'Log in'}</h2>
        <p>{mode === 'signup' ? 'Free — no card required.' : 'Enter your details to access your dashboard.'}</p>
        <label>Email address<input required type="email" placeholder="you@example.com" value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}/></label>
        <label>Password<div className="password-input"><input required minLength={6} type={showPassword?'text':'password'} placeholder="••••••••" value={password} onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}/><button type="button" onClick={()=>setShowPassword(!showPassword)}>{showPassword?'Hide':'Show'}</button></div></label>
        {mode === 'login' && <div className="form-meta"><span/><button type="button" className="link-button" onClick={forgotPassword}>Forgot password?</button></div>}
        <button type="submit" className="button button-dark" disabled={loading || !configured}>{loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'} <Icon name="arrow" size={17}/></button>
        {!configured && <div className="form-message is-error"><Icon name="close" size={17}/>Accounts aren't connected on this deployment yet.</div>}
        {error && <div className="form-message is-error"><Icon name="close" size={17}/>{error}</div>}
        {notice && <div className="form-message"><Icon name="check" size={17}/>{notice}</div>}
        <small>{mode === 'signup'
          ? <>Already have an account? <button type="button" className="link-button" onClick={() => { setMode('login'); setError(null); setNotice(null) }}>Log in</button></>
          : <>New to RadioPass? <button type="button" className="link-button" onClick={() => { setMode('signup'); setError(null); setNotice(null) }}>Start free</button></>}</small>
      </form>
    </div>
  </main>
}

function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Supabase's recovery link puts a temporary session in the URL fragment;
  // the client SDK picks it up on load. There is nothing to read here — the
  // presence of that session is what makes updateUser below work at all.
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!supabase) { setError('Accounts are not set up on this deployment yet.'); return }
    setError(null)
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(() => navigate('/', { replace: true }), 1800)
  }

  return <main className="login-page section-dark">
    <div className="login-art">
      <div className="login-orbit"><span></span><span></span><span></span><b>R</b></div>
      <div><Eyebrow>Account</Eyebrow><h1>Choose a new<br/><span>password.</span></h1><p>You followed a password reset link — set a new password to finish.</p></div>
    </div>
    <div className="login-panel">
      <Link to="/" className="brand"><span className="brand-mark"><span></span><span></span><span></span></span><span>radio<span>pass</span></span></Link>
      <form className="login-form" onSubmit={submit}>
        <h2>New password</h2>
        <p>At least 6 characters.</p>
        <label>New password<input required minLength={6} type="password" placeholder="••••••••" value={password} onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}/></label>
        <button type="submit" className="button button-dark" disabled={loading || done}>{loading ? 'Please wait…' : 'Set password'} <Icon name="arrow" size={17}/></button>
        {error && <div className="form-message is-error"><Icon name="close" size={17}/>{error}</div>}
        {done && <div className="form-message"><Icon name="check" size={17}/>Password updated — taking you home.</div>}
      </form>
    </div>
  </main>
}

function InfoPage({ type }: { type: 'about'|'privacy'|'terms' }) {
  const data = {
    about: ['About RadioPass','Physics should be understood, not endured.','RadioPass is an exam-focused learning platform for FRCR Part 1 candidates. It combines interactive visual teaching, high-quality questions and structured revision so difficult physics becomes usable knowledge.'],
    privacy: ['Privacy','Clear, responsible data handling.','Creating an account stores your email address and your learning progress (scores, flags and favourites) with Supabase, our database and authentication provider — nothing else is collected, and nothing is sold or shared. This page is placeholder copy for an early-access build, not a reviewed legal policy: before accepting customers at scale, replace it with a policy covering retention, deletion requests and any analytics or payment services added later.'],
    terms: ['Terms of use','The rules for using RadioPass.','This is demonstration copy for the website build. Before accepting paying customers, replace it with terms reviewed for your legal entity, subscription model, refund policy, intellectual property and medical education disclaimer.'],
  }[type]
  // The page used to print `data[2]` twice — once in the hero, once again as
  // the opening paragraph of the prose — and then spend a heading on a
  // drafting checklist that no visitor is here to read. The statement is made
  // once, and the checklist goes where unfinished internal detail belongs:
  // kept, and folded away.
  return <main><PageHero eyebrow={data[0]} title={<>{data[1]}</>} text={data[2]}/><section className="section"><div className="container prose"><p className="notice"><Icon name="shield"/>This page is intentionally labelled as pre-launch copy so the website does not present incomplete legal wording as final advice.</p><MoreDetail summary="What this page must cover before launch">
    <p>Identity of the service provider, contact details, account responsibilities, payment terms, data processing, intellectual property, acceptable use, service availability and limitation of liability.</p>
  </MoreDetail></div></section></main>
}

function NotFound() { return <main><PageHero eyebrow="404" title={<>That page is outside<br/><span>the scan range.</span></>} text="The page you requested could not be found."><Link to="/" className="button button-primary">Return home <Icon name="arrow" size={17}/></Link></PageHero></main> }

function App() {
  return <><ScrollToTop/><Header/><RouteErrorBoundary><Suspense fallback={<MriLoading/>}><Routes><Route path="/" element={<Portal/>}/><Route path="/physics" element={<PhysicsHome/>}/><Route path="/physics/tour" element={<HomePage/>}/><Route path="/admin" element={<AdminConsole/>}/><Route path="/anatomy/*" element={<AnatomyRoutes/>}/><Route path="/adrenal-adenoma" element={<AdrenalAdenomaTool/>}/>
    {/* RADIOPASS PHYSICS. The dashboard above, the course engine here.
        Paths are written out rather than built from PHYSICS_ROOT on purpose:
        this table is the definition of what exists, labLink.test.ts reads it
        as text to prove no link in the product points at a route that is not
        here, and routes.test.ts checks the constant still agrees with it.

        The topic slug is a catch-all one segment under /physics, sitting
        alongside five static siblings. React Router ranks static above
        dynamic, so 'review' reaches Review rather than a topic named review —
        but only until someone names a topic 'review'. routes.test.ts fails the
        build if a topic id ever collides. */}
    <Route path="/physics/course" element={<Navigate to={PHYSICS_HREF.home} replace/>}/>
    <Route path="/physics/questions" element={<CourseQuestions/>}/>
    <Route path="/physics/review" element={<CourseReview/>}/>
    <Route path="/physics/mock" element={<QbMock/>}/>
    <Route path="/physics/:topicId" element={<CourseTopicPage/>}/>
    <Route path="/physics/:topicId/practice" element={<CoursePractice/>}/>
    {/* The address the course engine used to answer on. Bookmarks, the static
        pages under /public, and Continue positions stored before the merge. */}
    <Route path="/physics-v2/*" element={<LegacyCourseRedirect/>}/>
    <Route path="/question-bank" element={<QbIndex/>}/><Route path="/question-bank/mock" element={<QbMock/>}/><Route path="/question-bank/review/:filterId" element={<QbReview/>}/><Route path="/question-bank/:subjectId" element={<QbPractice/>}/><Route path="/fact-bank" element={<FactBankPage/>}/><Route path="/fact-bank/:topicId" element={<FactTopicPage/>}/><Route path="/ct-lab" element={<CtLab/>}/><Route path="/ct-lab/film" element={<CtFilm/>}/><Route path="/nm-lab" element={<NmLab/>}/><Route path="/nm-lab/film" element={<NmFilm/>}/><Route path="/mri-lab/motion" element={<MriMotion/>}/><Route path="/ultrasound-lab/motion" element={<UsMotion/>}/><Route path="/xray-lab" element={<XrayHub/>}/><Route path="/xray-lab/production" element={<XrayProductionLesson/>}/><Route path="/xray-lab/spectrum" element={<XraySpectrumLesson/>}/><Route path="/xray-lab/geometry" element={<XrayGeometryLesson/>}/><Route path="/xray-lab/interactions" element={<XrayInteractionsLesson/>}/><Route path="/xray-lab/mammography" element={<MammoLab/>}/><Route path="/xray-lab/fluoroscopy" element={<FluoroLab/>}/><Route path="/xray-lab/digital" element={<DigitalLab/>}/><Route path="/visual-lab" element={<VisualLabPage/>}/><Route path="/study-plan" element={<StudyPlanPage/>}/><Route path="/free-trial" element={<FreeTrialPage/>}/><Route path="/pricing" element={<PricingContent/>}/><Route path="/login" element={<LoginPage/>}/><Route path="/reset-password" element={<ResetPasswordPage/>}/><Route path="/about" element={<InfoPage type="about"/>}/><Route path="/privacy" element={<InfoPage type="privacy"/>}/><Route path="/terms" element={<InfoPage type="terms"/>}/>
    {/* Chapter 5 — the taught module. Nested so the navigator persists across
        every section instead of remounting on each one. */}
    <Route path="/mri" element={<MriModule/>}>
      <Route index element={<MriModuleHome/>}/>
      <Route path=":slug" element={<MriSection/>}/>
    </Route>
    <Route path="/mri-lab/course" element={<MriCourse/>}/>
    <Route path="/mri-lab/core" element={<MriCoreLesson/>}/>
    <Route path="/mri-lab/encoding" element={<MriEncodingLesson/>}/>
    <Route path="/mri-lab/learn/t1-spin-echo" element={<SeqT1/>}/>
    <Route path="/mri-lab/learn/t2-spin-echo" element={<SeqT2/>}/>
    <Route path="/mri-lab/learn/proton-density" element={<SeqPd/>}/>
    <Route path="/mri-lab/learn/flair" element={<SeqFlair/>}/>
    <Route path="/mri-lab/learn/stir" element={<SeqStir/>}/>
    <Route path="/mri-lab/learn/gradient-echo" element={<SeqGre/>}/>
    <Route path="/mri-lab" element={<MriFoundations/>}/>
    <Route path="/mri-lab/t1-spin-echo" element={<MriT1SpinEcho/>}/>
    <Route path="/mri-lab/t2-spin-echo" element={<MriT2SpinEcho/>}/>
    <Route path="/mri-lab/proton-density" element={<MriProtonDensity/>}/>
    <Route path="/mri-lab/flair" element={<MriFlair/>}/>
    <Route path="/mri-lab/stir" element={<MriStir/>}/>
    <Route path="/mri-lab/gradient-echo" element={<MriGradientEcho/>}/>
    <Route path="/mri-lab/laboratory" element={<MriFreeLab/>}/>
    <Route path="/mri-lab/comparison" element={<MriComparison/>}/>
    <Route path="/mri-lab/challenge" element={<MriChallenge/>}/>
    <Route path="/ultrasound-lab/focus" element={<UsFocusCourse/>}/><Route path="/ultrasound-lab" element={<UsFundamentals/>}/>
    <Route path="/ultrasound-lab/impedance" element={<UsImpedance/>}/>
    <Route path="/ultrasound-lab/reflection" element={<UsReflection/>}/>
    <Route path="/ultrasound-lab/refraction" element={<UsRefraction/>}/>
    <Route path="/ultrasound-lab/attenuation" element={<UsAttenuation/>}/>
    <Route path="/ultrasound-lab/pulse-echo" element={<UsPulseEcho/>}/>
    <Route path="/ultrasound-lab/transducer" element={<UsTransducer/>}/>
    <Route path="/ultrasound-lab/beam" element={<UsBeam/>}/>
    <Route path="/ultrasound-lab/resolution" element={<UsResolution/>}/>
    <Route path="/ultrasound-lab/controls" element={<UsControls/>}/>
    <Route path="/ultrasound-lab/doppler" element={<UsDoppler/>}/>
    <Route path="/ultrasound-lab/aliasing" element={<UsAliasing/>}/>
    <Route path="/ultrasound-lab/artefacts" element={<UsArtefacts/>}/>
    <Route path="/ultrasound-lab/harmonics" element={<UsHarmonics/>}/>
    <Route path="/ultrasound-lab/contrast" element={<UsContrast/>}/>
    <Route path="/ultrasound-lab/elastography" element={<UsElastography/>}/>
    <Route path="/ultrasound-lab/safety" element={<UsSafety/>}/>
    <Route path="/ultrasound-lab/probes" element={<UsProbes/>}/>
    <Route path="/ultrasound-lab/qa" element={<UsQa/>}/>
    <Route path="/ultrasound-lab/exam" element={<UsExamLab/>}/>
    <Route path="/ultrasound-lab/facts" element={<UsFactBank/>}/>
    <Route path="*" element={<NotFound/>}/></Routes></Suspense></RouteErrorBoundary><Footer/></>
}

export default App
