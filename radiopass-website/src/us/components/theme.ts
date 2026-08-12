/**
 * Canvas palette.
 *
 * A canvas context cannot read a CSS custom property, so the drawing colours
 * live here and are mirrored by the `--us-*` variables in us.css. Change one,
 * change the other.
 */

export const UC = {
  bg: '#04090f',
  bgDeep: '#030710',
  panel: '#0a1524',
  panel2: '#0e1e31',
  grid: 'rgba(82, 220, 255, 0.10)',
  gridFaint: 'rgba(82, 220, 255, 0.05)',
  line: 'rgba(125, 190, 255, 0.22)',
  text: '#dce9f7',
  muted: '#8199b3',
  dim: '#5f748c',
  cyan: '#52dcff',
  blue: '#6a9bff',
  green: '#3fe3a4',
  amber: '#ffb03a',
  red: '#ff6472',
  violet: '#b18cff',
  white: '#ffffff',
} as const

/** Greyscale ramp used by every B-mode surface, so images look consistent. */
export function greyFor(level: number, opacity = 1): string {
  const v = Math.round(Math.max(0, Math.min(1, level)) * 255)
  return opacity >= 1 ? `rgb(${v},${v},${v})` : `rgba(${v},${v},${v},${opacity})`
}

export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Sets up a canvas for the device pixel ratio and returns the CSS-pixel size. */
export function prepareCanvas(
  canvas: HTMLCanvasElement,
): { ctx: CanvasRenderingContext2D; width: number; height: number } | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const rect = canvas.getBoundingClientRect()
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))
  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr
    canvas.height = height * dpr
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  return { ctx, width, height }
}

/** The faint instrument graticule drawn behind most stage canvases. */
export function drawGraticule(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  spacing = 40,
) {
  ctx.save()
  ctx.strokeStyle = UC.gridFaint
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = spacing; x < width; x += spacing) {
    ctx.moveTo(Math.round(x) + 0.5, 0)
    ctx.lineTo(Math.round(x) + 0.5, height)
  }
  for (let y = spacing; y < height; y += spacing) {
    ctx.moveTo(0, Math.round(y) + 0.5)
    ctx.lineTo(width, Math.round(y) + 0.5)
  }
  ctx.stroke()
  ctx.restore()
}

export function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: {
    colour?: string
    align?: CanvasTextAlign
    baseline?: CanvasTextBaseline
    size?: number
    weight?: number
    background?: boolean
  } = {},
) {
  const {
    colour = UC.muted as string,
    align = 'left',
    baseline = 'middle',
    size = 11,
    weight = 600,
    background = false,
  } = options
  ctx.save()
  ctx.font = `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, sans-serif`
  ctx.textAlign = align
  ctx.textBaseline = baseline
  if (background) {
    const metrics = ctx.measureText(text)
    const padX = 5
    const padY = 3
    const w = metrics.width + padX * 2
    const h = size + padY * 2
    const bx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x - padX
    const by = baseline === 'middle' ? y - h / 2 : baseline === 'bottom' ? y - h : y - padY
    ctx.fillStyle = 'rgba(4, 12, 22, 0.82)'
    ctx.beginPath()
    ctx.roundRect(bx, by, w, h, 4)
    ctx.fill()
  }
  ctx.fillStyle = colour
  ctx.fillText(text, x, y)
  ctx.restore()
}

/** An arrow head at (x, y) pointing along `angle` radians. */
export function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  size = 7,
  colour: string = UC.cyan,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.fillStyle = colour
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-size, size * 0.5)
  ctx.lineTo(-size, -size * 0.5)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

export function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  colour: string = UC.line,
  dash: number[] = [4, 4],
) {
  ctx.save()
  ctx.setLineDash(dash)
  ctx.strokeStyle = colour
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.restore()
}
