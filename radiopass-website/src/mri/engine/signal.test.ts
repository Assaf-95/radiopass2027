import { describe, expect, it } from 'vitest'

import {
  classifyContrast,
  explainTissue,
  mzAtExcitation,
  contrastRatio,
  decayFraction,
  gradientEchoSignal,
  inversionRecoverySignal,
  nullTime,
  nullTimeLongTr,
  presetConfig,
  recoveryFraction,
  resolveTissue,
  sequenceSignal,
  spinEchoSignal,
  t2Star,
  TISSUE_BY_ID,
  TISSUES,
  type SequenceConfig,
  type Tissue,
} from './index'

const fat = TISSUE_BY_ID.fat
const csf = TISSUE_BY_ID.csf
const whiteMatter = TISSUE_BY_ID.whiteMatter
const greyMatter = TISSUE_BY_ID.greyMatter
const oedema = TISSUE_BY_ID.oedema

/** A pair differing only in T1, used to isolate T1 differentiation. */
const t1Pair: [Tissue, Tissue] = [
  { ...fat, id: 'lesion', t1: 300, t2: 90, pd: 0.8 },
  { ...fat, id: 'lesion', t1: 1500, t2: 90, pd: 0.8 },
]

/** A pair differing only in T2, used to isolate T2 differentiation. */
const t2Pair: [Tissue, Tissue] = [
  { ...fat, id: 'lesion', t1: 800, t2: 40, pd: 0.8 },
  { ...fat, id: 'lesion', t1: 800, t2: 250, pd: 0.8 },
]

describe('relaxation primitives', () => {
  it('recovers monotonically towards one and never exceeds it', () => {
    let previous = -1
    for (const t of [0, 50, 200, 600, 1500, 5000, 20000]) {
      const value = recoveryFraction(t, 600)
      expect(value).toBeGreaterThanOrEqual(previous)
      expect(value).toBeLessThanOrEqual(1)
      previous = value
    }
    expect(recoveryFraction(0, 600)).toBeCloseTo(0, 10)
  })

  it('decays monotonically towards zero', () => {
    let previous = 2
    for (const t of [0, 20, 80, 300, 1200]) {
      const value = decayFraction(t, 100)
      expect(value).toBeLessThanOrEqual(previous)
      expect(value).toBeGreaterThanOrEqual(0)
      previous = value
    }
    expect(decayFraction(0, 100)).toBeCloseTo(1, 10)
  })

  it('reaches one time constant at the expected fractions', () => {
    expect(recoveryFraction(600, 600)).toBeCloseTo(0.6321, 3)
    expect(decayFraction(80, 80)).toBeCloseTo(0.3679, 3)
  })

  it('makes T2* shorter than both T2 and T2-prime', () => {
    const star = t2Star(100, 60)
    expect(star).toBeLessThan(100)
    expect(star).toBeLessThan(60)
    expect(1 / star).toBeCloseTo(1 / 100 + 1 / 60, 10)
  })

  it('keeps every signal finite for extreme parameters', () => {
    const extremes: SequenceConfig[] = [
      { ...presetConfig('t1-se'), tr: 0, te: 0 },
      { ...presetConfig('t1-se'), tr: 1e9, te: 1e9 },
      { ...presetConfig('flair'), ti: 0, tr: 0 },
      { ...presetConfig('gre'), flipAngle: 0 },
      { ...presetConfig('gre'), flipAngle: 180 },
    ]
    for (const config of extremes) {
      for (const tissue of TISSUES) {
        const result = sequenceSignal(config, tissue)
        expect(Number.isFinite(result.signed)).toBe(true)
        expect(Number.isFinite(result.magnitude)).toBe(true)
      }
    }
  })
})

describe('spin-echo weighting relationships', () => {
  it('produces greater T1 differentiation at short TR than at long TR', () => {
    const shortTr = contrastRatio(
      spinEchoSignal(t1Pair[0], 500, 15),
      spinEchoSignal(t1Pair[1], 500, 15),
    )
    const longTr = contrastRatio(
      spinEchoSignal(t1Pair[0], 4000, 15),
      spinEchoSignal(t1Pair[1], 4000, 15),
    )
    expect(shortTr).toBeGreaterThan(longTr)
    expect(shortTr).toBeGreaterThan(0.3)
    expect(longTr).toBeLessThan(0.1)
  })

  it('produces greater T2 differentiation at long TE than at short TE', () => {
    const longTe = contrastRatio(
      spinEchoSignal(t2Pair[0], 4000, 100),
      spinEchoSignal(t2Pair[1], 4000, 100),
    )
    const shortTe = contrastRatio(
      spinEchoSignal(t2Pair[0], 4000, 10),
      spinEchoSignal(t2Pair[1], 4000, 10),
    )
    expect(longTe).toBeGreaterThan(shortTe)
    expect(longTe).toBeGreaterThan(0.5)
  })

  it('reduces both T1 and T2 weighting when TR is long and TE is short', () => {
    const t1Contrast = contrastRatio(
      spinEchoSignal(t1Pair[0], 3000, 15),
      spinEchoSignal(t1Pair[1], 3000, 15),
    )
    const t2Contrast = contrastRatio(
      spinEchoSignal(t2Pair[0], 3000, 15),
      spinEchoSignal(t2Pair[1], 3000, 15),
    )
    expect(t1Contrast).toBeLessThan(0.15)
    expect(t2Contrast).toBeLessThan(0.3)
  })

  it('reduces signal as TE increases, at a rate set by T2', () => {
    const shortT2 = { ...fat, t2: 40 }
    const longT2 = { ...fat, t2: 200 }
    for (const tissue of [shortT2, longT2]) {
      let previous = Infinity
      for (const te of [10, 30, 60, 120, 200]) {
        const signal = spinEchoSignal(tissue, 3000, te)
        expect(signal).toBeLessThan(previous)
        previous = signal
      }
    }
    // The short-T2 tissue must lose a larger fraction over the same interval.
    const shortLoss = spinEchoSignal(shortT2, 3000, 120) / spinEchoSignal(shortT2, 3000, 10)
    const longLoss = spinEchoSignal(longT2, 3000, 120) / spinEchoSignal(longT2, 3000, 10)
    expect(shortLoss).toBeLessThan(longLoss)
  })

  it('increases longitudinal recovery, and therefore signal, as TR increases', () => {
    let previous = -Infinity
    for (const tr of [300, 600, 1200, 2500, 5000]) {
      const signal = spinEchoSignal(whiteMatter, tr, 15)
      expect(signal).toBeGreaterThan(previous)
      previous = signal
    }
  })

  it('uses T2 rather than T2* as the spin-echo decay constant', () => {
    const config = { ...presetConfig('t2-se'), t2Prime: 20 }
    const withRefocus = sequenceSignal(config, greyMatter).magnitude
    const expected = spinEchoSignal(greyMatter, config.tr, config.te)
    expect(withRefocus).toBeCloseTo(expected, 10)

    // Changing field homogeneity must not change a properly refocused spin echo.
    const moreHomogeneous = sequenceSignal({ ...config, t2Prime: 300 }, greyMatter).magnitude
    expect(moreHomogeneous).toBeCloseTo(withRefocus, 10)

    // Removing the refocusing pulse must switch the decay constant to T2*.
    const fid = sequenceSignal({ ...config, refocus: false }, greyMatter).magnitude
    const t2StarExpected =
      greyMatter.pd *
      recoveryFraction(config.tr, greyMatter.t1) *
      decayFraction(config.te, t2Star(greyMatter.t2, config.t2Prime))
    expect(fid).toBeCloseTo(t2StarExpected, 10)
    expect(fid).toBeLessThan(withRefocus)
  })
})

describe('scenario contrast expectations', () => {
  const rank = (config: SequenceConfig) =>
    TISSUES.map((tissue) => ({ id: tissue.id, signal: sequenceSignal(config, tissue).magnitude }))
      .sort((a, b) => b.signal - a.signal)
      .map((entry) => entry.id)

  it('Scenario A — short TR and short TE make fat bright and CSF dark', () => {
    const config = presetConfig('t1-se')
    const order = rank(config)
    expect(order[0]).toBe('fat')
    expect(order[order.length - 1]).toBe('csf')
    expect(sequenceSignal(config, fat).magnitude).toBeGreaterThan(
      sequenceSignal(config, csf).magnitude * 3,
    )
    // White matter recovers faster than grey matter, so it is brighter.
    expect(sequenceSignal(config, whiteMatter).magnitude).toBeGreaterThan(
      sequenceSignal(config, greyMatter).magnitude,
    )
  })

  it('Scenario B — long TR and long TE make CSF and oedema bright', () => {
    const config = presetConfig('t2-se')
    const order = rank(config)
    expect(order[0]).toBe('csf')
    expect(order[1]).toBe('oedema')
    // Grey matter now outshines white matter, reversing the T1 appearance.
    expect(sequenceSignal(config, greyMatter).magnitude).toBeGreaterThan(
      sequenceSignal(config, whiteMatter).magnitude,
    )
    // Fat is no longer the dominant tissue.
    expect(sequenceSignal(config, fat).magnitude).toBeLessThan(
      sequenceSignal(config, csf).magnitude,
    )
  })

  it('Scenario C — long TR and short TE compress both T1 and T2 contrast', () => {
    const pd = presetConfig('pd-se')
    const spread = (config: SequenceConfig) => {
      const values = TISSUES.map((tissue) => sequenceSignal(config, tissue).magnitude)
      return (Math.max(...values) - Math.min(...values)) / Math.max(...values)
    }
    expect(spread(pd)).toBeLessThan(spread(presetConfig('t1-se')))
    expect(spread(pd)).toBeLessThan(spread(presetConfig('t2-se')))
    // Grey matter beats white matter here because of proton density, not T2.
    expect(sequenceSignal(pd, greyMatter).magnitude).toBeGreaterThan(
      sequenceSignal(pd, whiteMatter).magnitude,
    )
  })
})

describe('inversion recovery', () => {
  it('nulls a tissue exactly at its calculated inversion time', () => {
    for (const tissue of TISSUES) {
      for (const tr of [2000, 4000, 9000]) {
        const ti = nullTime(tissue.t1, tr)
        const signed = inversionRecoverySignal(tissue, tr, ti, 20)
        expect(Math.abs(signed)).toBeLessThan(1e-9)
      }
    }
  })

  it('approaches T1 · ln 2 as TR becomes long relative to T1', () => {
    expect(nullTime(260, 100000)).toBeCloseTo(nullTimeLongTr(260), 6)
    // At a clinically realistic TR the exact value is shorter than 0.69 · T1.
    expect(nullTime(4000, 9000)).toBeLessThan(nullTimeLongTr(4000))
    expect(nullTime(4000, 9000)).toBeCloseTo(2372, 0)
  })

  it('Scenario D — a correct FLAIR TI suppresses CSF while oedema stays bright', () => {
    const config = presetConfig('flair')
    expect(config.ti).toBeCloseTo(nullTime(csf.t1, config.tr), 0)

    const signals = Object.fromEntries(
      TISSUES.map((tissue) => [tissue.id, sequenceSignal(config, tissue).magnitude]),
    )
    const peak = Math.max(...Object.values(signals))

    expect(signals.csf / peak).toBeLessThan(0.02)
    expect(signals.oedema / peak).toBeGreaterThan(0.9)
    // T2 weighting must survive: grey matter still brighter than white matter.
    expect(signals.greyMatter).toBeGreaterThan(signals.whiteMatter)
    // FLAIR must not null every water-containing tissue.
    expect(signals.oedema).toBeGreaterThan(signals.csf * 50)
  })

  it('Scenario E — a correct STIR TI suppresses fat and marrow fat', () => {
    const config = presetConfig('stir')
    expect(config.ti).toBeCloseTo(nullTime(fat.t1, config.tr), 0)

    const signals = Object.fromEntries(
      TISSUES.map((tissue) => [tissue.id, sequenceSignal(config, tissue).magnitude]),
    )
    const peak = Math.max(...Object.values(signals))

    expect(signals.fat / peak).toBeLessThan(0.02)
    expect(signals.marrow / peak).toBeLessThan(0.15)
    // Fluid and oedema must remain the bright tissues.
    expect(signals.csf / peak).toBeGreaterThan(0.9)
    expect(signals.oedema / peak).toBeGreaterThan(0.6)
    // STIR must suppress fat, not fluid.
    expect(signals.csf).toBeGreaterThan(signals.fat * 50)
  })

  it('Scenario F — moving TI away from the CSF null restores CSF signal', () => {
    const config = presetConfig('flair')
    const atNull = sequenceSignal(config, csf).magnitude
    let previous = atNull
    for (const offset of [200, 500, 900, 1400]) {
      const signal = sequenceSignal({ ...config, ti: config.ti + offset }, csf).magnitude
      expect(signal).toBeGreaterThan(previous)
      previous = signal
    }
    // Suppression fails in both directions away from the null point.
    expect(sequenceSignal({ ...config, ti: config.ti - 800 }, csf).magnitude).toBeGreaterThan(atNull)
  })

  it('Scenario G — moving TI away from the fat null leaves fat incompletely suppressed', () => {
    const config = presetConfig('stir')
    const atNull = sequenceSignal(config, fat).magnitude
    for (const ti of [120, 140, 220, 260]) {
      expect(sequenceSignal({ ...config, ti }, fat).magnitude).toBeGreaterThan(atNull)
    }
    const peakAtNull = Math.max(
      ...TISSUES.map((tissue) => sequenceSignal(config, tissue).magnitude),
    )
    const badConfig = { ...config, ti: 300 }
    const peakBad = Math.max(...TISSUES.map((tissue) => sequenceSignal(badConfig, tissue).magnitude))
    expect(sequenceSignal(badConfig, fat).magnitude / peakBad).toBeGreaterThan(
      atNull / peakAtNull + 0.05,
    )
  })

  it('keeps the signed value negative before the zero crossing', () => {
    const config = presetConfig('flair')
    const early = inversionRecoverySignal(csf, config.tr, 500, config.te)
    const late = inversionRecoverySignal(csf, config.tr, 3400, config.te)
    expect(early).toBeLessThan(0)
    expect(late).toBeGreaterThan(0)
    // Magnitude reconstruction hides the sign.
    expect(sequenceSignal({ ...config, ti: 500 }, csf).magnitude).toBeGreaterThan(0)
  })
})

describe('generated explanations state the right mechanism', () => {
  const group = TISSUES.filter((tissue) => tissue.id !== 'lesion')

  it('says a nulled tissue was excited at its null point', () => {
    const flair = presetConfig('flair')
    const csfNote = explainTissue(flair, csf, group)
    expect(csfNote.reason).toMatch(/null point/i)
    expect(csfNote.shortReason).toMatch(/null point/i)
  })

  it('does not claim a tissue recovered past zero when it is still inverted', () => {
    // CSF on STIR is bright, but at TI 180 ms it is nowhere near recovered —
    // it is at roughly −54% of M0. The brightness comes from magnitude
    // reconstruction discarding the sign, and the wording must say so.
    const stir = presetConfig('stir')
    expect(mzAtExcitation(stir, csf)).toBeLessThan(0)
    const note = explainTissue(stir, csf, group)
    expect(note.reason).toMatch(/magnitude reconstruction/i)
    expect(note.reason).not.toMatch(/recovered past zero/i)
    expect(note.shortReason).toMatch(/inverted/i)
  })

  it('says a tissue recovered past zero only when it actually has', () => {
    // Fat on FLAIR really has: TI 2372 ms is far beyond its 180 ms null.
    const flair = presetConfig('flair')
    expect(mzAtExcitation(flair, fat)).toBeGreaterThan(0)
    const note = explainTissue(flair, fat, group)
    expect(note.reason).toMatch(/recovered past zero/i)
    expect(note.reason).not.toMatch(/magnitude reconstruction/i)
  })

  it('never calls a comparatively short T2 long', () => {
    // Fat is bright on FLAIR, but its T2 of 80 ms is not long, and earlier
    // wording asserted that it was.
    const note = explainTissue(presetConfig('flair'), fat, group)
    expect(note.reason).not.toMatch(/long T2 of 80/i)
  })
})

describe('gradient echo', () => {
  it('peaks at the Ernst angle for a given TR and T1', () => {
    const tr = 100
    const tissue = whiteMatter
    const signals = Array.from({ length: 90 }, (_, index) => ({
      angle: index + 1,
      signal: gradientEchoSignal(tissue, tr, 5, index + 1, 1e6),
    }))
    const best = signals.reduce((a, b) => (b.signal > a.signal ? b : a))
    const ernst = (Math.acos(Math.exp(-tr / tissue.t1)) * 180) / Math.PI
    expect(Math.abs(best.angle - ernst)).toBeLessThan(2)
  })

  it('decays with T2* so field inhomogeneity reduces the echo', () => {
    const homogeneous = gradientEchoSignal(greyMatter, 100, 20, 30, 400)
    const inhomogeneous = gradientEchoSignal(greyMatter, 100, 20, 30, 20)
    expect(inhomogeneous).toBeLessThan(homogeneous)
  })
})

describe('field strength scaling', () => {
  it('lengthens T1 at higher field and leaves T2 unchanged', () => {
    const at3T = resolveTissue('whiteMatter', 3)
    expect(at3T.t1).toBeGreaterThan(whiteMatter.t1)
    expect(at3T.t2).toBe(whiteMatter.t2)
    expect(resolveTissue('whiteMatter', 1.5).t1).toBe(whiteMatter.t1)
  })

  it('moves the CSF null point when the field changes', () => {
    const at1p5 = nullTime(resolveTissue('csf', 1.5).t1, 9000)
    const at3 = nullTime(resolveTissue('csf', 3).t1, 9000)
    expect(at3).toBeGreaterThan(at1p5)
  })
})

describe('contrast classification', () => {
  const group = TISSUES.filter((tissue) => tissue.id !== 'lesion' && tissue.id !== 'marrow')

  it('labels the T1 preset as predominantly T1-weighted', () => {
    const result = classifyContrast(presetConfig('t1-se'), group)
    expect(result.weighting).toBe('t1')
    expect(result.contributions.t1).toBeGreaterThan(result.contributions.t2)
  })

  it('labels the T2 preset as predominantly T2-weighted', () => {
    const result = classifyContrast(presetConfig('t2-se'), group)
    expect(result.weighting).toBe('t2')
    expect(result.contributions.t2).toBeGreaterThan(result.contributions.t1)
  })

  it('labels the proton-density preset as proton-density-weighted', () => {
    const result = classifyContrast(presetConfig('pd-se'), group)
    expect(result.weighting).toBe('pd')
  })

  it('reports inversion-recovery suppression for FLAIR and STIR', () => {
    const flair = classifyContrast(presetConfig('flair'), group)
    expect(flair.suppressed.map((entry) => entry.tissue.id)).toContain('csf')
    expect(flair.label.toLowerCase()).toContain('suppression')

    const stir = classifyContrast(presetConfig('stir'), group)
    expect(stir.suppressed.map((entry) => entry.tissue.id)).toContain('fat')
  })

  it('calls a poorly optimised sequence weak rather than forcing a category', () => {
    // Everything recovers fully and almost nothing has decayed: no contrast.
    const flat: SequenceConfig = { ...presetConfig('pd-se'), tr: 12000, te: 2 }
    const uniform = group.map((tissue) => ({ ...tissue, pd: 0.8 }))
    const result = classifyContrast(flat, uniform)
    expect(result.weighting).toBe('weak')
  })

  it('does not classify by threshold alone — an unusual valid combination is described honestly', () => {
    // Short TR with long TE: T1 saturation and T2 decay oppose each other.
    const awkward: SequenceConfig = { ...presetConfig('t1-se'), tr: 600, te: 90 }
    const result = classifyContrast(awkward, group)
    expect(result.weighting).toBe('mixed')
    expect(result.reason).toContain('against each other')
    expect(result.reason.length).toBeGreaterThan(20)
  })
})

describe('tissue assumptions', () => {
  it('keeps the relationships the syllabus depends on', () => {
    expect(fat.t1).toBeLessThan(whiteMatter.t1)
    expect(whiteMatter.t1).toBeLessThan(greyMatter.t1)
    expect(csf.t1).toBeGreaterThan(greyMatter.t1 * 2)
    expect(csf.t2).toBeGreaterThan(oedema.t2)
    expect(oedema.t2).toBeGreaterThan(whiteMatter.t2)
    expect(TISSUE_BY_ID.muscle.pd).toBeLessThan(csf.pd)
    expect(TISSUE_BY_ID.muscle.t2).toBeLessThan(whiteMatter.t2)
    // Marrow fat must track fat, not water.
    expect(Math.abs(TISSUE_BY_ID.marrow.t1 - fat.t1)).toBeLessThan(100)
  })
})
