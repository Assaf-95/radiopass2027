/* The films of one section, on one page, so they can be managed as a set.
 *
 * THE JOB, in the owner's words: "I want to delete an image, add... rename...
 * an image". All three were already possible one question at a time, buried
 * inside the image editor — which means finding the bad film first, and he is
 * usually looking at a section knowing that SOME film in it is wrong. So this
 * is the contact sheet: every film in the section at a glance, with the two
 * operations that were never exposed anywhere.
 *
 * DELETION IS SOFT AND STAYS SOFT. `removedAt` hides a film from the question
 * bank and drops it from the Atlas; the question, its answers, its accepted
 * variants and its marker geometry are all untouched, and clearing the flag
 * brings the film straight back. Nothing on this page destroys anything, which
 * is what makes it safe to use quickly — and the copy says so, because a
 * button that reads "Delete" against a bank of scanned films the owner cannot
 * re-scan would rightly make him hesitate.
 *
 * RENAMING IS THE FILENAME, NOT THE STRUCTURE. This renames the stored asset
 * so the author can tell two films apart in the audit log and in a folder of
 * uploads. What a structure is CALLED is a marking question, not a filing one,
 * and belongs to the wording editor and to structure folders — where renaming
 * keeps the old name a correct answer. Conflating the two would let a tidy-up
 * of filenames silently start marking candidates wrong.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getSectionQuestions, getSectionMeta } from '../data/sections';
import { assetUrl } from '../lib/assetUrl';
import { hasServerSession } from '../lib/admin';
import { patchQuestion } from '../lib/content/api';
import { contentState, loadContent, overlayFor, setOverlay } from '../lib/content/store';
import type { SectionId } from '../types';
import './ImageManager.css';

type Pending = { id: string; what: 'remove' | 'restore' | 'rename' } | null;

export default function ImageManager() {
  const { sectionId } = useParams<{ sectionId: SectionId }>();
  const section = (sectionId ?? 'upper-limb') as SectionId;
  const meta = getSectionMeta(section);

  const [rev, setRev] = useState(0);
  const [busy, setBusy] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'removed' | 'replaced'>('all');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    loadContent();
  }, []);

  /* `rev` is bumped after every write so the resolved list is rebuilt — the
     questions come from a module-level bank and would otherwise show the
     pre-edit state until a navigation. */
  const questions = useMemo(
    () => getSectionQuestions(section),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [section, rev],
  );

  const shown = useMemo(() => {
    if (filter === 'all') return questions;
    return questions.filter((q) => {
      const image = overlayFor(q.id)?.image;
      return filter === 'removed' ? !!image?.removedAt : !!image?.assetId && !image.removedAt;
    });
  }, [questions, filter, rev]);

  const removedCount = questions.filter((q) => overlayFor(q.id)?.image?.removedAt).length;

  const offline = !hasServerSession() || !contentState().online;

  async function write(id: string, what: NonNullable<Pending>['what'], image: Record<string, unknown>) {
    setBusy({ id, what });
    setError(null);
    try {
      setOverlay(
        await patchQuestion(id, {
          ifRev: contentState().overlay.rev,
          action: what === 'rename' ? 'image renamed' : `image ${what}d`,
          /* Merged onto whatever the overlay already holds for this film, so
             renaming cannot drop the assetId and restoring cannot drop the
             filename. */
          image: { ...overlayFor(id)?.image, ...image },
        }),
      );
      setRev((n) => n + 1);
      setRenaming(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} Nothing has been changed.`
          : 'The content service refused the change. Nothing has been changed.',
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="im">
      <header className="im-head">
        <p className="im-eyebrow">{meta?.title ?? section} · authoring</p>
        <h1>Films</h1>
        <p className="im-lede">
          Every film in this section. Removing one hides it from the question bank and the
          atlas — <strong>the question, its answers and its labels all stay</strong>, and it can
          be brought back at any time. Nothing here deletes anything permanently.
        </p>
        <nav className="im-nav">
          <Link to={`/anatomy/section/${section}`}>&larr; Back to the section</Link>
          <Link to="/anatomy/admin">Author page</Link>
        </nav>
      </header>

      {offline && (
        <p className="im-note" role="status">
          You are not signed in to the content service, so films cannot be changed from here.{' '}
          <Link to="/anatomy/admin">Sign in</Link> to manage them.
        </p>
      )}

      {error && (
        <p className="im-error" role="alert">
          {error}
        </p>
      )}

      <div className="im-filters" role="group" aria-label="Filter films">
        {(['all', 'replaced', 'removed'] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`im-chip${filter === f ? ' is-on' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? `All ${questions.length}` : f === 'removed' ? `Removed ${removedCount}` : 'Replaced'}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="im-empty">Nothing in this section matches that filter.</p>
      ) : (
        <ul className="im-grid">
          {shown.map((q) => {
            const image = overlayFor(q.id)?.image;
            const removed = !!image?.removedAt;
            const working = busy?.id === q.id;
            return (
              <li key={q.id} className={`im-card${removed ? ' is-removed' : ''}`}>
                <div className="im-thumb">
                  {q.imagePath ? (
                    <img src={assetUrl(q.imagePath)} alt="" loading="lazy" />
                  ) : (
                    <span className="im-none">No film</span>
                  )}
                  {removed && <span className="im-flag">Removed</span>}
                </div>

                <div className="im-body">
                  <p className="im-id">{q.id}</p>
                  <p className="im-stem">{q.questionText || <em>No question text</em>}</p>
                  {image?.filename && <p className="im-file">{image.filename}</p>}

                  {renaming === q.id ? (
                    <div className="im-rename">
                      <input
                        value={name}
                        autoFocus
                        placeholder="scaphoid-pa.png"
                        onChange={(e) => setName(e.target.value)}
                      />
                      <button
                        type="button"
                        className="im-btn"
                        disabled={working || !name.trim()}
                        onClick={() => void write(q.id, 'rename', { filename: name.trim() })}
                      >
                        Save name
                      </button>
                      <button type="button" className="im-btn is-quiet" onClick={() => setRenaming(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="im-actions">
                      <Link className="im-btn" to={`/anatomy/section/${section}/q/${q.id}/replace-image`}>
                        Replace
                      </Link>
                      <Link className="im-btn" to={`/anatomy/section/${section}/q/${q.id}/wording`}>
                        Wording
                      </Link>
                      <button
                        type="button"
                        className="im-btn"
                        disabled={offline || working}
                        onClick={() => {
                          setName(image?.filename ?? `${q.id}.png`);
                          setRenaming(q.id);
                        }}
                      >
                        Rename
                      </button>
                      {removed ? (
                        <button
                          type="button"
                          className="im-btn is-restore"
                          disabled={offline || working}
                          onClick={() => void write(q.id, 'restore', { removedAt: null })}
                        >
                          {working ? '…' : 'Bring back'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="im-btn is-quiet"
                          disabled={offline || working || !q.imagePath}
                          onClick={() => void write(q.id, 'remove', { removedAt: new Date().toISOString() })}
                        >
                          {working ? '…' : 'Remove'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
