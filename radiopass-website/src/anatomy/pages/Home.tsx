import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SECTION_META } from '../data/sectionMeta';
import { computeHomeStats, randomQuestionId, sectionModalities } from '../lib/summaryStats';
import { lastOfType } from '../../lib/learner';
import { getLastQuestion } from '../lib/progress';
import type { SectionId } from '../types';
/* The owner's sculpture renders (src/assets/sculpture, 1400px JPEGs),
   presented with the shared .rp-sculpt treatment from styles.css. */
import brainRender from '../../assets/sculpture/brain.jpg';
import chestRender from '../../assets/sculpture/chest.jpg';
import giRender from '../../assets/sculpture/gi.jpg';
import mskRender from '../../assets/sculpture/msk.jpg';
import './Home.css';

/* Region codes, as a radiologist abbreviates them, for the worklist chips. */
const CODES: Record<SectionId, string> = {
  'head-neck': 'HN',
  thorax: 'TH',
  spine: 'SP',
  'abdo-pelvis': 'AP',
  'upper-limb': 'UL',
  'lower-limb': 'LL',
};

/* The sculpture gallery: the six regions as chapter entries in one composed
   layout — three large renders, one supporting, and two typographic entries.
   Craniocaudal order, alternating sides, so it reads as a collection rather
   than six identical cards.

   The owner will supply spine and upper-limb renders in the same style as
   the existing four; until then those two regions are typographic entries
   (hairline frame, region code, no image). renal.jpg is deliberately NOT
   used here — it belongs to the homepage gallery. */
/* Only the regions whose render exists. Spine and Upper Limb were carried
   here as typographic plates standing in for missing artwork; a placeholder
   is not a chapter entry, and two of them broke the set. Every region is
   still reachable — the worklist below lists all six with their counts. */
const GALLERY: { id: SectionId; art: string }[] = [
  { id: 'head-neck', art: brainRender },
  { id: 'thorax', art: chestRender },
  { id: 'abdo-pelvis', art: giRender },
  { id: 'lower-limb', art: mskRender },
];

/* Where each region sits on the journey's timeline, for ?region= deep links.
   The body runs head → thorax → abdomen → limbs over the pinned scroll. */
/* Derived from the composed body's landmark heights (vertex 7vh ... sole
   393vh over a 300vh travel): progress = (band centre - 50vh) / 300. */
const REGION_PROGRESS: Partial<Record<SectionId, number>> = {
  'head-neck': 0.03,
  thorax: 0.18,
  spine: 0.24,
  'abdo-pelvis': 0.42,
  'upper-limb': 0.48,
  'lower-limb': 0.85,
};

export default function Home() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const rows = useMemo(
    () =>
      SECTION_META.map((s) => {
        /* Both read the generated summary, not the bank — see
           lib/summaryStats.ts. This page used to import the whole question
           dataset (a 1 MB chunk) to render six cards. */
        const stats = computeHomeStats(s.id);
        const modalities = sectionModalities(s.id);
        return { meta: s, stats, modalities, last: getLastQuestion(s.id) };
      }),
    []
  );

  /* THE ONE OBVIOUS NEXT ACTION.
     Taken from the shared learner timeline rather than guessed: the most
     recent answered question names the region, and getLastQuestion gives the
     exact case to resume. With no history there is no Continue at all — an
     invented "start with the spine" would be a recommendation nobody made. */
  const resume = useMemo(() => {
    const last = lastOfType('question.answered', 'anatomy');
    if (!last?.topic) return null;
    const meta = SECTION_META.find((m) => m.id === last.topic);
    if (!meta) return null;
    const questionId = getLastQuestion(meta.id);
    return {
      meta,
      to: questionId ? `/anatomy/section/${meta.id}/q/${questionId}` : `/anatomy/section/${meta.id}`,
      at: last.at,
    };
  }, []);

  /* Flagged across every region. Real count or nothing — never a zero chip
     pretending to be a feature the learner has not used.
     Summed from the rows already computed above rather than calling into
     lib/stats: that module imports the question bank, and reaching it for a
     COUNT was the last thing pulling a 1 MB chunk onto this page. */
  const flaggedCount = useMemo(() => rows.reduce((n, r) => n + r.stats.flagged, 0), [rows]);

  /* Two different numbers, and the difference matters.
     `structures` and `questions` describe the bank; `attempted`, `rawScore`
     and `maxScore` describe the reader. The home page leads with the second
     kind, because "how am I doing" is the question someone opens it to ask.
     Score is computed over ATTEMPTED questions only — averaging in the ones
     never seen would read as a falling mark for doing nothing wrong. */
  const totals = rows.reduce(
    (a, r) => ({
      questions: a.questions + r.stats.total,
      attempted: a.attempted + r.stats.attempted,
      structures: a.structures + r.stats.maxScore / 2,
      rawScore: a.rawScore + r.stats.rawScore,
      attemptedMax: a.attemptedMax + r.stats.attemptedMaxScore,
    }),
    { questions: 0, attempted: 0, structures: 0, rawScore: 0, attemptedMax: 0 }
  );

  const overallPercent = totals.attemptedMax > 0
    ? Math.round((totals.rawScore / totals.attemptedMax) * 100)
    : 0;
  const overallComplete = totals.questions > 0
    ? Math.round((totals.attempted / totals.questions) * 100)
    : 0;

  /* ?skull=off forces the pre-hero page, so both branches can be smoke-checked
     in one session — the "exactly one h1" invariant is enforced by this one
     expression and by nothing else. */

  const resumable = rows.find((r) => r.last);
  const firstLoaded = rows.find((r) => r.stats.total > 0);
  const loadedRegions = rows.filter((r) => r.stats.total > 0).length;

  function openRandom() {
    const pool = rows.filter((r) => r.stats.total > 0);
    if (!pool.length) return;
    const r = pool[Math.floor(Math.random() * pool.length)];
    const id = randomQuestionId(r.meta.id);
    if (!id) return;
    navigate(`/anatomy/section/${r.meta.id}/q/${id}`);
  }

  /* Honour ?goto=modules from the header: land on the syllabus, no film.

     Keyed on the parameter, not on mount. Clicking "Modules" while already
     on the home page changes the URL without remounting this component, so a
     mount-only effect never fired and the click appeared to do nothing until
     the reader refreshed the page. The parameter is then cleared, so pressing
     it a second time scrolls again rather than being a no-op. */
  const goto = params.get('goto');
  useEffect(() => {
    if (goto !== 'modules') return;
    /* Deliberately not requestAnimationFrame. rAF does not fire in a tab the
       browser considers hidden — a restored session, a background tab, or a
       preview pane — and the jump then silently never happened. A timeout
       still runs there, and a second attempt covers the case where the
       worklist has not finished laying out on the first tick. */
    const timers = [0, 120].map((d) =>
      window.setTimeout(() => {
        const el = document.getElementById('modules');
        if (!el) return;
        window.scrollTo({ top: el.offsetTop, behavior: 'instant' as ScrollBehavior });
      }, d)
    );
    // Clear the parameter so pressing "Modules" again jumps again.
    const clear = window.setTimeout(() => setParams({}, { replace: true }), 400);
    return () => [...timers, clear].forEach(window.clearTimeout);
  }, [goto, setParams]);

  /* Honour ?region= on arrival: land the journey at that part of the body. */
  const requested = params.get('region') as SectionId | null;
  useEffect(() => {
    if (!requested || !(requested in REGION_PROGRESS)) return;
    const previous = history.scrollRestoration;
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const id = window.setTimeout(() => {
      const wrap = document.querySelector<HTMLElement>('.anatomy-journey');
      if (!wrap) return;
      const span = wrap.offsetHeight - window.innerHeight;
      const y = wrap.offsetTop + span * (REGION_PROGRESS[requested] ?? 0);
      window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
    }, 0);
    return () => {
      window.clearTimeout(id);
      if ('scrollRestoration' in history) history.scrollRestoration = previous;
    };
    // Keyed on the region for the same reason as ?goto= above: arriving from
    // an in-page link does not remount, so a mount-only effect never ran.
  }, [requested]);

  /* Hoisted so the two heroes can never drift: whichever one is on the page
     carries the same links, the same numbers and the same way past the film. */
  const heroProps = {
    startTo: resumable
      ? `/anatomy/section/${resumable.meta.id}/q/${resumable.last}`
      : `/anatomy/section/${firstLoaded?.meta.id ?? 'spine'}`,
    onQuestionBank: openRandom,
    metaLine: `${totals.questions} labelled cases · ${Math.round(
      totals.structures
    )} structures · marked like the exam`,
    onSkip: () => document.getElementById('modules')?.scrollIntoView({ behavior: 'smooth' }),
  };

  return (
    <div className="home">
      {/* Skull, dissolve, chest, done — then the syllabus. The full-body
          journey film is retired from this path on the owner's instruction
          ("keep the chest... that's set"): its 400vh of travel was the dead
          space between the objects. It still renders as the fallback hero
          when no skull frames exist, so that branch keeps its h1. ?region=
          deep links guard on the journey's presence and degrade to the top
          of the page. */}
      {/* THE DECORATIVE HERO IS GONE, on the owner's instruction: "remove this
          ugly skull... it just obscures the view". What replaced it is a plain
          page head — the same h1, the same one action — so the page opens on
          what it is rather than on a picture of a skull.

          Both former branches are retired here, not just the skull: the
          fallback drew AnatomyJourney, whose body-full.webp is 1.2 MB — over
          a megabyte of decoration to replace decoration the owner had just
          asked to remove. Neither component is deleted; they are simply no
          longer this page's opening, and the skull frames stay on disk. */}
      <header className="home-head">
        <div className="home-head-in">
          <div className="home-head-copy">
            <h1 className="hero-title">
              Radiology Anatomy,
              <br />
              <em>Made Visible.</em>
            </h1>
            <p className="hero-eq">See what the structure means.</p>
            <p className="hero-sub">Interactive visual learning for FRCR anatomy.</p>
            {heroProps.metaLine && <p className="hero-meta mono">{heroProps.metaLine}</p>}
            <div className="rpa-hero-actions">
              <button type="button" className="btn btn-primary" onClick={heroProps.onQuestionBank}>
                {heroProps.startTo ? 'Resume the question bank' : 'Start the question bank'}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
          {/* A PLACEHOLDER PLATE, to be swapped for the owner's own image.

              Deliberately the render this page already imports, rather than a
              new asset: it is bundled twice over already (the region gallery
              and the scenery layer), so putting it here adds no bytes and
              nothing new to replace later.

              Decorative, so alt="" and aria-hidden — the hero already says
              what the page is in text, and a screen reader announcing a
              second description of the artwork would only repeat it. */}
          <div className="home-head-art">
            <img src={chestRender} alt="" aria-hidden="true" decoding="async" />
          </div>
        </div>
      </header>

      {/* The chest is not a destination any more — it is the page's ground.
          A fixed, faint layer the content scrolls OVER, so it is felt as
          design rather than presented as a moment ("I don't want to see the
          chest itself... just want it to be there as a design"). Fixed as an
          element, not background-attachment (which iOS never honoured);
          z-index 0 keeps it under the hero's opaque ground and under every
          section's translucent ground. The source is the owner's chest
          render, screen-blended so its black rectangle melts into the navy. */}
      <img
        className="home-chest-bg"
        src={chestRender}
        alt=""
        aria-hidden="true"
        decoding="async"
        loading="lazy"
      />

      {/* THE SIX REGIONS AS A GALLERY. Chapter entries at varied scale —
          the renders large, labels outside the object, negative space doing
          the composition — each entry one Link to the same destination the
          worklist row uses, carrying the same count the worklist reads.
          Deliberately its own anchor: #modules stays on the worklist below
          and ?goto=modules keeps landing there. */}
      <section className="region-gallery" id="regions" aria-label="Regions">
        <header className="rg-head">
          <p className="rpa-eyebrow">The syllabus</p>
          <h2>The regions</h2>
        </header>
        <div className="rg-grid">
          {GALLERY.map(({ id, art }) => {
            const row = rows.find((r) => r.meta.id === id);
            if (!row) return null;
            const count = row.stats.total;
            return (
              <Link key={id} to={`/anatomy/section/${id}`} className="rg-entry">
                <span className="rp-sculpt rg-art">
                  <img src={art} alt="" loading="lazy" decoding="async" />
                </span>
                <span className="rg-label">
                  <span className="rg-code mono">{CODES[id]}</span>
                  <span className="rg-title">{row.meta.title}</span>
                  <span className="rg-count mono">
                    {count > 0 ? `${count} cases` : 'not loaded yet'}
                  </span>
                  <span className="rg-enter mono" aria-hidden="true">
                    Enter →
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Your standing, before anything else on the page.
          Nothing here is the catalogue's size — every figure is the reader's
          own work, which is what someone opens this page to check. */}
      <section className="scoreband" aria-label="Your progress">
        <div className="scoreband-grid">
          <div className="score-cell score-cell-lead">
            <p className="score-value">{totals.attempted ? `${overallPercent}%` : '—'}</p>
            <p className="score-label mono">Your score</p>
            <p className="score-note mono">
              {totals.attempted ? 'across everything you have answered' : 'answer a case to begin'}
            </p>
          </div>
          <div className="score-cell">
            <p className="score-value">
              {totals.attempted}<span className="score-of">/{totals.questions}</span>
            </p>
            <p className="score-label mono">Questions answered</p>
          </div>
          <div className="score-cell">
            <p className="score-value">{overallComplete}%</p>
            <p className="score-label mono">Bank complete</p>
            <span className="score-bar" aria-hidden="true">
              <span className="score-bar-fill" style={{ width: `${overallComplete}%` }} />
            </span>
          </div>
        </div>
      </section>

      {/* ONE OBVIOUS NEXT ACTION, then everything else.
          Present only when there is a real history to resume. */}
      {resume && (
        <section className="an-continue-wrap" aria-label="Continue">
          <Link className="an-continue" to={resume.to}>
            <span className="an-continue-label mono">Continue</span>
            <span className="an-continue-name">{resume.meta.title}</span>
            <span className="an-continue-go" aria-hidden="true">&rarr;</span>
          </Link>
        </section>
      )}

      {/* The four Anatomy destinations. The regions below ARE the question
          bank, so it points at them rather than duplicating the list. */}
      <section className="an-dest" aria-label="Anatomy">
        <Link className="an-dest-item" to="/anatomy/atlas">
          <strong>Structure Atlas</strong>
          <span>Every image of a structure on one page, across modalities and planes.</span>
        </Link>
        <a className="an-dest-item" href="#modules">
          <strong>Question bank</strong>
          <span>{totals.questions} labelled cases across six regions, marked 0/1/2 like the exam.</span>
        </a>
        {/* No anatomy mock papers exist yet. Saying so is the honest state;
            inventing one to fill the row would be worse than the gap. */}
        <span className="an-dest-item is-pending">
          <strong>Mock exams</strong>
          <span>Timed anatomy papers are not built yet.</span>
        </span>
        <Link className="an-dest-item" to="/anatomy/dashboard">
          <strong>Progress &amp; revision</strong>
          <span>
            {flaggedCount > 0
              ? `Your scores by region, and the ${flaggedCount} case${flaggedCount === 1 ? '' : 's'} you flagged.`
              : 'Your scores by region, and everything worth another pass.'}
          </span>
        </Link>
      </section>

      {/* The cross-sectional viewers and the appeals list. Secondary to the
          four destinations above — they are tools you reach for occasionally,
          not the shape of the syllabus — but they must stay reachable, and
          they left the header when it ran out of room. */}
      <section className="an-tools" aria-label="Viewers">
        <Link to="/anatomy/cxr">Chest radiograph atlas</Link>
        <Link to="/anatomy/mri/head-bone">CT head — bone window</Link>
        <Link to="/anatomy/mri/hip-axial-t1">MRI hip — axial T1</Link>
        <Link to="/anatomy/disputes">Disputed marks</Link>
      </section>

      {/* The topics, each carrying its own share of the same two numbers. */}
      <section className="worklist" id="modules">
        <header className="worklist-head">
          <p className="rpa-eyebrow">By topic</p>
          <h2>Where you stand in each region</h2>
          <span className="worklist-count mono">
            {loadedRegions} of {rows.length} regions loaded
          </span>
        </header>

        <div className="worklist-rows">
          {rows.map(({ meta, stats, modalities, last }) => {
            const empty = stats.total === 0;
            return (
              <Link
                to={`/anatomy/section/${meta.id}`}
                key={meta.id}
                className={empty ? 'wl-row wl-row-empty' : 'wl-row'}
              >
                <span className="wl-code mono">{CODES[meta.id]}</span>

                <span className="wl-main">
                  <span className="wl-title">{meta.title}</span>
                  <span className="wl-desc">{meta.description}</span>
                </span>

                <span className="wl-modalities">
                  {modalities.slice(0, 4).map((m) => (
                    <span className="pill" key={m}>
                      {m}
                    </span>
                  ))}
                </span>

                <span className="wl-count mono">
                  {empty ? '—' : `${stats.attempted}/${stats.total} answered`}
                </span>

                <span className="wl-score mono">
                  {stats.attempted ? `${stats.percentScore}%` : '—'}
                  <small>score</small>
                </span>

                <span className="wl-progress">
                  <span className="wl-bar">
                    <span className="wl-bar-fill" style={{ width: `${stats.completionPercent}%` }} />
                  </span>
                  <span className="wl-pct mono">{stats.completionPercent}%</span>
                </span>

                <span className="wl-action mono">{last ? 'Resume' : empty ? '' : 'Open'}</span>
              </Link>
            );
          })}
        </div>

      </section>
    </div>
  );
}
