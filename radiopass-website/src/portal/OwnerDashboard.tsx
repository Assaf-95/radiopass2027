/* ===========================================================================
   The owner's dashboard: the business in one screen.

   Everything here comes from two Supabase functions that return AGGREGATES
   only — owner_metrics() and owner_signup_series(). Neither can return a row
   about an individual, which is deliberate: a dashboard needs counts, and a
   view over auth.users is one careless policy away from leaking every
   candidate's email address.

   Both functions refuse anybody without the users:manage capability, so this
   page being reachable is not what protects the numbers. The route guard is
   convenience; the database is the boundary.

   ON THE CHARTS. Most of this screen is not a chart, on purpose — a single
   number is read faster as a number than as a bar of length one. Two things
   genuinely vary and get plotted: sign-ups over time (one series, so no
   legend — the heading names it) and the plan mix (identity is on the axis
   label, so colour there would encode nothing that is not already written).
   =========================================================================== */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { supabase } from '../lib/supabase'
import './owner-dashboard.css'

type Metrics = {
  accounts: { total: number; last7: number; last30: number; confirmed: number }
  plans: {
    full: number
    anatomy_only: number
    physics_only: number
    trial: number
    free: number
    expiring_30: number
  }
  team: Record<string, number>
  active: { last7: number; last30: number }
  study: { anatomy_learners: number; physics_learners: number; flagged: number; disputes: number }
  authoring: { edits_total: number; edits_last30: number }
  generated_at: string
}

type SignupDay = { day: string; signups: number }

const nf = new Intl.NumberFormat('en-GB')

export default function OwnerDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [series, setSeries] = useState<SignupDay[]>([])
  const [error, setError] = useState<string | null>(null)
  const [asTable, setAsTable] = useState(false)

  const load = useCallback(async () => {
    if (!supabase) {
      setError('This build has no Supabase configuration, so there are no numbers to show.')
      return
    }
    setError(null)
    const [m, s] = await Promise.all([
      supabase.rpc('owner_metrics'),
      supabase.rpc('owner_signup_series'),
    ])
    /* 42501 is the database refusing, not the page failing. Saying so stops
       the owner debugging a dashboard when the real answer is that they are
       signed in as somebody else. */
    if (m.error) {
      setError(
        m.error.code === '42501'
          ? 'This account does not hold the permission to see these numbers.'
          : m.error.message,
      )
      return
    }
    setMetrics(m.data as Metrics)
    if (!s.error && Array.isArray(s.data)) setSeries(s.data as SignupDay[])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return (
      <main className="od">
        <h1>Dashboard</h1>
        <p className="od-error" role="alert">{error}</p>
      </main>
    )
  }
  if (!metrics) {
    return (
      <main className="od">
        <h1>Dashboard</h1>
        <p className="od-muted">Counting…</p>
      </main>
    )
  }

  const { accounts, plans, active, study, authoring, team } = metrics
  const subscribers = plans.full + plans.anatomy_only + plans.physics_only

  return (
    <main className="od">
      <header className="od-head">
        <h1>Dashboard</h1>
        <button type="button" className="od-refresh" onClick={() => void load()}>
          Refresh
        </button>
      </header>

      {/* The four numbers worth knowing before any detail. A hero number is a
          number, not a chart of one bar. */}
      <section className="od-tiles" aria-label="Headline figures">
        <Tile label="Accounts" value={accounts.total} note={`${nf.format(accounts.confirmed)} confirmed`} />
        <Tile label="Subscribers" value={subscribers} note={`${nf.format(plans.free)} free accounts`} />
        <Tile label="Studied this week" value={active.last7} note={`${nf.format(active.last30)} in 30 days`} />
        <Tile label="New this week" value={accounts.last7} note={`${nf.format(accounts.last30)} in 30 days`} />
      </section>

      {plans.expiring_30 > 0 && (
        <p className="od-flag" role="status">
          <strong>{nf.format(plans.expiring_30)}</strong> subscription
          {plans.expiring_30 === 1 ? '' : 's'} expire in the next 30 days.
        </p>
      )}

      <div className="od-grid">
        <SignupChart series={series} asTable={asTable} onToggle={() => setAsTable((v) => !v)} />
        <PlanMix plans={plans} />
      </div>

      <section className="od-panel" aria-label="Study and authoring">
        <h2>Study</h2>
        <dl className="od-facts">
          <Fact term="Anatomy learners" value={study.anatomy_learners} />
          <Fact term="Physics learners" value={study.physics_learners} />
          <Fact term="Flagged questions" value={study.flagged} />
          <Fact term="Open disputes" value={study.disputes} />
          <Fact term="Content edits (30 days)" value={authoring.edits_last30} />
          <Fact term="Content edits (all time)" value={authoring.edits_total} />
        </dl>
        {Object.keys(team).length > 0 && (
          <>
            <h2>Team</h2>
            <dl className="od-facts">
              {Object.entries(team).map(([role, n]) => (
                <Fact key={role} term={role.replace('-', ' ')} value={n} />
              ))}
            </dl>
          </>
        )}
      </section>

      <section className="od-panel">
        <h2>Visitors</h2>
        <p className="od-muted">
          Visitor numbers live in Cloudflare, not here. Reading them into this page
          needs a server-side key, which cannot be shipped in a browser — so for now
          this is a link rather than a chart.
        </p>
        <a className="od-link" href="https://dash.cloudflare.com" target="_blank" rel="noreferrer noopener">
          Open Cloudflare Web Analytics
        </a>
      </section>

      <p className="od-stamp">
        Counted {new Date(metrics.generated_at).toLocaleString('en-GB')}.
      </p>
    </main>
  )
}

function Tile({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="od-tile">
      <p className="od-tile-label">{label}</p>
      <p className="od-tile-value">{nf.format(value)}</p>
      {note && <p className="od-tile-note">{note}</p>}
    </div>
  )
}

function Fact({ term, value }: { term: string; value: number }) {
  return (
    <div className="od-fact">
      <dt>{term}</dt>
      <dd>{nf.format(value)}</dd>
    </div>
  )
}

/* Sign-ups over 90 days. One series, so no legend — the heading is the label.
   The last point is called out directly rather than labelling all ninety. */
function SignupChart({
  series,
  asTable,
  onToggle,
}: {
  series: SignupDay[]
  asTable: boolean
  onToggle: () => void
}) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 640
  const H = 180
  const PAD = { t: 14, r: 16, b: 22, l: 30 }

  const { points, max, path, area } = useMemo(() => {
    if (!series.length) return { points: [], max: 0, path: '', area: '' }
    const m = Math.max(1, ...series.map((d) => d.signups))
    const iw = W - PAD.l - PAD.r
    const ih = H - PAD.t - PAD.b
    const pts = series.map((d, i) => ({
      x: PAD.l + (i / Math.max(1, series.length - 1)) * iw,
      y: PAD.t + ih - (d.signups / m) * ih,
      d,
    }))
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    const fill = `${line} L${pts[pts.length - 1].x.toFixed(1)},${(PAD.t + ih).toFixed(1)} L${pts[0].x.toFixed(1)},${(PAD.t + ih).toFixed(1)} Z`
    return { points: pts, max: m, path: line, area: fill }
  }, [series])

  const total = series.reduce((n, d) => n + d.signups, 0)

  if (!series.length) {
    return (
      <section className="od-panel">
        <h2>Sign-ups</h2>
        <p className="od-muted">No sign-up history yet.</p>
      </section>
    )
  }

  return (
    <section className="od-panel">
      <div className="od-panel-head">
        <h2>Sign-ups — last 90 days</h2>
        <button type="button" className="od-toggle" onClick={onToggle} aria-pressed={asTable}>
          {asTable ? 'Show chart' : 'Show table'}
        </button>
      </div>
      <p className="od-lede">
        <strong>{nf.format(total)}</strong> in total, peaking at {nf.format(max)} in a day.
      </p>

      {asTable ? (
        <div className="od-tablewrap">
          <table className="od-table">
            <caption className="od-sr">Sign-ups per day for the last 90 days</caption>
            <thead>
              <tr><th scope="col">Day</th><th scope="col">Sign-ups</th></tr>
            </thead>
            <tbody>
              {series.filter((d) => d.signups > 0).map((d) => (
                <tr key={d.day}>
                  <td>{d.day}</td>
                  <td>{nf.format(d.signups)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="od-chartwrap">
          <svg
            className="od-chart"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`Sign-ups per day over the last 90 days. ${total} in total, peak ${max}.`}
            onMouseLeave={() => setHover(null)}
          >
            <line className="od-axis" x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} />
            <path className="od-area" d={area} />
            <path className="od-line" d={path} />
            {hover != null && points[hover] && (
              <>
                <line className="od-cross" x1={points[hover].x} y1={PAD.t} x2={points[hover].x} y2={H - PAD.b} />
                <circle className="od-dot" cx={points[hover].x} cy={points[hover].y} r={4} />
              </>
            )}
            {/* The endpoint, labelled directly — not every point. */}
            <circle className="od-dot od-dot-end" cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={3.5} />
            {points.map((p, i) => (
              <rect
                key={p.d.day}
                x={p.x - 3}
                y={PAD.t}
                width={6}
                height={H - PAD.t - PAD.b}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            ))}
          </svg>
          <p className="od-hint" aria-live="polite">
            {hover != null && points[hover]
              ? `${points[hover].d.day}: ${nf.format(points[hover].d.signups)} sign-up${points[hover].d.signups === 1 ? '' : 's'}`
              : `${series[0].day} to ${series[series.length - 1].day}`}
          </p>
        </div>
      )}
    </section>
  )
}

/* Plan mix. Bars because these are magnitudes being compared; one hue because
   the category is already written at the end of each row, and a second
   encoding of the same fact is noise. */
function PlanMix({ plans }: { plans: Metrics['plans'] }) {
  const rows = [
    { label: 'Full', n: plans.full },
    { label: 'Anatomy only', n: plans.anatomy_only },
    { label: 'Physics only', n: plans.physics_only },
    { label: 'Trial', n: plans.trial },
    { label: 'Free account', n: plans.free },
  ]
  const max = Math.max(1, ...rows.map((r) => r.n))
  return (
    <section className="od-panel">
      <h2>Plans</h2>
      <ul className="od-bars">
        {rows.map((r) => (
          <li key={r.label}>
            <span className="od-bar-label">{r.label}</span>
            <span className="od-bar-track">
              <span className="od-bar-fill" style={{ width: `${(r.n / max) * 100}%` }} />
            </span>
            <span className="od-bar-value">{nf.format(r.n)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
