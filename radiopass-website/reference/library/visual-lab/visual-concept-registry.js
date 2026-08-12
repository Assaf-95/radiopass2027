window.visualConceptRegistry = {
  "mri-visual-learning-lab": {
    title: "Core MRI physics visual learning lab",
    description: "A guided 20-stage interactive MRI mini-app covering B0, precession, RF flip, Mz/Mxy, T1/T2, gradients, k-space and image formation.",
    filePath: "mri-visual-learning.html",
    componentName: "MRI Visual Learning Lab",
    modality: "MRI",
    fallbackText: "Use the guided MRI visual learning lab to connect B0, RF excitation, relaxation, gradients and k-space."
  },
  "mri-physics-visual-deck": {
    title: "MRI physics visual teaching deck",
    description: "A pale-background 20-slide FRCR MRI physics deck with labelled SVG diagrams for B0, RF pulses, T1, T2, spin echo, gradients and k-space.",
    filePath: "mri-physics-visual-deck.html",
    componentName: "MRI Physics Visual Deck",
    modality: "MRI",
    fallbackText: "Use the MRI visual teaching deck for a clean slide-by-slide overview of core MRI physics."
  },
  "mri-visual-2": {
    title: "MRI Visual 2",
    description: "A strict white-background two-panel MRI teaching app with concise bullets, large labelled MRI diagrams, animations and key sliders for B0, flip angle and slice bandwidth.",
    filePath: "mri-visual-2.html",
    componentName: "MRI Visual 2",
    modality: "MRI",
    fallbackText: "Use MRI Visual 2 for a clean slide-by-slide explanation of B0, Mz, Mxy, RF pulses, relaxation, gradients and k-space."
  },
  "mri-magnetisation-recovery": {
    title: "Longitudinal magnetisation and T1 recovery",
    description: "Existing proton behaviour trainer showing alignment, RF excitation and Mz regrowth.",
    filePath: "visuals/mri-magnetisation-recovery.html",
    componentName: "MRI Proton Behavior Trainer",
    modality: "MRI",
    fallbackText: "Review longitudinal recovery along B0."
  },
  "mri-chemical-shift": {
    title: "Chemical shift and receiver bandwidth",
    description: "Existing interactive fat-water misregistration and receiver-bandwidth visual.",
    filePath: "visuals/mri-chemical-shift.html",
    componentName: "Chemical Shift Receiver Bandwidth",
    modality: "MRI",
    fallbackText: "Chemical shift occurs along the frequency-encoding direction."
  },
  "mri-spin-echo": {
    title: "Fat-water and spin echo simulator",
    description: "Existing simulator showing 90 degree excitation, 180 degree refocusing, dephasing and echo formation.",
    filePath: "visuals/mri-spin-echo-fat-water.html",
    componentName: "Fat-Water Spin Echo Simulator",
    modality: "MRI",
    fallbackText: "Spin echo refocuses reversible static field dephasing."
  },
  "mri-sar": {
    title: "MRI RF energy and SAR",
    description: "Existing MRI trainer provides RF and field controls relevant to energy deposition.",
    filePath: "visuals/mri-magnetisation-recovery.html",
    componentName: "MRI Proton Behavior Trainer",
    modality: "MRI",
    fallbackText: "SAR concerns RF energy deposition and tissue heating."
  },
  "ct-pitch-dose": {
    title: "Multi-detector CT pitch and helical geometry",
    description: "Existing step diagram showing detector rows, helical table movement and pitch effects.",
    filePath: "visuals/diagrams-6-10.html#d10",
    componentName: "Diagram 10: Multi-Detector CT Geometry",
    modality: "CT",
    fallbackText: "Pitch is table movement per rotation divided by total beam width."
  },
  "ct-dose-profile": {
    title: "CT dose profile and CTDI",
    description: "Existing visual showing scatter tails, pencil chamber measurement and integrated CTDI.",
    filePath: "visuals/diagrams-6-10.html#d8",
    componentName: "Diagram 8: CT Dose Profile",
    modality: "CT",
    fallbackText: "CTDI integrates dose across the longitudinal beam profile."
  },
  "ct-windowing": {
    title: "CT window width and level",
    description: "No dedicated recovered interactive visual is currently available.",
    filePath: null,
    componentName: null,
    modality: "CT",
    fallbackText: "Window width controls displayed contrast; level controls the centre of the displayed HU range."
  },
  "ct-beam-hardening": {
    title: "Beam hardening and X-ray spectrum",
    description: "Existing spectrum simulator showing preferential removal of low-energy photons.",
    filePath: "visuals/xray-beam-quality.html",
    componentName: "X Ray Beam Quality Simulator",
    modality: "CT",
    fallbackText: "Beam hardening raises mean photon energy as low-energy photons are removed."
  },
  "compton-scatter": {
    title: "Compton interaction probability",
    description: "Existing interaction-probability visual comparing Compton, photoelectric and pair production.",
    filePath: "visuals/diagrams-6-10.html#d7",
    componentName: "Diagram 7: Interaction Probability",
    modality: "X-ray",
    fallbackText: "Compton probability is closely related to electron density."
  },
  "photoelectric-effect": {
    title: "Photoelectric interaction probability",
    description: "Existing energy and atomic-number trend visual for photoelectric absorption.",
    filePath: "visuals/diagrams-6-10.html#d7",
    componentName: "Diagram 7: Interaction Probability",
    modality: "X-ray",
    fallbackText: "Photoelectric probability rises strongly with atomic number and falls with photon energy."
  },
  "xray-guided-interactions": {
    title: "X-ray production and interactions guided lesson",
    description: "Recovered moving lesson covering electron-target interactions, bremsstrahlung, characteristic radiation, filtration, photoelectric absorption and Compton scatter.",
    filePath: "visuals/xray-guided-interactions.html?compact=1",
    fullPath: "visuals/xray-guided-interactions.html",
    componentName: "X-ray Production and Interactions Guided Tour",
    modality: "X-ray",
    fallbackText: "Follow the guided sequence from X-ray production through filtration and tissue interactions."
  },
  "xray-beam-quality": {
    title: "X-ray beam spectrum, kVp and filtration",
    description: "Existing interactive spectrum with kVp, mAs and filtration controls.",
    filePath: "visuals/xray-beam-quality.html",
    componentName: "X Ray Beam Quality Simulator",
    modality: "X-ray",
    fallbackText: "kVp changes beam energy; filtration preferentially removes low-energy photons."
  },
  "exponential-attenuation": {
    title: "Exponential attenuation",
    description: "Existing step diagram comparing material thickness and attenuation coefficients.",
    filePath: "visuals/diagrams-16-24.html#d17",
    componentName: "Diagram 17: Exponential Attenuation",
    modality: "X-ray",
    fallbackText: "Transmission falls exponentially as thickness or attenuation coefficient increases."
  },
  "mammography-compression": {
    title: "Mammography components and compression",
    description: "Existing mammography visual showing compression, scatter reduction and heel effect.",
    filePath: "visuals/diagrams-1-5.html#d3",
    componentName: "Diagram 3: Mammography Unit",
    modality: "Mammography",
    fallbackText: "Compression reduces tissue thickness, scatter, motion and dose."
  },
  "gamma-camera-collimator": {
    title: "Parallel-hole gamma-camera collimator",
    description: "Existing interactive visual showing accepted photons, blocked oblique photons and distance-dependent blur.",
    filePath: "visuals/diagrams-6-10.html#d6",
    componentName: "Diagram 6: Parallel Hole Collimator",
    modality: "Nuclear Medicine",
    fallbackText: "Most photons are absorbed; near-parallel photons pass through the holes."
  },
  "spect-acquisition": {
    title: "SPECT gamma-camera acquisition",
    description: "Existing rotating detector visual with collimation, event positioning and reconstruction.",
    filePath: "visuals/diagrams-1-5.html#d4",
    componentName: "Diagram 4: SPECT Acquisition",
    modality: "Nuclear Medicine",
    fallbackText: "SPECT collects projections around the patient and reconstructs slices."
  },
  "pet-coincidence": {
    title: "PET coincidence detection",
    description: "Existing detector-ring visual showing opposed photons, timing and the line of response.",
    filePath: "visuals/diagrams-16-24.html#d19",
    componentName: "Diagram 19: PET Detection",
    modality: "PET",
    fallbackText: "Coincident detections in opposite detectors define a line of response."
  },
  "suv": {
    title: "Standardised uptake value",
    description: "No dedicated recovered interactive visual is currently available.",
    filePath: null,
    componentName: null,
    modality: "PET",
    fallbackText: "SUV depends on uptake, injected activity normalisation, timing and patient factors."
  },
  "doppler-angle": {
    title: "Doppler angle",
    description: "Interactive angle visual created only because no recovered Doppler diagram was available.",
    filePath: "visuals/ultrasound-core-visuals.html#doppler-angle",
    componentName: "Ultrasound Core Visuals",
    modality: "Ultrasound",
    fallbackText: "The Doppler shift approaches zero as the insonation angle approaches 90 degrees."
  },
  "ultrasound-acoustic-impedance": {
    title: "Acoustic impedance and reflection",
    description: "Compact visual showing reflection at an interface with an impedance mismatch.",
    filePath: "visuals/ultrasound-core-visuals.html#acoustic-impedance",
    componentName: "Ultrasound Core Visuals",
    modality: "Ultrasound",
    fallbackText: "Greater impedance mismatch produces greater reflection."
  },
  "ultrasound-mi-ti": {
    title: "Mechanical and thermal indices",
    description: "Compact MI/TI comparison created because no recovered safety visual was available.",
    filePath: "visuals/ultrasound-core-visuals.html#mi-ti",
    componentName: "Ultrasound Core Visuals",
    modality: "Ultrasound",
    fallbackText: "MI indicates mechanical-effect potential; TI estimates heating potential."
  },
  "radiation-protection-shielding": {
    title: "X-ray room shielding",
    description: "Existing room layout showing primary beam, scatter, barriers and controlled areas.",
    filePath: "visuals/diagrams-6-10.html#d9",
    componentName: "Diagram 9: X-Ray Room Shielding",
    modality: "Radiation Protection",
    fallbackText: "Primary barriers attenuate the direct beam; secondary barriers protect against scatter and leakage."
  },
  "irmer-irr": {
    title: "IR(ME)R and IRR roles",
    description: "No dedicated recovered interactive role diagram is currently available.",
    filePath: null,
    componentName: null,
    modality: "Radiation Protection",
    fallbackText: "Keep employer, referrer, practitioner and operator responsibilities distinct."
  },
  "deterministic-stochastic-effects": {
    title: "Radiation effects and dose relationships",
    description: "No sufficiently specific recovered interactive visual is currently available.",
    filePath: null,
    componentName: null,
    modality: "Dosimetry",
    fallbackText: "Tissue reactions have thresholds; stochastic risk probability rises with dose."
  },
  "fluoroscopy-image-intensifier": {
    title: "Fluoroscopy image intensifier",
    description: "No dedicated recovered interactive visual is currently available.",
    filePath: null,
    componentName: null,
    modality: "Fluoroscopy",
    fallbackText: "The image intensifier converts X-rays to light, then electrons, then a brighter output image."
  },
  "dsa-subtraction-noise": {
    title: "Digital subtraction angiography",
    description: "No dedicated recovered subtraction animation is currently available.",
    filePath: null,
    componentName: null,
    modality: "Fluoroscopy",
    fallbackText: "Subtraction improves vessel conspicuity but combines noise from mask and contrast images."
  },
  "mri-larmor-precession": {
    title: "B0 alignment and Larmor precession",
    description: "Existing gyroscope-style MRI visual showing proton magnetic moments precessing around B0.",
    filePath: "visuals/mri-larmor-precession.html",
    componentName: "MRI Gyroscope Precession Physics",
    modality: "MRI",
    fallbackText: "The Larmor frequency is proportional to field strength and gyromagnetic ratio."
  },
  "mri-b0-precession-rf-recovery-overview": {
    title: "B0, precession, RF flip, signal, dephasing and recovery",
    description: "Recovered six-stage MRI overview linking B0 alignment to precession, RF tipping, in-phase signal, dephasing and longitudinal recovery.",
    filePath: "visuals/mri-b0-precession-rf-recovery-overview.html",
    componentName: "MRI Gyroscope Six-Stage Overview",
    modality: "MRI",
    fallbackText: "Follow the sequence from B0 alignment through RF excitation to signal loss and recovery."
  },
  "mri-rf-excitation": {
    title: "RF excitation and signal production",
    description: "Existing hydrogen signal-production visual showing resonance and transverse magnetisation.",
    filePath: "visuals/mri-signal-production.html",
    componentName: "MRI Hydrogen Signal Production",
    modality: "MRI",
    fallbackText: "An RF pulse at resonance tips magnetisation and creates an observable transverse component."
  },
  "mri-refocusing": {
    title: "180 degree refocusing pulse",
    description: "Existing focused visual showing reversal of phase order and rephasing towards the echo.",
    filePath: "visuals/mri-refocusing-pulse.html",
    componentName: "MRI RF 180 Pulse",
    modality: "MRI",
    fallbackText: "The 180 degree pulse reverses reversible phase dispersion but does not reverse true T2 decay."
  },
  "mri-dephasing": {
    title: "Transverse dephasing and rephasing",
    description: "Existing proton-group animation showing phase coherence, dephasing and spin-echo recovery.",
    filePath: "visuals/mri-dephasing.html",
    componentName: "MRI Dephasing Sequence",
    modality: "MRI",
    fallbackText: "T2 star includes true T2 decay plus reversible static field dephasing."
  },
  "mri-t2-t2star-signal": {
    title: "T2 and T2* signal decay",
    description: "Recovered step-by-step moving graph comparing true tissue T2 decay with the faster observed T2* signal loss.",
    filePath: "visuals/mri-t2-t2star-signal-steps.html",
    componentName: "T2 and T2* Signal Step by Step",
    modality: "MRI",
    fallbackText: "T2* is shorter than T2 because it includes true spin-spin relaxation and additional static field inhomogeneity."
  },
  "mri-t2-dephasing-spin-echo": {
    title: "T2 dephasing and spin-echo build-up",
    description: "Recovered staged canvas animation showing transverse dephasing, the 180 degree refocusing pulse and echo formation.",
    filePath: "visuals/mri-t2-dephasing-spin-echo.html",
    componentName: "MRI T2 Dephasing Visualizer",
    modality: "MRI",
    fallbackText: "A 180 degree pulse refocuses reversible phase dispersion while irreversible T2 signal loss continues."
  },
  "mri-dephasing-step-sequence": {
    title: "MRI dephasing export steps 04-10",
    description: "Standalone exported pages walking through B0, slice selection, 90 degree RF, phase encoding, T2* dephasing, frequency readout and 180 degree refocusing.",
    filePath: "mri-html-export/index.html",
    componentName: "MRI Dephasing Export Sequence",
    modality: "MRI",
    fallbackText: "Open the exported dephasing sequence for stepwise B0, RF, gradient encoding, T2* and spin echo refocusing."
  },
  "mri-gradients-kspace": {
    title: "MRI gradients and spatial encoding",
    description: "Existing B0 and gradient visual covering slice, phase and frequency encoding.",
    filePath: "visuals/mri-gradients.html",
    componentName: "B0 Precession With All Gradients",
    modality: "MRI",
    fallbackText: "Gradients vary precession frequency or accumulated phase with position."
  },
  "mri-artifacts": {
    title: "MRI artefacts step guide",
    description: "Existing guided visual for aliasing, susceptibility, chemical shift and related artefacts.",
    filePath: "visuals/mri-artifacts.html",
    componentName: "MRI Artifacts Step Guide",
    modality: "MRI",
    fallbackText: "Artefacts depend on encoding direction, field homogeneity and acquisition parameters."
  },
  "radiographic-magnification": {
    title: "Radiographic magnification geometry",
    description: "Existing interactive geometry simulator with source-object-detector distances.",
    filePath: "visuals/radiographic-magnification.html",
    componentName: "Radiographic Magnification Simulator",
    modality: "Radiography",
    fallbackText: "Magnification increases with object-receptor distance and decreases with source-object distance."
  },
  "xray-focal-spot-unsharpness": {
    title: "Focal spot and geometric unsharpness",
    description: "Existing X-ray tube and geometry simulator showing line focus, focal spot size and penumbra.",
    filePath: "visuals/xray-focal-spot-unsharpness.html",
    componentName: "X-ray Tube and Geometric Unsharpness",
    modality: "Radiography",
    fallbackText: "Geometric unsharpness rises with focal spot size and object-receptor distance."
  },
  "beam-divergence-isocentre": {
    title: "Beam divergence, magnification and isocentre",
    description: "Existing point-source cone-beam visual showing divergence, central ray and penumbra.",
    filePath: "visuals/diagrams-1-5.html#d2",
    componentName: "Diagram 2: Beam Divergence",
    modality: "Radiography",
    fallbackText: "A point source creates a diverging beam; field size increases with distance."
  },
  "digital-breast-tomosynthesis": {
    title: "Digital breast tomosynthesis",
    description: "Existing limited-angle acquisition visual with tube arc, projection paths and reconstruction plane.",
    filePath: "visuals/diagrams-1-5.html#d1",
    componentName: "Diagram 1: Digital Breast Tomosynthesis",
    modality: "Mammography",
    fallbackText: "Tomosynthesis uses multiple low-dose projections over a limited angle."
  },
  "radiotherapy-depth-dose": {
    title: "Radiotherapy depth-dose curves",
    description: "Existing photon, electron, proton and spread-out Bragg peak visual.",
    filePath: "visuals/diagrams-1-5.html#d5",
    componentName: "Diagram 5: Depth Dose Curves",
    modality: "Radiotherapy",
    fallbackText: "Photons show build-up, electrons have finite range, and protons form a Bragg peak."
  },
  "mri-tissue-signal": {
    title: "MRI tissue signal contributions",
    description: "Existing visual comparing tissue vectors, transverse decay rates and voxel signal.",
    filePath: "visuals/diagrams-16-24.html#d16",
    componentName: "Diagram 16: MRI Tissue Differences",
    modality: "MRI",
    fallbackText: "Signal intensity reflects proton density and sequence-dependent T1/T2 contrast."
  },
  "wave-frequency-period": {
    title: "Wave frequency, period and amplitude",
    description: "Existing animated sinusoidal-wave visual showing the inverse frequency-period relationship.",
    filePath: "visuals/diagrams-16-24.html#d18",
    componentName: "Diagram 18: Frequency and Period",
    modality: "Basic Physics",
    fallbackText: "Higher frequency means shorter period when propagation conditions are unchanged."
  },
  "line-focus-principle": {
    title: "Line focus principle",
    description: "Existing anode-angle visual comparing actual and effective focal spot.",
    filePath: "visuals/diagrams-16-24.html#d20",
    componentName: "Diagram 20: Line Focus Principle",
    modality: "Radiography",
    fallbackText: "The angled anode produces an effective focal spot smaller than the actual focal area."
  }
};
