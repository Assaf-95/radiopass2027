/**
 * Control primitives for the ultrasound laboratory.
 *
 * Every control does three things: it changes the physics, it shows its own
 * value without needing a hover, and it announces the consequence of the change
 * immediately — the `flash` callback puts a message on the stage the instant the
 * learner moves the control, which is the difference between a lab and a form.
 */

import { useCallback, useRef, useState, type ReactNode } from 'react'

import { UsIcon, type UsIconName } from './icons'

/* ------------------------------------------------------------------ *
 * Consequence flash
 * ------------------------------------------------------------------ */

export type FlashItem = {
  text: string
  dir?: 'up' | 'down' | 'warn' | 'flat'
}

export type FlashApi = {
  items: FlashItem[] | null
  /** Show a set of consequences on the stage for a few seconds. */
  fire: (items: FlashItem[]) => void
  clear: () => void
}

const FLASH_MS = 3600

export function useFlash(): FlashApi {
  const [items, setItems] = useState<FlashItem[] | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fire = useCallback((next: FlashItem[]) => {
    if (timer.current) clearTimeout(timer.current)
    setItems(next)
    timer.current = setTimeout(() => setItems(null), FLASH_MS)
  }, [])

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    setItems(null)
  }, [])

  return { items, fire, clear }
}

const ARROW: Record<NonNullable<FlashItem['dir']>, string> = {
  up: '↑',
  down: '↓',
  warn: '!',
  flat: '=',
}

/** The floating consequence banner rendered inside the stage. */
export function StageFlash({ flash }: { flash: FlashApi }) {
  if (!flash.items || flash.items.length === 0) return null
  return (
    <div className="us-stage-flash" role="status" aria-live="polite">
      {flash.items.map((item, i) => (
        <span key={item.text} style={{ display: 'contents' }}>
          {i > 0 && <span className="us-flash-sep" aria-hidden="true" />}
          <span className={`us-flash-item is-${item.dir ?? 'flat'}`}>
            <b aria-hidden="true">{ARROW[item.dir ?? 'flat']}</b>
            {item.text}
          </span>
        </span>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Control group
 * ------------------------------------------------------------------ */

export function ControlGroup({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string
  icon?: UsIconName
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details className="us-group" open={defaultOpen}>
      <summary>
        {icon && <UsIcon name={icon} size={13} />}
        {title}
      </summary>
      <div className="us-group-body">{children}</div>
    </details>
  )
}

/* ------------------------------------------------------------------ *
 * Sliders and inputs
 * ------------------------------------------------------------------ */

let sliderSeq = 0

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  decimals,
  onChange,
  hint,
  markers,
  disabled,
  disabledReason,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  decimals?: number
  onChange: (value: number) => void
  hint?: ReactNode
  markers?: { value: number; label: string }[]
  disabled?: boolean
  disabledReason?: string
}) {
  const idRef = useRef<string>('')
  if (!idRef.current) {
    sliderSeq += 1
    idRef.current = `us-slider-${sliderSeq}`
  }
  const id = idRef.current
  const places = decimals ?? (step >= 1 ? 0 : step >= 0.1 ? 1 : 2)

  return (
    <div className="us-slider">
      <div className="us-slider-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>
          {value.toFixed(places)}
          {unit ? <span> {unit}</span> : null}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {markers && markers.length > 0 && (
        <div className="us-slider-markers">
          {markers.map((marker) => (
            <button
              key={marker.label}
              type="button"
              className="us-chip"
              onClick={() => onChange(marker.value)}
              disabled={disabled}
            >
              {marker.label}
            </button>
          ))}
        </div>
      )}
      {(hint || (disabled && disabledReason)) && (
        <p className="us-slider-hint" id={`${id}-hint`}>
          {disabled && disabledReason ? disabledReason : hint}
        </p>
      )}
    </div>
  )
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  hint?: ReactNode
}) {
  return (
    <label className="us-field">
      <span>{label}</span>
      <select
        className="us-select"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && <p className="us-slider-hint">{hint}</p>}
    </label>
  )
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  hint?: ReactNode
}) {
  return (
    <div>
      <label className="us-toggle">
        <span>{label}</span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="us-toggle-track" aria-hidden="true" />
      </label>
      {hint && <p className="us-slider-hint">{hint}</p>}
    </div>
  )
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="us-field">
      <span>{label}</span>
      <div className="us-segmented" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? 'is-on' : ''}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ChipRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string
  value: T
  options: { value: T; label: string; colour?: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="us-field">
      {label && <span>{label}</span>}
      <div className="us-chip-row" role="group" aria-label={label ?? 'Options'}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? 'us-chip is-on' : 'us-chip'}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.colour && <i style={{ background: option.colour }} aria-hidden="true" />}
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** A row of TGC sliders, each governing one depth band. */
export function TgcSliders({
  values,
  onChange,
  maxDb = 30,
}: {
  values: number[]
  onChange: (values: number[]) => void
  maxDb?: number
}) {
  return (
    <div className="us-field">
      <span>Time gain compensation</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {values.map((value, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Which depth band this slider governs, and what it currently
                reads: both are labels on a control, so they take the metadata
                size from the token scale rather than a hand-picked 10px. The
                fixed widths grew with them so "Band 3" and "24 dB" still sit on
                one line and the sliders stay vertically aligned. */}
            <small
              style={{
                width: 66,
                flex: 'none',
                fontSize: 'var(--fs-meta)',
                color: 'var(--us-muted)',
              }}
            >
              {i === 0 ? 'Near' : i === values.length - 1 ? 'Far' : `Band ${i + 1}`}
            </small>
            <input
              type="range"
              min={0}
              max={maxDb}
              step={1}
              value={value}
              aria-label={`Time gain compensation, depth band ${i + 1} of ${values.length}`}
              onChange={(event) => {
                const next = [...values]
                next[i] = Number(event.target.value)
                onChange(next)
              }}
              style={{ flex: 1 }}
            />
            <small
              style={{
                width: 54,
                flex: 'none',
                fontSize: 'var(--fs-meta)',
                color: 'var(--us-cyan)',
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {value} dB
            </small>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ResetButton({ onClick, label = 'Reset experiment' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="us-btn" onClick={onClick}>
      <UsIcon name="reset" size={13} />
      {label}
    </button>
  )
}
