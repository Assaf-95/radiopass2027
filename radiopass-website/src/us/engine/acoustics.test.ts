/**
 * The validation checklist, executed.
 *
 * Every direction-of-change relationship the laboratory teaches is asserted
 * here against the same engine the pages draw from, so a regression in the
 * physics cannot ship silently.
 */

import { describe, expect, it } from 'vitest'

import {
  aliasedShiftHz,
  apparentDepthMm,
  attenuationDb,
  axialResolutionMm,
  criticalAngleDeg,
  cyclesFromDamping,
  depthFromTimeMm,
  divergenceAngleDeg,
  dopplerShiftHz,
  dutyFactor,
  fractionalBandwidth,
  frameRate,
  isAliasing,
  matchingLayerImpedance,
  maxPrfHz,
  mechanicalIndex,
  nearFieldLengthMm,
  nyquistLimitHz,
  penetrationDepthCm,
  qFactor,
  reflectionCoefficient,
  refractionAngleDeg,
  resonantFrequencyMHz,
  sensitivityFromDamping,
  spatialPulseLengthMm,
  thermalIndexEstimate,
  timeFromDepthUs,
  transmissionCoefficient,
  wavelengthMm,
} from './acoustics'
import { ASSUMED_SPEED, impedanceOf, medium } from './media'

describe('wave fundamentals', () => {
  it('increasing frequency shortens wavelength in the same medium', () => {
    expect(wavelengthMm(1540, 10)).toBeLessThan(wavelengthMm(1540, 5))
  })

  it('frequency does not change the speed — wavelength is exactly c/f', () => {
    expect(wavelengthMm(1540, 5)).toBeCloseTo(0.308, 3)
    expect(wavelengthMm(1540, 10)).toBeCloseTo(0.154, 3)
  })

  it('spatial pulse length is cycles times wavelength; axial resolution is half of it', () => {
    const spl = spatialPulseLengthMm(3, 0.308)
    expect(spl).toBeCloseTo(0.924, 3)
    expect(axialResolutionMm(3, 0.308)).toBeCloseTo(spl / 2, 6)
  })

  it('typical axial resolution lands in the taught 0.5–1 mm band at ~2 cycles, 5 MHz', () => {
    const axial = axialResolutionMm(3, wavelengthMm(1540, 5))
    expect(axial).toBeGreaterThan(0.3)
    expect(axial).toBeLessThan(1)
  })

  it('duty factor is tiny — the probe listens over 99% of the time', () => {
    expect(dutyFactor(0.6, 250)).toBeLessThan(0.01)
  })
})

describe('impedance and interfaces', () => {
  it('impedance orders as air ≪ fat < water < soft tissue < muscle < bone', () => {
    const order = ['air', 'fat', 'water', 'softTissue', 'muscle', 'bone'] as const
    const values = order.map((id) => impedanceOf(id))
    const sorted = [...values].sort((a, b) => a - b)
    expect(values).toEqual(sorted)
  })

  it('large impedance mismatch increases reflection; matched media reflect nothing', () => {
    expect(reflectionCoefficient(1.63, 1.63)).toBe(0)
    expect(reflectionCoefficient(1.63, 7.8)).toBeGreaterThan(reflectionCoefficient(1.63, 1.7))
  })

  it('soft tissue → air reflects over 99%', () => {
    expect(reflectionCoefficient(impedanceOf('softTissue'), impedanceOf('air'))).toBeGreaterThan(0.99)
  })

  it('soft tissue → fluid reflects a fraction of one per cent — never 15%', () => {
    const r = reflectionCoefficient(impedanceOf('softTissue'), impedanceOf('water'))
    expect(r).toBeLessThan(0.01)
    expect(r).toBeGreaterThan(0)
  })

  it('muscle → bone reflects strongly but far less than air', () => {
    const bone = reflectionCoefficient(impedanceOf('muscle'), impedanceOf('bone'))
    expect(bone).toBeGreaterThan(0.3)
    expect(bone).toBeLessThan(0.6)
  })

  it('reflection is symmetric and T = 1 − R', () => {
    expect(reflectionCoefficient(1.63, 7.8)).toBeCloseTo(reflectionCoefficient(7.8, 1.63), 9)
    expect(transmissionCoefficient(1.63, 7.8)).toBeCloseTo(1 - reflectionCoefficient(1.63, 7.8), 9)
  })
})

describe('refraction', () => {
  it('no bending at normal incidence, whatever the media', () => {
    expect(refractionAngleDeg(0, 1450, 4080)).toBeCloseTo(0, 6)
  })

  it('into a faster medium the beam bends away from the normal', () => {
    const out = refractionAngleDeg(30, 1450, 1580)
    expect(out).not.toBeNull()
    expect(out!).toBeGreaterThan(30)
  })

  it('into a slower medium the beam bends towards the normal', () => {
    const out = refractionAngleDeg(30, 1580, 1450)
    expect(out).not.toBeNull()
    expect(out!).toBeLessThan(30)
  })

  it('a critical angle exists only when the second medium is faster', () => {
    expect(criticalAngleDeg(1580, 1450)).toBeNull()
    const critical = criticalAngleDeg(1540, 4080)
    expect(critical).not.toBeNull()
    expect(critical!).toBeCloseTo(22.16, 1)
    expect(refractionAngleDeg(critical! + 5, 1540, 4080)).toBeNull()
  })
})

describe('attenuation and ranging', () => {
  it('attenuation rises with frequency and with depth', () => {
    expect(attenuationDb(0.8, 10, 5)).toBeGreaterThan(attenuationDb(0.8, 5, 5))
    expect(attenuationDb(0.8, 5, 10)).toBeGreaterThan(attenuationDb(0.8, 5, 5))
  })

  it('penetration falls as frequency rises', () => {
    expect(penetrationDepthCm(0.7, 10)).toBeLessThan(penetrationDepthCm(0.7, 3))
  })

  it('depth = ct/2 gives ~13 µs of round trip per centimetre', () => {
    expect(timeFromDepthUs(10, ASSUMED_SPEED)).toBeCloseTo(12.99, 1)
    expect(depthFromTimeMm(130, ASSUMED_SPEED)).toBeCloseTo(100.1, 0)
  })

  it('slower-than-assumed tissue places the reflector too deep', () => {
    expect(apparentDepthMm(80, medium('fat').speed)).toBeGreaterThan(80)
    expect(apparentDepthMm(80, medium('muscle').speed)).toBeLessThan(80)
  })
})

describe('imaging rates', () => {
  it('greater depth caps PRF lower, and frame rate follows', () => {
    expect(maxPrfHz(180)).toBeLessThan(maxPrfHz(60))
    expect(frameRate(4000, 128, 1)).toBeCloseTo(31.25, 2)
  })

  it('more focal zones and more lines cost frame rate', () => {
    expect(frameRate(4000, 128, 2)).toBeCloseTo(frameRate(4000, 128, 1) / 2, 6)
    expect(frameRate(4000, 256, 1)).toBeLessThan(frameRate(4000, 128, 1))
  })
})

describe('transducer', () => {
  it('a thicker element resonates lower (t = λ/2 in the crystal)', () => {
    expect(resonantFrequencyMHz(0.8)).toBeLessThan(resonantFrequencyMHz(0.4))
    expect(resonantFrequencyMHz(0.4, 4000)).toBeCloseTo(5, 3)
  })

  it('the matching layer takes the geometric mean impedance', () => {
    expect(matchingLayerImpedance(30, 1.63)).toBeCloseTo(Math.sqrt(30 * 1.63), 6)
  })

  it('more damping → fewer cycles → broader bandwidth → lower Q → less sensitivity', () => {
    expect(cyclesFromDamping(0.9)).toBeLessThan(cyclesFromDamping(0.2))
    const fewCycles = cyclesFromDamping(0.9)
    const manyCycles = cyclesFromDamping(0.2)
    expect(fractionalBandwidth(fewCycles)).toBeGreaterThan(fractionalBandwidth(manyCycles))
    expect(qFactor(fewCycles)).toBeLessThan(qFactor(manyCycles))
    expect(sensitivityFromDamping(0.9)).toBeLessThan(sensitivityFromDamping(0.2))
  })
})

describe('beam geometry', () => {
  it('larger aperture lengthens the near field and reduces divergence', () => {
    const lambda = wavelengthMm(1540, 5)
    expect(nearFieldLengthMm(20, lambda)).toBeGreaterThan(nearFieldLengthMm(10, lambda))
    expect(divergenceAngleDeg(20, lambda)).toBeLessThan(divergenceAngleDeg(10, lambda))
  })

  it('higher frequency lengthens the near field for a fixed aperture', () => {
    expect(nearFieldLengthMm(12, wavelengthMm(1540, 10))).toBeGreaterThan(
      nearFieldLengthMm(12, wavelengthMm(1540, 5)),
    )
  })
})

describe('Doppler', () => {
  it('the shift follows cos θ: halved at 60°, zero at 90°', () => {
    const at0 = dopplerShiftHz(5, 0.5, 0)
    expect(dopplerShiftHz(5, 0.5, 60)).toBeCloseTo(at0 / 2, 3)
    expect(dopplerShiftHz(5, 0.5, 90)).toBeCloseTo(0, 6)
  })

  it('shift scales with transmit frequency and velocity, and inversely with c', () => {
    expect(dopplerShiftHz(10, 0.5, 0)).toBeCloseTo(dopplerShiftHz(5, 0.5, 0) * 2, 3)
    expect(dopplerShiftHz(5, 1.0, 0)).toBeCloseTo(dopplerShiftHz(5, 0.5, 0) * 2, 3)
  })

  it('a worked example: 5 MHz, 0.5 m/s, 60° gives ~1.62 kHz', () => {
    expect(dopplerShiftHz(5, 0.5, 60)).toBeCloseTo(1623, 0)
  })

  it('Nyquist is half the PRF, and shifts beyond it wrap', () => {
    expect(nyquistLimitHz(6000)).toBe(3000)
    expect(isAliasing(3500, 6000)).toBe(true)
    expect(isAliasing(2500, 6000)).toBe(false)
    // A 3.5 kHz shift sampled at 6 kHz reads as −2.5 kHz: classic wrap-around.
    expect(aliasedShiftHz(3500, 6000)).toBeCloseTo(-2500, 6)
  })

  it('aliasing occurs at physiological velocity when PRF is low', () => {
    // 30 cm/s at 4 MHz, 30°: shift ≈ 1.35 kHz — aliased at a 2 kHz PRF.
    const shift = dopplerShiftHz(4, 0.3, 30)
    expect(isAliasing(shift, 2000)).toBe(true)
  })
})

describe('safety indices', () => {
  it('MI = p/√f: rises with pressure, falls with frequency', () => {
    expect(mechanicalIndex(1, 4)).toBeCloseTo(0.5, 6)
    expect(mechanicalIndex(2, 4)).toBeGreaterThan(mechanicalIndex(1, 4))
    expect(mechanicalIndex(1, 9)).toBeLessThan(mechanicalIndex(1, 4))
  })

  it('pulsed Doppler heats more than B-mode; bone raises TI further', () => {
    const base = { power: 0.6, frequencyMHz: 4 } as const
    const bmode = thermalIndexEstimate({ ...base, mode: 'bmode', target: 'soft' })
    const doppler = thermalIndexEstimate({ ...base, mode: 'pulsedDoppler', target: 'soft' })
    const bone = thermalIndexEstimate({ ...base, mode: 'bmode', target: 'bone' })
    expect(doppler).toBeGreaterThan(bmode)
    expect(bone).toBeGreaterThan(bmode)
  })
})
