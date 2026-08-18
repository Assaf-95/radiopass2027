/**
 * Topic 09 — Protection, dose & legislation.
 *
 * Follows the exemplar shape (xray.tsx): sections are the teaching units;
 * their tags/kw bind the question pool; concepts feed question feedback;
 * essentials are the night-before list.
 *
 * Scientific content cross-checked against the V1 fact bank (protection topic)
 * and the audited question annotations. Conditional statements keep their
 * conditions — nothing is simplified into a wrong absolute.
 */

import type { V2Topic } from '../types'
import { TOPIC_OUTCOMES } from '../../physics/outcomes'
import { SECTIONS } from '../mapping/sections'
import { CONCEPTS } from '../mapping/concepts'
import { InverseSquare } from '../components/sims/InverseSquare'

/** This topic's matching rules. The primer below is what stays here. */
const S = SECTIONS.safety

export const SAFETY: V2Topic = {
  id: 'safety',
  num: 9,
  title: 'Protection, dose & legislation',
  short: 'Safety',
  tagline: 'Grays into sieverts, thresholds against probabilities, and the two regulations that divide the work.',
  qbTopics: ['Legislation & Radiation Protection', 'Radiation Biology & Dosimetry'],
  outcomes: TOPIC_OUTCOMES.safety,
  sections: [
    {
      ...S.quantities,
      primer: [
        {
          kind: 'principle',
          text: 'Absorbed dose (Gy) measures energy deposited; equivalent dose (Sv) weights it for radiation type; effective dose (Sv) weights it again for tissue sensitivity. Each step answers a different question.',
        },
        {
          kind: 'prose',
          text: '**Absorbed dose** is physics: energy deposited per unit mass, joules per kilogram, the **gray (Gy)**. It applies to any material and drives the deterministic effects. Multiply by the **radiation weighting factor wR** and you have **equivalent dose** in sieverts — the correction for how damaging each radiation type is per gray. For X-rays, gamma rays and electrons **wR = 1**, so in diagnostic radiology the milligray and millisievert are numerically equal; for alpha particles wR = 20.\n\n**Effective dose** goes one step further: each organ’s equivalent dose is multiplied by its **tissue weighting factor wT** and the products summed. The result is the uniform whole-body dose that would carry the **same stochastic risk** as the actual, partial-body exposure — a currency for comparing a chest radiograph with a CT or a bone scan. It belongs to a whole person and to risk comparison, never to a single organ.\n\nThe practical quantities live beside these. **Dose–area product (DAP)** is dose × irradiated area, in Gy·cm² — because the beam widens exactly as it weakens, DAP is independent of where along the beam it is measured. **Entrance surface dose (ESD)** is the absorbed dose at the skin where the beam enters, backscatter included.',
        },
        {
          kind: 'equation',
          formula: 'HT = wR × D ; E = Σ wT × HT',
          note: 'for X-rays wR = 1, so 1 mGy of absorbed dose is 1 mSv of equivalent dose',
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'wR for X-rays, gamma rays, electrons', value: '1 (alpha particles: 20)' },
            { label: 'DAP unit and conversion', value: 'Gy·cm²; 1 cGy·cm² = 1 µGy·m²' },
            { label: 'Barium enema DAP, typical', value: '≈ 45–50 Gy·cm²' },
            { label: 'Chest radiograph ESD, typical', value: '≈ 150 µGy' },
          ],
        },
        {
          kind: 'trap',
          text: 'Effective dose is never assigned to a gram of tissue or to a single organ — “the effective dose to the skin” is a nonsense phrase. Organ-level statements use absorbed or equivalent dose.',
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'iframe',
            src: '/visuals/diagrams-6-10.html',
            title: 'Interaction probability against photon energy',
            annotation: 'PE ∝ Z³/E³ · crossover ≈25–30 keV',
            caption: 'Step through the crossing curves: photoelectric falling as E³, Compton barely moving, and the crossover in soft tissue at roughly 25–30 keV. Which interaction dominates decides contrast, dose and shielding alike — one graph, three exam chapters.',
            hide: ['header.hero', '#d6', '#d8', '#d9', '#d10'],
            height: 640,
          },
        },
      ],
    },
    {
      ...S.radiobiology,
      primer: [
        {
          kind: 'principle',
          text: 'X-rays injure DNA mostly indirectly — through free radicals made from water — and what a given dose does depends on how densely the radiation deposits it.',
        },
        {
          kind: 'prose',
          text: 'A photon can ionise DNA itself (**direct action**) or ionise a water molecule and let the resulting **free radicals** — chiefly the hydroxyl radical — carry the attack (**indirect action**). For low-LET radiation such as X-rays, roughly **two thirds of the damage is indirect**. Oxygen makes the radical damage harder to repair, which is why well-oxygenated cells are more radiosensitive.\n\n**Linear energy transfer (LET)** is the energy deposited per unit path length. X-rays are low-LET; alpha particles are high-LET, packing their ionisations so densely that the DNA breaks they cause are largely irreparable. **Relative biological effectiveness (RBE)** compares the doses of two radiations needed for the same biological effect, and it rises with LET.\n\nSensitivity also depends on the cell. The law of **Bergonié and Tribondeau**: rapidly dividing, poorly differentiated cells are the most radiosensitive — bone marrow and gonads, not neurons. Within the cycle, cells are most vulnerable in **mitosis and G2** and most resistant in **late S phase**. And for low-LET radiation there is a **dose-rate effect**: the same dose delivered slowly allows repair between hits and does less damage.',
        },
        {
          kind: 'relationship',
          title: 'What moves radiosensitivity',
          rows: [
            { change: 'LET ↑', effect: 'denser ionisation, less reparable damage — RBE ↑ (peaking near 100 keV/µm)' },
            { change: 'Dose rate ↓ (low-LET)', effect: 'repair between hits — biological damage ↓ for the same total dose' },
            { change: 'Oxygen present', effect: 'free-radical damage fixed chemically — sensitivity ↑' },
            { change: 'Cell in mitosis / G2', effect: 'most sensitive; late S phase is the most resistant' },
          ],
        },
        {
          kind: 'detail',
          summary: 'Why RBE stops rising at very high LET',
          text: 'RBE climbs with LET because denser ionisation turns repairable single-strand lesions into irreparable double-strand breaks. Beyond roughly 100 keV/µm the track deposits more energy in each cell than is needed to kill it — the surplus is wasted, and RBE falls again. This “overkill” is why the RBE–LET curve peaks rather than rising forever.',
        },
      ],
    },
    {
      ...S.effects,
      primer: [
        {
          kind: 'principle',
          text: 'Deterministic effects have a threshold and worsen with dose; stochastic effects have no threshold — dose changes their probability, never their severity.',
        },
        {
          kind: 'prose',
          text: '**Deterministic effects** (tissue reactions) come from killing enough cells to injure a tissue. Below a **threshold** nothing is seen; above it, severity climbs with dose. The exam’s anchors: **skin erythema at 2–5 Gy**, and the lens — ICRP now places the threshold for cataract (**lens opacity**) at **0.5 Gy**, the basis of the reduced 20 mSv eye limit (older teaching quoted detectable opacities from 0.5–2 Gy acute and vision-impairing cataract ≈ 5 Gy). The **lens is more radiosensitive than the cornea**, which is why the eye’s dose limit is written for the lens.\n\n**Stochastic effects** — cancer and hereditary disease — can follow from a single damaged cell, so radiation protection assumes **no threshold**: risk is taken as proportional to dose all the way down (the linear no-threshold model). Dose raises the **probability** of the effect; a radiation-induced cancer is no more severe for having come from a larger dose.\n\nThe risk coefficients are pure memorisation. Nominal **fatal cancer risk ≈ 5% per sievert**, i.e. about **1 in 20,000 per mSv** for adults; children run higher — roughly **2–3 times the adult figure** (of the order of 1 in 10,000 per mSv); the **1 in 13,000 per mGy** coefficient belongs to in-utero exposure and childhood cancer. Hereditary risk is far smaller than either — it never rivals the cancer figure.',
        },
        {
          kind: 'compare',
          title: 'The two families of harm',
          a: 'Deterministic',
          b: 'Stochastic',
          rows: [
            ['Threshold', 'yes — Gy-range', 'none assumed'],
            ['Dose ↑ changes', 'severity', 'probability only'],
            ['Mechanism', 'cell killing', 'a surviving damaged cell'],
            ['Examples', 'erythema, cataract, epilation', 'cancer, hereditary effects'],
          ],
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Skin erythema threshold', value: '≈ 2–5 Gy' },
            { label: 'Lens opacity threshold', value: '≈ 0.5 Gy (detectable opacities ≈ 2 Gy)' },
            { label: 'Fatal cancer risk, adult', value: '≈ 5%/Sv ≈ 1 in 20,000 per mSv' },
            { label: 'Cancer risk, children', value: '≈ 2–3 × the adult figure' },
          ],
        },
        {
          kind: 'trap',
          text: 'A quoted cancer risk of “1 in 300 per mSv” is wrong by two orders of magnitude — the nominal adult figure is 1 in 20,000 per mSv. And hereditary risk sits well below the cancer risk, not beside it.',
        },
      ],
    },
    {
      ...S.legislation,
      primer: [
        {
          kind: 'principle',
          text: 'IRR17 protects staff and the public through the employer; IR(ME)R 2017 protects the patient through four duty holders. Every legislation question is really asking: which regulation, and which role?',
        },
        {
          kind: 'prose',
          text: 'The **Ionising Radiations Regulations 2017** are workplace law, enforced by the **HSE**. The **employer** carries the duties: registration with the HSE, restricting exposure **as low as reasonably practicable (ALARP)**, appointing a **Radiation Protection Adviser (RPA)** — who advises but does not decide — and designating areas. A **controlled area** is designated where annual effective dose is likely to exceed **6 mSv** (or where special procedures are needed); a **supervised area** where it may exceed 1 mSv. Controlled areas need warning signs, **local rules** and a **Radiation Protection Supervisor (RPS)**; non-classified staff may still enter under a written system of work. Workers likely to exceed **6 mSv** effective dose — or three-tenths of any equivalent-dose limit, e.g. 15 mSv to the lens or 150 mSv to skin or extremities — become **classified**, with dose records kept until the worker is (or would have been) 75, and for at least 30 years from the last entry.\n\n**IR(ME)R 2017** governs the medical exposure itself, enforced in England by the **CQC**. Four duty holders: the **employer** owns the written procedures, protocols and **diagnostic reference levels (DRLs)**; the **referrer** supplies sufficient clinical information; the **practitioner justifies** the exposure; the **operator** carries out the practical steps and optimises. A practitioner need only be an **entitled, adequately trained registered healthcare professional** — not necessarily a doctor — and one person may hold more than one role, each answerable for their own. The regulations reach beyond diagnosis: research, screening and medico-legal exposures are all included.\n\n**DRLs** are typical doses for standard-sized patients at standard examinations — reviewable, achievable, and **exceedable in a justified individual case**. They are reference points, never limits.',
        },
        {
          kind: 'compare',
          title: 'The division of labour',
          a: 'IRR17',
          b: 'IR(ME)R 2017',
          rows: [
            ['Protects', 'staff and the public', 'the patient'],
            ['Enforced by', 'HSE', 'CQC (England)'],
            ['Key people', 'employer, RPA, RPS, classified workers', 'employer, referrer, practitioner, operator'],
            ['Main tools', 'dose limits, designated areas, local rules', 'justification, optimisation, DRLs'],
          ],
        },
        {
          kind: 'trap',
          text: 'Medical exposures have NO dose limits — IRR17 limits protect staff and the public, never patients. The patient’s protection is justification and optimisation, with DRLs as the yardstick.',
        },
        {
          kind: 'detail',
          summary: 'Reportable overexposures scale with the intended dose',
          text: 'A significant accidental or unintended exposure is reported by the employer to the CQC. The threshold is a multiplier that shrinks as the intended dose grows: a small intended exposure must be exceeded around tenfold to become reportable, a large one by only about 2.5 times. Equipment-fault overexposures are reportable too — the graded scale exists so that trivial absolute errors on tiny exposures do not flood the system while large errors on big exposures cannot hide.',
        },
      ],
    },
    {
      ...S.limits,
      primer: [
        {
          kind: 'principle',
          text: 'Dose limits apply to planned occupational and public exposure and sit below the deterministic thresholds; typical examination doses are the scale against which every risk conversation happens.',
        },
        {
          kind: 'prose',
          text: 'The IRR17 annual limits: **20 mSv effective dose** for employees (the classified-worker figure), **20 mSv equivalent dose to the lens of the eye**, **500 mSv to the skin and extremities**, and **1 mSv for members of the public**. Reaching three-tenths of any limit — 6 mSv effective, or 150 mSv to an extremity — forces classification. Every limit sits deliberately below the tissue-reaction thresholds, and none may be exceeded.\n\n**Pregnancy** has its own rule: from the **written declaration**, the employer must ensure the dose to the **fetus** is unlikely to exceed **1 mSv** for the remainder of the pregnancy, and must review the risk assessment. It is a fetal dose, not a maternal one — and it does **not** automatically remove a worker from fluoroscopy or nuclear medicine; shielding and working practice that keep the fetal dose compliant keep the job. For the patient’s side of pregnancy: excess childhood cancer risk after in-utero exposure is about **1 in 13,000 per mGy**, so roughly 25 mGy in utero doubles the natural childhood cancer risk.\n\nFor perspective, the **UK average annual dose is ≈ 2.7 mSv**, of which natural background contributes ≈ 2.3 mSv and medical exposure an average of about 0.4 mSv (~15% of the total). A **chest radiograph is ≈ 0.015–0.02 mSv** — a few days of background — while a **CT of the abdomen and pelvis is ≈ 5–10 mSv**, several years’ worth.',
        },
        {
          kind: 'numbers',
          title: 'The limits (annual, IRR17)',
          rows: [
            { label: 'Employee, effective dose', value: '20 mSv' },
            { label: 'Lens of the eye, equivalent dose', value: '20 mSv' },
            { label: 'Skin and extremities, equivalent dose', value: '500 mSv (150 mSv = classification trigger)' },
            { label: 'Member of the public', value: '1 mSv' },
            { label: 'Fetus, after written declaration', value: '1 mSv for the remainder of the pregnancy' },
          ],
        },
        {
          kind: 'numbers',
          title: 'Typical doses',
          rows: [
            { label: 'UK average annual dose (all sources)', value: '≈ 2.7 mSv/yr (natural ≈ 2.3; medical ≈ 0.4)' },
            { label: 'Chest radiograph', value: '≈ 0.015–0.02 mSv' },
            { label: 'CT head', value: '≈ 1–3 mSv' },
            { label: 'CT abdomen/pelvis', value: '≈ 5–10 mSv' },
            { label: 'Bone scan (Tc-99m MDP)', value: '≈ 4 mSv' },
          ],
        },
        {
          kind: 'trap',
          text: 'The pregnancy figure is 1 mSv to the fetus, not to the mother — and the clock starts at the written declaration, not at conception.',
        },
      ],
    },
    {
      ...S.staff,
      primer: [
        {
          kind: 'principle',
          text: 'The staff hazard is scatter from the patient — controlled by time, distance and shielding, and recorded by a dosimeter matched to the task.',
        },
        {
          kind: 'prose',
          text: 'In fluoroscopy and radiography the **patient is the source**: scattered dose rate at **1 m is roughly 0.1%** of the entrance dose rate. The defences are the classic three. **Time** — dose is proportional to it. **Distance** — the inverse square law makes a step back the cheapest protection there is. **Shielding** — a **0.25–0.35 mm lead-equivalent apron** attenuates the scattered beam effectively at diagnostic energies, but it is protection against **scatter, not the primary beam**. The tube housing does its own share: **leakage must stay below 1 mGy/h at 1 m**.\n\nPersonal dosimetry matches instrument to job. **Film badges** use filters to separate beta, X and gamma contributions and leave a permanent record. **Thermoluminescent dosimeters (TLDs)** are reusable, read from about 0.05 mSv, and as **rings** they watch the fingers of interventionalists and radiopharmacists. **Electronic personal dosimeters** give a real-time reading — the tool for interventional work, where a single case can matter.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <InverseSquare/>,
            title: 'The inverse square law',
            annotation: 'I ∝ 1/r²',
            caption: 'Walk the staff figure back from the scattering patient: doubling the distance quarters the dose rate. One step back is the cheapest protection in the room.',
          },
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Scattered dose rate at 1 m', value: '≈ 0.1% of the entrance dose rate' },
            { label: 'Permitted tube leakage', value: '< 1 mGy/h at 1 m' },
            { label: 'Lead apron, typical', value: '0.25–0.35 mm Pb equivalent' },
            { label: 'TLD detection threshold', value: '≈ 0.05 mSv' },
          ],
        },
        {
          kind: 'trap',
          text: 'A lead apron stops scatter, not the primary beam — no apron licenses standing in the beam, and at PET’s 511 keV an apron achieves very little of either.',
        },
        {
          kind: 'detail',
          summary: 'Radioactive waste answers to the environmental agencies',
          text: 'Radioactive waste — gaseous releases and patient excreta included — is regulated by the environmental agencies, not local authorities. Solid waste sits in decay storage for roughly ten half-lives before disposal; discharge to the sewer is strictly limited; and ARSAC licenses the administration of radiopharmaceuticals. After a diagnostic Tc-99m study, breastfeeding usually continues with little or no interruption.',
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'iframe',
            src: '/visuals/diagrams-6-10.html',
            title: 'The X-ray room, shielded',
            annotation: 'primary · secondary · controlled area',
            caption: 'Walk the layout: primary barriers where the beam can point, secondary barriers for scatter and leakage everywhere else, the operator behind the protective screen, and the controlled area drawn around it all. Distance, shielding and where you stand are the whole of staff protection.',
            hide: ['header.hero', '#d6', '#d7', '#d8', '#d10'],
            height: 640,
          },
        },
      ],
    },
  ],
  concepts: CONCEPTS.safety,
  essentials: [
    'Absorbed dose (Gy) × wR = equivalent dose (Sv); Σ(organ dose × wT) = effective dose (Sv). For X-rays wR = 1.',
    'Deterministic: threshold, severity rises with dose. Stochastic: no threshold, probability rises, severity does not.',
    'Thresholds: skin erythema 2–5 Gy; lens opacity ≈ 0.5 Gy (detectable opacities ≈ 2 Gy) — the lens is more radiosensitive than the cornea.',
    'Fatal cancer risk ≈ 5%/Sv ≈ 1 in 20,000 per mSv (adult); children ≈ 2–3× higher; in-utero exposure ≈ 1 in 13,000 per mGy childhood cancer; hereditary risk far lower.',
    'IRR17 (HSE) protects staff and the public; IR(ME)R 2017 (CQC) protects the patient: referrer informs, practitioner justifies, operator optimises, employer owns procedures and DRLs.',
    'Controlled area: likely > 6 mSv/year (supervised: > 1 mSv). Classification: likely > 6 mSv or three-tenths of any limit; records kept to age 75 or 30 years.',
    'Annual limits: employee 20 mSv effective, lens 20 mSv, skin/extremities 500 mSv; public 1 mSv; fetus 1 mSv after the written declaration.',
    'Medical exposures have no dose limits — justification and optimisation instead; DRLs are typical doses for standard patients, not limits.',
    'Typical doses: UK average ≈ 2.7 mSv/year (natural ≈ 2.3); CXR ≈ 0.015–0.02 mSv; CT head 1–3 mSv; CT abdomen/pelvis 5–10 mSv; bone scan ≈ 4 mSv.',
    'Most X-ray damage is indirect via free radicals; sensitivity peaks in rapidly dividing, undifferentiated cells and in the M/G2 phases.',
    'Scatter at 1 m ≈ 0.1% of the entrance dose rate; tube leakage < 1 mGy/h at 1 m; a lead apron stops scatter only.',
    'Reportable overexposure thresholds scale with intended dose — around 10× for small exposures, 2.5× for large; the employer reports to the CQC.',
  ],
  labs: [],
}
