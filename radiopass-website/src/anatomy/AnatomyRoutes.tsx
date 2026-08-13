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
 *          viewers, the scout and the editors load on demand. Merging must
 *          not put the 1,767-line volume builder or the authoring suite into
 *          the application's first download.
 *   KEPT   the content-API boot, which resolves the server overlay before
 *          anything renders so a replaced image never flashes as the old one.
 *
 * Paths here are RELATIVE. The parent route mounts this at /anatomy, so
 * "atlas" resolves to /anatomy/atlas and the subtree could be remounted
 * elsewhere without touching a line of this file.
 */

import { lazy, useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import Layout from './components/Layout'
import RequireAdmin from './components/RequireAdmin'
import { contentLoaded, loadContent, subscribeContent } from './lib/content/store'
import Home from './pages/Home'
import SectionHub from './pages/SectionHub'
import QuestionPlayer from './pages/QuestionPlayer'
import './anatomy.css'

/* The Structure Atlas is a browsing tool rather than a step on the path to
   answering a question, so it loads on demand. Its three pages share one
   chunk: a learner who opens the Atlas will use all three. */
const AtlasHome = lazy(() => import('./pages/AtlasHome'))
const AtlasChapter = lazy(() => import('./pages/AtlasChapter'))
const AtlasStructure = lazy(() => import('./pages/AtlasStructure'))

/* The scout. Lazy for the same reason as the Atlas, and emphatically so: it
   pulls in the 1,767-line procedural volume builder, the largest single module
   in the anatomy tree, which must never sit on a first download. */
const VolumeExplorer = lazy(() => import('./pages/VolumeExplorer'))

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
    void loadContent()
    return stop
  }, [ready])
  return ready
}

export default function AnatomyRoutes() {
  const ready = useContentBoot()
  if (!ready) return <Loading />

  return (
    <LegacyHashRedirect>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="disputes" element={<Disputes />} />
          <Route path="mri/:studyId" element={<MriViewer />} />
          <Route path="cxr" element={<ChestXrayAtlas />} />
          <Route path="volume" element={<VolumeExplorer />} />
          <Route path="atlas" element={<AtlasHome />} />
          <Route path="atlas/:chapterId" element={<AtlasChapter />} />
          <Route path="atlas/:chapterId/:structureId" element={<AtlasStructure />} />
          <Route path="section/:sectionId" element={<SectionHub />} />
          <Route path="admin" element={<AdminLogin />} />
          <Route
            path="section/:sectionId/custom"
            element={
              <RequireAdmin>
                <CustomCaseEditor />
              </RequireAdmin>
            }
          />
          <Route path="section/:sectionId/q/:questionId" element={<QuestionPlayer />} />
          <Route
            path="section/:sectionId/q/:questionId/replace-image"
            element={
              <RequireAdmin>
                <ReplaceImageEditor />
              </RequireAdmin>
            }
          />
          {/* An old link, a typo, a URL from a newer build. */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </LegacyHashRedirect>
  )
}

/** Kept so the physics side can link to anatomy without knowing its shape. */
export function AnatomyIndexRedirect() {
  return <Navigate to="/anatomy" replace />
}
