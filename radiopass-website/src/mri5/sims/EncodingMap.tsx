/**
 * 5.6 — the map for 5.7 to 5.10.
 *
 * One instrument, three moments. The top half is a timing diagram of a single
 * TR, revealed a row at a time; the bottom half is what is known about position
 * after each of those moments. Read together they make the section's claim
 * visible: slice selection, phase encoding and frequency encoding are the same
 * gradient hardware doing the same thing — making Larmor frequency depend on
 * position — switched on at three different times.
 *
 * The drawn waveform areas are the physics, not decoration:
 *
 *   • the slice-select rephasing lobe has exactly half the area of the lobe
 *     that ran during the RF pulse, because a spin only saw half of it;
 *   • the readout dephasing lobe has exactly half the area of the readout lobe,
 *     which is why the echo peaks at the centre of the readout and nowhere else;
 *   • the phase-encoding lobe is drawn at an amplitude proportional to the step
 *     index k, with the whole ladder shown faintly behind it.
 *
 * The row phases are the discrete Fourier kernel, φ(row r) = 2π·k·r/N, which is
 * what a phase-encoding step is for. The echo height is the true magnitude of
 * that k-space line, |Σ ρ·exp(i·2π·k·r/N)|, so stepping away from k = 0 makes
 * the signal collapse — the fact 5.10 is built on.
 */

import { useMemo, useState } from 'react'

import { C, clamp, rgba } from '../../home/fx'
import { Readout, Sim, Slider, type SimDraw, type SimFrame } from '../Sim'
import { GAMMA_BAR } from './SliceSelection'
import { G_READ, LETTERS, N, RHO, VOX_MM, colHz } from './LocalisationProblem'

const MRI = C.mri
const FIELD = C.xray
const INK = C.ink
const MUT = C.mut

/**
 * Kept short on purpose: the host draws these in a chip over the top-left of the
 * canvas, and a label long enough to wrap would sit on the RF row on a phone.
 */
const STEPS = [
  { id: 'problem', label: 'One signal, and no address in it', at: 0 },
  { id: 'slice', label: 'G_z during the RF pulse — z is chosen', at: 2.2 },
  { id: 'phase', label: 'G_y before the readout — y into phase', at: 4.4 },
  { id: 'freq', label: 'G_x during the readout — x into frequency', at: 6.6 },
  { id: 'ft', label: 'Fourier transform reads both back', at: 8.8 },
]
const DURATION = 11.5

const stageAt = (t: number) => {
  let s = 0
  for (let i = 0; i < STEPS.length; i += 1) if (t >= STEPS[i].at) s = i
  return s
}

/** Rows of the timing diagram. */
const RF = 0
const GZ = 1
const GY = 2
const GX = 3
const SIG = 4

/** Phase written into row r by phase-encoding step k: the DFT kernel. */
const rowPhase = (r: number, k: number) => (2 * Math.PI * k * r) / N

/**
 * Gradient area needed for step k, in T·s/m.
 *   Δφ between adjacent rows = 2π·γ̄·(G_y·τ)·Δy = 2π·k/N
 */
const phaseArea = (k: number) => k / (N * GAMMA_BAR * 1e6 * (VOX_MM / 1000))

export function EncodingMap() {
  const [k, setK] = useState(1)

  /** True magnitude of this k-space line, relative to the centre line. */
  const echoFrac = useMemo(() => {
    let re = 0
    let im = 0
    for (let i = 0; i < RHO.length; i += 1) {
      const th = rowPhase(Math.floor(i / N), k)
      re += RHO[i] * Math.cos(th)
      im += RHO[i] * Math.sin(th)
    }
    const total = RHO.reduce((a, b) => a + b, 0)
    return Math.hypot(re, im) / total
  }, [k])

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    const stage = frame.still ? STEPS.length - 1 : stageAt(frame.t)
    const reveal = (s: number) => (frame.still ? 1 : clamp((frame.t - STEPS[s].at) / 0.7))

    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'

    /* ---------------- the timing diagram ---------------- */
    const padL = 66
    const plotW = Math.max(120, w - padL - 16)
    const wide = plotW >= 420
    const uOf = (u: number) => padL + u * plotW

    const bandH = Math.max(150, Math.min(300, h * 0.55))
    // The host's step chip sits over the top-left corner; the first row starts
    // below it, and lower still where the chip is likely to take two lines.
    const rowTop = w >= 560 ? 38 : 50
    const rowH = (bandH - rowTop - 4) / 5
    const rowY = (i: number) => rowTop + rowH * (i + 0.5)
    const hh = rowH * 0.3

    // The three gradient rows are one instrument; the rule says so without a
    // word, and the row labels below name the three moments.
    ctx.strokeStyle = rgba(FIELD, 0.4)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(6, rowY(GZ) - rowH * 0.45)
    ctx.lineTo(6, rowY(GX) + rowH * 0.45)
    ctx.stroke()

    const ROWS: { i: number; name: string; colour: string; at: number }[] = [
      { i: RF, name: 'RF', colour: MRI, at: 1 },
      { i: GZ, name: 'G_z  slice', colour: FIELD, at: 1 },
      { i: GY, name: 'G_y  phase', colour: FIELD, at: 2 },
      { i: GX, name: 'G_x  read', colour: FIELD, at: 3 },
      { i: SIG, name: 'signal', colour: MRI, at: 3 },
    ]

    for (const row of ROWS) {
      const a = 0.1 + 0.9 * reveal(row.at)
      ctx.strokeStyle = rgba(INK, 0.07 * (0.4 + a))
      ctx.lineWidth = 1
      ctx.setLineDash([2, 4])
      ctx.beginPath()
      ctx.moveTo(padL, rowY(row.i))
      ctx.lineTo(padL + plotW, rowY(row.i))
      ctx.stroke()
      ctx.setLineDash([])

      ctx.textAlign = 'right'
      ctx.fillStyle = rgba(row.colour, 0.35 + 0.55 * a)
      ctx.fillText(row.name, padL - 8, rowY(row.i))
    }

    /** A rectangular gradient lobe; its area is the quantity that matters. */
    const lobe = (u0: number, u1: number, amp: number, row: number, alpha: number, solid: boolean) => {
      const y = rowY(row)
      const yTop = y - amp * hh
      ctx.beginPath()
      ctx.moveTo(uOf(u0), y)
      ctx.lineTo(uOf(u0), yTop)
      ctx.lineTo(uOf(u1), yTop)
      ctx.lineTo(uOf(u1), y)
      if (solid) {
        ctx.fillStyle = rgba(FIELD, alpha * 0.18)
        ctx.fill()
      }
      ctx.strokeStyle = rgba(FIELD, alpha * (solid ? 0.9 : 0.28))
      ctx.lineWidth = solid ? 1.6 : 1
      ctx.setLineDash(solid ? [] : [3, 3])
      ctx.stroke()
      ctx.setLineDash([])
    }

    /* RF: a sinc-shaped, frequency-selective pulse. */
    const aRf = reveal(1)
    ctx.strokeStyle = rgba(MRI, 0.2 + 0.75 * aRf)
    ctx.lineWidth = 1.6
    ctx.beginPath()
    for (let i = 0; i <= 140; i += 1) {
      const u = 0.06 + (i / 140) * 0.14
      const s = ((u - 0.13) / 0.07) * 2.6
      const env = Math.abs(s) < 1e-6 ? 1 : Math.sin(Math.PI * s) / (Math.PI * s)
      const v = env * Math.cos((2 * Math.PI * 6 * (u - 0.13)) / 0.14)
      const x = uOf(u)
      const y = rowY(RF) - v * hh
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.textAlign = 'right'
    ctx.fillStyle = rgba(MUT, 0.3 + 0.4 * aRf)
    ctx.fillText(wide ? 'one TR of an imaging sequence' : 'one TR', uOf(1), rowY(RF))

    /* G_z: on through the pulse, then a rephasing lobe of exactly half the area. */
    const aZ = reveal(1)
    // 0.16 × 1 during the pulse; 0.08 × 1 back the other way. Half the area,
    // which is the only thing about the second lobe that matters.
    lobe(0.05, 0.21, 1, GZ, aZ, true)
    lobe(0.21, 0.29, -1, GZ, aZ, true)
    ctx.textAlign = 'right'
    ctx.fillStyle = rgba(INK, 0.25 + 0.5 * aZ)
    ctx.fillText(wide ? 'on during excitation — chooses z' : 'chooses z', uOf(1), rowY(GZ))

    /* G_y: the ladder of phase-encoding steps, one of which is used per TR. */
    const aY = reveal(2)
    for (const kk of [-2, -1, 0, 1]) {
      if (kk === k) continue
      lobe(0.3, 0.4, kk / 2, GY, aY, false)
    }
    lobe(0.3, 0.4, k / 2, GY, aY, true)
    ctx.textAlign = 'right'
    ctx.fillStyle = rgba(INK, 0.25 + 0.5 * aY)
    ctx.fillText(wide ? 'on and off before the readout — writes y into phase' : 'writes y into phase', uOf(1), rowY(GY))

    /* G_x: a dephasing lobe of half the readout area, then the readout itself. */
    const aX = reveal(3)
    lobe(0.29, 0.46, -1, GX, aX, true)
    lobe(0.46, 0.8, 1, GX, aX, true)
    ctx.textAlign = 'center'
    ctx.fillStyle = rgba(INK, 0.25 + 0.5 * aX)
    ctx.fillText(
      wide ? 'on during the readout — writes x into frequency' : 'writes x into frequency',
      uOf(0.63), rowY(GX) - hh - 9,
    )

    /* Signal: an echo at the centre of the readout, at this line's true height. */
    const echoCurve = (amp: number, colour: string, alpha: number, dash: boolean) => {
      ctx.strokeStyle = rgba(colour, alpha)
      ctx.lineWidth = dash ? 1 : 1.7
      ctx.setLineDash(dash ? [3, 3] : [])
      ctx.beginPath()
      for (let i = 0; i <= 160; i += 1) {
        const u = 0.46 + (i / 160) * 0.34
        const env = Math.exp(-Math.pow((u - 0.63) / 0.062, 2))
        const v = amp * env * Math.cos(2 * Math.PI * 19 * (u - 0.63))
        const x = uOf(u)
        const y = rowY(SIG) - v * hh
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }
    const aS = reveal(3)
    echoCurve(1, MUT, 0.1 + 0.25 * aS, true)
    echoCurve(echoFrac, MRI, 0.2 + 0.75 * aS, false)
    ctx.textAlign = 'right'
    ctx.fillStyle = rgba(MRI, 0.2 + 0.7 * reveal(4))
    ctx.fillText(wide ? '→ Fourier transform' : '→ FT', uOf(1), rowY(SIG))

    /* ---------------- what is known about position ---------------- */
    const botTop = bandH + 6
    const botH = Math.max(96, h - botTop - 8)
    const zx = 10
    const zw = Math.min(84, w * 0.2)
    const gx0 = zx + zw + 44
    const cell = Math.floor(Math.min((w - gx0 - 14) / N, (botH - 46) / N))
    const gy0 = botTop + 34

    /** The worked-example key only appears where there is genuinely room. */
    const addressX = gx0 + cell * N + 28
    const showKey = w - addressX > 190

    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(MUT, 0.8)
    ctx.fillText(wide ? 'ALONG z' : 'z', zx, botTop + 10)
    ctx.fillText('INSIDE THE SLICE', gx0 - 34, botTop + 10)

    /* the z stack: five candidate slices, one of them excited */
    const zH = cell * N
    const sh = zH / 5
    for (let s = 0; s < 5; s += 1) {
      const y = gy0 + s * sh
      const chosen = s === 2
      const a = chosen ? reveal(1) : 1
      if (chosen && reveal(1) > 0.02) {
        ctx.fillStyle = rgba(MRI, 0.1 + 0.22 * a)
        ctx.fillRect(zx, y + 1, zw, sh - 3)
      }
      ctx.strokeStyle = chosen ? rgba(MRI, 0.35 + 0.5 * a) : rgba(INK, 0.14)
      ctx.lineWidth = 1
      ctx.setLineDash(chosen && reveal(1) > 0.02 ? [] : [2, 3])
      ctx.strokeRect(zx + 0.5, y + 1.5, zw - 1, sh - 4)
      ctx.setLineDash([])
      if (chosen && reveal(1) > 0.5) {
        ctx.textAlign = 'center'
        ctx.fillStyle = rgba(MRI, 0.95)
        ctx.fillText('excited', zx + zw / 2, y + sh / 2 - 1)
      }
    }

    /* the phase column: one arrow per row, at the phase that step k writes */
    const aPhase = reveal(2)
    if (aPhase > 0.02) {
      const px = gx0 - 21
      const rad = Math.min(12, cell * 0.34)
      for (let r = 0; r < N; r += 1) {
        const cy = gy0 + cell * (r + 0.5)
        const th = rowPhase(r, k)
        ctx.strokeStyle = rgba(INK, 0.16 * aPhase)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(px, cy, rad, 0, Math.PI * 2)
        ctx.stroke()
        ctx.strokeStyle = rgba(MRI, 0.95 * aPhase)
        ctx.lineWidth = 1.8
        ctx.beginPath()
        ctx.moveTo(px, cy)
        ctx.lineTo(px + Math.cos(th) * rad, cy - Math.sin(th) * rad)
        ctx.stroke()
      }
    }

    /* the in-plane grid */
    for (let i = 0; i < N * N; i += 1) {
      const r = Math.floor(i / N)
      const c = i % N
      const x = gx0 + c * cell
      const y = gy0 + r * cell
      const known = reveal(1)
      const imaged = reveal(4)

      if (known > 0.02) {
        // Uniform while all the scanner knows is "inside the slice"; brightness
        // becomes proton density only once both encodings have been read back.
        ctx.fillStyle = rgba(MRI, (0.09 * (1 - imaged) + (0.03 + 0.34 * RHO[i]) * imaged) * (0.3 + 0.7 * known))
        ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2)
      }
      ctx.strokeStyle = rgba(known > 0.02 ? MRI : INK, known > 0.02 ? 0.2 + 0.3 * known : 0.12)
      ctx.lineWidth = 1
      ctx.setLineDash(known > 0.02 ? [] : [2, 3])
      ctx.strokeRect(x + 1.5, y + 1.5, cell - 3, cell - 3)
      ctx.setLineDash([])

      if (stage === 0) {
        ctx.textAlign = 'center'
        ctx.fillStyle = rgba(MUT, 0.5)
        ctx.fillText('?', x + cell / 2, y + cell / 2)
      }
    }

    /* the column frequencies, once the readout gradient has been introduced */
    const aFreq = reveal(3)
    if (aFreq > 0.02) {
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(FIELD, 0.6 * aFreq)
      ctx.fillText('kHz', gx0 - 34, gy0 - 10)
      ctx.textAlign = 'center'
      ctx.fillStyle = rgba(FIELD, 0.9 * aFreq)
      for (let c = 0; c < N; c += 1) {
        const f = colHz(c) / 1000
        const text = cell >= 34 ? f.toFixed(1) : f.toFixed(0)
        ctx.fillText(text.replace('-', '−'), gx0 + cell * (c + 0.5), gy0 - 10)
      }
    }
    ctx.textAlign = 'center'
    ctx.fillStyle = rgba(MUT, 0.55)
    for (let c = 0; c < N; c += 1) {
      ctx.fillText(LETTERS[c], gx0 + cell * (c + 0.5), gy0 + cell * N + 11)
    }

    /* one voxel's finished address, assembled a line at a time */
    const kx = addressX
    if (showKey) {
      const line = (i: number, text: string, alpha: number, colour: string) => {
        if (alpha <= 0.02) return
        ctx.textAlign = 'left'
        ctx.fillStyle = rgba(colour, alpha)
        ctx.fillText(text, kx, gy0 + 6 + i * 20)
      }
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(MUT, 0.7)
      ctx.fillText('THE ADDRESS OF ONE VOXEL', kx, botTop + 10)
      // C2 — third column, second row — as the worked example.
      const exC = 2
      const exR = 1
      const degOf = (r: number) => Math.round(((rowPhase(r, k) * 180) / Math.PI + 360) % 360)
      // One step does not name a row, and at some k it does not even single one
      // out: at k = 0 every row reads 0°, and at k = −2 rows 1 and 3 share 0°
      // while rows 2 and 4 share 180°. The last line has to say which it is.
      const distinct = new Set(Array.from({ length: N }, (_, r) => degOf(r))).size === N
      line(0, `z   the slice G_z excited`, 0.75 * reveal(1), INK)
      line(1, `y   the phase G_y wrote — row ${exR + 1} is at ${degOf(exR)}°`, 0.75 * reveal(2), INK)
      line(2, `x   the frequency G_x wrote — ${LETTERS[exC]} is at ${(colHz(exC) / 1000).toFixed(1)} kHz`, 0.75 * reveal(3), INK)
      line(
        3,
        distinct
          ? `${LETTERS[exC]}${exR + 1} is named once all ${N} steps are transformed`
          : `row ${exR + 1} shares its phase — all ${N} steps needed`,
        0.95 * reveal(4),
        MRI,
      )

      if (reveal(4) > 0.02) {
        ctx.strokeStyle = rgba(MRI, 0.9 * reveal(4))
        ctx.lineWidth = 1.6
        ctx.strokeRect(gx0 + exC * cell + 0.5, gy0 + exR * cell + 0.5, cell - 1, cell - 1)
      }
    }
  }, [k, echoFrac])

  const caption = useMemo(() => (frame: SimFrame) => {
    const stage = frame.still ? STEPS.length - 1 : stageAt(frame.t)
    const phases = Array.from({ length: N }, (_, r) => `${Math.round(((rowPhase(r, k) * 180) / Math.PI + 360) % 360)}°`).join(', ')
    switch (stage) {
      case 0:
        return 'Nothing is localised yet. Every voxel in the excited volume would contribute to the same signal, and no arithmetic on that signal can say where any of it came from.'
      case 1:
        return `G_z is on while the RF pulse plays, so only the band whose Larmor frequency matches the pulse is excited. z is now known — not measured afterwards, but decided before any signal existed.`
      case 2:
        return `G_y is switched on for a moment between excitation and readout, then off. Row phases become ${phases}. The gradient has gone; the phase it wrote has not.`
      case 3:
        return `G_x is on throughout the readout, so each column precesses at its own offset: with a ${G_READ} mT/m gradient the outer columns sit at plus and minus ${(colHz(N - 1) / 1000).toFixed(1)} kHz. Frequency is now an address along x.`
      default:
        return `One Fourier transform along the readout separates the columns by frequency; a second, across all the phase-encoding steps, separates the rows by phase. This line of data sits at ${(echoFrac * 100).toFixed(1)}% of the height of the k = 0 line.`
    }
  }, [k, echoFrac])

  const areaMtMs = phaseArea(k) * 1e6

  return (
    <Sim
      label="Timing diagram of one TR — RF, slice-select, phase-encoding and readout gradients — with what each one establishes about position"
      draw={draw}
      duration={DURATION}
      steps={STEPS}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="Phase-encode step" value={`k = ${k > 0 ? `+${k}` : k}`} tone="rf" />
          <Readout
            name="Phase across the rows"
            value={`${Math.round((360 * k) / N)}° per row`}
            tone="rf"
          />
          <Readout name="G_y × τ" value={`${areaMtMs.toFixed(3)} mT·ms/m`} tone="xy" />
          <Readout name="Echo vs k = 0" value={`${(echoFrac * 100).toFixed(1)}%`} tone="z" />
        </>
      }
      controls={
        <Slider
          label="Phase-encode step k"
          value={k}
          min={-2}
          max={1}
          step={1}
          onChange={setK}
          hint="k = 0 is the centre line of k-space: the gradient has zero area, no phase difference is written between rows, and the echo is at its tallest."
        />
      }
    />
  )
}
