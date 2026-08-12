/**
 * Zone D — resulting image brightness.
 *
 * Every grey level on this panel comes from the signal engine. There are no
 * hard-coded "fat is bright" states: the tile for fat is light on a T1-weighted
 * sequence because the equation returns a large number for it, and it goes dark
 * on STIR because the same equation returns nearly zero.
 *
 * The schematic head is drawn from the same numbers, so the tiles and the image
 * can never disagree.
 */

import { useCallback } from 'react'

import {
  brightnessBand,
  buildBrightnessScale,
  explainTissue,
  sequenceSignal,
  tissueStateAt,
  type Tissue,
} from '../engine'
import { useMri, useSimulation, useTissues } from '../state/context'
import type { SimulationSnapshot } from '../state/simulation'
import { SimCanvas } from './SimCanvas'
import { FONTS, greyscale, PALETTE } from './theme'

/**
 * A deliberately schematic axial brain. It is a teaching diagram, not an
 * anatomical reference: the point is that each region takes its grey level from
 * the tissue model, so the picture changes correctly when parameters change.
 */
type Region = {
  tissue: Tissue['id']
  path: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
  label: string
}

const REGIONS: Region[] = [
  {
    tissue: 'fat',
    label: 'Scalp fat',
    path: (ctx, w, h) => {
      ctx.ellipse(w / 2, h / 2, w * 0.34, h * 0.42, 0, 0, Math.PI * 2)
    },
  },
  {
    tissue: 'muscle',
    label: 'Skull and muscle',
    path: (ctx, w, h) => {
      ctx.ellipse(w / 2, h / 2, w * 0.315, h * 0.392, 0, 0, Math.PI * 2)
    },
  },
  {
    tissue: 'greyMatter',
    label: 'Cortical grey matter',
    path: (ctx, w, h) => {
      ctx.ellipse(w / 2, h / 2, w * 0.29, h * 0.365, 0, 0, Math.PI * 2)
    },
  },
  {
    tissue: 'whiteMatter',
    label: 'White matter',
    path: (ctx, w, h) => {
      ctx.ellipse(w / 2, h / 2, w * 0.24, h * 0.305, 0, 0, Math.PI * 2)
    },
  },
]

function drawHead(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  brightnessOf: (id: Tissue['id']) => number,
) {
  const w = width
  const h = height

  for (const region of REGIONS) {
    ctx.save()
    ctx.beginPath()
    region.path(ctx, w, h)
    ctx.fillStyle = greyscale(brightnessOf(region.tissue))
    ctx.fill()
    ctx.restore()
  }

  // Lateral ventricles — CSF.
  ctx.save()
  ctx.fillStyle = greyscale(brightnessOf('csf'))
  ctx.beginPath()
  ctx.ellipse(w * 0.435, h * 0.47, w * 0.045, h * 0.115, 0.18, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(w * 0.565, h * 0.47, w * 0.045, h * 0.115, -0.18, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // A periventricular lesion with surrounding oedema.
  ctx.save()
  ctx.fillStyle = greyscale(brightnessOf('oedema'))
  ctx.beginPath()
  ctx.ellipse(w * 0.615, h * 0.4, w * 0.052, h * 0.05, 0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = greyscale(brightnessOf('lesion'))
  ctx.beginPath()
  ctx.ellipse(w * 0.615, h * 0.4, w * 0.028, h * 0.026, 0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Diploic marrow fat in the skull vault.
  ctx.save()
  ctx.strokeStyle = greyscale(brightnessOf('marrow'))
  ctx.lineWidth = Math.max(2, w * 0.012)
  ctx.beginPath()
  ctx.ellipse(w / 2, h / 2, w * 0.327, h * 0.406, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

export function BrightnessPanel({ showHead = true }: { showHead?: boolean }) {
  const tissues = useTissues()
  const snapshot = useSimulation()
  const { focusTissue, setFocusTissue } = useMri()

  const magnitudes = tissues.map((tissue) => sequenceSignal(snapshot.config, tissue).magnitude)
  const scale = buildBrightnessScale(magnitudes)

  const render = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number, frame: SimulationSnapshot) => {
      ctx.fillStyle = '#050a08'
      ctx.fillRect(0, 0, width, height)

      const all = tissues.map((tissue) => sequenceSignal(frame.config, tissue).magnitude)
      const frameScale = buildBrightnessScale(all)
      const lookup = new Map(tissues.map((tissue) => [tissue.id, tissue]))

      const brightnessOf = (id: Tissue['id']) => {
        const tissue = lookup.get(id)
        if (!tissue) return 0.12
        return frameScale.toBrightness(sequenceSignal(frame.config, tissue).magnitude)
      }

      drawHead(ctx, width, height, brightnessOf)

      // A trace of acquisition noise, so the panel reads as a reconstructed
      // image rather than flat vector shapes. Deterministic, not random: the
      // pattern is a fixed hash of position and never shimmers between frames.
      ctx.save()
      ctx.globalAlpha = 0.05
      ctx.globalCompositeOperation = 'overlay'
      const step = 3
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const hash = ((x * 73856093) ^ (y * 19349663)) >>> 0
          const level = (hash % 255) | 0
          ctx.fillStyle = `rgb(${level},${level},${level})`
          ctx.fillRect(x, y, step, step)
        }
      }
      ctx.restore()

      // Corner graticule, the way a console frames a reconstructed slice.
      const inset = 8
      const arm = 14
      ctx.save()
      ctx.strokeStyle = 'rgba(223,234,229,0.28)'
      ctx.lineWidth = 1
      const corners: [number, number, number, number][] = [
        [inset, inset, 1, 1],
        [width - inset, inset, -1, 1],
        [inset, height - inset, 1, -1],
        [width - inset, height - inset, -1, -1],
      ]
      for (const [cx, cy, dx, dy] of corners) {
        ctx.beginPath()
        ctx.moveTo(cx + dx * arm, cy)
        ctx.lineTo(cx, cy)
        ctx.lineTo(cx, cy + dy * arm)
        ctx.stroke()
      }
      ctx.restore()

      ctx.fillStyle = PALETTE.textMuted
      ctx.font = FONTS.caption
      ctx.textAlign = 'left'
      ctx.fillText('Schematic — grey levels generated from the signal model', 12, height - 12)
    },
    [tissues],
  )

  return (
    <div className="mri-brightness">
      {showHead && (
        <div className="mri-image-stage">
          <SimCanvas
            render={render}
            label="Schematic axial image whose grey levels are generated from the current sequence parameters."
            className="mri-canvas"
          />
        </div>
      )}

      <ul className="mri-tiles">
        {tissues.map((tissue) => {
          const result = sequenceSignal(snapshot.config, tissue)
          const brightness = scale.toBrightness(result.magnitude)
          const band = brightnessBand(result.magnitude / scale.reference)
          const explanation = explainTissue(snapshot.config, tissue, tissues)
          const state = tissueStateAt(snapshot.config, tissue, snapshot.time)
          return (
            <li key={tissue.id}>
              <button
                type="button"
                className={tissue.id === focusTissue ? 'mri-tile is-on' : 'mri-tile'}
                onClick={() => setFocusTissue(tissue.id)}
                aria-pressed={tissue.id === focusTissue}
                title={explanation.reason}
              >
                <span
                  className="mri-tile-swatch"
                  style={{ background: greyscale(brightness) }}
                  aria-hidden="true"
                />
                <span className="mri-tile-body">
                  <strong style={{ color: tissue.colour }}>{tissue.name}</strong>
                  <span className="mri-tile-band">{band}</span>
                  <span className="mri-tile-values">
                    signal {result.magnitude.toFixed(3)}
                    {result.signed < -1e-6 && <em> (signed {result.signed.toFixed(3)})</em>}
                  </span>
                  <span className="mri-tile-values">
                    now: Mz {(state.mzNorm * 100).toFixed(0)}% · Mxy {(state.mxyNorm * 100).toFixed(0)}%
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mri-caption">
        Brightness is windowed to the strongest signal on screen, exactly as a radiographer windows
        an image. Values are relative and in arbitrary units.
      </p>
    </div>
  )
}
