/**
 * The ultrasound physics engine.
 *
 * Every derived quantity a page displays is computed here from state, so the
 * diagram, the graph, the numbers and the explanation cannot disagree with each
 * other. Nothing in this file knows anything about React or about drawing.
 *
 * Units are stated on every function because mixing MHz with Hz, or cm with m,
 * is the single most common way to get an ultrasound calculation wrong.
 */

import { ASSUMED_SPEED, impedance, medium, type Medium, type MediumId } from './media'

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/* ------------------------------------------------------------------ *
 * Wave fundamentals
 * ------------------------------------------------------------------ */

/**
 * Wavelength in millimetres.
 *
 * c = f * lambda, so lambda = c / f. With c in m/s and f in MHz the result is
 * in micrometres * 1000 — the arithmetic below converts to mm directly:
 * lambda(mm) = c(m/s) / f(MHz) / 1000.
 */
export function wavelengthMm(speedMs: number, frequencyMHz: number): number {
  if (frequencyMHz <= 0) return Number.POSITIVE_INFINITY
  return speedMs / frequencyMHz / 1000
}

/** Period in microseconds, T = 1/f. */
export function periodUs(frequencyMHz: number): number {
  if (frequencyMHz <= 0) return Number.POSITIVE_INFINITY
  return 1 / frequencyMHz
}

/** Spatial pulse length in millimetres: SPL = n cycles * wavelength. */
export function spatialPulseLengthMm(cycles: number, wavelengthMm: number): number {
  return cycles * wavelengthMm
}

/** Pulse duration in microseconds: PD = n cycles * period. */
export function pulseDurationUs(cycles: number, frequencyMHz: number): number {
  return cycles * periodUs(frequencyMHz)
}

/** Pulse repetition period in microseconds, PRP = 1/PRF (PRF in Hz). */
export function pulseRepetitionPeriodUs(prfHz: number): number {
  if (prfHz <= 0) return Number.POSITIVE_INFINITY
  return 1e6 / prfHz
}

/** Duty factor (dimensionless fraction) = pulse duration / pulse repetition period. */
export function dutyFactor(pulseDurationUs: number, prpUs: number): number {
  if (!Number.isFinite(prpUs) || prpUs <= 0) return 0
  return pulseDurationUs / prpUs
}

/** Intensity in W/cm^2 from power in watts and beam area in cm^2. */
export function intensity(powerW: number, areaCm2: number): number {
  if (areaCm2 <= 0) return Number.POSITIVE_INFINITY
  return powerW / areaCm2
}

/**
 * Fractional bandwidth of a pulse, as a rough inverse of the number of cycles.
 *
 * A heavily damped two-cycle pulse is broadband; a long ringing pulse is narrow
 * band. The proportionality (bandwidth ~ 1/pulse duration) is what the exam
 * tests; the constant here is chosen so that a 2-cycle pulse gives roughly 50%
 * fractional bandwidth, which is typical of a real broadband probe.
 */
export function fractionalBandwidth(cycles: number): number {
  return clamp(1 / Math.max(0.5, cycles), 0.04, 1.2)
}

/** Q factor = centre frequency / bandwidth, i.e. the reciprocal of fractional bandwidth. */
export function qFactor(cycles: number): number {
  return 1 / fractionalBandwidth(cycles)
}

/* ------------------------------------------------------------------ *
 * Pulse-echo ranging
 * ------------------------------------------------------------------ */

/**
 * Depth in mm from a round-trip time in microseconds.
 *
 * depth = c * t / 2. The division by two is the whole point: the measured time
 * covers the journey out to the reflector AND back to the probe.
 */
export function depthFromTimeMm(roundTripUs: number, speedMs = ASSUMED_SPEED): number {
  return (speedMs * roundTripUs) / 2000
}

/** Round-trip time in microseconds for a reflector at a given depth in mm. */
export function timeFromDepthUs(depthMm: number, speedMs = ASSUMED_SPEED): number {
  return (2 * depthMm * 1000) / speedMs
}

/**
 * Apparent depth when the true propagation speed differs from the 1540 m/s the
 * machine assumes. This is the speed-displacement (speed error) artefact.
 */
export function apparentDepthMm(trueDepthMm: number, actualSpeedMs: number): number {
  return (trueDepthMm * ASSUMED_SPEED) / actualSpeedMs
}

/**
 * Highest pulse repetition frequency that still allows every echo from the
 * deepest displayed reflector to return before the next pulse is sent.
 * Expressed in Hz for a maximum depth in mm.
 */
export function maxPrfHz(maxDepthMm: number, speedMs = ASSUMED_SPEED): number {
  if (maxDepthMm <= 0) return Number.POSITIVE_INFINITY
  return (speedMs * 1000) / (2 * maxDepthMm)
}

/**
 * Frame rate in frames per second.
 *
 * Each scan line costs one listening period per focal zone, so
 * frames/second = PRF / (lines per frame * focal zones).
 */
export function frameRate(prfHz: number, linesPerFrame: number, focalZones = 1): number {
  const pulses = Math.max(1, linesPerFrame) * Math.max(1, focalZones)
  return prfHz / pulses
}

/** Scan lines in a frame from sector width in degrees and line density per degree. */
export function linesPerFrame(sectorDegrees: number, linesPerDegree: number): number {
  return Math.max(1, Math.round(sectorDegrees * linesPerDegree))
}

/* ------------------------------------------------------------------ *
 * Interfaces: reflection, transmission, refraction
 * ------------------------------------------------------------------ */

/**
 * Intensity reflection coefficient at normal incidence.
 *
 * R = ((Z2 - Z1) / (Z2 + Z1))^2, a fraction between 0 and 1. Note that it is
 * the *difference* in impedance that matters, and that swapping the two media
 * gives the same answer.
 */
export function reflectionCoefficient(z1: number, z2: number): number {
  const sum = z1 + z2
  if (sum === 0) return 0
  const r = (z2 - z1) / sum
  return r * r
}

/** Intensity transmission coefficient at normal incidence, T = 1 - R. */
export function transmissionCoefficient(z1: number, z2: number): number {
  return 1 - reflectionCoefficient(z1, z2)
}

export function interfaceFor(a: MediumId, b: MediumId) {
  const m1 = medium(a)
  const m2 = medium(b)
  const z1 = impedance(m1)
  const z2 = impedance(m2)
  const r = reflectionCoefficient(z1, z2)
  return {
    m1,
    m2,
    z1,
    z2,
    deltaZ: Math.abs(z2 - z1),
    reflected: r,
    transmitted: 1 - r,
    reflectedPercent: r * 100,
    transmittedPercent: (1 - r) * 100,
  }
}

/**
 * Refraction angle in degrees from Snell's law: sin(t1)/c1 = sin(t2)/c2.
 *
 * Returns null when total internal reflection occurs — that is, when the beam
 * passes into a faster medium at an angle beyond the critical angle and no
 * transmitted beam exists.
 */
export function refractionAngleDeg(incidenceDeg: number, c1: number, c2: number): number | null {
  const sinT2 = (Math.sin((incidenceDeg * Math.PI) / 180) * c2) / c1
  if (Math.abs(sinT2) > 1) return null
  return (Math.asin(sinT2) * 180) / Math.PI
}

/**
 * Critical angle in degrees, or null when none exists.
 *
 * A critical angle only exists when the second medium is FASTER than the first
 * (c2 > c1). Presenting a critical angle when c2 < c1 is a physics error the
 * laboratory must never make.
 */
export function criticalAngleDeg(c1: number, c2: number): number | null {
  if (c2 <= c1) return null
  return (Math.asin(clamp(c1 / c2, -1, 1)) * 180) / Math.PI
}

/** Which way the beam bends. Into a faster medium it bends AWAY from the normal. */
export function bendDirection(c1: number, c2: number): 'away' | 'towards' | 'straight' {
  if (Math.abs(c2 - c1) < 1e-6) return 'straight'
  return c2 > c1 ? 'away' : 'towards'
}

/* ------------------------------------------------------------------ *
 * Attenuation
 * ------------------------------------------------------------------ */

/**
 * Attenuation in decibels using the clinical model:
 * dB = attenuation coefficient (dB/cm/MHz) * frequency (MHz) * path length (cm).
 *
 * This is a one-way figure. Doubling it gives the round trip an echo actually
 * experiences, which is why the "1 dB/cm/MHz" rule of thumb is often quoted for
 * the there-and-back journey through average soft tissue.
 */
export function attenuationDb(
  coefficientDbCmMHz: number,
  frequencyMHz: number,
  pathCm: number,
): number {
  return coefficientDbCmMHz * frequencyMHz * pathCm
}

/** Intensity ratio (0-1) remaining after a given attenuation in dB. */
export function dbToRatio(db: number): number {
  return Math.pow(10, -db / 10)
}

export function ratioToDb(ratio: number): number {
  if (ratio <= 0) return Number.POSITIVE_INFINITY
  return -10 * Math.log10(ratio)
}

/** Exponential model I = I0 * exp(-mu * x); mu in 1/cm, x in cm. */
export function exponentialIntensity(i0: number, muPerCm: number, xCm: number): number {
  return i0 * Math.exp(-muPerCm * xCm)
}

/** Converts a dB/cm attenuation figure to the mu used by the exponential model. */
export function dbPerCmToMu(dbPerCm: number): number {
  return (dbPerCm * Math.LN10) / 10
}

/**
 * Half-value layer in cm: the path length that reduces intensity to one half.
 * HVL = 3.01 dB / (coefficient * frequency).
 */
export function halfValueLayerCm(coefficientDbCmMHz: number, frequencyMHz: number): number {
  const perCm = coefficientDbCmMHz * frequencyMHz
  if (perCm <= 0) return Number.POSITIVE_INFINITY
  return 3.0103 / perCm
}

export type Layer = { id: MediumId; thicknessCm: number }

/**
 * Walks a stack of tissue layers and returns the cumulative one-way attenuation
 * in dB at the far side of each layer, including the reflection losses at each
 * boundary. Reflection genuinely removes energy from the onward beam, and a
 * model that ignores it cannot explain shadowing behind bone.
 */
export function attenuationProfile(layers: Layer[], frequencyMHz: number) {
  let cumulativeDb = 0
  let depthCm = 0
  const points: { depthCm: number; db: number; ratio: number; label: string }[] = [
    { depthCm: 0, db: 0, ratio: 1, label: 'Transducer face' },
  ]

  layers.forEach((layer, index) => {
    const m = medium(layer.id)
    if (index > 0) {
      const previous = medium(layers[index - 1].id)
      const r = reflectionCoefficient(impedance(previous), impedance(m))
      // Energy removed by reflection at the boundary, expressed in dB.
      cumulativeDb += ratioToDb(Math.max(1e-9, 1 - r))
      points.push({
        depthCm,
        db: cumulativeDb,
        ratio: dbToRatio(cumulativeDb),
        label: `${previous.name} → ${m.name} interface`,
      })
    }
    cumulativeDb += attenuationDb(m.attenuation, frequencyMHz, layer.thicknessCm)
    depthCm += layer.thicknessCm
    points.push({
      depthCm,
      db: cumulativeDb,
      ratio: dbToRatio(cumulativeDb),
      label: `Through ${m.lower}`,
    })
  })

  return { points, totalDb: cumulativeDb, remaining: dbToRatio(cumulativeDb) }
}

/* ------------------------------------------------------------------ *
 * Beam geometry
 * ------------------------------------------------------------------ */

/**
 * Near-field (Fresnel zone) length in mm for an unfocused circular aperture:
 * N = a^2 / lambda = D^2 / (4 * lambda). Radius and wavelength both in mm.
 */
export function nearFieldLengthMm(apertureDiameterMm: number, wavelengthMm: number): number {
  if (wavelengthMm <= 0) return 0
  const a = apertureDiameterMm / 2
  return (a * a) / wavelengthMm
}

/**
 * Far-field divergence half-angle in degrees:
 * sin(theta) = 0.61 * lambda / a = 1.22 * lambda / D.
 */
export function divergenceAngleDeg(apertureDiameterMm: number, wavelengthMm: number): number {
  const a = apertureDiameterMm / 2
  if (a <= 0) return 90
  const s = clamp((0.61 * wavelengthMm) / a, -1, 1)
  return (Math.asin(s) * 180) / Math.PI
}

/**
 * Beam width in mm at a given depth for an unfocused aperture.
 *
 * The beam narrows to roughly half the aperture at the end of the near field
 * (the natural focus) and then diverges. This is a teaching approximation of a
 * real beam profile, not a diffraction calculation.
 */
export function unfocusedBeamWidthMm(
  depthMm: number,
  apertureDiameterMm: number,
  wavelengthMm: number,
): number {
  const n = nearFieldLengthMm(apertureDiameterMm, wavelengthMm)
  if (n <= 0) return apertureDiameterMm
  if (depthMm <= n) {
    // Converging from the full aperture down to half of it at the natural focus.
    return apertureDiameterMm * (1 - 0.5 * (depthMm / n))
  }
  const theta = (divergenceAngleDeg(apertureDiameterMm, wavelengthMm) * Math.PI) / 180
  return apertureDiameterMm * 0.5 + 2 * (depthMm - n) * Math.tan(theta)
}

/**
 * Beam width in mm for an electronically focused beam.
 *
 * The beam is narrowest at the focal depth, where the width is set by the
 * f-number and the wavelength (w ~ lambda * focus / aperture), and widens
 * either side of it.
 */
export function focusedBeamWidthMm(
  depthMm: number,
  apertureDiameterMm: number,
  wavelengthMm: number,
  focusDepthMm: number,
): number {
  const aperture = Math.max(1, apertureDiameterMm)
  const waist = clamp((wavelengthMm * focusDepthMm) / aperture, 0.15, aperture)
  const spread = Math.abs(depthMm - focusDepthMm) / Math.max(1, focusDepthMm)
  const width = waist + spread * aperture * 0.85
  return clamp(width, waist, aperture * 2.2)
}

/* ------------------------------------------------------------------ *
 * Resolution
 * ------------------------------------------------------------------ */

/**
 * Axial resolution in mm — the smallest separation along the beam axis at which
 * two reflectors still give separate echoes. It is half the spatial pulse
 * length, because the echoes from two reflectors half a pulse length apart
 * arrive just far enough apart not to overlap.
 */
export function axialResolutionMm(cycles: number, wavelengthMm: number): number {
  return spatialPulseLengthMm(cycles, wavelengthMm) / 2
}

/** Lateral resolution equals the beam width at the depth in question. */
export function lateralResolutionMm(beamWidthMm: number): number {
  return beamWidthMm
}

/**
 * Elevational (slice thickness) resolution in mm.
 *
 * A one-dimensional array is focused in the elevation plane by a fixed acoustic
 * lens, so the slice is thinnest at the lens focus and thickest elsewhere. This
 * is always the worst of the three spatial resolutions on a standard probe.
 */
export function elevationalThicknessMm(
  depthMm: number,
  elevationApertureMm: number,
  lensFocusMm: number,
): number {
  const waist = clamp(elevationApertureMm * 0.22, 0.6, elevationApertureMm)
  const spread = Math.abs(depthMm - lensFocusMm) / Math.max(10, lensFocusMm)
  return clamp(waist + spread * elevationApertureMm * 1.1, waist, elevationApertureMm * 2.6)
}

/* ------------------------------------------------------------------ *
 * Doppler
 * ------------------------------------------------------------------ */

/**
 * Doppler shift in Hz.
 *
 * delta-f = 2 * f0 * v * cos(theta) / c
 *
 * f0 in MHz, v in m/s, theta in degrees, c in m/s. The factor of two is present
 * because the moving scatterer both receives a shifted frequency and re-emits
 * it — the shift happens twice.
 */
export function dopplerShiftHz(
  f0MHz: number,
  velocityMs: number,
  angleDeg: number,
  speedMs = ASSUMED_SPEED,
): number {
  const f0 = f0MHz * 1e6
  return (2 * f0 * velocityMs * Math.cos((angleDeg * Math.PI) / 180)) / speedMs
}

/** Velocity in m/s recovered from a measured shift — the machine's calculation. */
export function velocityFromShiftMs(
  shiftHz: number,
  f0MHz: number,
  angleDeg: number,
  speedMs = ASSUMED_SPEED,
): number {
  const cos = Math.cos((angleDeg * Math.PI) / 180)
  if (Math.abs(cos) < 1e-6) return Number.POSITIVE_INFINITY
  return (shiftHz * speedMs) / (2 * f0MHz * 1e6 * cos)
}

/** Nyquist limit in Hz — half the pulse repetition frequency. */
export function nyquistLimitHz(prfHz: number): number {
  return prfHz / 2
}

/** Highest velocity measurable without aliasing, in m/s. */
export function maxVelocityMs(
  prfHz: number,
  f0MHz: number,
  angleDeg: number,
  speedMs = ASSUMED_SPEED,
): number {
  return velocityFromShiftMs(nyquistLimitHz(prfHz), f0MHz, angleDeg, speedMs)
}

/**
 * The displayed shift after aliasing.
 *
 * Anything beyond the Nyquist limit wraps to the opposite end of the scale,
 * which is exactly what a spectral display or a colour map does.
 */
export function aliasedShiftHz(shiftHz: number, prfHz: number): number {
  const nyquist = nyquistLimitHz(prfHz)
  if (nyquist <= 0) return 0
  const span = prfHz
  let wrapped = ((shiftHz + nyquist) % span + span) % span - nyquist
  if (Object.is(wrapped, -0)) wrapped = 0
  return wrapped
}

export function isAliasing(shiftHz: number, prfHz: number): boolean {
  return Math.abs(shiftHz) > nyquistLimitHz(prfHz)
}

/**
 * Percentage velocity error produced by a given error in the assumed angle.
 *
 * Because the machine divides by cos(theta), the error explodes as the angle
 * approaches 90 degrees — the reason 60 degrees is treated as the practical
 * ceiling for a quantitative measurement.
 */
export function angleErrorPercent(trueAngleDeg: number, assumedAngleDeg: number): number {
  const cosTrue = Math.cos((trueAngleDeg * Math.PI) / 180)
  const cosAssumed = Math.cos((assumedAngleDeg * Math.PI) / 180)
  if (Math.abs(cosAssumed) < 1e-6 || Math.abs(cosTrue) < 1e-9) return Number.POSITIVE_INFINITY
  return (cosTrue / cosAssumed - 1) * 100
}

/* ------------------------------------------------------------------ *
 * Transducer
 * ------------------------------------------------------------------ */

/**
 * Resonant frequency in MHz of a thickness-mode element.
 *
 * The element resonates when its thickness is HALF a wavelength in the crystal,
 * so f = c_crystal / (2 * t). Thickness in mm, crystal speed in m/s.
 */
export function resonantFrequencyMHz(thicknessMm: number, crystalSpeedMs = 4000): number {
  if (thicknessMm <= 0) return Number.POSITIVE_INFINITY
  return crystalSpeedMs / (2 * thicknessMm) / 1000
}

/** Element thickness in mm required for a chosen resonant frequency. */
export function elementThicknessMm(frequencyMHz: number, crystalSpeedMs = 4000): number {
  if (frequencyMHz <= 0) return Number.POSITIVE_INFINITY
  return crystalSpeedMs / (2 * frequencyMHz * 1000)
}

/**
 * Ideal single matching-layer impedance, the geometric mean of the two it sits
 * between: Zm = sqrt(Z_crystal * Z_tissue). Its thickness is a quarter of a
 * wavelength at the design frequency.
 */
export function matchingLayerImpedance(zCrystal: number, zTissue: number): number {
  return Math.sqrt(zCrystal * zTissue)
}

export function quarterWaveThicknessMm(speedMs: number, frequencyMHz: number): number {
  return wavelengthMm(speedMs, frequencyMHz) / 4
}

/**
 * Number of cycles left in the pulse for a given amount of backing damping
 * (0 = undamped, 1 = heavily damped). Damping is the operator on pulse length,
 * bandwidth, Q factor, axial resolution and sensitivity all at once.
 */
export function cyclesFromDamping(damping: number): number {
  return clamp(12 - 10 * clamp(damping, 0, 1), 1.5, 12)
}

/** Relative sensitivity (0-1). Heavy damping buys pulse length at the cost of signal. */
export function sensitivityFromDamping(damping: number): number {
  return clamp(1 - 0.72 * clamp(damping, 0, 1), 0.15, 1)
}

/* ------------------------------------------------------------------ *
 * Safety indices
 * ------------------------------------------------------------------ */

/**
 * Mechanical index.
 *
 * MI = peak rarefactional pressure (MPa) / sqrt(frequency in MHz).
 * It is a dimensionless index of the potential for non-thermal (cavitation)
 * effects. Note that raising the frequency LOWERS the MI for the same pressure.
 */
export function mechanicalIndex(peakRarefactionalMPa: number, frequencyMHz: number): number {
  if (frequencyMHz <= 0) return Number.POSITIVE_INFINITY
  return peakRarefactionalMPa / Math.sqrt(frequencyMHz)
}

/**
 * A teaching estimate of the thermal index.
 *
 * TI is defined as the ratio of the acoustic power used to the power needed to
 * raise the tissue temperature by 1 degree Celsius under a specified model, and
 * the real calculation is performed by the manufacturer. This function
 * reproduces the behaviour the examination asks about: TI rises with power, with
 * dwell time in one place, and dramatically when bone lies in the beam, and it
 * is higher for pulsed Doppler than for B-mode because the energy is
 * concentrated on a single line.
 */
export function thermalIndexEstimate(options: {
  /** Relative acoustic output power, 0-1. */
  power: number
  frequencyMHz: number
  /** 'bmode' | 'colour' | 'pulsedDoppler' — determines how concentrated the energy is. */
  mode: 'bmode' | 'colour' | 'pulsedDoppler' | 'mmode'
  /** Which model applies: soft tissue, bone at focus, or bone at the surface. */
  target: 'soft' | 'bone' | 'cranial'
}): number {
  const modeFactor = { bmode: 1, mmode: 1.3, colour: 1.9, pulsedDoppler: 3.4 }[options.mode]
  const targetFactor = { soft: 1, bone: 2.8, cranial: 3.4 }[options.target]
  // Absorption rises with frequency, so heating rises with it too.
  const frequencyFactor = Math.sqrt(clamp(options.frequencyMHz, 1, 15) / 3)
  return clamp(options.power * 1.15 * modeFactor * targetFactor * frequencyFactor, 0, 6)
}

/* ------------------------------------------------------------------ *
 * Image formation helpers
 * ------------------------------------------------------------------ */

/**
 * Maps an echo amplitude (0-1) to a displayed grey level (0-1) through the
 * dynamic range and gain controls.
 *
 * Compression maps a wide range of echo amplitudes into the limited number of
 * grey levels a display can show. A narrow dynamic range gives a high-contrast,
 * more black-and-white image; a wide one gives a smoother, greyer image.
 */
export function greyLevel(options: {
  /** Linear echo amplitude, 0-1. */
  amplitude: number
  /** Overall receiver gain in dB. */
  gainDb: number
  /** Displayed dynamic range in dB. */
  dynamicRangeDb: number
}): number {
  const { amplitude, gainDb, dynamicRangeDb } = options
  if (amplitude <= 0) return 0
  const db = ratioToDb(amplitude) - gainDb
  // db is now "how far below the top of the scale"; map it across the range.
  const level = 1 - db / Math.max(1, dynamicRangeDb)
  return clamp(level, 0, 1)
}

/**
 * Time gain compensation: extra amplification in dB applied at a given depth,
 * interpolated between the slider positions the learner has set.
 */
export function tgcGainDb(depthFraction: number, sliders: number[]): number {
  if (sliders.length === 0) return 0
  const position = clamp(depthFraction, 0, 1) * (sliders.length - 1)
  const lower = Math.floor(position)
  const upper = Math.min(sliders.length - 1, lower + 1)
  const t = position - lower
  return sliders[lower] * (1 - t) + sliders[upper] * t
}

/**
 * Signal-to-noise style figure used to decide whether a deep echo is still
 * visible. Below about 1 the echo is buried in electronic noise, which is what
 * "the penetration limit" means on a real machine.
 */
export function echoVisibility(remainingRatio: number, noiseFloor = 1e-5): number {
  return remainingRatio / noiseFloor
}

/** Practical penetration depth in cm before the echo falls below the noise floor. */
export function penetrationDepthCm(
  coefficientDbCmMHz: number,
  frequencyMHz: number,
  dynamicRangeDb = 100,
): number {
  const perCm = coefficientDbCmMHz * frequencyMHz * 2 // there and back
  if (perCm <= 0) return Number.POSITIVE_INFINITY
  return dynamicRangeDb / perCm
}

export type { Medium, MediumId }
