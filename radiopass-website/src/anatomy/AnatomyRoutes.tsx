/**
 * RadioPass Anatomy, mounted inside the one application.
 *
 * This replaces the anatomy build's own App.tsx. What changed and what did
 * not:
 *
 *   GONE   its HashRouter. Anatomy now uses the application's BrowserRouter,
 *          so its addresses are real paths — /anatomy/atlas rather than
 *          /anatomy/#/atlas. LegacyHashRedirect below keeps every old
 *          bookmark working.
 *   GONE   its own React root, its own Suspense boundary, its own 404.
 *   KEPT   every page, unchanged, including the whole authoring suite.
 *   KEPT   the lazy boundaries exactly as they were. They were chosen with
 *          care — Home, SectionHub and QuestionPlayer are the path from the
 *          front page to answering a question and stay eager; the Atlas, the
 *          viewers and the editors load on demand. Merging must not put the
 *          authoring suite into the application's first download.
 *   KEPT   the content-API boot, which resolves the server overlay before
 *          anything renders so a replaced image never flashes as the old one.
 *
 * Paths here are RELATIVE. The parent route mounts this at /anatomy, so
 * "atlas" resolves to /anatomy/atlas and the subtree could be remounted
 * elsewhere without touching a line of this file.
 */

import { lazy, useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { RequireAccess } from '../portal/Gate'

import Layout from './components/Layout'
import RequireAdmin from './components/RequireAdmin'
import { contentLoaded, loadContent, subscribeContent } from './lib/content/store'
import Home from './pages/Home'
import './anatomy.css'

/* The Structure Atlas is a browsing tool rather than a step on the path to
   answering a question, so it loads on demand. Its three pages share one
   chunk: a learner who opens the Atlas will use all three. */
/* The learner path — front page, a region, a question.
   These were EAGER, on the reasoning that they are the walk from the home
   page to answering something. The cost of that was paid by everyone on
   arrival: SectionHub and QuestionPlayer both import the question bank, so
   simply opening /anatomy downloaded and parsed all 521 questions with every
   label, marker, variant and teaching paragraph — a 192 KB chunk (1 MB raw)
   before the six region cards could paint.

   The first load now buys only the front page. Clicking a region fetches its
   chunk, which is the right place to spend it: that click is a deliberate act
   with an obvious cause, where arriving at a slow home page is neither. */
const SectionHub = lazy(() => import('./pages/SectionHub'))
const QuestionPlayer = lazy(() => import('./pages/QuestionPlayer'))

/* Authoring. These were eager despite this file's own rule that the authoring
   suite must not be in the application's first download — QuestionWording and
   ImageManager both pull the bank too. */
const StructureFolders = lazy(() => import('./pages/StructureFolders'))
const QuestionWording = lazy(() => import('./pages/QuestionWording'))
const ImageManager = lazy(() => import('./pages/ImageManager'))

const AtlasHome = lazy(() => import('./pages/AtlasHome'))
const AtlasChapter = lazy(() => import('./pages/AtlasChapter'))
const AtlasStructure = lazy(() => import('./pages/AtlasStructure'))


const Dashboard = lazy(() => import('./pages/Dashboard'))
const Disputes = lazy(() => import('./pages/Disputes'))
const MriViewer = lazy(() => import('./pages/MriViewer'))
const ChestXrayAtlas = lazy(() => import('./pages/ChestXrayAtlas'))
const AdminLogin = lazy(() => import('./pages/AdminLogin'))
const CustomCaseEditor = lazy(() => import('./pages/CustomCaseEditor'))
const ReplaceImageEditor = lazy(() => import('./pages/ReplaceImageEditor'))

function NotFound() {
  return (
    <div className="empty-state">
      <h1>Page not found</h1>
      <p>That address does not match anything in RadioPass Anatomy.</p>
      <Link className="btn btn-primary" to="/anatomy">
        Back to Anatomy
      </Link>
    </div>
  )
}

function Loading() {
  return (
    <div className="empty-state" aria-busy="true">
      <p>Loading…</p>
    </div>
  )
}

/**
 * Every anatomy address ever shared was of the form /anatomy/#/atlas, because
 * the branch ran on a hash router. Those links are in browser histories, in
 * bookmarks and in messages between candidates, and the merge must not break
 * a single one of them.
 *
 * Runs before the routes are matched: if a hash that looks like a path is
 * present, it is replaced with the real path and the router takes it from
 * there. `replace` so the redirect does not sit in the back stack.
 */
function LegacyHashRedirect({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const hash = location.hash
  const legacy = hash.startsWith('#/') ? hash.slice(1) : null

  useEffect(() => {
    if (!legacy) return
    const target = `/anatomy${legacy === '/' ? '' : legacy}`
    window.history.replaceState(null, '', target)
    /* A replaceState alone does not tell React Router to re-match, so nudge it
       with the event the router already listens for. */
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, [legacy])

  if (legacy) return <Loading />
  return <>{children}</>
}

/**
 * The overlay is resolved before anything renders.
 *
 * The content API holds the edits an author has published. Rendering the
 * shipped question first and swapping it a moment later showed the OLD image
 * to a candidate on every load, which is precisely the doubt the online editor
 * exists to remove. A static deployment with no API resolves immediately.
 */
function useContentBoot(): boolean {
  const [ready, setReady] = useState(() => contentLoaded())
  useEffect(() => {
    if (ready) return
    const stop = subscribeContent(() => setReady(true))
    /* A second, independent deadline. loadContent already budgets each
       backend probe, but this gate decides whether the anatomy site renders
       AT ALL, and it must not depend on another module continuing to keep
       its promises. Whatever happens upstream, the site opens.

       This exists because it did not: adding a Supabase probe to loadContent
       put a token refresh — which takes a cross-tab lock, released on a
       backgrounded tab's throttled timers — in front of the first paint, and
       the anatomy home sat on a loading screen for about a minute. No amount
       of reviewing the overlay logic would have found that, because nothing
       about it was logically wrong. */
    const deadline = setTimeout(() => setReady(true), 3000)
    void loadContent()
    return () => {
      clearTimeout(deadline)
      stop()
    }
  }, [ready])
  return ready
}

export default function AnatomyRoutes() {
  const ready = useContentBoot()
  if (!ready) return <Loading />

  /* THE SCOPE. anatomy.css places every anatomy rule under `.rp-anatomy`,
     because the two halves declared eight CSS variables under the same names
     on :root and sharing a document would have repainted physics by load
     order. This element is the other half of that contract — without it the
     anatomy pages render with none of their own styling. */
  return (
    <LegacyHashRedirect>
      <div className="rp-anatomy">
      <Routes>
        <Route element={<Layout />}>
          {/* Home and dashboard stay open on purpose: 'home' and 'progress' are
              PUBLIC_KINDS, a shop window needs a shop window, and a learner
              must always be able to reach their own record — including after
              a plan lapses, when their scores are still theirs. Everything
              below that teaches or tests is gated. */}
          <Route index element={<Home />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="disputes" element={<Disputes />} />
          <Route path="mri/:studyId" element={<RequireAccess resource={{ branch: 'anatomy', kind: 'module' }}><MriViewer /></RequireAccess>} />
          <Route path="cxr" element={<RequireAccess resource={{ branch: 'anatomy', kind: 'module' }}><ChestXrayAtlas /></RequireAccess>} />
          <Route path="atlas" element={<RequireAccess resource={{ branch: 'anatomy', kind: 'atlas' }}><AtlasHome /></RequireAccess>} />
          <Route path="atlas/:chapterId" element={<RequireAccess resource={{ branch: 'anatomy', kind: 'atlas' }}><AtlasChapter /></RequireAccess>} />
          <Route path="atlas/:chapterId/:structureId" element={<RequireAccess resource={{ branch: 'anatomy', kind: 'atlas' }}><AtlasStructure /></RequireAccess>} />
          <Route path="section/:sectionId" element={<RequireAccess resource={{ branch: 'anatomy', kind: 'questions' }}><SectionHub /></RequireAccess>} />
          <Route path="admin" element={<AdminLogin />} />
          {/* Authoring: joining the structures the dataset records twice. */}
          <Route
            path="admin/structures"
            element={
              <RequireAdmin>
                <StructureFolders />
              </RequireAdmin>
            }
          />
          <Route
            path="section/:sectionId/custom"
            element={
              <RequireAdmin>
                <CustomCaseEditor />
              </RequireAdmin>
            }
          />
          <Route path="section/:sectionId/q/:questionId" element={<RequireAccess resource={{ branch: 'anatomy', kind: 'questions' }}><QuestionPlayer /></RequireAccess>} />
          <Route
            path="section/:sectionId/q/:questionId/replace-image"
            element={
              <RequireAdmin>
                <ReplaceImageEditor />
              </RequireAdmin>
            }
          />
          {/* Words only. Geometry is edited on the image page above; these two
              write through the same merged document so neither undoes the
              other. */}
          <Route
            path="section/:sectionId/q/:questionId/wording"
            element={
              <RequireAdmin>
                <QuestionWording />
              </RequireAdmin>
            }
          />
          {/* Every film in the section at once — remove, bring back, rename. */}
          <Route
            path="section/:sectionId/images"
            element={
              <RequireAdmin>
                <ImageManager />
              </RequireAdmin>
            }
          />
          {/* An old link, a typo, a URL from a newer build. */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      </div>
    </LegacyHashRedirect>
  )
}

/** Kept so the physics side can link to anatomy without knowing its shape. */
export function AnatomyIndexRedirect() {
  return <Navigate to="/anatomy" replace />
}
