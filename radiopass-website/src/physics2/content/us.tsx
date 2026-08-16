/**
 * Topic 08 — Ultrasound.
 *
 * Follows the exemplar shape (xray.tsx): sections teach, tags/kw bind the
 * question pool, concepts feed question feedback, essentials are the
 * night-before list.
 *
 * Scientific content cross-checked against the V1 ultrasound engine
 * (US_FACTS, US_RELATIONS, US_TABLES) and the fact bank. Conditional
 * statements keep their conditions — lowering the transmit frequency fixes
 * aliasing by shrinking the shift, not by raising the Nyquist limit; heating
 * is greatest superficially only in uniform soft tissue — nothing is
 * simplified into a wrong absolute.
 */

import type { V2Topic } from '../types'
import { FreqPenetration } from '../components/sims/FreqPenetration'
import { DopplerAliasing } from '../components/sims/DopplerAliasing'

export const US: V2Topic = {
  id: 'us',
  num: 8,
  title: 'Ultrasound',
  short: 'US',
  tagline: 'Make a pressure wave, time its echoes, read the shifts — and know which assumption broke when the image lies.',
  qbTopics: ['Ultrasound'],
  outcomes: [
    'why the medium owns the speed of sound, and what the scanner’s 1540 m/s assumption silently builds into every image',
    'what happens at an interface — reflection from the impedance mismatch, refraction from a speed difference — and why gel exists',
    'the resolution trio, and the frequency-versus-penetration trade that decides every probe choice',
    'the Doppler equation’s four inputs, the cosine, and which anti-aliasing fixes genuinely work',
    'what MI and TI each warn about, and the numbers that govern contrast and obstetric scanning',
  ],
  sections: [
    {
      id: 'waves',
      title: 'The wave and its speed',
      blurb: 'A mechanical wave whose speed belongs to the tissue, not the machine.',
      tags: ['wave-frequency-period'],
      kw: /wavelength|speed of sound|velocity of (ultra)?sound|propagation (speed|velocity)|1540|longitudinal|compressib|mechanical (pressure )?wave|20 ?kHz|audible/i,
      primer: [
        {
          kind: 'principle',
          text: 'Ultrasound is a mechanical longitudinal wave. The medium sets the speed, the probe sets the frequency, and the wavelength is the quotient — λ = c / f.',
        },
        {
          kind: 'prose',
          text: 'Ultrasound is sound above the audible limit of **20 kHz** — a **mechanical pressure wave**, not electromagnetic radiation, so it cannot cross a vacuum. In tissue it travels as a **longitudinal** wave: particles oscillate parallel to the direction of travel, in alternating bands of compression and rarefaction. Diagnostic imaging uses roughly **2–15 MHz**, giving wavelengths of about **0.1–0.8 mm** — small enough to resolve millimetre anatomy.\n\nThe speed is owned entirely by the **medium** — its stiffness and density — and the scanner assumes **1540 m/s** everywhere. Bone is fast not because it is dense but because it is stiff: stiffness rises faster than density, so sound is slowest in gas and fastest in bone.\n\nTurn the frequency dial and the **wavelength** changes; the speed does not move. Every claim that “velocity depends on frequency” is testing exactly this.',
        },
        {
          kind: 'equation',
          formula: 'c = f λ · λ (mm) = 1.54 / f (MHz) in soft tissue',
          note: 'the medium owns c; the probe owns f; λ is the quotient',
        },
        {
          kind: 'numbers',
          title: 'The speed ladder',
          rows: [
            { label: 'Air', value: '≈ 330 m/s' },
            { label: 'Fat', value: '≈ 1450 m/s' },
            { label: 'Soft tissue (assumed by the scanner)', value: '1540 m/s' },
            { label: 'Muscle', value: '≈ 1580 m/s' },
            { label: 'Cortical bone', value: '≈ 4080 m/s' },
          ],
        },
        {
          kind: 'trap',
          text: 'The speed of sound does NOT depend on the transducer frequency — the most repeated ultrasound trap in the bank. And soft tissue is 1540 m/s, not 150: watch the factor-of-ten distractor.',
        },
        {
          kind: 'detail',
          summary: 'Why the speed formula carries a square root',
          text: 'c = 1/√(κρ), with κ the compressibility and ρ the density. A stiffer (less compressible) medium passes the disturbance on faster — but because the relationship is a square root, speed is not simply the reciprocal of compressibility, and doubling κ does not halve c. Compressibility and density are independent material properties, which is why the dense-means-slow intuition fails for bone.',
        },
      ],
    },
    {
      id: 'impedance',
      title: 'Impedance and interfaces',
      blurb: 'Echoes are made at boundaries — by the mismatch, never by either tissue alone.',
      tags: ['ultrasound-acoustic-impedance'],
      kw: /impedanc|rayl|reflect|refract|snell|critical angle|coupling|gel\b|interface|mismatch/i,
      primer: [
        {
          kind: 'principle',
          text: 'The fraction of the beam reflected at a boundary is set by the impedance mismatch — R = ((Z₂ − Z₁)/(Z₂ + Z₁))² — not by the absolute impedance of either tissue.',
        },
        {
          kind: 'prose',
          text: 'Acoustic impedance is **Z = ρc** — density times propagation speed, measured in **rayls**, not decibels. It needs both properties: never density alone, and never the probe frequency, which has no effect on it. Soft tissue sits near **1.63 MRayl**, air at 0.0004, cortical bone about 7.8.\n\nAn interface between similar impedances passes the beam on almost untouched: soft tissue against simple fluid reflects roughly **0.2%** — which, with fluid’s negligible attenuation, is the whole recipe for the anechoic, posteriorly enhancing cyst. The extremes are the two enemies of ultrasound. A soft tissue–air boundary reflects **over 99%**, which is why **coupling gel** exists — it displaces the air layer at the skin rather than “boosting” the beam — and why bowel gas and aerated lung end the image. Receivers are so sensitive that an echo of **1% or less** of the incident intensity is easily detected.\n\n**Refraction** is a different process with different rules. The transmitted beam bends only when it crosses obliquely into a medium with a different **speed** — Snell’s law, sin θ₁/c₁ = sin θ₂/c₂. At normal incidence there is no refraction however great the mismatch, and no amount of frequency adjustment changes it.',
        },
        {
          kind: 'equation',
          formula: 'Z = ρ c · R = ((Z₂ − Z₁) / (Z₂ + Z₁))²',
          note: 'swap the two media and R is unchanged — the mismatch is what matters',
        },
        {
          kind: 'compare',
          title: 'Two things that happen at a boundary',
          a: 'Reflection',
          b: 'Refraction',
          rows: [
            ['Governed by', 'impedance difference', 'speed difference'],
            ['Needs oblique incidence', 'no — strongest at 90° to the interface', 'yes — essential'],
            ['What happens to the energy', 'returns towards the probe', 'transmitted beam changes direction'],
            ['Frequency dependence', 'none', 'none — lowering f does not reduce it'],
          ],
        },
        {
          kind: 'trap',
          text: 'Reflection needs an impedance difference, not a density difference — and image brightness tracks the echo strength from the mismatch, not the absolute impedance of the tissue.',
        },
        {
          kind: 'detail',
          summary: 'When a critical angle exists at all',
          text: 'Total internal reflection needs the second medium to be FASTER than the first, so that sin θ₂ reaches 1 before θ₁ reaches 90°: θ_critical = arcsin(c₁/c₂), only when c₂ > c₁. Crossing from a fast medium into a slow one, no critical angle exists at any incidence. Diagrams offering a critical angle for every tissue pair are wrong.',
        },
      ],
    },
    {
      id: 'attenuation',
      title: 'Attenuation and compensation',
      blurb: 'What the tissue takes on the way, and what the machine gives back on the way out.',
      kw: /attenuat|absorption|dB\/cm|time.?gain|TGC|penetrat|output power|receiver gain|acoustic window/i,
      primer: [
        {
          kind: 'principle',
          text: 'Soft tissue attenuates at roughly 0.5–1 dB/cm/MHz: loss grows with both depth and frequency, and absorption — not reflection or scatter — does most of the taking.',
        },
        {
          kind: 'prose',
          text: 'Attenuation is exponential — a fixed **fraction** lost per centimetre, not a fixed amount — which becomes a straight line when expressed in decibels: **attenuation (dB) = α × f (MHz) × path (cm)**. The soft-tissue coefficient is **0.5–1.0 dB/cm/MHz**, with **0.5** the usual single figure to carry; remember an echo makes the **round trip**, so the working loss is about **1 dB/cm/MHz of depth** — twice the one-way coefficient. The frequency term is the entire penetration problem: double the frequency and every centimetre costs twice as much.\n\nMost of the loss is **absorption** — acoustic energy converted to heat, which is where the safety story begins. Attenuation has **no relationship to acoustic impedance**: water matches tissue in impedance yet attenuates almost nothing, which is why a full bladder makes a good acoustic window. Lung and bone attenuate savagely.\n\n**Time gain compensation** applies depth-dependent receive amplification so identical reflectors look equally bright at every depth. It is purely a **receive-side** correction: it brightens late echoes (and the noise with them) without changing the transmitted beam. **Output power** is the transmit-side control — more energy into the patient, better signal-to-noise, and higher MI and TI. Optimise gain, TGC, frequency, focus and depth before reaching for power.',
        },
        {
          kind: 'relationship',
          title: 'What each lever changes',
          rows: [
            { change: 'Frequency ↑', effect: 'attenuation ↑ per cm — penetration ↓ (resolution ↑ is the other side of the trade)' },
            { change: 'Depth ↑', effect: 'more path, more loss — deep echoes approach the noise floor' },
            { change: 'TGC / receiver gain ↑', effect: 'deep echoes brighter, noise amplified equally — patient exposure unchanged' },
            { change: 'Output power ↑', effect: 'stronger echoes, better SNR, more penetration — MI and TI rise' },
          ],
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Soft-tissue attenuation coefficient', value: '≈ 0.5 dB/cm/MHz one-way (≈ 1 round trip)' },
            { label: 'The decibel model', value: 'dB lost = α × f × path' },
            { label: 'Simple fluid', value: 'attenuates almost nothing — the acoustic window' },
            { label: 'Lung and bone', value: 'attenuate severely' },
          ],
        },
        {
          kind: 'trap',
          text: 'Gain and TGC change the picture, never the physics: patient exposure is untouched. Only output power changes what enters the patient. And attenuation is mainly absorption — “mainly reflection and scatter at boundaries” is a false stem.',
        },
      ],
    },
    {
      id: 'transducer',
      title: 'The transducer, the pulse and resolution',
      blurb: 'Element thickness sets the frequency, damping sets the pulse, and the pulse sets the sharpness.',
      kw: /piezo|transducer|crystal|element|matching layer|damping|backing|bandwidth|q.?factor|resonan|array|probe|footprint|spatial pulse length|axial|lateral|elevation|slice thickness|resolution|focal zone|frame rate|near.?field|far.?field|divergen|beam width|aperture|duty factor|pulse.?echo|pulse repetition/i,
      primer: [
        {
          kind: 'principle',
          text: 'The element’s thickness sets the frequency — resonance at half a wavelength — the damping sets the pulse length, and the pulse length sets axial resolution: SPL / 2.',
        },
        {
          kind: 'prose',
          text: 'The **piezoelectric** element works in both directions: a voltage makes it vibrate (transmit), a returning pressure wave makes it generate a voltage (receive). It resonates when its **thickness equals half a wavelength in the crystal** — so a thicker element means a lower frequency and a longer wavelength; the **diameter** sets the aperture and the beam, never the frequency. Between crystal (≈30 MRayl) and skin sits the **matching layer**: a **quarter-wavelength** thick, at the geometric-mean impedance, stepping the beam down so it is not reflected at the probe face. It works alongside the gel, which solves a different problem — the air gap.\n\nImaging is **pulse-echo**: transmit briefly, then listen — over 99% of the time, since the duty factor is well under 1%. Depth comes from timing: **depth = c × t / 2**, the division by two being the round trip, about **13 µs per centimetre**. The next pulse must wait for the deepest echo, so **depth caps the maximum PRF** — and with it the frame rate. Deeper, wider, denser, or more focal zones: every one costs frames per second.\n\nThe **backing block** damps the ringing: fewer cycles → shorter **spatial pulse length (SPL = n × λ)** → wider bandwidth → lower Q → better axial resolution — at the price of sensitivity. **Axial resolution = SPL/2**, improved by higher frequency and heavier damping, and **independent of depth**. **Lateral resolution equals the beam width**: best at the focus, improved by a larger aperture and higher frequency, and always the poorer of the two. **Elevational** (slice-thickness) resolution is fixed by the lens and is usually the worst; **temporal** resolution is simply frame rate.\n\nThe governing trade: higher frequency sharpens everything and shortens the reach. **Choose the highest frequency that still reaches the target** — which is why the linear array (≈5–15 MHz) owns superficial work, the curvilinear (≈2–5 MHz) the abdomen, and the phased array (≈1–5 MHz) the spaces between ribs.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <FreqPenetration/>,
            title: 'Frequency against penetration',
            annotation: '≈ 0.5 dB/cm/MHz each way',
            caption: 'Slide the frequency up on a real synthetic scanner: the near field sharpens while the deep field dies, and the computed penetration depth falls with every megahertz. This one trade decides every probe choice.',
          },
        },
        {
          kind: 'compare',
          title: 'The two spatial resolutions',
          a: 'Axial',
          b: 'Lateral',
          rows: [
            ['Set by', 'spatial pulse length', 'beam width'],
            ['Improved by', 'higher frequency, heavier damping', 'larger aperture, higher frequency, focus at the target'],
            ['Varies with depth', 'no', 'yes — best at the focus'],
            ['Typical value', '0.5–1 mm', '1–3 mm'],
          ],
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Crystal thickness', value: 'λ/2 — sets the operating frequency' },
            { label: 'Matching layer', value: 'λ/4 thick, geometric-mean impedance' },
            { label: 'Round-trip time', value: '≈ 13 µs per cm of depth' },
            { label: 'Maximum PRF', value: 'c / (2 × depth)' },
            { label: 'Near-field length', value: 'N = D² / 4λ' },
          ],
        },
        {
          kind: 'trap',
          text: 'Thickness sets the resonant frequency; diameter sets the beam. Axial resolution does NOT depend on diameter, focusing, PRF or depth — all four appear as false stems.',
        },
        {
          kind: 'detail',
          summary: 'The damping chain, link by link',
          text: 'More backing damping → fewer cycles per pulse → shorter spatial pulse length → wider bandwidth (a short pulse is built from many frequencies) → lower Q factor → better axial resolution → lower sensitivity, because a shorter pulse carries less energy and weak deep echoes are harder to detect. A continuous-wave probe is the opposite extreme: essentially one frequency, high Q, no imaging pulse at all. One control, six consequences — and the exam can start the chain at any link.',
        },
      ],
    },
    {
      id: 'doppler',
      title: 'Doppler and aliasing',
      blurb: 'Four inputs, one cosine, and a sampling limit at half the PRF.',
      tags: ['doppler-angle'],
      kw: /doppler|nyquist|alias|\bPRF\b|colou?r flow|spectral|duplex|triplex|continuous.?wave|pulsed.?wave|\bCW\b|\bPW\b|baseline|insonation/i,
      primer: [
        {
          kind: 'principle',
          text: 'Δf = 2 f₀ v cos θ / c — four inputs and no others — and a pulsed system can only display shifts up to the Nyquist limit, PRF/2.',
        },
        {
          kind: 'prose',
          text: 'Moving blood shifts the returned frequency: **towards** the probe raises it, **away** lowers it. The equation has exactly four inputs — transmitted frequency, velocity, **cos θ** and the speed of sound; the factor of two exists because the scatterer both receives and re-radiates a shifted wave. Vessel diameter, beam intensity and PRF appear nowhere in it. Colour maps direction relative to the probe: red is not artery and blue is not vein.\n\nEverything awkward lives in the **cosine**. Parallel to flow the shift is maximal; at 60° it is halved; at **90° it is zero** — real flow, no signal. Keep the insonation angle **at or below 60°**: beyond that the cosine changes so steeply that a small angle error becomes a large velocity error.\n\n**Pulsed-wave** Doppler samples the shift once per pulse, so any shift above **PRF/2** — the **Nyquist limit** — wraps to the opposite side of the display: **aliasing**. It happens at ordinary physiological velocities whenever the scale is low, the vessel deep (depth caps PRF), or the transmit frequency high. **Continuous-wave** Doppler samples continuously and cannot alias, but has no range resolution; **power Doppler** shows the strength of the signal — sensitive to slow flow, largely angle-independent, no aliasing — but neither direction nor velocity. Duplex is real-time **B-mode plus PW Doppler**, not M-mode.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DopplerAliasing/>,
            title: 'Doppler shift against the Nyquist limit',
            annotation: 'PRF/2',
            caption: 'Push the velocity past the Nyquist limit and watch the trace wrap to the opposite side — then raise the PRF and unwrap it.',
          },
        },
        {
          kind: 'relationship',
          title: 'The anti-aliasing fixes, honestly labelled',
          rows: [
            { change: 'Raise the PRF / velocity scale', effect: 'Nyquist limit ↑ — a genuine fix, capped by imaging depth' },
            { change: 'Reduce the depth', effect: 'PRF ceiling ↑ → Nyquist ↑ — genuine, when clinically possible' },
            { change: 'Lower the transmit frequency', effect: 'the shift itself shrinks (Δf ∝ f₀) — the limit is unchanged but no longer exceeded' },
            { change: 'Shift the baseline', effect: 'limit unchanged — only re-allocates the display; unwraps a marginal overshoot at the cost of the reverse channel' },
            { change: 'Switch to continuous wave', effect: 'no sampling, so no aliasing — but all range resolution is lost' },
          ],
        },
        {
          kind: 'trap',
          text: 'The shift follows the COSINE of the angle, not the angle — greatest parallel to flow, zero at 90°. And raising the transmit frequency makes aliasing MORE likely, not less. Widening the angle towards 90° does shrink the shift, but the velocity error explodes — it is not an accepted fix.',
        },
      ],
    },
    {
      id: 'artefacts',
      title: 'Artefacts',
      blurb: 'Every artefact is one of the machine’s assumptions being broken.',
      kw: /artefact|artifact|shadow|enhancement|reverberat|comet|ring.?down|mirror|side.?lobe|grating|speckle|anisotrop|twinkle|range ambiguity|speed error|misregist/i,
      fallback: true,
      primer: [
        {
          kind: 'principle',
          text: 'The scanner builds the image on four assumptions — 1540 m/s everywhere, straight-line travel, echoes from the main beam only, uniform attenuation. Every classic artefact is one of them breaking.',
        },
        {
          kind: 'prose',
          text: 'Break the **uniform attenuation** assumption and you get the pair the exam loves to swap: **shadowing** behind strong attenuators or reflectors — clean and anechoic behind stone and bone, dirty and noisy behind gas — and **posterior enhancement** behind weak attenuators, the over-bright band that certifies a cyst as fluid.\n\nBreak **straight-line travel** and structures appear where they are not. A strong smooth reflector — classically the diaphragm — bounces the beam onto a second target and back; the extra time is drawn as extra depth, and a **mirror image** appears beyond the reflector. **Refraction** at curved boundaries bends the beam, leaving narrow **edge shadows** at cyst margins and laterally misplaced or duplicated structures. Break the **main-beam** assumption and **side lobes** or grating lobes paint off-axis reflectors onto the beam axis — the spurious echoes inside a clean bladder.\n\nBreak the **1540 m/s** assumption and depths are simply wrong: through slower fat the echo is late and the structure is drawn **too deep**; faster tissue draws it too shallow — displacement along the beam axis. **Reverberation** between two strong parallel interfaces stacks equally spaced, fading copies; **comet-tail** is its tightly spaced form, while **ring-down** is different physics — a continuous resonant emission from trapped fluid between gas bubbles. **Range ambiguity** is the price of pushing PRF too high: a deep echo from the previous pulse is credited to the new one and placed falsely shallow.',
        },
        {
          kind: 'relationship',
          title: 'Which assumption broke',
          rows: [
            { change: 'Shadowing / posterior enhancement', effect: 'uniform attenuation broken — too much or too little loss along one path' },
            { change: 'Mirror image · refraction · edge shadow', effect: 'straight-line travel broken — the beam was bent or bounced' },
            { change: 'Side-lobe and grating-lobe echoes', effect: 'main-beam-only broken — off-axis energy credited to the axis' },
            { change: 'Speed error displacement', effect: '1540 m/s broken — fat is slower, so structures are drawn too deep' },
            { change: 'Reverberation / comet-tail', effect: 'one-reflection-per-interface broken — the echo kept bouncing' },
          ],
        },
        {
          kind: 'trap',
          text: 'Cysts cause enhancement; stones cause shadowing — “shadowing from both” is a false stem. And comet-tail is reverberation while ring-down is resonance: they are not the same mechanism.',
        },
        {
          kind: 'detail',
          summary: 'Speckle and anisotropy — the two that mimic tissue',
          text: 'Speckle is an interference pattern between wavelets scattered by structures smaller than the wavelength — not a picture of microstructure, and not diffuse boundary reflection. Anisotropy is geometry: tendon fibres are strongly angle-dependent reflectors, so an obliquely insonated tendon turns falsely hypoechoic and mimics a tear — heel–toe the probe until the fibrillar pattern returns before calling pathology. Twinkle artefact is the useful one: a flickering colour signal behind rough calcification that can reveal a stone B-mode barely shows.',
        },
      ],
    },
    {
      id: 'safety',
      title: 'Safety — the two indices',
      blurb: 'MI warns about bubbles, TI about heat. Neither is a measurement of harm.',
      tags: ['ultrasound-mi-ti'],
      kw: /mechanical index|thermal index|\bMI\b|\bTI[SBC]?\b|cavitat|heating|thermal|bioeffect|safety|obstetric|f(oe|e)tal|ALAR[AP]|prudent|microbubble|contrast agent/i,
      primer: [
        {
          kind: 'principle',
          text: 'Two indices, two different risks: MI = p₋/√f estimates the potential for cavitation; TI estimates heating. Each is an index of potential, not a measurement of damage.',
        },
        {
          kind: 'prose',
          text: 'The **mechanical index** is peak rarefactional pressure over the square root of frequency — it rises with output pressure and **falls as frequency rises**, and it says nothing about heat. Cavitation needs gas nuclei to work on, so the risk transforms when **microbubble contrast** supplies them by the million: caution above **MI 0.7** with contrast or other gas bodies (limit the scanning time), and above **MI 0.3** for neonatal lung. Contrast studies therefore run at deliberately low MI — drive it up and the bubbles collapse and the signal is destroyed.\n\nThe **thermal index** is the ratio of the acoustic power in use to the power estimated to raise tissue temperature by **1 °C** — not a temperature, and not “a 2 °C rise”. Variants match the anatomy: **TIS** for soft tissue, **TIB** for bone at the focus, **TIC** for bone at the surface. Heating comes from **absorption**: it concentrates wherever absorption is highest — over **bone**, however deep — while in uniform soft tissue it is greatest superficially; **perfusion carries heat away**. Mode matters more than most controls: **pulsed Doppler** parks long, high-energy pulses on one line and is the hottest mode; B-mode sweeps and is the gentlest; colour sits between.\n\nObstetric practice draws the lines: **restrict exposure time once TI exceeds 0.7, and do not scan above TI 3.0**; a sustained rise of **4 °C for 5 minutes** must be treated as potentially hazardous to a fetus. Diagnostic ultrasound has no proven hazard at diagnostic levels — but that is not “no effect”: use the lowest output and shortest time that answer the question. The ALARA principle applies: the lowest output and the shortest exposure time that answer the clinical question. (In UK ionising-radiation law the statutory wording is ALARP; ultrasound safety guidance keeps the ALARA name for the same idea.)',
        },
        {
          kind: 'compare',
          title: 'The two indices',
          a: 'Mechanical index',
          b: 'Thermal index',
          rows: [
            ['Estimates', 'cavitation — non-thermal effects', 'tissue heating'],
            ['Basis', 'p₋ / √f', 'power used ÷ power for a 1 °C rise'],
            ['Rises with', 'rarefactional pressure', 'power, dwell time, bone in beam, Doppler mode'],
            ['Falls with', 'frequency', 'perfusion'],
            ['Key numbers', '0.7 with contrast · 0.3 neonatal lung', 'restrict time above 0.7 · obstetric ceiling 3.0'],
          ],
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'MI caution with contrast / gas bodies', value: '0.7' },
            { label: 'MI caution, neonatal lung', value: '0.3' },
            { label: 'TI — restrict exposure time above', value: '0.7' },
            { label: 'TI — obstetric ceiling', value: '3.0' },
            { label: 'Potentially hazardous thermal dose', value: '4 °C sustained for 5 min' },
          ],
        },
        {
          kind: 'trap',
          text: 'TI is not a thermometer, and MI cannot be derived from heating — they estimate different risks. Heating is GREATER over bone and LESS in well-perfused tissue; and pulsed Doppler, not B-mode, is the mode that heats.',
        },
      ],
    },
  ],
  concepts: [
    {
      id: 'speed-medium',
      title: 'The medium owns the speed',
      rule: 'Propagation speed is set by the stiffness and density of the medium — c = 1/√(κρ) — never by the transducer frequency.',
      why: 'Changing the frequency changes the wavelength (λ = c/f), because c is fixed by the tissue. The scanner assumes 1540 m/s for everything.',
      confusion: 'Bone is fast because it is stiff, not because it is dense — stiffness rises faster than density.',
      match: /speed of sound|velocity of (ultra)?sound|propagation (speed|velocity)|1540|compressib/i,
    },
    {
      id: 'impedance-mismatch',
      title: 'Impedance and the mismatch',
      rule: 'Z = ρc, in rayls; the reflected fraction is R = ((Z₂ − Z₁)/(Z₂ + Z₁))² — set by the mismatch, not by either impedance alone.',
      why: 'Similar impedances transmit almost everything; the tissue–air step reflects over 99%, which is what gel abolishes.',
      confusion: 'Reflection needs an impedance difference, not a density difference — and impedance is unaffected by frequency.',
      match: /impedanc|rayl|reflect(ion|ed|s)?\b|coupling|gel\b/i,
    },
    {
      id: 'refraction-speed',
      title: 'Refraction needs speed and obliquity',
      rule: 'Refraction requires BOTH oblique incidence and a speed difference — sin θ₁/c₁ = sin θ₂/c₂; at normal incidence there is none.',
      why: 'Impedance governs reflection; speed governs refraction. They are related processes with different masters.',
      confusion: 'Refraction does not depend on frequency — lowering the transmit frequency does not reduce a refraction artefact.',
      match: /refract|snell|critical angle|oblique/i,
    },
    {
      id: 'attenuation-rule',
      title: 'The attenuation budget',
      rule: 'Soft tissue attenuates at roughly 0.5–1 dB/cm/MHz, mainly by absorption — loss grows with both depth and frequency.',
      why: 'The frequency term is the penetration problem: a higher-frequency beam pays more per centimetre, so deep echoes vanish into the noise sooner.',
      confusion: 'Attenuation is mostly absorption to heat, not reflection and scatter — and it has no relationship to acoustic impedance.',
      match: /attenuat|absorption|dB\/cm|penetrat/i,
    },
    {
      id: 'gain-vs-power',
      title: 'Gain versus output power',
      rule: 'Gain and TGC amplify received echoes — patient exposure unchanged; output power changes what enters the patient, and MI and TI with it.',
      why: 'TGC is a depth-dependent receive-side correction for attenuation; it brightens noise along with signal and puts nothing back into the beam.',
      match: /\bgain\b|TGC|time.?gain|output power/i,
    },
    {
      id: 'resolution-owners',
      title: 'Which control owns which resolution',
      rule: 'Axial resolution = SPL/2, owned by frequency and damping, independent of depth; lateral resolution = beam width, owned by aperture and focus, best at the focus.',
      why: 'The pulse length does not change as the pulse travels, so axial resolution holds at every depth. The beam width does change — so lateral resolution does not.',
      confusion: 'Diameter, focusing, PRF and depth all leave axial resolution untouched — they are the classic false stems.',
      match: /axial|lateral|elevation|slice thickness|spatial pulse length|beam width|resolution/i,
    },
    {
      id: 'thickness-frequency',
      title: 'Thickness sets the frequency',
      rule: 'The element resonates when its thickness is half a wavelength in the crystal — thicker element, lower frequency, longer wavelength; the matching layer is a quarter-wavelength at the geometric-mean impedance.',
      why: 'Diameter sets the aperture and therefore the beam — it has no say in the resonant frequency.',
      match: /thickness|resonan|crystal|piezo|matching layer|half.?wavelength|quarter.?wavelength/i,
    },
    {
      id: 'damping-chain',
      title: 'The damping chain',
      rule: 'More damping → fewer cycles → shorter pulse → wider bandwidth → lower Q → better axial resolution → lower sensitivity.',
      why: 'Every consequence follows from the shorter pulse; the cost is that a shorter pulse carries less energy, so weak deep echoes are harder to hear.',
      match: /damping|backing|bandwidth|q.?factor|ring.?down time|cycles per pulse/i,
    },
    {
      id: 'doppler-cosine',
      title: 'The Doppler cosine',
      rule: 'Δf = 2 f₀ v cos θ / c — the shift follows the cosine of the beam–flow angle: maximal parallel to flow, halved at 60°, zero at 90°.',
      why: 'Only the velocity component along the beam produces a shift. Past 60° the cosine changes so steeply that small angle errors become large velocity errors.',
      confusion: 'Vessel diameter, beam intensity and PRF are not in the equation — and the shift is greatest parallel to flow, not perpendicular.',
      match: /doppler (shift|equation|angle)|cos|insonation|beam.?flow angle/i,
    },
    {
      id: 'nyquist',
      title: 'The Nyquist limit',
      rule: 'A pulsed system displays shifts only up to PRF/2; anything beyond wraps — and PRF is itself capped by imaging depth.',
      why: 'Sampling must catch each cycle of the shift at least twice. Genuine fixes raise the limit (PRF up, depth down) or shrink the shift (lower f₀); baseline shift only moves the display, and CW removes sampling altogether at the cost of range resolution.',
      confusion: 'Aliasing occurs at ordinary physiological velocities — it does not prove a stenosis, and raising the transmit frequency makes it more likely.',
      match: /nyquist|alias|\bPRF\b|velocity scale|baseline/i,
    },
    {
      id: 'mi-vs-ti',
      title: 'MI versus TI',
      rule: 'MI = p₋/√f estimates cavitation potential (caution 0.7 with contrast, 0.3 neonatal lung); TI estimates heating (restrict time above 0.7, obstetric ceiling 3.0).',
      why: 'Cavitation needs gas nuclei and peak negative pressure; heating comes from absorption, so it concentrates at bone and is relieved by perfusion.',
      confusion: 'TI is a ratio to the power for a 1 °C rise — an index, not a measured temperature.',
      match: /mechanical index|thermal index|cavitat|\bTI[SBC]?\b|\bMI\b|heating|obstetric/i,
    },
  ],
  essentials: [
    'The medium owns the speed: air 330, fat 1450, soft tissue 1540 (assumed), muscle 1580, cortical bone ≈4080 m/s — frequency changes λ, never c.',
    'Z = ρc in rayls; R = ((Z₂ − Z₁)/(Z₂ + Z₁))². Soft tissue–air reflects >99% (hence gel); soft tissue–fluid ≈0.2%.',
    'Reflection is governed by the impedance mismatch; refraction needs BOTH oblique incidence and a speed difference — and neither depends on frequency.',
    'Attenuation ≈ 0.5 dB/cm/MHz one-way (≈ 1 round trip), mainly absorption; it rises with depth and frequency. TGC and gain are receive-side — exposure unchanged.',
    'Depth = ct/2, about 13 µs per cm; maximum PRF = c/(2 × depth) — depth caps PRF, frame rate and the Nyquist limit.',
    'Crystal thickness λ/2 sets the frequency; matching layer λ/4 at the geometric-mean impedance; damping ↑ → pulse ↓, bandwidth ↑, Q ↓, axial resolution ↑, sensitivity ↓.',
    'Axial = SPL/2 — depth-independent, 0.5–1 mm; lateral = beam width — best at the focus, 1–3 mm; elevational is usually the worst; temporal is frame rate.',
    'Higher frequency buys resolution and costs penetration: choose the highest frequency that still reaches the target.',
    'Δf = 2 f₀ v cos θ / c — four inputs only; the shift follows the cosine: halved at 60°, zero at 90°; keep the angle ≤60°.',
    'Nyquist limit = PRF/2. Genuine fixes: raise PRF/scale, reduce depth, lower f₀, or switch to CW (cannot alias, no range resolution). Baseline shift leaves the limit unchanged.',
    'MI = p₋/√f warns of cavitation: caution at 0.7 with contrast or gas bodies, 0.3 for neonatal lung.',
    'TI estimates heating and is not a temperature: restrict time above 0.7, obstetric ceiling 3.0; pulsed Doppler is the hottest mode, B-mode the gentlest.',
  ],
  labs: [{ label: 'The ultrasound laboratory — 21 experiments', to: '/ultrasound-lab' }],
}
