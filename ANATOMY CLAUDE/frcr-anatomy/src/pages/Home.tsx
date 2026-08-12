import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SECTION_META, getSectionQuestions } from '../data/sections';
import { computeSectionStats } from '../lib/stats';
import { getLastQuestion } from '../lib/progress';
import AnatomyJourney from '../components/AnatomyJourney';
import SkullHero from '../components/SkullHero';
import { HERO_FRAMES } from '../data/heroFrames';
import { frameUrl } from '../lib/skullFrames';
import type { SectionId } from '../types';
import './Home.css';

/* A compile-time constant: whether the skull hero exists at all is decided
   before the first paint, so the page height never changes after images load.
   ?goto=modules and ?region= below both read offsetTop out of live layout and
   stay correct only because of that. Never make this async.

   With nothing on disk this is false, SkullHero never mounts — no DOM, no
   observer, no rAF, no network — and the rendered tree is exactly what it was
   before the hero existed. */
const MIN_FRAMES = 6;
const HAS_SKULL =
  HERO_FRAMES.ladders.some((l) => l.frames.length >= MIN_FRAMES) && !!HERO_FRAMES.poster;

/* Region codes, as a radiologist abbreviates them, for the worklist chips. */
const CODES: Record<SectionId, string> = {
  'head-neck': 'HN',
  thorax: 'TH',
  spine: 'SP',
  'abdo-pelvis': 'AP',
  'upper-limb': 'UL',
  'lower-limb': 'LL',
};

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
        const stats = computeSectionStats(s.id);
        const questions = getSectionQuestions(s.id);
        const modalities = Array.from(new Set(questions.map((q) => q.imagingModality)));
        return { meta: s, stats, modalities, last: getLastQuestion(s.id) };
      }),
    []
  );

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
      attemptedMax: a.attemptedMax + (r.stats.attempted ? (r.stats.maxScore * r.stats.attempted) / Math.max(1, r.stats.total) : 0),
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
  const showSkull = HAS_SKULL && params.get('skull') !== 'off';

  const resumable = rows.find((r) => r.last);
  const firstLoaded = rows.find((r) => r.stats.total > 0);
  const loadedRegions = rows.filter((r) => r.stats.total > 0).length;

  function openRandom() {
    const pool = rows.filter((r) => r.stats.total > 0);
    if (!pool.length) return;
    const r = pool[Math.floor(Math.random() * pool.length)];
    const qs = getSectionQuestions(r.meta.id);
    const q = qs[Math.floor(Math.random() * qs.length)];
    navigate(`/section/${r.meta.id}/q/${q.id}`);
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
      ? `/section/${resumable.meta.id}/q/${resumable.last}`
      : `/section/${firstLoaded?.meta.id ?? 'spine'}`,
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
      {showSkull ? <SkullHero {...heroProps} /> : <AnatomyJourney {...heroProps} showCopy />}

      {/* The chest is not a destination any more — it is the page's ground.
          A fixed, faint layer the content scrolls OVER, so it is felt as
          design rather than presented as a moment ("I don't want to see the
          chest itself... just want it to be there as a design"). Fixed as an
          element, not background-attachment (which iOS never honoured);
          z-index 0 keeps it under the hero's opaque black and under every
          section's translucent ground. */}
      {showSkull && HERO_FRAMES.chest && (
        <img
          className="home-chest-bg"
          src={frameUrl(HERO_FRAMES.chest)}
          alt=""
          aria-hidden="true"
          decoding="async"
          loading="lazy"
        />
      )}

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

      {/* The topics, each carrying its own share of the same two numbers. */}
      <section className="worklist" id="modules">
        <header className="worklist-head">
          <p className="eyebrow">By topic</p>
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
                to={`/section/${meta.id}`}
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
