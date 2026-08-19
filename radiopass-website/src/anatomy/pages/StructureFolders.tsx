/**
 * Structure folders — the tool for ending the repetition in the atlas.
 *
 * THE JOB, in the owner's words: the dataset separates "proximal phalanx of
 * the little toe" from the same bone written another way, so the atlas shows
 * one structure several times over. It is obvious to a person looking at it
 * and nearly impossible to fix by describing each case to somebody else. So
 * this is the page that lets him see them side by side and join them.
 *
 * WHAT A MERGE DOES, and the rule that governs it: images join, and EVERY
 * name survives as a correct answer. Synonyms scoring full marks is the
 * most-repeated correction in this project — C1 is the atlas, aqueduct of
 * Sylvius is the cerebral aqueduct — and merging is exactly the operation that
 * would silently break it by picking a winner. So a merge only ever adds to
 * the accepted set.
 *
 * NOTHING HERE TOUCHES THE SOURCE. The 501 questions ship in the bundle and
 * are never written to; a folder document says how to GROUP them. An unmerge
 * costs nothing and a mistake cannot damage the dataset.
 *
 * DELIBERATELY NOT DRAG-AND-DROP. The owner will use this on a phone as much
 * as at a desk, and dragging between folders on a touch screen is the fiddliest
 * interaction there is. Selecting a structure and choosing where it goes works
 * identically on both.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { contentStoreStatus, type ContentStoreStatus } from '../../lib/contentStore'
import {
  addAcceptedName,
  createFolder,
  deleteFolder,
  loadFolders,
  mergeFolders,
  namesOf,
  renameFolder,
  suggestMerges,
  type FolderDoc,
  type StructureFolder,
} from '../lib/structureFolders'
import {
  alreadyFoldered,
  proposedFolders,
  structureKey,
  type ScannedStructure,
} from '../lib/structureScan'
import './StructureFolders.css'

/** Why an author cannot save, said in their language, with the way out. */
function blockedMessage(status: Exclude<ContentStoreStatus, { ready: true }>): {
  title: string
  detail: string
  action?: { label: string; to: string }
} {
  switch (status.reason) {
    case 'no-backend':
      return {
        title: 'No content backend on this build',
        detail:
          'This copy of the site was built without Supabase credentials, so there is nowhere for an edit to be saved. Editing works on a build that has them.',
      }
    case 'signed-out':
      return {
        title: 'Sign in to edit',
        detail: 'Editing is tied to your account, not to this browser.',
        action: { label: 'Log in', to: '/login' },
      }
    case 'not-admin':
      return {
        title: 'This account cannot edit content',
        detail:
          'Editing needs the admin grant, which is set on the account in the database and cannot be granted from the browser. That is deliberate.',
      }
  }
}

export default function StructureFolders() {
  const [status, setStatus] = useState<ContentStoreStatus | null>(null)
  const [doc, setDoc] = useState<FolderDoc | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [filter, setFilter] = useState('')
  const [scan, setScan] = useState<ScannedStructure[] | null>(null)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    void contentStoreStatus().then(setStatus)
    void loadFolders().then(setDoc)
  }, [])

  const suggestions = useMemo(() => (doc ? suggestMerges(doc) : []), [doc])

  /* Proposals the author has not already acted on. Recomputed against the
     live document so a folder just created drops out of the list rather than
     sitting there inviting a duplicate. */
  const proposals = useMemo(() => {
    if (!scan || !doc) return []
    const done = alreadyFoldered(doc.folders)
    return scan.filter((item) => !done.has(structureKey(item.canonicalName)))
  }, [scan, doc])
  const shown = useMemo(() => {
    if (!doc) return []
    const q = filter.trim().toLowerCase()
    if (!q) return doc.folders
    return doc.folders.filter((f) => namesOf(f).some((n) => n.toLowerCase().includes(q)))
  }, [doc, filter])

  /** Every mutation runs through here so one place owns errors and busy state. */
  const run = async (work: () => Promise<FolderDoc>) => {
    setBusy(true)
    setError(null)
    try {
      setDoc(await work())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const readOnly = !status?.ready

  return (
    <main className="sf">
      <header className="sf-head">
        <p className="sf-eyebrow">Anatomy · authoring</p>
        <h1>Structure folders</h1>
        <p className="sf-lede">
          One structure, however many images and however many names. Merging two folders joins
          their images and <strong>keeps both names correct</strong> — no answer a candidate might
          reasonably write is ever dropped.
        </p>
        <Link className="sf-back" to="/anatomy/dashboard">
          &larr; Back to anatomy
        </Link>
      </header>

      {status && !status.ready && (
        <div className="sf-blocked" role="status">
          {(() => {
            const m = blockedMessage(status)
            return (
              <>
                <strong>{m.title}</strong>
                <p>{m.detail}</p>
                {m.action && <Link className="sf-btn" to={m.action.to}>{m.action.label}</Link>}
                <p className="sf-blocked-note">
                  You can still look through the folders below; nothing can be saved.
                </p>
              </>
            )
          })()}
        </div>
      )}

      {error && (
        <p className="sf-error" role="alert">
          Could not save: {error}
        </p>
      )}

      <section className="sf-scan">
        <h2>Find the repetition</h2>
        <p className="sf-scan-note">
          Reads all six sections and groups every structure by what it actually is, ignoring
          case, word order and the usual exam synonyms. What comes back is the same bone
          recorded under more than one wording, and structures that appear on several films.
          Nothing is created until you say so.
        </p>
        <button
          type="button"
          className="sf-btn"
          disabled={scanning}
          onClick={() => {
            setScanning(true)
            /* Yielded to the browser first: this walks 501 questions and every
               label on them, and doing it inside the click handler froze the
               button in its un-pressed state for the whole scan — which reads
               as a dead button rather than a slow one. */
            setTimeout(() => {
              setScan(proposedFolders())
              setScanning(false)
            }, 0)
          }}
        >
          {scanning ? 'Reading the bank…' : scan ? 'Scan again' : 'Scan the question bank'}
        </button>

        {scan && (
          <p className="sf-scan-result">
            {proposals.length === 0
              ? 'Nothing left to group — every structure the scan found is already in a folder.'
              : `${proposals.length} structure${proposals.length === 1 ? '' : 's'} worth grouping. The ones recorded under more than one name are first.`}
          </p>
        )}

        {proposals.length > 0 && (
          <ul className="sf-proposals">
            {proposals.slice(0, 60).map((item) => (
              <li key={structureKey(item.canonicalName)}>
                <div className="sf-proposal-body">
                  <b>{item.canonicalName}</b>
                  {item.names.length > 1 && (
                    <span className="sf-proposal-alts">
                      also written: {item.names.slice(1).join(' · ')}
                    </span>
                  )}
                  <span className="sf-proposal-meta">
                    {item.members.length} film{item.members.length === 1 ? '' : 's'}
                    {item.names.length > 1 && ` · ${item.names.length} wordings`}
                  </span>
                </div>
                <button
                  type="button"
                  className="sf-btn"
                  disabled={busy || readOnly}
                  onClick={() =>
                    void run(async () => {
                      const next = await createFolder(item.canonicalName, item.members)
                      /* Every other wording is added as an accepted name, so
                         grouping can only ever WIDEN what marks correct. */
                      const made = next.folders[next.folders.length - 1]
                      let doc = next
                      for (const alt of item.names.slice(1)) {
                        doc = await addAcceptedName(made.id, alt)
                      }
                      return doc
                    })
                  }
                >
                  Make a folder
                </button>
              </li>
            ))}
            {proposals.length > 60 && (
              <li className="sf-proposal-more">
                {proposals.length - 60} more below this — they appear once these are dealt with.
              </li>
            )}
          </ul>
        )}
      </section>

      {suggestions.length > 0 && (
        <section className="sf-suggest" aria-label="Possible duplicates">
          <h2>Possible duplicates — {suggestions.length}</h2>
          <p className="sf-suggest-note">
            The same words once synonyms and word order are allowed for. Each one is a suggestion:
            two structures that read alike are not always the same bone, so nothing merges until
            you say so.
          </p>
          <ul>
            {suggestions.map(({ a, b }) => (
              <li key={`${a.id}-${b.id}`}>
                <span>
                  <b>{a.canonicalName}</b> and <b>{b.canonicalName}</b>
                </span>
                <button
                  type="button"
                  className="sf-btn"
                  disabled={busy || readOnly}
                  onClick={() => void run(() => mergeFolders(b.id, a.id))}
                >
                  Merge into “{a.canonicalName}”
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="sf-tools">
        <label className="sf-field">
          <span>Find a structure</span>
          <input
            type="search"
            value={filter}
            placeholder="phalanx, atlas, aqueduct…"
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>
        <label className="sf-field">
          <span>New folder</span>
          <span className="sf-inline">
            <input
              type="text"
              value={newName}
              placeholder="Canonical name"
              onChange={(e) => setNewName(e.target.value)}
            />
            <button
              type="button"
              className="sf-btn"
              disabled={busy || readOnly || !newName.trim()}
              onClick={() =>
                void run(async () => {
                  const next = await createFolder(newName)
                  setNewName('')
                  return next
                })
              }
            >
              Create
            </button>
          </span>
        </label>
      </section>

      {!doc ? (
        <p className="sf-empty">Loading folders…</p>
      ) : doc.folders.length === 0 ? (
        <p className="sf-empty">
          No folders yet. Create one for a structure that appears more than once, then merge its
          duplicates into it.
        </p>
      ) : (
        <ul className="sf-list">
          {shown.map((folder) => (
            <FolderRow
              key={folder.id}
              folder={folder}
              busy={busy}
              readOnly={readOnly}
              selected={selected === folder.id}
              others={doc.folders.filter((f) => f.id !== folder.id)}
              onSelect={() => setSelected(selected === folder.id ? null : folder.id)}
              onRename={(name) => void run(() => renameFolder(folder.id, name))}
              onAlias={(name) => void run(() => addAcceptedName(folder.id, name))}
              onMergeInto={(intoId) => void run(() => mergeFolders(folder.id, intoId))}
              onDelete={() => void run(() => deleteFolder(folder.id))}
            />
          ))}
        </ul>
      )}
    </main>
  )
}

function FolderRow({
  folder,
  busy,
  readOnly,
  selected,
  others,
  onSelect,
  onRename,
  onAlias,
  onMergeInto,
  onDelete,
}: {
  folder: StructureFolder
  busy: boolean
  readOnly: boolean
  selected: boolean
  others: StructureFolder[]
  onSelect: () => void
  onRename: (name: string) => void
  onAlias: (name: string) => void
  onMergeInto: (intoId: string) => void
  onDelete: () => void
}) {
  const [alias, setAlias] = useState('')
  const [rename, setRename] = useState(folder.canonicalName)
  const names = namesOf(folder)

  return (
    <li className={`sf-folder${selected ? ' is-open' : ''}`}>
      <button type="button" className="sf-folder-head" onClick={onSelect} aria-expanded={selected}>
        <span className="sf-folder-name">{folder.canonicalName}</span>
        <span className="sf-folder-meta">
          {folder.members.length} image{folder.members.length === 1 ? '' : 's'}
          {names.length > 1 && ` · ${names.length - 1} other name${names.length === 2 ? '' : 's'}`}
        </span>
      </button>

      {selected && (
        <div className="sf-folder-body">
          {names.length > 1 && (
            <p className="sf-names">
              <span>Also accepted:</span>{' '}
              {names.slice(1).map((n) => (
                <em key={n}>{n}</em>
              ))}
            </p>
          )}

          <label className="sf-field">
            <span>Displayed name</span>
            <span className="sf-inline">
              <input value={rename} onChange={(e) => setRename(e.target.value)} />
              <button
                type="button"
                className="sf-btn"
                disabled={busy || readOnly || !rename.trim() || rename === folder.canonicalName}
                onClick={() => onRename(rename)}
              >
                Rename
              </button>
            </span>
            <small>The old name stays a correct answer.</small>
          </label>

          <label className="sf-field">
            <span>Add another accepted name</span>
            <span className="sf-inline">
              <input
                value={alias}
                placeholder="e.g. Atlas"
                onChange={(e) => setAlias(e.target.value)}
              />
              <button
                type="button"
                className="sf-btn"
                disabled={busy || readOnly || !alias.trim()}
                onClick={() => {
                  onAlias(alias)
                  setAlias('')
                }}
              >
                Add
              </button>
            </span>
          </label>

          {others.length > 0 && (
            <label className="sf-field">
              <span>Merge this folder into…</span>
              <select
                disabled={busy || readOnly}
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) onMergeInto(e.target.value)
                  e.target.value = ''
                }}
              >
                <option value="">Choose a folder</option>
                {others.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.canonicalName}
                  </option>
                ))}
              </select>
              <small>
                This folder's images and all of its names move across. This folder then goes.
              </small>
            </label>
          )}

          <button
            type="button"
            className="sf-btn is-quiet"
            disabled={busy || readOnly}
            onClick={onDelete}
          >
            Ungroup this folder
          </button>
          <small className="sf-note">
            Ungrouping removes the folder only. No question and no image is deleted.
          </small>
        </div>
      )}
    </li>
  )
}
