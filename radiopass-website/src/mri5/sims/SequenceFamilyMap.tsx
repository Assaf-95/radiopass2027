/**
 * 5.11 — the sequence family map.
 *
 * This one is deliberately NOT a canvas simulation. Nothing here moves; what
 * matters is the hierarchy and the ability to walk it with a keyboard, and a
 * tree of real buttons does both better than anything drawn into a bitmap. So
 * it skips `Sim` and is built from semantic markup with the module's own
 * classes, which also means a screen reader gets the nesting for free.
 *
 * The organising claim it exists to make: every sequence in MRI is the same
 * three-step experiment — excite, wait, read — and a "family" is nothing more
 * than a different answer to one of those three steps. Selecting a node states
 * which of the three it changes and which it leaves alone, so the map is a
 * classification with a mechanism behind it rather than a list of names.
 *
 * Section links are resolved through the registry in sections.ts, so no route
 * is hand-wired here.
 */

import { useId, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'

import { Rich } from '../Section'
import { SECTION_BY_SLUG, sectionPath } from '../sections'

/** The three steps every sequence has, in order. */
type Stage = 'excite' | 'wait' | 'read'

const STAGES: { id: Stage; name: string; text: string }[] = [
  {
    id: 'excite',
    name: 'Excite',
    text: 'An RF pulse at the Larmor frequency tips longitudinal magnetisation into the transverse plane. The flip angle, and anything played before the pulse, are choices.',
  },
  {
    id: 'wait',
    name: 'Wait',
    text: 'Transverse magnetisation dephases while longitudinal magnetisation recovers. Whatever is done during this interval is a choice.',
  },
  {
    id: 'read',
    name: 'Read',
    text: 'An echo is formed and sampled while the readout gradient is on. How the echo is made, and how much of k-space is taken per excitation, are choices.',
  },
]

type FamilyNode = {
  id: string
  name: string
  /** Vendor names for the same thing, where they exist. */
  aka?: string
  /** The one-sentence claim: what this changes about the experiment. */
  claim: string
  excite: string
  wait: string
  read: string
  /**
   * Which of the three steps this node changes — family nodes relative to the
   * bare excite–wait–read experiment, members relative to their own family.
   * One baseline per level, or the same physics gets badged both ways.
   */
  changes: Stage[]
  /**
   * Not acquired at all: an image computed from acquisitions that already
   * exist. `changes` cannot express this — an empty array means "runs the
   * experiment unaltered", which is the opposite of what a derived map does.
   */
  derived?: boolean
  signature: string
  cost: string
  /** Section in the registry that teaches this in full. */
  slug?: string
}

type Branch = {
  id: string
  label: string
  /** How the echo is made, or what is added — one line, on the card. */
  tag: string
  accent: string
  node: FamilyNode
  members: FamilyNode[]
}

const BRANCHES: Branch[] = [
  {
    id: 'se',
    label: 'Spin echo',
    tag: 'Echo made by a 180° RF pulse.',
    accent: 'var(--m5-mri)',
    node: {
      id: 'se',
      name: 'Spin echo',
      claim:
        'The echo is made by a **180° RF pulse** that reverses the phase every spin has accumulated, so dephasing caused by a non-uniform static field is undone and the image reports **true T2**.',
      excite: 'A 90° pulse, once per TR. All of the longitudinal magnetisation is tipped into the transverse plane.',
      wait: 'A **180° pulse at TE/2** reverses accumulated phase. It does not change any spin’s precession rate — a fast spin stays fast, it is simply moved behind, so it catches up.',
      read: 'The echo peaks at **TE**, when the reversed phase has been wound back out. Only the irreversible T2 loss remains; the T2′ part is recovered.',
      changes: ['wait'],
      signature:
        'The least sensitive family to field imperfection, and the reference contrast every other sequence is judged against. TR and TE alone decide T1, T2 or PD weighting.',
      cost:
        'One 180° pulse per echo deposits a lot of RF energy, and conventional spin echo fills only one line of k-space per TR — so it is the slowest way to an image.',
      slug: 'spin-echo',
    },
    members: [
      {
        id: 'se-conventional',
        name: 'Conventional SE',
        claim: 'One 90°, one 180°, one echo, **one line of k-space per TR**. This is the baseline experiment.',
        excite: 'One 90° pulse per TR.',
        wait: 'A single 180° refocusing pulse at TE/2.',
        read: 'One echo fills one phase-encoding line. Scan time = **TR × phase-encoding steps × averages**.',
        changes: [],
        signature: 'Predictable, robust contrast with no blurring and no distortion.',
        cost: 'A 256-line T2-weighted acquisition at TR 4000 ms takes over 17 minutes for a single average. That number is why every other member of this branch exists.',
        slug: 'spin-echo',
      },
      {
        id: 'se-fse',
        name: 'Fast / turbo SE',
        aka: 'FSE · TSE · RARE',
        claim: 'A **train of 180° pulses** follows one 90°, and each echo in the train is phase-encoded differently — so several k-space lines are filled per TR.',
        excite: 'Still one 90° per TR — unchanged.',
        wait: 'Not one refocusing pulse but a train of them, spaced by the echo spacing.',
        read: 'Turbo factor lines per TR. **Effective TE** is the moment of the echo that fills the centre of k-space, because the centre carries the contrast.',
        changes: ['wait', 'read'],
        signature:
          'Scan time divided by the turbo factor. Fat stays **bright** on T2-weighted FSE: the closely spaced 180° pulses disrupt the J-coupling that would otherwise shorten fat’s T2, so fat suppression usually has to be added deliberately.',
        cost:
          'Transverse magnetisation decays along the train, so lines collected late are weaker than lines collected early — that unevenness across k-space is **blurring along the phase axis**. More 180° pulses also means more deposited RF energy.',
        slug: 'spin-echo-detail',
      },
      {
        id: 'se-pd',
        name: 'Proton density',
        claim: '**Long TR, short TE.** A long TR lets every tissue recover almost fully, so T1 differences vanish; a short TE reads before T2 differences have developed.',
        excite: 'Repeated every 2000 ms or more, so almost all longitudinal magnetisation is back before the next 90°.',
        wait: 'Unchanged — an ordinary 180° refocusing pulse.',
        read: 'Read early, at a TE of roughly 10–20 ms, before the tissues have separated on their T2 curves.',
        changes: ['excite', 'read'],
        signature: 'What is left when both relaxation effects are minimised is the number of protons in the voxel. Fluid is mid-grey, not bright.',
        cost: 'The longest TR of the three weightings. In practice it is taken as the first echo of a dual-echo train, with the T2 image as the second, so the long TR is paid for once.',
        slug: 'weighting',
      },
      {
        id: 'se-ssfse',
        name: 'Single-shot FSE',
        aka: 'HASTE · SSFSE',
        claim: 'The echo train is long enough to fill **all of k-space after a single excitation** — slightly over half of it measured, the rest inferred from the symmetry of k-space.',
        excite: 'One 90° pulse for the whole slice, and no second one.',
        wait: 'A very long train of 180° pulses.',
        read: 'A complete slice in well under a second.',
        changes: ['wait', 'read'],
        signature:
          'Effectively immune to patient motion, because there is no later excitation that could be inconsistent with the first. This is the sequence behind fetal imaging and MRCP.',
        cost: 'By the end of the train very little transverse magnetisation is left, so the blurring is heavy and only strongly T2-weighted contrast is available.',
        slug: 'spin-echo-detail',
      },
    ],
  },
  {
    id: 'gre',
    label: 'Gradient echo',
    tag: 'Echo made by reversing a gradient.',
    accent: 'var(--m5-field)',
    node: {
      id: 'gre',
      name: 'Gradient echo',
      claim:
        'There is **no refocusing RF pulse**. The echo is made by reversing the readout gradient — and a gradient reversal can only undo the phase that gradient itself created, so dephasing from static field offsets survives and the decay is T2*.',
      excite: 'Flip angle **below 90°**, typically 5–40°. Most of the magnetisation stays along z, so the next excitation does not have to wait for a full recovery.',
      wait: 'Nothing reverses the phase caused by field offsets. Transverse magnetisation decays at T2*, which is always shorter than T2 because 1/T2* = 1/T2 + 1/T2′.',
      read: 'A negative gradient lobe dephases the spins, then the readout lobe of opposite polarity rephases them. The echo occurs when the two **areas** are equal.',
      // Not 'wait': leaving the dephasing alone is the default. A gradient echo
      // omits a refocusing pulse rather than adding anything to the interval.
      changes: ['excite', 'read'],
      signature:
        'A TR of a few milliseconds becomes possible, because a small flip barely disturbs the longitudinal magnetisation. That is what makes breath-hold imaging, cardiac cine and 3D volumes practical.',
      cost:
        'Everything that perturbs the static field now shows: metal, air–tissue boundaries, haemorrhage. Sometimes that is the artefact and sometimes it is the diagnosis.',
      slug: 'gradient-echo',
    },
    members: [
      {
        id: 'gre-spoiled',
        name: 'Spoiled GRE',
        aka: 'FLASH · SPGR · T1-FFE',
        claim: 'Whatever transverse magnetisation survives to the end of each TR is **destroyed** before the next excitation, so no steady-state transverse signal can build up.',
        excite: 'Small to moderate flip at short TR. Signal is maximised at the **Ernst angle**, where cos α = e^(−TR/T1).',
        wait: 'Unchanged from the gradient-echo baseline — decay at T2*.',
        read: 'A gradient-reversal echo, then a spoiler gradient and a phase-shifted RF pulse remove what is left in the transverse plane.',
        changes: ['excite', 'read'],
        signature: 'T1-weighted at short TR and moderate flip. The workhorse for post-gadolinium 3D volumes and breath-hold abdominal imaging.',
        cost: 'Deliberately discarding the residual transverse magnetisation throws signal away, so SNR per unit time is lower than a balanced sequence achieves.',
        slug: 'gradient-echo',
      },
      {
        id: 'gre-bssfp',
        name: 'Balanced SSFP',
        aka: 'TrueFISP · FIESTA · balanced FFE',
        claim: 'Every gradient is **balanced to zero net area over each TR**, so transverse magnetisation is carried from one repetition into the next and a steady state builds up.',
        excite: 'A large flip angle, 35–70°, at a TR of only a few milliseconds.',
        wait: 'TR is far shorter than T2, so there is no time to lose the transverse magnetisation before it is reused.',
        read: 'In the steady state contrast depends on the **T2/T1 ratio** — at the optimal flip the peak signal goes as √(T2/T1) — so fluid and blood are very bright with no contrast agent at all.',
        changes: ['excite', 'wait', 'read'],
        signature: 'The highest SNR per unit time in MRI, and contrast that does not depend on flow — hence bright-blood cardiac cine and fetal imaging.',
        cost: 'Off-resonance produces **banding**: dark stripes wherever the phase accumulated per TR reaches 180°. It demands an excellent shim and the shortest TR the system can manage.',
        slug: 'gradient-echo',
      },
      {
        id: 'gre-t2star',
        name: 'T2*-weighted and SWI',
        claim: 'Take the **long TE** this family makes available and the susceptibility sensitivity stops being a nuisance and becomes the measurement.',
        excite: 'A low flip angle, so T1 effects stay out of the way.',
        wait: 'A long TE — tens of milliseconds — gives static field offsets time to dephase the spins.',
        read: 'A gradient-reversal echo. Susceptibility-weighted imaging additionally keeps the **phase** image and uses it to mask the magnitude.',
        changes: ['wait'],
        signature: 'Blood products, calcification and iron appear as **blooming** signal voids, larger on the image than the object producing them.',
        cost: 'The same sensitivity destroys images near air and metal, and because the void blooms, the lesion cannot be measured accurately from it.',
        slug: 'gradient-echo',
      },
    ],
  },
  {
    id: 'ir',
    label: 'Inversion recovery',
    tag: 'A 180° pulse before the experiment starts.',
    accent: 'var(--m5-warm)',
    node: {
      id: 'ir',
      name: 'Inversion recovery',
      claim:
        'A **180° inversion pulse before the excitation** drives every tissue to −M₀ and lets it recover. Excite at the moment one tissue is passing through zero and that tissue contributes nothing to the image.',
      excite: 'A 180° inversion, a delay of **TI**, and only then the ordinary excitation pulse.',
      wait: 'Unchanged. Whatever readout follows behaves exactly as it did without the inversion.',
      read: 'Unchanged — usually an FSE readout. Inversion recovery is a **preparation**, not a way of making an echo.',
      changes: ['excite'],
      signature:
        'A tissue is nulled at **TI = 0.693 × T1**, because that is when an inverted exponential crosses zero. Nothing about the readout has to be touched to suppress a tissue.',
      cost: 'The inversion pulse and the TI delay are dead time inside every TR, so these sequences are slow, and the extra 180° raises the deposited RF energy.',
      slug: 'inversion-recovery',
    },
    members: [
      {
        id: 'ir-stir',
        name: 'STIR',
        claim: '**Short TI**, about 150–170 ms at 1.5 T, nulls fat — fat has the shortest T1 of the common tissues, roughly 250 ms, and 0.693 × 250 ms ≈ 170 ms.',
        excite: '180° inversion, TI of roughly 170 ms, then the 90°.',
        wait: 'Unchanged.',
        read: 'Unchanged — normally an FSE readout.',
        changes: ['excite'],
        signature:
          'Fat suppression that stays uniform even where the field is not, because it selects on **T1** rather than on chemical shift. That is why it survives off-isocentre, in the shoulder, ankle and neck.',
        cost:
          'It nulls anything whose T1 is near fat’s — including tissue whose T1 has been shortened by gadolinium, so **STIR is the wrong sequence after contrast**. SNR is also low, because the readout happens while every tissue is only partly recovered.',
        slug: 'inversion-recovery',
      },
      {
        id: 'ir-flair',
        name: 'FLAIR',
        claim: '**Long TI**, about 2000–2500 ms at 1.5 T, nulls CSF, whose T1 is roughly 3000–4000 ms. Same sequence as STIR, one number different.',
        excite: '180° inversion, a TI of a couple of seconds, then the 90°.',
        wait: 'Unchanged.',
        read: 'Unchanged, and heavily T2-weighted — a long TE, with the bright fluid removed.',
        changes: ['excite'],
        signature: 'T2 signal next to the ventricles and at the cortical surface stops being hidden by adjacent bright CSF.',
        cost: 'A long TI on top of a long TR makes it slow, and CSF that flows into the slice between inversion and excitation was never nulled, so it can appear artefactually bright.',
        slug: 'inversion-recovery',
      },
      {
        id: 'ir-mprage',
        name: 'IR-prepared 3D T1',
        aka: 'MP-RAGE · BRAVO · 3D TFE',
        claim: 'The inversion is used not to null a tissue but to **amplify T1 contrast** before a fast spoiled gradient-echo readout collects a whole volume.',
        excite: 'One inversion prepares the magnetisation, then a long train of low-flip excitations follows.',
        wait: 'Unchanged during the readout train; the T1 contrast was created by the inversion beforehand.',
        read: 'One inversion is followed by a segment of the volume — a train of low-flip spoiled gradient echoes — and the inversion is repeated until the 3D k-space volume is full.',
        changes: ['excite', 'read'],
        signature: 'Thin isotropic slices with strong grey–white contrast — the standard volumetric brain acquisition.',
        cost: 'Contrast depends on where in the readout train each k-space line happened to be collected, so it is less predictable than a spin-echo T1.',
        slug: 'inversion-recovery',
      },
      {
        id: 'ir-dir',
        name: 'Double IR',
        claim: 'Two inversion pulses at two different inversion times null **two** tissues in the same acquisition.',
        excite: 'Two 180° inversions, timed so that both unwanted tissues are at zero when the 90° arrives.',
        wait: 'Unchanged.',
        read: 'Unchanged.',
        changes: ['excite'],
        signature: 'Nulling CSF and white matter together leaves grey matter and makes cortical lesions conspicuous.',
        cost: 'Two inversions means two dead intervals per TR and even less recovered magnetisation to excite, so it is slow and noisy.',
        slug: 'inversion-recovery',
      },
    ],
  },
  {
    id: 'dw',
    label: 'Diffusion',
    tag: 'Two gradients that cancel only for a spin that stayed still.',
    accent: 'var(--m5-good)',
    node: {
      id: 'dw',
      name: 'Diffusion weighting',
      claim:
        'A **matched pair of strong gradients** is added either side of the refocusing pulse. A stationary spin receives equal and opposite phase and ends where it started; a spin that moved between the two lobes does not, and that mismatch destroys signal.',
      excite: 'A 90° pulse, unchanged.',
      wait: 'Two large gradient lobes straddle the 180°. Their amplitude, duration and separation set the **b-value**, in s/mm².',
      read: 'Almost always a single-shot EPI readout, so the whole image is taken before the patient can move enough to matter.',
      changes: ['wait', 'read'],
      signature: 'Signal follows **S = S₀ · e^(−b·ADC)**. Where water is restricted, ADC is low and the high-b image stays bright.',
      cost: 'The strongest gradients in routine imaging, so the acoustic noise and the eddy currents are worst here, and the EPI readout brings distortion near air and bone.',
      slug: 'diffusion',
    },
    members: [
      {
        id: 'dw-dwi',
        name: 'DWI',
        claim: 'The same slice acquired at two b-values — typically **b = 0 and b = 1000 s/mm²** — so the pair can be compared.',
        excite: 'Unchanged.',
        wait: 'The diffusion gradients are off for the b = 0 image and on for the b = 1000 image.',
        read: 'Single-shot EPI for both.',
        changes: ['wait', 'read'],
        signature: 'Restricted diffusion — acute infarct, abscess, densely cellular tumour — stays bright at high b while free water has already lost its signal.',
        cost: '**T2 shine-through**: the b = 0 image is simply T2-weighted, so a lesion that starts very bright can still look bright at b = 1000 with no restriction at all.',
        slug: 'diffusion',
      },
      {
        id: 'dw-adc',
        name: 'ADC map',
        claim: 'A **calculated** image, not a measured one: ADC = ln(S₀/S) ÷ b, worked out pixel by pixel from two or more b-values.',
        excite: 'Nothing is acquired. This image is computed from acquisitions that already exist.',
        wait: 'Nothing is acquired.',
        read: 'Nothing is acquired.',
        changes: [],
        derived: true,
        signature:
          'Taking the ratio of two images cancels the T2 contribution they share, so ADC is a clean measure of water mobility. **Restricted diffusion is dark on ADC and bright on high-b DWI** — bright on both means shine-through.',
        cost: 'A derived map with poor anatomical detail, and it is noisy wherever the high-b signal has fallen close to the noise floor.',
        slug: 'diffusion',
      },
      {
        id: 'dw-dti',
        name: 'DTI',
        claim: 'Diffusion measured along **at least six directions**, so a tensor rather than a single number can be fitted to every voxel.',
        excite: 'Unchanged.',
        wait: 'The diffusion gradient pair is applied along a different axis for each acquisition.',
        read: 'Single-shot EPI, repeated once per direction.',
        changes: ['wait', 'read'],
        signature: 'Fractional anisotropy and tractography: a white-matter tract constrains water to move along it, and the tensor records that direction.',
        cost: 'Six or more acquisitions per slice, so it is slow, and the SNR of each individual direction is low.',
        slug: 'diffusion',
      },
    ],
  },
  {
    id: 'other',
    label: 'Readouts and preparations',
    tag: 'Not a fifth family — a different way of reading, or of preparing.',
    accent: 'var(--m5-mut)',
    node: {
      id: 'other',
      name: 'Readouts and preparations',
      claim:
        'Not every named sequence is a new family. Some change only **how k-space is traversed**, some change only **what the magnetisation looks like before the sequence begins**, and one produces no image at all.',
      excite: 'A preparation — inversion, fat saturation, a saturation band — is played before the excitation and changes where each tissue starts.',
      wait: 'Unchanged in most cases; a preparation has already done its work by the time the 90° arrives.',
      read: 'A trajectory — EPI, radial, spiral — changes the order and the speed with which k-space is covered, not the contrast mechanism.',
      changes: ['excite', 'read'],
      signature: 'Separating these from the echo mechanism is the whole point of the map: a preparation can be bolted onto any family, and a readout can be bolted onto any preparation.',
      cost: 'Names conflate the two. "STIR FSE with fat saturation" is one preparation, one echo mechanism and one readout, described as if it were a single sequence.',
      slug: 'k-space',
    },
    members: [
      {
        id: 'other-epi',
        name: 'EPI readout',
        claim: 'A readout, not a contrast. After a single excitation the readout gradient **oscillates**, and a small blip on the phase axis steps to the next line, so a whole plane of k-space is traversed in one go.',
        excite: 'Unchanged — a spin echo, a gradient echo or a diffusion preparation can all feed it.',
        wait: 'Unchanged.',
        read: 'One excitation, an oscillating readout gradient, and the entire slice.',
        changes: ['read'],
        signature: 'Tens of milliseconds per slice — the readout that makes diffusion imaging and functional MRI possible at all.',
        cost: 'Every line is collected while off-resonance phase keeps accumulating, so the image distorts and drops out near air and bone, and the distortion runs along the **phase-encoding** axis.',
        slug: 'k-space',
      },
      {
        id: 'other-fatsat',
        name: 'Fat saturation',
        aka: 'FS · SPIR · SPAIR',
        claim: 'A preparation, like inversion recovery, but selecting on **chemical shift** instead of T1: fat precesses about 3.5 ppm slower than water — roughly 220 Hz at 1.5 T — so a narrow RF pulse can excite fat alone and then spoil it.',
        excite: 'A frequency-selective pulse hits the fat peak and a spoiler gradient destroys it, immediately before the imaging excitation.',
        wait: 'Unchanged.',
        read: 'Unchanged.',
        changes: ['excite'],
        signature: 'The water signal is left intact, so unlike STIR this can be used after gadolinium.',
        cost: 'It depends entirely on the field being uniform. Off isocentre or near metal the fat peak shifts and the saturation fails patchily — which is harder to read than no suppression at all.',
        slug: 'inversion-recovery',
      },
      {
        id: 'other-dixon',
        name: 'Dixon water–fat separation',
        aka: 'IDEAL · mDIXON',
        claim:
          'No saturation pulse at all. The slice is read at **two echo times** — one with fat and water in phase, one with them opposed — and the pair is separated by arithmetic: **water = (IP + OP)/2**, **fat = (IP − OP)/2**.',
        excite: 'Unchanged. Nothing is played beforehand and nothing is destroyed.',
        wait: 'Unchanged.',
        read: 'Two echoes instead of one, timed by the fat–water frequency difference. At 1.5 T that difference is about 220 Hz, so the two are opposed after half a cycle — **TE ≈ 2.3 ms** — and back in phase at **4.6 ms**.',
        changes: ['read'],
        signature:
          'Suppression by arithmetic rather than by resonance, so it survives the field imperfection that defeats a spectral pulse — and the same acquisition returns a **fat-only image as well as a water-only one**.',
        cost:
          'Extra echoes to acquire, and the separation rests on resolving which of the two solutions is water. Where that field map is mis-resolved the two are **swapped**, and a region comes back with fat labelled as water.',
        slug: 'artefacts',
      },
      {
        id: 'other-mra',
        name: 'Angiographic sequences',
        aka: 'TOF · phase contrast · CE-MRA',
        claim: 'Contrast from **flow**: repeated excitation saturates stationary tissue while unsaturated blood flows in, or a bipolar gradient pair gives moving spins a phase that stationary spins never acquire.',
        excite: 'Rapid repeated excitation of a thin slab deliberately saturates whatever stays inside it.',
        wait: 'For phase contrast, a bipolar gradient pair encodes velocity as phase.',
        read: 'An ordinary gradient-echo readout.',
        changes: ['excite', 'wait'],
        signature: 'Vascular images with no contrast agent, and in the phase-contrast case an actual velocity measurement.',
        cost: 'Time-of-flight loses signal wherever flow is slow or runs in-plane; phase contrast aliases whenever the true velocity exceeds the velocity encoding, so VENC must be set above the peak velocity — but not far above, because velocity-to-noise falls as VENC rises.',
        slug: 'angiography',
      },
      {
        id: 'other-mrs',
        name: 'Spectroscopy',
        claim: 'Everything is the same until the last step: **no gradient is played during the readout**, so the frequency axis carries chemical shift instead of position.',
        excite: 'Unchanged, but localised to a single voxel or a small grid.',
        wait: 'Unchanged — a spin echo or a stimulated echo.',
        read: 'The free induction decay is sampled with no readout gradient, then Fourier transformed into a **spectrum** in parts per million.',
        changes: ['read'],
        signature: 'Metabolite peaks rather than anatomy: N-acetylaspartate, creatine, choline, lactate.',
        cost: 'It needs a large voxel, a long acquisition and an excellent shim, and the enormous water signal has to be suppressed before anything else can be seen.',
        slug: 'spectroscopy',
      },
    ],
  },
]

const NODE_BY_ID = new Map<string, FamilyNode>(
  BRANCHES.flatMap((b) => [b.node, ...b.members]).map((n) => [n.id, n] as const),
)
const BRANCH_OF = new Map<string, Branch>(
  BRANCHES.flatMap((b) => [b.node, ...b.members].map((n) => [n.id, b] as const)),
)

/* ------------------------------------------------------------------ *
 * Styling. The module's CSS variables are declared on .m5-root, which
 * wraps every section, so the map inherits the instrument palette
 * without adding a stylesheet that a sibling section might collide
 * with. Layout only lives here; anything with a hover or a pressed
 * state uses the module's own classes.
 * ------------------------------------------------------------------ */

const panel: CSSProperties = {
  border: '1px solid var(--m5-line)',
  borderRadius: 11,
  background: 'rgba(255, 255, 255, 0.015)',
  padding: '15px 16px',
}
const kicker: CSSProperties = {
  margin: 0,
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: 'var(--m5-dim)',
}
const stageBox: CSSProperties = {
  display: 'grid',
  gap: 5,
  padding: '11px 12px',
  border: '1px solid var(--m5-line)',
  borderRadius: 9,
  background: 'rgba(255, 255, 255, 0.02)',
}
const smallText: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.6,
  color: 'var(--m5-mut)',
  margin: 0,
}

export function SequenceFamilyMap() {
  const [selected, setSelected] = useState('se')
  const uid = useId()
  const panelId = `${uid}-detail`

  const node = NODE_BY_ID.get(selected) ?? BRANCHES[0].node
  const branch = BRANCH_OF.get(node.id) ?? BRANCHES[0]
  const isFamily = branch.node.id === node.id
  const target = node.slug ? SECTION_BY_SLUG.get(node.slug) : undefined
  // A derived image runs none of the three steps, which is not the same as
  // running all three unaltered — so it gets its own badge, not "unchanged".
  const derived = node.derived === true

  return (
    <section className="m5-sim" aria-label="Map of the MRI sequence families and what each one changes">
      {/* ---------- the root: the experiment every family shares ---------- */}
      <div style={panel}>
        <p style={kicker}>Every sequence is this experiment</p>
        <ol
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: 9,
            listStyle: 'none',
            margin: '11px 0 0',
            padding: 0,
          }}
        >
          {STAGES.map((s, i) => (
            <li key={s.id} style={stageBox}>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    color: '#12101c',
                    background: 'var(--m5-mri)',
                    borderRadius: 12,
                    padding: '2px 6px',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {`0${i + 1}`}
                </span>
                <strong style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--m5-ink)' }}>{s.name}</strong>
              </span>
              <p style={smallText}>{s.text}</p>
            </li>
          ))}
        </ol>
      </div>

      <div aria-hidden="true" style={{ width: 1, height: 14, background: 'var(--m5-line-2)', margin: '0 auto' }} />

      {/* ---------- the branches ---------- */}
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 10,
        }}
      >
        {BRANCHES.map((b) => (
          <li
            key={b.id}
            style={{
              border: '1px solid var(--m5-line)',
              borderTop: `2px solid ${b.accent}`,
              borderRadius: '3px 3px 11px 11px',
              background: 'rgba(255, 255, 255, 0.015)',
              padding: '13px 13px 14px',
            }}
          >
            <button
              type="button"
              className={node.id === b.node.id ? 'm5-chip is-on' : 'm5-chip'}
              aria-pressed={node.id === b.node.id}
              aria-controls={panelId}
              onClick={() => setSelected(b.node.id)}
              style={{ width: '100%', textAlign: 'left', borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}
            >
              {b.label}
            </button>
            <p style={{ ...smallText, fontSize: 11.5, margin: '8px 0 0', color: 'var(--m5-dim)' }}>{b.tag}</p>

            <ul
              style={{
                listStyle: 'none',
                margin: '11px 0 0 6px',
                padding: '0 0 0 9px',
                borderLeft: '1px solid var(--m5-line-2)',
                display: 'grid',
                gap: 6,
              }}
            >
              {b.members.map((m) => (
                <li key={m.id} style={{ display: 'flex', alignItems: 'center' }}>
                  <span
                    aria-hidden="true"
                    style={{ width: 9, height: 1, marginLeft: -9, background: 'var(--m5-line-2)', flex: 'none' }}
                  />
                  <button
                    type="button"
                    className={node.id === m.id ? 'm5-chip is-on' : 'm5-chip'}
                    aria-pressed={node.id === m.id}
                    aria-controls={panelId}
                    onClick={() => setSelected(m.id)}
                    style={{ borderRadius: 7, padding: '5px 10px' }}
                  >
                    {m.name}
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {/* ---------- what the selected node changes ---------- */}
      {/* The panel is a target for aria-controls, not a live region: announcing
          the whole of it on every click would be unusable. The one-line caption
          below carries the live announcement instead. */}
      <div id={panelId} role="region" aria-label="What the selected sequence changes" style={panel}>
        <p style={kicker}>
          {isFamily ? 'Family' : `${branch.label} · variant`}
        </p>
        <h4
          style={{
            fontFamily: "var(--display, 'Fraunces', Georgia, serif)",
            fontWeight: 360,
            fontSize: 22,
            lineHeight: 1.2,
            margin: '7px 0 0',
            color: 'var(--m5-ink)',
          }}
        >
          {node.name}
        </h4>
        {node.aka && (
          <p style={{ ...smallText, fontSize: 11.5, margin: '4px 0 0', color: 'var(--m5-dim)' }}>
            Also sold as {node.aka}
          </p>
        )}
        <p className="m5-what" style={{ margin: '11px 0 0' }}>
          <Rich text={node.claim} />
        </p>

        <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'grid', gap: 9 }}>
          {STAGES.map((s) => {
            const changed = !derived && node.changes.includes(s.id)
            return (
              <li key={s.id} style={{ borderTop: '1px solid var(--m5-line)', paddingTop: 9, display: 'grid', gap: 5 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: changed ? 'var(--m5-mri)' : 'var(--m5-dim)',
                    }}
                  >
                    {s.name}
                  </span>
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: changed ? '#12101c' : 'var(--m5-dim)',
                      background: changed ? 'var(--m5-mri)' : 'transparent',
                      border: changed ? '1px solid var(--m5-mri)' : '1px solid var(--m5-line-2)',
                      borderRadius: 11,
                      padding: '1px 7px',
                    }}
                  >
                    {derived ? 'not acquired' : changed ? 'changed here' : 'unchanged'}
                  </span>
                </span>
                <p style={{ ...smallText, fontSize: 13.5, color: 'var(--m5-mut)' }}>
                  <Rich text={node[s.id]} />
                </p>
              </li>
            )
          })}
        </ul>

        <p className="m5-change" style={{ marginTop: 18 }}>
          <span>What it buys</span>
          <span><Rich text={node.signature} /></span>
        </p>
        <p className="m5-change" style={{ marginTop: 12, borderLeftColor: 'var(--m5-warm)' }}>
          <span style={{ color: 'var(--m5-warm)' }}>What it costs</span>
          <span><Rich text={node.cost} /></span>
        </p>

        {target && (
          <Link to={sectionPath(target.slug)} className="m5-contents-card" style={{ marginTop: 18 }}>
            <span className="m5-contents-n">{target.number}</span>
            <span className="m5-contents-body">
              <strong>{target.title}</strong>
              <span>{target.summary}</span>
            </span>
          </Link>
        )}
      </div>

      <p className="m5-caption" aria-live="polite">
        {isFamily ? `${node.name} family.` : `${node.name}, in the ${branch.label.toLowerCase()} family.`}{' '}
        {derived
          ? 'It is calculated from images already acquired — it runs none of the three steps itself.'
          : node.changes.length === 0
          ? 'It changes none of the three steps of the excite–wait–read experiment.'
          : `It changes the ${node.changes
              .map((c) => STAGES.find((s) => s.id === c)?.name.toLowerCase())
              .join(' and ')} step${node.changes.length > 1 ? 's' : ''} of the excite–wait–read experiment.`}
      </p>
    </section>
  )
}
