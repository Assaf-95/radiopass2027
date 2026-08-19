/* Rewording a question and its answers, without touching anything else.
 *
 * THE JOB, in the owner's words: "maybe change wording of the question, change
 * a wording of an answer". He has sat this exam, he is reading his own bank,
 * and he keeps finding answers that are right but written in a way the marking
 * would punish. Describing each one to somebody else is slower than fixing it,
 * so this is the page that lets him fix it himself.
 *
 * WHY IT IS A SEPARATE PAGE FROM ReplaceImageEditor. That editor exists to
 * swap a film while the teaching survives untouched, and it deliberately
 * renders answer text READ-ONLY — "nothing here rewrites wording". That is a
 * good rule and this page does not weaken it. Geometry is edited there; words
 * are edited here. Neither page can quietly undo the other's work, because
 * both write through the same merged document (see `mergedEdit` below).
 *
 * ACCEPTED VARIANTS ARE THE POINT OF THIS PAGE, not a side feature. The
 * marking rule the owner has corrected more often than any other is that
 * synonyms score full marks: C1 is the atlas, the aqueduct of Sylvius is the
 * cerebral aqueduct, a fifth metatarsal is a fifth metatarsal however it is
 * written. Every one of those is a variant somebody has to type in once. So
 * variants get the same visual weight as the official answer, and the page
 * says what they do in the language of marks rather than of data entry.
 *
 * NOTHING IS MUTATED. The 501 questions ship as bundled JSON. An edit is an
 * override layered at read time, so every change here is revertible and a
 * mistake cannot damage the source bank.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { getSectionQuestions, getSectionMeta, getStaticSectionQuestions } from '../data/sections';
import {
  contentBackend,
  contentState,
  loadContent,
  overlayFor,
  saveQuestionPatch,
  subscribeContent,
} from '../lib/content/store';
import {
  getEdit,
  saveEdit,
  toEditableAnswers,
  type EditableAnswer,
  type QuestionEdit,
} from '../lib/questionEdits';
import type { SectionId } from '../types';
import './QuestionWording.css';

/** Variants are one per line in the box, and a trimmed list in the document. */
function linesToVariants(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function QuestionWording() {
  const navigate = useNavigate();
  const { sectionId, questionId } = useParams<{ sectionId: SectionId; questionId: string }>();
  const section = (sectionId ?? 'upper-limb') as SectionId;
  const meta = getSectionMeta(section);

  /* The RESOLVED question — bundled record with every saved override already
     on it — so the boxes open showing what a candidate currently sees rather
     than what shipped a year ago. */
  const resolved = useMemo(
    () => getSectionQuestions(section).find((q) => q.id === questionId) ?? null,
    [section, questionId],
  );
  /* The shipped original, kept only so "Revert" has something to compare
     against and so the page can show what a field used to say. */
  const shipped = useMemo(
    () => getStaticSectionQuestions(section).find((q) => q.id === questionId) ?? null,
    [section, questionId],
  );

  const [stem, setStem] = useState('');
  const [answers, setAnswers] = useState<EditableAnswer[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [, setContentRev] = useState(0);
  /* See ImageManager: contentBackend() is synchronous, so without a
     subscription this page would keep showing its first, uninformed answer
     about whether a save will land centrally. */
  useEffect(() => subscribeContent(() => setContentRev((n) => n + 1)), []);
  useEffect(() => {
    void loadContent();
  }, []);

  useEffect(() => {
    if (!resolved) return;
    setStem(resolved.questionText ?? '');
    /* Seed from whatever document already exists so the letters, marker
       geometry and any earlier wording survive being opened here. Only when
       there is no document at all do we derive records from the question. */
    const existing = overlayFor(resolved.id)?.edit ?? getEdit(resolved.id);
    setAnswers(existing?.answers?.length ? existing.answers : toEditableAnswers(resolved));
    setSaved(false);
    setError(null);
  }, [resolved]);

  if (!resolved) {
    return (
      <div className="empty-state">
        <h1>No such question</h1>
        <p>Nothing in this section has that id.</p>
        <Link className="btn btn-primary" to={`/anatomy/section/${section}`}>
          Back to the section
        </Link>
      </div>
    );
  }

  const update = (id: string, patch: Partial<EditableAnswer>) => {
    setAnswers((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    setSaved(false);
  };

  /**
   * The document to save: whatever was already stored, with ONLY the words
   * replaced.
   *
   * This spread is the load-bearing line on the page. A question that has been
   * through the annotation editor carries marker positions, arrow angles,
   * thicknesses, colours, a crop and an orientation — millimetre-accurate work
   * the owner did by hand. Writing a fresh document here would erase all of it
   * and the loss would only surface later, on a question nobody was looking at.
   */
  const mergedEdit = (): QuestionEdit => {
    const base = overlayFor(resolved.id)?.edit ?? getEdit(resolved.id);
    return {
      ...base,
      questionId: resolved.id,
      questionText: stem,
      answers,
      updatedAt: new Date().toISOString(),
      dirty: {
        image: base?.dirty?.image ?? false,
        annotations: base?.dirty?.annotations ?? false,
        questionText: true,
        answers: true,
      },
    };
  };

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const edit = mergedEdit();
      /* ONE condition decides the branch AND the notice above. They were
         written separately before, and the notice tested LESS than the save
         did — so a stale token against an unreachable API wrote to this
         browser only and still reported a plain "Saved." */
      if (target.writable) {
        /* Sent as the whole document, which is what the API expects and what
           keeps a partial merge from resurrecting a label deleted elsewhere. */
        const { imageDataUrl, ...withoutImage } = edit;
        void imageDataUrl;
        await saveQuestionPatch(resolved!.id, {
          ifRev: contentState().overlay.rev,
          action: 'wording edited',
          edit: withoutImage,
        });
      } else {
        /* Nowhere central to save: fall back to the browser-only override, as
           the other authoring pages do, so a static host still has working
           tools. The notice above has already said this would happen. */
        const result = saveEdit(edit);
        if (!result.ok) throw new Error(result.reason);
      }
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} Nothing has been changed.`
          : 'The change was refused. Nothing has been changed.',
      );
    } finally {
      setBusy(false);
    }
  }

  const stemChanged = stem !== (shipped?.questionText ?? '');
  const target = contentBackend();

  return (
    <main className="qw">
      <header className="qw-head">
        <p className="qw-eyebrow">
          {meta?.title ?? section} · authoring
        </p>
        <h1>Wording</h1>
        <p className="qw-lede">
          The words only. Marker positions, arrows and the film itself are edited on the
          image page and are not touched by anything here.
        </p>
        <nav className="qw-nav">
          <Link to={`/anatomy/section/${section}/q/${resolved.id}`}>&larr; Back to the question</Link>
          <Link to={`/anatomy/section/${section}/q/${resolved.id}/replace-image`}>
            Image &amp; labels &rarr;
          </Link>
        </nav>
      </header>

      {!target.writable && (
        <p className="qw-note" role="status">
          {target.why || 'There is nowhere central to save this.'} Until then this saves to{' '}
          <strong>this browser only</strong> — sign in on the{' '}
          <Link to="/anatomy/admin">author page</Link> to save it for every device.
        </p>
      )}

      {error && (
        <p className="qw-error" role="alert">
          {error}
        </p>
      )}

      <section className="qw-block">
        <label className="qw-field">
          <span className="qw-label">What the candidate is asked</span>
          <textarea
            value={stem}
            rows={3}
            onChange={(e) => {
              setStem(e.target.value);
              setSaved(false);
            }}
          />
        </label>
        {stemChanged && shipped?.questionText && (
          <p className="qw-was">
            Originally: <em>{shipped.questionText}</em>
          </p>
        )}
      </section>

      <section className="qw-block">
        <h2>Answers</h2>
        <p className="qw-hint">
          The official answer is what the atlas displays and what marking treats as the model
          answer. <strong>Accepted variants score full marks too</strong> — this is where
          &ldquo;atlas&rdquo; is taught to count for C1, and where a structure written a second
          way stops being marked wrong. One per line.
        </p>

        <ul className="qw-answers">
          {answers.map((a) => {
            const original = shipped?.answers?.[a.sourceLetter ?? a.letter]?.officialAnswer;
            const changed = original !== undefined && original !== a.officialAnswer;
            return (
              <li key={a.id} className="qw-answer">
                <span className="qw-letter" aria-hidden="true">
                  {a.letter}
                </span>
                <div className="qw-answer-body">
                  <label className="qw-field">
                    <span className="qw-label">Official answer</span>
                    <input
                      value={a.officialAnswer}
                      onChange={(e) => update(a.id, { officialAnswer: e.target.value })}
                    />
                  </label>
                  {changed && (
                    <p className="qw-was">
                      Originally: <em>{original}</em>
                    </p>
                  )}

                  <label className="qw-field">
                    <span className="qw-label">
                      Also accepted — {a.acceptedVariants.length}
                    </span>
                    <textarea
                      rows={Math.min(6, Math.max(2, a.acceptedVariants.length + 1))}
                      value={a.acceptedVariants.join('\n')}
                      placeholder={'Atlas\nFirst cervical vertebra'}
                      onChange={(e) =>
                        update(a.id, { acceptedVariants: linesToVariants(e.target.value) })
                      }
                    />
                  </label>

                  <label className="qw-check">
                    <input
                      type="checkbox"
                      checked={a.lateralityRequired}
                      onChange={(e) => update(a.id, { lateralityRequired: e.target.checked })}
                    />
                    <span>
                      Side must be named
                      <small>
                        Leaving the side out costs one mark of the two — never both, and never the
                        answer.
                      </small>
                    </span>
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="qw-actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save wording'}
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => navigate(`/anatomy/section/${section}/q/${resolved.id}`)}
        >
          Done
        </button>
        {saved && (
          <span className="qw-saved" role="status">
            Saved.
          </span>
        )}
      </div>
    </main>
  );
}
