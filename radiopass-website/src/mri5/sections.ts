/**
 * The MRI module — chapter 5 of the FRCR Part 1 physics syllabus.
 *
 * Twenty-one sections in one causal chain, declared here once. Everything else
 * derives from this list: the navigator, the "section N of 21" counter, the
 * previous/next pager and the knowledge map. Nothing hand-wires a link to a
 * sibling section.
 *
 * The order is the physics, not a filing system. A signal has to exist before
 * it can be located; it has to be locatable before a sequence can weight it;
 * and the artefacts at the end are consequences of the encoding taught in the
 * middle. Each section states what it inherits from the one before it.
 */

export type GroupId =
  | 'machine'
  | 'basics'
  | 'relaxation'
  | 'sequences'
  | 'encoding'
  | 'kspace'
  | 'advanced'
  | 'quality'
  | 'artefacts'
  | 'safety'

/**
 * `short` is what the sticky navigator shows. Ten full group names do not fit
 * across a 1240px bar, and a bar that truncates a label mid-word reads as
 * broken rather than as scrollable — so the navigator abbreviates and the
 * contents panel carries the full names.
 */
export const GROUPS: { id: GroupId; label: string; short: string }[] = [
  { id: 'machine', label: 'MR machine', short: 'Machine' },
  { id: 'basics', label: 'Basic physics', short: 'Basics' },
  { id: 'relaxation', label: 'Relaxation', short: 'Relaxation' },
  { id: 'sequences', label: 'Sequences', short: 'Sequences' },
  { id: 'encoding', label: 'Spatial encoding', short: 'Encoding' },
  { id: 'kspace', label: 'K-space', short: 'K-space' },
  { id: 'advanced', label: 'Advanced sequences', short: 'Advanced' },
  { id: 'quality', label: 'Image quality', short: 'Quality' },
  { id: 'artefacts', label: 'Artefacts', short: 'Artefacts' },
  { id: 'safety', label: 'Safety', short: 'Safety' },
]

export type SectionMeta = {
  /** Syllabus number, e.g. "5.7". */
  number: string
  slug: string
  title: string
  group: GroupId
  /** One line on the section card and in the navigator tooltip. */
  summary: string
  /** What this section takes as read from the one before it. */
  inherits?: string
}

export const SECTIONS: SectionMeta[] = [
  {
    number: '5.1',
    slug: 'mr-machine',
    title: 'The MR machine',
    group: 'machine',
    summary: 'The bore from the outside in — main magnet, shims, gradients, RF coil, patient — and the axis convention every later section uses.',
  },
  {
    number: '5.2',
    slug: 'introduction',
    title: 'Introduction to MRI',
    group: 'basics',
    summary: 'Why hydrogen, what B₀ does to it, precession and the Larmor equation, resonance, flip angle, and how a rotating vector becomes a voltage.',
    inherits: 'B₀ lies along z, and the RF coil transmits B₁ perpendicular to it.',
  },
  {
    number: '5.3',
    slug: 't1-t2-signal',
    title: 'T1 and T2 signal',
    group: 'relaxation',
    summary: 'Two independent processes running at once: longitudinal recovery, transverse decay, why T2* is faster than T2, and the free induction decay.',
    inherits: 'A 90° pulse has just put every tissue at M_z = 0 with maximum transverse magnetisation.',
  },
  {
    number: '5.4',
    slug: 'spin-echo',
    title: 'The spin echo sequence',
    group: 'sequences',
    summary: 'Leaders and laggers, the 180° refocusing pulse, why the echo recovers T2* losses but not T2, and what TE and TR actually control.',
    inherits: 'Transverse magnetisation decays at T2*, faster than true T2, because the field is not perfectly uniform.',
  },
  {
    number: '5.5',
    slug: 'weighting',
    title: 'T1, T2 and PD weighting',
    group: 'sequences',
    summary: 'Two sliders decide the whole image. Where TR sits on the recovery curves and where TE sits on the decay curves is the entire mechanism.',
    inherits: 'TE is set by the 180° pulse timing; TR is the gap between successive excitations.',
  },
  {
    number: '5.6',
    slug: 'spatial-encoding',
    title: 'Spatial encoding',
    group: 'encoding',
    summary: 'One coil returns one number. The problem statement, and the three-gradient answer: slice by z, frequency by x, phase by y.',
    inherits: 'Every excited voxel contributes to a single summed signal in the receive coil.',
  },
  {
    number: '5.7',
    slug: 'slice-selection',
    title: 'Slice selection',
    group: 'encoding',
    summary: 'A gradient makes Larmor frequency a function of position, so a frequency-selective RF pulse excites one band — and only that band.',
    inherits: 'Larmor frequency is proportional to the field a nucleus sits in.',
  },
  {
    number: '5.8',
    slug: 'frequency-encoding',
    title: 'Frequency encoding',
    group: 'encoding',
    summary: 'A readout gradient makes each column sing at its own frequency; the Fourier transform separates them and maps frequency back to position.',
    inherits: 'One slice is excited; everything else in the body is silent.',
  },
  {
    number: '5.9',
    slug: 'phase-encoding',
    title: 'Phase encoding',
    group: 'encoding',
    summary: 'A gradient switched on and off again leaves no frequency difference behind — but the phase it created stays. That memory is the second axis.',
    inherits: 'Frequency encoding has already resolved position along x.',
  },
  {
    number: '5.10',
    slug: 'k-space',
    title: 'K-space',
    group: 'kspace',
    summary: 'Where the measurements are stored before they are an image: centre carries contrast, periphery carries detail, and every point contributes to every pixel.',
    inherits: 'One phase-encoding step yields one line of data.',
  },
  {
    number: '5.11',
    slug: 'sequences',
    title: 'Sequences overview',
    group: 'advanced',
    summary: 'The family map — spin echo, gradient echo, inversion recovery, diffusion — and what each one changes about the same underlying experiment.',
    inherits: 'Filling k-space once produces one image.',
  },
  {
    number: '5.12',
    slug: 'spin-echo-detail',
    title: 'Spin echo in detail',
    group: 'advanced',
    summary: 'Echo trains, turbo factor and effective TE: how several k-space lines per TR buy speed, and what that speed costs.',
    inherits: 'One 180° pulse produces one echo, and one echo fills one line.',
  },
  {
    number: '5.13',
    slug: 'gradient-echo',
    title: 'Gradient (recalled) echo',
    group: 'advanced',
    summary: 'No refocusing pulse and a flip below 90°. The echo is made by reversing a gradient, so field inhomogeneity is never undone — this is T2*.',
    inherits: 'Only a 180° RF pulse can reverse dephasing caused by static field offsets.',
  },
  {
    number: '5.14',
    slug: 'inversion-recovery',
    title: 'Inversion recovery',
    group: 'advanced',
    summary: 'Invert everything, then excite at the moment the tissue you want gone is passing through zero. STIR and FLAIR are one idea at two inversion times.',
    inherits: 'Longitudinal recovery is exponential with time constant T1.',
  },
  {
    number: '5.15',
    slug: 'diffusion',
    title: 'Diffusion-weighted imaging',
    group: 'advanced',
    summary: 'Paired gradients that cancel for a stationary spin and do not cancel for a wandering one, so signal loss becomes a map of water mobility.',
    inherits: 'A gradient makes accumulated phase depend on position.',
  },
  {
    number: '5.16',
    slug: 'spectroscopy',
    title: 'MR spectroscopy',
    group: 'advanced',
    summary: 'Chemical shift stops being an artefact and becomes the measurement: the same nucleus resonating at slightly different frequencies by molecule.',
    inherits: 'Precession frequency depends on the local field a nucleus actually experiences.',
  },
  {
    number: '5.17',
    slug: 'angiography',
    title: 'MR angiography',
    group: 'advanced',
    summary: 'Time of flight, phase contrast and contrast-enhanced MRA — flow made visible by saturation, by phase, or by shortening blood T1.',
    inherits: 'Repeated excitation saturates whatever stays in the slice.',
  },
  {
    number: '5.18',
    slug: 'contrast-agents',
    title: 'MR contrast agents',
    group: 'advanced',
    summary: 'Gadolinium is never imaged. It shortens the T1 of the water around it, and a T1-weighted sequence reports the change.',
    inherits: 'Short T1 is bright on a T1-weighted image.',
  },
  {
    number: '5.19',
    slug: 'image-quality',
    title: 'MR image quality',
    group: 'quality',
    summary: 'Signal-to-noise, resolution and scan time are one triangle. Every control moves all three, and the trade is live here.',
    inherits: 'Each phase-encoding step is one more line of k-space and one more TR.',
  },
  {
    number: '5.20',
    slug: 'artefacts',
    title: 'MR artefacts',
    group: 'artefacts',
    summary: 'Each artefact is the encoding failing in a specific, predictable way — so each one is diagnosable from the mechanism rather than memorised.',
    inherits: 'Position is encoded by frequency along x and by phase along y.',
  },
  {
    number: '5.21',
    slug: 'safety',
    title: 'MR safety',
    group: 'safety',
    summary: 'Four hazards from four separate parts of the machine: the static field, the gradients, the RF, and the cryogens.',
    inherits: 'The main magnet is a superconductor, and it is never switched off.',
  },
]

export const SECTION_BY_SLUG = new Map(SECTIONS.map((s) => [s.slug, s]))

export function sectionIndex(slug: string): number {
  return SECTIONS.findIndex((s) => s.slug === slug)
}

export function neighbours(slug: string): { prev?: SectionMeta; next?: SectionMeta } {
  const i = sectionIndex(slug)
  if (i < 0) return {}
  return { prev: SECTIONS[i - 1], next: SECTIONS[i + 1] }
}

export function groupOf(slug: string): GroupId | undefined {
  return SECTION_BY_SLUG.get(slug)?.group
}

export const MRI_BASE = '/mri'
export const sectionPath = (slug: string) => `${MRI_BASE}/${slug}`
