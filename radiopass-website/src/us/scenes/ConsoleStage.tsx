/**
 * The console stage — a large computed B-mode surface with an instrument
 * overlay.
 *
 * The image itself comes from the shared `BMode` renderer, so shadowing behind
 * the calcified focus and enhancement behind the cyst are emergent physics,
 * never drawn by hand. This wrapper adds only what a real console adds on top
 * of its image: focus carets, the TGC depth bands, a penetration marker, and a
 * phase annotation that points the guided walkthrough at the control being
 * taught. Colour is reserved for those overlays — the image stays clinically
 * greyscale.
 */

import { useCallback } from 'react'

import { BMode, type BModeResult, type BModeScene, type BModeSettings } from '../components/BMode'
import { UC, withAlpha } from '../components/theme'

export type ConsolePhase =
  | 'welcome'
  | 'gain-power'
  | 'tgc'
  | 'depth'
  | 'frequency'
  | 'focus'
  | 'processing'
  | 'harmonics'
  | 'free'

export function ConsoleStage({
  scene,
  settings,
  phase,
  frameRateHz,
  penetrationCm,
  label,
  onResult,
}: {
  scene: BModeScene
  settings: BModeSettings
  phase: ConsolePhase
  frameRateHz: number
  /** Practical penetration depth in cm for the current settings. */
  penetrationCm: number
  label: string
  onResult?: (result: BModeResult) => void
}) {
  const overlay = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const depth = scene.depthCm
      const yOf = (cm: number) => (cm / depth) * height

      const note = (text: string, x: number, y: number, colour: string, align: CanvasTextAlign = 'left') => {
        ctx.save()
        ctx.font = '600 10px ui-sans-serif, system-ui, sans-serif'
        ctx.textAlign = align
        ctx.textBaseline = 'middle'
        const w = ctx.measureText(text).width + 10
        const bx = align === 'center' ? x - w / 2 : align === 'right' ? x - w + 5 : x - 5
        ctx.fillStyle = 'rgba(4, 12, 22, 0.82)'
        ctx.beginPath()
        ctx.roundRect(bx, y - 9, w, 18, 4)
        ctx.fill()
        ctx.fillStyle = colour
        ctx.fillText(text, x, y)
        ctx.restore()
      }

      /* Focus carets on the left edge — one per focal zone. */
      const zones = settings.focusCm ?? []
      zones.forEach((f) => {
        if (f <= 0 || f >= depth) return
        const y = yOf(f)
        ctx.save()
        ctx.fillStyle = UC.amber
        ctx.beginPath()
        ctx.moveTo(2, y - 6)
        ctx.lineTo(11, y)
        ctx.lineTo(2, y + 6)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      })

      /* Penetration marker: the depth beyond which echoes drown in noise. */
      if (penetrationCm < depth) {
        const y = yOf(penetrationCm)
        ctx.save()
        ctx.setLineDash([5, 5])
        ctx.strokeStyle = withAlpha(UC.red, 0.65)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.restore()
        note('penetration limit', width - 12, y - 12, UC.red, 'right')
      }

      /* Phase annotations — the guided walkthrough's pointer. */
      if (phase === 'gain-power') {
        note('POWER acts on transmit — exposure', width / 2, 22, UC.red, 'center')
        note('GAIN acts on receive — exposure unchanged', width / 2, height - 20, UC.green, 'center')
      } else if (phase === 'tgc') {
        for (let band = 1; band < 6; band += 1) {
          const y = (band / 6) * height
          ctx.save()
          ctx.setLineDash([3, 6])
          ctx.strokeStyle = withAlpha(UC.cyan, 0.4)
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(width, y)
          ctx.stroke()
          ctx.setLineDash([])
          ctx.restore()
        }
        note('near — little compensation needed', width / 2, 18, UC.cyan, 'center')
        note('far — most compensation needed', width / 2, height - 16, UC.cyan, 'center')
      } else if (phase === 'depth') {
        note(`depth ${depth.toFixed(1)} cm → frame rate ${frameRateHz.toFixed(0)} Hz`, width / 2, height - 16, UC.amber, 'center')
      } else if (phase === 'frequency') {
        note(`${settings.frequencyMHz.toFixed(1)} MHz — penetration ≈ ${penetrationCm.toFixed(1)} cm`, width / 2, 20, UC.cyan, 'center')
      } else if (phase === 'focus' && zones.length > 0) {
        const y = yOf(Math.min(zones[0], depth - 0.3))
        note('◀ focus: narrowest beam, sharpest laterally', 16, y, UC.amber)
      } else if (phase === 'processing') {
        note(`dynamic range ${settings.dynamicRangeDb} dB — contrast mapping`, width / 2, 20, UC.violet, 'center')
      } else if (phase === 'harmonics') {
        note(
          settings.harmonics ? 'receiving at 2f₀ — clutter rejected' : 'fundamental — near-field clutter present',
          width / 2,
          20,
          settings.harmonics ? UC.green : UC.amber,
          'center',
        )
      }
    },
    [scene.depthCm, settings.focusCm, settings.frequencyMHz, settings.dynamicRangeDb, settings.harmonics, phase, frameRateHz, penetrationCm],
  )

  return (
    <BMode
      scene={scene}
      settings={settings}
      overlay={overlay}
      label={label}
      onResult={onResult}
    />
  )
}
