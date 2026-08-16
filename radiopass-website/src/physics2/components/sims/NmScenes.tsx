/**
 * The nuclear-medicine scenes, re-hosted from the V1 lesson (src/labs/nm.tsx).
 *
 * drawGammaCamera with focus 'all' plays the whole detection chain on a loop:
 * one photon every few seconds — emission, collimation, crystal flash, light
 * guide, PMT avalanche, position logic, PHA — landing as one dot on the
 * accumulating image, with every third photon scattering and being rejected.
 * drawPet shows annihilation pairs and the lines of response crossing at the
 * lesion. The physics drawings are V1's, untouched.
 */

import { drawGammaCamera, drawPet } from '../../../labs/nm'
import { DrawCanvas } from './DrawCanvas'

export function GammaCameraChain() {
  return (
    <DrawCanvas
      draw={(ctx, w, h, p, t) => drawGammaCamera(ctx, w, h, 'all', p, t)}
      height={460}
      label="The gamma camera chain: one photon followed from patient to image, scatter rejected by the pulse height analyser"
    />
  )
}

export function PetCoincidence() {
  return (
    <DrawCanvas
      draw={drawPet}
      height={430}
      label="PET coincidence detection: annihilation photon pairs leaving back to back, lines of response crossing at the lesion"
    />
  )
}
