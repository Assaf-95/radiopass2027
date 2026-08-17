/**
 * Two fluoroscopy scenes re-hosted from the V1 lesson (src/labs/fluoro.tsx).
 *
 * Neither takes a control, because neither has anything to vary: each is a
 * single comparison that has to be seen rather than read. drawIiDistortion
 * draws one square test grid twice — bowed outward by the intensifier's
 * electron optics, true on the flat panel. drawDsaPanels draws the mask, the
 * contrast run, and the difference between them. Both assemble themselves as
 * the reveal runs and then hold still. The physics drawings are V1's, untouched.
 */

import { drawIiDistortion, drawDsaPanels } from '../../../labs/fluoro'
import { DrawCanvas } from './DrawCanvas'

export function IiDistortion() {
  return (
    <DrawCanvas
      draw={drawIiDistortion}
      height={300}
      label="The same square test grid on two receptors: bowed outward by the image intensifier's electron optics, geometrically true on a flat panel"
    />
  )
}

export function DsaSubtraction() {
  return (
    <DrawCanvas
      draw={drawDsaPanels}
      height={300}
      label="Digital subtraction: the mask, the contrast run, and the subtracted image in which only the vessels remain"
    />
  )
}
