/**
 * The FRCR Exam Lab question bank.
 *
 * TF_QUESTIONS is transcribed directly from the project question bank
 * (RadioPass-Master/site/physics/physics-question-bank-data.js, topic
 * "Ultrasound"), preserving question number, sitting year and the source's own
 * true/false verdict. Questions carrying a year come from the recall
 * collection and are badged as high-yield recall.
 *
 * Two editorial rules are applied and both are visible to the learner:
 *
 *  1. Stems that are not ultrasound physics are removed. Question 36 is
 *     excluded entirely — it is tagged Ultrasound in the source but its stems
 *     are nuclear medicine and digital imaging.
 *  2. Where the source's own explanation is scientifically wrong or
 *     self-contradictory, CORRECTIONS supplies the correction. It is shown
 *     beside the source explanation, never instead of it, so a candidate who
 *     has revised from the original wording can see exactly what was wrong.
 *
 * INTERACTIVE_QUESTIONS and TRAP_PAIRS are written for this laboratory to cover
 * the question types the source bank does not contain: direction-of-change,
 * probe selection, artefact diagnosis and the deliberate wording swaps.
 */

import type { UsCategory } from './facts'

export type TfStem = {
  text: string
  answer: boolean
  explanation: string
}

export type TfQuestion = {
  id: string
  category: UsCategory
  stem: string
  source: string
  /**
   * Internal provenance only — never rendered. Site editorial rule:
   * recall-derived material is presented as "high-yield recall", never as
   * past papers or years.
   */
  year: string
  /** True when the question comes from the recall collection. */
  recall: boolean
  stems: TfStem[]
}

/**
 * Corrections to source explanations, keyed by `${questionId}:${stemIndex}`.
 *
 * `verdict` is present when this laboratory disagrees with the source's own
 * true/false answer. Where it is absent, the verdict stands and only the
 * reasoning needed repair.
 */
export const CORRECTIONS: Record<
  string,
  { note: string; verdict?: boolean }
> = {
  'q446:0': {
    note:
      'The source marks this TRUE, but it is the wrong way round. To FOCUS, the OUTER elements must be excited FIRST: they are further from the focal point, so their wavefronts need a head start to arrive together. Triggering the inner elements first would defocus the beam. The examinable principle — that focusing is achieved by timing delays between elements — is unaffected.',
    verdict: false,
  },
  'q422:0': {
    note:
      'The verdict is right but the printed reasoning contradicts itself. A thicker element has a LOWER resonant frequency (f = c/2t), and a lower frequency means a longer wavelength. Note also that element thickness is half a wavelength in the crystal, not a full wavelength — a swap examiners use deliberately.',
  },
  'q422:3': {
    note:
      'Handle this one carefully. Increasing the angle towards 90° genuinely DOES reduce the Doppler shift (Δf ∝ cos θ) and can remove aliasing. It is marked FALSE because it is not an acceptable clinical fix: dividing by a small cosine magnifies velocity error badly. The source explanation, which suggests reducing the angle, would increase the shift and make aliasing worse.',
  },
  'q235:0': {
    note:
      'The verdict is correct — pulsed Doppler does have a higher acoustic output than B-mode, because it uses longer pulses, higher power and repeatedly insonates the same scan line. The printed explanation about the Doppler equation is a copy-and-paste error and does not answer the stem.',
  },
  'q235:2': {
    note:
      'The distinction being drawn is that ALARA is the ionising-radiation term and ultrasound practice uses ALARP / lowest-output-shortest-time. The underlying principle is identical, and many textbooks do apply ALARA to ultrasound. Never conclude from this stem that ultrasound output is unregulated or that ultrasound has no biological effect.',
  },
  'q33:1': {
    note:
      'The stem sits under "the velocity of ultrasound is…" but the explanation is about wavelength. Read it as: wavelength is proportional to propagation speed at a fixed frequency (λ = c/f). The speed itself is a property of the medium and is not proportional to anything the operator sets.',
  },
  'q351:0': {
    note:
      'True for a simple single-focus B-mode frame. Selecting MULTIPLE FOCAL ZONES does send several pulses down each scan line — which is precisely why extra focal zones cost frame rate.',
  },
  'q383:1': {
    note:
      'True for uniform soft tissue, where the beam is least attenuated near the surface. When BONE lies in the beam, the peak temperature rise moves to the bone surface however deep it is, because absorption there is so much higher. Both statements are examinable and they do not conflict.',
  },
  'q320:4': {
    note:
      '"0.8 dB/cm at 1 MHz" is the same quantity as 0.8 dB/cm/MHz. Only apply the frequency multiplier when the coefficient is expressed per MHz, and remember the published range is 0.5–1.0.',
  },
  'q32:1': {
    note:
      'Published guidance gives graded maximum scanning times that shorten progressively as TI rises above 0.7, rather than a single cut-off. The two figures worth carrying into the exam are: restrict exposure time above TI 0.7, and do not scan obstetric cases above TI 3.0.',
  },
}

export const TF_QUESTIONS: TfQuestion[] = [
  {
    id: 'q21',
    category: 'safety',
    stem: 'mechanical index in US',
    source: 'QBank Q21',
    year: '2025',
    recall: true,
    stems: [
      { text: 'Can be calculated indirectly from tissue heating.', answer: false, explanation: 'MI estimates cavitation risk; Thermal Index estimates heating risk.' },
      { text: 'Scan time should be limited when reaching 0.7.', answer: true, explanation: 'With microbubble contrast, cavitation risk becomes important around MI 0.7.' },
      { text: 'MI >0.7 can cause cavitation.', answer: true, explanation: 'MI is an indicator of non-thermal/cavitation risk; risk rises at higher MI and is especially relevant with gas bodies or microbubble contrast.' },
      { text: 'Inversely proportional to the square root of frequency.', answer: true, explanation: 'MI is peak negative pressure divided by the square root of frequency.' },
    ],
  },
  {
    id: 'q31',
    category: 'impedance',
    stem: 'acoustic impedance is affected by',
    source: 'QBank Q31',
    year: '2025',
    recall: true,
    stems: [
      { text: 'Density.', answer: true, explanation: 'Acoustic impedance equals density multiplied by sound speed.' },
      { text: 'Velocity.', answer: true, explanation: 'Acoustic impedance is Z = rho c, so it is directly proportional to sound speed in the medium.' },
      { text: 'Probe frequency.', answer: false, explanation: 'Acoustic impedance is determined by tissue density and speed of sound, not by transducer frequency.' },
      { text: 'Soft tissue-air reflection >99%.', answer: true, explanation: 'The air-soft tissue impedance mismatch reflects almost all ultrasound; gel removes the air interface.' },
      { text: 'Sum of attenuation of tissues.', answer: false, explanation: 'Acoustic impedance equals density multiplied by sound speed; attenuation is a separate property describing energy loss with depth.' },
    ],
  },
  {
    id: 'q32',
    category: 'safety',
    stem: 'ultrasound safety',
    source: 'QBank Q32',
    year: '2025',
    recall: true,
    stems: [
      { text: 'Cavitation with bubble contrast limit is 0.7.', answer: true, explanation: 'An MI around or above 0.7 is a commonly recalled caution threshold, particularly when gas bodies or ultrasound contrast are present. It does not mean cavitation inevitably occurs at one exact value.' },
      { text: 'Obstetrics scanning is not recommended above 3.0.', answer: true, explanation: 'As a safety caution: a high displayed thermal index indicates increased heating potential, so obstetric scans should use the lowest output and shortest time consistent with diagnosis.' },
    ],
  },
  {
    id: 'q33',
    category: 'fundamentals',
    stem: 'velocity of ultrasound is',
    source: 'QBank Q33',
    year: '2025',
    recall: true,
    stems: [
      { text: 'Dependent on frequency.', answer: false, explanation: 'Speed of sound depends on tissue stiffness/compressibility and density, not probe frequency.' },
      { text: 'Proportional to speed.', answer: true, explanation: 'Ultrasound wavelength is proportional to propagation speed for a fixed frequency, since wavelength equals speed divided by frequency.' },
    ],
  },
  {
    id: 'q34',
    category: 'doppler',
    stem: 'doppler ultrasound frequency shift is increased with (part 1)',
    source: 'QBank Q34',
    year: '2025',
    recall: true,
    stems: [
      { text: 'Beam intensity.', answer: false, explanation: 'Doppler shift is not determined by beam intensity.' },
      { text: 'Frequency.', answer: true, explanation: 'Doppler shift is directly proportional to transmitted frequency.' },
      { text: 'Blood velocity.', answer: true, explanation: 'Doppler shift increases with blood velocity.' },
      { text: 'Angle of incident pulse.', answer: false, explanation: 'If saying proportional to raw angle: Doppler shift is proportional to cosine of the angle.' },
      { text: 'Pulse repetition frequency.', answer: false, explanation: 'PRF does not determine the Doppler shift itself; it sets the sampling/Nyquist limit and therefore affects aliasing.' },
    ],
  },
  {
    id: 'q66',
    category: 'doppler',
    stem: 'in US doppler, doppler shift is directly proportional to angle',
    source: 'QBank Q66',
    year: '2024',
    recall: true,
    stems: [
      { text: 'In US Doppler, Doppler shift is directly proportional to angle.', answer: false, explanation: 'If saying proportional to raw angle: Doppler shift is proportional to cosine of the angle.' },
    ],
  },
  {
    id: 'q67',
    category: 'doppler',
    stem: 'in US doppler, doppler shift is directly proportional to frequency',
    source: 'QBank Q67',
    year: '2024',
    recall: true,
    stems: [
      { text: 'In US Doppler, Doppler shift is directly proportional to frequency.', answer: true, explanation: 'Doppler shift is directly proportional to transmitted frequency.' },
    ],
  },
  {
    id: 'q68',
    category: 'doppler',
    stem: 'in US doppler, doppler shift is directly proportional to blood velocity',
    source: 'QBank Q68',
    year: '2024',
    recall: true,
    stems: [
      { text: 'In US Doppler, Doppler shift is directly proportional to blood velocity.', answer: true, explanation: 'Doppler shift increases with blood velocity.' },
    ],
  },
  {
    id: 'q69',
    category: 'doppler',
    stem: 'in US doppler, doppler shift is directly proportional to the size of something',
    source: 'QBank Q69',
    year: '2024',
    recall: true,
    stems: [
      { text: 'In US Doppler, Doppler shift is directly proportional to the size of something.', answer: false, explanation: 'Doppler shift depends on transmitted frequency, reflector velocity and cosine angle.' },
    ],
  },
  {
    id: 'q70',
    category: 'doppler',
    stem: 'in US doppler, doppler shift is directly proportional to something else',
    source: 'QBank Q70',
    year: '2024',
    recall: true,
    stems: [
      { text: 'In US Doppler, Doppler shift is directly proportional to something else.', answer: false, explanation: 'Doppler shift depends on transmitted frequency, reflector velocity and cosine angle.' },
    ],
  },
  {
    id: 'q85',
    category: 'impedance',
    stem: 'high difference in acoustic impedence leads to more reflection',
    source: 'QBank Q85',
    year: '2024',
    recall: true,
    stems: [
      { text: 'High difference in acoustic impedence leads to more reflection.', answer: true, explanation: 'A larger acoustic impedance mismatch produces a larger reflected fraction of the ultrasound beam.' },
    ],
  },
  {
    id: 'q89',
    category: 'safety',
    stem: 'MI tells you about risk of cavitation',
    source: 'QBank Q89',
    year: '2024',
    recall: true,
    stems: [
      { text: 'MI tells you about risk of cavitation.', answer: true, explanation: 'With microbubble contrast, cavitation risk becomes important around MI 0.7.' },
    ],
  },
  {
    id: 'q112',
    category: 'doppler',
    stem: 'doppler and m mode duplex',
    source: 'QBank Q112',
    year: '2024',
    recall: true,
    stems: [
      { text: 'Doppler and M mode duplex.', answer: false, explanation: 'B-mode. Doppler shift depends on transmitted frequency, reflector velocity and cosine angle.' },
    ],
  },
  {
    id: 'q119',
    category: 'doppler',
    stem: 'increasing PRF increasing nyquist frequency',
    source: 'QBank Q119',
    year: '2024',
    recall: true,
    stems: [
      { text: 'Increasing PRF increasing nyquist frequency.', answer: true, explanation: 'The Nyquist limit equals half the pulse repetition frequency, so increasing PRF raises the maximum unaliased Doppler frequency.' },
    ],
  },
  {
    id: 'q195',
    category: 'impedance',
    stem: 'ultrasound',
    source: 'QBank Q195',
    year: '2022',
    recall: true,
    stems: [
      { text: 'Acoustic impedence directly proportional with density.', answer: true, explanation: 'Acoustic impedance is Z = rho c, so it is directly proportional to tissue density.' },
      { text: '99% of ultrasound reflected at air-soft tissue interface.', answer: true, explanation: 'The air-soft tissue impedance mismatch reflects almost all ultrasound; gel removes the air interface.' },
      { text: '15% of ultrasound reflected at soft tissue-fluid interface.', answer: false, explanation: 'Reflection at a soft tissue fluid interface is usually very small because their acoustic impedances are similar, generally well below 15 percent.' },
    ],
  },
  {
    id: 'q196',
    category: 'doppler',
    stem: 'doppler',
    source: 'QBank Q196',
    year: '2022',
    recall: true,
    stems: [
      { text: 'Maximum when beam is parallel to blood flow.', answer: true, explanation: 'Doppler shift increases with blood velocity.' },
      { text: 'Change in ultrasound velocity when it is reflected.', answer: false, explanation: 'Doppler effect is the change in frequency of the ultrasound echoes when reflected by a moving object. True: Doppler shift increases with blood velocity.' },
      { text: 'Increase in ultrasound frequency when reflected by blood moving towards probe.', answer: true, explanation: 'Doppler shift is directly proportional to transmitted frequency.' },
    ],
  },
  {
    id: 'q203',
    category: 'contrast',
    stem: 'contrast agents',
    source: 'QBank Q203',
    year: '2022',
    recall: true,
    stems: [
      { text: 'Microbubbles work by having a diameter equal to wavelength of ultrasound beam.', answer: false, explanation: 'Microbubbles are only a few micrometres in diameter, much smaller than the ultrasound wavelength; their nonlinear oscillation creates strong contrast echoes.' },
    ],
  },
  {
    id: 'q210',
    category: 'doppler',
    stem: 'doppler effect',
    source: 'QBank Q210',
    year: '2020',
    recall: true,
    stems: [
      { text: 'High Pulse Repetition Frequency (PRF) is limited by depth of tissue measured.', answer: true, explanation: 'The next pulse cannot be sent until echoes return from the selected depth, so maximum PRF is limited by imaging depth.' },
      { text: 'Sampling frequency must be twice the frequency to avoid aliasing.', answer: true, explanation: 'This is the Nyquist rule. Pulsed Doppler must sample at least twice the Doppler frequency shift to avoid aliasing.' },
      { text: 'Aliasing is more likely when the blood flow is 30cm per second.', answer: true, explanation: 'Aliasing can occur even at physiological velocities if PRF is too low, especially with deep sampling or high transmitted frequency.' },
    ],
  },
  {
    id: 'q211',
    category: 'doppler',
    stem: 'doppler effect',
    source: 'QBank Q211',
    year: '2020',
    recall: true,
    stems: [
      { text: 'Inversely proportional to density.', answer: false, explanation: 'Doppler shift depends on transmitted frequency, reflector velocity and cosine angle.' },
      { text: 'Inversely proportional to compressibility.', answer: false, explanation: 'Doppler shift depends on transmitted frequency, reflector velocity, insonation angle and sound speed, not tissue compressibility.' },
    ],
  },
  {
    id: 'q235',
    category: 'doppler',
    stem: 'acoustic output of ultrasound',
    source: 'QBank Q235',
    year: '2019',
    recall: true,
    stems: [
      { text: 'is higher for pulsed Doppler compared to B Mode.', answer: true, explanation: 'Doppler shift depends on transmitted frequency, reflector velocity and cosine angle.' },
      { text: 'is limited by strict adherence by manufacturers of ISPTA.', answer: false, explanation: 'Manufacturers comply with output display and regulatory limits, but ISPTA alone is not the sole strict limit on ultrasound output.' },
      { text: 'is limited by practitioners under ALARA.', answer: false, explanation: 'ALARA is a radiation protection term; ultrasound output is controlled using ALARP/lowest output and shortest time principles, not ionising-radiation dose limits.' },
      { text: 'temp of increase of 4 degrees for 5 minutes of scanning would not be considered hazardous.', answer: false, explanation: 'A sustained 4 degrees Celsius temperature rise for 5 minutes should be treated as potentially hazardous, not automatically safe.' },
      { text: 'directly related to probe self heating.', answer: false, explanation: 'Displayed acoustic output relates to energy delivered into tissue, not simply to heating of the probe casing.' },
    ],
  },
  {
    id: 'q238',
    category: 'resolution',
    stem: 'ultrasound (part 1)',
    source: 'QBank Q238',
    year: '2019',
    recall: true,
    stems: [
      { text: 'compressibility and density are inversely proportional in liquids.', answer: false, explanation: 'Compressibility and density are independent material properties in the sound speed relationship c equals one divided by the square root of compressibility times density.' },
      { text: 'Speed of sound is higher in bone than soft tissue.', answer: true, explanation: 'Sound speed is higher in bone than in soft tissue, although bone also causes high attenuation.' },
      { text: 'High frequency ultrasound has better spatial resolution.', answer: true, explanation: 'Higher frequency has shorter wavelength and better axial resolution.' },
      { text: 'High frequency ultrasound has higher penetration.', answer: false, explanation: 'Higher frequency improves resolution but reduces penetration due to greater attenuation.' },
      { text: 'Speed of sound is inversely proportional to compressibility.', answer: false, explanation: 'Sound speed varies as 1 divided by the square root of compressibility, not as the simple reciprocal.' },
    ],
  },
  {
    id: 'q239',
    category: 'impedance',
    stem: 'ultrasound (part 2)',
    source: 'QBank Q239',
    year: '2019',
    recall: true,
    stems: [
      { text: 'Reflection occurs when there is a different in tissue densities.', answer: false, explanation: 'As stated. Reflection is determined by a difference in acoustic impedance, which depends on both density and sound speed.' },
      { text: 'Lung tissue has high attenuation.', answer: true, explanation: 'Lung attenuates ultrasound strongly because air-tissue interfaces cause marked reflection and scattering.' },
      { text: 'Resolution is generally highest in the central axis of the beam.', answer: true, explanation: 'Lateral resolution is best near the beam focus/central beam where the beam is narrowest.' },
    ],
  },
  {
    id: 'q287',
    category: 'safety',
    stem: 'ultrasound safety',
    source: 'QBank Q287',
    year: '2012',
    recall: true,
    stems: [
      { text: 'If Transducer surface has high temperature it is due to increase in voltage.', answer: false, explanation: 'Probe surface heating mainly reflects electrical and mechanical losses within the transducer and poor acoustic coupling. It is not explained simply by increasing voltage.' },
      { text: 'Due to friction.', answer: false, explanation: 'Ultrasound heating is mainly from absorption of acoustic energy, not mechanical friction in the everyday sense.' },
      { text: 'Local heating mainly due to energy absorption.', answer: true, explanation: 'Tissue heating occurs when absorbed ultrasound energy is converted into heat.' },
      { text: 'TI is the increase in temp by 2 degrees.', answer: false, explanation: 'TI estimates tissue temperature rise and is affected by tissue attenuation, especially near bone.' },
    ],
  },
  {
    id: 'q289',
    category: 'doppler',
    stem: 'operator can control - in US',
    source: 'QBank Q289',
    year: '2012',
    recall: true,
    stems: [
      { text: 'PRF.', answer: true, explanation: 'The operator can alter pulse repetition frequency within limits imposed by imaging depth and mode.' },
      { text: 'Frame rate.', answer: true, explanation: 'The operator can alter frame rate indirectly through depth, sector width, line density and focal zones.' },
      { text: 'Focal zone.', answer: true, explanation: 'The operator can set focal zone position/number, which changes lateral resolution and frame rate.' },
    ],
  },
  {
    id: 'q320',
    category: 'impedance',
    stem: 'Regarding the interaction of US beams with human tissue',
    source: 'QBank Q320',
    year: 'Collection',
    recall: false,
    stems: [
      { text: 'The intensity of a beam decreases exponentially with depth', answer: true, explanation: 'US radiation undergoes exponential attenuation in tissue. This means a fixed fraction of the beam energy is removed per cm travelled' },
      { text: 'Both reflection & refraction can occur at the junction of two tissues with differing acoustic impedances', answer: true, explanation: 'Both processes can occur when there is a change in acoustic impedance, but refraction will only occur if the beam strikes the interface at an oblique angle' },
      { text: 'Most of the beam energy is converted to heat in the patient', answer: true, explanation: 'Only a small amount of US energy is detected to form an image, the rest is converted into heat' },
      { text: 'US radiation does not interact with structures that are smaller than the wavelength of the US pulse', answer: false, explanation: 'US radiation is scattered by objects that are smaller than the wavelength' },
      { text: 'The attenuation coefficient of soft tissue is typically 0.8dB/cm at 1MHz', answer: true, explanation: 'Quoted values range from 0.5 1.0 dB/cm/MHz' },
    ],
  },
  {
    id: 'q321',
    category: 'doppler',
    stem: 'The axial resolution of an ultrasound image depends on',
    source: 'QBank Q321',
    year: 'Collection',
    recall: false,
    stems: [
      { text: 'The diameter of the transducer crystal', answer: false, explanation: 'This will change the width of the beam line & so will affect lateral resolution, rather than axial resolution.' },
      { text: 'The pulse repetition frequency (PRF)', answer: false, explanation: 'PRF is the number of pulses emitted per second. This will not affect axial resolution.' },
      { text: 'Focusing of the US beam', answer: false, explanation: 'Beam focusing will change the width of the beam line & so will affect lateral resolution, rather than axial resolution.' },
      { text: 'The spatial pulse length (SPL)', answer: true, explanation: 'Spatial pulse length (number of waves in each pulse x wavelength) directly affects axial resolution. Axial resolution = SPL/2' },
      { text: 'The depth of the target in the patient', answer: false, explanation: 'Axial resolution = Spatial pulse length (SPL) / 2. The SPL does not change with depth, so axial resolution is independent of depth.' },
    ],
  },
  {
    id: 'q322',
    category: 'doppler',
    stem: 'Regarding the Doppler Effect in US imaging',
    source: 'QBank Q322',
    year: 'Collection',
    recall: false,
    stems: [
      { text: 'The frequency of reflected US waves decreases for objects moving towards the transducer', answer: false, explanation: 'The frequency increases for objects moving towards the receiver' },
      { text: 'The effect is greatest for structures moving at right angles to the direction of the US beam', answer: false, explanation: 'The effect is most noticeable when the beam is in the same direction as the motion' },
      { text: 'It requires a higher frequency than B-mode studies', answer: false, explanation: 'The same range of frequencies are used for both B-mode & Doppler' },
      { text: 'The maximum detectable frequency shift is one-half of the pulse repetition frequency (PRF)', answer: true, explanation: 'This is true for pulsed Doppler' },
      { text: 'Aliasing does not occur during continuous wave Doppler', answer: true, explanation: 'Aliasing only occurs with pulsed Doppler' },
    ],
  },
  {
    id: 'q323',
    category: 'doppler',
    stem: 'Regarding the biological effects of ultrasound radiation',
    source: 'QBank Q323',
    year: 'Collection',
    recall: false,
    stems: [
      { text: 'Thermal effects are more prevalent in bone than soft tissue', answer: true, explanation: 'Bone is a stronger absorber of US than soft tissue, so thermal effects will be greater' },
      { text: 'B-mode scans are potentially more dangerous than Doppler mode', answer: false, explanation: 'Doppler uses higher power, longer pulses & must radiate along the same scan line multiple times. These factors can potentially result in higher temperature rises in tissues.' },
      { text: 'The exposure time of a foetal examination should be restricted for a thermal index of 0.5', answer: false, explanation: 'Restricted imaging times are recommended only if TI > 0.7' },
      { text: 'Neonatal lung damage can occur if the mechanical index > 0.3', answer: true, explanation: 'There is increased risk of mechanical damage (cavitation ) in lung tissue for MI > 0.3' },
      { text: 'Cavitation occurs more readily when contrast agents are used', answer: true, explanation: 'US contrast agents contain gas-filled micro-bubbles. When exposed to US radiation these bubbles are more likely to undergo cavitation than soft tissue.' },
    ],
  },
  {
    id: 'q350',
    category: 'impedance',
    stem: 'In ultrasound examinations, the acoustic impedance of a',
    source: 'QBank Q350',
    year: 'Collection',
    recall: false,
    stems: [
      { text: 'Increases with the mass density of the tissue', answer: true, explanation: 'Acoustic impedance measures how much a medium resists the transmission of sound waves. Denser tissues, like bone, have molecules packed closely together and this contributes to higher acoustic impedance.' },
      { text: 'Increases with the speed of propagation of the beam in the tissue', answer: true, explanation: 'Sound travels faster through stiffer, less compressible materials. This \'stiffness\' also increases the acoustic impedance of the medium. Hence, acoustic impedance increases with the speed of sound.' },
      { text: 'Depends on whether the tissue is stationary or moving', answer: false, explanation: 'Acoustic impedance is an intrinsic property of the tissue regardless of its state of motion' },
      { text: 'Is measured in units of decibels (dB)', answer: false, explanation: 'dB are used to compare the relative intensity of waves (for instance for quantifying attenuation). Acoustic impedance is measured in units called Rayls' },
      { text: 'Muscle has a greater acoustic impedance than fat', answer: true, explanation: 'Muscle has a slightly higher density than fat, so its acoustic impedance will be slightly greater.' },
    ],
  },
  {
    id: 'q351',
    category: 'doppler',
    stem: 'In B-mode scanning',
    source: 'QBank Q351',
    year: 'Collection',
    recall: false,
    stems: [
      { text: 'Multiple pulses are sent down a single scan line', answer: false, explanation: 'This is true for A-mode & M-mode scans, but not for B-mode' },
      { text: 'Real time images are produced', answer: true, explanation: 'Images are built up in real time and refreshed each second' },
      { text: 'The selected pulse repetition frequency (PRF) depends on the imaging depth', answer: true, explanation: 'It takes 13 microseconds for a pulse to travel to & from a structure 1cm from the transducer. Deeper structures require longer intervals between successive pulses, so the PRF must decrease to prevent pulses overlapping' },
      { text: 'Image brightness is dependent on the angle of the transducer relative to the organ surface', answer: true, explanation: 'This will effect the angle of incidence of the beam on a tissue boundary. The maximum echo strength is received from normal incidence/reflection' },
      { text: 'Image brightness is proportional to the acoustic impedance of the tissues', answer: false, explanation: 'Image brightness in B-mode scans is proportional to the echo intensity. This depends on the difference in acoustic impedance between adjacent tissues' },
    ],
  },
  {
    id: 'q352',
    category: 'resolution',
    stem: 'Axial resolution in a B-mode scan',
    source: 'QBank Q352',
    year: 'Collection',
    recall: false,
    stems: [
      { text: 'Is dependent on the spatial pulse length (SPL)', answer: true, explanation: 'SPL = US wavelength x No of waves in a pulse. Axial resolution = SPL/2' },
      { text: 'Varies with depth in the patient', answer: false, explanation: 'Axial resolution depends only on the spatial pulse length (SPL) which in turn, depends on the wavelength of the US wave. Wavelength doesn\'t change with depth.' },
      { text: 'Improves with increasing frequency', answer: true, explanation: 'The wavelength of the US waves (and therefore the SPL) is shorter at higher frequencies. Hence axial resolution improves with increasing frequency.' },
      { text: 'Is dependent on the diameter of the transducer', answer: false, explanation: 'The diameter of the transducer does not influence the SPL and therefore does not affect axial resolution.' },
      { text: 'Is typically 0.5-1mm', answer: true, explanation: 'Wavelengths in US are 0.3-1.0mm, which produce Spatial Pulse Lengths of 0.9-3mm. Remember, Axial resolution = SPL/2' },
    ],
  },
  {
    id: 'q353',
    category: 'doppler',
    stem: 'The frequency shift in Doppler ultrasound',
    source: 'QBank Q353',
    year: 'Collection',
    recall: false,
    stems: [
      { text: 'Increases with Doppler angle', answer: false, explanation: 'Doppler shift is greatest for angle=0 degrees and drops to zero as the angle approaches 90 degrees' },
      { text: 'Increases with operating frequency', answer: true, explanation: 'Increasing the operating frequency of the US waves causes a larger frequency shift in the reflected signal' },
      { text: 'Increases with the velocity of blood flow', answer: true, explanation: 'The Doppler frequency shift increases in proportion to the velocity of blood flow' },
      { text: 'Increases with the propagation velocity of the ultrasound beam', answer: false, explanation: 'The Doppler shift is inversely proportional to propagation velocity' },
      { text: 'Increases with pulse repetition frequency (PRF)', answer: false, explanation: 'The PRF determines the maximum frequency shift that can be detected before aliasing occurs. It does affect not the size of the frequency shift though.' },
    ],
  },
  {
    id: 'q379',
    category: 'transducers',
    stem: 'In diagnostic ultrasound',
    source: 'QBank Q379',
    year: 'Collection',
    recall: false,
    stems: [
      { text: 'The velocity of sound in soft tissue is about 150 ms-1', answer: false, explanation: 'The average value is assumed to be 1540 ms-1' },
      { text: 'The transducer is in “listening mode” for > 99% of the time', answer: true, explanation: 'Each second, a transducer spend 1-5msec emitting radiation (in separate short bursts). It is in \'listening mode\' for the remainder of the time.' },
      { text: 'Time gain compensation is used to amplify echoes from deep structures', answer: true, explanation: 'TGC amplifies signals from depth to compensate for increased attenuation' },
      { text: 'Time gain compensation may be used to compensate for increased echo amplitude arising behind fluid-filled structures', answer: true, explanation: 'TGC can be varied by the operator to amplify signals from depth at different rates' },
      { text: 'Refraction occurs at interfaces between tissues with different acoustic velocities', answer: true, explanation: 'Refraction is the change in direction of the transmitted beam when it strikes the boundary of 2 media at an oblique angle.' },
    ],
  },
  {
    id: 'q382',
    category: 'artefacts',
    stem: 'Regarding ultrasound artifacts',
    source: 'QBank Q382',
    year: 'Collection',
    recall: false,
    stems: [
      { text: 'Variations in the speed of the US pulse can cause displacement of structures along the axis of the US beam', answer: true, explanation: 'The depth of the reflecting surface is determined using an assumed speed of 1540m/s. If the actual speed is different from this the depth is incorrectly calculated.' },
      { text: 'Comet tail artifact is caused by reverberation of the US beam', answer: true, explanation: 'The artifact is caused by multiple closely spaced reverberations' },
      { text: 'Acoustic shadowing can be caused by both cysts & gallstones', answer: false, explanation: 'The fluid within cysts is less attenuating than surrounding soft tissue and will cause distal enhancement.' },
      { text: 'Side lobes in the US beam can result in the lateral displacement of structures in the image', answer: true, explanation: 'Side lobes are weak off-axis beams emitted by the transducer. They can cause signals from off-axis structures to be detected and falsely placed along the central beam axis in the image.' },
      { text: 'Refraction artifacts can be reduced by reducing the transmit frequency', answer: false, explanation: 'Refraction is the change in direction of the transmitted beam when it strikes the boudary of 2 media at an oblique angle. The amount of refraction that occurs depends only on the angle of incidence & the speed of US in the two media not on the frequency of the US waves.' },
    ],
  },
  {
    id: 'q383',
    category: 'doppler',
    stem: 'Regarding the temperature rise in an ultrasound examination',
    source: 'QBank Q383',
    year: 'Collection',
    recall: false,
    stems: [
      { text: 'It increases with pulse repetition frequency, PRF', answer: true, explanation: 'As the PRF increases more US pulses are emitted per second. Each pulse transfer energy to the patient & will contribute to an increase in temperature.' },
      { text: 'It is greatest in the superficial layers of the patient', answer: true, explanation: 'US beams are attenuated as they travel through a patient. The attenuation is least near the surface and so the energy carried by the beam is greatest. at shallow depths.' },
      { text: 'It is greater in bone than soft tissue', answer: true, explanation: 'Bone is much more highly absorbing than soft tissue.' },
      { text: 'It increases with operating frequency of the probe', answer: true, explanation: 'Beam attenuation increases strongly with increasing operating frequency. So more US energy will; be absorbed per cm travelled, which manifests as a temperature rise.' },
      { text: 'It is greater in highly perfused tissues', answer: false, explanation: 'Blood flow will carry heat energy away from the tissue.' },
    ],
  },
  {
    id: 'q410',
    category: 'impedance',
    stem: 'Attenuation of an ultrasound beam in soft tissue is',
    source: 'QBank Q410',
    year: 'Collection',
    recall: false,
    stems: [
      { text: 'Independent of frequency', answer: false, explanation: 'Attenuation increases with increasing frequency' },
      { text: 'Typically 0.8dB/cm/MHz', answer: true, explanation: 'The attenuation coefficient for soft tissues is in the range 0.5-1.0 dB/cm at 1 MHz' },
      { text: 'Mainly due to reflection & scattering at boundaries', answer: false, explanation: 'It is mainly due to absorption' },
      { text: 'Proportional to the acoustic impedance of the tissue', answer: false, explanation: 'There is no link between acoustic impedance and the attenuation coefficient of a tissue' },
      { text: 'Exponential with depth', answer: true, explanation: '\'Exponential\' means the US beam decreases in intensity by the same relative amount with each cm of tissue it passes through.' },
    ],
  },
  {
    id: 'q411',
    category: 'impedance',
    stem: 'Concerning ultrasound imaging',
    source: 'QBank Q411',
    year: 'Collection',
    recall: false,
    stems: [
      { text: 'The spatial pulse length decreases with increasing frequency', answer: true, explanation: 'SPL=wavelength x no of waves. Wavelength decreases with increasing frequency' },
      { text: 'The transducer crystal resonates at a frequency determined by its diameter', answer: false, explanation: 'The resonant frequency depends on the thickness of the crystal, not its diameter' },
      { text: 'A continuous wave probe produces a narrow range of frequencies', answer: true, explanation: 'CW probes produce an unbroken wave at a single frequency and associated harmonics. Short pulses of can only be produced with a much broader range of wave frequencies' },
      { text: 'At least 5% of the incident beam energy must be reflected back to the transducer for a tissue boundary to be detected', answer: false, explanation: 'Reflected intensities of 1% or less can produce detectable signals' },
      { text: 'The speed of propagation of the beam is higher in soft tissue than in fat', answer: true, explanation: 'Ultrasound travels slower in fat than in most other soft tissue (ie muscle). Typical values are about 1450 m/s in fat and ~1570 m/s in muscle. Muscle is stiffer than fat (which is more compressible) and this results in a higher propagation velocity of the US waves.' },
    ],
  },
  {
    id: 'q412',
    category: 'impedance',
    stem: 'Regarding diagnostic ultrasound imaging',
    source: 'QBank Q412',
    year: 'Collection',
    recall: false,
    stems: [
      { text: 'Phased array transducers can vary both the length and focal depth of a scan line', answer: true, explanation: 'By manipulating the timing between the firing of each crystal in the array scan lines can be directed at any angle with variable focal depth' },
      { text: 'Linear array transducers generate a rectangular field of view', answer: true, explanation: 'Scan lines are emitted at right angles to the face of the transducer' },
      { text: 'In harmonic imaging, echoes are detected at twice the frequency of the transmitted pulse', answer: true, explanation: 'Low intensity background signals from scattering, reverberations and side lobes are eliminated by this technique.' },
      { text: 'Speckle signal is due to diffuse reflection at tissue boundaries', answer: false, explanation: '\'Speckle\' signal refers to image texture within some tissues. It is caused by the interaction of multiple scattering events from structures < wavelength of the US pulse' },
      { text: 'Comet tail artifacts and ring down artifacts are both caused by reverberation of the ultrasound pulses', answer: false, explanation: 'Comet tail artifacts are caused by repeated reverberations, but ring down artifacts are due to a continuous signal from tissue that has been stimulated into oscillating by the pressure variations in the US waves' },
    ],
  },
  {
    id: 'q413',
    category: 'doppler',
    stem: 'An increase in operating frequency in ultrasound studies will',
    source: 'QBank Q413',
    year: 'Collection',
    recall: false,
    stems: [
      { text: 'An improvement in axial resolution', answer: true, explanation: 'Increasing the operating frequency will improve both axial & lateral resolution' },
      { text: 'No change in the speed of US wave propagation', answer: true, explanation: 'Wave speed depends on the properties of the medium through which it is travelling' },
      { text: 'Increased risk of thermal damage', answer: true, explanation: 'Absorption increases with frequency and will result in greater tissue heating' },
      { text: 'A reduced incidence of aliasing artifacts in Doppler scans', answer: false, explanation: 'The Doppler shift increases with increasing operating frequency, so aliasing artifacts would become more likely' },
      { text: 'An increase in signal strength from distal structures', answer: false, explanation: 'The signal strength of echoes from deep structures will be lower due to increased attenuation at higher frequencies' },
    ],
  },
  {
    id: 'q422',
    category: 'doppler',
    stem: 'Concerning diagnostic ultrasound',
    source: 'QBank Q422',
    year: 'Collection',
    recall: false,
    stems: [
      { text: 'A thicker transducer will emit ultrasound with a longer wavelength', answer: true, explanation: 'For a given resonant frequency, a thicker piezoelectric element has a longer wavelength/lower frequency.' },
      { text: 'Amplitude and direction of blood flow can be assessed using power doppler', answer: false, explanation: 'Power Doppler shows flow amplitude/sensitivity but does not give flow direction.' },
      { text: 'The fastest flow that can be accurately measured is the velocity that produces a doppler shift frequency of half the PRF', answer: true, explanation: 'The Nyquist limit is half the pulse repetition frequency.' },
      { text: 'Aliasing can be reduced by increasing the angle of insonation', answer: false, explanation: 'Aliasing is reduced by lowering the Doppler shift, usually by reducing the Doppler angle toward better alignment, increasing PRF, or lowering frequency; increasing angle is not a reliable fix.' },
      { text: 'Harmonic imaging improves lateral resolution', answer: false, explanation: 'Harmonic imaging mainly improves contrast and reduces artefact; lateral resolution is not its main improvement.' },
    ],
  },
  {
    id: 'q446',
    category: 'transducers',
    stem: 'Concerning ultrasound transducers',
    source: 'QBank Q446',
    year: 'Collection',
    recall: false,
    stems: [
      { text: 'In a linear array transducer, electronic focusing is achieved by triggering inner elements before the outer ones.', answer: true, explanation: 'Linear arrays can electronically focus by timing element excitation, with inner/outer delays shaping the beam.' },
      { text: 'A curvilinear array produces a sector shaped field.', answer: true, explanation: 'Curvilinear arrays produce a sector/trapezoid-shaped field.' },
      { text: 'Reducing the sector width increases the frame rate of a phased array.', answer: true, explanation: 'Narrowing the sector reduces lines per frame and increases frame rate.' },
      { text: 'Beam steering is optimal with an annular array.', answer: false, explanation: 'Beam steering is a phased-array/linear-array function; annular arrays focus but do not steer optimally.' },
      { text: 'Require a thin matching layer as well as the coupling agent.', answer: true, explanation: 'A matching layer plus coupling gel reduces acoustic impedance mismatch.' },
    ],
  },
  {
    id: 'q449',
    category: 'impedance',
    stem: 'Regarding the pulse echo principle',
    source: 'QBank Q449',
    year: 'Collection',
    recall: false,
    stems: [
      { text: 'more information about the location and size of the reflector can be obtained if the beam is narrow.', answer: true, explanation: 'A narrow beam improves spatial localisation of reflectors.' },
      { text: 'The speed of sound in most soft tissues is similar.', answer: true, explanation: 'Soft tissue sound speeds are sufficiently similar for pulse-echo ranging assumptions.' },
      { text: 'The strength of the echoes decreases with depth.', answer: true, explanation: 'Echo strength decreases with depth due to attenuation.' },
      { text: 'Time corrected gain (TGC) can be manually altered.', answer: true, explanation: 'TGC can be manually adjusted to compensate for depth attenuation.' },
      { text: 'Ultrasound is not emitted continuously from the transducer.', answer: true, explanation: 'Diagnostic pulse-echo ultrasound is pulsed, not continuous emission.' },
    ],
  },
]

/* ------------------------------------------------------------------ *
 * Interactive questions written for this laboratory
 * ------------------------------------------------------------------ */

export type InteractiveKind =
  | 'direction'
  | 'equation'
  | 'probe'
  | 'artefact'
  | 'doppler'
  | 'safety'
  | 'diagram'
  | 'rank'
  | 'slider'

export type InteractiveQuestion = {
  id: string
  kind: InteractiveKind
  category: UsCategory
  question: string
  options: string[]
  correct: number
  /** One line: why the answer is right. */
  reason: string
  /** The full explanation. */
  explanation: string
  /** Why the tempting wrong answer sounds plausible. */
  distractor: string
  equation?: string
  /** Fact bank card this question hangs off. */
  factId?: string
  experiment: string
  source: string
}

export const INTERACTIVE_QUESTIONS: InteractiveQuestion[] = [
  {
    id: 'i-freq-direction',
    kind: 'direction',
    category: 'fundamentals',
    question:
      'You change from a 5 MHz probe to a 10 MHz probe on the same patient. Which set of changes is correct?',
    options: [
      'Wavelength halves, axial resolution improves, penetration falls',
      'Wavelength doubles, axial resolution improves, penetration falls',
      'Wavelength halves, speed of sound doubles, penetration improves',
      'Wavelength halves, axial resolution worsens, penetration improves',
    ],
    correct: 0,
    reason: 'λ = c/f, so doubling f halves λ; shorter pulses resolve better but attenuate faster.',
    explanation:
      'At 1540 m/s, 5 MHz gives λ ≈ 0.31 mm and 10 MHz gives λ ≈ 0.15 mm. A shorter wavelength means a shorter spatial pulse length, and axial resolution is SPL/2. But attenuation in dB scales with frequency, so the same depth now costs twice as many decibels and deep echoes drop below the noise floor sooner.',
    distractor:
      'Option 3 is tempting because it feels as though a "faster" probe should make sound travel faster. It does not — speed belongs to the medium alone.',
    equation: 'λ = c / f        axial resolution = SPL/2',
    factId: 'us-frequency-tradeoff',
    experiment: '/ultrasound-lab',
    source: 'QBank Q238, Q413',
  },
  {
    id: 'i-impedance-calc',
    kind: 'equation',
    category: 'impedance',
    question:
      'Tissue A has density 1050 kg/m³ and speed 1540 m/s. Tissue B has density 1080 kg/m³ and speed 1580 m/s. Which statement is correct?',
    options: [
      'Z_A ≈ 1.62 MRayl, Z_B ≈ 1.71 MRayl, and reflection at the interface is well under 1%',
      'Z_A ≈ 1.62 MRayl, Z_B ≈ 1.71 MRayl, and reflection is about 15%',
      'The impedances are equal because both are soft tissues',
      'Reflection cannot be calculated without knowing the frequency',
    ],
    correct: 0,
    reason: 'Z = ρc gives 1.62 and 1.71 MRayl; R = ((1.71−1.62)/(1.71+1.62))² ≈ 0.07%.',
    explanation:
      'Multiply density by speed for each: 1050 × 1540 = 1.617 × 10⁶ and 1080 × 1580 = 1.706 × 10⁶ rayl. The reflection coefficient uses the difference over the sum, squared — a tiny number. That is why the beam penetrates through many soft-tissue boundaries and still has energy left for deep structures.',
    distractor:
      '15% appears in the recall collection as a false stem about the soft tissue–fluid interface. Soft-tissue interfaces reflect a fraction of one per cent, not double figures.',
    equation: 'Z = ρc        R = ((Z₂ − Z₁)/(Z₂ + Z₁))²',
    factId: 'us-reflection-coefficient',
    experiment: '/ultrasound-lab/impedance',
    source: 'QBank Q31, Q195',
  },
  {
    id: 'i-rank-interfaces',
    kind: 'rank',
    category: 'impedance',
    question: 'Which interface reflects the LARGEST fraction of the incident beam?',
    options: [
      'Soft tissue → air',
      'Soft tissue → cortical bone',
      'Soft tissue → muscle',
      'Soft tissue → simple fluid',
    ],
    correct: 0,
    reason: 'Air has an impedance about four thousand times lower than soft tissue.',
    explanation:
      'Ranked by reflected fraction: soft tissue–air is over 99%, soft tissue–bone roughly 43%, soft tissue–muscle about 0.07%, soft tissue–fluid about 0.2%. The air interface is in a different league entirely, which is why coupling gel is not optional and why bowel gas defeats the beam.',
    distractor:
      'Bone feels like it should be the biggest because it produces such a bright line and a dense shadow. It reflects strongly — but air reflects almost everything.',
    equation: 'R = ((Z₂ − Z₁)/(Z₂ + Z₁))²',
    factId: 'us-air-interface',
    experiment: '/ultrasound-lab/impedance',
    source: 'QBank Q31, Q195',
  },
  {
    id: 'i-axial-vs-lateral',
    kind: 'direction',
    category: 'resolution',
    question: 'Which change improves AXIAL resolution?',
    options: [
      'Increasing backing damping so the pulse contains fewer cycles',
      'Increasing the transducer diameter',
      'Moving the focal zone to the depth of interest',
      'Increasing the pulse repetition frequency',
    ],
    correct: 0,
    reason: 'Axial resolution is SPL/2, and damping shortens the pulse.',
    explanation:
      'Axial resolution depends only on spatial pulse length, which is cycles × wavelength. Damping removes cycles; raising the frequency shortens the wavelength. Everything else in the list — diameter, focusing, PRF — changes the beam or the timing, not the pulse length. The QBank lists all three explicitly as false stems.',
    distractor:
      'Diameter and focusing are the classic swap. They control beam width and therefore LATERAL resolution.',
    equation: 'axial = SPL/2 = (n × λ)/2',
    factId: 'us-axial-resolution',
    experiment: '/ultrasound-lab/resolution',
    source: 'QBank Q321, Q352',
  },
  {
    id: 'i-focal-frame',
    kind: 'direction',
    category: 'imaging',
    question:
      'A fetal heart is moving too fast to assess. Which change will most improve temporal resolution?',
    options: [
      'Reduce the sector width and use a single focal zone',
      'Add two more focal zones over the heart',
      'Increase the imaging depth to include the whole uterus',
      'Increase the line density',
    ],
    correct: 0,
    reason: 'Fewer lines and fewer pulses per line means more frames per second.',
    explanation:
      'Frame rate = PRF / (lines per frame × focal zones). Narrowing the sector cuts the number of lines; using one focal zone cuts the pulses per line. Every other option adds pulses per frame and slows the display down.',
    distractor:
      'Adding focal zones genuinely does improve lateral resolution over a greater depth — but each one costs a full extra pulse down every line, which is exactly the wrong trade when motion is the problem.',
    equation: 'frame rate = PRF / (lines × focal zones)',
    factId: 'us-frame-rate-levers',
    experiment: '/ultrasound-lab/resolution',
    source: 'QBank Q446, Q289',
  },
  {
    id: 'i-probe-select',
    kind: 'probe',
    category: 'probes',
    question:
      'You need to image the heart through an intercostal space in an adult. Which probe?',
    options: [
      'Phased array — small footprint, sector image, electronic steering',
      'Linear array — highest frequency and best resolution',
      'Curvilinear array — best penetration of the three',
      'Hockey-stick linear — smallest footprint of all',
    ],
    correct: 0,
    reason: 'The rib space dictates the footprint before image quality is even considered.',
    explanation:
      'A phased array uses a very small aperture yet sweeps a wide sector at depth, so it fits between ribs and still sees the whole heart. This question is really about the separation between two independent criteria: **frequency** decides resolution and penetration; **footprint** decides whether you can get acoustic access at all.',
    distractor:
      'The hockey-stick probe does have a tiny footprint, but at 10–20 MHz it has nothing like the penetration needed to reach the heart. Small footprint alone is not enough.',
    factId: 'us-phased-array',
    experiment: '/ultrasound-lab/probes',
    source: 'QBank Q412, Q446',
  },
  {
    id: 'i-artefact-cyst',
    kind: 'artefact',
    category: 'artefacts',
    question:
      'A rounded anechoic lesion shows a bright band immediately deep to it. What is the mechanism?',
    options: [
      'The beam lost less energy passing through the low-attenuation fluid, so the tissue beyond receives a stronger beam',
      'The fluid reflected the beam strongly at its far wall',
      'The machine amplified those echoes because they came from deeper',
      'Refraction focused the beam beyond the lesion',
    ],
    correct: 0,
    reason: 'Posterior enhancement is an attenuation effect, not a reflection effect.',
    explanation:
      'The lesion attenuates far less than the tissue either side of it. The beam that travelled through it therefore arrives at deeper tissue with more energy left, and the echoes it generates are stronger. It is a genuinely useful sign that a lesion is fluid.',
    distractor:
      'Option 3 describes TGC, which applies to the entire depth band equally. Enhancement is confined to the column behind the lesion — which is the observation that identifies it.',
    factId: 'us-enhancement',
    experiment: '/ultrasound-lab/artefacts',
    source: 'QBank Q382',
  },
  {
    id: 'i-doppler-90',
    kind: 'doppler',
    category: 'doppler',
    question:
      'A vessel with brisk flow shows no colour signal. The beam is exactly perpendicular to it. Why?',
    options: [
      'cos 90° = 0, so the Doppler shift is zero',
      'The wall filter has removed the signal',
      'Flow perpendicular to the beam is too slow to detect',
      'The Nyquist limit has been exceeded',
    ],
    correct: 0,
    reason: 'Δf ∝ cos θ, and the cosine of 90° is exactly zero.',
    explanation:
      'There is nothing wrong with the machine and nothing wrong with the vessel. At 90° the flow has no component along the beam, so there is no shift to detect. Angle the probe, use the beam-steering control, or approach from a different window.',
    distractor:
      'Aliasing produces a wrapped or mosaic signal, not an absent one. Absent signal at exactly 90° is the geometry, every time.',
    equation: 'Δf = 2 f₀ v cos θ / c',
    factId: 'us-doppler-cosine',
    experiment: '/ultrasound-lab/doppler',
    source: 'QBank Q66, Q322',
  },
  {
    id: 'i-aliasing-fix',
    kind: 'doppler',
    category: 'doppler',
    question:
      'A pulsed Doppler spectrum is wrapping around the baseline. Which change genuinely RAISES the Nyquist limit?',
    options: [
      'Increase the PRF (velocity scale)',
      'Shift the baseline downwards',
      'Increase the spectral gain',
      'Increase the sample volume size',
    ],
    correct: 0,
    reason: 'Nyquist = PRF/2, so only a change in PRF moves the limit.',
    explanation:
      'Raising the PRF raises the limit directly — though depth caps how far you can go. Reducing depth, lowering the transmit frequency, or switching to continuous wave also help, the last because CW samples continuously and cannot alias at all. Baseline shift only re-allocates the display range; the limit itself is untouched, although that can be enough for a spectrum only slightly over.',
    distractor:
      'Baseline shift is the classic trap: it looks like it fixed the problem on screen, and candidates then claim it raised the Nyquist limit. It did not.',
    equation: 'Nyquist limit = PRF / 2',
    factId: 'us-aliasing-fixes',
    experiment: '/ultrasound-lab/aliasing',
    source: 'QBank Q422, Q119',
  },
  {
    id: 'i-gain-power',
    kind: 'safety',
    category: 'safety',
    question:
      'A deep image is too dark. Which action increases the acoustic exposure to the patient?',
    options: [
      'Increasing the output power',
      'Increasing the overall receiver gain',
      'Increasing the time gain compensation in the far field',
      'Widening the displayed dynamic range',
    ],
    correct: 0,
    reason: 'Only output power changes what is transmitted into the patient.',
    explanation:
      'Gain, TGC and dynamic range all act on echoes that have already come back — they change the picture, not the exposure. Output power changes the transmitted pulse and therefore MI and TI. Work through gain, TGC, frequency, focus, depth and probe position before reaching for power.',
    distractor:
      'TGC feels like it must be doing something to the beam because it is depth-dependent. It is not: it is a depth-dependent receiver amplifier.',
    factId: 'us-gain-vs-power',
    experiment: '/ultrasound-lab/controls',
    source: 'Standard physics · Fact Bank',
  },
  {
    id: 'i-mi-ti',
    kind: 'safety',
    category: 'safety',
    question: 'Which statement about the two safety indices is correct?',
    options: [
      'MI falls as frequency rises; TI rises with frequency, dwell time and bone in the beam',
      'Both indices rise with frequency',
      'MI can be derived from the measured tissue temperature rise',
      'TI is defined as a temperature rise of 2 °C',
    ],
    correct: 0,
    reason: 'MI = p₋/√f, so frequency is in the denominator; absorption and heating rise with frequency.',
    explanation:
      'They point in opposite directions with respect to frequency, which is exactly why examiners pair them. MI is about cavitation and non-thermal effects; TI is about heating, and is an index — the ratio of power used to the power that would raise tissue by 1 °C in a model — not a measured temperature.',
    distractor:
      '"TI is a 2 degree rise" appears verbatim as a false stem in the recall collection. And deriving MI from heating is the false stem that opens the recalled MI question.',
    equation: 'MI = p₋ / √f',
    factId: 'us-ti-meaning',
    experiment: '/ultrasound-lab/safety',
    source: 'QBank Q21, Q287',
  },
  {
    id: 'i-speed-error',
    kind: 'artefact',
    category: 'artefacts',
    question:
      'A reflector lies 8 cm deep beneath a thick layer of fat (c ≈ 1450 m/s). Where does the machine place it?',
    options: [
      'Deeper than it really is',
      'Shallower than it really is',
      'At the correct depth, but laterally displaced',
      'At the correct depth — the machine measures speed directly',
    ],
    correct: 0,
    reason: 'Slower tissue means a longer round trip, and the machine reads longer time as greater depth.',
    explanation:
      'The scanner converts time to depth assuming 1540 m/s. In fat the pulse travels more slowly, so it takes longer than the machine expects and the reflector is drawn too deep: apparent depth = true depth × 1540 / 1450 ≈ 8.5 cm. Faster tissue does the opposite. The displacement is along the beam axis.',
    distractor:
      'Lateral displacement is the signature of REFRACTION or a side lobe. Speed error moves things along the beam, not across it.',
    equation: 'apparent depth = true depth × 1540 / c_actual',
    factId: 'us-speed-error',
    experiment: '/ultrasound-lab/artefacts',
    source: 'QBank Q382',
  },
  {
    id: 'i-harmonics',
    kind: 'direction',
    category: 'harmonics',
    question: 'Tissue harmonic imaging is switched on. What actually improves?',
    options: [
      'Contrast resolution, with less near-field clutter and less side-lobe artefact',
      'Lateral resolution, because the beam is narrower at twice the frequency',
      'Penetration, because harmonics attenuate less',
      'Temporal resolution, because fewer pulses are needed',
    ],
    correct: 0,
    reason: 'Harmonics build up with depth, so there is little harmonic clutter near the probe.',
    explanation:
      'Harmonics are generated progressively by nonlinear propagation, so almost none exists in the near field where reverberation clutter lives. Side lobes are too weak to generate harmonics either. Cysts look cleaner and contrast resolution improves — but the harmonic signal is weaker and at a higher frequency, so penetration falls.',
    distractor:
      '"Harmonic imaging improves lateral resolution" is marked FALSE in the QBank. It is a plausible-sounding leap from "twice the frequency".',
    factId: 'us-harmonics-benefit',
    experiment: '/ultrasound-lab/harmonics',
    source: 'QBank Q412, Q422',
  },
  {
    id: 'i-tgc-equalise',
    kind: 'slider',
    category: 'attenuation',
    question:
      'Identical reflectors at 2, 5 and 9 cm appear progressively darker. What is the correct first response?',
    options: [
      'Increase TGC progressively with depth so the three appear equally bright',
      'Increase output power until the deepest one is bright enough',
      'Narrow the dynamic range until only the bright reflector is visible',
      'Increase the transmit frequency to strengthen the deep echoes',
    ],
    correct: 0,
    reason: 'The problem is depth-dependent attenuation, so the fix is depth-dependent amplification.',
    explanation:
      'Attenuation removes a fixed number of decibels per centimetre per megahertz, so the deep reflector genuinely returns a weaker echo. TGC applies more gain to later-returning echoes and restores a uniform image without changing the patient exposure at all.',
    distractor:
      'Reaching for power works, but it is the wrong first move: it increases exposure to achieve something the receiver can do for free. Raising the frequency makes the problem worse, not better.',
    equation: 'Attenuation (dB) = α × f × x',
    factId: 'us-tgc',
    experiment: '/ultrasound-lab/attenuation',
    source: 'QBank Q379 · Fact Bank',
  },
  {
    id: 'i-refraction-predict',
    kind: 'diagram',
    category: 'refraction',
    question:
      'A beam passes obliquely from fat (1450 m/s) into muscle (1580 m/s). Which way does it bend?',
    options: [
      'Away from the normal, because the second medium is faster',
      'Towards the normal, because the second medium is denser',
      'It does not bend — the impedances are too similar',
      'It does not bend unless the incidence is exactly perpendicular',
    ],
    correct: 0,
    reason: 'sin θ₁/c₁ = sin θ₂/c₂, so a larger c₂ means a larger θ₂.',
    explanation:
      'Entering a faster medium the beam bends away from the normal; entering a slower one it bends towards it. Refraction is governed by the SPEED difference and the angle — impedance decides reflection, not refraction. And it requires oblique incidence: at exactly perpendicular there is no bending at all.',
    distractor:
      'Option 4 inverts the condition. Normal incidence is the one case where refraction cannot occur.',
    equation: 'sin θ₁ / c₁ = sin θ₂ / c₂',
    factId: 'us-snell',
    experiment: '/ultrasound-lab/refraction',
    source: 'QBank Q379, Q382',
  },
  {
    id: 'i-damping-chain',
    kind: 'direction',
    category: 'transducers',
    question: 'You increase the damping of the backing block. Which chain is correct?',
    options: [
      'Shorter pulse → broader bandwidth → lower Q → better axial resolution → lower sensitivity',
      'Shorter pulse → narrower bandwidth → higher Q → better axial resolution → higher sensitivity',
      'Longer pulse → broader bandwidth → lower Q → better lateral resolution → lower sensitivity',
      'Shorter pulse → broader bandwidth → lower Q → better lateral resolution → higher sensitivity',
    ],
    correct: 0,
    reason: 'Everything follows from the shorter pulse — including the cost in sensitivity.',
    explanation:
      'Damping absorbs the ringing behind the crystal, so fewer cycles leave the probe. A shorter pulse needs a wider range of frequencies to construct it, so bandwidth rises and Q (centre frequency ÷ bandwidth) falls. Axial resolution is SPL/2 and improves. The cost is sensitivity: a shorter pulse carries less energy, so weak deep echoes are harder to detect.',
    distractor:
      'Options 3 and 4 substitute LATERAL for AXIAL. Pulse length is an axial quantity; beam width is the lateral one.',
    factId: 'us-damping',
    experiment: '/ultrasound-lab/transducer',
    source: 'Standard physics · QBank Q411',
  },
  {
    id: 'i-element-thickness',
    kind: 'equation',
    category: 'transducers',
    question: 'What determines the resonant frequency of a thickness-mode piezoelectric element?',
    options: [
      'Its thickness — the element resonates when it is half a wavelength thick in the crystal',
      'Its diameter — a wider element resonates at a higher frequency',
      'Its thickness — the element resonates when it is one full wavelength thick',
      'The excitation voltage applied to it',
    ],
    correct: 0,
    reason: 'f = c_crystal / 2t. A thicker element resonates lower and emits a longer wavelength.',
    explanation:
      'With a crystal speed near 4000 m/s, a 0.4 mm element resonates at about 5 MHz. The diameter sets the aperture — and therefore beam shape and lateral resolution — not the frequency. Voltage sets amplitude, not frequency.',
    distractor:
      'Option 3 is the deliberate half-versus-full wavelength swap. Option 2 is the diameter trap, marked FALSE in QBank Q411.',
    equation: 't = λ_crystal / 2        f = c_crystal / (2t)',
    factId: 'us-resonance-thickness',
    experiment: '/ultrasound-lab/transducer',
    source: 'QBank Q411, Q422',
  },
  {
    id: 'i-depth-prf',
    kind: 'direction',
    category: 'imaging',
    question: 'You increase the imaging depth from 6 cm to 18 cm. What happens?',
    options: [
      'Maximum PRF falls, so frame rate and the Nyquist limit both fall',
      'Maximum PRF rises because more echoes are collected',
      'Frame rate is unchanged — depth only affects the display',
      'The Nyquist limit rises because the sample volume is deeper',
    ],
    correct: 0,
    reason: 'PRF_max = c / (2 × depth), and everything downstream follows.',
    explanation:
      'At 1540 m/s a round trip to 18 cm takes about 234 µs, so pulses cannot be sent faster than roughly 4.3 kHz. Fewer pulses per second means fewer frames per second, and since Nyquist is PRF/2 the maximum measurable velocity falls too. This one chain links image formation, temporal resolution and Doppler.',
    distractor:
      'It feels as though a deeper image must be "collecting more", so PRF should rise. The constraint is the opposite: you have to wait longer before you are allowed to pulse again.',
    equation: 'PRF_max = c / (2 × depth)',
    factId: 'us-prf-depth',
    experiment: '/ultrasound-lab/pulse-echo',
    source: 'QBank Q210, Q351',
  },
  {
    id: 'i-power-doppler',
    kind: 'doppler',
    category: 'doppler',
    question: 'Which is the correct description of power Doppler?',
    options: [
      'More sensitive to slow flow, no reliable direction, no velocity, prone to flash artefact',
      'More sensitive to slow flow, and displays both direction and velocity',
      'Less sensitive than colour Doppler but immune to motion artefact',
      'Identical to colour Doppler but with a different colour map',
    ],
    correct: 0,
    reason: 'It displays integrated Doppler power, which discards the sign and the mean frequency.',
    explanation:
      'Because it uses the total power in the Doppler signal rather than the mean shift, power Doppler is more sensitive, largely angle-independent and does not alias — but it cannot report which way blood is moving or how fast. Its sensitivity to any motion is also what makes flash artefact so prominent.',
    distractor:
      '"Amplitude AND direction can be assessed using power Doppler" is a false stem in the QBank. Amplitude yes; direction no.',
    factId: 'us-power-doppler',
    experiment: '/ultrasound-lab/doppler',
    source: 'QBank Q422',
  },
  {
    id: 'i-focusing-delay',
    kind: 'diagram',
    category: 'transducers',
    question:
      'To focus the beam of a linear array at a chosen depth, which elements must be excited FIRST?',
    options: [
      'The outer elements, because they are further from the focal point',
      'The inner elements, because they are closest to the focal point',
      'All elements simultaneously — focusing is done by the lens alone',
      'The elements are fired in sequence from left to right',
    ],
    correct: 0,
    reason: 'The longest path needs the earliest start so every wavefront arrives together.',
    explanation:
      'The focal point is further from the outer elements than from the central ones. Giving the outer elements a head start means all the wavefronts converge at the same instant. Reversing the pattern would defocus the beam; applying a linear ramp of delays across the aperture steers it instead.',
    distractor:
      'This is a documented error in the source question bank, which states that the inner elements are triggered first. Reason it out from the path lengths rather than recalling the stem.',
    factId: 'us-electronic-focus',
    experiment: '/ultrasound-lab/transducer',
    source: 'QBank Q446 — corrected; see the source clarification',
  },
  {
    id: 'i-attenuation-cause',
    kind: 'direction',
    category: 'attenuation',
    question: 'Attenuation of ultrasound in soft tissue is mainly due to:',
    options: [
      'Absorption — conversion of acoustic energy into heat',
      'Reflection and scattering at tissue boundaries',
      'The acoustic impedance of the tissue',
      'Refraction at oblique interfaces',
    ],
    correct: 0,
    reason: 'Absorption dominates; scatter and reflection contribute but are secondary.',
    explanation:
      'Most of the transmitted energy ends up as heat in the patient — which is exactly why thermal bioeffects matter. Scatter redirects energy away from the beam and reflection removes some at each boundary, but the QBank marks "mainly due to reflection and scattering" as FALSE. There is also no relationship at all between attenuation and acoustic impedance.',
    distractor:
      'Boundaries are visually obvious on the image, so it feels as though that must be where the energy goes. Most of it is absorbed quietly along the way.',
    equation: 'dB = α × f × x',
    factId: 'us-attenuation-absorption',
    experiment: '/ultrasound-lab/attenuation',
    source: 'QBank Q410, Q320',
  },
]

/* ------------------------------------------------------------------ *
 * Trap mode — the wording swaps examiners use
 * ------------------------------------------------------------------ */

export type TrapPair = {
  id: string
  title: string
  /** The confusable pair. */
  left: { term: string; truth: string }
  right: { term: string; truth: string }
  /** The swapped statement a candidate must reject. */
  swapped: string
  /** Why the swap is wrong. */
  correction: string
  experiment: string
  source: string
}

export const TRAP_PAIRS: TrapPair[] = [
  {
    id: 't-frequency-speed',
    title: 'Frequency vs propagation speed',
    left: { term: 'Frequency', truth: 'Set by the transducer. Changing it changes the wavelength.' },
    right: { term: 'Propagation speed', truth: 'Set by the medium — its stiffness and density. The probe cannot change it.' },
    swapped: '“The velocity of ultrasound is dependent on frequency.”',
    correction:
      'FALSE, and it is the most repeated ultrasound trap in the recall bank. c = fλ, so raising f at fixed c simply shortens λ.',
    experiment: '/ultrasound-lab',
    source: 'QBank Q33, Q413',
  },
  {
    id: 't-density-impedance',
    title: 'Density alone vs acoustic impedance',
    left: { term: 'Density', truth: 'One of the two factors in Z.' },
    right: { term: 'Acoustic impedance', truth: 'Z = ρc — needs BOTH density and speed.' },
    swapped: '“Reflection occurs when there is a difference in tissue densities.”',
    correction:
      'FALSE. Reflection is governed by the difference in acoustic IMPEDANCE. A pair of tissues can differ in density and still have similar impedance.',
    experiment: '/ultrasound-lab/impedance',
    source: 'QBank Q239, Q31',
  },
  {
    id: 't-angle-cosine',
    title: 'Angle vs cosine of angle',
    left: { term: 'Angle θ', truth: 'The geometric angle between beam and flow.' },
    right: { term: 'cos θ', truth: 'What the Doppler shift is actually proportional to.' },
    swapped: '“Doppler shift is directly proportional to the angle of insonation.”',
    correction:
      'FALSE. Δf ∝ cos θ. The shift is maximal at 0°, halved at 60° and exactly zero at 90° — a proportionality to the angle itself would predict the opposite.',
    experiment: '/ultrasound-lab/doppler',
    source: 'QBank Q66, Q34, Q353',
  },
  {
    id: 't-prf-nyquist',
    title: 'PRF vs Nyquist limit',
    left: { term: 'PRF', truth: 'Pulses transmitted per second. Capped by imaging depth.' },
    right: { term: 'Nyquist limit', truth: 'PRF ÷ 2 — the largest shift displayable without wrapping.' },
    swapped: '“The maximum detectable Doppler shift equals the PRF.”',
    correction: 'FALSE. It is HALF the PRF. Sampling theory requires at least two samples per cycle.',
    experiment: '/ultrasound-lab/aliasing',
    source: 'QBank Q322, Q422, Q119',
  },
  {
    id: 't-mi-ti',
    title: 'MI vs TI',
    left: { term: 'Mechanical index', truth: 'Cavitation and non-thermal risk. MI = p₋/√f. FALLS as frequency rises.' },
    right: { term: 'Thermal index', truth: 'Heating potential. Rises with power, dwell time, bone and frequency.' },
    swapped: '“MI can be calculated indirectly from tissue heating.”',
    correction:
      'FALSE — that describes TI. They also move in OPPOSITE directions with frequency, which is why examiners pair them.',
    experiment: '/ultrasound-lab/safety',
    source: 'QBank Q21, Q287',
  },
  {
    id: 't-gain-power',
    title: 'Receiver gain vs output power',
    left: { term: 'Receiver gain', truth: 'Amplifies returning echoes — and the noise with them. No change in exposure.' },
    right: { term: 'Output power', truth: 'Changes the transmitted pulse. Raises MI, TI and patient exposure.' },
    swapped: '“Turning up the gain increases the acoustic output to the patient.”',
    correction:
      'FALSE. Gain and TGC act entirely on the receive side. Only output power changes what enters the patient.',
    experiment: '/ultrasound-lab/controls',
    source: 'Standard physics · Fact Bank',
  },
  {
    id: 't-axial-lateral',
    title: 'Axial vs lateral resolution',
    left: { term: 'Axial', truth: 'SPL/2. Set by frequency, cycles and damping. Independent of depth.' },
    right: { term: 'Lateral', truth: 'Beam width. Set by aperture, frequency and focus. Best at the focus.' },
    swapped: '“Axial resolution depends on the diameter of the transducer crystal and on focusing.”',
    correction:
      'FALSE on both counts — those are LATERAL. QBank Q321 lists diameter, PRF, focusing and depth as four separate false stems for axial resolution.',
    experiment: '/ultrasound-lab/resolution',
    source: 'QBank Q321, Q352',
  },
  {
    id: 't-reflection-refraction',
    title: 'Reflection vs refraction',
    left: { term: 'Reflection', truth: 'Governed by the impedance mismatch. Happens at any angle, including perpendicular.' },
    right: { term: 'Refraction', truth: 'Governed by the speed difference. Requires OBLIQUE incidence.' },
    swapped: '“Refraction occurs whenever there is an acoustic impedance mismatch.”',
    correction:
      'FALSE. Refraction needs a SPEED difference and an OBLIQUE angle. At normal incidence there is no refraction however large the mismatch.',
    experiment: '/ultrasound-lab/refraction',
    source: 'QBank Q320, Q379',
  },
  {
    id: 't-fundamental-harmonic',
    title: 'Fundamental vs harmonic imaging',
    left: { term: 'Fundamental', truth: 'Transmit and receive at the same frequency.' },
    right: { term: 'Harmonic', truth: 'Transmit at f, receive at 2f. The harmonic is generated IN TISSUE.' },
    swapped: '“Harmonic imaging improves lateral resolution.”',
    correction:
      'FALSE. It improves CONTRAST resolution and cuts near-field and side-lobe clutter. A second trap in the same area: the probe does not transmit the harmonic — nonlinear propagation creates it.',
    experiment: '/ultrasound-lab/harmonics',
    source: 'QBank Q422, Q412',
  },
  {
    id: 't-cw-pw',
    title: 'CW vs PW Doppler',
    left: { term: 'Continuous wave', truth: 'No aliasing, very high velocities, NO range resolution.' },
    right: { term: 'Pulsed wave', truth: 'Range resolution from a selected sample volume, but it aliases.' },
    swapped: '“Continuous wave Doppler allows you to select the depth of measurement.”',
    correction:
      'FALSE — that is the defining feature of PULSED wave. CW records everything along the beam and cannot say where it came from.',
    experiment: '/ultrasound-lab/doppler',
    source: 'QBank Q322, Q412',
  },
  {
    id: 't-heating-cavitation',
    title: 'Tissue heating vs cavitation',
    left: { term: 'Heating (thermal)', truth: 'From absorption. Worst at bone. Reduced by perfusion. Indexed by TI.' },
    right: { term: 'Cavitation (mechanical)', truth: 'Bubble activity driven by rarefactional pressure. Indexed by MI.' },
    swapped: '“Ultrasound heating is caused by friction between tissue particles.”',
    correction:
      'FALSE. Heating comes from ABSORPTION of acoustic energy. The recall bank rejects friction explicitly, and also rejects the idea that a warm probe face is simply a matter of voltage.',
    experiment: '/ultrasound-lab/safety',
    source: 'QBank Q287',
  },
  {
    id: 't-frequency-footprint',
    title: 'Probe frequency vs probe footprint',
    left: { term: 'Frequency', truth: 'Decides resolution and penetration.' },
    right: { term: 'Footprint', truth: 'Decides acoustic access — whether you can reach the target at all.' },
    swapped: '“The highest-frequency probe is always the best choice for image quality.”',
    correction:
      'FALSE, and it misses the point twice. The right rule is: the highest frequency that still PENETRATES to the target — and only from a probe whose footprint fits the window. A linear array beats a phased array on resolution and is useless between ribs.',
    experiment: '/ultrasound-lab/probes',
    source: 'QBank Q412, Q446 · Standard physics',
  },
]

/* ------------------------------------------------------------------ */

export const QUESTION_COUNTS = {
  tf: TF_QUESTIONS.length,
  tfStems: TF_QUESTIONS.reduce((n, q) => n + q.stems.length, 0),
  recall: TF_QUESTIONS.filter((q) => q.recall).length,
  interactive: INTERACTIVE_QUESTIONS.length,
  traps: TRAP_PAIRS.length,
  corrections: Object.keys(CORRECTIONS).length,
}
