/**
 * The RadioPass logo system — vector-first, one geometry everywhere.
 *
 * THE IDENTITY IS THE RADIOGRAPHIC CHAIN: a focal spot, a diverging beam,
 * the body it passes through, and the detector that receives it — with one
 * warm band on the detector where the image was formed. It is the diagram on
 * the first page of every radiology physics text, and it is exactly what
 * RadioPass teaches: how the beam becomes the picture.
 *
 * It replaced an abstract "converging flow lines" mark that read as a signal
 * logo rather than a radiology one (owner, 19 Aug 2026: "has nothing to do
 * with radiology"). The palette and typography it sits in are unchanged.
 *
 * Rules encoded here:
 *  - No baked background, no baked glow. Any glow is optional CSS outside.
 *  - Three colour channels with a currentColor fallback, so the same paths
 *    serve dark, light and one-colour monochrome:
 *      --logo-flow   the apparatus: beam edges, body, detector (cool)
 *      --logo-focus  the focal spot (brightest point)
 *      --logo-image  the formed image on the detector (the one warm mark)
 *    Set none of them and the whole mark renders in currentColor — that IS
 *    the monochrome version for print and examination material.
 *  - The wordmark is RADIOPASS, one word, letterspaced caps in the display
 *    face. It is real text (accessible, selectable), not paths.
 */

const FLOW = 'var(--logo-flow, currentColor)'
const FOCUS = 'var(--logo-focus, currentColor)'
const IMAGE = 'var(--logo-image, currentColor)'

/**
 * The mark alone.
 *
 * `detail="full"` carries the whole chain including the body in the beam.
 * `detail="compact"` drops the body — below about 22px the ellipse closes up
 * and muddies the beam, so the small mark keeps only spot, beam, detector
 * and image, which still reads as projection geometry at favicon size.
 */
export function LogoMark({
  height = 26,
  detail = 'full',
  className,
}: {
  height?: number
  detail?: 'full' | 'compact'
  className?: string
}) {
  if (detail === 'compact') {
    return (
      <svg
        className={className}
        height={height}
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M5 20 L30 8 L30 32 Z" fill={FLOW} opacity="0.12" />
        <path d="M5 20 L30 8 M5 20 L30 32" stroke={FLOW} strokeWidth="1.6" opacity="0.6" fill="none" />
        <line x1="33" y1="8" x2="33" y2="32" stroke={FLOW} strokeWidth="3.2" strokeLinecap="round" />
        <line x1="33" y1="15" x2="33" y2="25" stroke={IMAGE} strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="5" cy="20" r="3.4" fill={FOCUS} />
      </svg>
    )
  }
  return (
    <svg
      className={className}
      height={height}
      viewBox="0 0 56 40"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* The beam: a diverging cone from the focal spot, its interior barely
          lit so the mark stays a line drawing rather than a solid wedge. */}
      <path d="M6 20 L45 5.5 L45 34.5 Z" fill={FLOW} opacity="0.07" />
      <path d="M6 20 L45 5.5 M6 20 L45 34.5" stroke={FLOW} strokeWidth="0.9" opacity="0.5" fill="none" />
      {/* The body in the beam — the thing being imaged. */}
      <ellipse cx="27" cy="20" rx="5.2" ry="7.2" stroke={FLOW} strokeWidth="1" fill={FLOW} fillOpacity="0.1" />
      {/* The detector, and the image formed on it. */}
      <line x1="47" y1="6" x2="47" y2="34" stroke={FLOW} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="47" y1="15" x2="47" y2="25" stroke={IMAGE} strokeWidth="2.2" strokeLinecap="round" />
      {/* The focal spot: the brightest point on the mark, as it is in life. */}
      <circle cx="6" cy="20" r="2.6" fill={FOCUS} />
    </svg>
  )
}

/**
 * The horizontal lockup: mark + RADIOPASS (+ optional branch word set
 * quietly after it: "Anatomy", "Physics"). The wordmark inherits the
 * text colour of its context; sizing and tracking live in CSS on
 * .rp-logo / .rp-logo-word / .rp-logo-branch so each header keeps its own
 * scale without redrawing the mark.
 */
export function Logo({
  branch,
  markHeight = 26,
  className = 'rp-logo',
}: {
  branch?: string
  markHeight?: number
  className?: string
}) {
  return (
    <span className={className}>
      <LogoMark height={markHeight} detail={markHeight >= 22 ? 'full' : 'compact'} />
      <span className="rp-logo-word">
        RADIOPASS
        {branch && <span className="rp-logo-branch">{branch}</span>}
      </span>
    </span>
  )
}
