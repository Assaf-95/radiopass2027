/**
 * jsdom shims for the MRI module.
 *
 * The visualisations draw to canvas and measure themselves with
 * ResizeObserver; jsdom provides neither. These stubs let the components mount
 * and run their render loops so that behaviour can be asserted, while the
 * drawing calls themselves become no-ops.
 */

import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!('ResizeObserver' in globalThis)) {
  ;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
    ResizeObserverStub
}

if (!('matchMedia' in window)) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

const canvasContextStub = () =>
  new Proxy(
    {
      canvas: document.createElement('canvas'),
      measureText: () => ({ width: 40 }),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      setLineDash: () => {},
    } as Record<string, unknown>,
    {
      get(target, prop) {
        if (prop in target) return target[prop as string]
        return () => undefined
      },
      set(target, prop, value) {
        target[prop as string] = value
        return true
      },
    },
  )

HTMLCanvasElement.prototype.getContext = vi.fn(
  canvasContextStub,
) as unknown as HTMLCanvasElement['getContext']

// jsdom leaves getBoundingClientRect at zero, which would make every canvas
// size to nothing. Give elements a plausible desktop box.
Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return { x: 0, y: 0, width: 900, height: 500, top: 0, left: 0, right: 900, bottom: 500, toJSON: () => ({}) } as DOMRect
}

afterEach(() => {
  cleanup()
})
