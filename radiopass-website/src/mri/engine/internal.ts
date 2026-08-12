/** Small numeric helpers shared across the engine. */

const EPS = 1e-9

/** e^(−t/τ), clamped so that negative times and zero constants stay finite. */
export function expDecay(t: number, tau: number): number {
  if (!Number.isFinite(t) || !Number.isFinite(tau)) return 0
  return Math.exp(-Math.max(0, t) / Math.max(tau, EPS))
}

/** Replaces non-finite values with zero so nothing can poison a canvas draw. */
export function safeSignal(value: number): number {
  return Number.isFinite(value) ? value : 0
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u
}
