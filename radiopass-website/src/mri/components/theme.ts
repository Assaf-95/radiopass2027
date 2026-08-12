/**
 * Canvas drawing palette.
 *
 * Canvas cannot read CSS custom properties, so the values the drawings need
 * live here and are mirrored by the same names in mri.css. The palette extends
 * the site's existing dark surface and violet MRI accent rather than introducing a
 * second visual language.
 */

export const PALETTE = {
  background: '#05070a',
  panel: '#101216',
  panelRaised: '#171a20',
  grid: 'rgba(255,255,255,0.05)',
  gridStrong: 'rgba(255,255,255,0.11)',
  axis: '#5d6672',
  axisBright: '#c3cbd6',
  text: '#eef1f4',
  textMuted: '#98a1ad',
  /* RadioPass accent — state only. */
  accent: '#A99EDB',
  teal: '#75d9c0',
  amber: '#f0b56a',
  rose: '#ff8f8f',
  violet: '#b49cff',
  /* Longitudinal magnetisation keeps the accent: it is what recovers. */
  longitudinal: '#A99EDB',
  /* Transverse magnetisation and signal are cyan throughout. */
  transverse: '#63d3f5',
  /* The net vector leads, in white. */
  net: '#ffffff',
  /* Radiofrequency events are violet — never confusable with a tissue. */
  rf: '#b49cff',
  inversion: '#ff8fc4',
  acquire: '#63d3f5',
  playhead: '#ffffff',
} as const

/**
 * Canvas typography.
 *
 * Axis names and pulse names are set in the site's sans; anything that is a
 * number, a unit or a scale marking is set in the mono, for the same reason a
 * real console does it — digits keep their column as values change, so a
 * readout ticking at 60 Hz does not visibly jitter.
 */
export const FONTS = {
  label: '600 11px "DM Sans", system-ui, sans-serif',
  /** Numeric readouts. */
  small: '500 10px "IBM Plex Mono", ui-monospace, Menlo, monospace',
  /** Axis tick values and scale markings. */
  tiny: '400 9px "IBM Plex Mono", ui-monospace, Menlo, monospace',
  /** Event name plates. */
  value: '600 12px "IBM Plex Mono", ui-monospace, Menlo, monospace',
  /** Small caption text that is prose rather than data. */
  caption: '500 9px "DM Sans", system-ui, sans-serif',
} as const

/** Mixes a hex colour with the background to fake depth without blend modes. */
export function fade(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Grey level for a 0–1 brightness, matching how the image panel renders. */
export function greyscale(brightness: number): string {
  const level = Math.round(Math.min(1, Math.max(0, brightness)) * 255)
  return `rgb(${level},${level},${level})`
}

/**
 * Snaps a coordinate to the half-pixel grid so a 1px stroke lands on exactly
 * one row of device pixels instead of bleeding across two. Only worth applying
 * to axis-aligned hairlines — curves and diagonals want normal anti-aliasing.
 */
export function crisp(value: number): number {
  return Math.round(value) + 0.5
}
