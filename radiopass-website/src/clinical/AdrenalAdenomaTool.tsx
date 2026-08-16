import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import './adrenal.css'

type YesNoUnknown = 'yes' | 'no' | 'unknown'
type HormoneResult = 'normal' | 'abnormal' | 'unknown'
type PriorImaging = 'stable' | 'grown' | 'unknown' | 'none'
type LesionPattern =
  | 'homogeneous-benign'
  | 'homogeneous-indeterminate'
  | 'heterogeneous-suspicious'
  | 'non-adenoma-suspicious'

type Choice<T extends string> = {
  value: T
  label: string
  detail?: string
}

type RiskTone = 'safe' | 'review' | 'urgent' | 'incomplete'

type Assessment = {
  tone: RiskTone
  headline: string
  recommendation: string
  why: string[]
  report: string
  endocrine: string[]
  next: string[]
}

type RagFlag = {
  tone: 'green' | 'amber' | 'red'
  title: string
  meaning: string
  items: string[]
}

const GGC_ADRENAL_GUIDELINE_URL = 'https://handbook.ggcmedicines.org.uk/guidelines/endocrine-system/'

const adrenalRagFlags: RagFlag[] = [
  {
    tone: 'green',
    title: 'Green flags',
    meaning: 'Benign / low-risk pattern if hormonal screen is normal.',
    items: [
      'Homogeneous adrenal lesion.',
      'True unenhanced CT attenuation ≤10 HU.',
      'No suspicious growth or morphological change.',
      'Stable on previous imaging, if comparison exists.',
    ],
  },
  {
    tone: 'amber',
    title: 'Amber flags',
    meaning: 'Incomplete or indeterminate: needs characterisation, comparison, or local pathway review.',
    items: [
      'Hormonal study not done, not known, or incomplete.',
      'Homogeneous lesion with HU 11–20 and size <4 cm.',
      'No previous imaging, or previous imaging exists but stability is unclear.',
      'Size or HU missing from the report.',
    ],
  },
  {
    tone: 'red',
    title: 'Red flags',
    meaning: 'Escalate to endocrine/adrenal MDT or urgent pathway.',
    items: [
      'Abnormal hormonal assessment or suspected functioning lesion.',
      'Interval growth or change in morphology.',
      'Heterogeneous, necrotic, irregular, or malignant-suspicious appearance.',
      'HU >20, or lesion ≥4 cm without classic lipid-rich benign features.',
    ],
  },
]

const hormoneStudyChoices: Choice<YesNoUnknown>[] = [
  { value: 'yes', label: 'Yes', detail: 'Biochemical/hormonal assessment has been performed.' },
  { value: 'no', label: 'No', detail: 'No hormonal assessment is documented.' },
  { value: 'unknown', label: "I don't know", detail: 'Hormonal status is not available from the information provided.' },
]

const hormoneResultChoices: Choice<HormoneResult>[] = [
  { value: 'normal', label: 'Normal', detail: 'No biochemical evidence of a functioning adrenal lesion.' },
  { value: 'abnormal', label: 'Abnormal', detail: 'Possible functioning adrenal lesion or clinically relevant hormone excess.' },
  { value: 'unknown', label: 'Unclear', detail: 'Results are incomplete, equivocal, or not interpretable.' },
]

const priorChoices: Choice<PriorImaging>[] = [
  { value: 'stable', label: 'Yes, stable', detail: 'No meaningful change on prior imaging.' },
  { value: 'grown', label: 'Yes, increased or changed', detail: 'Increase in size or morphology has changed.' },
  { value: 'unknown', label: 'Previous exists, stability unclear', detail: 'Prior imaging is mentioned but comparison is not adequate.' },
  { value: 'none', label: 'No previous imaging', detail: 'No comparison study is available.' },
]

const patternChoices: Choice<LesionPattern>[] = [
  { value: 'homogeneous-benign', label: 'Homogeneous, benign-looking', detail: 'Smooth, uniform lesion; typical adenoma-type morphology.' },
  { value: 'homogeneous-indeterminate', label: 'Homogeneous, likely benign but indeterminate', detail: 'Uniform lesion but HU/size/context does not fully close the loop.' },
  { value: 'heterogeneous-suspicious', label: 'Heterogeneous or suspicious', detail: 'Heterogeneity, necrosis, irregularity, or concerning enhancement.' },
  { value: 'non-adenoma-suspicious', label: 'Non-adenoma / malignant-suspicious', detail: 'Appearance suggests metastasis, ACC, phaeochromocytoma, myelolipoma complication, or other non-adenoma diagnosis.' },
]

function asNumber(value: string): number | null {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : null
}


function displayNumber(value: number | null, suffix = '') {
  if (value === null) return 'Not entered'
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}${suffix}`
}

function classifyAssessment(params: {
  hormonalStudy: YesNoUnknown | null
  hormonalResult: HormoneResult | null
  prior: PriorImaging | null
  pattern: LesionPattern | null
  maxDiameter: number | null
  axialDiameter: number | null
  hu: number | null
}): Assessment {
  const { hormonalStudy, hormonalResult, prior, pattern, maxDiameter, axialDiameter, hu } = params
  const hasHormoneGap = hormonalStudy !== 'yes' || hormonalResult === 'unknown' || hormonalResult === null
  const hormoneAbnormal = hormonalStudy === 'yes' && hormonalResult === 'abnormal'
  const lowHU = hu !== null && hu <= 10
  const hu11to20 = hu !== null && hu > 10 && hu <= 20
  const huOver20 = hu !== null && hu > 20
  const sizeCm = maxDiameter ?? axialDiameter
  const large = sizeCm !== null && sizeCm >= 4
  const growing = prior === 'grown'
  const stable = prior === 'stable'
  const suspiciousPattern = pattern === 'heterogeneous-suspicious' || pattern === 'non-adenoma-suspicious'
  const homogeneous = pattern === 'homogeneous-benign' || pattern === 'homogeneous-indeterminate'

  const baseWhy: string[] = []
  if (hu !== null) baseWhy.push(`Unenhanced attenuation is ${hu} HU.`)
  if (sizeCm !== null) baseWhy.push(`Maximum recorded diameter is ${sizeCm} cm.`)
  if (stable) baseWhy.push('Prior imaging stability strongly supports benignity.')
  if (growing) baseWhy.push('Interval growth or morphological change increases concern and should not be treated as a routine adenoma.')

  if (hormoneAbnormal) {
    return {
      tone: 'urgent',
      headline: 'Endocrine-first pathway',
      recommendation:
        'Treat this as a potentially functioning adrenal lesion until endocrine review confirms otherwise.',
      why: [
        'The first fork in the pathway is hormonal activity, not HU or size.',
        'A functioning lesion changes management even when imaging looks benign.',
        ...baseWhy,
      ],
      report:
        'Adrenal lesion with abnormal hormonal assessment. Recommend endocrine referral/MDT correlation; imaging risk should be interpreted with the biochemical result.',
      endocrine: [
        'Check which pathway is abnormal: cortisol autonomy, phaeochromocytoma, aldosterone excess, androgen excess, or mixed pattern.',
        'Confirm medication effects and clinical context before labelling the lesion non-functioning.',
        'If phaeochromocytoma is possible, avoid biopsy and ensure appropriate endocrine management.',
      ],
      next: [
        'Refer to endocrinology/adrenal MDT.',
        'Complete imaging characterisation if not already done: unenhanced HU, washout/MRI chemical shift where appropriate, and comparison with prior imaging.',
        'Escalate urgently if there are malignant imaging features or rapid interval growth.',
      ],
    }
  }

  if (hasHormoneGap) {
    return {
      tone: 'incomplete',
      headline: 'Hormonal status incomplete',
      recommendation:
        'Do not close this as a benign non-functioning adenoma until hormonal assessment is documented.',
      why: [
        'Adrenal incidentaloma assessment starts by excluding clinically relevant hormone excess.',
        ...baseWhy,
      ],
      report:
        'Adrenal lesion: imaging features recorded below, but hormonal assessment is not documented. Recommend biochemical/endocrine assessment according to local adrenal incidentaloma pathway.',
      endocrine: [
        'Usual screening includes assessment for cortisol autonomy; metanephrines and aldosterone/renin are guided by imaging phenotype and clinical context.',
        'Check blood pressure, potassium, symptoms, medication history and cancer history.',
      ],
      next: [
        'Request/confirm hormonal work-up.',
        'Compare with prior imaging if available.',
        'Continue imaging classification once HU, size and morphology are known.',
      ],
    }
  }

  if (suspiciousPattern || growing || huOver20 || (large && !lowHU)) {
    return {
      tone: 'urgent',
      headline: 'Suspicious or higher-risk imaging pathway',
      recommendation:
        'This should be discussed in an adrenal MDT / endocrine-radiology pathway rather than signed off as a simple adenoma.',
      why: [
        suspiciousPattern ? 'Morphology is not typical of a lipid-rich adenoma.' : '',
        huOver20 ? 'HU is above 20, which is outside the low-risk lipid-rich adenoma pattern.' : '',
        large ? 'The lesion is 4 cm or larger, so morphology and HU matter more.' : '',
        growing ? 'Growth/change on previous imaging is a red flag.' : '',
        ...baseWhy,
      ].filter(Boolean),
      report:
        'Indeterminate/suspicious adrenal lesion. Recommend adrenal MDT discussion and further characterisation/staging as clinically appropriate.',
      endocrine: [
        'Hormonal screen is documented as normal, but endocrine/MDT review may still be needed if imaging is suspicious.',
      ],
      next: [
        'Confirm unenhanced HU was measured on a true non-contrast acquisition.',
        'Review cancer history and symptoms.',
        'Consider adrenal protocol CT, MRI chemical shift, PET/CT or surgical referral according to MDT decision.',
      ],
    }
  }

  if (homogeneous && lowHU) {
    return {
      tone: 'safe',
      headline: 'Benign lipid-rich adenoma pattern',
      recommendation:
        'If hormonal assessment is normal, this imaging pattern is benign-style and usually needs no adrenal imaging follow-up.',
      why: [
        'Homogeneous adrenal lesion with unenhanced attenuation of 10 HU or less is the classic low-risk pattern.',
        ...baseWhy,
      ],
      report:
        'Homogeneous adrenal lesion measuring ≤10 HU on unenhanced CT, in keeping with a lipid-rich adenoma. No imaging follow-up is usually required if non-functioning and clinically concordant.',
      endocrine: ['Hormonal assessment is documented as normal in this pathway.'],
      next: stable
        ? ['State stability if useful, but stability is not needed to classify a homogeneous ≤10 HU lesion as benign-style.']
        : ['Check local policy, but most pathways do not require repeat adrenal imaging for this phenotype.'],
    }
  }

  if (homogeneous && hu11to20 && !large) {
    return {
      tone: 'review',
      headline: 'Homogeneous indeterminate, likely benign',
      recommendation:
        'Likely benign if non-functioning, but usually needs immediate characterisation or interval imaging depending local pathway.',
      why: [
        'HU is 11–20 rather than ≤10, so this is not fully lipid-rich by CT density alone.',
        'Size is below 4 cm and morphology is homogeneous, which lowers concern.',
        ...baseWhy,
      ],
      report:
        'Homogeneous adrenal lesion with indeterminate attenuation (11–20 HU) and size <4 cm. If non-functioning, consider adrenal-protocol characterisation or interval imaging per local pathway.',
      endocrine: ['Hormonal assessment is documented as normal in this pathway.'],
      next: [
        'Look for macroscopic fat, intracellular lipid loss on MRI chemical shift, or benign washout if an adrenal CT protocol exists.',
        'If not characterised immediately, consider interval imaging according to local adrenal incidentaloma policy.',
      ],
    }
  }

  if (stable && homogeneous) {
    return {
      tone: 'review',
      headline: 'Likely benign because stable, but document the gap',
      recommendation:
        'Stability supports benignity, but complete the HU/size description if possible.',
      why: [
        'Normal hormonal assessment and stable imaging are reassuring.',
        'The report is stronger if it includes unenhanced HU and maximum diameter.',
        ...baseWhy,
      ],
      report:
        'Stable homogeneous adrenal lesion with normal hormonal assessment. Features favour a benign adenoma; document HU and maximum diameter where available.',
      endocrine: ['Hormonal assessment is documented as normal in this pathway.'],
      next: ['If HU is not known, check whether a true unenhanced CT is available.', 'If morphology changes later, re-enter the pathway.'],
    }
  }

  return {
    tone: 'review',
    headline: 'Indeterminate adrenal lesion',
    recommendation:
      'The current inputs do not safely prove a lipid-rich benign adenoma. Further characterisation or interval review is usually needed.',
    why: [
      'Normal hormonal assessment is reassuring, but imaging classification is incomplete or indeterminate.',
      ...baseWhy,
    ],
    report:
      'Indeterminate adrenal lesion. Recommend correlation with prior imaging and further characterisation or interval imaging according to local adrenal incidentaloma pathway.',
    endocrine: ['Hormonal assessment is documented as normal in this pathway.'],
    next: [
      'Enter maximum diameter and unenhanced HU if available.',
      'Look for prior stability.',
      'Escalate to MDT if morphology is heterogeneous, HU >20, size ≥4 cm, or interval growth is present.',
    ],
  }
}

function OptionGroup<T extends string>({
  label,
  choices,
  value,
  onChange,
}: {
  label: string
  choices: Choice<T>[]
  value: T | null
  onChange: (value: T) => void
}) {
  return (
    <fieldset className="ad-option-group">
      <legend>{label}</legend>
      <div className="ad-options">
        {choices.map((choice) => (
          <button
            key={choice.value}
            type="button"
            className={`ad-choice ${value === choice.value ? 'is-selected' : ''}`}
            onClick={() => onChange(choice.value)}
          >
            <strong>{choice.label}</strong>
            {choice.detail && <span>{choice.detail}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function DensityRuler({ hu }: { hu: number | null }) {
  const marker = hu === null ? null : Math.max(0, Math.min(100, ((hu + 10) / 50) * 100))
  return (
    <div className="ad-ruler-card">
      <div className="ad-ruler-head">
        <span>Unenhanced CT density</span>
        <strong>{displayNumber(hu, ' HU')}</strong>
      </div>
      <div className="ad-density-ruler" aria-label="HU density ruler">
        <span className="ad-threshold ad-threshold-low" />
        <span className="ad-threshold ad-threshold-high" />
        {marker !== null && <i style={{ left: `${marker}%` }} />}
      </div>
      <div className="ad-ruler-labels">
        <span>≤10 HU<br />lipid-rich pattern</span>
        <span>11–20 HU<br />indeterminate</span>
        <span>&gt;20 HU<br />higher concern</span>
      </div>
    </div>
  )
}

function SizeRuler({ size }: { size: number | null }) {
  const marker = size === null ? null : Math.max(0, Math.min(100, (size / 8) * 100))
  return (
    <div className="ad-ruler-card">
      <div className="ad-ruler-head">
        <span>Maximum diameter</span>
        <strong>{displayNumber(size, ' cm')}</strong>
      </div>
      <div className="ad-size-ruler" aria-label="Size ruler">
        <span />
        {marker !== null && <i style={{ left: `${marker}%` }} />}
      </div>
      <div className="ad-ruler-labels">
        <span>Small</span>
        <span>4 cm decision line</span>
        <span>Larger lesion</span>
      </div>
    </div>
  )
}

function AssessmentPanel({ assessment }: { assessment: Assessment }) {
  return (
    <section className={`ad-result ad-result-${assessment.tone}`} aria-live="polite">
      <p className="ad-result-kicker">Result</p>
      <h2>{assessment.headline}</h2>
      <p className="ad-result-lead">{assessment.recommendation}</p>

      <div className="ad-guideline-callout">
        <div>
          <strong>Click here to read the GGC guideline</strong>
          <span>This opens the GGC endocrine guideline library. Use your local adrenal incidentaloma PDF if your department has a separate internal pathway.</span>
        </div>
        <a href={GGC_ADRENAL_GUIDELINE_URL} target="_blank" rel="noreferrer">Open GGC guideline</a>
      </div>

      <div className="ad-flag-table" aria-label="Green amber red adrenal flags">
        {adrenalRagFlags.map((flag) => (
          <article key={flag.tone} className={`ad-flag-card ad-flag-${flag.tone}`}>
            <h3>{flag.title}</h3>
            <p>{flag.meaning}</p>
            <ul>{flag.items.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
        ))}
      </div>

      <div className="ad-result-grid">
        <article>
          <h3>Why</h3>
          <ul>{assessment.why.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
        <article>
          <h3>Endocrine check</h3>
          <ul>{assessment.endocrine.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
        <article className="ad-report-card">
          <h3>Possible report wording</h3>
          <p>{assessment.report}</p>
        </article>
        <article>
          <h3>Next action</h3>
          <ul>{assessment.next.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
      </div>
    </section>
  )
}

export default function AdrenalAdenomaTool() {
  const [hormonalStudy, setHormonalStudy] = useState<YesNoUnknown | null>(null)
  const [hormonalResult, setHormonalResult] = useState<HormoneResult | null>(null)
  const [prior, setPrior] = useState<PriorImaging | null>(null)
  const [pattern, setPattern] = useState<LesionPattern | null>(null)
  const [maxDiameter, setMaxDiameter] = useState('')
  const [axialDiameter, setAxialDiameter] = useState('')
  const [hu, setHu] = useState('')

  const maxDiameterNumber = asNumber(maxDiameter)
  const axialDiameterNumber = asNumber(axialDiameter)
  const huNumber = asNumber(hu)
  const preferredSize = maxDiameterNumber ?? axialDiameterNumber

  const assessment = useMemo(
    () => classifyAssessment({ hormonalStudy, hormonalResult, prior, pattern, maxDiameter: maxDiameterNumber, axialDiameter: axialDiameterNumber, hu: huNumber }),
    [hormonalStudy, hormonalResult, prior, pattern, maxDiameterNumber, axialDiameterNumber, huNumber],
  )

  function reset() {
    setHormonalStudy(null)
    setHormonalResult(null)
    setPrior(null)
    setPattern(null)
    setMaxDiameter('')
    setAxialDiameter('')
    setHu('')
  }

  const showHormoneResult = hormonalStudy === 'yes'
  const showImagingPath = hormonalStudy !== null && !(hormonalStudy === 'yes' && hormonalResult === null)

  return (
    <main className="ad-page">
      <section className="ad-hero">
        <div>
          <p className="ad-eyebrow">Radiology pathway · Adrenal incidentaloma</p>
          <h1>Adrenal adenoma decision tool</h1>
          <p>
            A reporting-style pathway that starts with hormonal assessment, then adds prior stability,
            morphology, maximum diameter and unenhanced HU.
          </p>
        </div>
        <div className="ad-hero-actions">
          <Link to="/physics" className="button button-outline">Back to Physics</Link>
          <button type="button" className="button button-primary" onClick={reset}>Reset</button>
        </div>
      </section>

      <section className="ad-shell">
        <aside className="ad-spine" aria-label="Decision pathway">
          <h2>Decision spine</h2>
          <ol>
            <li className={hormonalStudy ? 'is-done' : 'is-active'}>Hormonal study?</li>
            <li className={showHormoneResult && hormonalResult ? 'is-done' : showHormoneResult ? 'is-active' : ''}>Normal or abnormal?</li>
            <li className={prior ? 'is-done' : showImagingPath ? 'is-active' : ''}>Previous imaging?</li>
            <li className={pattern ? 'is-done' : showImagingPath ? 'is-active' : ''}>Morphology</li>
            <li className={preferredSize !== null ? 'is-done' : showImagingPath ? 'is-active' : ''}>Maximum diameter</li>
            <li className={huNumber !== null ? 'is-done' : showImagingPath ? 'is-active' : ''}>Unenhanced HU</li>
          </ol>
          <div className="ad-rule-card">
            <strong>Core idea</strong>
            <span>Function first. Then prove benignity with stability, morphology, size and density.</span>
          </div>
          <DensityRuler hu={huNumber} />
          <SizeRuler size={preferredSize} />
        </aside>

        <div className="ad-workflow">
          <section className="ad-card">
            <OptionGroup label="1. Has a hormonal study been done?" choices={hormoneStudyChoices} value={hormonalStudy} onChange={(value) => { setHormonalStudy(value); setHormonalResult(null) }} />
          </section>

          {showHormoneResult && (
            <section className="ad-card ad-reveal">
              <OptionGroup label="2. If yes, is the hormonal study normal or abnormal?" choices={hormoneResultChoices} value={hormonalResult} onChange={setHormonalResult} />
            </section>
          )}

          {showImagingPath && (
            <>
              <section className="ad-card ad-reveal">
                <OptionGroup label="3. Is there previous imaging?" choices={priorChoices} value={prior} onChange={setPrior} />
              </section>

              <section className="ad-card ad-reveal">
                <OptionGroup label="4. Which description fits best?" choices={patternChoices} value={pattern} onChange={setPattern} />
              </section>

              <section className="ad-card ad-card-inputs ad-reveal">
                <div>
                  <h2>5. Lesion size</h2>
                  <p>Enter the maximum diameter. If you also have an axial measurement, record it separately.</p>
                </div>
                <label>
                  <span>Maximum diameter, any plane (cm)</span>
                  <input inputMode="decimal" value={maxDiameter} onChange={(event) => setMaxDiameter(event.target.value)} placeholder="e.g. 2.4" />
                </label>
                <label>
                  <span>Maximum axial diameter (cm), if different</span>
                  <input inputMode="decimal" value={axialDiameter} onChange={(event) => setAxialDiameter(event.target.value)} placeholder="optional" />
                </label>
              </section>

              <section className="ad-card ad-card-inputs ad-reveal">
                <div>
                  <h2>6. Unenhanced CT attenuation</h2>
                  <p>Use the true non-contrast HU if available. Contrast-enhanced HU should not be used for the ≤10 HU rule.</p>
                </div>
                <label>
                  <span>Hounsfield unit of the lesion (HU)</span>
                  <input inputMode="decimal" value={hu} onChange={(event) => setHu(event.target.value)} placeholder="e.g. 8, 18, 32" />
                </label>
              </section>
            </>
          )}

          <AssessmentPanel assessment={assessment} />

          <section className="ad-guidance-note">
            <h2>Use carefully</h2>
            <p>
              This is an educational reporting aid, not a substitute for your local adrenal incidentaloma pathway,
              endocrine advice, MDT discussion, or the full clinical history. It is built around contemporary ESE/ENSAT-style
              principles: exclude hormone excess, identify homogeneous lipid-rich adenomas, and escalate suspicious or growing lesions.
            </p>
          </section>
        </div>
      </section>
    </main>
  )
}
