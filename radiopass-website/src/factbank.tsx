import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

/* ---------- local icons ---------- */

type FbIconName = 'flame' | 'arrow' | 'search' | 'spark' | 'flask' | 'bolt' | 'shield' | 'atom' | 'wave' | 'scan' | 'magnet' | 'film' | 'ray' | 'nucleus'

const fbIconPaths: Record<FbIconName, ReactNode> = {
  flame: <path d="M12 2s1 3.2-1.5 6C8.2 10.5 7 12.3 7 14.5A5 5 0 0 0 17 15c0-1.6-.8-2.7-1.6-3.7-.5 1-1.2 1.6-2 2 .4-2.5-.3-5.5-1.4-7.3A11 11 0 0 0 12 2Z"/>,
  arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
  spark: <><path d="m12 3-1.4 4.6L6 9l4.6 1.4L12 15l1.4-4.6L18 9l-4.6-1.4L12 3Z"/><path d="m5 15-.8 2.2L2 18l2.2.8L5 21l.8-2.2L8 18l-2.2-.8L5 15Z"/></>,
  flask: <><path d="M10 3h4"/><path d="M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/></>,
  bolt: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z"/>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
  atom: <><circle cx="12" cy="12" r="1.6"/><ellipse cx="12" cy="12" rx="9" ry="3.8"/><ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(120 12 12)"/></>,
  wave: <path d="M2 12h3l2-6 4 12 3-9 2 6h6"/>,
  scan: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></>,
  magnet: <><path d="M5 4h4v8a3 3 0 0 0 6 0V4h4v8a7 7 0 0 1-14 0V4Z"/><path d="M5 8h4M15 8h4"/></>,
  film: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M16 4v16M3 9h5M3 15h5M16 9h5M16 15h5"/></>,
  ray: <><path d="M12 3v4M5.6 5.6l2.8 2.8M18.4 5.6l-2.8 2.8M3 12h4M17 12h4"/><path d="M8 21a4 4 0 0 1 8 0"/><circle cx="12" cy="14" r="3"/></>,
  nucleus: <><circle cx="12" cy="12" r="3"/><circle cx="19" cy="6" r="1.4"/><circle cx="5" cy="18" r="1.4"/><circle cx="18" cy="17" r="1.4"/><path d="m14.5 10 3-2.8M9.8 14.2l-3.4 2.6M14.8 13.8l2 2.2"/></>,
}

function FbIcon({ name, size = 18, strokeWidth = 1.8 }: { name: FbIconName; size?: number; strokeWidth?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{fbIconPaths[name]}</svg>
}

/* ---------- quick-reference visuals ---------- */

function HuScale() {
  const stops = [
    { v: '-1000', label: 'Air', pos: 0 },
    { v: '-600', label: 'Lung', pos: 17 },
    { v: '-100', label: 'Fat', pos: 39 },
    { v: '0', label: 'Water', pos: 47 },
    { v: '+40', label: 'Soft tissue', pos: 58 },
    { v: '+90', label: 'Acute blood', pos: 70 },
    { v: '+1000', label: 'Bone', pos: 100 },
  ]
  return <div className="fb-visual" aria-label="Hounsfield unit reference scale">
    <div className="fb-visual-title"><FbIcon name="scan" size={15}/>The Hounsfield line — anchor these numbers</div>
    <div className="hu-scale"><div className="hu-track"></div>{stops.map(s => <div key={s.label} className="hu-stop" style={{ left: `${s.pos}%` }}><i></i><strong>{s.v}</strong><span>{s.label}</span></div>)}</div>
  </div>
}

function HalfLifeChips() {
  const isotopes = [
    { name: 'F-18', hl: '110 min', how: 'Cyclotron · 511 keV pair' },
    { name: 'Tc-99m', hl: '6 h', how: 'Mo-99 generator · 140 keV', hot: true },
    { name: 'I-123', hl: '13 h', how: 'Cyclotron · 159 keV' },
    { name: 'Mo-99', hl: '66 h', how: 'Reactor · parent of Tc-99m' },
    { name: 'I-131', hl: '8 days', how: 'Reactor · beta + 364 keV' },
  ]
  return <div className="fb-visual" aria-label="Radionuclide half-life reference">
    <div className="fb-visual-title"><FbIcon name="nucleus" size={15}/>Half-lives you must know cold</div>
    <div className="hl-chips">{isotopes.map(i => <div key={i.name} className={i.hot ? 'hl-chip hot' : 'hl-chip'}><strong>{i.name}</strong><b>{i.hl}</b><span>{i.how}</span></div>)}</div>
  </div>
}

/**
 * The speed-of-sound ladder, animated: each bar grows in turn — air a little,
 * fat further, soft tissue, muscle, and cortical bone away to the maximum —
 * with the numbers counting up as the bars run. Replays on every mount.
 */
function SpeedLadder() {
  const media = [
    { name: 'Air', v: 330, w: 8 },
    { name: 'Fat', v: 1450, w: 36 },
    { name: 'Soft tissue (machine)', v: 1540, w: 39, hot: true },
    { name: 'Muscle', v: 1580, w: 40 },
    { name: 'Cortical bone', v: 4000, w: 100 },
  ]
  const [prog, setProg] = useState(0)
  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setProg(1)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const loop = () => {
      const t = (performance.now() - t0) / 1000
      setProg(Math.min(1, t / 3.4))
      if (t < 3.5) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  // Row i runs in its own window of the master timeline, one after another.
  const rowF = (i: number) => {
    const f = clamp01((prog - i * 0.15) / 0.34)
    return f * f * (3 - 2 * f)
  }
  return <div className="fb-visual" aria-label="Speed of sound reference">
    <div className="fb-visual-title"><FbIcon name="wave" size={15}/>Speed of sound — slow in air, fast in bone</div>
    <div className="speed-ladder">{media.map((m, i) => {
      const f = rowF(i)
      return <div key={m.name} className={m.hot ? 'speed-row hot' : 'speed-row'}>
        <span>{m.name}</span>
        <div className="speed-bar"><i style={{ width: `${(m.w * f).toFixed(1)}%` }}></i></div>
        <b>{Math.round(m.v * f)} m/s</b>
      </div>
    })}</div>
  </div>
}

function SeGreTable() {
  const rows = [
    ['Excitation', '90°', 'Variable, usually < 90°'],
    ['Refocusing', '180° RF pulse', 'Gradient reversal — no 180°'],
    ['Contrast', 'True T2', 'T2* (susceptibility-sensitive)'],
    ['Speed', 'Slower — long TR', 'Very fast — short TR'],
    ['SAR', 'High', 'Low (small flip angles)'],
  ]
  return <div className="fb-visual" aria-label="Spin echo versus gradient echo comparison">
    <div className="fb-visual-title"><FbIcon name="magnet" size={15}/>Spin echo vs gradient echo — the eternal comparison</div>
    <div className="se-gre"><div className="se-gre-head"><span></span><strong>Spin echo</strong><strong>Gradient echo</strong></div>{rows.map(r => <div key={r[0]} className="se-gre-row"><span>{r[0]}</span><b>{r[1]}</b><b>{r[2]}</b></div>)}</div>
  </div>
}

/* The one comparison that decides most interaction questions: which effect owns
   soft tissue at each working energy. Built from the same three-column table
   the spin-echo/gradient-echo comparison uses, so it needs no styling of its
   own and reads as part of the same set. */
function InteractionCrossover() {
  const rows: [string, string, string][] = [
    ['Mammography 25–30 kVp', 'DOMINANT', 'Minor'],
    ['General radiography ~70 kVp', 'Falling fast (1/E³)', 'Dominant'],
    ['CT 120 kVp', 'Negligible in soft tissue', 'Dominant'],
    ['With iodine / barium / bone', 'Rises with Z³', 'Unchanged by Z'],
  ]
  return <div className="fb-visual" aria-label="Photoelectric versus Compton dominance by energy">
    <div className="fb-visual-title"><FbIcon name="bolt" size={15}/>Who owns soft tissue at each energy</div>
    <div className="se-gre">
      <div className="se-gre-head"><span></span><strong>Photoelectric</strong><strong>Compton</strong></div>
      {rows.map(r => <div key={r[0]} className="se-gre-row"><span>{r[0]}</span><b>{r[1]}</b><b>{r[2]}</b></div>)}
    </div>
  </div>
}

/* ---------- fact data ---------- */

export type Fact = {
  t: string
  d: string
  hot?: boolean
  /** A reference diagram shown directly beneath this fact, so the picture sits
   * with the sentence it explains rather than floating at the top of the topic. */
  visual?: ReactNode
}

export type FactTopic = {
  id: string
  name: string
  tag: string
  icon: FbIconName
  blurb: string
  heat: number // 1–5 exam weight
  lab?: { label: string; to: string }
  facts: Fact[]
  extra?: ReactNode
}

export const factTopics: FactTopic[] = [
  {
    id: 'xray',
    name: 'X-ray production & interactions',
    tag: 'XR',
    icon: 'bolt',
    blurb: 'Compton, photoelectric, kVp, filtration and tube geometry — the foundation everything else is built on.',
    heat: 5,
    lab: { label: 'Try the dose & noise demo', to: '/visual-lab' },
    facts: [
      { hot: true, t: 'Compton scatter uses loosely bound outer-shell electrons', d: 'Compton is an interaction with a **loosely bound outer-shell electron** — one so weakly held that, to a diagnostic photon, it might as well be **free**: the photon’s energy dwarfs its binding energy.\n\nCompton probability does **fall as energy rises** — but only gently. The reason it still ends up owning the diagnostic range is what its rival does: the **photoelectric effect collapses as 1/E³**, far faster. Compton drifts down; photoelectric falls off a cliff.\n\nSo across **general radiography and CT**, Compton is simply what is left standing in soft tissue.\n\n**The exception is mammography.** At **25–30 kVp** the energy is low enough that photoelectric has not yet collapsed — so there, in soft tissue, **photoelectric dominates**. That is the whole reason mammography can show soft-tissue detail at all.', visual: <InteractionCrossover/> },
      { hot: true, t: 'Compton probability depends on electron density, not atomic number', d: 'Fat, muscle and water pack almost exactly the **same electron density** — so Compton treats them almost identically, and **Z has no say at all**. That is precisely why soft-tissue contrast dies at high kVp.' },
      { hot: true, t: 'Compton probability slowly falls as energy rises', d: 'A Compton event is slightly less likely at 120 kV than at 80 kV — but here is the point: **photoelectric collapses far faster, by 1/E³**, so as energy rises **Compton is what survives**. Remember the pair: Compton drifts down slowly; photoelectric falls by the cube. Photons still scatter at any angle up to 180°, and the wider the angle, the less energy the scattered photon keeps.' },
      { hot: true, t: 'Photoelectric effect: inner shell, Z³, 1/E³', d: 'One photon in — **completely absorbed** — one inner-shell electron out. Probability rises with the **cube of atomic number (Z³)** and collapses with the **cube of energy (1/E³)**. That double cube is the entire reason **iodine, barium and bone** light up.' },
      { t: 'Characteristic X-rays come from filling an inner-shell vacancy', d: 'Knock a hole in an inner shell and an outer electron **falls into the vacancy** — the energy difference leaves as a characteristic photon, **always lower in energy than the photon that made the hole**. If a question says electron capture or gamma emission, that is the **nucleus** talking — a different process entirely.' },
      { hot: true, t: 'mA is linear — kVp is squared', d: 'Double the mA and you get **twice as many photons — and nothing else changes**: the spectrum keeps its shape and its average energy. Double the kVp and output does not double — it **quadruples (∝ kVp²)**, and every photon is harder too. One dial changes quantity alone; the other changes **quantity and quality at once**.' },
      { hot: true, t: 'The 15% rule: a 15% kVp rise doubles the intensity', d: 'Just **15% more kVp doubles the dose at the receptor** — the same effect as doubling the entire mAs. That is how steep the kVp curve is. The price: a more penetrating beam and **lower subject contrast**, as Compton starts to beat photoelectric.' },
      { hot: true, t: 'Filtration lowers skin dose but also lowers contrast', d: 'Aluminium or copper strips out the **low-energy photons that would only ever be absorbed in skin** — they were never going to reach the detector anyway. Skin dose falls, the beam **hardens**, contrast slips slightly. Burn in the number: legal minimum total filtration **2.5 mm Al equivalent**.' },
      { hot: true, t: 'Geometric unsharpness: small focal spot, small OID', d: 'Penumbra obeys two levers: a **smaller focal spot**, and the patient **closer to the detector**. The effective focal spot is set by filament length and anode angle — the **line-focus principle** — and very high mA physically widens it: **blooming**.' },
      { t: 'Grids buy contrast with dose — never resolution', d: 'A grid absorbs the **oblique, scattered** photons and lets the straight ones through: contrast jumps, but mAs — and patient dose — must rise to pay for it. **Resolution is never touched.** Grid ratio = strip height ÷ interspace (typically **10:1**); the Bucky factor is the size of the mAs bill.' },
      { t: 'Scatter-to-primary can reach 10:1 in an adult abdomen', d: 'In a thick abdomen, scattered photons can outnumber primary ones **ten to one** — that single number is why grids are mandatory there. Compression helps for the same reason: it physically **shrinks the volume doing the scattering**.' },
      { t: 'Isotopes: same chemistry, different nucleus', d: 'Same protons → **identical chemistry**: the body cannot tell isotopes apart. Different neutrons → different **mass number, binding energy and half-life**. Chemistry is decided in the shells; decay is decided in the nucleus.' },
      { t: 'The tube is a vacuum and the anode cools by radiation', d: 'Three tube facts that keep reappearing: filament area sets **focal spot size** (output is mA’s job), the anode sheds heat across the vacuum mainly by **thermal radiation**, and noise falls with **√mAs** — to halve the noise, **quadruple** the mAs.' },
    ],
  },
  {
    id: 'ct',
    name: 'Computed tomography',
    tag: 'CT',
    icon: 'scan',
    blurb: 'Pitch, Hounsfield units, beam hardening and dose — the concepts that decide entire question sets.',
    heat: 5,
    lab: { label: 'Open the CT dose studio', to: '/visual-lab' },
    facts: [
      { hot: true, t: 'Pitch = table travel per rotation ÷ beam width', d: '**Table travel per rotation over beam width** — a pure, dimensionless ratio. Push it up and the helix stretches: the scan gets **faster and the dose gets lower**, and above 1 the gaps in the data must be interpolated.' },
      { hot: true, t: 'The Hounsfield unit is relative attenuation, not absolute', d: 'A Hounsfield unit is the voxel measured **against water** — anchored at **water = 0, air = −1000**. Carry the landmarks: fat ≈ **−100**, soft tissue **+20 to +50**, cortical bone **+1000 and beyond**.', visual: <HuScale/> },
      { hot: true, t: 'Beam hardening falsely lowers central HU', d: 'The periphery strips out the soft photons, so by the time the beam reaches the middle it is **harder** — and the centre of a dense object reads **falsely low**. Streaks beside dense bone are the classic giveaway.' },
      { hot: true, t: 'Narrowing the window width increases displayed contrast', d: 'Narrow the window and the same grey scale is spent on **fewer HU** — small differences suddenly become visible. It is pure display: **the underlying data never change**. Lung windows sit around a level of −500 to −600.' },
      { t: 'Matrix up, pixels down, SNR down', d: 'At a fixed FOV the chain is automatic: **matrix up → pixels smaller → fewer photons each → noise up**. Slice thickness runs the same logic in reverse — thicker slices collect more photons and better SNR, but pay in **partial volume averaging**.' },
      { t: 'Helical interpolation slightly worsens partial volume', d: 'A helix never actually scans a flat slice — the data must be **interpolated** along the table direction, blurring the slice profile. Anything smaller than a voxel gets its attenuation **averaged with its neighbours**.' },
      { hot: true, t: 'Typical doses: head 1–3 mSv, abdomen/pelvis 5–10 mSv', d: 'Anchor the numbers: **head 1–3 mSv, abdomen/pelvis 5–10 mSv**. The entrance dose dwarfs a plain film, but the rotating geometry spreads it far more **uniformly** through the patient than one-sided projection ever can.' },
      { t: 'Iterative reconstruction cuts dose, keeps quality', d: 'Model the noise mathematically, then remove it — and diagnostic images survive at **substantially lower mAs** than filtered back-projection could ever manage. The whole trade in four words: **computation buys dose**.' },
      { t: 'The bow-tie filter shapes the beam to the body', d: 'The bow-tie matches the beam to the body: **less dose to the thin periphery**, more even flux at the detectors. The pre-patient collimator sets **slice thickness and dose profile** — removing scatter is not its job.' },
      { t: 'Isotropic voxels make MPR lossless', d: 'Make the voxels perfect **cubes** and any reformat — coronal, sagittal, oblique — carries **zero resolution penalty**. That is the entire meaning of isotropic.' },
      { t: 'CT resolves about 1–2 lp/mm — and no more', d: 'CT tops out around **1–2 lp/mm**, hard-limited by detector element size. If a question dangles 15 lp/mm, that number belongs to **mammography** and nothing else.' },
      { t: 'MDCT rows can be binned', d: 'Detector rows can be **electronically combined**, so a reconstructed slice may be wider than one physical row. Solid-state detectors bring high quantum efficiency and minimal afterglow; wide-cone scanners pay with **cone-beam artefact**, worst at the periphery.' },
    ],
  },
  {
    id: 'mri',
    name: 'Magnetic resonance imaging',
    tag: 'MR',
    icon: 'magnet',
    blurb: 'Chemical shift, spin echo vs gradient echo, SNR levers, SAR and the 0.5 mT line — the highest-density hunting ground.',
    heat: 5,
    lab: { label: 'Open the MRI laboratory', to: '/mri-lab' },
    facts: [
      { hot: true, t: 'Chemical shift lives only in the frequency-encoding direction', d: 'Fat and water precess at **slightly different frequencies**, so the scanner maps them to shifted positions — but only along the **frequency-encoding axis**. It worsens **linearly with field strength**, is tamed by a **wider receiver bandwidth** — and gadolinium has nothing to do with it.' },
      { hot: true, t: 'Spin echo: 90° then 180° — true T2, never T2*', d: '90° to excite, then **180° to rewind** the dephasing caused by field inhomogeneity — what survives is **genuine T2**. T2* is what you are left with in any sequence **without** that refocusing pulse.', visual: <SeGreTable/> },
      { hot: true, t: 'Gradient echo: fast, low SAR, susceptibility-prone', d: 'Drop the 180° pulse and everything else follows: **small flip angles, very short TRs, little RF heating** — and maximum vulnerability to **metal, air and field inhomogeneity**. Keep TE short to limit the damage.' },
      { hot: true, t: 'The SNR levers', d: 'Up with **voxel size, slice thickness, averages (NEX) and field strength**. Down with a **bigger matrix** and a **wider receiver bandwidth**. And the trap the exam loves: more phase-encoding steps cost **scan time — not TE**.' },
      { hot: true, t: 'SAR scales with the square of field strength and flip angle', d: 'SAR is RF power turned into body heat, and it scales with the **square of B₀ and the square of flip angle** — double either and heating **quadruples**. A longer TR is cooling time. The whole-body limit exists to hold core temperature rise **under 1 °C**.' },
      { hot: true, t: 'The 0.5 mT (5 gauss) line is the public boundary', d: '**0.5 mT — 5 gauss — is the public line**: pacemaker wearers and the public stay outside it. The Faraday cage blocks **RF only** — it is powerless against the static fringe field. A quench vents non-flammable helium (the danger is **asphyxiation**), and the projectile hazard **never switches off**.' },
      { t: 'T1 is always longer than T2', d: 'In every biological tissue, **T1 is longer than T2** — longitudinal recovery is always the slower process. A long TE hands the image to T2 differences, and within a sequence TR can never be shorter than TE.' },
      { hot: true, t: 'Never pair STIR with gadolinium', d: 'STIR nulls **everything with a short T1**. Gadolinium **shortens T1** in exactly the lesions you care about. Put them together and the sequence quietly **deletes the very tissue you injected contrast to see**.' },
      { t: 'In/out-of-phase (Dixon) imaging separates fat and water', d: 'The same fat–water frequency gap that causes chemical shift, used deliberately: in and out-of-phase images expose **microscopic intracellular fat** — the classic move for calling an **adrenal adenoma**.' },
      { t: 'Gadolinium: shortens T1, ~90 min half-life, NSF risk below eGFR 30', d: 'Three numbers to keep: it **shortens T1**, clears with a biological half-life of about **90 minutes** in working kidneys, and below **eGFR 30** carries the risk of nephrogenic systemic fibrosis.' },
      { t: 'Susceptibility artefacts grow with field strength', d: 'Metal and air interfaces make **distortion and signal voids — not brightness** — and both get **worse at 3 T** than at 1.5 T. Titanium is non-ferromagnetic; iron-containing objects are dangerous projectiles.' },
      { t: '"MR Safe" means no metal, no conductor, no RF response — at all', d: '**MR Safe means unconditionally safe** — no fine print. Anything safe only within stated field or SAR limits is **MR Conditional**, including many modern cochlear implants. The MR Safety Expert is typically a medical physicist — and the Larmor frequency is simply the **gyromagnetic ratio — a constant unique to each nucleus — multiplied by B₀**.' },
    ],
  },
  {
    id: 'us',
    name: 'Ultrasound & Doppler',
    tag: 'US',
    icon: 'wave',
    blurb: 'Speed of sound, impedance, the Doppler equation and the two safety indices — tested from every possible angle.',
    heat: 5,
    lab: { label: 'Open the Ultrasound laboratory', to: '/ultrasound-lab' },
    facts: [
      { hot: true, t: 'Speed of sound belongs to the medium, not the machine', d: 'Start with who owns it: **the speed of sound is a property of the medium.** The machine does not set it and cannot change it. Turning the frequency dial changes nothing about how fast sound travels.\n\nWhat the medium brings is **stiffness and density** — c = √(k/ρ). A stiffer material passes the disturbance on faster; a denser one is more sluggish. Every tissue therefore has its own fixed speed: fat **1450 m/s**, soft tissue **~1540**, muscle **1580**, cortical bone **~4000**. Air is slowest of all at **330**, because it is so easily compressed.\n\nNow the machine’s side of it: the scanner has no way of knowing which tissue any echo passed through, so **it assumes a single uniform 1540 m/s everywhere** and converts every echo’s round-trip time into a depth on that assumption.\n\nSo whenever reality differs from that assumption, the image is wrong in a predictable way. Sound through **fat** is slower than assumed, so its echoes arrive late and the machine places the structure **too deep**. Speed differences across a boundary also bend the beam — which is refraction, and why **edge shadowing** appears at the margins of a cyst. The number is a calibration, not a fact about your patient.', visual: <SpeedLadder/> },
      { hot: true, t: 'Acoustic impedance = density × velocity', d: 'Impedance is also a property of the material, not the machine: **Z = ρc** — density times the speed of sound in it.\n\nBut impedance on its own reflects nothing. What creates an echo is the **mismatch** between two tissues meeting at a boundary. Two materials with similar Z pass the beam on almost untouched; the bigger the step in Z, the bigger the reflection.\n\nThe fraction bounced back is **R = (Z₂−Z₁)² / (Z₂+Z₁)²** — note it is squared, so mismatches punish you fast.\n\nThat is why the two great enemies of ultrasound are **air and bone**. Soft tissue against air reflects **over 99%** of the beam, leaving nothing to image with — hence coupling **gel** to abolish the air gap at the skin, why you cannot scan through lung or bowel gas, and why a probe left running in mid-air heats its own lens.' },
      { hot: true, t: 'The Doppler equation has exactly four inputs', d: '**Δf = 2f₀ · v · cos θ / c** — four inputs and not one more: **transmitted frequency, blood velocity, cos θ**, over the **speed of sound**. Vessel diameter, beam intensity and PRF do not appear anywhere in it.\n\nEverything awkward about Doppler comes from that **cos θ**. Point the beam **along** the flow (0° or 180°) and cosine is 1 — maximum shift. Point it **across** the flow at **90°** and cosine is **zero**, so the shift is zero: perfectly good flow, no signal at all.\n\nIn practice keep the angle **below 60°**. Beyond that, cosine is changing so steeply that a small error in the angle you set produces a large error in the velocity reported — which is why a stenosis can be badly over- or under-called from angle alone.' },
      { hot: true, t: 'Aliasing begins at the Nyquist limit: half the PRF', d: 'Aliasing begins at **half the PRF** — the Nyquist limit — so ordinary physiological velocities wrap the moment the scale is set too low. Raise the PRF and the ceiling rises with it — but PRF itself is **capped by depth**: deeper targets need longer round trips.' },
      { hot: true, t: 'Mechanical index warns about cavitation', d: '**MI = peak negative pressure ÷ √frequency** — a **cavitation** warning, and **nothing to do with heating** (that is the thermal index).\n\nCavitation needs a bubble to work on. Ordinarily there are few, so the risk is low — but **microbubble contrast supplies ready-made cavitation nuclei by the million**, and the risk changes completely.\n\nSo the number to carry: **BMUS guidance is not to exceed MI 0.7 once contrast is on board**, where bubbles can be driven to collapse violently. Keep MI down and limit scanning time.' },
      { hot: true, t: 'Thermal index estimates heating — and misbehaves', d: 'TI estimates **heating** — and misbehaves exactly where it matters: absorption makes it **soar over bone**, and it assumes tissue that never moves, so perfusion quietly undermines it. The obstetric line: **do not scan above TI 3.0**. A 4 °C rise held for five minutes is frankly hazardous — above all to a fetus.' },
      { t: 'Frequency buys resolution, costs penetration', d: 'Raise the frequency and you buy **sharper axial resolution** — via a shorter wavelength; the other lever is a **shorter pulse from heavier damping**, since axial resolution is half the spatial pulse length — and you pay in **penetration**. Diagnostic ultrasound spans **2–15 MHz**, wavelengths roughly 0.1–0.8 mm in tissue.' },
      { t: 'Attenuation ≈ 0.5–1 dB/cm/MHz in soft tissue', d: 'Budget **0.5–1 dB per cm per MHz** — loss scales with **both depth and frequency**. Lung and bone attenuate savagely. TGC amplifies the late, deep echoes to even out the display — it changes the picture, **never the physics**.' },
      { t: 'Pulsed Doppler is the hottest mode', d: 'All that energy, concentrated into one small sample volume: pulsed Doppler heats tissue **far more than B-mode** — the hottest mode on the machine. And duplex = real-time B-mode + pulsed-wave Doppler, **not M-mode**.' },
      { t: 'Microbubbles are 1–8 µm — smaller than the wavelength', d: '**1–8 µm** — small enough to cross pulmonary capillaries, far below both the wavelength and the probe face — and they **resonate** in the beam, which is exactly where the signal boost comes from.' },
      { t: 'The operator owns PRF, focus and frame rate', d: '**PRF, focal zone and frame rate sit in the operator’s hands** — Doppler scale, focus position and temporal resolution are decisions, not presets. Optimisation is an active skill.' },
      { hot: true, t: 'Transducer thicknesses: crystal ½λ, matching layer ¼λ', d: 'Two thicknesses, two different jobs — and the exam tests whether you can keep them apart.\n\nThe **piezoelectric crystal is ½λ thick**, because at that thickness the wave reflected inside the element returns **in phase** and reinforces itself. Element thickness is therefore what sets the probe’s **operating frequency**.\n\nThe **matching layer is ¼λ thick**, and its job is different: it sits between crystal and skin as an intermediate impedance, **stepping Z down** so the beam is not almost entirely reflected at the probe face.\n\nBehind the crystal, the **damping (backing) block** absorbs rearward energy to shorten the pulse — fewer cycles, shorter spatial pulse length, better **axial resolution**, at the cost of sensitivity.' },
      { t: 'Near field length = D² / 4λ', d: 'The beam from a single element does not diverge immediately. It first runs roughly parallel — the **near field (Fresnel zone)** — and only then spreads as the **far field (Fraunhofer zone)**.\n\nThe useful imaging happens in the near field and at the **focus**, where the beam is narrowest and **lateral resolution** is best.\n\n**Near field length = D² / 4λ** (D = element diameter). So a **wider element** or a **higher frequency** (shorter λ) both push the near field deeper — which is the physical reason a large, high-frequency probe holds its beam together further.' },
      { t: 'PRF = frame rate × lines per frame — and depth caps it', d: 'The machine cannot send the next pulse until it has finished listening for the last one. That single constraint drives most temporal-resolution questions.\n\n**PRF = frame rate × lines per frame.** Scanning **deeper** means waiting longer for each echo, so **PRF must fall** — and with it either frame rate or line density.\n\nThat is why deep scanning, a wide sector and high line density all cost you **temporal resolution**, and why a low PRF is also what drops your Doppler ceiling into **aliasing**.' },
      { t: 'Axial vs lateral vs temporal resolution', d: 'Three different resolutions, three different controls — keep them separate.\n\n**Axial** (along the beam) = **SPL / 2**. Improved by higher frequency and by heavier damping — a **low Q-value**, broad-bandwidth, short-pulse probe. It is **the same at every depth**.\n\n**Lateral** (across the beam) is set by **beam width**, so it is best at the focus and **varies with depth**. It is always the poorer of the two.\n\n**Temporal** is simply frame rate — how well fast movement is captured — and it is what you spend when you scan deep, wide, or add Doppler.' },
    ],
  },
  {
    id: 'fluoro',
    name: 'Fluoroscopy, DSA & digital imaging',
    tag: 'FL',
    icon: 'film',
    blurb: 'Why subtraction costs SNR, how CR plates actually work, and the storage arithmetic that keeps reappearing.',
    heat: 4,
    lab: { label: 'Try the dose & noise demo', to: '/visual-lab' },
    facts: [
      { hot: true, t: 'DSA trades SNR for contrast', d: 'Subtract the mask and bone and soft tissue simply vanish — **contrast resolution soars**. But the noise of **both frames adds**, so SNR falls and quantum mottle rises. Spatial resolution is untouched; total dose is high because the frames are many.' },
      { hot: true, t: 'CR plates are photostimulable barium fluorohalide', d: 'CR is **photostimulable barium fluorohalide** — caesium iodide belongs to indirect flat panels and image intensifier inputs. A **red laser releases** the trapped electrons, the plate answers in **blue light**, and a photomultiplier reads it. The phosphor is continuous: **pixels exist only at readout**.' },
      { t: 'The latent image fades in hours, not minutes', d: 'Fading starts the moment of exposure, but a few hours is fine — **half a day to a week means severe degradation**. Plate life ends by mechanical wear and laser desensitisation, not by a count of exposures.' },
      { hot: true, t: 'Double the matrix side, quadruple the storage', d: 'Double the matrix side and you **quadruple the pixels**: 512² → 1024² is four times the storage. One 512² image at 12-bit depth ≈ **400–500 KB**. Resolution is paid for in PACS space — exponentially.' },
      { t: 'Image intensifiers: CsI input, ~25–30 kV, TV-limited', d: 'A **CsI input phosphor**, electrons accelerated at **25–30 kV** across the vacuum supplying the **flux gain** — multiplied by the **minification gain** (big input screen focused onto a small output), the product is the brightness gain (~5000×). **Electrostatic lenses** focus (not photomultipliers), the **TV camera is the resolution bottleneck**, vignetting darkens the periphery, and external magnetic fields bend the electron paths.' },
      { t: 'Flat panels cannot be geometrically distorted', d: 'A rigid TFT matrix has **no electron optics** — so pincushion and S-distortion are **physically impossible**, not merely rare. Digital fluoroscopy applies logarithmic conversion so pixel values track attenuation.' },
      { t: 'Tomosynthesis: depth for a whisker of sharpness', d: 'A limited arc of low-dose projections becomes a **stack of slices** — overlapping structures removed, depth gained — at the price of in-plane resolution sitting **slightly below** a standard 2D radiograph.' },
      { t: 'AEC still matters in digital systems', d: 'A digital detector forgives overexposure **silently** — and that silence is exactly the danger. AEC holds the dose **high enough to beat mottle, low enough to stay justified**.' },
      { t: 'MTF is the mathematics of sharpness', d: 'MTF is sharpness written as mathematics: **how much contrast survives at each spatial frequency**. Every source of blur — motion, scatter, geometry — pulls the curve down.' },
      { t: 'Fluoroscopy dose rates and DAP', d: 'Typical entrance dose rate: **10–50 mGy/min**. A barium enema racks up a DAP of the order of **tens of Gy·cm²**. And the conversion worth carrying into the exam: **1 cGy·cm² = 1 µGy·m²**.' },
    ],
  },
  {
    id: 'mammo',
    name: 'Mammography',
    tag: 'MG',
    icon: 'ray',
    blurb: 'A specialised system where every design choice serves contrast and resolution at minimal dose.',
    heat: 3,
    facts: [
      { hot: true, t: 'Compression is the single highest-yield intervention', d: 'One paddle, **four wins**: lower dose, less scatter, better contrast, no motion blur. And note the verb — it **spreads** tissue, it does not magnify it. Nothing else in mammography buys as much at once.' },
      { t: 'Molybdenum target and filter: ~17–20 keV', d: '**Mo target + Mo filter** isolates the **17.4 and 19.6 keV characteristic photons** that maximise soft-tissue contrast — the Mo filter\'s **K-edge at 20 keV** strips away the bremsstrahlung just above them (tube run at 25–32 kVp). The exit window is **beryllium** — ordinary glass would swallow the very low-energy photons the whole technique depends on.' },
      { t: 'The sharpest system in radiology: up to 15 lp/mm', d: 'The sharpest system in radiology: **up to 15 lp/mm**, with focal spots **below 0.5 mm** — because microcalcifications demand it. Nothing else comes close; CT manages 1–2.' },
      { t: 'Magnification views: drop the grid, use the air gap', d: '**Drop the grid, use the air gap** — the gap lets scatter diverge harmlessly before it ever reaches the detector. Magnification runs **1.5–2.0**; a factor below 1 would be minification, physically nonsense here.' },
      { t: 'Mean glandular dose ≈ 2 mGy', d: '**Mean glandular dose ≈ 2 mGy** — held deliberately low, because screening exposes large, healthy populations, and does it repeatedly.' },
    ],
  },
  {
    id: 'nm',
    name: 'Nuclear medicine & PET',
    tag: 'NM',
    icon: 'atom',
    blurb: 'Tc-99m, the ideal tracer, gamma camera anatomy and coincidence detection — dense, factual and endlessly quizzed.',
    heat: 5,
    lab: { label: 'Open the gamma camera lab', to: '/visual-lab' },
    facts: [
      { hot: true, t: 'Tc-99m: 140 keV, 6 hours, generator-eluted', d: 'The workhorse in three numbers: **140 keV, 6 hours, generator-eluted**. Isomeric transition gives a **pure, monoenergetic gamma with no particles**; it comes from a Mo-99/Tc-99m generator — **never a cyclotron** — and daughter Tc-99 is effectively stable on a human timescale.', visual: <HalfLifeChips/> },
      { hot: true, t: 'The ideal tracer: pure gamma, 100–250 keV, hours-long half-life', d: '**Pure gamma. 100–250 keV. A half-life of hours.** Beta emission deposits dose without ever reaching the camera — the ideal diagnostic agent has none. Match the half-life to the study and the energy to the crystal.' },
      { hot: true, t: 'Gamma camera: NaI(Tl), photoelectric capture, PHA window', d: '**NaI(Tl)** — the thallium activates the crystal’s light output — capturing gammas by **photoelectric absorption**. The **pulse height analyser** throws away the scattered, lower-energy photons, and overlapping photomultiplier tubes **triangulate** each flash.' },
      { hot: true, t: 'The collimator forms the image — resolution costs sensitivity', d: '**The collimator forms the image**, and every gain in resolution is paid in sensitivity: longer, narrower holes sharpen; a thicker crystal sees more but blurs. Get the patient **close to the collimator**. Intrinsic resolution 3–5 mm — system resolution realistically **10–15 mm**. Field of view is set by crystal size.' },
      { hot: true, t: 'PET: two 511 keV photons, ~180° apart, no collimator', d: 'Annihilation sends out **two 511 keV photons, back-to-back at ~180°** — and **electronic coincidence replaces the collimator**, which is exactly why PET’s sensitivity crushes SPECT. Resolution is 4–8 mm, limited by positron range and non-collinearity; time-of-flight timing runs on the speed of light.' },
      { hot: true, t: 'Dose is committed the moment you inject', d: '**The dose is committed at injection** — physical half-life and biological clearance decide it, and nothing else does. An extra hour under the camera adds **precisely zero**. Longer half-life or slower clearance: more dose.' },
      { t: 'SPECT beats planar on contrast, not resolution', d: 'SPECT wins on **contrast, not resolution**: 3D reconstruction strips away the over- and underlying activity. The price — centre-of-rotation and attenuation artefacts from the rotating camera, and generally more dose.' },
      { t: 'SUV is useful — and easily fooled', d: 'SUV normalises uptake for injected activity and body weight — and is **fooled by scanner, uptake time and blood glucose**. Around **2.5** suggests malignancy, but SUV alone **cannot separate inflammation from tumour**.' },
      { t: 'I-123 is the imaging iodine', d: 'The **imaging** iodine: cyclotron-produced, electron capture, **159 keV, 13 hours** — no beta, low dose, made for the camera. And remember: recent iodinated CT contrast blocks uptake and **sabotages the study**.' },
      { t: 'No lead aprons in PET', d: 'Lead barely notices **511 keV** — an apron mostly manufactures scatter, bremsstrahlung and false confidence. The real protections are **distance and time**. Detector dead time must stay short for dynamic studies.' },
      { t: 'BGO stops photons; it is not fast', d: 'BGO earned its place through **sheer density and stopping power** at 511 keV — and that is all. On decay speed, **NaI and LSO both beat it**.' },
      { t: 'F-18 is made by proton bombardment', d: '**Proton bombardment, in a cyclotron** — proton-rich nuclides are cyclotron products. And cyclotrons are major regional installations, not standard hospital kit.' },
    ],
  },
  {
    id: 'protection',
    name: 'Radiation protection & legislation',
    tag: 'RP',
    icon: 'shield',
    blurb: 'Roles, thresholds and risk numbers. Pure memorisation — and among the most reliable marks on the paper.',
    heat: 5,
    facts: [
      { hot: true, t: 'The four IRMER roles — keep them straight', d: '**Referrer** supplies the clinical information. **Practitioner** justifies — any entitled registered healthcare professional, **not necessarily a doctor**. **Operator** optimises and keeps dose ALARP. **Employer** owns the framework and the DRLs. Four roles — the marks are in never swapping them.' },
      { hot: true, t: 'Stochastic has no threshold; deterministic does', d: '**Stochastic: no threshold** — cancer and hereditary risk exist at any dose, however small. **Deterministic: threshold** — skin erythema at **2–5 Gy**, cataract at just **0.5 Gy**. The lens is far more radiosensitive than the cornea.' },
      { hot: true, t: 'Fatal cancer risk ≈ 1 in 20,000 per mSv', d: '**≈ 1 in 20,000 per mSv** — the ICRP nominal coefficient. Children run higher (about **1 in 13,000**); hereditary risk is far lower than either. A quoted “1 in 300 per mSv” is wrong by **two orders of magnitude**.' },
      { hot: true, t: 'Controlled area: likely to exceed 6 mSv per year', d: 'The number is **6 mSv per year** — not 1, not 3. The Employer designates it in consultation with the **Radiation Protection Adviser**, and non-classified staff may still enter under a **written system of work**.' },
      { t: 'Pregnancy: 1 mSv to the fetus after written declaration', d: 'From the written declaration: **1 mSv to the fetus** for the remainder of the pregnancy, plus a duty on the Employer to risk-assess. It does **not** automatically ban fluoroscopy or nuclear medicine work — shielding that keeps doses compliant keeps the job.' },
      { t: 'Dose records: age 75, or 30 years', d: 'Classified workers’ records are kept **until the person turns 75, or at least 30 years** after the exposure ceased — whichever is longer. **Not indefinitely.**' },
      { t: 'Effective dose = Σ (organ dose × tissue weighting factor)', d: '**Effective dose = Σ (organ dose × wT)** — a partial-body exposure converted into the whole-body dose carrying the **same stochastic risk**. Active bone marrow outweighs bone surface.' },
      { t: 'Benchmark doses worth memorising', d: '**CT head 1–3 mSv · CT abdomen/pelvis 5–10 mSv · bone scan ~4 mSv.** And the overexposure multipliers shrink as the intended dose grows: small exposures need **~10×** to become reportable, big ones only **~2.5×**.' },
      { t: 'Know your dosimeters', d: '**Film badges** split beta from gamma with filters. **TLD rings** watch finger dose from a threshold near 0.05 mSv. **Electronic dosimeters** give interventional staff their dose in real time.' },
      { t: 'Radioactive waste answers to environmental agencies', d: '**All of it answers to the environmental agencies** — gaseous releases and patient excreta included. Solid waste sits in decay storage (**roughly ten half-lives**); sewer disposal is strictly limited; **ARSAC** licenses administration — and breastfeeding usually continues uninterrupted after diagnostic Tc-99m.' },
    ],
  },
]

/* ---------- page ---------- */

const heatLabel = (h: number) => h >= 5 ? 'Very high yield' : h === 4 ? 'High yield' : 'Solid yield'

/** Fact explanations mark their load-bearing keywords with **…** — this
    renders them as emphasised spans so the key idea shines in the sentence. */
/* A fact is written as one or more paragraphs separated by a blank line, with
   **bold** for the terms that carry the mark. Blank lines matter: the longer
   facts walk through a concept a beat at a time (what owns it → why → what the
   machine assumes → what follows), and that only reads as steps if the steps
   are actually separate paragraphs rather than one collapsed block. */
function FactText({ text }: { text: string }) {
  return <>{text.split('\n\n').map((para, p) => {
    const parts = para.split('**')
    return <p key={p}>{parts.map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part)}</p>
  })}</>
}

function TopicSection({ topic }: { topic: FactTopic }) {
  const ordered = [...topic.facts.filter(f => f.hot), ...topic.facts.filter(f => !f.hot)]
  return <section className="fb-topic" id={topic.id}>
    <div className="fb-topic-head">
      <div className="fb-topic-ident">
        <div className={`fb-orb fb-orb-${topic.id}`}><FbIcon name={topic.icon} size={22}/></div>
        <div>
          <div className="fb-topic-meta"><span className="fb-tag">{topic.tag}</span><span className="fb-count">{topic.facts.length} facts · {topic.facts.filter(f => f.hot).length} high-yield</span></div>
          <h2>{topic.name}</h2>
          <p>{topic.blurb}</p>
        </div>
      </div>
      <div className="fb-topic-side">
        <div className={`heat-meter heat-${topic.heat}`} title={heatLabel(topic.heat)}>
          <span className="heat-label"><FbIcon name="flame" size={14}/>{heatLabel(topic.heat)}</span>
          <div className="heat-cells">{[1, 2, 3, 4, 5].map(i => <i key={i} className={i <= topic.heat ? 'on' : ''}></i>)}</div>
        </div>
        {topic.lab && <Link className="fb-lab-link" to={topic.lab.to}><FbIcon name="flask" size={15}/>{topic.lab.label}<FbIcon name="arrow" size={14}/></Link>}
      </div>
    </div>
    {topic.extra}
    <div className="fb-grid">
      {ordered.map(fact => <article key={fact.t} className={fact.hot ? 'fb-card hot' : 'fb-card'}>
        {fact.hot && <span className="fb-hot-badge"><FbIcon name="flame" size={12}/>High-yield</span>}
        <h3>{fact.t}</h3>
        <FactText text={fact.d} />
        {fact.visual}
      </article>)}
    </div>
  </section>
}

export function FactBankPage() {
  const [query, setQuery] = useState('')
  const totals = useMemo(() => ({
    facts: factTopics.reduce((n, t) => n + t.facts.length, 0),
    hot: factTopics.reduce((n, t) => n + t.facts.filter(f => f.hot).length, 0),
  }), [])

  const q = query.trim().toLowerCase()
  const visibleTopics = useMemo(() => {
    if (!q) return factTopics
    return factTopics
      .map(t => ({ ...t, extra: undefined, facts: t.facts.filter(f => (f.t + ' ' + f.d).toLowerCase().includes(q)) }))
      .filter(t => t.facts.length > 0)
  }, [q])

  const matchCount = visibleTopics.reduce((n, t) => n + t.facts.length, 0)

  const hottest: [string, string][] = [
    ['Compton scatter', 'xray'], ['Chemical shift', 'mri'], ['The Doppler equation', 'us'], ['CT pitch', 'ct'],
    ['Tc-99m', 'nm'], ['IRMER roles', 'protection'], ['MI & TI limits', 'us'], ['DSA and SNR', 'fluoro'],
    ['Spin echo vs GRE', 'mri'], ['Hounsfield units', 'ct'],
  ]

  return <main className="fact-bank">
    <section className="page-hero section-dark fb-hero">
      <div className="noise"></div>
      <div className="container">
        <div className="eyebrow"><FbIcon name="flame" size={15}/>The Fact Bank</div>
        <h1>The facts that<br/><span>decide marks.</span></h1>
        <p>Eight topics, each a branch of distilled, exam-critical facts. Pick a topic — the concepts flagged as high-yield come up again and again: know them cold.</p>
        <div className="fb-hero-stats">
          <div><strong>{factTopics.length}</strong><span>topics</span></div>
          <div><strong>{totals.facts}</strong><span>core facts</span></div>
          <div className="hot"><strong>{totals.hot}</strong><span>high-yield</span></div>
        </div>
        <div className="fb-hot-strip" aria-label="Most important concepts">
          <span className="fb-hot-strip-label"><FbIcon name="bolt" size={14}/>Heaviest hitters</span>
          {hottest.map(([label, id]) => <Link key={label} to={`/fact-bank/${id}`}><FbIcon name="flame" size={12}/>{label}</Link>)}
        </div>
      </div>
    </section>

    <div className="fb-toolbar">
      <div className="container fb-toolbar-inner">
        <p className="fb-toolbar-hint">Choose a topic below — or search across all {totals.facts} facts.</p>
        <label className="fb-search">
          <FbIcon name="search" size={16}/>
          <input type="search" placeholder="Search the facts…" value={query} onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)} aria-label="Search facts"/>
        </label>
      </div>
    </div>

    <div className="container fb-body">
      {q
        ? <>
            <p className="fb-results" role="status">{matchCount === 0 ? 'No facts match that search — try a broader term.' : `${matchCount} fact${matchCount === 1 ? '' : 's'} matching “${query.trim()}”`}</p>
            {visibleTopics.map(topic => <TopicSection key={topic.id} topic={topic}/>)}
          </>
        : <div className="fb-index" aria-label="Fact bank topics">
            {factTopics.map(topic => <TopicIndexCard key={topic.id} topic={topic}/>)}
          </div>}
    </div>

    <FbCta/>
  </main>
}

/** One branch of the hub: a topic card linking to its own facts page. */
function TopicIndexCard({ topic }: { topic: FactTopic }) {
  const hot = topic.facts.filter(f => f.hot).length
  return <Link to={`/fact-bank/${topic.id}`} className="fb-index-card">
    <div className={`fb-orb fb-orb-${topic.id}`}><FbIcon name={topic.icon} size={22}/></div>
    <div className="fb-index-main">
      <div className="fb-topic-meta"><span className="fb-tag">{topic.tag}</span><span className="fb-count">{topic.facts.length} facts · {hot} high-yield</span></div>
      <h2>{topic.name}</h2>
      <p>{topic.blurb}</p>
    </div>
    <div className="fb-index-side">
      <div className={`heat-meter heat-${topic.heat}`}>
        <span className="heat-label"><FbIcon name="flame" size={13}/>{heatLabel(topic.heat)}</span>
        <div className="heat-cells">{[1, 2, 3, 4, 5].map(i => <i key={i} className={i <= topic.heat ? 'on' : ''}></i>)}</div>
      </div>
      <span className="fb-index-arrow" aria-hidden="true"><FbIcon name="arrow" size={18}/></span>
    </div>
  </Link>
}

/** A single topic branch: /fact-bank/:topicId */
export function FactTopicPage() {
  const { topicId } = useParams()
  const topic = factTopics.find(t => t.id === topicId)
  if (!topic) return <Navigate to="/fact-bank" replace/>
  return <FactTopicReader key={topic.id} topic={topic}/>
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/**
 * The topic reader: three facts per screen, in large type, each one arriving
 * as the reader scrolls — then Next for the following trio. The final screen
 * shows every fact together (the classic grid) as the recap.
 */
function FactTopicReader({ topic }: { topic: FactTopic }) {
  const ordered = useMemo(
    () => [...topic.facts.filter(f => f.hot), ...topic.facts.filter(f => !f.hot)],
    [topic],
  )
  const idx = factTopics.indexOf(topic)
  const prevTopic = factTopics[(idx + factTopics.length - 1) % factTopics.length]
  const nextTopic = factTopics[(idx + 1) % factTopics.length]
  // The crossfade maths that drove the old pinned trio-reader (opacity/offset
  // per fact, active index, progress bar) went with it when the topic page
  // became a single scrolling column; `trio`/`pages` are kept because the
  // parked reader below still references them.

  return <main className="fact-bank fb-topic-page">
    <div className="fb-toolbar">
      <div className="container fb-toolbar-inner">
        <Link to="/fact-bank" className="fb-crumb"><FbIcon name="arrow" size={14}/>All topics</Link>
        <nav className="fb-topic-nav" aria-label="Fact bank topics">
          {factTopics.map(t => (
            <Link key={t.id} to={`/fact-bank/${t.id}`} className={t.id === topic.id ? 'active' : `nav-heat-${t.heat}`}>
              {t.heat >= 5 && t.id !== topic.id && <FbIcon name="flame" size={12}/>}{t.tag}
            </Link>
          ))}
        </nav>
      </div>
    </div>

    {/* One fact per full-width block, read straight down. The trio-per-screen
        reader pinned three facts at a time and paged between them; scrolling
        one column is how people actually revise, and it lets a fact be as
        long as it needs to be without competing for the screen. */}
    <div className="container fbr-vertical">
      <ol className="fbr-list">
        {ordered.map((fact, i) => (
          <li key={fact.t} className={fact.hot ? 'fbr-row hot' : 'fbr-row'}>
            <span className="fbr-num">{String(i + 1).padStart(2, '0')}</span>
            <div className="fbr-row-body">
              <h3>
                {fact.hot && <span className="fbr-hot"><FbIcon name="flame" size={12}/>High-yield</span>}
                {fact.t}
              </h3>
              <FactText text={fact.d}/>
              {fact.visual}
            </div>
          </li>
        ))}
      </ol>

      {/* End of the topic: read it again, or move to the next fact bank. */}
      <section className="fbr-end">
        <p className="fbr-end-kicker">End of {topic.name} · {ordered.length} facts</p>
        <h2>Read it again, or move on.</h2>
        <div className="fbr-end-actions">
          <button
            type="button"
            className="button button-ghost"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            ↺ Read again
          </button>
          <Link to={`/fact-bank/${nextTopic.id}`} className="button button-primary">
            Next fact bank: {nextTopic.name} →
          </Link>
        </div>
        <nav className="fb-pn" aria-label="Neighbouring topics">
          <Link to={`/fact-bank/${prevTopic.id}`}><span>← Previous</span><strong>{prevTopic.name}</strong></Link>
          <Link to={`/fact-bank/${nextTopic.id}`} className="fb-pn-next"><span>Next →</span><strong>{nextTopic.name}</strong></Link>
        </nav>
      </section>
    </div>

  </main>
}

function FbCta() {
  return <section className="section fb-cta-band section-dark">
    <div className="container fb-cta-inner">
      <div>
        <div className="eyebrow"><FbIcon name="flask" size={15}/>See it move</div>
        <h2>A fact you can <span>manipulate</span> is a fact you keep.</h2>
        <p>Most of these facts have a home in the Visual Lab — change the variable, watch the physics respond, and the sentence above becomes intuition.</p>
      </div>
      <Link to="/visual-lab" className="button button-primary">Enter the visual lab <FbIcon name="arrow" size={17}/></Link>
    </div>
  </section>
}
