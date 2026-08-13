/**
 * The question bank data model.
 *
 * A question is a statement heading followed by two to seven true/false stems —
 * the FRCR Part 1 format. The candidate marks every stem, submits, and receives
 * a score, a stem-by-stem verdict with a tight explanation, one take-home key
 * point, and a link into the relevant laboratory.
 */

export type QbStem = {
  label: string
  text: string
  /** True/false per the source; null when the source genuinely gives no answer. */
  answer: boolean | null
  explanation: string
}

export type QbTopic =
  | 'Radiography & X-ray Physics'
  | 'Mammography'
  | 'Digital Imaging'
  | 'Fluoroscopy'
  | 'CT'
  | 'MRI'
  | 'Nuclear Medicine'
  | 'Ultrasound'
  | 'Legislation & Radiation Protection'
  | 'Radiation Biology & Dosimetry'

export type QbQuestion = {
  id: string
  title: string
  topic: QbTopic
  /**
   * Which FRCR sitting this recall came from — '2024', '2012', or 'Collection'
   * for the curated sets that are not tied to one paper.
   *
   * Recovered from the archive: it was dropped in a migration and cannot be
   * regenerated from anything, because nothing else in the data records which
   * paper a candidate was remembering.
   */
  year?: string
  /** Whether all five statements were recovered. 201 of 453 are complete. */
  completeFive?: boolean
  /**
   * Concept tags binding this question to the teaching visual that explains it
   * — 263 questions across 42 tags. Recovered with `year`; not yet resolved to
   * routes, so nothing reads this today. It is here so the mapping survives.
   */
  visualTags?: string[]
  /** Provenance group; presented only as a neutral collection name. */
  source: string
  stems: QbStem[]
  keyPoint: string
}

/** A subject as the candidate sees it in the bank's navigation. */
export type QbSubject = {
  id: string
  name: string
  /** Modality accent from the home design system. */
  accent: 'xray' | 'us' | 'mri' | 'amber'
  blurb: string
  /** Sections within the subject, each mapping to one or more topics. */
  sections: { id: string; name: string; topics: QbTopic[] }[]
}

export const QB_SUBJECTS: QbSubject[] = [
  {
    id: 'xray',
    name: 'X-ray Physics',
    accent: 'xray',
    blurb: 'Production, interactions and every projection technique built on them.',
    sections: [
      { id: 'production', name: 'Production & interactions', topics: ['Radiography & X-ray Physics'] },
      { id: 'digital', name: 'Computed & digital radiography', topics: ['Digital Imaging'] },
      { id: 'fluoroscopy', name: 'Fluoroscopy', topics: ['Fluoroscopy'] },
      { id: 'mammography', name: 'Mammography', topics: ['Mammography'] },
    ],
  },
  {
    id: 'ct',
    name: 'Computed Tomography',
    accent: 'xray',
    blurb: 'Acquisition, reconstruction, image quality and dose.',
    sections: [{ id: 'ct', name: 'Computed tomography', topics: ['CT'] }],
  },
  {
    id: 'mri',
    name: 'MRI',
    accent: 'mri',
    blurb: 'Signal, sequences, artefacts, instrumentation and safety.',
    sections: [{ id: 'mri', name: 'Magnetic resonance imaging', topics: ['MRI'] }],
  },
  {
    id: 'ultrasound',
    name: 'Ultrasound',
    accent: 'us',
    blurb: 'Waves, transducers, Doppler, artefacts and bioeffects.',
    sections: [{ id: 'us', name: 'Ultrasound', topics: ['Ultrasound'] }],
  },
  {
    id: 'nm',
    name: 'Nuclear Medicine',
    accent: 'amber',
    blurb: 'Radionuclides, the gamma camera, SPECT and PET.',
    sections: [{ id: 'nm', name: 'Nuclear medicine', topics: ['Nuclear Medicine'] }],
  },
  {
    id: 'safety',
    name: 'Safety & Radiation',
    accent: 'amber',
    blurb: 'Legislation, protection, radiobiology and dosimetry.',
    sections: [
      { id: 'legislation', name: 'Legislation & protection', topics: ['Legislation & Radiation Protection'] },
      { id: 'radiobiology', name: 'Radiation biology & dosimetry', topics: ['Radiation Biology & Dosimetry'] },
    ],
  },
]

/* ------------------------------------------------------------------ *
 * Laboratory links
 * ------------------------------------------------------------------ */

type LabLink = { href: string; label: string }

const US_KEYWORDS: [RegExp, string, string][] = [
  [/doppler|aliasing|nyquist|prf\b/i, '/ultrasound-lab/doppler', 'Doppler Laboratory'],
  [/impedance|reflect/i, '/ultrasound-lab/impedance', 'Acoustic Impedance lab'],
  [/attenuat|tgc/i, '/ultrasound-lab/attenuation', 'Attenuation lab'],
  [/transducer|piezo|crystal|array|matching/i, '/ultrasound-lab/transducer', 'Transducer Laboratory'],
  [/resolution/i, '/ultrasound-lab/resolution', 'Resolution lab'],
  [/artefact|artifact|shadow|reverberation|mirror|comet/i, '/ultrasound-lab/artefacts', 'Artefact Workshop'],
  [/harmonic/i, '/ultrasound-lab/harmonics', 'Harmonic Imaging lab'],
  [/contrast|microbubble/i, '/ultrasound-lab/contrast', 'Contrast Agents lab'],
  [/safety|mechanical index|thermal|cavitation|heating|bioeffect|output/i, '/ultrasound-lab/safety', 'Bioeffects & Safety lab'],
  [/probe|linear array|curvilinear|phased/i, '/ultrasound-lab/probes', 'Probe Selection lab'],
  [/beam|focal|near field|far field/i, '/ultrasound-lab/beam', 'Beam Geometry lab'],
  [/b-mode|b mode|pulse|echo|frame rate|depth/i, '/ultrasound-lab/pulse-echo', 'Pulse–Echo lab'],
]

const MRI_KEYWORDS: [RegExp, string, string][] = [
  [/flair/i, '/mri-lab/flair', 'FLAIR stage'],
  [/stir/i, '/mri-lab/stir', 'STIR stage'],
  [/gradient echo|gre|t2\*/i, '/mri-lab/gradient-echo', 'Gradient Echo stage'],
  [/t1/i, '/mri-lab/t1-spin-echo', 'T1 spin echo stage'],
  [/t2/i, '/mri-lab/t2-spin-echo', 'T2 spin echo stage'],
  [/proton density|\bpd\b/i, '/mri-lab/proton-density', 'Proton density stage'],
]

/**
 * Where each TOPIC sends a candidate when the wording identifies nothing more
 * specific — an explicit registry rather than a guess.
 *
 * This used to be three `if`s and a fallback, and the fallback did most of the
 * work: only ultrasound, MRI and CT were mapped at all, so questions on
 * mammography, digital imaging, fluoroscopy, nuclear medicine, legislation and
 * radiation biology — 189 of the 453 in the bank — were all offered "Fact
 * Bank", while /xray-lab/mammography, /xray-lab/digital, /xray-lab/fluoroscopy
 * and /nm-lab sat built and unmentioned. CT, meanwhile, pointed at an anchor on
 * the lab index instead of the CT lab itself.
 *
 * Keyed by the topic string as it appears IN THE DATA, not by QbTopic: the
 * bank carries two topics the union does not declare ("Other" and "Basic
 * Physics"), and a registry that silently dropped them would reintroduce the
 * same fallback-for-everything problem. labLinkFor.test.ts asserts that every
 * topic present in the bank has an entry here and that every href resolves to
 * a route App.tsx actually declares — so this cannot rot the way a regex can.
 *
 * The principle is borrowed from the physics lineages in the archive, each of
 * which bound questions to teaching visuals through a registry guarded by an
 * integrity test rather than by pattern-matching the question text.
 */
export const TOPIC_LABS: Record<string, LabLink> = {
  'Radiography & X-ray Physics': { href: '/xray-lab', label: 'X-ray Laboratory' },
  Mammography: { href: '/xray-lab/mammography', label: 'Mammography lab' },
  'Digital Imaging': { href: '/xray-lab/digital', label: 'Digital Radiography lab' },
  Fluoroscopy: { href: '/xray-lab/fluoroscopy', label: 'Fluoroscopy lab' },
  CT: { href: '/ct-lab', label: 'CT Laboratory' },
  MRI: { href: '/mri-lab', label: 'MRI Laboratory' },
  'Nuclear Medicine': { href: '/nm-lab', label: 'Nuclear Medicine lab' },
  Ultrasound: { href: '/ultrasound-lab', label: 'Ultrasound Physics Lab' },
  /* No lab teaches the regulations or the risk coefficients — they are learnt
     from the facts — so these two go to the protection topic rather than to
     the fact bank's front page, which would leave the candidate to find it. */
  'Legislation & Radiation Protection': { href: '/fact-bank/protection', label: 'Radiation Protection facts' },
  'Radiation Biology & Dosimetry': { href: '/fact-bank/protection', label: 'Radiation Protection facts' },
  'Basic Physics': { href: '/fact-bank', label: 'Fact Bank' },
  Other: { href: '/fact-bank', label: 'Fact Bank' },
}

/** Used only if a topic reaches the UI before it reaches the registry. */
export const LAB_FALLBACK: LabLink = { href: '/fact-bank', label: 'Fact Bank' }

/**
 * The laboratory a question links out to. Ultrasound and MRI questions link to
 * the specific experiment when the wording identifies one; everything else
 * lands on the lab its topic belongs to.
 */
export function labLinkFor(question: Pick<QbQuestion, 'topic' | 'title' | 'stems'>): LabLink {
  const haystack = `${question.title} ${question.stems.map((s) => s.text).join(' ')}`
  if (question.topic === 'Ultrasound') {
    for (const [pattern, href, label] of US_KEYWORDS) {
      if (pattern.test(haystack)) return { href, label }
    }
  }
  if (question.topic === 'MRI') {
    for (const [pattern, href, label] of MRI_KEYWORDS) {
      if (pattern.test(haystack)) return { href, label }
    }
  }
  return TOPIC_LABS[question.topic] ?? LAB_FALLBACK
}
