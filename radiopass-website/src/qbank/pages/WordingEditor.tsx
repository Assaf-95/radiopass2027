/**
 * Physics question wording — find a question, fix the sentence, save.
 *
 * THE JOB: "For physics, basically, maybe change wording of the question,
 * change a wording of an answer." The bank is recalled exam material, so what
 * turns up is usually a clumsy or ambiguous sentence rather than a wrong fact.
 * Fixing one should take a search box and thirty seconds.
 *
 * WHAT IT WILL NOT DO, and why the page says so out loud: it cannot change
 * whether a statement is true or false. Every attempt a candidate has ever
 * submitted was scored against that value; flipping one would retrospectively
 * re-mark work already graded and there would be no trace of it in their
 * progress. The document has nowhere to put an answer, so this is a property
 * of the data model rather than a rule the interface has to remember. A stem
 * whose ANSWER is wrong needs a data fix, and the page points that out instead
 * of pretending it is an editing job.
 *
 * The search is over id, title and stem text, because the owner will arrive
 * here having just READ the bad sentence — not knowing its id.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { contentStoreStatus, type ContentStoreStatus } from '../../lib/contentStore'
import { QB_QUESTIONS } from '../data'
import {
  clearQbPatch,
  loadQbOverlay,
  patchFor,
  saveQbPatch,
  type QbQuestionPatch,
} from '../overlay'
import type { QbQuestion } from '../types'
import './WordingEditor.css'

/** Why saving is unavailable, in the author's language, with the way out. */
function blocked(status: Exclude<ContentStoreStatus, { ready: true }>) {
  switch (status.reason) {
    case 'no-backend':
      return {
        title: 'No content backend on this build',
        detail:
          'This copy of the site was built without Supabase credentials, so there is nowhere for an edit to be saved.',
      }
    case 'signed-out':
      return {
        title: 'Sign in to edit',
        detail: 'Editing is tied to your account, not to this browser.',
        to: '/login',
      }
    case 'not-admin':
      return {
        title: 'This account cannot edit content',
        detail:
          'Editing needs the admin grant, which is set on the account in the database and cannot be granted from the browser. That is deliberate.',
      }
  }
}

/** A working copy of one question's words. */
type Draft = { title: string; keyPoint: string; stems: Record<string, { text: string; explanation: string }> }

function draftOf(q: QbQuestion, patch: QbQuestionPatch | undefined): Draft {
  return {
    title: patch?.title ?? q.title,
    keyPoint: patch?.keyPoint ?? q.keyPoint,
    stems: Object.fromEntries(
      q.stems.map((s) => [
        s.label,
        {
          text: patch?.stems?.[s.label]?.text ?? s.text,
          explanation: patch?.stems?.[s.label]?.explanation ?? s.explanation,
        },
      ]),
    ),
  }
}

export default function WordingEditor() {
  const [status, setStatus] = useState<ContentStoreStatus | null>(null)
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rev, setRev] = useState(0)

  useEffect(() => {
    void contentStoreStatus().then(setStatus)
    void loadQbOverlay().then(() => setRev((n) => n + 1))
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return QB_QUESTIONS.filter(
      (item) =>
        item.id.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.stems.some((s) => s.text.toLowerCase().includes(q)),
    ).slice(0, 40)
  }, [query])

  const open = openId ? QB_QUESTIONS.find((q) => q.id === openId) ?? null : null
  const readOnly = !status?.ready

  function choose(q: QbQuestion) {
    setOpenId(q.id)
    setDraft(draftOf(q, patchFor(q.id)))
    setSaved(false)
    setError(null)
  }

  async function save() {
    if (!open || !draft) return
    setBusy(true)
    setError(null)
    try {
      /* Only fields that actually differ from the shipped text are stored, so
         the document stays a record of deliberate changes rather than a second
         copy of the bank — and reverting one field is just deleting it. */
      const patch: QbQuestionPatch = {}
      if (draft.title !== open.title) patch.title = draft.title
      if (draft.keyPoint !== open.keyPoint) patch.keyPoint = draft.keyPoint
      const stems: QbQuestionPatch['stems'] = {}
      for (const s of open.stems) {
        const d = draft.stems[s.label]
        if (!d) continue
        const entry: { text?: string; explanation?: string } = {}
        if (d.text !== s.text) entry.text = d.text
        if (d.explanation !== s.explanation) entry.explanation = d.explanation
        if (Object.keys(entry).length) stems[s.label] = entry
      }
      if (Object.keys(stems).length) patch.stems = stems

      if (Object.keys(patch).length === 0) {
        await clearQbPatch(open.id)
      } else {
        await saveQbPatch(open.id, patch)
      }
      setRev((n) => n + 1)
      setSaved(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} Nothing has been changed.`
          : 'The change was refused. Nothing has been changed.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function revert() {
    if (!open) return
    setBusy(true)
    setError(null)
    try {
      await clearQbPatch(open.id)
      setDraft(draftOf(open, undefined))
      setRev((n) => n + 1)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revert.')
    } finally {
      setBusy(false)
    }
  }

  const edited = open ? !!patchFor(open.id) : false
  void rev

  return (
    <main className="qwe">
      <header className="qwe-head">
        <p className="qwe-eyebrow">Physics · authoring</p>
        <h1>Question wording</h1>
        <p className="qwe-lede">
          Search the bank, fix the sentence. Changes are saved as an overlay over the shipped
          questions, so anything here can be put back exactly as it was.
        </p>
        <nav className="qwe-nav">
          <Link to="/admin">&larr; Author console</Link>
          <Link to="/question-bank">The bank as a candidate sees it</Link>
        </nav>
      </header>

      {status && !status.ready && (
        <div className="qwe-blocked" role="status">
          {(() => {
            const m = blocked(status)
            return (
              <>
                <strong>{m.title}</strong>
                <p>{m.detail}</p>
                {'to' in m && m.to && (
                  <Link className="qwe-btn" to={m.to}>
                    Log in
                  </Link>
                )}
                <p className="qwe-blocked-note">
                  You can still search and read below; nothing can be saved.
                </p>
              </>
            )
          })()}
        </div>
      )}

      {error && (
        <p className="qwe-error" role="alert">
          {error}
        </p>
      )}

      <label className="qwe-search">
        <span className="qwe-label">Find a question</span>
        <input
          type="search"
          value={query}
          autoFocus
          placeholder="half-value layer, b417, tube current…"
          onChange={(e) => setQuery(e.target.value)}
        />
        <small>Searches the id, the heading and every statement — {QB_QUESTIONS.length} questions.</small>
      </label>

      {query.trim() && !open && (
        <ul className="qwe-results">
          {results.length === 0 && <li className="qwe-none">Nothing matches that.</li>}
          {results.map((q) => (
            <li key={q.id}>
              <button type="button" onClick={() => choose(q)}>
                <span className="qwe-rid">{q.id}</span>
                <span className="qwe-rtitle">{q.title}</span>
                <span className="qwe-rtopic">{q.topic}</span>
                {patchFor(q.id) && <span className="qwe-badge">edited</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && draft && (
        <section className="qwe-editor">
          <div className="qwe-editor-head">
            <p className="qwe-rid">{open.id} · {open.topic}</p>
            <button type="button" className="qwe-btn is-quiet" onClick={() => { setOpenId(null); setDraft(null) }}>
              Close
            </button>
          </div>

          <label className="qwe-field">
            <span className="qwe-label">Heading</span>
            <textarea
              rows={2}
              value={draft.title}
              onChange={(e) => { setDraft({ ...draft, title: e.target.value }); setSaved(false) }}
            />
          </label>

          <h2>Statements</h2>
          <p className="qwe-hint">
            Wording and explanation only. <strong>Whether a statement is true or false cannot be
            changed here</strong> — every attempt already submitted was marked against it, and
            changing it would silently re-mark work candidates have already done. If a stem's
            answer itself is wrong, that is a data fix rather than an edit.
          </p>

          <ul className="qwe-stems">
            {open.stems.map((s) => {
              const d = draft.stems[s.label]
              if (!d) return null
              return (
                <li key={s.label} className="qwe-stem">
                  <span className={`qwe-truth is-${s.answer === null ? 'unknown' : s.answer ? 'true' : 'false'}`}>
                    {s.label}. {s.answer === null ? 'not given' : s.answer ? 'TRUE' : 'FALSE'}
                  </span>
                  <label className="qwe-field">
                    <span className="qwe-label">Statement</span>
                    <textarea
                      rows={2}
                      value={d.text}
                      onChange={(e) => {
                        setDraft({ ...draft, stems: { ...draft.stems, [s.label]: { ...d, text: e.target.value } } })
                        setSaved(false)
                      }}
                    />
                  </label>
                  <label className="qwe-field">
                    <span className="qwe-label">Explanation</span>
                    <textarea
                      rows={3}
                      value={d.explanation}
                      onChange={(e) => {
                        setDraft({ ...draft, stems: { ...draft.stems, [s.label]: { ...d, explanation: e.target.value } } })
                        setSaved(false)
                      }}
                    />
                  </label>
                </li>
              )
            })}
          </ul>

          <label className="qwe-field">
            <span className="qwe-label">Take-home point</span>
            <textarea
              rows={2}
              value={draft.keyPoint}
              onChange={(e) => { setDraft({ ...draft, keyPoint: e.target.value }); setSaved(false) }}
            />
          </label>

          <div className="qwe-actions">
            <button type="button" className="qwe-btn is-primary" disabled={busy || readOnly} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save wording'}
            </button>
            {edited && (
              <button type="button" className="qwe-btn" disabled={busy || readOnly} onClick={() => void revert()}>
                Put back as shipped
              </button>
            )}
            {saved && <span className="qwe-saved" role="status">Saved.</span>}
          </div>
        </section>
      )}
    </main>
  )
}
