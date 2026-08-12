import { lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, Link, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { contentLoaded, loadContent, subscribeContent } from './lib/content/store';
import Home from './pages/Home';
import SectionHub from './pages/SectionHub';
import QuestionPlayer from './pages/QuestionPlayer';
import RequireAdmin from './components/RequireAdmin';

/* Split out of the first download.
 *
 * Everything used to ship as one file, so a candidate opening a question also
 * fetched and parsed the MRI viewer, the CT atlas and the whole authoring
 * suite before anything appeared. None of that is on the path from the front
 * page to answering a question, and most candidates never touch any of it.
 *
 * Home, SectionHub and QuestionPlayer stay eager: they ARE that path, and
 * putting a loading state between a candidate and the next question would
 * trade a one-off cost for a recurring one. */
/* The Structure Atlas is a browsing tool rather than a step on the path to
   answering a question, so it loads on demand like the other labs. Its three
   pages share one chunk: a learner who opens the Atlas will use all three. */
const AtlasHome = lazy(() => import('./pages/AtlasHome'));
const AtlasChapter = lazy(() => import('./pages/AtlasChapter'));
const AtlasStructure = lazy(() => import('./pages/AtlasStructure'));

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Disputes = lazy(() => import('./pages/Disputes'));
const MriViewer = lazy(() => import('./pages/MriViewer'));
const ChestXrayAtlas = lazy(() => import('./pages/ChestXrayAtlas'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const CustomCaseEditor = lazy(() => import('./pages/CustomCaseEditor'));
const ReplaceImageEditor = lazy(() => import('./pages/ReplaceImageEditor'));

function NotFound() {
  return (
    <div className="empty-state">
      <h1>Page not found</h1>
      <p>That address does not match anything on the site.</p>
      <Link className="btn btn-primary" to="/">
        Back to the modules
      </Link>
    </div>
  );
}

/* Deliberately plain. These chunks are small and usually already cached, so
   anything more elaborate would flash on screen for a few milliseconds and
   read as a glitch. */
function Loading() {
  return <div className="empty-state" aria-busy="true"><p>Loading…</p></div>;
}

/* The overlay is resolved before anything renders.
 *
 * Both the Question Bank and the Structure Atlas read questions through
 * getSectionQuestions(), which applies the editor's saved changes. Painting
 * before that lands would show a film that has already been replaced and then
 * swap it underneath the reader — worse than a beat of "Loading". The wait is
 * one small JSON request, it is skipped entirely once cached, and a
 * deployment with no content service settles immediately as "offline" and
 * runs exactly as it did before. */
function useContentBoot(): boolean {
  const [ready, setReady] = useState(contentLoaded);

  useEffect(() => {
    if (ready) return;
    const stop = subscribeContent(() => setReady(contentLoaded()));
    /* A slow or hanging content service must not hold the whole site
       hostage: after three seconds the bundled questions are shown, and the
       overlay is applied as soon as it arrives. */
    const bail = window.setTimeout(() => setReady(true), 3000);
    loadContent().finally(() => setReady(true));
    return () => {
      stop();
      window.clearTimeout(bail);
    };
  }, [ready]);

  return ready;
}

export default function App() {
  const ready = useContentBoot();
  if (!ready) return <Loading />;

  return (
    <HashRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/disputes" element={<Disputes />} />
            <Route path="/mri/:studyId" element={<MriViewer />} />
            <Route path="/cxr" element={<ChestXrayAtlas />} />
            <Route path="/atlas" element={<AtlasHome />} />
            <Route path="/atlas/:chapterId" element={<AtlasChapter />} />
            <Route path="/atlas/:chapterId/:structureId" element={<AtlasStructure />} />
            <Route path="/section/:sectionId" element={<SectionHub />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/section/:sectionId/custom" element={<RequireAdmin><CustomCaseEditor /></RequireAdmin>} />
            <Route path="/section/:sectionId/q/:questionId" element={<QuestionPlayer />} />
            <Route path="/section/:sectionId/q/:questionId/replace-image" element={<RequireAdmin><ReplaceImageEditor /></RequireAdmin>} />
            {/* Anything else — an old link, a typo, a shared URL from a newer
                build — lands here rather than on a blank page. */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
