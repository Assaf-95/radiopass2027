// Live interactive previews for the homepage. Each one runs a real, small
// physics model — the same relationships the full labs teach — and links
// into the complete simulation rather than duplicating it.

import { useMemo, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'

function Ctl({ label, value, min, max, step, onChange, disabled = false }: {
  label: string; value: string; min: number; max: number; step: number
  onChange: (v: number) => void; disabled?: boolean
}) {
  return (
    <label className={`hm-ctl${disabled ? ' is-off' : ''}`}>
      <span className="hm-ctl-row"><span>{label}</span><strong>{value}</strong></span>
      <input
        type="range" min={min} max={max} step={step} disabled={disabled}
        value={Number(value.replace(/[^\d.]/g, '')) || min}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
        aria-label={label}
      />
    </label>
  )
}

/* ------------------------------------------------------------------ */
/*  X-ray spectrum                                                     */
/* ------------------------------------------------------------------ */

const TARGETS = {
  W: { name: 'Tungsten', edge: 69.5, lines: [[59.3, 1], [67.2, 0.55]] as const },
  Mo: { name: 'Molybdenum', edge: 20, lines: [[17.5, 1], [19.6, 0.55]] as const },
}

export function SpectrumDemo() {
  const [kvp, setKvp] = useState(90)
  const [ma, setMa] = useState(200)
  const [fil, setFil] = useState(2.5)
  const [target, setTarget] = useState<keyof typeof TARGETS>('W')

  const model = useMemo(() => {
    const tgt = TARGETS[target]
    const atten = (e: number, mm: number) => Math.exp(-0.33 * mm * Math.pow(30 / Math.max(e, 4), 3))
    const brems = (e: number, kv: number) => (e <= 0 || e >= kv ? 0 : ((kv - e) / e) * atten(e, fil + 0.9))
    const charHeight = kvp > tgt.edge ? ((kvp - tgt.edge) / tgt.edge) * 5.5 : 0
    const intensity = (e: number) => {
      let v = brems(e, kvp)
      if (charHeight > 0) for (const [le, rel] of tgt.lines) {
        v += charHeight * rel * Math.exp(-Math.pow((e - le) / 0.9, 2)) * atten(le, fil + 0.9)
      }
      return v * (ma / 200)
    }
    // Fixed normalisation (the 120 kVp / 200 mA reference peak) so every
    // control change reads as a genuine change in output, not a rescale.
    let norm = 0
    for (let e = 5; e <= 120; e++) norm = Math.max(norm, ((120 - e) / e) * atten(e, 3.4))
    let sum = 0, esum = 0
    const pts: [number, number][] = []
    for (let e = 1; e <= 150; e += 1) {
      const v = intensity(e)
      sum += v; esum += v * e
      pts.push([e, v / norm])
    }
    return { pts, mean: sum > 0 ? esum / sum : 0, out: sum, charVisible: charHeight > 0, tgt }
  }, [kvp, ma, fil, target])

  const refOut = useMemo(() => {
    // output at the default settings, for the relative-output readout
    const atten = (e: number) => Math.exp(-0.33 * 3.4 * Math.pow(30 / Math.max(e, 4), 3))
    let s = 0
    for (let e = 1; e <= 90; e++) s += ((90 - e) / e) * atten(e)
    return s
  }, [])

  const W = 460, H = 230, mx = 38, my = 18, pw = W - mx - 14, ph = H - my - 34
  const px = (e: number) => mx + (e / 150) * pw
  const py = (v: number) => my + ph - Math.min(v, 1.04) * ph
  const path = model.pts.map(([e, v], i) => `${i ? 'L' : 'M'}${px(e).toFixed(1)},${py(v).toFixed(1)}`).join('')

  return (
    <article className="hm-demo">
      <header><h3>X-ray spectrum</h3><span className="hm-demo-tag hm-acc-xray">Live model</span></header>
      <svg viewBox={`0 0 ${W} ${H}`} className="hm-demo-svg" role="img" aria-label={`X-ray spectrum for ${model.tgt.name} target at ${kvp} kVp`}>
        <line x1={mx} y1={my} x2={mx} y2={my + ph} className="hm-svg-axis" />
        <line x1={mx} y1={my + ph} x2={mx + pw} y2={my + ph} className="hm-svg-axis" />
        <path d={`${path}L${px(150)},${py(0)}L${px(model.pts[0][0])},${py(0)}Z`} className="hm-svg-fill-xray" />
        <path d={path} className="hm-svg-line-xray" />
        <line x1={px(kvp)} y1={my + ph} x2={px(kvp)} y2={my + ph * 0.35} className="hm-svg-marker" />
        <text x={px(kvp)} y={my + ph * 0.3} className="hm-svg-note" textAnchor="middle">max = kVp</text>
        {model.charVisible && (
          <text x={px(model.tgt.lines[0][0])} y={my + 12} className="hm-svg-note amber" textAnchor="middle">characteristic</text>
        )}
        <text x={mx + pw} y={H - 10} className="hm-svg-note" textAnchor="end">photon energy (keV)</text>
        <text x={mx - 6} y={my + 8} className="hm-svg-note" textAnchor="end" transform={`rotate(-90 ${mx - 6} ${my + 8})`}>photons</text>
      </svg>
      <div className="hm-demo-reads">
        <div><span>Max energy</span><strong>{kvp} keV</strong></div>
        <div><span>Mean energy</span><strong>{model.mean.toFixed(0)} keV</strong></div>
        <div><span>Relative output</span><strong>{Math.round((model.out / refOut) * 100)}%</strong></div>
      </div>
      <div className="hm-demo-ctls">
        <Ctl label="Tube potential" value={`${kvp} kVp`} min={40} max={150} step={1} onChange={setKvp} />
        <Ctl label="Tube current" value={`${ma} mA`} min={50} max={400} step={10} onChange={setMa} />
        <Ctl label="Added filtration" value={`${fil.toFixed(1)} mm Al`} min={0} max={5} step={0.5} onChange={setFil} />
        <div className="hm-chip-row" role="group" aria-label="Target material">
          {(Object.keys(TARGETS) as (keyof typeof TARGETS)[]).map(k => (
            <button key={k} className={target === k ? 'hm-chip on' : 'hm-chip'} onClick={() => setTarget(k)}>{TARGETS[k].name}</button>
          ))}
        </div>
      </div>
      <p className="hm-demo-note">mA changes how many photons — never their maximum energy. kVp changes both.</p>
      <Link to="/visual-lab" className="hm-demo-link">Open the full X-ray lab →</Link>
    </article>
  )
}

/* ------------------------------------------------------------------ */
/*  Geometric unsharpness                                              */
/* ------------------------------------------------------------------ */

export function UnsharpnessDemo() {
  const [focal, setFocal] = useState(1.2)   // mm
  const [sod, setSod] = useState(70)        // cm; SID fixed at 100 cm

  const SID = 100
  const mag = SID / sod
  const penumbra = (focal * (SID - sod)) / sod

  const W = 460, H = 230
  const srcX = 42, detX = 420, midY = 115
  const objX = srcX + ((detX - srcX) * sod) / SID
  const fpx = focal * 16
  const objHalf = 30
  const rayY = (ys: number, yo: number) => ys + ((yo - ys) * (detX - srcX)) / (objX - srcX)
  const sTop = midY - fpx / 2, sBot = midY + fpx / 2
  const oTop = midY - objHalf, oBot = midY + objHalf
  // projections of each object edge from each end of the focal spot
  const tt = rayY(sTop, oTop), bt = rayY(sBot, oTop)
  const tb = rayY(sTop, oBot), bb = rayY(sBot, oBot)

  return (
    <article className="hm-demo">
      <header><h3>Geometric unsharpness</h3><span className="hm-demo-tag hm-acc-xray">Live model</span></header>
      <svg viewBox={`0 0 ${W} ${H}`} className="hm-demo-svg" role="img" aria-label={`Beam geometry with ${focal.toFixed(1)} millimetre focal spot`}>
        {/* penumbra bands */}
        <polygon points={`${objX},${oTop} ${detX},${Math.min(tt, bt)} ${detX},${Math.max(tt, bt)}`} className="hm-svg-penumbra" />
        <polygon points={`${objX},${oBot} ${detX},${Math.min(tb, bb)} ${detX},${Math.max(tb, bb)}`} className="hm-svg-penumbra" />
        {/* umbra */}
        <polygon points={`${objX},${oTop} ${objX},${oBot} ${detX},${Math.min(tb, bb)} ${detX},${Math.max(tt, bt)}`} className="hm-svg-umbra" />
        {/* rays */}
        {[[sTop, oTop, tt], [sBot, oTop, bt], [sTop, oBot, tb], [sBot, oBot, bb]].map(([ys, yo, yd], i) => (
          <line key={i} x1={srcX} y1={ys} x2={detX} y2={yd} className="hm-svg-ray" data-mid={yo} />
        ))}
        {/* focal spot, object, detector */}
        <line x1={srcX} y1={sTop} x2={srcX} y2={sBot} className="hm-svg-focal" />
        <rect x={objX - 4} y={oTop} width={8} height={objHalf * 2} className="hm-svg-object" rx={2} />
        <line x1={detX} y1={20} x2={detX} y2={H - 30} className="hm-svg-detector" />
        <text x={srcX} y={H - 12} className="hm-svg-note" textAnchor="middle">focal spot</text>
        <text x={objX} y={H - 12} className="hm-svg-note" textAnchor="middle">object</text>
        <text x={detX} y={H - 12} className="hm-svg-note" textAnchor="middle">detector</text>
      </svg>
      <div className="hm-demo-reads">
        <div><span>Magnification</span><strong>×{mag.toFixed(2)}</strong></div>
        <div><span>Penumbra</span><strong>{penumbra.toFixed(2)} mm</strong></div>
        <div><span>OID</span><strong>{SID - sod} cm</strong></div>
      </div>
      <div className="hm-demo-ctls">
        <Ctl label="Focal spot" value={`${focal.toFixed(1)} mm`} min={0.3} max={2} step={0.1} onChange={setFocal} />
        <Ctl label="Source–object distance" value={`${sod} cm`} min={40} max={90} step={1} onChange={setSod} />
      </div>
      <p className="hm-demo-note">Magnification is pure geometry — SID / SOD. The focal spot changes only the blur.</p>
      <Link to="/visual-lab" className="hm-demo-link">Open the full geometry lab →</Link>
    </article>
  )
}

/* ------------------------------------------------------------------ */
/*  MRI contrast                                                       */
/* ------------------------------------------------------------------ */

const MRI_TISSUES = [
  { name: 'Fat', t1: 260, t2: 80, pd: 0.95 },
  { name: 'White matter', t1: 780, t2: 90, pd: 0.77 },
  { name: 'Grey matter', t1: 920, t2: 100, pd: 0.85 },
  { name: 'CSF', t1: 4000, t2: 2000, pd: 1 },
]

const MRI_PRESETS = {
  'T1': { tr: 500, te: 14, ir: false, ti: 0 },
  'PD': { tr: 4000, te: 15, ir: false, ti: 0 },
  'T2': { tr: 4000, te: 100, ir: false, ti: 0 },
  'FLAIR': { tr: 9000, te: 110, ir: true, ti: 2400 },
  'STIR': { tr: 4500, te: 60, ir: true, ti: 160 },
}

export function MriContrastDemo() {
  const [tr, setTr] = useState(500)
  const [te, setTe] = useState(14)
  const [ir, setIr] = useState(false)
  const [ti, setTi] = useState(160)

  const signals = MRI_TISSUES.map(t => {
    const e1 = Math.exp(-tr / t.t1)
    const long = ir ? Math.abs(1 - 2 * Math.exp(-ti / t.t1) + e1) : 1 - e1
    return { ...t, s: t.pd * long * Math.exp(-te / t.t2) }
  })
  const maxS = Math.max(...signals.map(s => s.s), 0.001)

  const weighting = ir
    ? ti < 400 ? 'STIR — fat suppressed' : ti > 1500 ? 'FLAIR — CSF suppressed' : 'Inversion recovery'
    : tr < 1000 && te < 40 ? 'T1-weighted'
    : tr >= 2000 && te >= 80 ? 'T2-weighted'
    : tr >= 2000 && te < 40 ? 'Proton density'
    : 'Mixed weighting'

  return (
    <article className="hm-demo">
      <header><h3>MRI contrast</h3><span className="hm-demo-tag hm-acc-mri">Live model</span></header>
      <div className="hm-mri-tiles" role="img" aria-label={`Simulated tissue brightness, ${weighting}`}>
        {signals.map(t => {
          const g = Math.round(235 * (t.s / maxS))
          return (
            <figure key={t.name}>
              <div style={{ background: `rgb(${g},${g},${Math.round(g * 0.98)})` }} />
              <figcaption>{t.name}</figcaption>
            </figure>
          )
        })}
      </div>
      <p className="hm-mri-weight">{weighting}</p>
      <div className="hm-demo-ctls">
        <Ctl label="TR" value={`${tr} ms`} min={100} max={9000} step={50} onChange={setTr} />
        <Ctl label="TE" value={`${te} ms`} min={5} max={200} step={5} onChange={setTe} />
        <Ctl label="TI" value={`${ti} ms`} min={50} max={3000} step={10} onChange={setTi} disabled={!ir} />
        <div className="hm-chip-row" role="group" aria-label="Sequence presets">
          {(Object.keys(MRI_PRESETS) as (keyof typeof MRI_PRESETS)[]).map(k => {
            const pr = MRI_PRESETS[k]
            const active = tr === pr.tr && te === pr.te && ir === pr.ir && (!pr.ir || ti === pr.ti)
            return (
              <button
                key={k} className={active ? 'hm-chip on' : 'hm-chip'}
                onClick={() => { setTr(pr.tr); setTe(pr.te); setIr(pr.ir); if (pr.ir) setTi(pr.ti) }}
              >{k}</button>
            )
          })}
        </div>
      </div>
      <p className="hm-demo-note">TR controls T1 weighting. TE controls T2 weighting. TI chooses what an inversion recovery sequence nulls.</p>
      <Link to="/mri-lab/laboratory" className="hm-demo-link">Open the free sequence laboratory →</Link>
    </article>
  )
}

/* ------------------------------------------------------------------ */
/*  Sample question                                                    */
/* ------------------------------------------------------------------ */

const QUESTION = {
  topic: 'X-ray production',
  stem: 'Which change increases the maximum photon energy of an X-ray beam?',
  options: [
    'Increasing the tube current (mA)',
    'Increasing the tube potential (kVp)',
    'Adding 2 mm of aluminium filtration',
    'Selecting a larger focal spot',
  ],
  correct: 1,
  explanation: 'Maximum photon energy is set by the tube potential: an electron crossing the tube can hand at most its full kinetic energy — kVp keV — to a single bremsstrahlung photon. mA scales photon quantity without touching the maximum, filtration removes low energies (raising the mean, not the maximum), and focal spot size affects geometric sharpness, not the spectrum.',
}

export function SampleQuestion() {
  const [picked, setPicked] = useState<number | null>(null)
  const answered = picked !== null

  return (
    <div className="hm-question">
      <div className="hm-q-meta"><span>{QUESTION.topic}</span><span>Single best answer</span></div>
      <p className="hm-q-stem">{QUESTION.stem}</p>
      <div className="hm-q-options">
        {QUESTION.options.map((opt, i) => {
          let cls = 'hm-q-opt'
          if (answered && i === QUESTION.correct) cls += ' is-correct'
          else if (answered && i === picked) cls += ' is-wrong'
          return (
            <button key={opt} className={cls} disabled={answered} onClick={() => setPicked(i)}>
              <span>{String.fromCharCode(65 + i)}</span>
              <p>{opt}</p>
            </button>
          )
        })}
      </div>
      {answered && (
        <div className="hm-q-explain" role="status">
          <strong>{picked === QUESTION.correct ? 'Correct.' : 'Not quite — the answer is B.'}</strong>
          <p>{QUESTION.explanation}</p>
          <div className="hm-q-after">
            <button className="hm-btn hm-btn-ghost hm-btn-sm" onClick={() => setPicked(null)}>Try again</button>
            <Link className="hm-btn hm-btn-line hm-btn-sm" to="/question-bank">Continue into the Question Bank</Link>
          </div>
        </div>
      )}
    </div>
  )
}
