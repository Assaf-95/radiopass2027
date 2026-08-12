/**
 * Where the learner currently is, published for the module bar.
 *
 * The module bar lives in the page shell and the stage lives in the workspace,
 * so one has to tell the other. A tiny store does it without threading a prop
 * through every page or lifting the whole workspace state upwards — and it
 * keeps the location stated in exactly one place on screen, which is the point
 * of removing the duplicated stage indicators.
 *
 * Safe as a singleton because one laboratory is mounted at a time; it is reset
 * when a laboratory mounts so a stale stage never leaks across a navigation.
 */

let current: string | null = null
const listeners = new Set<() => void>()

export function setLabLocation(label: string | null) {
  if (current === label) return
  current = label
  listeners.forEach((listener) => listener())
}

export function subscribeLabLocation(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getLabLocation() {
  return current
}
