/**
 * Topic 02 — Digital radiography.
 *
 * Follows the exemplar shape of xray.tsx: sections are the teaching units,
 * kw regexes bind the question pool (this topic has no visualTags), concepts
 * feed question feedback, essentials are the night-before list.
 *
 * Scientific content cross-checked against the V1 digital lesson (labs/digital)
 * and the fact bank. Conditional statements keep their conditions — smaller
 * pixels cost per-pixel SNR only at fixed FOV and dose, and sharper (MTF) is
 * not the same as more dose-efficient (DQE).
 */

import type { V2Topic } from '../types'
import { PixelMatrix } from '../components/sims/PixelMatrix'
import { CrReaderStages, DrConversionStacks } from '../components/sims/CrReader'

export const DIGITAL: V2Topic = {
  id: 'digital',
  num: 2,
  title: 'Digital radiography',
  short: 'Digital',
  tagline: 'Catch the photons, turn them into numbers, and keep the numbers honest about dose.',
  qbTopics: ['Digital Imaging'],
  outcomes: [
    'how a CR plate stores an exposure and gives it back to a red laser',
    'the two flat-panel routes from photon to charge, and why direct conversion is sharper but not automatically more dose-efficient',
    'the pixel, matrix and bit-depth arithmetic behind resolution, file size and noise',
    'why a digital image can look perfect at the wrong dose, and which number tells the truth',
    'what MTF and DQE each measure, and which one is the dose-efficiency figure',
  ],
  sections: [
    {
      id: 'cr',
      title: 'Computed radiography',
      blurb: 'A phosphor plate that remembers the exposure until a laser asks for it back.',
      kw: /photostimulable|storage phosphor|\bCR\b|computed radiograph|barium fluor|BaFBr|red laser|blue light|photomultiplier|latent image|plate reader|erasure|fading/i,
      primer: [
        {
          kind: 'principle',
          text: 'A CR plate stores the exposure as trapped electrons in a photostimulable phosphor; a scanning red laser releases them, the plate answers in blue light, and a photomultiplier tube turns that light into the image.',
        },
        {
          kind: 'prose',
          text: 'The plate is a **photostimulable phosphor** — barium fluorohalide (BaFBr), europium-doped. Absorbed X-rays promote electrons into **metastable traps**, and that trapped pattern **is** the latent image. The phosphor is a continuous sheet: **there are no pixels until it is read**.\n\nIn the reader, a **red laser** rasters across the plate. Each trapped electron it releases falls back and emits **blue light**, collected point by point by a **photomultiplier tube** and digitised. The stimulating and emitted colours must differ so a filter can separate them — that separation is what makes a storage phosphor readable at all.\n\nThe traps leak from the moment of exposure. A few hours is fine; **half a day to a week means severe fading**. After readout the plate is **flooded with bright white light** to empty every trap — erased and ready for thousands of reuses. Plates die of mechanical wear and laser desensitisation, not of a fixed exposure count.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <CrReaderStages />,
            title: 'The CR reader, assembled one part at a time',
            annotation: 'red in · blue out · PMT',
            caption:
              'The laboratory’s own reader, built in front of you. Step through the seven stages in order — plate, laser and mirror, blue light, light guide and PMT, ADC, erase lamp — and each one adds the next component to the machine while everything already taught stays on screen. The last stage runs the whole reader on a loop: watch one line of image appear per sweep, and the flood lamp wipe the plate when the last line lands.',
          },
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Phosphor', value: 'barium fluorohalide (BaFBr:Eu)' },
            { label: 'Stimulation / emission', value: 'red laser in · blue light out · PMT reads' },
            { label: 'Read within', value: 'a few hours — severe fading by half a day to a week' },
            { label: 'Erasure', value: 'bright white light floods the traps' },
          ],
        },
        {
          kind: 'trap',
          text: 'Caesium iodide belongs to indirect DR panels and image-intensifier input phosphors — never to CR. A stem that puts CsI in a CR plate is wrong.',
        },
        {
          kind: 'detail',
          summary: 'Why the readout, not the plate, draws the pixel grid',
          text: 'The phosphor is continuous; the pixel grid is imposed by sampling. Pixel pitch is set by the laser spot size and the sampling interval of the reader, so the same plate scanned on a finer raster yields a larger matrix. It is the cleanest illustration that in digital imaging the sampling — not the detector material — defines the pixels.',
        },
      ],
    },
    {
      id: 'panels',
      title: 'Flat-panel DR: indirect and direct',
      blurb: 'Two routes from photon to charge — one through light, one straight down.',
      kw: /flat.?panel|c(a)?esium iodide|\bCsI\b|scintillat|photodiode|\bTFT\b|thin.?film|amorphous|selenium|a.?Se\b|direct (conversion|digital|DR)|indirect/i,
      primer: [
        {
          kind: 'principle',
          text: 'Indirect panels convert twice — X-ray to light in a caesium iodide scintillator, light to charge in a photodiode — while direct panels convert once, X-ray straight to charge in amorphous selenium.',
        },
        {
          kind: 'prose',
          text: '**Indirect DR**: a **CsI scintillator** turns each absorbed X-ray into a burst of light, and an amorphous-silicon **photodiode/TFT array** underneath turns the light into stored charge, read out row by row through the thin-film transistor switches. CsI is grown as **columnar needles** that guide the light downwards like fibre optics, limiting the sideways spread that would otherwise blur every edge.\n\n**Direct DR**: a layer of **amorphous selenium** is a photoconductor — the X-ray creates electron–hole pairs directly, and an applied bias field pulls the charge **straight down** to the pixel electrodes. No light step, no lateral spread: direct conversion is **intrinsically sharp**.\n\nEither way the panel is a rigid matrix with no electron optics, so the geometric distortions of image intensifiers — pincushion, S-distortion — are **physically impossible**, not merely rare.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DrConversionStacks />,
            title: 'One photon, two stacks',
            annotation: 'CsI → light → charge  ·  a-Se → charge',
            caption:
              'Watch the same X-ray land on each panel. On the left it becomes light first, and the light spreads a little sideways on its way down to the photodiodes; on the right it becomes charge at once and the bias field marches it straight down. The proof is the pair of signal profiles at the bottom — compare their widths: one conversion fewer is one blur fewer.',
          },
        },
        {
          kind: 'compare',
          title: 'The two panels',
          a: 'Indirect (CsI + photodiode)',
          b: 'Direct (a-Se)',
          rows: [
            ['Conversions', 'two: X-ray → light → charge', 'one: X-ray → charge'],
            ['Blur source', 'light spread, tamed by columnar CsI', 'none — charge drifts down the field lines'],
            ['Absorber', 'CsI — K-edges 33/36 keV, well matched to the beam', 'a-Se — Z 34, K-edge 12.7 keV, best at low energies'],
            ['Home ground', 'general radiography and fluoroscopy', 'mammography'],
          ],
        },
        {
          kind: 'trap',
          text: 'Direct and indirect name the conversion chain, not the readout timing — both panels are read immediately by the TFT array. Only CR is read later, in a separate reader.',
        },
        {
          kind: 'detail',
          summary: 'Sharper is not the same as more dose-efficient',
          text: 'MTF and DQE part company here. a-Se wins on MTF — no light to spread. But DQE also needs absorption, and at general radiography energies selenium (K-edge 12.7 keV) captures a smaller fraction of the beam than CsI (K-edges 33 and 36 keV). So CsI panels usually carry the higher DQE in general work, while selenium’s sharpness and low-energy absorption make it the natural mammography detector.',
        },
      ],
    },
    {
      id: 'sampling',
      title: 'Pixels, matrix and bit depth',
      blurb: 'The arithmetic that sets resolution, file size and noise.',
      kw: /pixel|matrix|bit.?depth|grey.?level|gray.?level|nyquist|sampl|alias|file size|storage|kilobyte|megabyte|field of view/i,
      primer: [
        {
          kind: 'principle',
          text: 'Pixel size = field of view ÷ matrix; grey levels = 2^bit depth; storage scales with the square of the matrix side — and spatial resolution can never beat the sampling.',
        },
        {
          kind: 'prose',
          text: 'At a **fixed field of view**, a larger matrix means smaller pixels, and smaller pixels raise the ceiling on spatial resolution: the finest representable frequency is the **Nyquist limit, 1/(2 × pixel size)**. Pixels of 0.1 mm can carry at most 5 lp/mm — and detail beyond Nyquist does not vanish politely, it folds back into the image as **aliasing**.\n\nThe bill arrives twice. Storage grows with the **square** of the matrix side and linearly with bit depth: double the matrix side and the file **quadruples**. And at fixed field of view and fixed dose, each smaller pixel catches **fewer photons**, so per-pixel noise rises — matrix size is bought with PACS space and SNR together.\n\n**Bit depth** is a different axis entirely: bits grade each pixel’s signal (2^bits grey levels), serving contrast and dynamic-range representation. More bits never sharpen anything.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <PixelMatrix/>,
            title: 'Matrix, pixel size and noise',
            annotation: 'fixed FOV · fixed dose',
            caption: 'Raise the matrix at a fixed field of view: the line pairs resolve while the same dose, spread over smaller pixels, turns to mottle. Then raise the dose and watch the noise fall as the square root.',
          },
        },
        {
          kind: 'relationship',
          title: 'What each choice changes',
          rows: [
            { change: 'Matrix ↑ (fixed FOV)', effect: 'smaller pixels — resolution ceiling ↑, storage ↑ (∝ n²), photons per pixel ↓ so per-pixel SNR ↓ at fixed dose' },
            { change: 'FOV ↑ (fixed matrix)', effect: 'larger pixels — resolution ceiling ↓' },
            { change: 'Bit depth ↑', effect: 'more grey levels — finer intensity grading, larger files, no change to sharpness' },
          ],
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Pixel size', value: 'FOV ÷ matrix' },
            { label: 'Nyquist limit', value: '1 / (2 × pixel size) — 0.1 mm pixels → 5 lp/mm' },
            { label: 'Typical general-DR pixel pitch', value: '125–200 µm → limiting resolution ≈ 2.5–4 lp/mm' },
            { label: 'Grey levels', value: '2^bits — 12 bits = 4096' },
            { label: 'One 512² image at 12 bits', value: '≈ 400–500 kB' },
          ],
        },
        {
          kind: 'trap',
          text: 'Doubling the matrix side does not double the storage — it quadruples it: 512² → 1024² is four times the pixels.',
        },
      ],
    },
    {
      id: 'latitude',
      title: 'Dynamic range and dose creep',
      blurb: 'What digital buys over film — and the silent price.',
      kw: /dynamic range|latitude|exposure ind|deviation index|dose creep|over.?expos|under.?expos|\bfilm\b|s.?curve|characteristic curve|\bAEC\b|automatic exposure/i,
      fallback: true,
      primer: [
        {
          kind: 'principle',
          text: 'A digital detector responds linearly across a huge exposure range, so processing rescues almost any exposure — which is exactly why a good-looking image proves nothing about dose.',
        },
        {
          kind: 'prose',
          text: 'Film had a narrow S-shaped characteristic curve: useful contrast lived on the steep middle, and an exposure that missed it left an image too pale or too black to save. A digital detector is **linear over roughly four orders of magnitude** — against a useful film-screen latitude of around two — and the display system windows whatever arrives, so the image looks right almost regardless of exposure.\n\nThat forgiveness cuts both ways. **Underexposure** at least declares itself as quantum mottle. **Overexposure looks perfect** — the classic route to **dose creep**, exposures drifting upward because nothing on the screen ever objects. The only witness is the **exposure indicator**: the manufacturers’ proprietary indices, standardised by the IEC as an **exposure index** (EI) with a **deviation index** against the target.\n\nSo **AEC still matters** in digital imaging. Its job is unchanged: enough dose to beat mottle, no more than justification allows.',
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Digital dynamic range', value: '≈ 10⁴ : 1, linear response' },
            { label: 'Film-screen useful latitude', value: '≈ 10² : 1, S-curve' },
            { label: 'Underexposure shows as', value: 'quantum mottle' },
            { label: 'Overexposure shows as', value: 'nothing visible — only the exposure indicator' },
          ],
        },
        {
          kind: 'trap',
          text: '“The detector will cope” is how dose creep starts — a well-windowed digital image carries no visible evidence of overexposure. Check the exposure indicator, not the brightness.',
        },
        {
          kind: 'detail',
          summary: 'The deviation index, quantified',
          text: 'DI = 10 × log₁₀(EI / EI target). Zero means on target; +3 means roughly double the intended detector dose, −3 roughly half. It is the number that turns “watch the exposure indicator” into an auditable habit.',
        },
      ],
    },
    {
      id: 'quality',
      title: 'MTF, DQE and noise',
      blurb: 'Quality written as curves: what survives, and at what dose.',
      kw: /\bMTF\b|modulation transfer|\bDQE\b|detective quantum|quantum mottle|\bSNR\b|signal.?to.?noise|spatial frequenc|line pairs|lp\/?mm|limiting resolution|\bnoise\b/i,
      primer: [
        {
          kind: 'principle',
          text: 'MTF says how much contrast survives at each spatial frequency; DQE says how efficiently the detector turns the dose it receives into image SNR. Together they are the honest description of a detector.',
        },
        {
          kind: 'prose',
          text: 'The **modulation transfer function** plots the fraction of subject contrast that survives against spatial frequency. It starts at 1 for coarse detail and falls; every blur in the chain — focal spot, detector, motion — pulls it down, and the **system MTF is the product of its components**, so the worst link dominates. Limiting spatial resolution is conventionally read where the MTF has fallen to about **10%**.\n\nThe **detective quantum efficiency** compares information out with information in: **DQE = SNR²out / SNR²in**, a function of spatial frequency, with a perfect detector at 1. A higher-DQE detector reaches the same image quality at **lower dose** — DQE is the dose-efficiency figure, and it is where flat panels most clearly beat CR.\n\nThe noise itself is mostly **quantum mottle** — photon-counting statistics. It falls as 1/√dose, so halving the noise costs four times the exposure, whatever the detector.',
        },
        {
          kind: 'compare',
          title: 'Two curves, two questions',
          a: 'MTF',
          b: 'DQE',
          rows: [
            ['Asks', 'how faithfully does detail transfer?', 'how efficiently is dose used?'],
            ['Perfect detector', '1 at every frequency', '1 at every frequency'],
            ['Pulled down by', 'every source of blur', 'absorption losses, added noise and blur'],
            ['Buys clinically', 'sharpness', 'equal image quality at lower dose'],
          ],
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Limiting resolution convention', value: 'MTF ≈ 10%' },
            { label: 'DQE definition', value: 'SNR²out / SNR²in ≤ 1' },
            { label: 'DQE at low frequency, typical', value: 'CsI flat panel ≈ 0.6–0.7 · CR ≈ 0.2–0.3' },
            { label: 'Quantum mottle', value: '∝ 1 / √dose' },
          ],
        },
        {
          kind: 'trap',
          text: 'A high-MTF detector can still be dose-inefficient: MTF ignores noise entirely. Only DQE folds sharpness and noise into a single statement about dose.',
        },
      ],
    },
    {
      id: 'processing',
      title: 'Processing and digital artefacts',
      blurb: 'The display can be reshaped; the photon count cannot.',
      kw: /process|window|edge enhanc|histogram|smooth|dead (pixel|row|detector)|ghost|artefact|artifact|flat.?field|uniformity|interpolat/i,
      primer: [
        {
          kind: 'principle',
          text: 'Processing is display-side: windowing, edge enhancement and smoothing re-present the captured data — they can never add photons that were not detected.',
        },
        {
          kind: 'prose',
          text: 'Digital processing decouples capture from display. **Histogram analysis** finds the useful signal range, **windowing** maps it onto grey levels, **edge enhancement** lifts the high spatial frequencies and **smoothing** suppresses them. All of it reshapes presentation; none of it changes the information collected. An underexposed image keeps its **quantum mottle** whatever the processing does — edge enhancement in fact amplifies noise along with the edges.\n\nDigital detectors carry artefacts of their own. **Dead pixels** and dead rows are mapped and filled by **interpolation** from their neighbours — a cosmetic repair, not recovered signal. **Ghosting** is the residue of a previous exposure: trapped charge in a-Se panels, incomplete **erasure** in CR. And flat panels need regular **flat-field (uniformity) calibration** so that every pixel reports the same exposure the same way.',
        },
        {
          kind: 'relationship',
          title: 'What processing can and cannot do',
          rows: [
            { change: 'Windowing', effect: 'remaps grey levels — presentation contrast ↑, information unchanged' },
            { change: 'Edge enhancement', effect: 'high frequencies lifted — edges and noise amplified together' },
            { change: 'Noise smoothing', effect: 'mottle hidden at the price of fine detail' },
            { change: 'Interpolating dead pixels', effect: 'cosmetic repair — no real signal restored' },
          ],
        },
        {
          kind: 'trap',
          text: 'Processing cannot rescue SNR: if the photons were never detected, no algorithm restores the information — smoothing merely hides mottle by discarding detail.',
        },
      ],
    },
  ],
  concepts: [
    {
      id: 'cr-readout',
      title: 'CR readout',
      rule: 'A CR plate stores the exposure as electrons in metastable traps; a scanning red laser releases them, the plate emits blue light, and a photomultiplier tube reads it.',
      why: 'The stimulating and emitted wavelengths must differ so a filter can separate them — that is what makes a storage phosphor readable.',
      confusion: 'Caesium iodide is the scintillator of indirect DR and image intensifiers; CR is barium fluorohalide.',
      match: /photostimulable|storage phosphor|barium fluor|BaFBr|red laser|blue light|computed radiograph|\bCR plate/i,
    },
    {
      id: 'cr-fading',
      title: 'The latent image fades',
      rule: 'CR traps leak from the moment of exposure: read within a few hours — half a day to a week means severe fading — then erase with bright white light for reuse.',
      confusion: 'Plate life ends by mechanical wear and laser desensitisation, not by a fixed count of exposures.',
      match: /fad(e|ing)|latent image|eras(e|ure)/i,
    },
    {
      id: 'indirect-direct',
      title: 'Indirect versus direct conversion',
      rule: 'Indirect DR converts twice — X-ray to light in CsI, light to charge in a photodiode — while direct DR converts once, X-ray to charge in amorphous selenium under a bias field.',
      why: 'The light step spreads sideways (columnar CsI needles limit it), whereas drifting charge follows the field lines straight down — so direct conversion is intrinsically sharper.',
      confusion: 'Sharper is not more dose-efficient: at general radiography energies CsI absorbs more of the beam, so indirect panels usually carry the higher DQE.',
      match: /c(a)?esium iodide|\bCsI\b|selenium|a.?Se\b|scintillat|photodiode|\bTFT\b|indirect|direct conversion/i,
    },
    {
      id: 'pixel-arithmetic',
      title: 'The pixel arithmetic',
      rule: 'Pixel size = FOV ÷ matrix; grey levels = 2^bit depth; storage ∝ matrix² × bit depth — doubling the matrix side quadruples the file.',
      why: 'Pixels tile the field of view, so their count grows with the square of the side; bits multiply the cost of every pixel.',
      confusion: 'Bit depth grades intensity, not sharpness — more grey levels never improve spatial resolution.',
      match: /pixel size|\bmatrix\b|bit.?depth|grey.?level|gray.?level|file size|storage|megabyte|kilobyte/i,
    },
    {
      id: 'nyquist',
      title: 'The Nyquist limit',
      rule: 'A sampled image cannot represent spatial frequencies above 1/(2 × pixel size); detail beyond that folds back into the image as aliasing.',
      why: 'Two samples per cycle is the minimum needed to record a variation at all.',
      match: /nyquist|alias|sampling (frequency|limit|interval)|limiting (spatial )?resolution/i,
    },
    {
      id: 'dose-creep',
      title: 'Dynamic range and dose creep',
      rule: 'A digital detector is linear across a wide dynamic range, so display brightness is decoupled from exposure — overexposure looks perfect, and only the exposure indicator shows it.',
      why: 'Processing windows whatever signal arrives; the image carries no visible evidence of excess dose.',
      confusion: 'Underexposure is not silent — it shows as quantum mottle. It is overexposure that hides.',
      match: /dynamic range|latitude|dose creep|exposure ind|deviation index|over.?expos/i,
    },
    {
      id: 'mtf',
      title: 'MTF',
      rule: 'MTF is the fraction of contrast surviving at each spatial frequency: 1 is perfect, every blur pulls it down, and the system MTF is the product of its components.',
      confusion: 'MTF says nothing about noise — a sharp detector can still waste dose.',
      match: /\bMTF\b|modulation transfer|spatial frequenc/i,
    },
    {
      id: 'dqe',
      title: 'DQE',
      rule: 'DQE = SNR²out / SNR²in as a function of spatial frequency: how efficiently the detector turns dose into image quality, with a perfect detector at 1.',
      why: 'A higher-DQE detector reaches the same image SNR at lower dose — it is the dose-efficiency figure of merit.',
      match: /\bDQE\b|detective quantum/i,
    },
    {
      id: 'processing-limit',
      title: 'Processing cannot add information',
      rule: 'Windowing, edge enhancement and smoothing re-present captured data; they can never restore photons that were not detected.',
      confusion: 'Smoothing hides mottle by discarding detail — SNR is fixed at exposure, not at the workstation.',
      match: /window|edge enhanc|smooth|post.?process|processing|histogram/i,
    },
  ],
  essentials: [
    'CR = photostimulable barium fluorohalide (BaFBr): the trapped electrons are the latent image, and pixels exist only at readout.',
    'CR readout: red laser in, blue light out, photomultiplier tube collects; bright white light erases the plate for reuse.',
    'Read CR plates within a few hours — fading starts at exposure; half a day to a week means severe degradation.',
    'Indirect DR: CsI scintillator → light → photodiode/TFT — two conversions; columnar CsI needles guide the light down and limit spread.',
    'Direct DR: amorphous selenium → charge under a bias field — one conversion, no light spread, intrinsically sharp; at home in mammography.',
    'Flat panels have no electron optics, so pincushion and S-distortion are physically impossible.',
    'Pixel size = FOV ÷ matrix; Nyquist limit = 1/(2 × pixel size) — 0.1 mm pixels give 5 lp/mm.',
    'Grey levels = 2^bits; storage ∝ matrix² × bit depth — doubling the matrix side quadruples the file (512² at 12 bits ≈ 400–500 kB).',
    'Digital response is linear over ≈10⁴:1; film’s S-curve gave ≈10²:1 — that latitude is what digital buys.',
    'Overexposure looks perfect after processing — dose creep — so the exposure indicator, not the image, is the witness; AEC still matters.',
    'MTF = contrast surviving at each spatial frequency, limiting resolution at ≈10%; DQE = SNR²out/SNR²in ≤ 1 — the dose-efficiency figure.',
    'Processing is display-side and can never add photons: an underexposed image keeps its quantum mottle whatever the algorithm.',
  ],
  labs: [{ label: 'CR & digital radiography — the guided lesson', to: '/xray-lab/digital' }],
}
