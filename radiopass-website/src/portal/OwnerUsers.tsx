/* ===========================================================================
   Find a customer, see what they hold, change it, and leave a record.

   Every mutation on this page goes through a database function that checks
   capability and writes an audit row. Hiding these buttons in React protects
   nobody — the tables carry no write policy at all, so a person calling the
   API directly gets the same refusal the interface would have given them.

   A reason is REQUIRED on every manual change, and that is enforced in the
   database, not here. Six months later "why does this person have free
   access until 2028" needs an answer, and the only moment anybody knows it
   is the moment they do it.
   =========================================================================== */

import { useCallback, useState } from 'react'

import { supabase } from '../lib/supabase'
import { formatDate, formatPrice, remainingLabel } from '../lib/billing'
import './owner-users.css'

type Row = {
  user_id: string
  email: string
  created_at: string
  role: string | null
  paid: boolean
  expires_at: string | null
  source: string | null
  plan_id: string | null
  plan_name: string | null
  lifetime_pence: number
}

type HistoryRow = { created_at: string; action: string; note: string | null; actor_email: string | null }

export default function OwnerUsers() {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryRow[]>([])

  const search = useCallback(async () => {
    if (!supabase || !q.trim()) return
    setBusy(true); setError(null)
    const { data, error } = await supabase.rpc('admin_find_users', { p_query: q.trim() })
    setBusy(false)
    if (error) { setError(error.message); setRows(null); return }
    setRows((data ?? []) as Row[])
  }, [q])

  const loadHistory = useCallback(async (userId: string) => {
    if (!supabase) return
    setOpen(userId)
    const { data } = await supabase.rpc('admin_user_history', { p_user_id: userId })
    setHistory((data ?? []) as HistoryRow[])
  }, [])

  async function act(fn: string, args: Record<string, unknown>, label: string) {
    if (!supabase) return
    const note = window.prompt(`${label} — reason (recorded against this account):`)
    if (note === null) return
    if (!note.trim()) { setError('A reason is required.'); return }
    setBusy(true); setError(null)
    const { error } = await supabase.rpc(fn, { ...args, p_note: note.trim() })
    setBusy(false)
    if (error) { setError(error.message); return }
    await search()
    if (open) await loadHistory(open)
  }

  return (
    <main className="ou">
      <h1>Customers</h1>
      <p className="ou-muted">
        Search by email address. Manual changes are recorded with your name and
        your reason.
      </p>

      <form
        className="ou-search"
        onSubmit={(e) => { e.preventDefault(); void search() }}
      >
        <label className="ou-sr" htmlFor="ou-q">Email address</label>
        <input
          id="ou-q"
          type="search"
          value={q}
          placeholder="name@example.com"
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" disabled={busy || !q.trim()}>{busy ? 'Searching…' : 'Search'}</button>
      </form>

      {error && <p className="ou-warn" role="alert">{error}</p>}
      {rows?.length === 0 && <p className="ou-muted">Nobody matches that.</p>}

      {rows?.map((r) => (
        <section key={r.user_id} className="ou-card">
          <header className="ou-card-head">
            <div>
              <p className="ou-email">{r.email}</p>
              <p className="ou-since">Joined {formatDate(new Date(r.created_at))}</p>
            </div>
            <span className={r.paid ? 'ou-badge ou-badge-on' : 'ou-badge'}>
              {r.paid ? (r.source === 'stripe' ? 'Paid' : (r.source ?? 'Granted')) : 'Free'}
            </span>
          </header>

          <dl className="ou-facts">
            <div><dt>Plan</dt><dd>{r.plan_name ?? '—'}</dd></div>
            <div><dt>Expires</dt><dd>{r.expires_at ? formatDate(new Date(r.expires_at)) : r.paid ? 'Never' : '—'}</dd></div>
            <div><dt>Remaining</dt><dd>{r.paid ? remainingLabel(r.expires_at ? new Date(r.expires_at) : null, new Date()) : '—'}</dd></div>
            <div><dt>Spent</dt><dd>{formatPrice(r.lifetime_pence)}</dd></div>
            <div><dt>Staff role</dt><dd>{r.role ?? 'None'}</dd></div>
          </dl>

          {/* Staff role is shown but not editable here. Seats are changed in
              the permissions flow, deliberately apart from billing: a paying
              customer must never acquire staff powers by an accident of this
              screen, and a colleague must never need a purchase. */}

          <div className="ou-actions">
            {[3, 6, 12].map((m) => (
              <button
                key={m}
                type="button"
                disabled={busy}
                onClick={() => void act('grant_complimentary_access',
                  { p_user_id: r.user_id, p_months: m, p_source: 'complimentary' },
                  `Give ${m} months free`)}
              >
                +{m} months free
              </button>
            ))}
            <button
              type="button"
              disabled={busy}
              onClick={() => void act('grant_complimentary_access',
                { p_user_id: r.user_id, p_months: null, p_source: 'complimentary' },
                'Give access with no end date')}
            >
              Never expires
            </button>
            <button
              type="button"
              className="ou-danger"
              disabled={busy}
              onClick={() => void act('revoke_access', { p_user_id: r.user_id }, 'Revoke access')}
            >
              Revoke
            </button>
            <button type="button" onClick={() => void loadHistory(r.user_id)}>History</button>
          </div>

          {open === r.user_id && (
            <div className="ou-history">
              <h3>History</h3>
              {history.length === 0 ? (
                <p className="ou-muted">Nothing recorded.</p>
              ) : (
                <ul>
                  {history.map((h, i) => (
                    <li key={i}>
                      <span className="ou-h-when">{formatDate(new Date(h.created_at))}</span>
                      <span className="ou-h-what">{h.action.replace(/_/g, ' ')}</span>
                      {h.note && <span className="ou-h-note">“{h.note}”</span>}
                      {h.actor_email && <span className="ou-h-who">{h.actor_email}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      ))}
    </main>
  )
}
