/* Editor sign-in, and the hub the editing tools hang off.
 *
 * Two sign-ins, one form. When the content API is reachable the password is
 * checked by the server and the session it returns is what authorises every
 * save — edits then land centrally and everyone sees them. When it is not
 * (a plain static host), the form falls back to the old browser-only lock so
 * the authoring tools still work locally, and says so plainly. */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SECTION_META } from '../data/sections';
import { hasServerSession, isAdmin, signInAdmin, signInEditor, signOutAdmin } from '../lib/admin';
import { contentState, loadContent, subscribeContent } from '../lib/content/store';
import { fetchAudit } from '../lib/content/api';
import type { AuditEntry } from '../lib/content/types';
import { editedQuestionIds } from '../lib/questionEdits';
import './AdminLogin.css';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(isAdmin());
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [content, setContent] = useState(contentState());
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const edits = admin ? editedQuestionIds() : [];
  const server = hasServerSession();

  useEffect(() => subscribeContent(() => setContent(contentState())), []);
  useEffect(() => { loadContent(); }, []);

  useEffect(() => {
    if (!server) return;
    fetchAudit().then(setAudit).catch(() => setAudit([]));
  }, [server, admin]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (content.online) {
        await signInEditor(code);
        await loadContent(true);
        setAdmin(true);
      } else if (signInAdmin(code)) {
        setAdmin(true);
      } else {
        setError('That passcode did not match.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  if (!admin) {
    return (
      <div className="admin-gate">
        <form className="admin-card" onSubmit={submit}>
          <p className="rpa-eyebrow">RadioPass · Editing</p>
          <h1>Editor sign-in</h1>
          <p className="admin-sub">
            Replacing images, placing labels and arrows, showing and hiding options,
            editing Atlas metadata — for you, not for candidates.
          </p>
          <label className="admin-field">
            <span>{content.online ? 'Editor password' : 'Passcode'}</span>
            <input
              type="password"
              value={code}
              autoFocus
              onChange={(e) => { setCode(e.target.value); setError(null); }}
              placeholder={content.online ? 'Editor password' : 'Author passcode'}
            />
          </label>
          {error && <p className="admin-error">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          {content.online && content.editingConfigured && (
            <p className="admin-note">
              Checked by the server. Changes you save are stored centrally, take effect
              for everyone at once, and appear in both the Question Bank and the
              Structure Atlas.
            </p>
          )}
          {content.online && !content.editingConfigured && (
            <p className="admin-note">
              The content service is reachable but has no editor password set. Add
              <code> ATLAS_ADMIN_PASSWORD</code> and <code>ATLAS_SESSION_SECRET</code> to
              the deployment's environment to enable saving.
            </p>
          )}
          {!content.online && (
            <p className="admin-note">
              No content service is reachable, so this is the browser-only lock: the
              editing tools work, but changes stay on this machine. Run the content
              server (<code>npm run serve</code>, or your host's equivalent) for edits
              that save centrally.
            </p>
          )}
          <Link className="back-link" to="/anatomy">← Back to the site</Link>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-gate">
      <div className="admin-card admin-hub">
        <p className="rpa-eyebrow">RadioPass · Editing</p>
        <h1>Editor tools</h1>
        <p className={server ? 'admin-sub admin-live' : 'admin-sub'}>
          {server
            ? 'Signed in against the content service. What you save is stored centrally and is live for everyone.'
            : 'Signed in on this browser only. Changes stay on this machine until you sign in against a content service.'}
        </p>

        <h2>Edit a question's image, labels and arrows</h2>
        <p className="admin-hint">
          Open any question and use <strong>Edit image &amp; labels</strong> in its header —
          or open any film in the Structure Atlas and use its <strong>Edit</strong> control.
          Both lead to the same editor and write the same record, so it does not matter
          which side you start from. Answers, accepted variants and teaching text are
          preserved.
        </p>
        <div className="admin-links">
          {SECTION_META.map((s) => (
            <Link key={s.id} className="btn" to={`/anatomy/section/${s.id}`}>{s.title}</Link>
          ))}
        </div>

        <h2>Add your own cases</h2>
        <div className="admin-links">
          {SECTION_META.map((s) => (
            <Link key={s.id} className="btn" to={`/anatomy/section/${s.id}/custom`}>+ {s.title}</Link>
          ))}
        </div>

        {server ? (
          <>
            <h2>Recent changes ({audit.length})</h2>
            {audit.length === 0 ? (
              <p className="admin-hint">Nothing saved yet.</p>
            ) : (
              <ul className="admin-edits">
                {audit.slice(0, 25).map((a, i) => (
                  <li key={`${a.at}-${i}`}>
                    <code>{a.questionId}</code> — {a.action}
                    {a.detail ? ` (${a.detail})` : ''}
                    <span className="admin-when"> {new Date(a.at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="admin-hint">
              Saved centrally. Both interfaces read the same record, so a replaced image
              appears in the Question Bank and in every Atlas gallery that shows it.
            </p>
          </>
        ) : (
          <>
            <h2>Local edits ({edits.length})</h2>
            {edits.length === 0
              ? <p className="admin-hint">No questions edited yet.</p>
              : <ul className="admin-edits">{edits.map((id) => <li key={id}><code>{id}</code></li>)}</ul>}
            <p className="admin-hint">
              Stored in this browser. Candidates see them only after you rebuild and
              re-upload the site.
            </p>
          </>
        )}

        <button
          className="btn"
          type="button"
          onClick={() => { signOutAdmin(); setAdmin(false); navigate('/'); }}
        >
          Sign out of editing
        </button>
      </div>
    </div>
  );
}
