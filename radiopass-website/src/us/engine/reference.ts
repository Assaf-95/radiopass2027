/**
 * The reference layer: equations, direction-of-change relationships and the
 * high-yield comparison tables.
 *
 * Each equation carries a live calculator description — variable names, units,
 * sane ranges and a compute function — so the Equation Library can build a
 * working calculator for every formula without a bespoke component each time.
 */

import {
  attenuationDb,
  axialResolutionMm,
  divergenceAngleDeg,
  dopplerShiftHz,
  dutyFactor,
  intensity,
  mechanicalIndex,
  nearFieldLengthMm,
  nyquistLimitHz,
  reflectionCoefficient,
  refractionAngleDeg,
  spatialPulseLengthMm,
  wavelengthMm,
} from './acoustics'

export type EquationVariable = {
  key: string
  symbol: string
  name: string
  unit: string
  min: number
  max: number
  step: number
  initial: number
}

export type UsEquation = {
  id: string
  name: string
  formula: string
  /** What the equation is for, in one sentence. */
  summary: string
  variables: EquationVariable[]
  /** Computes the result from the variable values. */
  compute: (v: Record<string, number>) => { value: number; unit: string; label: string }
  assumptions: string
  directions: string[]
  mistake: string
  experiment: string
}

const v = (
  key: string,
  symbol: string,
  name: string,
  unit: string,
  min: number,
  max: number,
  step: number,
  initial: number,
): EquationVariable => ({ key, symbol, name, unit, min, max, step, initial })

export const US_EQUATIONS: UsEquation[] = [
  {
    id: 'wave',
    name: 'The wave equation',
    formula: 'c = f λ        λ = c / f',
    summary: 'Links propagation speed, frequency and wavelength.',
    variables: [
      v('c', 'c', 'Propagation speed', 'm/s', 300, 4100, 10, 1540),
      v('f', 'f', 'Frequency', 'MHz', 1, 20, 0.5, 5),
    ],
    compute: (x) => ({ value: wavelengthMm(x.c, x.f), unit: 'mm', label: 'Wavelength λ' }),
    assumptions:
      'Speed is a property of the medium alone. Changing the transducer frequency changes λ, never c.',
    directions: ['f ↑ → λ ↓ (same medium)', 'c ↑ → λ ↑ (same frequency)', 'f ↑ → c unchanged'],
    mistake: 'Believing a higher-frequency probe makes sound travel faster. It does not.',
    experiment: '/ultrasound-lab',
  },
  {
    id: 'period',
    name: 'Period and PRF',
    formula: 'T = 1 / f        PRF = 1 / PRP',
    summary: 'The time-domain partners of frequency.',
    variables: [v('f', 'f', 'Frequency', 'MHz', 1, 20, 0.5, 5)],
    compute: (x) => ({ value: 1 / x.f, unit: 'µs', label: 'Period T' }),
    assumptions: 'Period is the time for one cycle; PRP is the time between successive pulses.',
    directions: ['f ↑ → T ↓', 'PRP ↑ → PRF ↓'],
    mistake: 'Confusing the period of one cycle with the interval between pulses. They differ by orders of magnitude.',
    experiment: '/ultrasound-lab',
  },
  {
    id: 'duty',
    name: 'Duty factor',
    formula: 'Duty factor = pulse duration / pulse repetition period',
    summary: 'The fraction of time the probe is actually transmitting.',
    variables: [
      v('pd', 'PD', 'Pulse duration', 'µs', 0.1, 5, 0.1, 0.4),
      v('prp', 'PRP', 'Pulse repetition period', 'µs', 50, 1000, 10, 200),
    ],
    compute: (x) => ({ value: dutyFactor(x.pd, x.prp) * 100, unit: '%', label: 'Duty factor' }),
    assumptions: 'Dimensionless; usually well below 1% in imaging, so the probe listens over 99% of the time.',
    directions: ['pulse duration ↑ → duty factor ↑', 'PRF ↑ → duty factor ↑'],
    mistake: 'Assuming a high duty factor. Imaging probes transmit for a tiny fraction of the time.',
    experiment: '/ultrasound-lab',
  },
  {
    id: 'intensity',
    name: 'Intensity',
    formula: 'I = Power / Area',
    summary: 'Power concentrated into a beam cross-section.',
    variables: [
      v('p', 'P', 'Acoustic power', 'mW', 1, 500, 1, 50),
      v('a', 'A', 'Beam area', 'cm²', 0.01, 4, 0.01, 0.5),
    ],
    compute: (x) => ({ value: intensity(x.p / 1000, x.a), unit: 'W/cm²', label: 'Intensity' }),
    assumptions: 'Focusing redistributes power rather than creating it, so intensity peaks at the focus.',
    directions: ['power ↑ → intensity ↑', 'area ↓ → intensity ↑'],
    mistake: 'Treating intensity and power as interchangeable. Narrowing the beam raises intensity at constant power.',
    experiment: '/ultrasound-lab/safety',
  },
  {
    id: 'spl',
    name: 'Spatial pulse length',
    formula: 'SPL = n × λ',
    summary: 'The physical length of the transmitted pulse.',
    variables: [
      v('n', 'n', 'Cycles per pulse', '', 1, 10, 0.5, 2),
      v('f', 'f', 'Frequency', 'MHz', 1, 20, 0.5, 5),
    ],
    compute: (x) => ({
      value: spatialPulseLengthMm(x.n, wavelengthMm(1540, x.f)),
      unit: 'mm',
      label: 'Spatial pulse length',
    }),
    assumptions: 'Soft tissue at 1540 m/s.',
    directions: ['cycles ↓ → SPL ↓', 'frequency ↑ → SPL ↓', 'damping ↑ → SPL ↓'],
    mistake: 'Forgetting that damping changes the number of cycles, and therefore SPL, independently of frequency.',
    experiment: '/ultrasound-lab/resolution',
  },
  {
    id: 'axial',
    name: 'Axial resolution',
    formula: 'Axial resolution = SPL / 2',
    summary: 'The smallest resolvable separation along the beam.',
    variables: [
      v('n', 'n', 'Cycles per pulse', '', 1, 10, 0.5, 2),
      v('f', 'f', 'Frequency', 'MHz', 1, 20, 0.5, 5),
    ],
    compute: (x) => ({
      value: axialResolutionMm(x.n, wavelengthMm(1540, x.f)),
      unit: 'mm',
      label: 'Axial resolution',
    }),
    assumptions: 'Independent of depth, of transducer diameter, of focusing and of PRF.',
    directions: ['frequency ↑ → resolution ↑ (number falls)', 'cycles ↓ → resolution ↑', 'depth: no effect'],
    mistake: 'Attributing axial resolution to beam width or focusing. Those govern LATERAL resolution.',
    experiment: '/ultrasound-lab/resolution',
  },
  {
    id: 'impedance',
    name: 'Acoustic impedance',
    formula: 'Z = ρ c',
    summary: 'The property that decides how much of the beam reflects at a boundary.',
    variables: [
      v('rho', 'ρ', 'Density', 'kg/m³', 1, 2200, 10, 1050),
      v('c', 'c', 'Propagation speed', 'm/s', 300, 4100, 10, 1540),
    ],
    compute: (x) => ({ value: (x.rho * x.c) / 1e6, unit: 'MRayl', label: 'Acoustic impedance Z' }),
    assumptions: 'Intrinsic to the material; unaffected by frequency or by whether the tissue is moving.',
    directions: ['density ↑ → Z ↑', 'speed ↑ → Z ↑', 'frequency: no effect'],
    mistake: 'Quoting impedance in decibels. Decibels express a ratio; impedance is measured in rayls.',
    experiment: '/ultrasound-lab/impedance',
  },
  {
    id: 'reflection',
    name: 'Intensity reflection coefficient',
    formula: 'R = ((Z₂ − Z₁) / (Z₂ + Z₁))²',
    summary: 'The fraction of intensity reflected at normal incidence.',
    variables: [
      v('z1', 'Z₁', 'Impedance of medium 1', 'MRayl', 0.0004, 8, 0.01, 1.63),
      v('z2', 'Z₂', 'Impedance of medium 2', 'MRayl', 0.0004, 8, 0.01, 7.8),
    ],
    compute: (x) => ({
      value: reflectionCoefficient(x.z1, x.z2) * 100,
      unit: '%',
      label: 'Reflected intensity',
    }),
    assumptions: 'Normal incidence, and T ≈ 1 − R when other losses are ignored.',
    directions: ['|ΔZ| ↑ → R ↑', 'Z₁ = Z₂ → R = 0', 'swapping the media → R unchanged'],
    mistake: 'Using density alone. Reflection needs the impedance difference, and impedance needs speed as well.',
    experiment: '/ultrasound-lab/impedance',
  },
  {
    id: 'snell',
    name: 'Snell’s law',
    formula: 'sin θ₁ / c₁ = sin θ₂ / c₂',
    summary: 'The direction of the transmitted beam at an oblique boundary.',
    variables: [
      v('theta', 'θ₁', 'Angle of incidence', '°', 0, 89, 1, 30),
      v('c1', 'c₁', 'Speed in medium 1', 'm/s', 300, 4100, 10, 1450),
      v('c2', 'c₂', 'Speed in medium 2', 'm/s', 300, 4100, 10, 1580),
    ],
    compute: (x) => {
      const angle = refractionAngleDeg(x.theta, x.c1, x.c2)
      return angle === null
        ? { value: Number.NaN, unit: '', label: 'Total internal reflection — no transmitted beam' }
        : { value: angle, unit: '°', label: 'Refraction angle θ₂' }
    },
    assumptions: 'Requires oblique incidence AND a speed difference. At normal incidence there is no refraction.',
    directions: ['c₂ > c₁ → bends away from the normal', 'c₂ < c₁ → bends towards the normal', 'θ₁ = 0 → no bending'],
    mistake: 'Using impedance instead of speed. Impedance governs reflection; speed governs refraction.',
    experiment: '/ultrasound-lab/refraction',
  },
  {
    id: 'depth',
    name: 'Pulse–echo depth',
    formula: 'depth = c t / 2',
    summary: 'Turns a round-trip time into a depth on the image.',
    variables: [
      v('t', 't', 'Round-trip time', 'µs', 1, 300, 1, 130),
      v('c', 'c', 'Assumed speed', 'm/s', 1400, 1700, 10, 1540),
    ],
    compute: (x) => ({ value: (x.c * x.t) / 2000 / 10, unit: 'cm', label: 'Reflector depth' }),
    assumptions: 'The machine always assumes 1540 m/s. About 13 µs of round trip per centimetre of depth.',
    directions: ['time ↑ → depth ↑', 'actual c < assumed → structure placed too deep'],
    mistake: 'Omitting the division by two. The measured time covers the journey out AND back.',
    experiment: '/ultrasound-lab/pulse-echo',
  },
  {
    id: 'attenuation',
    name: 'Attenuation (decibel model)',
    formula: 'Attenuation (dB) = α × f × path length',
    summary: 'How much of the beam is lost on the way.',
    variables: [
      v('a', 'α', 'Attenuation coefficient', 'dB/cm/MHz', 0.05, 2, 0.05, 0.8),
      v('f', 'f', 'Frequency', 'MHz', 1, 20, 0.5, 5),
      v('x', 'x', 'Path length', 'cm', 1, 25, 1, 10),
    ],
    compute: (x) => ({ value: attenuationDb(x.a, x.f, x.x), unit: 'dB', label: 'One-way attenuation' }),
    assumptions:
      'The frequency term applies only when α is expressed per MHz. Double the result for the round trip an echo actually makes.',
    directions: ['frequency ↑ → attenuation ↑', 'depth ↑ → attenuation ↑', 'penetration ↓'],
    mistake: 'Applying the frequency multiplier to a coefficient already quoted in plain dB/cm.',
    experiment: '/ultrasound-lab/attenuation',
  },
  {
    id: 'exponential',
    name: 'Exponential attenuation',
    formula: 'I = I₀ e^(−µx)',
    summary: 'The underlying physical model: a fixed fraction lost per centimetre.',
    variables: [
      v('mu', 'µ', 'Attenuation coefficient', 'cm⁻¹', 0.01, 2, 0.01, 0.2),
      v('x', 'x', 'Path length', 'cm', 1, 25, 1, 8),
    ],
    compute: (x) => ({
      value: Math.exp(-x.mu * x.x) * 100,
      unit: '%',
      label: 'Intensity remaining',
    }),
    assumptions: 'Exponential means the same relative loss per cm, which becomes a straight line in decibels.',
    directions: ['µ ↑ → faster decay', 'x ↑ → less remaining'],
    mistake: 'Reading exponential decay as a fixed absolute loss per cm.',
    experiment: '/ultrasound-lab/attenuation',
  },
  {
    id: 'nearfield',
    name: 'Near-field length',
    formula: 'N = a² / λ = D² / 4λ',
    summary: 'How far the beam stays collimated before it diverges.',
    variables: [
      v('d', 'D', 'Aperture diameter', 'mm', 3, 40, 1, 12),
      v('f', 'f', 'Frequency', 'MHz', 1, 20, 0.5, 5),
    ],
    compute: (x) => ({
      value: nearFieldLengthMm(x.d, wavelengthMm(1540, x.f)) / 10,
      unit: 'cm',
      label: 'Near-field length N',
    }),
    assumptions: 'Unfocused circular aperture in soft tissue.',
    directions: ['aperture ↑ → N ↑ (as the square)', 'frequency ↑ → N ↑', 'the natural focus sits at N'],
    mistake: 'Forgetting that N depends on the SQUARE of the aperture, so a small change in diameter matters a lot.',
    experiment: '/ultrasound-lab/beam',
  },
  {
    id: 'divergence',
    name: 'Far-field divergence',
    formula: 'sin θ ≈ 0.61 λ / a = 1.22 λ / D',
    summary: 'How quickly the beam spreads beyond the near field.',
    variables: [
      v('d', 'D', 'Aperture diameter', 'mm', 3, 40, 1, 12),
      v('f', 'f', 'Frequency', 'MHz', 1, 20, 0.5, 5),
    ],
    compute: (x) => ({
      value: divergenceAngleDeg(x.d, wavelengthMm(1540, x.f)),
      unit: '°',
      label: 'Divergence half-angle',
    }),
    assumptions: 'Unfocused aperture; a real focused array behaves differently either side of the focus.',
    directions: ['aperture ↑ → divergence ↓', 'frequency ↑ → divergence ↓'],
    mistake: 'Expecting a high frequency to widen the beam. It narrows it, for a fixed aperture.',
    experiment: '/ultrasound-lab/beam',
  },
  {
    id: 'doppler',
    name: 'The Doppler equation',
    formula: 'Δf = 2 f₀ v cos θ / c',
    summary: 'The frequency shift produced by a moving reflector.',
    variables: [
      v('f0', 'f₀', 'Transmitted frequency', 'MHz', 1, 12, 0.5, 5),
      v('v', 'v', 'Blood velocity', 'm/s', 0, 5, 0.05, 0.5),
      v('theta', 'θ', 'Beam–flow angle', '°', 0, 90, 1, 60),
    ],
    compute: (x) => ({
      value: dopplerShiftHz(x.f0, x.v, x.theta),
      unit: 'Hz',
      label: 'Doppler shift Δf',
    }),
    assumptions: 'c = 1540 m/s. The factor of two is because the scatterer both receives and re-radiates a shifted frequency.',
    directions: ['f₀ ↑ → Δf ↑', 'v ↑ → Δf ↑', 'θ → 90° → Δf → 0', 'c ↑ → Δf ↓'],
    mistake: 'Making Δf proportional to the angle instead of to its cosine — the most repeated Doppler trap in the recall bank.',
    experiment: '/ultrasound-lab/doppler',
  },
  {
    id: 'nyquist',
    name: 'Nyquist limit',
    formula: 'Nyquist limit = PRF / 2',
    summary: 'The largest Doppler shift a pulsed system can display without wrapping.',
    variables: [v('prf', 'PRF', 'Pulse repetition frequency', 'Hz', 500, 20000, 100, 6000)],
    compute: (x) => ({ value: nyquistLimitHz(x.prf), unit: 'Hz', label: 'Nyquist limit' }),
    assumptions: 'Pulsed systems only. Continuous-wave Doppler samples continuously and cannot alias.',
    directions: ['PRF ↑ → Nyquist ↑', 'depth ↑ → PRF max ↓ → Nyquist ↓', 'baseline shift → limit unchanged'],
    mistake: 'Confusing the Nyquist limit with the PRF itself. It is half of it.',
    experiment: '/ultrasound-lab/aliasing',
  },
  {
    id: 'mi',
    name: 'Mechanical index',
    formula: 'MI = p₋ / √f',
    summary: 'An index of the potential for cavitation and other non-thermal effects.',
    variables: [
      v('p', 'p₋', 'Peak rarefactional pressure', 'MPa', 0.1, 4, 0.05, 1),
      v('f', 'f', 'Frequency', 'MHz', 1, 15, 0.5, 3),
    ],
    compute: (x) => ({ value: mechanicalIndex(x.p, x.f), unit: '', label: 'Mechanical index' }),
    assumptions:
      'Dimensionless index, not a measurement of damage. Caution thresholds: 0.7 with contrast or gas bodies, 0.3 for neonatal lung.',
    directions: ['pressure ↑ → MI ↑', 'frequency ↑ → MI ↓', 'MI says nothing about heating'],
    mistake: 'Deriving MI from tissue heating. That is the thermal index — a different risk entirely.',
    experiment: '/ultrasound-lab/safety',
  },
]

/* ------------------------------------------------------------------ *
 * Relationship explorer
 * ------------------------------------------------------------------ */

export type RelationEffect = {
  label: string
  dir: 'up' | 'down' | 'flat' | 'warn'
  /** Direct physical consequence, or an indirect system/engineering consequence. */
  kind: 'direct' | 'indirect'
  why: string
}

export type Relation = {
  id: string
  action: string
  effects: RelationEffect[]
  experiment: string
}

export const US_RELATIONS: Relation[] = [
  {
    id: 'frequency-up',
    action: 'Increase transmit frequency',
    experiment: '/ultrasound-lab',
    effects: [
      { label: 'Wavelength', dir: 'down', kind: 'direct', why: 'λ = c / f, and c is fixed by the medium.' },
      { label: 'Spatial pulse length', dir: 'down', kind: 'direct', why: 'SPL = cycles × λ.' },
      { label: 'Axial resolution', dir: 'up', kind: 'direct', why: 'Axial resolution = SPL / 2.' },
      { label: 'Attenuation', dir: 'up', kind: 'direct', why: 'Attenuation in dB scales with frequency.' },
      { label: 'Penetration', dir: 'down', kind: 'direct', why: 'Deep echoes fall below the noise floor sooner.' },
      { label: 'Near-field length', dir: 'up', kind: 'direct', why: 'N = D²/4λ, and λ has fallen.' },
      { label: 'Far-field divergence', dir: 'down', kind: 'direct', why: 'sin θ ≈ 1.22 λ / D.' },
      { label: 'Doppler shift for a given velocity', dir: 'up', kind: 'direct', why: 'Δf ∝ f₀.' },
      { label: 'Risk of aliasing', dir: 'warn', kind: 'indirect', why: 'A larger shift is more likely to exceed PRF/2.' },
      { label: 'Mechanical index', dir: 'down', kind: 'direct', why: 'MI = p₋ / √f.' },
      { label: 'Tissue heating', dir: 'warn', kind: 'indirect', why: 'Absorption rises with frequency, so more energy is deposited per cm.' },
      { label: 'Speed of sound', dir: 'flat', kind: 'direct', why: 'Speed belongs to the medium. It does not change.' },
    ],
  },
  {
    id: 'aperture-up',
    action: 'Increase aperture (more active elements)',
    experiment: '/ultrasound-lab/beam',
    effects: [
      { label: 'Near-field length', dir: 'up', kind: 'direct', why: 'N = D² / 4λ — it scales with the square of the diameter.' },
      { label: 'Far-field divergence', dir: 'down', kind: 'direct', why: 'sin θ ≈ 1.22 λ / D.' },
      { label: 'Beam width at the focus', dir: 'down', kind: 'direct', why: 'A lower f-number gives a tighter focal waist.' },
      { label: 'Lateral resolution', dir: 'up', kind: 'direct', why: 'Lateral resolution is the beam width.' },
      { label: 'Axial resolution', dir: 'flat', kind: 'direct', why: 'Aperture does not change the pulse length.' },
    ],
  },
  {
    id: 'damping-up',
    action: 'Increase backing damping',
    experiment: '/ultrasound-lab/transducer',
    effects: [
      { label: 'Cycles per pulse', dir: 'down', kind: 'direct', why: 'The backing block absorbs the ringing.' },
      { label: 'Spatial pulse length', dir: 'down', kind: 'direct', why: 'Fewer cycles at the same wavelength.' },
      { label: 'Bandwidth', dir: 'up', kind: 'direct', why: 'A shorter pulse requires a wider range of frequencies.' },
      { label: 'Q factor', dir: 'down', kind: 'direct', why: 'Q is centre frequency divided by bandwidth.' },
      { label: 'Axial resolution', dir: 'up', kind: 'direct', why: 'Axial resolution = SPL / 2.' },
      { label: 'Sensitivity', dir: 'warn', kind: 'indirect', why: 'A shorter pulse carries less energy, so weak deep echoes are harder to detect.' },
    ],
  },
  {
    id: 'depth-up',
    action: 'Increase imaging depth',
    experiment: '/ultrasound-lab/pulse-echo',
    effects: [
      { label: 'Listening time per line', dir: 'up', kind: 'direct', why: 'Echoes from deeper structures take longer to return.' },
      { label: 'Maximum PRF', dir: 'down', kind: 'direct', why: 'PRF_max = c / (2 × depth).' },
      { label: 'Frame rate', dir: 'down', kind: 'indirect', why: 'Fewer pulses per second means fewer frames per second.' },
      { label: 'Nyquist limit', dir: 'down', kind: 'indirect', why: 'Nyquist is PRF/2, and PRF has been capped.' },
      { label: 'Risk of aliasing', dir: 'warn', kind: 'indirect', why: 'A lower Nyquist limit is exceeded more easily.' },
    ],
  },
  {
    id: 'focal-zones-up',
    action: 'Add focal zones',
    experiment: '/ultrasound-lab/beam',
    effects: [
      { label: 'Lateral resolution over depth', dir: 'up', kind: 'direct', why: 'The beam is narrow at more than one depth.' },
      { label: 'Pulses per frame', dir: 'up', kind: 'direct', why: 'Each zone needs its own transmit down every line.' },
      { label: 'Frame rate', dir: 'down', kind: 'indirect', why: 'More pulses per frame at a fixed PRF.' },
      { label: 'Temporal resolution', dir: 'down', kind: 'indirect', why: 'Frame rate is temporal resolution.' },
    ],
  },
  {
    id: 'gain-up',
    action: 'Increase receiver gain',
    experiment: '/ultrasound-lab/controls',
    effects: [
      { label: 'Image brightness', dir: 'up', kind: 'direct', why: 'Every received echo is amplified.' },
      { label: 'Displayed noise', dir: 'warn', kind: 'direct', why: 'Electronic noise is amplified along with the signal.' },
      { label: 'Patient acoustic exposure', dir: 'flat', kind: 'direct', why: 'Gain acts entirely on the receive side.' },
      { label: 'MI and TI', dir: 'flat', kind: 'direct', why: 'The transmitted pulse is unchanged.' },
      { label: 'Signal-to-noise ratio', dir: 'flat', kind: 'direct', why: 'Amplifying both equally cannot improve the ratio.' },
    ],
  },
  {
    id: 'power-up',
    action: 'Increase output power',
    experiment: '/ultrasound-lab/safety',
    effects: [
      { label: 'Echo amplitude', dir: 'up', kind: 'direct', why: 'A stronger pulse produces stronger echoes.' },
      { label: 'Signal-to-noise ratio', dir: 'up', kind: 'direct', why: 'The signal rises above a fixed electronic noise floor.' },
      { label: 'Penetration', dir: 'up', kind: 'indirect', why: 'Deep echoes stay above the noise floor for longer.' },
      { label: 'Patient acoustic exposure', dir: 'warn', kind: 'direct', why: 'More energy enters the patient.' },
      { label: 'MI and TI', dir: 'warn', kind: 'direct', why: 'Both indices scale with output.' },
    ],
  },
  {
    id: 'angle-up',
    action: 'Increase Doppler angle towards 90°',
    experiment: '/ultrasound-lab/doppler',
    effects: [
      { label: 'cos θ', dir: 'down', kind: 'direct', why: 'cos 90° = 0.' },
      { label: 'Doppler shift', dir: 'down', kind: 'direct', why: 'Δf ∝ cos θ.' },
      { label: 'Risk of aliasing', dir: 'down', kind: 'indirect', why: 'A smaller shift is less likely to exceed the Nyquist limit.' },
      { label: 'Velocity measurement error', dir: 'warn', kind: 'indirect', why: 'Dividing by a small cosine magnifies every error — which is why this is not an accepted way to fix aliasing.' },
    ],
  },
]

/* ------------------------------------------------------------------ *
 * High-yield comparison tables
 * ------------------------------------------------------------------ */

export type ComparisonTable = {
  id: string
  title: string
  intro: string
  columns: string[]
  rows: { label: string; cells: { text: string; tone?: 'up' | 'down' | 'none' }[]; note?: string }[]
  experiment: string
}

const up = (text: string) => ({ text, tone: 'up' as const })
const down = (text: string) => ({ text, tone: 'down' as const })
const flat = (text: string) => ({ text, tone: 'none' as const })

export const US_TABLES: ComparisonTable[] = [
  {
    id: 'frequency',
    title: 'Frequency vs wavelength, resolution, attenuation and penetration',
    intro: 'The single most examined trade-off in ultrasound.',
    columns: ['Wavelength', 'Axial resolution', 'Attenuation', 'Penetration'],
    experiment: '/ultrasound-lab',
    rows: [
      { label: 'Higher frequency', cells: [down('Shorter'), up('Better'), up('Higher'), down('Lower')] },
      { label: 'Lower frequency', cells: [up('Longer'), down('Worse'), down('Lower'), up('Greater')] },
      {
        label: 'Speed of sound',
        cells: [flat('Unchanged'), flat('—'), flat('—'), flat('—')],
        note: 'Speed belongs to the medium. Frequency never changes it.',
      },
    ],
  },
  {
    id: 'aperture',
    title: 'Aperture vs near field and divergence',
    intro: 'Near-field length scales with the SQUARE of the aperture diameter.',
    columns: ['Near-field length N', 'Far-field divergence', 'Beam width', 'Lateral resolution'],
    experiment: '/ultrasound-lab/beam',
    rows: [
      { label: 'Larger aperture', cells: [up('Longer (∝ D²)'), down('Less'), down('Narrower'), up('Better')] },
      { label: 'Smaller aperture', cells: [down('Shorter'), up('More'), up('Wider'), down('Worse')] },
      { label: 'Higher frequency', cells: [up('Longer'), down('Less'), down('Narrower'), up('Better')] },
    ],
  },
  {
    id: 'damping',
    title: 'Damping vs bandwidth, pulse length, sensitivity and axial resolution',
    intro: 'One control, five consequences — and one of them is a cost.',
    columns: ['Pulse length', 'Bandwidth', 'Q factor', 'Axial resolution', 'Sensitivity'],
    experiment: '/ultrasound-lab/transducer',
    rows: [
      { label: 'More damping', cells: [down('Shorter'), up('Broader'), down('Lower'), up('Better'), down('Reduced')] },
      { label: 'Less damping', cells: [up('Longer'), down('Narrower'), up('Higher'), down('Worse'), up('Greater')] },
    ],
  },
  {
    id: 'depth-prf',
    title: 'Depth vs PRF and frame rate',
    intro: 'Depth sets a hard ceiling on how often you can pulse.',
    columns: ['Listening time', 'Maximum PRF', 'Frame rate', 'Nyquist limit'],
    experiment: '/ultrasound-lab/pulse-echo',
    rows: [
      { label: 'Greater depth', cells: [up('Longer'), down('Lower'), down('Lower'), down('Lower')] },
      { label: 'Shallower depth', cells: [down('Shorter'), up('Higher'), up('Higher'), up('Higher')] },
    ],
  },
  {
    id: 'focal-zones',
    title: 'Focal zones vs lateral resolution and frame rate',
    intro: 'Every extra focal zone is another pulse down every line.',
    columns: ['Lateral resolution at focus', 'Lateral resolution over depth', 'Pulses per frame', 'Frame rate'],
    experiment: '/ultrasound-lab/beam',
    rows: [
      { label: 'One focal zone', cells: [up('Excellent at that depth'), down('Poor elsewhere'), down('Fewest'), up('Highest')] },
      { label: 'Multiple focal zones', cells: [up('Excellent'), up('Good over a range'), up('More'), down('Lower')] },
    ],
  },
  {
    id: 'gain-power',
    title: 'Receiver gain vs output power',
    intro: 'They look similar on screen and are completely different in safety terms.',
    columns: ['Image brightness', 'Noise', 'Signal-to-noise', 'Patient exposure', 'MI and TI'],
    experiment: '/ultrasound-lab/controls',
    rows: [
      { label: 'Receiver gain ↑', cells: [up('Brighter'), up('Amplified too'), flat('Unchanged'), flat('Unchanged'), flat('Unchanged')] },
      { label: 'Output power ↑', cells: [up('Brighter'), flat('Unchanged'), up('Improved'), up('Increased'), up('Increased')] },
    ],
  },
  {
    id: 'interactions',
    title: 'Reflection vs refraction vs scatter vs attenuation',
    intro: 'Four different processes that examiners deliberately blur together.',
    columns: ['What governs it', 'Needs oblique incidence?', 'Effect on the beam', 'Typical artefact'],
    experiment: '/ultrasound-lab/reflection',
    rows: [
      { label: 'Reflection', cells: [flat('Impedance difference'), flat('No'), flat('Energy returns'), flat('Shadowing, reverberation, mirror')] },
      { label: 'Refraction', cells: [flat('Speed difference'), flat('Yes — essential'), flat('Direction changes'), flat('Edge shadow, duplication')] },
      { label: 'Scatter', cells: [flat('Structures < wavelength'), flat('No'), flat('Energy redirected'), flat('Speckle')] },
      { label: 'Attenuation', cells: [flat('Mainly absorption'), flat('No'), flat('Energy lost as heat'), flat('Poor penetration')] },
    ],
  },
  {
    id: 'resolutions',
    title: 'Axial vs lateral vs elevational vs temporal resolution',
    intro: 'Know which control changes which resolution.',
    columns: ['Determined by', 'Improved by', 'Varies with depth?', 'Typical value'],
    experiment: '/ultrasound-lab/resolution',
    rows: [
      { label: 'Axial', cells: [flat('Spatial pulse length'), flat('Higher f, fewer cycles, more damping'), flat('No'), flat('0.5–1 mm')] },
      { label: 'Lateral', cells: [flat('Beam width'), flat('Larger aperture, higher f, focus at target'), flat('Yes — best at focus'), flat('1–3 mm')] },
      { label: 'Elevational', cells: [flat('Slice thickness'), flat('Fixed lens; matrix array'), flat('Yes'), flat('Usually the worst')] },
      { label: 'Temporal', cells: [flat('Frame rate'), flat('Less depth, narrower sector, fewer focal zones'), flat('Indirectly'), flat('20–100 Hz')] },
    ],
  },
  {
    id: 'probes',
    title: 'Linear vs curvilinear vs phased array',
    intro: 'Footprint and frequency are separate selection criteria.',
    columns: ['Field of view', 'Footprint', 'Typical frequency', 'Best for'],
    experiment: '/ultrasound-lab/probes',
    rows: [
      { label: 'Linear array', cells: [flat('Rectangular'), flat('Large, flat'), flat('5–15 MHz'), flat('Superficial: vascular, thyroid, MSK')] },
      { label: 'Curvilinear', cells: [flat('Sector / trapezoid'), flat('Large, curved'), flat('2–5 MHz'), flat('Abdomen, pelvis, obstetrics')] },
      { label: 'Phased array', cells: [flat('Sector from a point'), flat('Very small'), flat('1–5 MHz'), flat('Cardiac, intercostal, transcranial')] },
    ],
  },
  {
    id: 'doppler-modes',
    title: 'CW vs PW vs colour vs power Doppler',
    intro: 'Aliasing, range resolution and direction separate these four.',
    columns: ['Range resolution', 'Aliases?', 'Shows direction?', 'Measures velocity?'],
    experiment: '/ultrasound-lab/doppler',
    rows: [
      { label: 'Continuous wave', cells: [down('None'), up('No'), up('Yes'), up('Yes — very high velocities')] },
      { label: 'Pulsed wave', cells: [up('Yes'), down('Yes'), up('Yes'), up('Yes, up to Nyquist')] },
      { label: 'Colour', cells: [up('Yes'), down('Yes'), up('Yes'), flat('Mean velocity only')] },
      { label: 'Power', cells: [up('Yes'), up('No'), down('No'), down('No')] },
    ],
  },
  {
    id: 'mi-ti',
    title: 'Mechanical index vs thermal index',
    intro: 'Two indices, two entirely different risks.',
    columns: ['What it estimates', 'Equation / basis', 'Rises with', 'Falls with', 'Key numbers'],
    experiment: '/ultrasound-lab/safety',
    rows: [
      {
        label: 'Mechanical index',
        cells: [flat('Cavitation, non-thermal'), flat('p₋ / √f'), flat('Rarefactional pressure'), flat('Frequency'), flat('0.7 with contrast; 0.3 neonatal lung')],
      },
      {
        label: 'Thermal index',
        cells: [flat('Tissue heating'), flat('Power used / power for 1 °C rise'), flat('Power, dwell time, bone, Doppler mode, frequency'), flat('Perfusion'), flat('Restrict time above 0.7; avoid above 3.0 in obstetrics')],
      },
    ],
  },
  {
    id: 'harmonics',
    title: 'Fundamental vs tissue harmonic imaging',
    intro: 'Harmonics buy contrast, not lateral resolution.',
    columns: ['Where the signal is created', 'Near-field clutter', 'Side-lobe artefact', 'Contrast resolution', 'Penetration'],
    experiment: '/ultrasound-lab/harmonics',
    rows: [
      { label: 'Fundamental', cells: [flat('At the transducer'), up('Present'), up('Present'), down('Lower'), up('Better')] },
      { label: 'Tissue harmonic', cells: [flat('Within tissue, builds with depth'), down('Much reduced'), down('Much reduced'), up('Better'), down('Reduced')] },
    ],
  },
  {
    id: 'shadow-enhance',
    title: 'Shadowing vs enhancement',
    intro: 'Both are attenuation artefacts, in opposite directions.',
    columns: ['Cause', 'Appearance beyond the lesion', 'Classic example'],
    experiment: '/ultrasound-lab/artefacts',
    rows: [
      { label: 'Acoustic shadowing', cells: [flat('High attenuation or strong reflection'), flat('Dark band'), flat('Gallstone, bone, calcification')] },
      { label: 'Clean vs dirty shadow', cells: [flat('Absorption vs gas reverberation'), flat('Sharp anechoic vs noisy'), flat('Stone vs bowel gas')] },
      { label: 'Posterior enhancement', cells: [flat('Low attenuation'), flat('Bright band'), flat('Simple cyst, full bladder')] },
    ],
  },
  {
    id: 'specular-diffuse',
    title: 'Specular vs diffuse reflection vs scatter',
    intro: 'Size relative to wavelength decides which one you get.',
    columns: ['Interface size', 'Surface', 'Angle dependence', 'Example'],
    experiment: '/ultrasound-lab/reflection',
    rows: [
      { label: 'Specular', cells: [flat('Larger than λ'), flat('Smooth'), up('Strong — must be perpendicular'), flat('Diaphragm, vessel wall')] },
      { label: 'Diffuse', cells: [flat('Larger than λ'), flat('Rough'), flat('Moderate'), flat('Organ capsule')] },
      { label: 'Scatter', cells: [flat('Smaller than λ'), flat('n/a'), down('Weak — nearly independent'), flat('Red blood cells, parenchyma')] },
    ],
  },
  {
    id: 'prf-nyquist',
    title: 'PRF vs Nyquist limit and aliasing',
    intro: 'Which fixes genuinely raise the limit, and which only move the display.',
    columns: ['Effect on Nyquist limit', 'Effect on Doppler shift', 'Removes aliasing?', 'Cost'],
    experiment: '/ultrasound-lab/aliasing',
    rows: [
      { label: 'Increase PRF / scale', cells: [up('Raised'), flat('Unchanged'), up('Yes'), flat('Limited by depth; range ambiguity')] },
      { label: 'Shift baseline', cells: [flat('Unchanged'), flat('Unchanged'), flat('Only marginal wrap'), flat('Loses reverse-flow display')] },
      { label: 'Lower transmit frequency', cells: [flat('Unchanged'), down('Reduced'), up('Yes'), flat('Worse resolution')] },
      { label: 'Reduce depth', cells: [up('Raised'), flat('Unchanged'), up('Yes'), flat('Only if clinically possible')] },
      { label: 'Switch to CW', cells: [flat('Not applicable'), flat('Unchanged'), up('Yes — cannot alias'), flat('No range resolution')] },
    ],
  },
]
