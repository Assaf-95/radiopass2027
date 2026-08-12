/**
 * Tissue relaxation parameters for the RadioPass MRI teaching engine.
 *
 * Values are approximate, rounded, internally consistent teaching figures for
 * 1.5 T. Published relaxation times vary between sources, between subjects and
 * with field strength, so these are chosen to make the *relative* behaviour
 * that the FRCR Part 1 syllabus tests unambiguous rather than to reproduce any
 * single measurement. This is an educational model, not a scanner simulation.
 */

export type TissueId =
  | 'fat'
  | 'marrow'
  | 'whiteMatter'
  | 'greyMatter'
  | 'muscle'
  | 'csf'
  | 'oedema'
  | 'lesion'

export type Tissue = {
  id: TissueId
  name: string
  /** Name as it should read mid-sentence: acronyms keep their capitals. */
  lower: string
  abbr: string
  /** Longitudinal relaxation time in ms at the reference field of 1.5 T. */
  t1: number
  /** Transverse relaxation time in ms. Treated as field independent here. */
  t2: number
  /** Relative mobile proton density, normalised so free water is 1.0. */
  pd: number
  /** Accent colour used consistently across every visualisation. */
  colour: string
  /** One-line reminder of why this tissue behaves the way it does. */
  note: string
}

export const REFERENCE_FIELD_T = 1.5

export const TISSUES: Tissue[] = [
  {
    id: 'fat',
    name: 'Fat',
    lower: 'fat',
    abbr: 'FAT',
    t1: 260,
    t2: 80,
    pd: 1.0,
    colour: '#ffcf5a',
    note: 'Short T1 — efficient energy transfer to the lattice from short, tumbling lipid chains.',
  },
  {
    id: 'marrow',
    name: 'Marrow fat',
    lower: 'marrow fat',
    abbr: 'MAR',
    t1: 300,
    t2: 70,
    pd: 0.95,
    colour: '#ffa94d',
    note: 'Behaviour dominated by its fat content, so it tracks fat closely on every sequence.',
  },
  {
    id: 'whiteMatter',
    name: 'White matter',
    lower: 'white matter',
    abbr: 'WM',
    t1: 600,
    t2: 80,
    pd: 0.7,
    colour: '#b9c6ff',
    note: 'Myelin lipid shortens T1, so white matter recovers faster than grey matter.',
  },
  {
    id: 'greyMatter',
    name: 'Grey matter',
    lower: 'grey matter',
    abbr: 'GM',
    t1: 900,
    t2: 100,
    pd: 0.8,
    colour: '#8fa1d9',
    note: 'Longer T1 and higher proton density than white matter.',
  },
  {
    id: 'muscle',
    name: 'Muscle',
    lower: 'muscle',
    abbr: 'MUS',
    t1: 870,
    t2: 45,
    pd: 0.7,
    colour: '#e08a8a',
    note: 'Short T2 and relatively low mobile proton density, so it darkens quickly as TE lengthens.',
  },
  {
    id: 'csf',
    name: 'CSF',
    lower: 'CSF',
    abbr: 'CSF',
    t1: 4000,
    t2: 2000,
    pd: 1.0,
    colour: '#5ad6ff',
    note: 'Free water: very long T1 and very long T2 — slow to recover, slow to decay.',
  },
  {
    id: 'oedema',
    name: 'Oedema',
    lower: 'oedema',
    abbr: 'OED',
    t1: 1200,
    t2: 150,
    pd: 0.9,
    colour: '#7ef2c8',
    note: 'Increased but bound tissue water: long T2, yet a much shorter T1 than free CSF.',
  },
  {
    id: 'lesion',
    name: 'Generic lesion',
    lower: 'generic lesion',
    abbr: 'LES',
    t1: 1000,
    t2: 120,
    pd: 0.85,
    colour: '#c99bff',
    note: 'A configurable lesion — change T1, T2 and proton density to test your predictions.',
  },
]

export const TISSUE_BY_ID: Record<TissueId, Tissue> = Object.fromEntries(
  TISSUES.map((tissue) => [tissue.id, tissue]),
) as Record<TissueId, Tissue>

export const DEFAULT_TISSUE_IDS: TissueId[] = [
  'fat',
  'whiteMatter',
  'greyMatter',
  'muscle',
  'csf',
  'oedema',
]

/**
 * Approximate field-strength scaling.
 *
 * T1 lengthens as B0 rises; the exponent used here (0.33) sits inside the
 * commonly quoted range for brain tissue and reproduces the familiar result
 * that T1 values at 3 T are roughly 20–30% longer than at 1.5 T. T2 is treated
 * as field independent, which is a simplification: in reality T2 shortens
 * modestly at higher field. Always label these values as approximate.
 */
export function scaleTissueToField(tissue: Tissue, fieldT: number): Tissue {
  if (fieldT === REFERENCE_FIELD_T) return tissue
  const ratio = Math.pow(fieldT / REFERENCE_FIELD_T, 0.33)
  return { ...tissue, t1: Math.round(tissue.t1 * ratio) }
}

/** Gyromagnetic ratio of the hydrogen proton, MHz per tesla. */
export const GAMMA_BAR_MHZ_PER_T = 42.58

/** Larmor frequency in MHz for a given field strength: f0 = (γ/2π) · B0. */
export function larmorFrequencyMHz(fieldT: number): number {
  return GAMMA_BAR_MHZ_PER_T * fieldT
}

export type TissueOverride = Partial<Pick<Tissue, 't1' | 't2' | 'pd'>>
export type TissueOverrides = Partial<Record<TissueId, TissueOverride>>

/** Applies learner edits and field scaling in the correct order. */
export function resolveTissue(
  id: TissueId,
  fieldT: number,
  overrides?: TissueOverrides,
): Tissue {
  const base = TISSUE_BY_ID[id]
  const scaled = scaleTissueToField(base, fieldT)
  const override = overrides?.[id]
  if (!override) return scaled
  return {
    ...scaled,
    t1: override.t1 ?? scaled.t1,
    t2: override.t2 ?? scaled.t2,
    pd: override.pd ?? scaled.pd,
  }
}

export function resolveTissues(
  ids: TissueId[],
  fieldT: number,
  overrides?: TissueOverrides,
): Tissue[] {
  return ids.map((id) => resolveTissue(id, fieldT, overrides))
}
