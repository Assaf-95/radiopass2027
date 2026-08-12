/**
 * Parameter controls.
 *
 * Sliders show their numeric value beside them rather than only in a tooltip,
 * so the value is available without hovering and without colour. Presets animate
 * their parameters into place instead of replacing the screen, which keeps the
 * learner oriented while the curves move.
 */

import { useEffect, useRef, type ReactNode } from 'react'

import {
  clamp,
  isInversionRecovery,
  nullTime,
  PARAM_LIMITS,
  PRESET_LABELS,
  presetConfig,
  resolveTissue,
  TISSUES,
  validateSequence,
  type PresetId,
  type SequenceConfig,
  type TissueId,
} from '../engine'
import { useMri, useSimulation } from '../state/context'
import { LiveNotes, reportParamChange, reportPresetChange } from './LiveNotes'

export function Slider({
  param,
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  hint,
  markers,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
  hint?: string
  /** Named positions worth snapping to, such as a null point. */
  markers?: { value: number; label: string }[]
  /** Inert landmark (data-param) so Guided Mode can spotlight one control. */
  param?: string
}) {
  return (
    <div className="mri-slider" data-param={param}>
      <div className="mri-slider-head">
        <label htmlFor={`slider-${label}`}>{label}</label>
        <output htmlFor={`slider-${label}`}>
          {Math.round(value * 100) / 100}
          {unit ? <span> {unit}</span> : null}
        </output>
      </div>
      <input
        id={`slider-${label}`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {markers && markers.length > 0 && (
        <div className="mri-slider-markers">
          {markers.map((marker) => (
            <button
              key={marker.label}
              type="button"
              className="mri-chip mri-chip-small"
              onClick={() => onChange(marker.value)}
            >
              {marker.label} · {Math.round(marker.value)}
              {unit ? ` ${unit}` : ''}
            </button>
          ))}
        </div>
      )}
      {hint && <p className="mri-slider-hint">{hint}</p>}
    </div>
  )
}

/**
 * Eases the sequence parameters from where they are to a preset over a few
 * hundred milliseconds, so the graphs sweep into their new shape.
 */
const PRESET_TRANSITION_MS = 520

function useAnimatedPreset() {
  const { simulation } = useMri()
  const frameRef = useRef<number | null>(null)
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stop = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    if (settleRef.current !== null) clearTimeout(settleRef.current)
    frameRef.current = null
    settleRef.current = null
  }

  useEffect(() => stop, [])

  return (preset: Exclude<PresetId, 'custom'>) => {
    const target = presetConfig(preset)
    const start = simulation.getSnapshot().config
    const startedAt = performance.now()

    stop()

    // The sequence kind has to change immediately — you cannot be half an
    // inversion recovery — but the timings glide.
    const numericKeys = ['tr', 'te', 'ti', 'flipAngle', 't2Prime'] as const

    const settle = () => {
      stop()
      simulation.setConfig({ ...target })
    }

    const stepAnimation = (now: number) => {
      // The frame timestamp can legitimately predate the moment the animation
      // was scheduled, so the progress fraction is clamped at both ends. Without
      // the lower clamp a negative fraction extrapolates backwards past the
      // starting values and the parameters get pinned to their limits.
      const linear = clamp((now - startedAt) / PRESET_TRANSITION_MS, 0, 1)
      const eased = 1 - Math.pow(1 - linear, 3)
      const patch: Partial<SequenceConfig> = {
        kind: target.kind,
        refocus: target.refocus,
        preset,
        refocusTime: undefined,
      }
      for (const key of numericKeys) {
        patch[key] = start[key] + (target[key] - start[key]) * eased
      }
      simulation.setConfig(patch)
      if (linear < 1) {
        frameRef.current = requestAnimationFrame(stepAnimation)
      } else {
        settle()
      }
    }

    frameRef.current = requestAnimationFrame(stepAnimation)
    // Animation frames stop being delivered in a background tab. Without this
    // guarantee, switching away mid-transition would leave the sequence stuck
    // at whatever intermediate values the last frame happened to write.
    settleRef.current = setTimeout(settle, PRESET_TRANSITION_MS + 80)
  }
}

export function PresetBar({ presets }: { presets?: PresetId[] }) {
  const snapshot = useSimulation()
  const animateTo = useAnimatedPreset()
  const list: PresetId[] = presets ?? ['t1-se', 't2-se', 'pd-se', 'flair', 'stir', 'gre', 'custom']

  return (
    <div className="mri-presets" role="group" aria-label="Sequence presets">
      {list.map((preset) => (
        <button
          key={preset}
          type="button"
          className={snapshot.config.preset === preset ? 'mri-preset is-on' : 'mri-preset'}
          aria-pressed={snapshot.config.preset === preset}
          disabled={preset === 'custom'}
          onClick={() => {
            if (preset === 'custom') return
            reportPresetChange(preset)
            animateTo(preset)
          }}
        >
          {PRESET_LABELS[preset]}
        </button>
      ))}
    </div>
  )
}

export function SequenceControls({
  show = ['tr', 'te', 'ti'],
  nullTargets = [],
  children,
}: {
  show?: ('tr' | 'te' | 'ti' | 'flip' | 'field' | 'homogeneity')[]
  /** Tissues whose null point should be offered as a snap target on the TI slider. */
  nullTargets?: TissueId[]
  children?: ReactNode
}) {
  const snapshot = useSimulation()
  const { simulation } = useMri()
  const { config } = snapshot
  const issues = validateSequence(config)

  const update = (patch: Partial<SequenceConfig>) => {
    reportParamChange(patch, config)
    simulation.setConfig({ ...patch, preset: 'custom' })
  }

  const tiMarkers = nullTargets.map((id) => {
    const tissue = resolveTissue(id, config.fieldT, config.tissueOverrides)
    return { value: Math.round(nullTime(tissue.t1, config.tr)), label: `${tissue.name} null` }
  })

  return (
    <div className="mri-controls">
      <LiveNotes />
      {show.includes('tr') && (
        <Slider
          param="tr"
          label="TR"
          unit="ms"
          value={Math.round(config.tr)}
          min={PARAM_LIMITS.tr.min}
          max={PARAM_LIMITS.tr.max}
          step={10}
          onChange={(value) => update({ tr: value })}
          hint="How long each repetition lasts — how much longitudinal recovery is allowed before the next excitation."
        />
      )}
      {show.includes('te') && (
        <Slider
          param="te"
          label="TE"
          unit="ms"
          value={Math.round(config.te)}
          min={PARAM_LIMITS.te.min}
          max={PARAM_LIMITS.te.max}
          step={1}
          onChange={(value) => update({ te: value })}
          hint="How long after excitation the echo is sampled — how much transverse decay is allowed to happen first."
        />
      )}
      {show.includes('ti') && isInversionRecovery(config) && (
        <Slider
          param="ti"
          label="TI"
          unit="ms"
          value={Math.round(config.ti)}
          min={PARAM_LIMITS.ti.min}
          max={Math.min(PARAM_LIMITS.ti.max, Math.round(config.tr - config.te - 5))}
          step={5}
          onChange={(value) => update({ ti: value })}
          markers={tiMarkers}
          hint="The delay between the inversion pulse and the excitation pulse. Place it at a tissue's zero crossing to null that tissue."
        />
      )}
      {show.includes('flip') && (
        <Slider
          param="flip"
          label="Flip angle"
          unit="°"
          value={Math.round(config.flipAngle)}
          min={PARAM_LIMITS.flipAngle.min}
          max={PARAM_LIMITS.flipAngle.max}
          step={1}
          onChange={(value) => update({ flipAngle: value })}
          hint="How far the excitation pulse tips the magnetisation away from the z axis."
        />
      )}
      {show.includes('field') && (
        <Slider
          param="field"
          label="B₀"
          unit="T"
          value={config.fieldT}
          min={PARAM_LIMITS.fieldT.min}
          max={PARAM_LIMITS.fieldT.max}
          step={0.1}
          onChange={(value) => update({ fieldT: value })}
          hint="Higher field lengthens T1, which moves every null point. T2 is treated as unchanged here, which is a simplification."
        />
      )}
      {show.includes('homogeneity') && (
        <Slider
          param="homogeneity"
          label="T2′ (field homogeneity)"
          unit="ms"
          value={Math.round(config.t2Prime)}
          min={PARAM_LIMITS.t2Prime.min}
          max={PARAM_LIMITS.t2Prime.max}
          step={5}
          onChange={(value) => update({ t2Prime: value })}
          hint="Reversible dephasing from field inhomogeneity. A shorter T2′ means a less homogeneous field and faster T2* decay."
        />
      )}

      {children}

      {issues.length > 0 && (
        <ul className="mri-issues">
          {issues.map((issue) => (
            <li key={issue.message} className={`is-${issue.level}`}>
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function TissueSelector() {
  const { selectedTissues, setSelectedTissues, focusTissue, setFocusTissue } = useMri()

  const toggle = (id: TissueId) => {
    if (selectedTissues.includes(id)) {
      if (selectedTissues.length <= 2) return
      const next = selectedTissues.filter((item) => item !== id)
      setSelectedTissues(next)
      if (focusTissue === id) setFocusTissue(next[0])
    } else {
      setSelectedTissues([...selectedTissues, id])
    }
  }

  return (
    <div className="mri-tissue-select" role="group" aria-label="Tissues shown">
      {TISSUES.map((tissue) => {
        const active = selectedTissues.includes(tissue.id)
        return (
          <button
            key={tissue.id}
            type="button"
            className={active ? 'mri-tissue-chip is-on' : 'mri-tissue-chip'}
            aria-pressed={active}
            onClick={() => toggle(tissue.id)}
          >
            <span className="mri-swatch" style={{ background: tissue.colour }} aria-hidden="true" />
            {tissue.name}
          </button>
        )
      })}
    </div>
  )
}
