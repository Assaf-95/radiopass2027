/**
 * The source-driven ultrasound content map.
 *
 * Every fact here is traceable. `source` names where it came from:
 *
 *  - "QBank Qnnn" — the project question bank
 *    (RadioPass-Master/site/physics/physics-question-bank-data.js, topic
 *    "Ultrasound": 43 questions, 155 true/false stems).
 *  - "Recall YYYY" — that question carries a recall year, so the concept has
 *    been reported in a sitting. These drive the HIGH-YIELD RECALL badge.
 *  - "Fact Bank" — the existing site fact bank (src/factbank.tsx, topic "us").
 *  - "Standard physics" — mainstream ultrasound physics used to complete the
 *    syllabus where the sources are silent.
 *
 * Where a source is scientifically wrong or its wording is misleading, the fact
 * carries a `clarify` note and the `clarify` priority badge. Those statements
 * are never reproduced silently.
 */

import type { FactPriority } from '../components/Layout'
import type { Delta } from '../components/Teaching'

export type UsCategory =
  | 'fundamentals'
  | 'impedance'
  | 'reflection'
  | 'refraction'
  | 'attenuation'
  | 'imaging'
  | 'transducers'
  | 'beam'
  | 'resolution'
  | 'controls'
  | 'doppler'
  | 'artefacts'
  | 'harmonics'
  | 'contrast'
  | 'elastography'
  | 'safety'
  | 'probes'
  | 'qa'

export const CATEGORY_LABEL: Record<UsCategory, string> = {
  fundamentals: 'Fundamentals',
  impedance: 'Acoustic impedance',
  reflection: 'Reflection',
  refraction: 'Refraction',
  attenuation: 'Attenuation',
  imaging: 'Image formation',
  transducers: 'Transducers',
  beam: 'Beam geometry',
  resolution: 'Resolution',
  controls: 'Machine controls',
  doppler: 'Doppler',
  artefacts: 'Artefacts',
  harmonics: 'Harmonics',
  contrast: 'Contrast agents',
  elastography: 'Elastography',
  safety: 'Safety',
  probes: 'Probe selection',
  qa: 'Quality assurance',
}

export type UsFact = {
  id: string
  category: UsCategory
  /** One concise, examinable sentence. */
  fact: string
  /** The expanded explanation. Short paragraphs, no walls of text. */
  detail: string
  priority: FactPriority[]
  equation?: string
  units?: string
  deltas?: Delta[]
  /** Where the fact comes from. */
  source: string
  /** How many separate QBank questions test this concept. */
  weight?: number
  /** The distractor that makes the wrong answer tempting. */
  distractor?: string
  clinical?: string
  /** Route of the experiment that demonstrates it. */
  experiment?: string
  /** Present when a source needed correcting or its wording needs care. */
  clarify?: string
}

export const US_FACTS: UsFact[] = [
  /* ============================================================
   * FUNDAMENTALS
   * ============================================================ */
  {
    id: 'us-mechanical',
    category: 'fundamentals',
    fact: 'Ultrasound is a mechanical pressure wave, not electromagnetic radiation',
    detail:
      'It carries energy by physically displacing particles of the medium, so it **cannot travel through a vacuum**. Diagnostic ultrasound propagates through soft tissue as a **longitudinal** wave: particles oscillate *parallel* to the direction of travel, producing alternating bands of compression and rarefaction.',
    priority: ['core'],
    source: 'Standard physics',
    distractor: 'Describing ultrasound as transverse, or as ionising radiation.',
    experiment: '/ultrasound-lab',
  },
  {
    id: 'us-speed-medium',
    category: 'fundamentals',
    fact: 'The speed of sound is set by the medium, never by the transducer frequency',
    detail:
      'Propagation speed depends on the **stiffness (bulk modulus) and density** of the tissue. Changing the probe frequency changes the wavelength, not the speed. Scanners assume **1540 m/s** for soft tissue: fat is slower (~1450), muscle faster (~1580), cortical bone much faster (~4080), air far slower (~330).',
    priority: ['core', 'recall', 'trap', 'number'],
    equation: 'c = f λ    →    λ = c / f',
    units: 'c in m/s, f in MHz, λ in mm',
    deltas: [
      { label: 'f ↑ → λ ↓', dir: 'down' },
      { label: 'c unchanged', dir: 'flat' },
    ],
    source: 'QBank Q33, Q413 · Fact Bank',
    weight: 4,
    distractor: '“The velocity of ultrasound is dependent on frequency.” Marked FALSE in the recall bank — and it is the single most repeated ultrasound trap.',
    experiment: '/ultrasound-lab',
  },
  {
    id: 'us-speed-values',
    category: 'fundamentals',
    fact: 'Speed of sound: air 330, fat 1450, soft tissue 1540, muscle 1580, bone ~4080 m/s',
    detail:
      'Learn the ladder rather than the decimals. Sound is **slowest in gas, faster in soft tissue, fastest in bone** — the opposite of the intuition that dense means slow, because stiffness rises faster than density. The machine calibrates to 1540 m/s and every depth on screen depends on that assumption.',
    priority: ['number', 'recall'],
    units: 'm/s',
    source: 'QBank Q238, Q379, Q411 · Fact Bank',
    weight: 3,
    distractor: '“The velocity of sound in soft tissue is about 150 m/s” — a factor-of-ten trap in QBank Q379.',
    experiment: '/ultrasound-lab/impedance',
  },
  {
    id: 'us-compressibility',
    category: 'fundamentals',
    fact: 'Speed varies as 1 / √(compressibility × density) — not as the simple reciprocal',
    detail:
      'A stiffer (less compressible) medium transmits sound faster. Because the relationship is a **square root**, doubling the compressibility does not halve the speed. Compressibility and density are independent material properties.',
    priority: ['equation', 'trap'],
    equation: 'c = 1 / √(κ ρ)     κ = compressibility, ρ = density',
    source: 'QBank Q238',
    distractor: '“Speed of sound is inversely proportional to compressibility.” FALSE — it varies as one over the square root.',
    experiment: '/ultrasound-lab',
  },
  {
    id: 'us-frequency-range',
    category: 'fundamentals',
    fact: 'Diagnostic ultrasound runs at roughly 2–15 MHz, giving wavelengths of about 0.1–0.8 mm',
    detail:
      'Ultrasound is defined as sound above the audible limit of **20 kHz**. Diagnostic imaging uses megahertz frequencies because the wavelength has to be small enough to resolve millimetre anatomy. At 1540 m/s, 3 MHz gives λ ≈ 0.51 mm and 10 MHz gives λ ≈ 0.15 mm.',
    priority: ['number'],
    equation: 'λ (mm) = 1.54 / f (MHz)   in soft tissue',
    source: 'Fact Bank · QBank Q352',
    experiment: '/ultrasound-lab',
  },
  {
    id: 'us-pulse-terms',
    category: 'fundamentals',
    fact: 'Spatial pulse length = number of cycles × wavelength',
    detail:
      'Pulse duration is the same idea in time: **cycles × period**. Both shrink when the frequency rises (shorter wavelength) or when damping removes cycles. SPL is the quantity that sets axial resolution, so everything that shortens the pulse sharpens the image along the beam.',
    priority: ['equation', 'core'],
    equation: 'SPL = n × λ        PD = n × T = n / f',
    units: 'SPL in mm, PD in µs',
    deltas: [
      { label: 'f ↑ → SPL ↓', dir: 'down' },
      { label: 'cycles ↓ → SPL ↓', dir: 'down' },
    ],
    source: 'QBank Q321, Q352, Q411',
    weight: 3,
    experiment: '/ultrasound-lab/resolution',
  },
  {
    id: 'us-prf-duty',
    category: 'fundamentals',
    fact: 'PRF = 1 / PRP, and duty factor = pulse duration / pulse repetition period',
    detail:
      'The probe transmits for only a tiny fraction of each cycle. A typical duty factor is well under **1%**, so the transducer is in **“listening mode” for more than 99% of the time**. That is also why average intensity is far lower than peak intensity.',
    priority: ['equation', 'number'],
    equation: 'PRF = 1 / PRP        Duty factor = PD / PRP',
    units: 'PRF in Hz, PRP and PD in µs',
    source: 'QBank Q379 · Standard physics',
    distractor: 'Confusing duty factor with the fraction of the image that is real-time.',
    experiment: '/ultrasound-lab',
  },
  {
    id: 'us-intensity',
    category: 'fundamentals',
    fact: 'Intensity = power / area, so a narrower beam concentrates the same power',
    detail:
      'Focusing does not create energy; it **redistributes** it. That is why intensity peaks at the focal zone and why safety indices care about where the beam is narrowest. Amplitude changes intensity; it does not change wavelength or speed.',
    priority: ['equation'],
    equation: 'I = P / A          I ∝ (amplitude)²',
    units: 'I in W/cm², P in W, A in cm²',
    source: 'Standard physics',
    experiment: '/ultrasound-lab',
  },
  {
    id: 'us-scatter-small',
    category: 'fundamentals',
    fact: 'Ultrasound does interact with structures smaller than the wavelength — by scattering',
    detail:
      'Objects much smaller than the wavelength, such as **red blood cells**, do not reflect specularly; they **scatter** energy in all directions. That is precisely what makes Doppler possible and what produces the speckle texture inside solid organs.',
    priority: ['core', 'trap'],
    source: 'QBank Q320, Q412',
    distractor: '“Ultrasound does not interact with structures smaller than the wavelength.” FALSE — it scatters off them.',
    experiment: '/ultrasound-lab/reflection',
  },

  /* ============================================================
   * IMPEDANCE
   * ============================================================ */
  {
    id: 'us-z-equation',
    category: 'impedance',
    fact: 'Acoustic impedance Z = density × propagation speed',
    detail:
      'Z depends on **both** density and speed — never on density alone, and never on the probe frequency. It is measured in **rayls** (kg m⁻² s⁻¹), usually quoted in MRayl. Soft tissue is about 1.63 MRayl, air 0.0004, cortical bone about 7.8.',
    priority: ['equation', 'core', 'recall', 'number'],
    equation: 'Z = ρ c',
    units: 'Z in rayl (kg m⁻² s⁻¹); MRayl = 10⁶ rayl',
    deltas: [
      { label: 'ρ ↑ → Z ↑', dir: 'up' },
      { label: 'c ↑ → Z ↑', dir: 'up' },
      { label: 'frequency: no effect', dir: 'flat' },
    ],
    source: 'QBank Q31, Q195, Q350 · Fact Bank',
    weight: 5,
    distractor: '“Acoustic impedance is affected by probe frequency” and “…is the sum of the attenuation of the tissues” — both FALSE in the recall collection.',
    experiment: '/ultrasound-lab/impedance',
  },
  {
    id: 'us-z-units',
    category: 'impedance',
    fact: 'Impedance is measured in rayls, not decibels',
    detail:
      'Decibels express a **ratio** of two intensities, which is why attenuation is quoted in dB. Impedance is an absolute material property with its own unit. Impedance is also intrinsic: it does not change because the tissue is moving.',
    priority: ['trap', 'number'],
    source: 'QBank Q350',
    distractor: '“Acoustic impedance is measured in units of decibels.” FALSE.',
    experiment: '/ultrasound-lab/impedance',
  },
  {
    id: 'us-reflection-coefficient',
    category: 'impedance',
    fact: 'At normal incidence, R = ((Z₂ − Z₁)/(Z₂ + Z₁))²',
    detail:
      'Reflection is governed by the **difference** in impedance across the boundary. Swap the two media and R is unchanged. Similar impedances (soft tissue against fluid, or against muscle) reflect very little and transmit almost everything; that is what lets the beam reach deep structures at all.',
    priority: ['equation', 'core', 'recall'],
    equation: 'R = ((Z₂ − Z₁) / (Z₂ + Z₁))²        T ≈ 1 − R',
    units: 'dimensionless fraction (×100 for %)',
    deltas: [
      { label: 'ΔZ ↑ → reflection ↑', dir: 'up' },
      { label: 'ΔZ ↑ → transmission ↓', dir: 'down' },
    ],
    source: 'QBank Q85, Q195, Q239',
    weight: 4,
    distractor: '“Reflection occurs when there is a difference in tissue densities.” FALSE — it is a difference in *impedance*, which needs both density and speed.',
    experiment: '/ultrasound-lab/impedance',
  },
  {
    id: 'us-air-interface',
    category: 'impedance',
    fact: 'A soft tissue–air interface reflects over 99% of the beam',
    detail:
      'Air has an impedance roughly **four thousand times lower** than soft tissue, so almost nothing is transmitted. This is why **coupling gel** is essential — it displaces the air layer between probe and skin — and why bowel gas and aerated lung block the image completely.',
    priority: ['core', 'recall', 'clinical', 'number'],
    source: 'QBank Q31, Q195 · Fact Bank',
    weight: 3,
    clinical: 'Gel does not "boost" the beam. It removes the interface that would otherwise reflect it.',
    experiment: '/ultrasound-lab/impedance',
  },
  {
    id: 'us-soft-fluid',
    category: 'impedance',
    fact: 'Reflection at a soft tissue–fluid interface is very small — well under 15%',
    detail:
      'Simple fluid (Z ≈ 1.48 MRayl) and soft tissue (Z ≈ 1.63) are close, so R works out at roughly **0.2%**. Weak boundary reflection plus very low attenuation inside the fluid is exactly the recipe for a sharp-walled, anechoic, posteriorly enhancing cyst.',
    priority: ['number', 'recall', 'clinical'],
    source: 'QBank Q195',
    distractor: '“15% of ultrasound is reflected at a soft tissue–fluid interface.” FALSE — the true figure is a fraction of one per cent.',
    experiment: '/ultrasound-lab/impedance',
  },
  {
    id: 'us-muscle-fat-z',
    category: 'impedance',
    fact: 'Muscle has a higher acoustic impedance than fat',
    detail:
      'Muscle is both slightly denser and appreciably faster (1580 vs 1450 m/s), so Z is higher (≈1.71 vs ≈1.38 MRayl). The fat–muscle interface is one of the mismatches that makes musculoskeletal anatomy visible.',
    priority: ['number'],
    source: 'QBank Q350, Q411',
    experiment: '/ultrasound-lab/impedance',
  },
  {
    id: 'us-detectable-echo',
    category: 'impedance',
    fact: 'An echo of 1% of the incident intensity, or less, is easily detectable',
    detail:
      'Receivers work across a very wide dynamic range, so a boundary does not need to reflect a large fraction of the beam to appear on the image. If it did, nothing beyond the first interface would ever be seen.',
    priority: ['trap', 'number'],
    source: 'QBank Q411',
    distractor: '“At least 5% of the incident beam must be reflected for a boundary to be detected.” FALSE.',
    experiment: '/ultrasound-lab/impedance',
  },

  /* ============================================================
   * REFLECTION
   * ============================================================ */
  {
    id: 'us-law-reflection',
    category: 'reflection',
    fact: 'The angle of reflection equals the angle of incidence',
    detail:
      'At a large smooth boundary the beam behaves like light on a mirror. Only when the beam strikes **perpendicular** (normal incidence) does the echo travel straight back into the probe. Tilt the probe and the reflected energy goes elsewhere, and the interface darkens or disappears.',
    priority: ['core', 'equation'],
    equation: 'θ_incidence = θ_reflection',
    source: 'QBank Q351 · Standard physics',
    clinical: 'Keep the beam perpendicular to a vessel wall, tendon or diaphragm to get the brightest, most reliable echo.',
    experiment: '/ultrasound-lab/reflection',
  },
  {
    id: 'us-brightness-angle',
    category: 'reflection',
    fact: 'B-mode brightness depends on probe angle relative to the interface',
    detail:
      'Maximum echo strength comes from **normal incidence**. Brightness reflects the **echo intensity received**, which depends on the impedance *difference* across the boundary and the geometry — not on the absolute impedance of either tissue.',
    priority: ['core', 'trap'],
    source: 'QBank Q351',
    distractor: '“Image brightness is proportional to the acoustic impedance of the tissues.” FALSE — it tracks the echo intensity, which comes from the impedance *difference*.',
    experiment: '/ultrasound-lab/reflection',
  },
  {
    id: 'us-specular-diffuse',
    category: 'reflection',
    fact: 'Specular reflection needs a smooth interface larger than the wavelength; smaller or rougher structures scatter',
    detail:
      'A **specular** reflector (diaphragm, vessel wall, bladder wall) is strongly angle-dependent. **Diffuse** reflection from a rough surface returns some energy over a range of angles. **Scattering** from structures far smaller than the wavelength is weak but nearly angle-independent — which is why parenchyma looks the same however you tilt the probe.',
    priority: ['core'],
    source: 'QBank Q320, Q412 · Standard physics',
    experiment: '/ultrasound-lab/reflection',
  },
  {
    id: 'us-speckle-origin',
    category: 'reflection',
    fact: 'Speckle is an interference pattern, not a picture of tissue microstructure',
    detail:
      'Multiple scattering events from structures smaller than the wavelength interfere constructively and destructively within each resolution cell. The result is the characteristic grainy texture. It is **not** diffuse reflection at tissue boundaries.',
    priority: ['trap'],
    source: 'QBank Q412',
    distractor: '“Speckle signal is due to diffuse reflection at tissue boundaries.” FALSE — it is interference between scattered wavelets.',
    experiment: '/ultrasound-lab/artefacts',
  },
  {
    id: 'us-anisotropy',
    category: 'reflection',
    fact: 'Anisotropy: a tendon looks falsely hypoechoic when the beam is not perpendicular',
    detail:
      'Tendon fibres are strong, highly angle-dependent reflectors. Off-perpendicular, the echoes miss the probe and the tendon darkens — mimicking a tear. Correct it by **heel–toe rocking** the probe until the fibrillar pattern returns. This is a geometry artefact, not an attenuation effect.',
    priority: ['clinical', 'trap'],
    source: 'Standard physics',
    clinical: 'Always confirm apparent tendon hypoechogenicity by re-angling the probe before calling a tear.',
    experiment: '/ultrasound-lab/reflection',
  },

  /* ============================================================
   * REFRACTION
   * ============================================================ */
  {
    id: 'us-snell',
    category: 'refraction',
    fact: 'Refraction follows sin θ₁ / c₁ = sin θ₂ / c₂',
    detail:
      'The transmitted beam changes direction when it crosses into a medium with a **different propagation speed** at an **oblique** angle. Entering a faster medium it bends *away* from the normal; entering a slower medium it bends *towards* the normal.',
    priority: ['equation', 'core'],
    equation: 'sin θ₁ / c₁ = sin θ₂ / c₂',
    deltas: [
      { label: 'c₂ > c₁ → bends away from normal', dir: 'up' },
      { label: 'c₂ < c₁ → bends towards normal', dir: 'down' },
    ],
    source: 'QBank Q379, Q382 · Standard physics',
    experiment: '/ultrasound-lab/refraction',
  },
  {
    id: 'us-refraction-conditions',
    category: 'refraction',
    fact: 'Refraction requires BOTH oblique incidence and a speed difference',
    detail:
      'At **normal incidence there is no refraction**, however different the two media are. And if the speeds match, the beam continues straight however oblique the angle. Reflection and refraction are related but distinct: reflection is controlled by the **impedance** mismatch, refraction by the **speed** difference and the angle.',
    priority: ['core', 'trap'],
    source: 'QBank Q320, Q379',
    distractor: 'Treating reflection and refraction as the same process, or expecting refraction at normal (0°) incidence — when the beam strikes the interface perpendicularly, it does not bend.',
    experiment: '/ultrasound-lab/refraction',
  },
  {
    id: 'us-refraction-frequency',
    category: 'refraction',
    fact: 'Refraction does not depend on the transmit frequency',
    detail:
      'The amount of bending depends only on the **angle of incidence and the two propagation speeds**. Lowering the frequency will not reduce a refraction artefact — changing the scanning window or the angle of approach will.',
    priority: ['trap'],
    source: 'QBank Q382',
    distractor: '“Refraction artefacts can be reduced by reducing the transmit frequency.” FALSE.',
    experiment: '/ultrasound-lab/refraction',
  },
  {
    id: 'us-critical-angle',
    category: 'refraction',
    fact: 'A critical angle only exists when the second medium is FASTER than the first',
    detail:
      'Total internal reflection needs c₂ > c₁, so that sin θ₂ reaches 1 before θ₁ reaches 90°. Going from a fast medium into a slow one, no critical angle exists at all.',
    priority: ['equation', 'clarify'],
    equation: 'θ_critical = arcsin(c₁ / c₂)     only when c₂ > c₁',
    source: 'Standard physics',
    clarify:
      'Diagrams that show a critical angle for any pair of tissues are wrong. The laboratory only offers one when the selected speed relationship physically permits it.',
    experiment: '/ultrasound-lab/refraction',
  },

  /* ============================================================
   * ATTENUATION
   * ============================================================ */
  {
    id: 'us-attenuation-exponential',
    category: 'attenuation',
    fact: 'Intensity falls exponentially with depth: a fixed fraction is lost per centimetre',
    detail:
      'Exponential decay means the beam loses the **same relative amount** in every centimetre it travels, not the same absolute amount. Expressed in decibels the loss becomes linear with depth, which is why the dB model is the clinically useful one.',
    priority: ['equation', 'core'],
    equation: 'I = I₀ e^(−µx)        dB = α × f × x',
    units: 'µ in cm⁻¹; α in dB/cm/MHz; f in MHz; x in cm',
    source: 'QBank Q320, Q410',
    weight: 2,
    experiment: '/ultrasound-lab/attenuation',
  },
  {
    id: 'us-attenuation-coefficient',
    category: 'attenuation',
    fact: 'Soft tissue attenuates at roughly 0.5–1.0 dB/cm/MHz',
    detail:
      'The QBank quotes **0.8 dB/cm/MHz** as a typical single figure and gives the range as 0.5–1.0. A common clinical rule of thumb is **1 dB/cm/MHz for the round trip** through soft tissue. Attenuation rises with both depth and frequency, which is the whole penetration problem in one line.',
    priority: ['number', 'recall'],
    equation: 'Attenuation (dB) = α (dB/cm/MHz) × f (MHz) × path (cm)',
    deltas: [
      { label: 'f ↑ → attenuation ↑', dir: 'up' },
      { label: 'depth ↑ → attenuation ↑', dir: 'up' },
      { label: 'penetration ↓', dir: 'down' },
    ],
    source: 'QBank Q320, Q410 · Fact Bank',
    weight: 3,
    clarify:
      'The QBank stem reads “0.8 dB/cm at 1 MHz”, which is the same quantity as 0.8 dB/cm/MHz. Only apply the frequency multiplier when the coefficient is expressed per MHz.',
    experiment: '/ultrasound-lab/attenuation',
  },
  {
    id: 'us-attenuation-absorption',
    category: 'attenuation',
    fact: 'Attenuation in soft tissue is mainly ABSORPTION, not reflection and scatter',
    detail:
      'Absorption converts acoustic energy into **heat** and dominates the loss in soft tissue. Scatter redirects energy away from the beam, and reflection at interfaces removes some too — but the QBank explicitly marks “mainly due to reflection and scattering at boundaries” as FALSE.',
    priority: ['core', 'trap'],
    source: 'QBank Q410, Q320',
    distractor: '“Attenuation is mainly due to reflection and scattering at boundaries.” FALSE — absorption dominates.',
    experiment: '/ultrasound-lab/attenuation',
  },
  {
    id: 'us-attenuation-not-z',
    category: 'attenuation',
    fact: 'Attenuation has no relationship to acoustic impedance',
    detail:
      'They are independent tissue properties. Water has an impedance close to soft tissue but attenuates almost nothing; bone has a high impedance *and* high attenuation, but the two facts are not causally linked.',
    priority: ['trap'],
    source: 'QBank Q410',
    distractor: '“Attenuation is proportional to the acoustic impedance of the tissue.” FALSE.',
    experiment: '/ultrasound-lab/attenuation',
  },
  {
    id: 'us-lung-bone-attenuation',
    category: 'attenuation',
    fact: 'Lung and bone attenuate severely; water and simple fluid attenuate almost nothing',
    detail:
      'Aerated lung presents countless gas–tissue interfaces that reflect and scatter the beam away. Bone absorbs powerfully. Fluid is the opposite extreme, which is why a full bladder makes such a good acoustic window.',
    priority: ['number', 'recall', 'clinical'],
    source: 'QBank Q239 · Fact Bank',
    experiment: '/ultrasound-lab/attenuation',
  },
  {
    id: 'us-tgc',
    category: 'attenuation',
    fact: 'TGC amplifies later-returning echoes to compensate for depth-dependent loss',
    detail:
      'Time gain compensation applies **depth-dependent** receiver amplification so that identical reflectors at different depths appear equally bright. It is purely a **receive-side** correction: it does not put energy back into the transmitted beam, does not change the attenuation happening in tissue, and does not increase patient exposure.',
    priority: ['core', 'recall', 'clinical'],
    deltas: [
      { label: 'deep echoes brighter', dir: 'up' },
      { label: 'patient exposure unchanged', dir: 'flat' },
      { label: 'noise amplified too', dir: 'warn' },
    ],
    source: 'QBank Q379 · Fact Bank',
    weight: 2,
    clinical: 'TGC can also be used to *suppress* the over-bright band behind a fluid-filled structure.',
    experiment: '/ultrasound-lab/attenuation',
  },
  {
    id: 'us-gain-vs-power',
    category: 'attenuation',
    fact: 'Receiver gain amplifies echoes; output power changes what enters the patient',
    detail:
      'Turning up **gain** or TGC brightens the image and amplifies the noise with it — but the acoustic exposure is unchanged. Turning up **output power** puts more energy into the patient and raises MI and TI. Optimise gain, TGC, frequency, focus, depth and probe position **before** reaching for power.',
    priority: ['core', 'safety', 'trap'],
    deltas: [
      { label: 'gain ↑ → exposure unchanged', dir: 'flat' },
      { label: 'power ↑ → exposure ↑', dir: 'warn' },
    ],
    source: 'Standard physics · Fact Bank',
    distractor: 'Treating "turn up the gain" and "turn up the power" as the same manoeuvre.',
    experiment: '/ultrasound-lab/controls',
  },
  {
    id: 'us-heat-fate',
    category: 'attenuation',
    fact: 'Most of the transmitted energy ends up as heat in the patient',
    detail:
      'Only a tiny fraction of the beam returns as detectable echoes. Everything else is absorbed and converted to heat — which is exactly why thermal bioeffects are a genuine safety consideration.',
    priority: ['core', 'safety'],
    source: 'QBank Q320',
    experiment: '/ultrasound-lab/safety',
  },

  /* ============================================================
   * IMAGE FORMATION
   * ============================================================ */
  {
    id: 'us-depth-equation',
    category: 'imaging',
    fact: 'Depth = c × t / 2 — the division by two is the round trip',
    detail:
      'The machine measures the time from transmission to echo. That time covers the journey **out to the reflector and back**, so the distance to the reflector is half of c × t. At 1540 m/s a reflector 1 cm deep returns its echo in about **13 µs**.',
    priority: ['equation', 'core', 'number'],
    equation: 'depth = c t / 2      ≈ 13 µs per cm of depth',
    units: 'c in m/s, t in s, depth in m',
    source: 'QBank Q351 · Standard physics',
    weight: 2,
    distractor: 'Forgetting the factor of two and doubling every depth on the image.',
    experiment: '/ultrasound-lab/pulse-echo',
  },
  {
    id: 'us-machine-assumptions',
    category: 'imaging',
    fact: 'The scanner assumes 1540 m/s, straight-line travel and echoes from the main beam only',
    detail:
      'Four working assumptions build the image: constant speed of **1540 m/s**, **straight-line** propagation, echoes originating from the **main beam**, and attenuation that is uniform or predictably compensated. Every classic artefact is one of these assumptions being violated.',
    priority: ['core'],
    source: 'Standard physics',
    experiment: '/ultrasound-lab/pulse-echo',
  },
  {
    id: 'us-brightness-amplitude',
    category: 'imaging',
    fact: 'Echo amplitude sets pixel brightness; return time sets pixel depth',
    detail:
      'That single sentence is B-mode. A-mode plots amplitude against depth on one line; **B-mode** turns amplitude into brightness and sweeps many lines into a two-dimensional image; **M-mode** repeats one line over time to show motion.',
    priority: ['core'],
    source: 'QBank Q351 · Standard physics',
    experiment: '/ultrasound-lab/pulse-echo',
  },
  {
    id: 'us-bmode-one-pulse',
    category: 'imaging',
    fact: 'B-mode sends one pulse per scan line; A-mode and M-mode repeat pulses down a single line',
    detail:
      'A B-mode frame is built by stepping the beam across the field of view, one pulse per line, then starting again. Images refresh in real time.',
    priority: ['clarify'],
    source: 'QBank Q351',
    clarify:
      'The QBank stem is true for a simple single-focus B-mode frame. Selecting **multiple focal zones** does send several pulses down each line — which is exactly why extra focal zones cost frame rate.',
    experiment: '/ultrasound-lab/pulse-echo',
  },
  {
    id: 'us-prf-depth',
    category: 'imaging',
    fact: 'Maximum PRF is limited by imaging depth',
    detail:
      'The next pulse cannot be sent until the echoes from the deepest displayed structure have returned, otherwise their origin becomes ambiguous. **Deeper imaging → longer listening time → lower maximum PRF → lower frame rate.**',
    priority: ['core', 'recall'],
    equation: 'PRF_max = c / (2 × depth_max)',
    deltas: [
      { label: 'depth ↑ → PRF max ↓', dir: 'down' },
      { label: 'depth ↑ → frame rate ↓', dir: 'down' },
    ],
    source: 'QBank Q210, Q351',
    weight: 3,
    experiment: '/ultrasound-lab/pulse-echo',
  },
  {
    id: 'us-frame-rate-levers',
    category: 'imaging',
    fact: 'Frame rate falls with depth, sector width, line density and number of focal zones',
    detail:
      'Every extra scan line and every extra focal zone costs one more pulse–listen cycle per frame. **Narrowing the sector raises the frame rate**; widening it lowers it. This is the temporal-resolution trade-off in one sentence.',
    priority: ['core', 'recall'],
    equation: 'frame rate = PRF / (lines per frame × focal zones)',
    deltas: [
      { label: 'sector width ↓ → frame rate ↑', dir: 'up' },
      { label: 'focal zones ↑ → frame rate ↓', dir: 'down' },
      { label: 'line density ↑ → frame rate ↓', dir: 'down' },
    ],
    source: 'QBank Q446, Q289',
    weight: 2,
    experiment: '/ultrasound-lab/resolution',
  },
  {
    id: 'us-operator-controls',
    category: 'imaging',
    fact: 'PRF, frame rate and focal zone are all under operator control',
    detail:
      'The recall collection lists these three explicitly. Image optimisation is an active skill: depth, sector width, line density, focus position and number of focal zones all sit in the sonographer’s hands.',
    priority: ['recall', 'clinical'],
    source: 'QBank Q289 · Fact Bank',
    experiment: '/ultrasound-lab/controls',
  },

  /* ============================================================
   * TRANSDUCERS
   * ============================================================ */
  {
    id: 'us-piezo',
    category: 'transducers',
    fact: 'The piezoelectric effect works in both directions',
    detail:
      'The **inverse** effect converts an applied voltage into mechanical vibration, transmitting the pulse. The **direct** effect converts a returning pressure wave into a voltage, receiving the echo. The same element does both, which is why the probe must stop transmitting before it can listen.',
    priority: ['core'],
    source: 'Standard physics',
    experiment: '/ultrasound-lab/transducer',
  },
  {
    id: 'us-resonance-thickness',
    category: 'transducers',
    fact: 'Resonant frequency is set by element THICKNESS, not diameter',
    detail:
      'A thickness-mode element resonates when its thickness equals **half a wavelength in the crystal**, so f = c_crystal / 2t. A **thicker element resonates at a lower frequency and therefore emits a longer wavelength**. The diameter sets the aperture — and therefore the beam shape and lateral resolution — not the frequency.',
    priority: ['equation', 'core', 'trap'],
    equation: 't = λ_crystal / 2        f = c_crystal / (2 t)',
    deltas: [
      { label: 'thickness ↑ → frequency ↓', dir: 'down' },
      { label: 'thickness ↑ → wavelength ↑', dir: 'up' },
    ],
    source: 'QBank Q411, Q422',
    weight: 2,
    distractor: '“The transducer crystal resonates at a frequency determined by its diameter.” FALSE.',
    clarify:
      'QBank Q422A (“a thicker transducer will emit ultrasound with a longer wavelength”) is correctly marked TRUE, but its printed explanation begins “for a given resonant frequency”, which contradicts itself. The correct reasoning is: thicker element → **lower** resonant frequency → longer wavelength. Note also that the half-wavelength rule is often mis-stated as a full wavelength.',
    experiment: '/ultrasound-lab/transducer',
  },
  {
    id: 'us-matching-layer',
    category: 'transducers',
    fact: 'The matching layer bridges the huge impedance gap between crystal and tissue',
    detail:
      'PZT has an impedance near **30 MRayl** against roughly 1.63 for tissue, so without help almost nothing would be transmitted. The ideal single matching layer has the **geometric mean** impedance and is a **quarter of a wavelength** thick at the design frequency. It is needed *in addition to* the coupling gel, which solves a different problem — the air gap at the skin.',
    priority: ['core', 'equation'],
    equation: 'Z_match = √(Z_crystal × Z_tissue)        thickness = λ / 4',
    source: 'QBank Q446 · Standard physics',
    experiment: '/ultrasound-lab/transducer',
  },
  {
    id: 'us-damping',
    category: 'transducers',
    fact: 'More damping → shorter pulse → wider bandwidth → lower Q → better axial resolution → less sensitivity',
    detail:
      'The backing block absorbs the ringing behind the crystal. Every consequence follows from the shorter pulse. The price is **sensitivity**: a shorter pulse carries less energy, so weak deep echoes are harder to detect. This chain is one of the most reliably examined relationships in the whole syllabus.',
    priority: ['core', 'recall'],
    deltas: [
      { label: 'damping ↑ → cycles ↓', dir: 'down' },
      { label: 'bandwidth ↑', dir: 'up' },
      { label: 'Q factor ↓', dir: 'down' },
      { label: 'axial resolution ↑', dir: 'up' },
      { label: 'sensitivity ↓', dir: 'warn' },
    ],
    source: 'Standard physics · QBank Q411',
    weight: 2,
    experiment: '/ultrasound-lab/transducer',
  },
  {
    id: 'us-cw-bandwidth',
    category: 'transducers',
    fact: 'A continuous-wave probe produces a narrow band of frequencies; a short pulse needs a broad one',
    detail:
      'A pure continuous tone is essentially a single frequency. To build a **short** pulse you must sum a wide range of frequencies, so a heavily damped imaging probe is inherently broadband. High Q means narrow bandwidth and a long ringing pulse.',
    priority: ['core'],
    source: 'QBank Q411',
    experiment: '/ultrasound-lab/transducer',
  },
  {
    id: 'us-electronic-focus',
    category: 'transducers',
    fact: 'Electronic focusing fires the OUTER elements first',
    detail:
      'The outer elements are further from the focal point, so their wavefronts must set off **earlier** to arrive at the focus at the same instant as those from the centre. Delaying the outer elements would defocus the beam. Reversing the delay pattern steers the beam instead.',
    priority: ['core', 'clarify'],
    source: 'QBank Q446',
    clarify:
      'QBank Q446A states that focusing is achieved “by triggering inner elements before the outer ones” and marks it TRUE. That is the wrong way round and this laboratory does not reproduce it: to focus, the **outer** elements must be excited first. The examinable principle — that focusing is achieved by *timing delays between elements* — is unaffected.',
    experiment: '/ultrasound-lab/transducer',
  },
  {
    id: 'us-array-types',
    category: 'transducers',
    fact: 'Phased arrays steer and focus electronically; annular arrays focus but do not steer',
    detail:
      'A **phased array** applies delays across a small aperture to sweep the beam through a sector and to place the focus at any depth. An **annular array** consists of concentric rings — excellent focusing in both planes, but no electronic steering, so it needs mechanical movement.',
    priority: ['core', 'trap'],
    source: 'QBank Q412, Q446',
    distractor: '“Beam steering is optimal with an annular array.” FALSE.',
    experiment: '/ultrasound-lab/transducer',
  },
  {
    id: 'us-dynamic-receive',
    category: 'transducers',
    fact: 'Transmit focus is fixed per pulse; receive focus can track continuously',
    detail:
      'Dynamic receive focusing continually updates the delay pattern as echoes arrive from deeper structures, and the active aperture widens with depth to hold the f-number roughly constant. It costs nothing in frame rate — unlike adding transmit focal zones.',
    priority: ['core'],
    source: 'Standard physics',
    experiment: '/ultrasound-lab/beam',
  },

  /* ============================================================
   * BEAM GEOMETRY
   * ============================================================ */
  {
    id: 'us-near-field',
    category: 'beam',
    fact: 'Near-field length N = a²/λ = D²/4λ',
    detail:
      'The Fresnel (near) zone is where the beam is roughly collimated and narrows to its natural focus. Beyond it the Fraunhofer (far) zone diverges. A **larger aperture** or a **higher frequency** both lengthen the near field and narrow the beam.',
    priority: ['equation', 'core'],
    equation: 'N = a² / λ = D² / (4λ)',
    units: 'a = radius, D = diameter, λ = wavelength — all in mm',
    deltas: [
      { label: 'aperture ↑ → near field ↑', dir: 'up' },
      { label: 'frequency ↑ → near field ↑', dir: 'up' },
    ],
    source: 'Standard physics',
    experiment: '/ultrasound-lab/beam',
  },
  {
    id: 'us-divergence',
    category: 'beam',
    fact: 'Far-field divergence: sin θ ≈ 0.61 λ / a',
    detail:
      'A **bigger aperture** and a **shorter wavelength** both mean less spreading in the far field. The beam is narrowest — and lateral resolution best — at the focus.',
    priority: ['equation'],
    equation: 'sin θ ≈ 0.61 λ / a = 1.22 λ / D',
    deltas: [
      { label: 'aperture ↑ → divergence ↓', dir: 'down' },
      { label: 'frequency ↑ → divergence ↓', dir: 'down' },
    ],
    source: 'Standard physics',
    experiment: '/ultrasound-lab/beam',
  },
  {
    id: 'us-central-axis',
    category: 'beam',
    fact: 'Resolution is best on the central axis of the beam, at the focus',
    detail:
      'The beam is narrowest there, so two adjacent structures are most likely to be resolved. Off-axis energy in **side lobes** and **grating lobes** is weak but real, and anything it reflects is wrongly displayed as if it came from the main beam.',
    priority: ['core', 'recall'],
    source: 'QBank Q239, Q382',
    experiment: '/ultrasound-lab/beam',
  },
  {
    id: 'us-focal-zones-cost',
    category: 'beam',
    fact: 'Extra focal zones improve lateral resolution over more depth — and cost frame rate',
    detail:
      'Each additional transmit focal zone needs another pulse down every scan line. Two focal zones roughly halve the frame rate. Place a single focal zone **at or just below the region of interest** instead, whenever motion matters.',
    priority: ['core', 'clinical'],
    deltas: [
      { label: 'focal zones ↑ → lateral resolution ↑ over depth', dir: 'up' },
      { label: 'focal zones ↑ → frame rate ↓', dir: 'down' },
    ],
    source: 'QBank Q289 · Standard physics',
    experiment: '/ultrasound-lab/beam',
  },
  {
    id: 'us-elevational',
    category: 'beam',
    fact: 'Slice thickness is the worst resolution on a standard 1D array',
    detail:
      'A one-dimensional array is focused in the elevation plane by a **fixed acoustic lens**, so slice thickness cannot be adjusted from the console. Echoes from just outside the intended plane are averaged in, producing **partial-volume (slice-thickness) artefact** — the classic cause of apparent debris inside a small cyst.',
    priority: ['core', 'clinical'],
    source: 'Standard physics',
    experiment: '/ultrasound-lab/resolution',
  },

  /* ============================================================
   * RESOLUTION
   * ============================================================ */
  {
    id: 'us-axial-resolution',
    category: 'resolution',
    fact: 'Axial resolution = spatial pulse length / 2',
    detail:
      'It measures the smallest separation of two reflectors **along the beam** that still gives two distinct echoes. It improves with higher frequency, fewer cycles and heavier damping — and it is **independent of depth**, because the pulse length does not change as the pulse travels.',
    priority: ['equation', 'core', 'recall'],
    equation: 'axial resolution = SPL / 2 = (n × λ) / 2',
    deltas: [
      { label: 'frequency ↑ → axial resolution ↑', dir: 'up' },
      { label: 'damping ↑ → axial resolution ↑', dir: 'up' },
      { label: 'depth: no effect', dir: 'flat' },
    ],
    source: 'QBank Q321, Q352, Q238',
    weight: 4,
    distractor: 'Axial resolution does NOT depend on transducer diameter, PRF, focusing or depth — all four are listed as false stems in QBank Q321.',
    experiment: '/ultrasound-lab/resolution',
  },
  {
    id: 'us-axial-typical',
    category: 'resolution',
    fact: 'Typical axial resolution is 0.5–1 mm',
    detail:
      'Wavelengths of 0.3–1.0 mm and pulses of two to three cycles give spatial pulse lengths of roughly **0.9–3 mm**, and half of that is the axial resolution.',
    priority: ['number'],
    source: 'QBank Q352',
    experiment: '/ultrasound-lab/resolution',
  },
  {
    id: 'us-lateral-resolution',
    category: 'resolution',
    fact: 'Lateral resolution equals the beam width, so it is best at the focus and varies with depth',
    detail:
      'Two structures side by side merge if they fall inside the beam at the same time. It is improved by a **larger aperture**, a **higher frequency**, and by placing the **focus** at the depth of interest. This is the resolution that transducer diameter and focusing control — not axial.',
    priority: ['core', 'trap'],
    deltas: [
      { label: 'beam width ↓ → lateral resolution ↑', dir: 'up' },
      { label: 'at focus → best', dir: 'up' },
    ],
    source: 'QBank Q321, Q239',
    weight: 3,
    distractor: 'Swapping axial and lateral: focusing and crystal diameter change LATERAL resolution; pulse length changes AXIAL resolution.',
    experiment: '/ultrasound-lab/resolution',
  },
  {
    id: 'us-temporal-resolution',
    category: 'resolution',
    fact: 'Temporal resolution is frame rate — and it trades against everything else',
    detail:
      'Deeper imaging, a wider sector, higher line density, more focal zones and higher persistence all lower it. When something is moving — a fetal heart, a valve — temporal resolution is the one to protect.',
    priority: ['core', 'clinical'],
    source: 'Standard physics · QBank Q446',
    experiment: '/ultrasound-lab/resolution',
  },
  {
    id: 'us-contrast-resolution',
    category: 'resolution',
    fact: 'Dynamic range sets contrast resolution: narrow is high-contrast, wide is smooth',
    detail:
      'Compression maps a very wide range of echo amplitudes onto the limited grey levels a display can show. A **narrow** dynamic range gives a punchy, near black-and-white image; a **wide** one shows more subtle tissue differences but looks flatter and greyer.',
    priority: ['core'],
    deltas: [
      { label: 'dynamic range ↓ → contrast ↑', dir: 'up' },
      { label: 'dynamic range ↑ → more grey levels visible', dir: 'up' },
    ],
    source: 'Standard physics',
    experiment: '/ultrasound-lab/controls',
  },
  {
    id: 'us-frequency-tradeoff',
    category: 'resolution',
    fact: 'Higher frequency improves resolution but reduces penetration',
    detail:
      'Shorter wavelength means a shorter pulse and a narrower beam, so both axial and lateral resolution improve. But attenuation rises with frequency, so deep echoes fall below the noise floor sooner. **Choose the highest frequency that still reaches the target.**',
    priority: ['core', 'recall', 'clinical'],
    deltas: [
      { label: 'λ ↓', dir: 'down' },
      { label: 'axial resolution ↑', dir: 'up' },
      { label: 'attenuation ↑', dir: 'up' },
      { label: 'penetration ↓', dir: 'down' },
      { label: 'heating ↑', dir: 'warn' },
    ],
    source: 'QBank Q238, Q413 · Fact Bank',
    weight: 5,
    experiment: '/ultrasound-lab/probes',
  },

  /* ============================================================
   * DOPPLER
   * ============================================================ */
  {
    id: 'us-doppler-equation',
    category: 'doppler',
    fact: 'Δf = 2 f₀ v cos θ / c',
    detail:
      'Four inputs and no others: transmitted frequency, reflector velocity, the **cosine** of the beam–flow angle, and the speed of sound. The factor of two is there because the moving scatterer both receives a shifted frequency and re-radiates it.',
    priority: ['equation', 'core', 'recall'],
    equation: 'Δf = 2 f₀ v cos θ / c',
    units: 'Δf in Hz, f₀ in Hz, v in m/s, θ in degrees, c in m/s',
    deltas: [
      { label: 'f₀ ↑ → Δf ↑', dir: 'up' },
      { label: 'v ↑ → Δf ↑', dir: 'up' },
      { label: 'θ → 90° → Δf → 0', dir: 'down' },
      { label: 'c ↑ → Δf ↓', dir: 'down' },
    ],
    source: 'QBank Q34, Q66–Q70, Q211, Q353',
    weight: 9,
    distractor: 'Beam intensity, PRF, vessel diameter and reflector size are ALL irrelevant to the size of the shift — each appears as a false stem in the recall bank. (Density and compressibility enter only indirectly, by setting the speed of sound c.)',
    experiment: '/ultrasound-lab/doppler',
  },
  {
    id: 'us-doppler-cosine',
    category: 'doppler',
    fact: 'The shift follows the COSINE of the angle, not the angle',
    detail:
      'At 0° (beam parallel to flow) the shift is maximal. At 60° it is halved. At **90° the cosine is zero and there is no detectable shift at all** — a vessel running exactly across the beam appears to have no flow. Error grows steeply as 90° is approached, which is why 60° is the usual practical ceiling for a quantitative measurement.',
    priority: ['core', 'recall', 'trap'],
    source: 'QBank Q66, Q34, Q196, Q322, Q353',
    weight: 6,
    distractor: '“Doppler shift is directly proportional to angle” — FALSE again and again across the recall collection. And “the effect is greatest at right angles to the beam” is FALSE: it is greatest when parallel.',
    clinical: 'Angle-correct the cursor along the true flow direction, and keep the insonation angle at or below 60°.',
    experiment: '/ultrasound-lab/doppler',
  },
  {
    id: 'us-doppler-direction',
    category: 'doppler',
    fact: 'Flow towards the probe raises the received frequency; flow away lowers it',
    detail:
      'The sign of the shift carries the direction. Colour maps assign hue by **direction relative to the probe**, so red does not mean artery and blue does not mean vein — it depends entirely on the map and the geometry.',
    priority: ['core', 'recall', 'trap'],
    source: 'QBank Q196, Q322',
    distractor: '“The frequency of reflected waves decreases for objects moving towards the transducer.” FALSE — it increases.',
    experiment: '/ultrasound-lab/doppler',
  },
  {
    id: 'us-doppler-frequency-same',
    category: 'doppler',
    fact: 'Doppler does not require a higher frequency than B-mode',
    detail:
      'The same range of transducer frequencies serves both. In practice a **lower** frequency is often chosen for Doppler, because it reduces the shift for a given velocity and so makes aliasing less likely at depth.',
    priority: ['trap'],
    source: 'QBank Q322',
    distractor: '“Doppler requires a higher frequency than B-mode studies.” FALSE.',
    experiment: '/ultrasound-lab/doppler',
  },
  {
    id: 'us-cw-pw',
    category: 'doppler',
    fact: 'CW Doppler measures very high velocities but has no range resolution; PW has range resolution but aliases',
    detail:
      '**Continuous wave** uses separate transmitting and receiving elements, samples continuously and therefore **cannot alias** — but it records everything along the beam and cannot say what depth the signal came from. **Pulsed wave** places a sample volume at a chosen depth, at the price of a sampling limit.',
    priority: ['core', 'recall'],
    source: 'QBank Q322, Q412',
    weight: 2,
    distractor: '“Aliasing does not occur during continuous wave Doppler” is TRUE — a stem worth recognising quickly.',
    experiment: '/ultrasound-lab/aliasing',
  },
  {
    id: 'us-power-doppler',
    category: 'doppler',
    fact: 'Power Doppler is sensitive to slow flow but shows no reliable direction or velocity',
    detail:
      'It displays the **integrated power** of the Doppler signal rather than the mean frequency shift. That makes it more sensitive and largely angle-independent, and it does not alias — but it cannot tell you which way the blood is going or how fast. It is more prone to **flash artefact** from motion.',
    priority: ['core', 'trap'],
    source: 'QBank Q422',
    distractor: '“Amplitude and direction of blood flow can be assessed using power Doppler.” FALSE — amplitude yes, direction no.',
    experiment: '/ultrasound-lab/doppler',
  },
  {
    id: 'us-duplex',
    category: 'doppler',
    fact: 'Duplex means B-mode plus Doppler — not M-mode plus Doppler',
    detail:
      'Duplex combines real-time **B-mode** with pulsed-wave Doppler. **Triplex** adds colour on top, at a further cost in frame rate because the machine must interleave three sets of pulses.',
    priority: ['trap', 'recall'],
    source: 'QBank Q112 · Fact Bank',
    distractor: '“Doppler and M-mode duplex.” FALSE — it is B-mode.',
    experiment: '/ultrasound-lab/doppler',
  },
  {
    id: 'us-spectral-broadening',
    category: 'doppler',
    fact: 'Spectral broadening means a wide range of velocities within the sample volume',
    detail:
      'A clear **spectral window** under the systolic peak suggests uniform laminar flow. Broadening fills that window and can indicate turbulence — but it is also produced artefactually by too large a sample volume, excessive gain, or a sample volume placed near the vessel wall.',
    priority: ['clinical'],
    source: 'Standard physics',
    experiment: '/ultrasound-lab/doppler',
  },

  /* ============================================================
   * ALIASING
   * ============================================================ */
  {
    id: 'us-nyquist',
    category: 'doppler',
    fact: 'The Nyquist limit is half the PRF',
    detail:
      'A pulsed system must sample at least **twice** per cycle of the Doppler shift. Any shift beyond PRF/2 is undersampled and wraps around to the opposite end of the display. Raising the PRF raises the Nyquist limit — but PRF is itself capped by imaging depth.',
    priority: ['equation', 'core', 'recall'],
    equation: 'Nyquist limit = PRF / 2',
    deltas: [
      { label: 'PRF ↑ → Nyquist ↑', dir: 'up' },
      { label: 'depth ↑ → PRF max ↓ → Nyquist ↓', dir: 'down' },
    ],
    source: 'QBank Q119, Q210, Q322, Q422',
    weight: 5,
    experiment: '/ultrasound-lab/aliasing',
  },
  {
    id: 'us-aliasing-physiological',
    category: 'doppler',
    fact: 'Aliasing happens at ordinary physiological velocities when the PRF is too low',
    detail:
      'It is **not** a marker of pathological velocity. The recall collection makes the point directly with a flow of 30 cm/s — easily aliased at depth, with a high transmit frequency, or with the scale set too low.',
    priority: ['recall', 'trap'],
    source: 'QBank Q210',
    distractor: 'Assuming aliasing proves a stenosis.',
    experiment: '/ultrasound-lab/aliasing',
  },
  {
    id: 'us-aliasing-fixes',
    category: 'doppler',
    fact: 'Only some anti-aliasing fixes actually raise the Nyquist limit',
    detail:
      'Genuinely raising the Nyquist limit (PRF/2): **increase PRF/scale** or **reduce depth**. **Lowering the transmit frequency** works differently — it shrinks the Doppler shift a given velocity produces, so the same limit is no longer exceeded. **Continuous wave** removes the sampling limit altogether. Shifting the **baseline** only re-allocates the existing display range — the limit is unchanged, though it can be enough to unwrap a spectrum that only just exceeds it.',
    priority: ['core', 'trap', 'clinical'],
    deltas: [
      { label: 'PRF ↑ → limit ↑', dir: 'up' },
      { label: 'f₀ ↓ → shift ↓', dir: 'down' },
      { label: 'baseline shift → limit unchanged', dir: 'flat' },
    ],
    source: 'QBank Q422, Q210 · Standard physics',
    weight: 2,
    clarify:
      'QBank Q422D marks “aliasing can be reduced by increasing the angle of insonation” FALSE, but its printed explanation then suggests *reducing* the angle — which would increase cos θ, increase the shift and make aliasing **worse**. The physics: increasing θ towards 90° does lower the shift and can remove aliasing, but it degrades velocity accuracy badly, so it is not an accepted fix. Treat the exam answer as FALSE for that reason, not because the shift would rise.',
    experiment: '/ultrasound-lab/aliasing',
  },
  {
    id: 'us-frequency-aliasing',
    category: 'doppler',
    fact: 'Raising the transmit frequency makes aliasing MORE likely',
    detail:
      'The Doppler shift is proportional to f₀, so a higher transmit frequency produces a bigger shift for the same velocity — and a bigger shift is more likely to exceed the Nyquist limit.',
    priority: ['trap'],
    source: 'QBank Q413',
    distractor: '“An increase in operating frequency gives a reduced incidence of aliasing artefacts.” FALSE — it increases them.',
    experiment: '/ultrasound-lab/aliasing',
  },

  /* ============================================================
   * ARTEFACTS
   * ============================================================ */
  {
    id: 'us-enhancement',
    category: 'artefacts',
    fact: 'Posterior enhancement appears behind weakly attenuating structures',
    detail:
      'The beam passing through a cyst loses far less energy than the beam either side of it, so the tissue **beyond** the cyst receives a stronger beam and returns brighter echoes. It is a very useful sign that a lesion is truly fluid-filled.',
    priority: ['core', 'clinical', 'trap'],
    source: 'QBank Q382 · Standard physics',
    distractor: '“Acoustic shadowing can be caused by both cysts and gallstones.” FALSE — a cyst causes *enhancement*; a stone causes shadowing.',
    experiment: '/ultrasound-lab/artefacts',
  },
  {
    id: 'us-shadowing',
    category: 'artefacts',
    fact: 'Shadowing appears behind strongly attenuating or strongly reflecting structures',
    detail:
      '**Clean** shadowing follows a stone or bone: almost all the energy is reflected or absorbed at the surface, leaving a sharp anechoic band. **Dirty** shadowing follows gas: some energy reverberates, filling the shadow with noise.',
    priority: ['core', 'clinical'],
    source: 'Standard physics · QBank Q382',
    experiment: '/ultrasound-lab/artefacts',
  },
  {
    id: 'us-reverberation',
    category: 'artefacts',
    fact: 'Reverberation comes from repeated reflection between two strong parallel interfaces',
    detail:
      'Each round trip takes the same extra time, so the false echoes appear at **equal intervals** and at ever-decreasing brightness. **Comet-tail** is a tightly spaced form of reverberation from a small strong reflector.',
    priority: ['core'],
    source: 'QBank Q382, Q412',
    experiment: '/ultrasound-lab/artefacts',
  },
  {
    id: 'us-ring-down',
    category: 'artefacts',
    fact: 'Ring-down is NOT simple reverberation — it is a continuous resonant emission',
    detail:
      'Comet-tail is produced by repeated discrete reverberations. **Ring-down** arises when trapped fluid between gas bubbles is set resonating by the pulse and radiates a continuous signal, producing an uninterrupted bright line rather than discrete bands.',
    priority: ['trap', 'clarify'],
    source: 'QBank Q412',
    distractor: '“Comet-tail and ring-down artefacts are both caused by reverberation.” FALSE — only comet-tail is.',
    experiment: '/ultrasound-lab/artefacts',
  },
  {
    id: 'us-speed-error',
    category: 'artefacts',
    fact: 'Speed error displaces structures along the beam axis',
    detail:
      'The machine converts time to depth using **1540 m/s**. If the true speed is lower — through fat, for example — the echo takes longer than expected and the reflector is placed **too deep**. Faster tissue places it too shallow. The displacement is axial, along the beam.',
    priority: ['core', 'clinical'],
    equation: 'apparent depth = true depth × 1540 / c_actual',
    source: 'QBank Q382',
    experiment: '/ultrasound-lab/artefacts',
  },
  {
    id: 'us-side-lobe',
    category: 'artefacts',
    fact: 'Side lobes place off-axis echoes onto the main beam line',
    detail:
      'Weak beams emitted off-axis can strike a strong reflector; the machine assumes every echo came from the **main beam**, so it draws the structure in the wrong lateral position. The classic result is spurious echoes inside an otherwise anechoic bladder or cyst.',
    priority: ['core', 'clinical'],
    source: 'QBank Q382',
    experiment: '/ultrasound-lab/artefacts',
  },
  {
    id: 'us-mirror',
    category: 'artefacts',
    fact: 'Mirror image places a duplicate structure deep to a strong reflector',
    detail:
      'The beam reflects off a strong smooth interface (classically the diaphragm), strikes a structure, and returns by the same indirect path. The extra travel time is interpreted as extra depth, so a copy of the structure appears **beyond** the mirror.',
    priority: ['core', 'clinical'],
    source: 'Standard physics',
    experiment: '/ultrasound-lab/artefacts',
  },
  {
    id: 'us-refraction-artefact',
    category: 'artefacts',
    fact: 'Refraction causes edge shadowing, duplication and lateral misplacement',
    detail:
      'A curved boundary — the edge of a cyst, the rectus muscles — bends the beam away, leaving a narrow shadow at the edge. If a beam is bent on the way to a target, the machine still draws the target along the original straight line, so it is laterally misplaced or even duplicated.',
    priority: ['core', 'clinical'],
    source: 'QBank Q382, Q379',
    experiment: '/ultrasound-lab/artefacts',
  },
  {
    id: 'us-range-ambiguity',
    category: 'artefacts',
    fact: 'Range ambiguity occurs when a deep echo arrives after the next pulse has been sent',
    detail:
      'The machine attributes the late echo to the **new** pulse and places it at a falsely shallow depth. It is the direct consequence of pushing PRF too high for the imaging depth.',
    priority: ['core'],
    source: 'Standard physics',
    experiment: '/ultrasound-lab/artefacts',
  },
  {
    id: 'us-twinkle',
    category: 'artefacts',
    fact: 'Twinkle artefact is a rapidly alternating colour signal behind a rough strong reflector',
    detail:
      'Seen on colour Doppler behind stones and calcification, it can reveal a calculus that is barely visible on B-mode. It is an artefact being **exploited**, not one to be removed.',
    priority: ['clinical'],
    source: 'Standard physics',
    experiment: '/ultrasound-lab/artefacts',
  },

  /* ============================================================
   * HARMONICS
   * ============================================================ */
  {
    id: 'us-harmonics-generated',
    category: 'harmonics',
    fact: 'Harmonics are generated within tissue by nonlinear propagation, not emitted by the probe',
    detail:
      'A high-pressure wave travels slightly faster in compression than in rarefaction, so the waveform distorts progressively as it propagates. That distortion contains **multiples of the transmitted frequency**. The receiver listens at **twice** the transmitted frequency and rejects the fundamental.',
    priority: ['core', 'trap'],
    source: 'QBank Q412 · Standard physics',
    distractor: 'Believing the transducer transmits the harmonic. It transmits the fundamental; tissue creates the harmonic.',
    experiment: '/ultrasound-lab/harmonics',
  },
  {
    id: 'us-harmonics-benefit',
    category: 'harmonics',
    fact: 'Harmonic imaging removes clutter and improves contrast — and lateral resolution too',
    detail:
      'Because harmonics build up with depth, there is very little harmonic signal in the near field where reverberation clutter lives. Harmonics are generated preferentially along the intense central axis of the beam, so the effective harmonic beam is narrower — side lobes are too weak to generate harmonics at all. The result is cleaner cysts, less near-field haze, better contrast resolution AND better lateral resolution. Axial resolution is the one that is not improved.',
    priority: ['core', 'trap', 'clinical', 'clarify'],
    clarify:
      'QBank Q422 keys “harmonic imaging improves lateral resolution” as FALSE, but its own explanation only hedges that this is not the MAIN benefit. Standard references (Hoskins, Dendy & Heaton, Kremkau) list improved lateral resolution as a genuine benefit of tissue harmonic imaging — the narrower effective beam IS lateral resolution. The defensible negative is axial resolution.',
    deltas: [
      { label: 'clutter ↓', dir: 'up' },
      { label: 'contrast resolution ↑', dir: 'up' },
      { label: 'lateral resolution ↑', dir: 'up' },
      { label: 'penetration ↓', dir: 'down' },
    ],
    source: 'QBank Q412, Q422',
    weight: 2,
    distractor: '“Harmonic imaging improves axial resolution.” FALSE — the received band is narrower, so the effective pulse is longer if anything; the true gains are contrast, clutter and lateral resolution.',
    experiment: '/ultrasound-lab/harmonics',
  },

  /* ============================================================
   * CONTRAST
   * ============================================================ */
  {
    id: 'us-microbubble-size',
    category: 'contrast',
    fact: 'Microbubbles are a few micrometres across — far SMALLER than the wavelength',
    detail:
      'Typically **1–8 µm**, small enough to pass through the pulmonary capillary bed and behave as a true blood-pool agent. They work by **resonating and oscillating nonlinearly** in the beam, generating a strong harmonic signal, not by matching the wavelength.',
    priority: ['core', 'recall', 'trap', 'number'],
    source: 'QBank Q203 · Fact Bank',
    distractor: '“Microbubbles work by having a diameter equal to the wavelength of the ultrasound beam.” FALSE. Their size is also unrelated to the thickness of the piezoelectric element.',
    experiment: '/ultrasound-lab/contrast',
  },
  {
    id: 'us-contrast-mi',
    category: 'contrast',
    fact: 'Contrast studies use LOW mechanical index to avoid destroying the bubbles',
    detail:
      'At low acoustic pressure bubbles oscillate nonlinearly and can be imaged for minutes. Raise the MI and they are driven into **inertial cavitation** and destroyed — which is used deliberately in destruction–replenishment perfusion studies, but otherwise just wipes out the signal.',
    priority: ['core', 'safety', 'clinical'],
    source: 'QBank Q323, Q21 · Standard physics',
    experiment: '/ultrasound-lab/contrast',
  },
  {
    id: 'us-contrast-cavitation',
    category: 'contrast',
    fact: 'Cavitation occurs far more readily when contrast agents are present',
    detail:
      'The gas cores are ready-made cavitation nuclei. This is why the **MI 0.7** caution matters most in contrast studies, and why scan time should be limited when that level is reached.',
    priority: ['safety', 'recall'],
    source: 'QBank Q323, Q21, Q32',
    weight: 3,
    experiment: '/ultrasound-lab/safety',
  },

  /* ============================================================
   * ELASTOGRAPHY
   * ============================================================ */
  {
    id: 'us-strain-vs-shear',
    category: 'elastography',
    fact: 'Strain elastography is qualitative; shear-wave elastography is quantitative',
    detail:
      '**Strain** measures relative tissue deformation under an applied stress (operator compression or physiological motion) and gives a relative, operator-dependent map. **Shear-wave** uses an acoustic radiation force push pulse and measures how fast the resulting shear wave travels, giving a number in m/s or kPa.',
    priority: ['core', 'clinical'],
    equation: 'E ≈ 3 ρ c_s²      c_s = shear-wave speed',
    source: 'Standard physics',
    experiment: '/ultrasound-lab/elastography',
  },
  {
    id: 'us-shear-speed',
    category: 'elastography',
    fact: 'Stiffer tissue propagates shear waves faster',
    detail:
      'Shear-wave speed in soft tissue is of the order of **1–10 m/s** — vastly slower than the 1540 m/s longitudinal wave. Sources of error include depth, excessive pre-compression by the operator, and motion.',
    priority: ['number'],
    source: 'Standard physics',
    experiment: '/ultrasound-lab/elastography',
  },

  /* ============================================================
   * SAFETY
   * ============================================================ */
  {
    id: 'us-mi-equation',
    category: 'safety',
    fact: 'MI = peak rarefactional pressure / √frequency',
    detail:
      'The mechanical index estimates the potential for **non-thermal (cavitation)** effects. It rises with peak negative pressure and **falls as frequency rises**, so it is inversely proportional to the square root of the frequency. It says nothing about heating.',
    priority: ['equation', 'core', 'recall', 'safety'],
    equation: 'MI = p_rarefactional (MPa) / √f (MHz)',
    deltas: [
      { label: 'pressure ↑ → MI ↑', dir: 'warn' },
      { label: 'frequency ↑ → MI ↓', dir: 'down' },
    ],
    source: 'QBank Q21, Q89 · Fact Bank',
    weight: 4,
    distractor: '“MI can be calculated indirectly from tissue heating.” FALSE — that is the thermal index.',
    experiment: '/ultrasound-lab/safety',
  },
  {
    id: 'us-mi-thresholds',
    category: 'safety',
    fact: 'MI 0.7 is the contrast/cavitation caution; MI 0.3 is the neonatal lung caution',
    detail:
      'Above **MI 0.7**, particularly with gas bodies or microbubble contrast present, cavitation becomes a real concern and scan time should be limited. **MI above 0.3** carries an increased risk of mechanical damage to **neonatal lung**. Neither number is a cliff edge at which damage suddenly begins.',
    priority: ['number', 'recall', 'safety'],
    source: 'QBank Q21, Q32, Q323',
    weight: 4,
    experiment: '/ultrasound-lab/safety',
  },
  {
    id: 'us-ti-meaning',
    category: 'safety',
    fact: 'TI estimates heating potential — it is an index, not a thermometer',
    detail:
      'The thermal index is the ratio of the acoustic power used to the power estimated to raise tissue temperature by **1 °C** under a modelled worst case. It is not a measured temperature and it is not "a 2 °C rise". Variants: **TIS** (soft tissue), **TIB** (bone at the focus), **TIC** (bone at the surface, for transcranial work).',
    priority: ['core', 'recall', 'safety', 'trap'],
    source: 'QBank Q287, Q32',
    weight: 3,
    distractor: '“TI is the increase in temperature by 2 degrees.” FALSE.',
    experiment: '/ultrasound-lab/safety',
  },
  {
    id: 'us-ti-obstetric',
    category: 'safety',
    fact: 'Obstetric scanning: restrict exposure time above TI 0.7, and do not scan above TI 3.0',
    detail:
      'The recall bank gives **3.0** as the obstetric ceiling, and the QBank places the start of time restriction at **TI 0.7** rather than 0.5. A sustained **4 °C rise for 5 minutes must be treated as potentially hazardous**, particularly to a fetus.',
    priority: ['number', 'recall', 'safety'],
    source: 'QBank Q32, Q323, Q235',
    weight: 3,
    clarify:
      'Published guidance gives graded maximum scanning times that shorten as TI rises above 0.7, rather than one single number. The two figures the sources emphasise — restriction from 0.7, avoidance above 3.0 — are the examinable ones.',
    experiment: '/ultrasound-lab/safety',
  },
  {
    id: 'us-bone-heating',
    category: 'safety',
    fact: 'Bone heats far more than soft tissue because it absorbs so strongly',
    detail:
      'Absorption at bone is high, so energy is deposited over a short distance and the temperature rise concentrates there. Heating also rises with **frequency** and with **PRF** (more pulses per second means more energy delivered), and it is **reduced by perfusion**, which carries heat away.',
    priority: ['core', 'recall', 'safety'],
    deltas: [
      { label: 'bone in beam → heating ↑', dir: 'warn' },
      { label: 'frequency ↑ → heating ↑', dir: 'warn' },
      { label: 'PRF ↑ → heating ↑', dir: 'warn' },
      { label: 'perfusion ↑ → heating ↓', dir: 'down' },
    ],
    source: 'QBank Q323, Q383, Q287',
    weight: 4,
    distractor: '“Temperature rise is greater in highly perfused tissues.” FALSE — blood flow removes heat.',
    experiment: '/ultrasound-lab/safety',
  },
  {
    id: 'us-superficial-heating',
    category: 'safety',
    fact: 'In uniform soft tissue, heating is greatest superficially',
    detail:
      'The beam has been attenuated least near the surface, so intensity — and therefore energy deposition — is highest there.',
    priority: ['safety', 'clarify'],
    source: 'QBank Q383',
    clarify:
      'This holds for uniform soft tissue. When **bone** lies in the beam, the peak temperature rise moves to the bone surface however deep it is, because absorption there is so much higher. Both statements are examinable; they are not in conflict.',
    experiment: '/ultrasound-lab/safety',
  },
  {
    id: 'us-doppler-output',
    category: 'safety',
    fact: 'Pulsed Doppler has a higher acoustic output than B-mode',
    detail:
      'Doppler uses longer pulses, higher power and repeatedly insonates the **same scan line**, so energy is concentrated rather than swept across the field. B-mode is the gentlest common mode; colour sits between the two.',
    priority: ['core', 'recall', 'safety'],
    source: 'QBank Q235, Q323 · Fact Bank',
    weight: 3,
    distractor: '“B-mode scans are potentially more dangerous than Doppler mode.” FALSE.',
    experiment: '/ultrasound-lab/safety',
  },
  {
    id: 'us-heating-absorption',
    category: 'safety',
    fact: 'Tissue heating comes from absorption of acoustic energy, not friction',
    detail:
      'The recall bank explicitly rejects "friction" and rejects the idea that a hot probe face is simply a matter of increased voltage. Probe self-heating reflects **electrical and mechanical losses inside the transducer** plus poor acoustic coupling — which is why a probe left running in air gets warm: without tissue or gel contact, the energy and heat have nowhere to go.',
    priority: ['core', 'recall', 'safety'],
    source: 'QBank Q287, Q235 · Fact Bank',
    weight: 2,
    distractor: 'Displayed acoustic output describes energy delivered into tissue — it is not simply a readout of probe casing temperature.',
    experiment: '/ultrasound-lab/safety',
  },
  {
    id: 'us-alarp',
    category: 'safety',
    fact: 'Ultrasound is governed by ALARP and the lowest-output principle — ALARA is the ionising-radiation term',
    detail:
      'Diagnostic ultrasound has **no proven hazard at diagnostic levels, but it is not "zero effect"**. Use the lowest output and the shortest exposure that answers the clinical question, and keep dwell time in one place short.',
    priority: ['core', 'safety', 'clarify'],
    source: 'QBank Q235',
    clarify:
      'The recall collection marks “limited by practitioners under ALARA” FALSE on the grounds that ALARA belongs to ionising radiation. The underlying principle — lowest output, shortest time — is identical, and many textbooks use ALARA for ultrasound too. Know the distinction the examiner is drawing, and never claim ultrasound has no biological effect at all.',
    experiment: '/ultrasound-lab/safety',
  },

  /* ============================================================
   * PROBES
   * ============================================================ */
  {
    id: 'us-linear-array',
    category: 'probes',
    fact: 'Linear array: rectangular field, large flat footprint, high frequency, superb superficial detail',
    detail:
      'Scan lines leave at right angles to the face, so the field of view is a **rectangle** the width of the probe. Typical range roughly **5–15 MHz**. Used for vascular, thyroid, breast, testis, musculoskeletal and procedural guidance.',
    priority: ['core', 'clinical'],
    source: 'QBank Q412, Q446 · Standard physics',
    clarify: 'Typical range — exact bandwidth varies by manufacturer and probe.',
    experiment: '/ultrasound-lab/probes',
  },
  {
    id: 'us-curvilinear',
    category: 'probes',
    fact: 'Curvilinear array: curved footprint, sector-shaped field, lower frequency, greater penetration',
    detail:
      'The curved face makes the scan lines diverge, giving a wide field at depth from a manageable footprint. Typically **2–5 MHz**. The standard abdominal, pelvic and obstetric probe.',
    priority: ['core', 'clinical'],
    source: 'QBank Q446',
    clarify: 'Typical range — exact bandwidth varies by manufacturer and probe.',
    experiment: '/ultrasound-lab/probes',
  },
  {
    id: 'us-phased-array',
    category: 'probes',
    fact: 'Phased array: tiny footprint, sector image, electronic steering — it fits between ribs',
    detail:
      'All elements fire for every line with graded delays, sweeping the beam through a sector from a very small aperture. Typically **1–5 MHz**. Essential for echocardiography and any intercostal or transcranial window.',
    priority: ['core', 'clinical'],
    source: 'QBank Q412, Q446',
    clinical: 'Footprint and frequency are separate considerations: a linear probe may have far better resolution yet be useless if it cannot fit in the acoustic window.',
    experiment: '/ultrasound-lab/probes',
  },
  {
    id: 'us-endocavitary',
    category: 'probes',
    fact: 'Endocavitary probes use a high frequency because the anatomy is close',
    detail:
      'Being centimetres rather than tens of centimetres from the target removes the penetration constraint, so **6–12 MHz** becomes usable and resolution improves dramatically. Transvaginal and transrectal imaging.',
    priority: ['clinical'],
    source: 'Standard physics',
    clarify: 'Typical range — exact bandwidth varies by manufacturer and probe.',
    experiment: '/ultrasound-lab/probes',
  },
  {
    id: 'us-hockey-stick',
    category: 'probes',
    fact: 'Hockey-stick probes: very small footprint, very high frequency, very superficial work',
    detail:
      'Typically **10–20 MHz** with a footprint of a centimetre or two, for fingers, tendons, small joints, paediatric structures and superficial procedures.',
    priority: ['clinical'],
    source: 'Standard physics',
    clarify: 'Typical range — exact bandwidth varies by manufacturer and probe.',
    experiment: '/ultrasound-lab/probes',
  },
  {
    id: 'us-probe-choice',
    category: 'probes',
    fact: 'Choose the highest frequency that still reaches the target',
    detail:
      'Resolution and penetration pull in opposite directions, so probe selection is always a compromise decided by **target depth** — and then constrained separately by **footprint**, because acoustic access is a different problem from image quality.',
    priority: ['core', 'clinical'],
    source: 'Standard physics · Fact Bank',
    experiment: '/ultrasound-lab/probes',
  },

  /* ============================================================
   * QA
   * ============================================================ */
  {
    id: 'us-qa-tests',
    category: 'qa',
    fact: 'A test phantom checks resolution, uniformity, distance accuracy, dead zone and penetration',
    detail:
      'Standard tissue-mimicking phantoms contain wire targets at known separations and anechoic and contrast objects. They are used to detect **element dropout**, calibration error, loss of sensitivity and probe damage.',
    priority: ['core'],
    source: 'Standard physics',
    experiment: '/ultrasound-lab/qa',
  },
  {
    id: 'us-element-dropout',
    category: 'qa',
    fact: 'A dead element produces a persistent vertical band of dropout',
    detail:
      'Because each element contributes to a fixed set of scan lines, the fault appears in the **same lateral position** whatever is being scanned — which is exactly what distinguishes it from a shadow. Cable damage tends to produce noise or intermittent dropout instead.',
    priority: ['core', 'clinical'],
    source: 'Standard physics',
    experiment: '/ultrasound-lab/qa',
  },
  {
    id: 'us-calibration-error',
    category: 'qa',
    fact: 'A wrong assumed propagation speed produces systematic distance errors',
    detail:
      'Measured distances in the phantom come out proportionally wrong, and the error is **the same fraction at every depth** — the signature of a calibration problem rather than a local speed artefact.',
    priority: ['core'],
    source: 'Standard physics',
    experiment: '/ultrasound-lab/qa',
  },
]

/* ------------------------------------------------------------------ *
 * Derived indexes
 * ------------------------------------------------------------------ */

export const FACTS_BY_CATEGORY = US_FACTS.reduce<Record<string, UsFact[]>>((map, fact) => {
  ;(map[fact.category] ??= []).push(fact)
  return map
}, {})

export function factsFor(category: UsCategory): UsFact[] {
  return FACTS_BY_CATEGORY[category] ?? []
}

export function factById(id: string): UsFact | undefined {
  return US_FACTS.find((fact) => fact.id === id)
}

/** Facts that carry a recall badge, ordered by how many questions test them. */
export function highYieldFacts(): UsFact[] {
  return US_FACTS.filter((fact) => fact.priority.includes('recall')).sort(
    (a, b) => (b.weight ?? 1) - (a.weight ?? 1),
  )
}

export const FACT_COUNTS = {
  total: US_FACTS.length,
  recall: US_FACTS.filter((f) => f.priority.includes('recall')).length,
  traps: US_FACTS.filter((f) => f.priority.includes('trap')).length,
  equations: US_FACTS.filter((f) => f.equation).length,
  clarifications: US_FACTS.filter((f) => f.clarify).length,
}
