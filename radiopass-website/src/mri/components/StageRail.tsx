/**
 * The stage progress rail.
 *
 * This replaces a tall column of stage cards that restated the lesson structure
 * a second time, took a third of the screen, and competed with the instrument
 * for attention. A rail says the same thing — how many stages there are, which
 * one you are on, how far through you are — in one line.
 *
 * The active stage is signalled by luminance, size, a glow and an accompanying
 * text label, never by colour alone. Each stop is a real button, so the rail is
 * operable by keyboard and announces itself properly.
 */

import type { SequenceConfig, Tissue } from '../engine'
import type { TeachingStep } from './Workbench'

export type StageRailProps = {
  steps: TeachingStep[]
  activeIndex: number
  config: SequenceConfig
  tissues: Tissue[]
  onSelect: (index: number) => void
  /** Times, in ms, each stage corresponds to. */
  times: number[]
}

export function StageRail({ steps, activeIndex, onSelect, times }: StageRailProps) {
  if (steps.length === 0) return null

  return (
    <nav
      className="mri-rail"
      aria-label={`Lesson stages, ${activeIndex + 1} of ${steps.length}`}
    >
      <ol>
        {steps.map((step, index) => {
          const state =
            index === activeIndex ? 'is-current' : index < activeIndex ? 'is-done' : ''
          return (
            <li key={step.title} className={state}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-current={index === activeIndex ? 'step' : undefined}
                aria-label={`Stage ${index + 1} of ${steps.length}: ${step.title}, at ${Math.round(
                  times[index],
                )} milliseconds`}
                title={step.title}
              >
                <span className="mri-rail-dot" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ol>
      <p className="mri-rail-position">
        <span>
          {String(activeIndex + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
        </span>
      </p>
    </nav>
  )
}
