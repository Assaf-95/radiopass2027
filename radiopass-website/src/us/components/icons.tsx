/**
 * Line icons for the ultrasound laboratory.
 *
 * Same 24-unit grid, same stroke weight and same visual weight as the icons on
 * the rest of the site, so the module does not introduce a second icon language.
 */

import type { ReactNode } from 'react'

export type UsIconName =
  | 'alias'
  | 'back'
  | 'beam'
  | 'book'
  | 'bubble'
  | 'check'
  | 'close'
  | 'decay'
  | 'equation'
  | 'exam'
  | 'eye'
  | 'flow'
  | 'ghost'
  | 'harmonic'
  | 'layers'
  | 'lightbulb'
  | 'next'
  | 'pause'
  | 'phantom'
  | 'play'
  | 'previous'
  | 'probe'
  | 'probes'
  | 'pulse'
  | 'reflect'
  | 'refract'
  | 'replay'
  | 'reset'
  | 'search'
  | 'shield'
  | 'sliders'
  | 'spark'
  | 'strain'
  | 'target'
  | 'trap'
  | 'wave'

const paths: Record<UsIconName, ReactNode> = {
  alias: <><path d="M2 12h3l3-7 4 14 3-9 2 4h5" /><path d="M17 4l4 4-4 4" /></>,
  back: <><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></>,
  beam: <><path d="M12 3v3" /><path d="M6 6h12l3 15H3L6 6Z" opacity=".35" /><path d="M9 6h6l1.5 15h-9L9 6Z" /></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /><path d="M8 7h8M8 11h6" /></>,
  bubble: <><circle cx="9" cy="10" r="4" /><circle cx="16" cy="15" r="3" /><circle cx="17" cy="7" r="1.8" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  decay: <><path d="M3 5v16h18" /><path d="M4 7c5 0 5 12 16 12" /></>,
  equation: <><path d="M4 8h16M4 16h16" /><path d="M9 4 7 20M17 4l-2 16" /></>,
  exam: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8M8 15h5" /></>,
  eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
  flow: <><path d="M3 8h11a4 4 0 0 1 0 8H6" /><path d="m9 13-3 3 3 3" /><circle cx="18" cy="8" r="1.4" fill="currentColor" /></>,
  ghost: <><path d="M5 21V10a7 7 0 0 1 14 0v11l-3-2-2 2-2-2-2 2-2-2-3 2Z" /><path d="M9.5 10h.01M14.5 10h.01" /></>,
  harmonic: <><path d="M2 12h2c1 0 1-6 2-6s1 12 2 12 1-9 2-9 1 6 2 6" /><path d="M14 12h8" opacity=".5" /><path d="M14 8c1 0 1-2 2-2s1 4 2 4 1-3 2-3 1 2 2 2" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /><path d="m3 17.5 9 5 9-5" opacity=".5" /></>,
  lightbulb: <><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a6 6 0 0 0-4 10.5c.8.9 1 1.6 1 2.5v1h6v-1c0-.9.2-1.6 1-2.5A6 6 0 0 0 12 2Z" /></>,
  next: <><path d="m9 6 6 6-6 6" /></>,
  pause: <><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" /></>,
  phantom: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8" cy="9" r="1" fill="currentColor" /><circle cx="12" cy="9" r="1" fill="currentColor" /><circle cx="16" cy="9" r="1" fill="currentColor" /><circle cx="9" cy="15" r="2.5" /></>,
  play: <path d="m8 5 11 7-11 7z" fill="currentColor" stroke="none" />,
  previous: <><path d="m15 6-6 6 6 6" /></>,
  probe: <><path d="M9 2h6v9l-3 11-3-11V2Z" /><path d="M9 7h6" /><path d="M9 10h6" /></>,
  probes: <><rect x="3" y="3" width="7" height="5" rx="1" /><path d="M14 3h7v5a3.5 3.5 0 0 1-7 0V3Z" /><path d="M6.5 13v8M17.5 13v8" opacity=".55" /><rect x="3" y="15" width="7" height="6" rx="3" opacity=".55" /></>,
  pulse: <><path d="M2 12h4l2-7 4 14 2.5-9 1.5 2h6" /></>,
  reflect: <><path d="M3 20h18" /><path d="m5 18 7-13" /><path d="m19 18-7-13" opacity=".6" /><path d="M12 5v-3" strokeDasharray="2 2" /></>,
  refract: <><path d="M2 12h20" opacity=".35" /><path d="m3 5 9 7" /><path d="m12 12 8 7" /><path d="M12 4v16" strokeDasharray="2 2" opacity=".6" /></>,
  replay: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></>,
  reset: <><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
  sliders: <><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="16" cy="18" r="2" /></>,
  spark: <><path d="m12 3-1.4 4.6L6 9l4.6 1.4L12 15l1.4-4.6L18 9l-4.6-1.4L12 3Z" /><path d="m5 15-.8 2.2L2 18l2.2.8L5 21l.8-2.2L8 18l-2.2-.8L5 15Z" /></>,
  strain: <><path d="M4 4h16v6H4z" opacity=".4" /><path d="M4 14h16v6H4z" /><path d="M8 10v4M12 10v4M16 10v4" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></>,
  trap: <><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></>,
  wave: <path d="M2 12h3l2-6 4 12 3-9 2 6h6" />,
}

export function UsIcon({
  name,
  size = 16,
  strokeWidth = 1.8,
}: {
  name: UsIconName
  size?: number
  strokeWidth?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
