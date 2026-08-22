import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { SectionId, GradedQuestion, QuestionProgress } from '../types';
import { getSectionMeta, getSectionQuestions } from '../data/sections';
import { usePremiumOne } from '../../lib/usePremium';
import { PremiumNotice } from '../../portal/Gate';
import { isAdmin } from '../lib/admin';
import { assetUrl } from '../lib/assetUrl';
import { gradeAnswer, overallResult } from '../lib/grading';
import { getQuestionProgress, saveQuestionProgress, setLastQuestion, saveDispute, flushProgress } from '../lib/progress';
import { recordSubmission, recordStudySeconds } from '../lib/account';
import { record as recordEvent } from '../../lib/learner';
import { isCustomImageRef, resolveCustomImageSrc } from '../lib/customStore';
import ImageViewer from '../components/ImageViewer';
import DisputeModal from '../components/DisputeModal';
import './QuestionPlayer.css';

export default function QuestionPlayer() {
  const { sectionId, questionId } = useParams<{ sectionId: SectionId; questionId: string }>();
  const navigate = useNavigate();
  const section = sectionId as SectionId;
  const questions = useMemo(() => getSectionQuestions(section), [section]);
  const meta = getSectionMeta(section);
  const index = questions.findIndex((q) => q.id === questionId);
  /* The bundle carries this question's stem and film but, if it is paid, none
     of its answers — that is what keeps the bank off a CDN. For a learner who
     is entitled, the answers come back from the server here and the rest of
     this component never knows the difference. For one who is not, they simply
     do not arrive, and the marking below has nothing to mark against, which is
     the correct outcome rather than a lenient one. */
  const bundledQuestion = questions[index];
  const { item: question, loading: premiumLoading, refused } = usePremiumOne('case', bundledQuestion);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<GradedQuestion | null>(null);
  const [flagged, setFlagged] = useState(false);
  const [favourited, setFavourited] = useState(false);
  const [disputeLabel, setDisputeLabel] = useState<string | null>(null);
  const [showIndex, setShowIndex] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [resolvedImageSrc, setResolvedImageSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!question) return;
    if (!isCustomImageRef(question.imagePath)) {
      setResolvedImageSrc(assetUrl(question.imagePath));
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    resolveCustomImageSrc(question.imagePath).then((src) => {
      if (cancelled) return;
      objectUrl = src;
      setResolvedImageSrc(src);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [question]);

  /* Built once per question, not once per keystroke. Rebuilt inline it was a
     brand-new array on every render, so typing an answer re-rendered the whole
     image viewer — marker layer, arrowhead defs and all — for a change that
     never touches the film. */
  /* Letters an editor has turned off. They keep their letter and their
     answer — answers are stored against the letter, so nothing renumbers —
     they are simply not asked. */
  const hidden = useMemo(() => new Set(question?.hiddenLabels ?? []), [question]);
  const askedLabels = useMemo(
    () => (question?.labels ?? []).filter((l) => !hidden.has(l)),
    [question, hidden]
  );

  const markers = useMemo(() => {
    if (!question) return undefined;
    // Extracted atlas pages carry labelGlyphs: the spot where the source
    // printed each of its own letters. We cover every one with our badge in
    // place, leaving the source's arrows alone. Custom and edited questions
    // instead carry markerPositions (+ optional badge offsets), where we draw
    // the leader line ourselves.
    if (question.labelGlyphs?.length) {
      /* A hidden label's badge is still drawn — it is what covers the source
         atlas's own printed letter — but it is drawn blank. Leaving the
         letter on would put a "B" on the film with no box to answer it in. */
      return question.labelGlyphs.map((g, i) => ({
        id: `${g.letter}-${i}`,
        label: hidden.has(g.letter) ? '' : g.letter,
        x: g.x,
        y: g.y,
        // Just wider than the glyph's diagonal so the badge hides it without
        // spilling over the anatomy around it.
        sizePct: (g.sizePct ?? 3) * 1.5,
      }));
    }
    if (!question.markerPositions) return undefined;
    return question.labels
      .filter((l) => question.markerPositions![l] && !hidden.has(l))
      .map((l) => ({
        id: l,
        label: l,
        ...question.markerPositions![l],
        labelX: question.markerLabelPositions?.[l]?.x,
        labelY: question.markerLabelPositions?.[l]?.y,
        thickness: question.markerArrows?.[l]?.thickness,
        headSize: question.markerArrows?.[l]?.headSize,
        shape: question.markerShapes?.[l] ?? 'arrow',
        circlePct: question.markerCirclePct?.[l],
        // Authored by the Replace-image editor's per-label dials.
        angle: question.markerAngles?.[l],
        lengthPct: question.markerLengthPct?.[l],
        colour: question.markerColours?.[l],
      }));
  }, [question, hidden]);

  useEffect(() => {
    if (!question) return;
    setLastQuestion(section, question.id);
    const existing = getQuestionProgress(question.id);
    if (existing) {
      setAnswers(existing.userAnswers ?? {});
      setSubmitted(existing.graded ?? null);
      setFlagged(existing.flaggedForReview ?? false);
      setFavourited(existing.favourited ?? false);
    } else {
      setAnswers({});
      setSubmitted(null);
      setFlagged(false);
      setFavourited(false);
    }
  }, [question, section]);

  /* Time on a question counts toward study time. It banks on the way out and
     on tab-hide, so closing the laptop lid does not lose the sitting — and a
     tab left open overnight is discarded rather than counted. */
  useEffect(() => {
    let start = Date.now();
    const bank = () => {
      const secs = (Date.now() - start) / 1000;
      start = Date.now();
      recordStudySeconds(secs);
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') bank();
      else start = Date.now();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', bank);
    return () => {
      bank();
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', bank);
    };
  }, [questionId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, question]);

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

  if (!question) {
    return (
      <div className="qp-missing">
        <p>Question not found.</p>
        <Link to={`/anatomy/section/${section}`}>Back to section</Link>
      </div>
    );
  }

  function flashSaved() {
    setSavedPulse(true);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setSavedPulse(false), 1200);
  }

  function persist(
    status: QuestionProgress['status'],
    graded?: GradedQuestion,
    flag?: boolean,
    fav?: boolean,
    ans?: Record<string, string>
  ) {
    saveQuestionProgress({
      questionId: question.id,
      status,
      userAnswers: ans ?? answers,
      graded,
      flaggedForReview: flag ?? flagged,
      favourited: fav ?? favourited,
      attempts: (getQuestionProgress(question.id)?.attempts ?? 0) + (status === 'submitted' ? 1 : 0),
      lastAttemptAt: new Date().toISOString(),
    });
    // A submission is what marks the day studied and feeds the streak.
    if (status === 'submitted') recordSubmission();
    flashSaved();
  }

  /* Enter moves to the next box rather than doing nothing, so a five-part
     question is filled without reaching for the mouse. On the last box there
     is nowhere to go, so it submits — the same thing Cmd/Ctrl+Enter does from
     anywhere in the question. */
  function focusNextAnswer(current: string) {
    const labels = askedLabels;
    const next = labels[labels.indexOf(current) + 1];
    if (!next) {
      handleSubmit();
      return;
    }
    const el = document.querySelector<HTMLInputElement>(`input[data-answer-label="${next}"]`);
    if (el) {
      el.focus();
      el.select();
    }
  }

  function handleChange(label: string, value: string) {
    const next = { ...answers, [label]: value };
    setAnswers(next);
    persist('answered', submitted ?? undefined, flagged, favourited, next);
  }

  function handleSubmit() {
    /* The keyboard shortcut reaches this directly, so the check lives here
       rather than only on the button. Marking with no answer key would score
       every response zero and record that as the candidate's attempt —
       destroying a real result because the content had not arrived. */
    if (refused || premiumLoading) return;
    const graded: Record<string, ReturnType<typeof gradeAnswer>> = {};
    let totalScore = 0;
    let maxScore = 0;
    /* Only what was actually asked is marked. A hidden label keeps its answer
       in the data — it is simply not part of this question's score, so a
       candidate is never marked down for a box they were never shown. */
    for (const label of askedLabels) {
      const spec = question.answers[label];
      if (!spec) continue;
      const g = gradeAnswer(label, answers[label] ?? '', spec);
      graded[label] = g;
      totalScore += g.score;
      maxScore += g.maxScore;
    }
    const result: GradedQuestion = {
      questionId: question.id,
      graded,
      totalScore,
      maxScore,
      overallResult: overallResult(Object.values(graded).map((g) => g.result)),
      submittedAt: new Date().toISOString(),
    };
    setSubmitted(result);
    persist('submitted', result);
    /* Writes are coalesced while typing, but a submission is the moment the
       candidate would be most upset to lose. Committed straight away. */
    flushProgress();

    /* The shared timeline. The progress store already knows this question was
       answered and what it scored; what it cannot say is WHEN, or in which
       branch, which is what "continue where you left off" and any future
       activity view need. Written alongside, never instead. */
    recordEvent({
      type: 'question.answered',
      subject: 'anatomy',
      contentId: question.id,
      topic: section,
      correct: totalScore,
      outOf: maxScore,
    });
  }

  function goTo(offset: number) {
    const next = questions[index + offset];
    if (next) navigate(`/anatomy/section/${section}/q/${next.id}`);
  }

  function toggleFlag() {
    const next = !flagged;
    setFlagged(next);
    persist(submitted ? 'submitted' : (Object.values(answers).some(Boolean) ? 'answered' : 'unanswered'), submitted ?? undefined, next, favourited);
  }

  function toggleFavourite() {
    const next = !favourited;
    setFavourited(next);
    persist(submitted ? 'submitted' : (Object.values(answers).some(Boolean) ? 'answered' : 'unanswered'), submitted ?? undefined, flagged, next);
  }

  function submitDispute(note: string) {
    if (!disputeLabel || !submitted) return;
    const g = submitted.graded[disputeLabel];
    saveDispute({
      id: `${question.id}-${disputeLabel}-${Date.now()}`,
      questionId: question.id,
      section,
      modality: question.modalitySection,
      organ: question.regionTags,
      questionNumber: index + 1,
      sourceFile: question.sourceFile,
      sourcePage: question.sourcePageQuestion,
      label: disputeLabel,
      userAnswer: g.userAnswer,
      officialAnswer: g.officialAnswer,
      automaticResult: g.result,
      automaticScore: g.score,
      reason: g.reason,
      disputeNote: note,
      createdAt: new Date().toISOString(),
    });
    setDisputeLabel(null);
  }

  const resultTone = (r?: string) =>
    r === 'correct' ? 'green' : r === 'partial' ? 'amber' : r === 'incorrect' ? 'red' : 'grey';

  return (
    <div className="qp-root">
      <div className="qp-topbar">
        <Link to={`/anatomy/section/${section}`} className="qp-back">← {meta.title}</Link>
        <div className="qp-progress-text">Question {index + 1} of {questions.length}</div>
        <span className={savedPulse ? 'qp-saved show' : 'qp-saved'}>Saved</span>
        <div className="qp-topbar-actions">
          <button className={favourited ? 'qp-flag active-fav' : 'qp-flag'} onClick={toggleFavourite} title="Favourite this question">{favourited ? '♥ Favourited' : '♡ Favourite'}</button>
          <button className={flagged ? 'qp-flag active' : 'qp-flag'} onClick={toggleFlag}>{flagged ? '★ Flagged' : '☆ Flag'}</button>
          {isAdmin() && (
          <Link
            className="qp-nav-toggle"
            to={`/anatomy/section/${section}/q/${question.id}/replace-image`}
            title="Replace the image, place arrows and labels, show or hide options, edit Atlas metadata"
          >
            Edit image &amp; labels
          </Link>
          )}
          {isAdmin() && (
          <Link
            className="qp-nav-toggle"
            to={`/anatomy/section/${section}/q/${question.id}/wording`}
            title="Reword the question, the official answers and the variants that also score full marks"
          >
            Edit wording
          </Link>
          )}
          <button className="qp-nav-toggle" onClick={() => setShowIndex((s) => !s)}>Navigator</button>
        </div>
      </div>
      <div className="qp-progressbar"><div style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div>

      {showIndex && (
        <div className="qp-navigator">
          {questions.map((q, i) => (
            <button key={q.id} className={i === index ? 'nav-dot current' : 'nav-dot'} onClick={() => { navigate(`/anatomy/section/${section}/q/${q.id}`); setShowIndex(false); }}>{i + 1}</button>
          ))}
        </div>
      )}

      <div className="qp-question-text">
        <span className="pill">{question.modalitySection}</span>
        <span className="pill">{question.imagingModality}</span>
        <h2>{question.questionText}</h2>
      </div>

      <div className="qp-body">
        <div className="qp-image-pane">
          {resolvedImageSrc ? (
            <ImageViewer
              src={resolvedImageSrc}
              alt={question.questionText}
              crop={question.imageCrop}
              orientation={question.imageOrientation}
              markers={markers}
              markerSizePct={question.markerSizePct}
            />
          ) : question.imageRemoved ? (
            /* An editor took the film down. Said plainly rather than left as
               a permanent "Loading image…", which is what an empty path used
               to look like. The question, its answers and its teaching are
               untouched and the removal is reversible. */
            <div className="qp-image-loading qp-image-gone">
              <p>This question's image has been removed by the editor.</p>
              {isAdmin() && (
                <Link
                  className="btn"
                  to={`/anatomy/section/${section}/q/${question.id}/replace-image`}
                >
                  Upload a replacement
                </Link>
              )}
            </div>
          ) : (
            <div className="qp-image-loading">Loading image…</div>
          )}
        </div>

        <div className="qp-answer-pane">
          <div className="answer-list">
            {askedLabels.map((label) => {
              const spec = question.answers[label];
              const g = submitted?.graded[label];
              return (
                <div key={label} className={`answer-row ${g ? `tone-border-${resultTone(g.result)}` : ''}`}>
                  <div className="answer-row-top">
                    <span className="answer-label">{label === 'Answer' ? 'Answer' : label}</span>
                    {g && <span className={`pill pill-${resultTone(g.result)}`}>{g.result} · {g.score}/{g.maxScore}</span>}
                  </div>
                  {spec.prompt && <p className="answer-row-prompt">{spec.prompt}</p>}
                  <input
                    type="text"
                    data-answer-label={label}
                    value={answers[label] ?? ''}
                    disabled={!!submitted}
                    placeholder={label === 'Answer' ? 'Your answer' : `Structure ${label}`}
                    onChange={(e) => handleChange(label, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' || e.metaKey || e.ctrlKey) return;
                      e.preventDefault();
                      focusNextAnswer(label);
                    }}
                  />
                  {g && (
                    <div className="answer-feedback">
                      <p className="feedback-line"><strong>Answer:</strong> {spec.officialAnswer}</p>
                      <p className="feedback-reason">{g.reason}</p>
                      {/* Shown whatever the mark was. Naming a structure and
                          being able to find it on the film are two different
                          skills, and it is the second one the exam tests. */}
                      {g.teaching && (
                        <p className="feedback-teaching">
                          <span className="feedback-teaching-tag mono">How to spot it</span>
                          {g.teaching}
                        </p>
                      )}
                      <button className="dispute-btn" onClick={() => setDisputeLabel(label)}>Dispute this result</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Refused, still arriving, or ready — in that order, because a
              refusal must never be shown as a working Submit button the
              learner presses and gets nothing from. The film and the labels
              above stay visible either way: that is the part worth seeing
              before you pay for the rest. */}
          {refused ? (
            <PremiumNotice reason={refused} branch="anatomy" />
          ) : premiumLoading ? (
            <button className="btn btn-primary qp-submit" disabled aria-busy="true">
              Loading this case…
            </button>
          ) : !submitted ? (
            <button className="btn btn-primary qp-submit" onClick={handleSubmit}>Submit answers (⌘/Ctrl + Enter)</button>
          ) : (
            <div className="qp-total card">
              <span>Total score</span>
              <strong>{submitted.totalScore} / {submitted.maxScore}</strong>
            </div>
          )}

          {submitted && (question.teachingText || question.references.length > 0) && (
            <div className="teaching-panel card">
              <h3>Important point from the source</h3>
              {question.projection && <p className="teaching-projection">{question.projection}</p>}
              <p className="teaching-text">{question.teachingText}</p>
              {question.references.length > 0 && (
                <details className="source-explanation">
                  <summary>Source explanation & references</summary>
                  <ul>
                    {question.references.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </details>
              )}
              <p className="teaching-source">Source: {question.sourceFile}, page {Array.isArray(question.sourcePageAnswer) ? question.sourcePageAnswer.join('–') : question.sourcePageAnswer}</p>
              {question.flagForReview && <p className="teaching-flag">⚑ Flagged for manual review: {question.flagForReview}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="qp-footer">
        <button className="btn" disabled={index === 0} onClick={() => goTo(-1)}>← Previous</button>
        <button className="btn" disabled={index === questions.length - 1} onClick={() => goTo(1)}>Next →</button>
      </div>

      {disputeLabel && submitted && (
        <DisputeModal
          label={disputeLabel}
          graded={submitted.graded[disputeLabel]}
          onClose={() => setDisputeLabel(null)}
          onSubmit={submitDispute}
        />
      )}
    </div>
  );
}
