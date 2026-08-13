import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { SectionId } from '../types';
import { getSectionMeta, getSectionQuestions } from '../data/sections';
import { ATLAS_CHAPTERS } from '../data/atlas/chapters';
import { isAdmin } from '../lib/admin';
import { computeSectionStats, favouritedQuestions, flaggedQuestions, incorrectQuestions, partiallyCorrectQuestions } from '../lib/stats';
import { getLastQuestion, loadProgress, resetSectionProgress } from '../lib/progress';
import './SectionHub.css';

export default function SectionHub() {
  const { sectionId } = useParams<{ sectionId: SectionId }>();
  const navigate = useNavigate();
  const [browseMode, setBrowseMode] = useState<'modality' | 'organ'>('modality');
  const [confirmReset, setConfirmReset] = useState(false);

  const section = sectionId as SectionId;
  const meta = getSectionMeta(section);
  const questions = getSectionQuestions(section);
  const stats = computeSectionStats(section);
  const progress = loadProgress();

  const modalities = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of questions) map.set(q.modalitySection, (map.get(q.modalitySection) ?? 0) + 1);
    return Array.from(map.entries());
  }, [questions]);

  const regions = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of questions) for (const t of q.regionTags) map.set(t, (map.get(t) ?? 0) + 1);
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [questions]);

  const lastId = getLastQuestion(section);
  const incorrect = incorrectQuestions(section);
  const partial = partiallyCorrectQuestions(section);
  const flagged = flaggedQuestions(section);
  const favourites = favouritedQuestions(section);

  const firstUnanswered = questions.find((q) => progress.questions[q.id]?.status !== 'submitted');

  function goToQuestion(id: string) {
    navigate(`/anatomy/section/${section}/q/${id}`);
  }

  function startRandom() {
    if (questions.length === 0) return;
    const q = questions[Math.floor(Math.random() * questions.length)];
    goToQuestion(q.id);
  }

  function doReset() {
    resetSectionProgress(questions.map((q) => q.id));
    setConfirmReset(false);
    window.location.reload();
  }

  /* A mistyped or stale URL is a normal thing to arrive with; it should read
     as a wrong turn, not a white screen. */
  if (!meta) {
    return (
      <div className="empty-state">
        <h1>Section not found</h1>
        <p>That address does not match any of the six anatomy modules.</p>
        <Link className="btn btn-primary" to="/anatomy">Back to the modules</Link>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="hub">
        <Link to="/anatomy" className="back-link">← Back to sections</Link>
        <div className="empty-state card">
          <h2>{meta.title}</h2>
          <p>This section is still being extracted from the source PDFs and will appear here once processing completes. No placeholder questions are shown.</p>
          {isAdmin() && (<Link to={`/anatomy/section/${section}/custom`} className="btn btn-primary">+ Add your own case</Link>)}
        </div>
      </div>
    );
  }

  return (
    <div className={meta.heroImage ? 'hub hub-has-hero' : 'hub'}>
      {meta.heroImage && (
        <div
          className="hub-hero"
          aria-hidden="true"
          style={{ backgroundImage: `url(${meta.heroImage})` }}
        />
      )}
      <Link to="/anatomy" className="back-link">← Back to sections</Link>
      <div className="hub-head">
        <div>
          <h1>{meta.title}</h1>
          <p className="hub-sub">{meta.description}</p>
        </div>
        <div className="hub-actions">
          {lastId && (
            <button className="btn btn-primary" onClick={() => goToQuestion(lastId)}>Continue last question</button>
          )}
          {firstUnanswered && (
            <button className="btn" onClick={() => goToQuestion(firstUnanswered.id)}>Start / resume section</button>
          )}
          <button className="btn" onClick={startRandom}>Random examination mode</button>
          {/* The same films, indexed by structure rather than by question.
              Abdomen and pelvis are one module but two Atlas chapters, so
              that one goes to the Atlas front page to choose. */}
          <Link to={atlasChapterLink(section)} className="btn">Structure Atlas</Link>
          <Link to={`/anatomy/section/${section}/custom`} className="btn">+ Add your own case</Link>
        </div>
      </div>

      <div className="hub-stats card">
        <Stat label="Total" value={stats.total} />
        <Stat label="Attempted" value={stats.attempted} />
        <Stat label="Fully correct" value={stats.fullyCorrect} tone="green" />
        <Stat label="Partial" value={stats.partiallyCorrect} tone="amber" />
        <Stat label="Incorrect" value={stats.incorrect} tone="red" />
        <Stat label="Score" value={`${stats.rawScore}/${stats.maxScore}`} />
        <Stat label="Percent" value={`${stats.percentScore}%`} />
        <Stat label="Flagged" value={stats.flagged} tone="purple" />
      </div>

      <div className="review-row">
        <ReviewChip label={`Review incorrect (${incorrect.length})`} onClick={() => incorrect[0] && goToQuestion(incorrect[0].id)} disabled={incorrect.length === 0} />
        <ReviewChip label={`Review partial / laterality (${partial.length})`} onClick={() => partial[0] && goToQuestion(partial[0].id)} disabled={partial.length === 0} />
        <ReviewChip label={`Flagged for review (${flagged.length})`} onClick={() => flagged[0] && goToQuestion(flagged[0].id)} disabled={flagged.length === 0} />
        <ReviewChip label={`Favourites (${favourites.length})`} onClick={() => favourites[0] && goToQuestion(favourites[0].id)} disabled={favourites.length === 0} />
        <Link to="/anatomy/disputes" className="review-chip">Disputed answers</Link>
        <button className="review-chip danger" onClick={() => setConfirmReset(true)}>Reset this section</button>
      </div>

      {confirmReset && (
        <div className="confirm-bar card">
          <span>Reset all progress for {meta.title}? This cannot be undone.</span>
          <div className="confirm-actions">
            <button className="btn" onClick={() => setConfirmReset(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={doReset}>Confirm reset</button>
          </div>
        </div>
      )}

      <div className="browse-toggle">
        <button className={browseMode === 'modality' ? 'toggle-btn active' : 'toggle-btn'} onClick={() => setBrowseMode('modality')}>By modality</button>
        <button className={browseMode === 'organ' ? 'toggle-btn active' : 'toggle-btn'} onClick={() => setBrowseMode('organ')}>By organ / region</button>
      </div>

      {browseMode === 'modality' ? (
        <div className="browse-grid">
          {modalities.map(([mod, count]) => (
            <div className="browse-card card" key={mod}>
              <h3>{mod}</h3>
              <p className="browse-count">{count} questions</p>
              <button className="btn" onClick={() => {
                const q = questions.find((qq) => qq.modalitySection === mod);
                if (q) goToQuestion(q.id);
              }}>Browse</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="browse-grid">
          {regions.map(([region, count]) => (
            <div className="browse-card card" key={region}>
              <h3>{region}</h3>
              <p className="browse-count">{count} questions</p>
              <button className="btn" onClick={() => {
                const q = questions.find((qq) => qq.regionTags.includes(region));
                if (q) goToQuestion(q.id);
              }}>Browse</button>
            </div>
          ))}
        </div>
      )}

      <div className="question-index">
        <h3>All questions ({questions.length})</h3>
        <div className="index-grid">
          {questions.map((q, i) => {
            const p = progress.questions[q.id];
            let cls = 'idx-cell grey';
            if (p?.flaggedForReview) cls = 'idx-cell purple';
            else if (p?.status === 'submitted' && p.graded) {
              if (p.graded.overallResult === 'correct') cls = 'idx-cell green';
              else if (p.graded.overallResult === 'partial') cls = 'idx-cell amber';
              else if (p.graded.overallResult === 'incorrect') cls = 'idx-cell red';
            } else if (p?.status === 'answered') cls = 'idx-cell blue';
            return (
              <button key={q.id} className={cls} title={`Question ${i + 1}`} onClick={() => goToQuestion(q.id)}>
                {i + 1}
                {p?.favourited && <span className="idx-fav">♥</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* A module maps to one Atlas chapter, except abdo-pelvis, which is split
   into two and therefore has no single destination. */
function atlasChapterLink(section: SectionId): string {
  const chapters = ATLAS_CHAPTERS.filter((c) => c.homeSection === section);
  return chapters.length === 1 ? `/anatomy/atlas/${chapters[0].id}` : '/anatomy/atlas';
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="stat">
      <span className={`stat-value ${tone ? `tone-${tone}` : ''}`}>{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function ReviewChip({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="review-chip" onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}
