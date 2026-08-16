/**
 * X-ray production — two focused lessons on the shared player.
 *
 * XrayProductionLesson follows one electron from the mains supply to the tube
 * window; XraySpectrumLesson teaches the one graph that carries half the
 * X-ray paper.
 *
 * Both lessons are taught ON the built simulators from /visuals — the canvas
 * tube engine and the beam-quality spectrum — hosted inside each concept and
 * dressed down to the one control that concept is about. Nothing here is
 * redrawn any more: changing the target element was the last hand-drawn
 * diagram, and it went the moment the spectrum simulator grew a target
 * chooser of its own. A drawing cannot be dragged, and the whole point of
 * that concept is that the learner moves the fingerprint themselves.
 */

import { LessonPage, type LessonStep } from './lesson'
import { SimFrame, type SimFrameProps } from './simframe'

/* The two instruments these lessons run on. */
const TUBE = '/visuals/xray-tube-physics-canvas.html'
const SPEC = '/visuals/xray-beam-quality.html'

/** What each simulator says for itself — the lesson says it instead.
 *
 *  The tube page's own title and blurb were being left in: a 34px heading and
 *  a two-line paragraph sitting between the canvas and the controls, saying
 *  what the concept beside it already says. They cost ~100px, which is why the
 *  bottom three sliders — rpm, target angle, filtration — used to fall past the
 *  frame's ceiling, taking the spotlight with them. Its "Reset simulation"
 *  button goes too: inside a guided concept its only effect is to throw away
 *  the state the lesson just arranged. */
const PROSE: Record<string, string[]> = {
  [TUBE]: ['.nav', '.kicker', '.note', '.control-panel h2', '.control-panel > p', '#resetBtn'],
  [SPEC]: ['.info-scroll', '.mode-bar', '#teachingControls'],
}

/** The spectrum simulator opens in its own guided mode; the lesson drives the
 *  sliders directly, so it is switched to manual on arrival. The click is
 *  idempotent, so revisiting a concept costs nothing. */
const ARRIVE: Record<string, string[]> = { [SPEC]: ['#modeManual'] }

/* Both simulators are laid out for a full browser window, so inside a
   lesson-sized frame they run taller than the frame and scroll. These
   overrides compact the chrome — padding, card margins, canvas height — until
   the instrument and its controls sit on one screen. The simulators
   themselves are untouched; open either directly and it is full size. */
const LAYOUT: Record<string, string> = {
  [TUBE]: `
   @media (min-width: 620px) {
    .canvas-page { padding: 8px !important; gap: 8px !important; }
    .control-panel { padding: 10px !important; gap: 6px !important; }
    .control { margin: 0 !important; }
    .control label { font-size: 11px !important; }
    #tubeCanvas { max-height: 400px !important; }
    /* Seven sliders in one column ran 250px past the bottom of the frame, so
       four concepts spotlighted a control the learner could not see — the ring
       was painted below the fold and the visible sliders were all dimmed, which
       reads as "nothing is highlighted". Two columns puts the whole console on
       screen at every lesson width. */
    #controls { display: grid !important; grid-template-columns: 1fr 1fr !important;
                gap: 6px 14px !important; align-items: start !important; }
   }
   @media (max-width: 619px) {
    .canvas-page { padding: 6px !important; gap: 6px !important; }
    #tubeCanvas { max-height: 210px !important; }
    .control-panel { padding: 8px !important; gap: 4px !important; }
    .control { margin: 0 !important; }
    .control label { font-size: 11px !important; }
   }
  `,
  [SPEC]: `
   /* A lesson frame is narrower than 1120px, so the simulator's own
      narrow-window rules fire inside it: they floor the two panels at 620 and
      360 px to keep a full page from collapsing. In here that floor is just
      empty space the graph card stretches into. Let both panels hug. */
   .visual-panel { min-height: 0 !important; }
   .info-panel { min-height: 0 !important; }
   .graph-card { flex: 0 0 auto !important; }
   /* The console's own 130px label column and 96px readout were sized for a
      full browser window; in a lesson frame they leave the slider — the only
      part the learner touches — whatever is left over, which on a phone was
      79px of travel for a 100 kV range. Give the track the priority at every
      width, since every concept here asks for a drag. */
   .slider-row { grid-template-columns: minmax(0, 92px) minmax(96px, 1fr) auto !important;
                 gap: 8px !important; }
   .slider-value { min-width: 0 !important; white-space: nowrap !important; }

   @media (min-width: 620px) {
    html, body { height: auto !important; }
    /* The frame's own "Open the full simulator" pill floats over the bottom
       right corner. Now that the instrument hugs its contents rather than
       padding itself out to 620px, that corner is a live slider — so keep a
       strip clear for the pill to sit in. */
    .app { height: auto !important; padding: 8px 8px 34px !important; gap: 8px !important;
           flex-direction: row !important; align-items: flex-start !important; }
    .visual-panel { display: flex !important; flex-direction: column !important; gap: 8px !important; }
    /* min-width, and it has to be here. A flex item's min-width defaults to
       auto — its own min-content — and the readout values are nowrap, so the
       panel refused to go below 320px however firmly 236 was asked for. On a
       1280px laptop that left 306px for the graph AND the console, and the
       grid below squeezed every slider down to 37px of travel: 100 kV over
       twenty usable pixels, on the lesson whose whole job is dragging them.
       Let the panel shrink, and let the values wrap rather than set the floor. */
    .info-panel { flex: 0 1 236px !important; width: auto !important; min-width: 0 !important;
                  background: none !important; border: 0 !important; box-shadow: none !important;
                  justify-content: flex-start !important; }
    .physics-box .data-value { white-space: normal !important; }
    .visual-panel { flex: 1 1 auto !important; min-width: 0 !important; }
    /* Bound the SVG, not the card. #spectrumSvg asks for height:100%, which
       against a card of auto height resolves to auto — so the graph took its
       intrinsic 1000:620 ratio at full width, stood 60-odd px taller than the
       card that was supposed to cap it, and the controls card printed over its
       x axis. Capping the replaced element scales it down whole, and the card
       then hugs what it actually contains. */
    .graph-card { min-height: 0 !important; max-height: none !important; margin: 0 !important; padding: 6px !important; }
    #spectrumSvg { max-height: 336px !important; }
    .physics-box { margin: 0 !important; padding: 8px 10px !important; }
    .physics-box .data-value { font-size: 14px !important; }
    .physics-box .data-label { font-size: 10px !important; }
    .controls-card { padding: 8px 10px !important; min-height: 0 !important; margin: 0 !important; }
    .slider-row { margin: 0 !important; }
   }
   @media (max-width: 619px) {
    .app { padding: 6px 6px 32px !important; gap: 6px !important; }
    .graph-card { min-height: 0 !important; max-height: none !important; margin: 0 !important; padding: 4px !important; }
    #spectrumSvg { max-height: 244px !important; }
    .physics-box { margin: 0 !important; padding: 6px 8px !important; }
    .physics-box .data-value { font-size: 14px !important; }
    .physics-box .data-label { font-size: 10px !important; }
    .controls-card { padding: 6px 8px !important; min-height: 0 !important; margin: 0 !important; }
   }
  `,
}

const TITLES: Record<string, string> = {
  [TUBE]: 'X-ray tube physics simulator',
  [SPEC]: 'X-ray beam quality and spectrum simulator',
}

const simStage = ({ sim, hide, ...rest }: {
  sim: string
  hide?: string[]
  focus?: string[]
  set?: Record<string, number | string>
  tall?: boolean
  task?: SimFrameProps['task']
}) => (
  <SimFrame
    src={sim}
    title={TITLES[sim]}
    hide={[...(PROSE[sim] ?? []), ...(hide ?? [])]}
    css={LAYOUT[sim]}
    click={ARRIVE[sim]}
    {...rest}
  />
)


const ACC = '#A8CBEA'

/* Every spectrum concept but the last is a tungsten tube, and the text of each
   one says so. Stating it in the concept's own `set` means that stepping BACK
   out of the target-element concept puts the instrument back where the earlier
   prose claims it is, rather than leaving molybdenum lines under a paragraph
   about 59 and 67 keV. */
const W_TARGET = { '#targetSlider': 0 }

/* ================================================================== *
 * Lesson one — production. Follow one electron through the machine.
 * ================================================================== */

const PRODUCTION_STEPS: LessonStep[] = [
  {
    id: 'circuit',
    title: 'Two circuits in one box',
    body: 'An X-ray set is **two circuits sharing one tube**. A **filament circuit** pushes a few amps through a thin wire to heat it, and a **high-voltage circuit** — a step-up transformer — holds **tens of thousands of volts** between the tube’s two ends. Follow one electron through the machine: it starts here, at the wall socket.',
    numbers: 'Filament: ~**10 V, a few A** · tube: **60–120 kV** from the step-up transformer.',
    exam: 'The high-voltage transformer multiplies the mains by its turns ratio, and rectification turns AC into a near-constant potential. Modern **high-frequency generators** keep the voltage ripple to a few percent, so the peak (kVp) and the working kV are nearly the same number — which is why the exam increasingly writes plain "kV".',
    stage: simStage({ sim: TUBE, hide: ['.control-panel'], set: { '#kvp': 90, '#ma': 180, '#temperature': 2200 } }),
  },
  {
    id: 'filament',
    title: 'Heat the filament until it glows',
    body: 'The **filament current** heats a coiled tungsten wire to about **2200 °C** — white hot, yet comfortably below tungsten’s **3400 °C** melting point. Nothing is being accelerated yet. This step only prepares a **supply of electrons** for the tube to use.',
    numbers: 'Filament ≈ **2200 °C** · tungsten melts at **3400 °C**.',
    why: 'Tungsten is the filament metal because it can be drawn into a fine wire, has the highest melting point of any workable metal, and evaporates slowly — a filament that boiled away would coat the tube’s glass and shorten its life.',
    stage: simStage({ sim: TUBE, focus: ['#temperature'], set: { '#temperature': 1400 } }),
  },
  {
    id: 'thermionic',
    title: 'Electrons boil off — thermionic emission',
    watch: 'the cloud forming around the filament as the temperature climbs — before any high voltage exists.',
    body: 'At white heat, electrons near the wire’s surface gain enough thermal energy to **escape the metal entirely**. They hover around the filament as a cloud — the **space charge** — held nearby by the positive charge they left behind. This is **thermionic emission**: the hotter the filament, the denser the waiting cloud.',
    trap: 'Thermionic emission needs **heat, not high voltage** — the cloud forms with the kV switched off.',
    stage: simStage({ sim: TUBE, focus: ['#temperature'], set: { '#temperature': 2400 } }),
  },
  {
    id: 'ma',
    title: 'Tube current — the mA',
    watch: 'the number of electrons crossing per second as the mA rises — and what does not change about each one.',
    predict: { q: 'Double the tube current. Each individual electron…', options: ['hits harder', 'is unchanged — there are just more of them'], answer: 1 },
    body: 'Switch on the high voltage and the cloud is pulled across the tube: **electrons per second = the tube current**, measured in **mA**. The mA is set by the **filament temperature** — hotter filament, denser cloud, more electrons per second. What never changes with mA is the **energy each individual electron carries**.',
    trap: '**mA is quantity only.** It cannot change the energy of any single electron — or of any photon.',
    numbers: 'Radiography runs at ~**100–800 mA**; the filament current controlling it is only a few **A**.',
    stage: simStage({ sim: TUBE, focus: ['#ma'], set: { '#ma': 450 } }),
  },
  {
    id: 'kvp',
    title: 'Tube potential — the kV',
    body: 'The **kilovoltage** held between cathode and anode is the hill every electron falls down. It sets **how much kinetic energy each single electron gains** on the way across — and therefore, later, the **maximum energy any X-ray photon can carry**. mA decides how many; **kV decides how hard**.',
    numbers: 'Diagnostic tubes: ~**60–120 kV**. An electron crossing 100 kV arrives carrying **100 keV**.',
    why: 'The electron’s charge is fixed, so energy gained = charge × voltage, exactly. That is why kilovolts convert so cleanly into kiloelectron-volts: one electron falling through 100 kV gains precisely 100 keV, every time.',
    stage: simStage({ sim: TUBE, focus: ['#kvp'], set: { '#kvp': 125 } }),
  },
  {
    id: 'accelerate',
    title: 'One electron crosses the vacuum',
    body: 'Our electron leaves the cloud and **accelerates the entire way across the gap** — the envelope is evacuated, so nothing interrupts the fall. It arrives at the anode carrying its full **charge × voltage** of kinetic energy, moving at **over half the speed of light**.',
    why: 'The vacuum is not optional. Any gas in the envelope would scatter the electrons, ionise, blur the focal spot and bombard the filament with positive ions. A tube that loses its vacuum is finished.',
    stage: simStage({ sim: TUBE, focus: ['#kvp', '#focus'], set: { '#kvp': 110, '#focus': 90 } }),
  },
  {
    id: 'anode',
    title: 'The anode: a spinning tungsten target',
    loop: true,
    watch: 'the focal track: each strike lands on fresh metal because the disc keeps turning.',
    body: 'The electron slams into the **anode** — tungsten, chosen for its **high atomic number (Z = 74)**, which makes X-ray production efficient, and its heat tolerance. The face is **angled**, and the whole disc **rotates** at thousands of rpm so every bombardment lands on fresh, cooler metal.',
    numbers: 'Tungsten **Z = 74** · melts at **3400 °C** · rotates at ~**3000–10 000 rpm**.',
    exam: 'The angled face is the line-focus principle at work: a broad actual focal spot (good for heat) projects as a small effective focal spot (good for sharpness). The anode angle — typically 7–17° — sets the ratio between the two.',
    stage: simStage({ sim: TUBE, focus: ['#angle', '#rpm'], set: { '#angle': 12, '#rpm': 9000 }, tall: true }),
  },
  {
    id: 'brems',
    title: 'Bremsstrahlung — braking radiation',
    watch: 'the continuous curve build: every braking event adds a photon somewhere under the endpoint.',
    body: 'Inside the target our electron swings past a **tungsten nucleus**. The nucleus’s positive charge bends its path, the electron **decelerates, and the lost energy leaves as an X-ray photon**. Every electron brakes differently — a distant graze sheds little, a near head-on encounter sheds nearly everything — so the photons form a **continuous spectrum**.',
    trap: 'Bremsstrahlung is an interaction with the **nucleus** — not with orbital electrons.',
    stage: simStage({ sim: SPEC, focus: ['#kvpSlider'], set: { ...W_TARGET, '#kvpSlider': 90, '#masSlider': 100, '#filterSlider': 1 }, tall: true }),
  },
  {
    id: 'characteristic',
    title: 'Characteristic radiation — the target’s fingerprint',
    watch: 'the two sharp lines standing on the smooth curve — they appear at fixed energies, whatever the kV.',
    body: 'Sometimes the incoming electron instead **knocks a K-shell electron clean out of a tungsten atom**. An outer electron drops into the vacancy, and the energy difference leaves as a photon of **exactly fixed energy** — characteristic of tungsten, not of the kV. The K-lines sit near **59 and 67 keV**, and they cannot appear at all until the tube exceeds the K-shell binding energy of **69.5 keV**.',
    trap: 'Raising the kV makes the characteristic lines **taller, never higher in energy** — their position belongs to the target atom.',
    numbers: 'Tungsten K-binding **69.5 keV** · K-lines ≈ **59 & 67 keV**.',
    stage: simStage({ sim: SPEC, focus: ['#kvpSlider'], set: { ...W_TARGET, '#kvpSlider': 120 }, tall: true }),
  },
  {
    id: 'heat',
    title: 'Almost all of it becomes heat',
    predict: { q: 'How much of the electrons’ energy leaves as X-rays?', options: ['about half', 'about 10%', 'about 1%'], answer: 2 },
    body: 'Most electrons never radiate usefully at all — they jostle the target’s outer electrons and their energy degrades into vibration. At diagnostic energies **~99% of the beam’s energy becomes heat and only ~1% becomes X-rays**. This single number explains the rotating anode, the massive disc, the oil bath, and every tube-rating chart in the exam.',
    numbers: '≈ **99% heat · 1% X-rays** at diagnostic kV.',
    why: 'Efficiency rises with kV and with target Z (roughly ∝ Z × kV), which is one more reason for tungsten — but even at 120 kV the split stays around 99 to 1. Radiotherapy machines at megavoltage energies do far better; diagnostic tubes never escape the heat problem.',
    stage: simStage({ sim: TUBE, focus: ['#ma', '#rpm'], set: { '#ma': 500, '#rpm': 3000 } }),
  },
  {
    id: 'window',
    title: 'The window — one exit only',
    body: 'Photons leave the focal spot **in every direction**. The tube’s **lead-lined housing** absorbs nearly all of them; only those aimed at the **window** escape as the useful beam. What little penetrates the housing anyway is **leakage radiation**, and regulations cap it.',
    exam: 'Leakage must not exceed **1 mGy per hour at 1 m** from the focus, measured at the highest rated kV and current. Leakage is filtered by the housing itself, so it is hard — but it carries no image information, only dose.',
    stage: simStage({ sim: TUBE, focus: ['#angle'], set: { '#angle': 7 } }),
  },
  {
    id: 'filtration',
    title: 'Filtration shapes the beam on the way out',
    body: 'On its way out the beam crosses the tube’s own glass and oil — **inherent filtration** — and then deliberate sheets of aluminium: **added filtration**. Low-energy photons, which could only dose the skin and never reach the detector, are **preferentially absorbed**. The beam that leaves is **harder on average**, yet its maximum energy is untouched.',
    trap: 'Filtration raises the **mean** energy but **never the maximum** — the endpoint belongs to the kV alone.',
    numbers: 'Total filtration ≥ **2.5 mm Al equivalent** above 70 kV.',
    stage: simStage({ sim: SPEC, focus: ['#filterSlider'], set: { ...W_TARGET, '#kvpSlider': 90, '#filterSlider': 4.5 }, tall: true }),
  },
]

export default function XrayProductionLesson() {
  return (
    <LessonPage
      meta={{
        title: 'X-ray Production',
        kicker: 'X-ray physics',
        accent: ACC,
        intro: 'Follow **one electron** from the wall socket to the tube window — twelve ideas, each one drawn.',
        /* The chain to Spectrum and the practice link now come from the course
           spine; hand-authoring them here again would render duplicates. */
        next: [],
        backTo: { label: 'X-ray physics', to: '/xray-lab' },
        synthesis: {
          headline: 'One electron, and everything it explains.',
          bigPicture:
            'Heat frees electrons; **kV decides how hard each one hits, mA decides how many arrive**. At the anode almost all of that energy becomes heat — the braking that remains draws the continuous curve, and the K-shell holes stamp tungsten’s two fixed lines on top of it. Every control on the console is a handle on one of those steps, nothing more.',
        },
      }}
      steps={PRODUCTION_STEPS}
    />
  )
}

/* ================================================================== *
 * Lesson two — the spectrum. One graph, read until it is yours.
 * ================================================================== */

const SPECTRUM_STEPS: LessonStep[] = [
  {
    id: 'axes',
    why:
      'Each photon leaving the tube carries some energy up to the electron’s own. Plot how MANY photons arrive at each energy and you get this curve: height is quantity, horizontal position is quality. Everything a technique factor does to a beam shows up as a change in this one shape.',
    exam:
      'Area under the curve is total photon fluence — roughly what mAs scales. The horizontal position of the bulk is beam quality, which is what HVL measures. Examiners test whether you can separate the two: a beam can be plentiful and soft, or sparse and hard.',
    title: 'The graph: how many photons, at each energy',
    body: 'The spectrum plots **photon energy (keV)** along the bottom against **number of photons** up the side. Every control on the console — kV, mAs, filtration — is just a way of **reshaping this one curve**. Learn its grammar once and half the X-ray questions become pictures.',
    stage: simStage({ sim: SPEC, hide: ['.controls-card', '.physics-box'], set: { ...W_TARGET, '#kvpSlider': 90, '#filterSlider': 1 }, tall: true }),
  },
  {
    id: 'endpoint',
    why:
      'An electron accelerated through 100 kV arrives with exactly 100 keV. The most it can do is surrender all of it in a single braking event, so no photon can exceed that. This is the Duane–Hunt limit, and it is why the endpoint is the one feature of the curve that reports the kV directly.',
    exam:
      'The endpoint in keV equals the peak tube kilovoltage numerically. Nothing downstream — mAs, filtration, target material, distance — can move it. Any exam option that shifts maximum photon energy by a non-kV factor is wrong by construction.',
    title: 'The endpoint is the kV — no photon can beat it',
    body: 'The curve dies at **exactly the tube’s kilovoltage**: a 90 kV tube cannot emit a photon above **90 keV**, because no electron carried more energy than that into the target. The endpoint photon is the rare electron that gave **everything to a single braking event**.',
    trap: 'Maximum photon energy (keV) = **tube potential (kV)** — numerically equal, always.',
    stage: simStage({ sim: SPEC, focus: ['#kvpSlider'], set: { ...W_TARGET, '#kvpSlider': 100 }, tall: true }),
  },
  {
    id: 'mean',
    why:
      'Most braking events are glancing rather than head-on, so most photons carry only a fraction of the electron’s energy. The curve is therefore weighted low, and the mean sits far below the endpoint — roughly a third to a half of the peak kV once filtration has removed the softest photons.',
    exam:
      'Mean energy is what determines penetration and patient dose distribution, not the endpoint. A rule of thumb worth carrying: effective energy is approximately one third to one half of kVp for a filtered diagnostic beam.',
    title: 'The mean energy sits well below the peak',
    body: 'Most braking events are glancing, so most photons carry modest energy: the beam’s **mean energy is only about a third to a half of the maximum**. That mean — not the maximum — is what sets the beam’s **quality**, its penetrating power in tissue.',
    numbers: 'Mean ≈ **⅓–½ of maximum**; a filtered 90 kV beam averages roughly **40 keV**.',
    stage: simStage({ sim: SPEC, focus: ['#kvpSlider'], set: { ...W_TARGET, '#kvpSlider': 100 }, tall: true }),
  },
  {
    id: 'kv-up',
    why:
      'Raising the kV does two things at once, which is why it is the least clean control. Each electron arrives with more energy, so the endpoint moves right; and the bremsstrahlung yield rises steeply — roughly with the square of the kV — so the curve also climbs.',
    exam:
      'kVp affects BOTH quality and quantity: output scales roughly with kV squared, while the endpoint scales linearly. This is why kV is a blunt instrument for dose and mAs is the precise one — and why the 15% rule (a 15% kV rise roughly doubles output) exists.',
    title: 'Turn the kV up: the curve grows up AND right',
    watch: 'both edges at once: the endpoint sliding right while the whole curve lifts.',
    body: 'Raising the kV gives **every electron more energy**: the endpoint slides right, the whole curve lifts, and the mean rises. **Quantity and quality increase together** — output climbs roughly with **kV²**.',
    trap: 'kV is the only routine control that **moves the endpoint**.',
    numbers: 'Quantity ∝ ~**kV²** · mean and maximum both rise.',
    stage: simStage({ sim: SPEC, focus: ['#kvpSlider'], set: { ...W_TARGET, '#kvpSlider': 130 }, tall: true }),
  },
  {
    id: 'mas-up',
    why:
      'mAs counts electrons, not their energy. Twice as many electrons produce twice as many photons of every energy, so every point on the curve doubles while its shape is untouched. Quantity is the only thing that has changed.',
    exam:
      'Output is directly proportional to mAs — a genuinely linear relationship, unlike kV. This makes mAs the correct control for adjusting image noise at a fixed beam quality, and the reason mAs is what you halve or double when reasoning about dose.',
    title: 'Turn the mAs up: amplitude, nothing else',
    watch: 'the endpoint. It will not move, however far the curve climbs.',
    predict: { q: 'Double the mAs. The endpoint…', options: ['moves right', 'stays exactly where it is'], answer: 1 },
    body: 'Doubling the mAs fires **twice as many electrons, each with unchanged energy**. The curve doubles in height at every point — **same shape, same mean, same endpoint**. Pure quantity, zero quality.',
    trap: '**mAs never changes any photon’s energy.** An option that moves the endpoint with mAs is the trap.',
    stage: simStage({ sim: SPEC, focus: ['#masSlider'], set: { ...W_TARGET, '#kvpSlider': 90, '#masSlider': 200 }, tall: true }),
  },
  {
    id: 'filtration',
    why:
      'Attenuation is strongest at low photon energies, so a sheet of aluminium removes soft photons far more readily than hard ones. Those soft photons would have been absorbed in the skin without ever reaching the detector, so removing them costs no image and saves dose.',
    exam:
      'Filtration hardens the beam: quantity falls, mean energy and HVL rise, the endpoint is untouched. Regulations require at least 2.5 mm aluminium equivalent total filtration above 70 kV. Beam hardening is also the origin of the cupping artefact in CT.',
    title: 'Add filtration: the soft end is carved away',
    watch: 'which side of the curve disappears — and which edge refuses to move.',
    predict: { q: 'Add 2 mm of aluminium. The mean energy…', options: ['falls', 'rises', 'is unchanged'], answer: 1 },
    body: 'A filter eats the **low-energy end** of the curve, because soft photons attenuate most readily. Total output falls — but the survivors are the penetrating ones, so **the mean rises while the maximum stays put**. The beam has been **hardened**.',
    trap: 'Filtration: quantity **down**, mean **up**, maximum **unchanged**.',
    stage: simStage({ sim: SPEC, focus: ['#filterSlider'], set: { ...W_TARGET, '#kvpSlider': 90, '#filterSlider': 4 }, tall: true }),
  },
  {
    id: 'peaks',
    why:
      'Bremsstrahlung is continuous because an electron can lose any fraction of its energy. Characteristic radiation is not: it comes from an electron dropping between two fixed atomic shells, and that energy gap is a property of the element. Fixed gaps give fixed energies — sharp lines rather than a smooth curve.',
    exam:
      'Tungsten K-shell lines sit at approximately 59 and 67 keV, and cannot appear at all below the 69.5 kV K-shell binding threshold. Their POSITION is set by the target element; only their presence and height depend on the kV.',
    title: 'The spikes: characteristic lines',
    body: 'Riding on the smooth hill are **needle-thin spikes at fixed energies** — the target’s characteristic radiation. For tungsten they sit near **59 and 67 keV**, and they appear **only once the kV exceeds 69.5** — the K-shell binding energy. Push the kV higher and the spikes grow taller, **but they never move**.',
    trap: 'Line **positions** come from the target metal. The kV decides only whether they appear and how tall they grow.',
    numbers: 'Tungsten K-lines ≈ **59 & 67 keV** · threshold **69.5 kV**.',
    stage: simStage({ sim: SPEC, focus: ['#kvpSlider'], set: { ...W_TARGET, '#kvpSlider': 120, '#filterSlider': 1 }, tall: true }),
  },
  {
    id: 'target-z',
    why:
      'Bremsstrahlung yield rises with the nuclear charge the electron is deflected by, so a higher-Z target produces more X-rays per electron. The characteristic lines move too, because the shell binding energies belong to that specific element.',
    exam:
      'Efficiency is proportional to Z × kV, and is still under 1% at diagnostic energies — the rest is heat. Tungsten (Z 74) is chosen for its high Z and very high melting point. Molybdenum (Z 42) is used in mammography for its lower-energy characteristic lines, near 17–19 keV.',
    title: 'Change the target, change the fingerprint',
    body: 'A higher-Z target brakes electrons more effectively — bremsstrahlung output climbs roughly **in proportion to Z** — and its characteristic lines sit at **its own atomic energies**. That is why mammography uses **molybdenum or rhodium** targets: their gentle ~**17–20 keV** lines suit soft tissue. The endpoint, as always, belongs to the kV alone.',
    numbers: 'Tungsten **Z = 74**, K-lines ~59/67 keV · molybdenum **Z = 42**, K-lines ~**17.5/19.6 keV**.',
    /* The one concept that does NOT pin the target back to tungsten: the frame
       re-applies `set` when a task completes, so naming #targetSlider here
       would snap the element home the instant the learner earned the answer. */
    stage: simStage({
      sim: SPEC,
      focus: ['#targetSlider'],
      set: { '#kvpSlider': 90, '#masSlider': 100, '#filterSlider': 1 },
      tall: true,
      task: {
        ask: 'Drag the target element off tungsten.',
        notice: 'The spikes jumped from 59 and 67 keV down into the teens, and the whole continuum dropped with the atomic number. The endpoint never moved — that still belongs to the kV.',
        watch: '#targetSlider',
        above: 1,
      },
    }),
  },
]

export function XraySpectrumLesson() {
  return (
    <LessonPage
      meta={{
        title: 'The X-ray Spectrum',
        kicker: 'X-ray physics',
        accent: ACC,
        intro: 'One graph carries half the X-ray paper. Learn to read it — and to **predict how it moves** before the examiner asks.',
        /* The chain to Geometry now comes from the course spine — this is the
           very link whose absence used to break the four-lesson core in the
           middle. Nothing hand-authored here can forget it again. */
        next: [],
        backTo: { label: 'X-ray physics', to: '/xray-lab' },
        synthesis: {
          headline: 'One curve, three handles.',
          bigPicture:
            'Read every exam option against the same three moves. **mAs** scales the curve and touches nothing else. **Filtration** carves away the soft end — quantity down, mean up, maximum untouched. **kV alone moves the endpoint**, and it drags quantity and mean up with it. The spikes never move at all: their positions belong to the target metal.',
        },
      }}
      steps={SPECTRUM_STEPS}
    />
  )
}
