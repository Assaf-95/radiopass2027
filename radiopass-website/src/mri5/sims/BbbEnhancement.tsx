/**
 * 5.18 — enhancement is delivery.
 *
 * An agent that shortens T1 only shortens the T1 of water it can reach. Three
 * voxels are fed by exactly the same bolus here and behave completely
 * differently, and the difference is anatomy rather than chemistry:
 *
 *   - normal brain, where tight junctions keep the chelate inside the capillary,
 *     so the only thing that changes is the small fraction of the voxel that is
 *     blood;
 *   - a lesion that has broken the barrier, where the chelate leaves the vessel
 *     and accumulates in the interstitium;
 *   - tissue outside the brain, whose capillaries never had tight junctions, so
 *     it leaks freely and enhances as a matter of course.
 *
 * The kinetics are the standard extended Tofts model, integrated numerically:
 *
 *      dC_e/dt = K^trans·C_p(t) − (K^trans/v_e)·C_e(t)
 *
 * and the signal is the same spin-echo expression used throughout the section,
 * with 1/T1 and 1/T2 each raised by relaxivity times the local concentration.
 *
 * The two pools are then kept apart rather than averaged into one voxel
 * concentration — blood inside the vessel, everything outside it, each given its
 * own signal and combined by volume:
 *
 *      S = v_b·S(blood at C_p·(1 − Hct)) + (1 − v_b)·S(tissue at C_e/(1 − v_b))
 *
 * Averaging instead would let four percent blood shorten the T1 of the whole
 * voxel, which is exactly what the tight junctions are there to forbid: normal
 * brain would then draw a first-pass rise more than half the size of the
 * lesion's, and the diagram would refute the concept it is here to teach.
 *
 * The plasma curve is a bolus: a rapid rise on arrival, then a biexponential
 * fall as the agent redistributes into the extracellular space and is cleared.
 *
 * Time is compressed: five real minutes are drawn in fourteen seconds.
 */

import { useMemo, useState } from 'react'

import { C, clamp, mulberry32, rgba } from '../../home/fx'
import { Readout, Sim, Slider, type SimDraw } from '../Sim'

/* ------------------------------------------------------------------ *
 * Physics
 * ------------------------------------------------------------------ */

/** Extracellular chelate at 1.5 T. */
const R1 = 4.0
const R2 = 5.0
const TR_MS = 500
const TE_MS = 10

/** Blood at 1.5 T, ms — the same values the relaxivity concept is quoted at. */
const BLOOD_T1_MS = 1440
const BLOOD_T2_MS = 200

/**
 * Haematocrit. The chelate is confined to plasma, so the part of the voxel that
 * actually carries agent is the blood volume less the red cells: v_p = v_b·(1 −
 * Hct). Red cell water exchanges with plasma in milliseconds, so blood still
 * relaxes as one pool — at that diluted concentration.
 */
const HCT = 0.45

/** Seconds of real time covered by the timeline. */
const SPAN_S = 300
const DT = 0.5
const N = Math.round(SPAN_S / DT) + 1

/** Arrival of the bolus at the tissue, seconds after injection. */
const ARRIVAL = 10

/**
 * Plasma concentration, mM. Rise over a few seconds on arrival, then a fast
 * redistribution term and a slow clearance term. Peak is a few millimolar and
 * the plateau after five minutes is a fraction of a millimolar, which is what a
 * standard dose of about 0.1 mmol/kg produces.
 */
export function plasmaAt(tS: number): number {
  if (tS <= ARRIVAL) return 0
  const u = tS - ARRIVAL
  return 5.3 * (1 - Math.exp(-u / 4)) * (0.86 * Math.exp(-u / 45) + 0.14 * Math.exp(-u / 2400))
}

export type Compartment = {
  id: string
  title: string
  note: string
  /** Blood volume fraction of the voxel. Plasma is this less the red cells. */
  vb: number
  /** Extravascular extracellular volume fraction. */
  ve: number
  /** Transfer constant, per minute. Zero is an intact barrier. */
  ktrans: number
  /** Native relaxation times, ms at 1.5 T. */
  t1: number
  t2: number
}

/** Spin-echo signal for a voxel at concentration `c` mM. */
export function signalAt(c: number, t1Ms: number, t2Ms: number): number {
  const t1 = 1000 / (1000 / t1Ms + R1 * c)
  const t2 = 1000 / (1000 / t2Ms + R2 * c)
  return (1 - Math.exp(-TR_MS / t1)) * Math.exp(-TE_MS / t2)
}

/**
 * Signal from one voxel, given the plasma concentration and the leaked
 * concentration at this instant.
 *
 * Two compartments, not one average. The intravascular agent only ever sees the
 * water inside the vessel, so it gets the blood volume and blood's own T1 and
 * T2; everything outside the vessel sees only what has leaked, spread through
 * the (1 − v_b) of the voxel that is tissue. With an intact barrier C_e stays at
 * zero and all that is left is a few percent of blood brightening — the small
 * transient blush, and nothing more.
 */
function voxelSignal(k: Compartment, cp: number, cE: number): number {
  const ev = 1 - k.vb
  return (
    k.vb * signalAt(cp * (1 - HCT), BLOOD_T1_MS, BLOOD_T2_MS) +
    ev * signalAt(cE / ev, k.t1, k.t2)
  )
}

/** Extravascular concentration over the whole timeline, by Euler integration. */
function tissueCurve(k: Compartment): Float64Array {
  const out = new Float64Array(N)
  const kt = k.ktrans / 60 // per minute → per second
  const kep = k.ve > 0 ? kt / k.ve : 0
  let ce = 0
  for (let i = 0; i < N; i += 1) {
    const tS = i * DT
    out[i] = ce
    ce += (kt * plasmaAt(tS) - kep * ce) * DT
    if (ce < 0) ce = 0
  }
  return out
}

/* ------------------------------------------------------------------ *
 * Timeline
 * ------------------------------------------------------------------ */

const DURATION = 14
const STILL_T = 10.5
const realAt = (t: number) => (t / DURATION) * SPAN_S
const wallAt = (tS: number) => (tS / SPAN_S) * DURATION

const MRIC = C.mri
const FIELDC = C.xray
const INK = C.ink
const MUT = C.mut

/* ------------------------------------------------------------------ *
 * Deterministic particle fields
 * ------------------------------------------------------------------ */

const rnd = mulberry32(0x51b8)
const LUMEN = Array.from({ length: 22 }, () => ({ u: rnd(), v: rnd() * 2 - 1, s: 0.05 + rnd() * 0.06 }))
const TISSUE = Array.from({ length: 26 }, () => ({
  u: 0.06 + rnd() * 0.88,
  v: (rnd() * 2 - 1),
  ph: rnd() * Math.PI * 2,
}))

/* ------------------------------------------------------------------ *
 * Drawing
 * ------------------------------------------------------------------ */

function drawRow(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  k: Compartment,
  ce: Float64Array,
  tWall: number,
  yMaxPct: number,
  gMax: number,
) {
  const tS = realAt(tWall)
  const cp = plasmaAt(tS)
  const cE = ce[clamp(Math.round(tS / DT), 0, N - 1)]
  const sNow = voxelSignal(k, cp, cE)
  const sPre = voxelSignal(k, 0, 0)
  const pct = (sNow / sPre - 1) * 100
  const leaky = k.ktrans > 0.001

  ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'

  const pad = 10
  const curveW = Math.max(118, (w - pad * 2) * 0.3)
  const patchW = 78
  const schemW = Math.max(110, w - pad * 2 - curveW - patchW - 18)
  const schemX = x + pad
  const patchX = schemX + schemW + 10
  const curveX = patchX + patchW + 8

  /* ---------------- title ---------------- */
  ctx.textAlign = 'left'
  ctx.fillStyle = rgba(INK, 0.92)
  ctx.fillText(k.title, schemX, y + 11)
  ctx.fillStyle = rgba(MUT, 0.7)
  ctx.fillText(k.note, schemX + ctx.measureText(k.title).width + 10, y + 11)

  /* ---------------- schematic ---------------- */
  const top = y + 22
  const bh = Math.max(30, h - 32)
  const midY = top + bh / 2
  const tubeH = Math.max(12, bh * 0.3)

  ctx.fillStyle = rgba(INK, 0.028)
  ctx.fillRect(schemX, top, schemW, bh)
  ctx.strokeStyle = rgba(INK, 0.1)
  ctx.lineWidth = 1
  ctx.strokeRect(schemX + 0.5, top + 0.5, schemW - 1, bh - 1)

  // Interstitium on the left, transfer constant on the right — but only when
  // the two genuinely fit side by side.
  const leftTag = 'interstitium'
  const rightTag = leaky ? `K^trans ${k.ktrans.toFixed(2)}/min` : 'K^trans 0'
  ctx.fillStyle = rgba(MUT, 0.5)
  ctx.textAlign = 'left'
  ctx.fillText(leftTag, schemX + 6, top + 10)
  const fits = ctx.measureText(leftTag).width + ctx.measureText(rightTag).width + 24 < schemW
  if (fits) {
    ctx.textAlign = 'right'
    ctx.fillStyle = rgba(MUT, 0.55)
    ctx.fillText(rightTag, schemX + schemW - 6, top + 10)
  }

  // the capillary
  ctx.fillStyle = rgba(FIELDC, 0.07)
  ctx.fillRect(schemX, midY - tubeH / 2, schemW, tubeH)
  ctx.strokeStyle = rgba(FIELDC, 0.5)
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(schemX, midY - tubeH / 2); ctx.lineTo(schemX + schemW, midY - tubeH / 2)
  ctx.moveTo(schemX, midY + tubeH / 2); ctx.lineTo(schemX + schemW, midY + tubeH / 2)
  ctx.stroke()

  // endothelial junctions: solid bars where the barrier holds, gaps where it does not
  const junctions = 7
  for (let i = 1; i < junctions; i += 1) {
    const jx = schemX + (i / junctions) * schemW
    const open = leaky && i % 2 === 1
    ctx.strokeStyle = rgba(open ? C.amber : C.us, open ? 0.35 : 0.85)
    ctx.lineWidth = open ? 1 : 2
    ctx.setLineDash(open ? [2, 3] : [])
    ctx.beginPath()
    ctx.moveTo(jx, midY - tubeH / 2 - 3)
    ctx.lineTo(jx, midY - tubeH / 2 + 3)
    ctx.moveTo(jx, midY + tubeH / 2 - 3)
    ctx.lineTo(jx, midY + tubeH / 2 + 3)
    ctx.stroke()
  }
  ctx.setLineDash([])

  // chelate inside the lumen — count follows plasma concentration
  const nLumen = Math.round(clamp(cp / 4.2) * LUMEN.length)
  for (let i = 0; i < nLumen; i += 1) {
    const p = LUMEN[i]
    const u = (p.u + tWall * p.s) % 1
    ctx.fillStyle = rgba(MRIC, 0.9)
    ctx.beginPath()
    ctx.arc(schemX + u * schemW, midY + p.v * (tubeH * 0.3), 2.4, 0, Math.PI * 2)
    ctx.fill()
  }

  // chelate that has crossed into the interstitium
  const nOut = Math.round(clamp(cE / 0.7) * TISSUE.length)
  for (let i = 0; i < nOut; i += 1) {
    const p = TISSUE[i]
    const side = i % 2 === 0 ? -1 : 1
    const spread = (bh / 2 - tubeH / 2 - 8)
    const py = midY + side * (tubeH / 2 + 7 + Math.abs(p.v) * spread) + Math.sin(tWall * 0.7 + p.ph) * 2
    ctx.fillStyle = rgba(MRIC, 0.75)
    ctx.beginPath()
    ctx.arc(schemX + p.u * schemW, py, 2.2, 0, Math.PI * 2)
    ctx.fill()
  }

  /* ---------------- the two voxels ---------------- */
  const box = Math.min(34, bh * 0.5)
  const boxY = midY - box / 2
  const shade = (s: number) => rgba(INK, 0.05 + clamp(s / gMax) * 0.95)

  ctx.fillStyle = shade(sPre)
  ctx.fillRect(patchX, boxY, box, box)
  ctx.fillStyle = shade(sNow)
  ctx.fillRect(patchX + box + 6, boxY, box, box)
  ctx.strokeStyle = rgba(INK, 0.2)
  ctx.lineWidth = 1
  ctx.strokeRect(patchX + 0.5, boxY + 0.5, box - 1, box - 1)
  ctx.strokeStyle = rgba(MRIC, 0.8)
  ctx.strokeRect(patchX + box + 6.5, boxY + 0.5, box - 1, box - 1)

  ctx.textAlign = 'center'
  ctx.fillStyle = rgba(MUT, 0.6)
  ctx.fillText('pre', patchX + box / 2, boxY + box + 10)
  ctx.fillText('post', patchX + box * 1.5 + 6, boxY + box + 10)

  /* ---------------- enhancement curve ---------------- */
  const cw = Math.max(60, w - (curveX - x) - pad)
  const ch = bh
  const cLeft = curveX
  const cBottom = top + ch
  const xOfT = (sec: number) => cLeft + (sec / SPAN_S) * cw
  const yOfP = (p: number) => cBottom - clamp(p / yMaxPct) * (ch - 12)

  ctx.strokeStyle = rgba(INK, 0.1)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cLeft, top); ctx.lineTo(cLeft, cBottom); ctx.lineTo(cLeft + cw, cBottom)
  ctx.stroke()

  ctx.strokeStyle = rgba(MRIC, 0.9)
  ctx.lineWidth = 1.9
  ctx.beginPath()
  for (let i = 0; i <= 90; i += 1) {
    const sec = (i / 90) * SPAN_S
    const cpi = plasmaAt(sec)
    const cei = ce[clamp(Math.round(sec / DT), 0, N - 1)]
    const p = ((voxelSignal(k, cpi, cei) / sPre) - 1) * 100
    const px = xOfT(sec)
    const py = yOfP(p)
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  }
  ctx.stroke()

  const phx = xOfT(tS)
  ctx.strokeStyle = rgba(INK, 0.3)
  ctx.setLineDash([2, 3])
  ctx.beginPath(); ctx.moveTo(phx, top); ctx.lineTo(phx, cBottom); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = rgba(INK, 1)
  ctx.beginPath(); ctx.arc(phx, yOfP(pct), 3.6, 0, Math.PI * 2); ctx.fill()

  ctx.textAlign = 'right'
  ctx.fillStyle = rgba(INK, 0.92)
  ctx.fillText(`${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`, cLeft + cw, top + 8)
  ctx.textAlign = 'left'
  ctx.fillStyle = rgba(MUT, 0.5)
  ctx.fillText('signal change', cLeft + 4, top + 8)
}

/* ------------------------------------------------------------------ *
 * The component
 * ------------------------------------------------------------------ */

export function BbbEnhancement() {
  const [ktrans, setKtrans] = useState(0.15)
  const [vbBrain, setVbBrain] = useState(4)

  const compartments = useMemo<Compartment[]>(() => [
    {
      id: 'normal',
      title: 'Normal brain',
      note: 'tight junctions intact',
      vb: vbBrain / 100,
      ve: 0.2,
      ktrans: 0,
      t1: 1000,
      t2: 90,
    },
    {
      id: 'lesion',
      title: 'Lesion',
      note: 'barrier broken',
      vb: 0.05,
      ve: 0.3,
      ktrans,
      t1: 1000,
      t2: 90,
    },
    {
      id: 'body',
      title: 'Outside the brain',
      note: 'no barrier to begin with',
      vb: 0.05,
      ve: 0.2,
      ktrans: 0.25,
      t1: 870,
      t2: 45,
    },
  ], [ktrans, vbBrain])

  const curves = useMemo(() => compartments.map(tissueCurve), [compartments])

  /** One shared vertical scale, so the three rows can be compared by eye. */
  const { yMaxPct, gMax } = useMemo(() => {
    let maxPct = 20
    let maxS = 0
    compartments.forEach((k, idx) => {
      const sPre = voxelSignal(k, 0, 0)
      maxS = Math.max(maxS, sPre)
      for (let i = 0; i < N; i += 8) {
        const s = voxelSignal(k, plasmaAt(i * DT), curves[idx][i])
        maxS = Math.max(maxS, s)
        maxPct = Math.max(maxPct, (s / sPre - 1) * 100)
      }
    })
    return { yMaxPct: maxPct * 1.12, gMax: maxS * 1.02 }
  }, [compartments, curves])

  const steps = useMemo(() => [
    { id: 'pre', at: 0, label: 'Before the injection — every voxel at its native T1' },
    { id: 'arrive', at: wallAt(ARRIVAL + 4), label: 'First pass — the agent is still inside the capillaries' },
    { id: 'early', at: wallAt(60), label: 'One minute — leakage has begun where there is nothing to stop it' },
    { id: 'late', at: wallAt(180), label: 'Three minutes — the leaked agent has accumulated' },
    { id: 'end', at: wallAt(285), label: 'Five minutes — plasma is falling, the interstitium is not' },
  ], [])

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    const t = frame.still ? STILL_T : frame.t
    const rowH = h / compartments.length
    compartments.forEach((k, i) => {
      if (i > 0) {
        ctx.strokeStyle = rgba(INK, 0.07)
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(14, i * rowH); ctx.lineTo(w - 14, i * rowH); ctx.stroke()
      }
      drawRow(ctx, 0, i * rowH, w, rowH, k, curves[i], t, yMaxPct, gMax)
    })
  }, [compartments, curves, yMaxPct, gMax])

  const caption = useMemo(() => (frame: { t: number; still: boolean }) => {
    const t = frame.still ? STILL_T : frame.t
    const tS = realAt(t)
    const cp = plasmaAt(tS)
    const idx = clamp(Math.round(tS / DT), 0, N - 1)
    const pctOf = (i: number) => {
      const k = compartments[i]
      return ((voxelSignal(k, cp, curves[i][idx]) / voxelSignal(k, 0, 0)) - 1) * 100
    }
    if (tS < ARRIVAL) {
      return `${tS.toFixed(0)} s after injection. The bolus has not arrived: all three voxels sit at their native T1, and a pre-contrast series taken now is the comparison every later image is read against.`
    }
    // During the first pass every row is still mostly a vascular blush, so the
    // sentence about agent held in tissue is only earned once the leaked term
    // outweighs the intravascular one.
    const names = ['normal brain', 'the lesion', 'tissue outside the brain']
    const leaked = [1, 2].filter((i) => curves[i][idx] > compartments[i].vb * (1 - HCT) * cp)
    const held = leaked.length === 0
      ? 'All three are still showing the same thing: the bolus inside their vessels.'
      : `Normal brain changes only while the agent is in its vessels; ${
        leaked.length === 2 ? 'the other two hold' : `${names[leaked[0]]} holds`
      } signal because the agent is now in the tissue itself.`
    return `${tS.toFixed(0)} s after injection, plasma at ${cp.toFixed(2)} mM. Normal brain ${pctOf(0) >= 0 ? '+' : ''}${pctOf(0).toFixed(0)}%, the lesion ${pctOf(1) >= 0 ? '+' : ''}${pctOf(1).toFixed(0)}%, tissue outside the brain ${pctOf(2) >= 0 ? '+' : ''}${pctOf(2).toFixed(0)}%. ${held}`
  }, [compartments, curves])

  return (
    <Sim
      label="The same bolus reaching three voxels: normal brain with an intact barrier, a lesion with a broken barrier, and tissue outside the brain, each with its capillary, its voxel shading and its signal-versus-time curve"
      draw={draw}
      duration={DURATION}
      steps={steps}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="Dose" value="≈ 0.1 mmol/kg" tone="plain" />
          <Readout name="Peak plasma" value={`${plasmaAt(ARRIVAL + 12).toFixed(1)} mM`} tone="xy" />
          <Readout name="Normal brain K^trans" value="0 /min" tone="z" />
          <Readout name="Lesion K^trans" value={`${ktrans.toFixed(2)} /min`} tone="rf" />
          <Readout name="Sequence" value={`SE TR ${TR_MS} / TE ${TE_MS}`} tone="plain" />
        </>
      }
      controls={
        <>
          <Slider
            label="Lesion K^trans"
            value={ktrans}
            min={0}
            max={0.5}
            step={0.01}
            unit="/min"
            onChange={setKtrans}
            hint="Take it to zero and the lesion behaves exactly like normal brain — a barrier that holds gives no enhancement, however vascular the tissue is."
          />
          <Slider
            label="Blood volume of normal brain"
            value={vbBrain}
            min={1}
            max={8}
            step={0.5}
            unit="%"
            onChange={setVbBrain}
            hint="With the barrier intact, this is the only part of the voxel the agent ever reaches — and only its plasma, a little over half of it once the red cells are taken out, carries any chelate. It therefore sets the size of the transient first-pass blush and nothing else."
          />
        </>
      }
    />
  )
}
