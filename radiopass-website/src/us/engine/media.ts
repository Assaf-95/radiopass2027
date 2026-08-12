/**
 * Acoustic properties of the media used throughout the ultrasound laboratory.
 *
 * Every number here is a *typical* published value. Textbooks differ in the
 * third significant figure (and considerably more for bone and lung), so the
 * laboratory teaches relative behaviour and orders of magnitude rather than
 * asking a learner to memorise a decimal place. Where a source commonly quoted
 * in FRCR revision disagrees with the mainstream figure, `note` records it.
 *
 * Impedance is derived, never stored: Z = rho * c. That is the whole point of
 * the equation, and duplicating it as data would let the two drift apart.
 */

export type MediumId =
  | 'air'
  | 'lung'
  | 'fat'
  | 'water'
  | 'gel'
  | 'softTissue'
  | 'liver'
  | 'kidney'
  | 'blood'
  | 'muscle'
  | 'bone'
  | 'pzt'
  | 'custom'

export type Medium = {
  id: MediumId
  name: string
  /** Lower-case form for use mid-sentence. */
  lower: string
  /** Density in kg/m^3. */
  density: number
  /** Propagation speed in m/s. */
  speed: number
  /** Amplitude attenuation coefficient in dB/cm/MHz. */
  attenuation: number
  /** Display colour for diagrams (hex). */
  colour: string
  /** Greyscale level 0-1 used when this medium is drawn in a B-mode image. */
  echogenicity: number
  note?: string
}

/** The speed every scanner assumes for soft tissue when it converts time to depth. */
export const ASSUMED_SPEED = 1540

export const MEDIA: Medium[] = [
  {
    id: 'air',
    name: 'Air',
    lower: 'air',
    density: 1.2,
    speed: 330,
    attenuation: 1.2,
    colour: '#8ea3b8',
    echogenicity: 0.06,
    note: 'Air is both very light and very slow, so its impedance is roughly four thousand times lower than soft tissue. That mismatch is why almost the entire beam is reflected at a tissue–air boundary, and why coupling gel exists.',
  },
  {
    id: 'lung',
    name: 'Lung',
    lower: 'lung',
    density: 300,
    speed: 600,
    attenuation: 40,
    colour: '#a08fc0',
    echogenicity: 0.1,
    note: 'Aerated lung behaves as countless tiny gas–tissue interfaces. Published impedance values vary widely (roughly 0.18–0.26 MRayl) because the figure depends entirely on inflation.',
  },
  {
    id: 'fat',
    name: 'Fat',
    lower: 'fat',
    density: 952,
    speed: 1450,
    attenuation: 0.6,
    colour: '#f0c674',
    echogenicity: 0.42,
    note: 'Fat is the slowest of the soft tissues. Because the scanner assumes 1540 m/s, a reflector lying beneath thick fat is placed slightly too deep on the image.',
  },
  {
    id: 'water',
    name: 'Water',
    lower: 'water',
    density: 1000,
    speed: 1480,
    attenuation: 0.002,
    colour: '#4fc3f7',
    echogenicity: 0.03,
    note: 'Water and simple fluid attenuate almost nothing, which is exactly why posterior acoustic enhancement appears behind a cyst.',
  },
  {
    id: 'gel',
    name: 'Coupling gel',
    lower: 'coupling gel',
    density: 1000,
    speed: 1540,
    attenuation: 0.05,
    colour: '#7ee8d8',
    echogenicity: 0.05,
    note: 'Gel is formulated so that its impedance sits very close to skin. It does not "improve" transmission by any magic — it simply removes the air layer that would otherwise reflect the beam.',
  },
  {
    id: 'softTissue',
    name: 'Soft tissue (average)',
    lower: 'average soft tissue',
    density: 1050,
    speed: 1540,
    attenuation: 0.5,
    colour: '#cbd5e1',
    echogenicity: 0.5,
    note: 'The 1540 m/s average is what every scanner is calibrated to. Attenuation in soft tissue is usually quoted as 0.5–1.0 dB/cm/MHz; 0.5 is the common single figure and 1 dB/cm/MHz is the round-trip rule of thumb.',
  },
  {
    id: 'liver',
    name: 'Liver',
    lower: 'liver',
    density: 1060,
    speed: 1550,
    attenuation: 0.5,
    colour: '#c39b8b',
    echogenicity: 0.55,
  },
  {
    id: 'kidney',
    name: 'Kidney',
    lower: 'kidney',
    density: 1040,
    speed: 1560,
    attenuation: 0.9,
    colour: '#b8a08f',
    echogenicity: 0.48,
  },
  {
    id: 'blood',
    name: 'Blood',
    lower: 'blood',
    density: 1060,
    speed: 1570,
    attenuation: 0.18,
    colour: '#ef5350',
    echogenicity: 0.12,
    note: 'Blood is a weak scatterer, not a specular reflector. Red cells are far smaller than the wavelength, so they scatter in all directions — which is precisely what makes Doppler possible.',
  },
  {
    id: 'muscle',
    name: 'Muscle',
    lower: 'muscle',
    density: 1080,
    speed: 1580,
    attenuation: 1.0,
    colour: '#e08585',
    echogenicity: 0.45,
    note: 'Muscle and tendon are anisotropic: attenuation and the strength of the returning echo both depend on whether the beam runs along or across the fibres.',
  },
  {
    id: 'bone',
    name: 'Cortical bone',
    lower: 'cortical bone',
    density: 1912,
    speed: 4080,
    attenuation: 20,
    colour: '#f5f5f5',
    echogenicity: 0.98,
    note: 'Bone is dense and fast, so its impedance is roughly five times that of soft tissue. The interface reflects strongly and what does get in is absorbed rapidly — a strong bright line followed by a clean shadow.',
  },
  {
    id: 'pzt',
    name: 'PZT crystal',
    lower: 'the piezoelectric crystal',
    density: 7500,
    speed: 4000,
    attenuation: 2,
    colour: '#9575cd',
    echogenicity: 0.9,
    note: 'Lead zirconate titanate has an impedance near 30 MRayl — about twenty times that of tissue. Without a matching layer almost nothing would get out of the transducer.',
  },
]

const MEDIA_BY_ID = new Map(MEDIA.map((medium) => [medium.id, medium]))

export function medium(id: MediumId): Medium {
  const found = MEDIA_BY_ID.get(id)
  if (!found) throw new Error(`Unknown medium: ${id}`)
  return found
}

/** Media offered in the tissue-interface experiments, in impedance order. */
export const INTERFACE_MEDIA: MediumId[] = [
  'air',
  'lung',
  'fat',
  'water',
  'gel',
  'softTissue',
  'liver',
  'kidney',
  'blood',
  'muscle',
  'bone',
]

/**
 * Acoustic impedance in MRayl (10^6 kg m^-2 s^-1).
 *
 * Z = rho * c, which in SI units gives kg m^-2 s^-1; dividing by 10^6 gives the
 * MRayl figure textbooks quote.
 */
export function impedance(m: Pick<Medium, 'density' | 'speed'>): number {
  return (m.density * m.speed) / 1e6
}

export function impedanceOf(id: MediumId): number {
  return impedance(medium(id))
}
