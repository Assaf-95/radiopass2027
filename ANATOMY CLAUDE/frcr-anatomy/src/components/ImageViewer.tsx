import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { ImageOrientation } from '../types';
import './ImageViewer.css';

/* How a label points at its structure. Different structures want different
   pointers: an arrow for something you can aim at, a ring to enclose an area
   rather than pick a spot, a bare dot where an arrow would cover the anatomy,
   a plain line where an arrowhead would be too heavy. */
export type MarkerShape = 'arrow' | 'point' | 'line' | 'circle' | 'arrow-point';

interface ImageMarker {
  /** Unique per rendered badge. Needed because one letter can legitimately
   * appear several times on a single atlas page. */
  id?: string;
  label: string;
  /** Per-badge diameter as a % of image width. Lets each badge be sized to
   * the specific glyph it covers, instead of one blanket size that would be
   * needlessly large for the smallest letter on the page. */
  sizePct?: number;
  // Arrow TIP — the actual anatomical structure being pointed at. Percentages
  // 0-100 of the image's rendered box, so they stay aligned at any zoom/size.
  x: number;
  y: number;
  // Badge centre. Offset away from the tip so the letter never covers the
  // structure it identifies. Defaults via defaultLabelPos() when absent.
  labelX?: number;
  labelY?: number;
  /** Shaft width. Percentage-of-image units like every other geometry here,
   * so an arrow keeps its weight at any zoom or screen size. */
  thickness?: number;
  /** Arrowhead size, independent of shaft width — a fine arrow may still need
   * a head large enough to read, and a short arrow a small one. */
  headSize?: number;
  /** Defaults to 'arrow', which is what every existing question uses. */
  shape?: MarkerShape;
  /** Ring diameter as a % of image width, for the 'circle' shape. */
  circlePct?: number;
  /** Pointer colour, matching the four offered by the authoring editor. White
   * when absent, which is what every extracted question uses. Authored
   * colours used to be stored and then silently dropped here, so the editor's
   * colour swatches changed the saved data and nothing a candidate saw. */
  colour?: MarkerColour;
  /** Polar form of the badge offset, as authored in the editor's angle and
   * size dials: the badge sits `lengthPct` of the image width away from the
   * structure, in direction `angle` (0 = right, 90 = down), and the leader
   * line joins the two. Ignored when an explicit labelX/labelY is given. */
  angle?: number;
  lengthPct?: number;
}

export type MarkerColour = 'white' | 'black' | 'yellow' | 'blue';

/* Kept in step with the swatches in ReplaceImageEditor.css. */
const COLOURS: Record<MarkerColour, string> = {
  white: '#ffffff',
  black: '#000000',
  yellow: '#ffd23f',
  blue: '#4db2ff',
};

function inkOf(m: { colour?: MarkerColour }): string {
  return COLOURS[m.colour ?? 'white'];
}

/* Every pointer is drawn twice: a wider contrasting stroke underneath, then
   the ink on top. A 0.55px white hairline is invisible against the bright
   mediastinum and a black one disappears into a lung field — the pointer was
   being drawn correctly and simply could not be seen on a radiograph. */
function haloOf(m: { colour?: MarkerColour }): string {
  return (m.colour ?? 'white') === 'black' ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.9)';
}

/** Default stroke weight, as a percentage of the film's width. Expressed that
 *  way — rather than in raw pixels — so a pointer keeps the same weight
 *  relative to the anatomy on the authoring stage and on the candidate's
 *  larger viewer, which is what makes the editor's preview trustworthy. */
export const DEFAULT_THICKNESS_PCT = 0.5;
/** Extra width given to the contrasting halo, in screen pixels. */
const HALO_EXTRA = 2.2;

/* An id has to survive being written into url(#...), so anything that is not a
   letter or digit is flattened — the colour may be a hex or an rgba(). */
function headId(headSize: number, ink: string): string {
  return `iv-arrowhead-${String(headSize).replace(/\W/g, '_')}-${ink.replace(/\W/g, '')}`;
}

// Places the badge clear of the structure while keeping it inside the frame:
// pushes toward whichever side has room, then clamps so the badge and its
// leader line are never cut off at an edge.
export function defaultLabelPos(x: number, y: number): { labelX: number; labelY: number } {
  const dx = x < 50 ? 11 : -11;
  const dy = y < 50 ? 9 : -9;
  return {
    labelX: Math.min(93, Math.max(7, x + dx)),
    labelY: Math.min(93, Math.max(7, y + dy)),
  };
}

export interface ImageCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ImageViewerProps {
  src: string;
  alt: string;
  markers?: ImageMarker[];
  markerSizePct?: number;
  /** Shows only this region of the file, as fractions of its own dimensions.
   * Used to cut the printed question stem off a scanned page. Everything
   * downstream — the contained box, marker percentages, zoom and pan — then
   * works against the cropped image, so a marker at 50%/50% sits in the
   * middle of what the candidate can actually see. */
  crop?: ImageCrop;
  /** Turns a film that was extracted rotated or mirrored the right way up.
   * Applied after the crop; markers are already in the oriented space, so
   * this only changes how the pixels are drawn. */
  orientation?: ImageOrientation;
}

interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
  brightness: number;
  contrast: number;
  inverted: boolean;
}

const DEFAULT_STATE: ViewState = {
  zoom: 1,
  panX: 0,
  panY: 0,
  brightness: 100,
  contrast: 100,
  inverted: false,
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

/* Memoised: the question player re-renders on every keystroke as the
   candidate types their answer, and none of that touches the film. Its
   `markers` array is memoised per question, so the props compare equal and
   this whole subtree — image box measurement, marker layer, arrowhead defs —
   is skipped. */
function ImageViewer({ src, alt, markers, markerSizePct = 6, crop, orientation }: ImageViewerProps) {
  /* A quarter turn swaps which way round the film is, so the box it has to be
     fitted into swaps with it. */
  const rotate = orientation?.rotate ?? 0;
  const quarterTurn = rotate === 90 || rotate === 270;
  const [state, setState] = useState<ViewState>(DEFAULT_STATE);
  const [fullscreen, setFullscreen] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // CSS percentage max-height only resolves against an ancestor with an
  // EXPLICITLY set height, not one that's merely capped by its own
  // max-height (a max-height cap never counts as "definite" for a
  // descendant's percentage resolution — a well-known CSS gotcha). That
  // silently let tall images overflow their pane and get clipped. Computing
  // the actual contained box ourselves sidesteps the whole fragile chain,
  // and — as a side benefit — keeps marker percentages correctly aligned to
  // the real image content even when object-fit:contain letterboxes it.
  const [imgBox, setImgBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const recomputeImgBox = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.naturalWidth || !img.naturalHeight) return;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (!cw || !ch) return;
    // The visible image is the cropped region, so it — not the file — is what
    // gets fitted to the pane. A quarter turn is applied before the fit, or a
    // portrait film rotated to landscape would be measured portrait and end up
    // overflowing the pane it was supposed to be contained in.
    const cropW = img.naturalWidth * (crop ? crop.w : 1);
    const cropH = img.naturalHeight * (crop ? crop.h : 1);
    const natW = quarterTurn ? cropH : cropW;
    const natH = quarterTurn ? cropW : cropH;
    const scale = Math.min(cw / natW, ch / natH);
    const width = natW * scale;
    const height = natH * scale;
    setImgBox({ left: (cw - width) / 2, top: (ch - height) / 2, width, height });
  }, [crop, quarterTurn]);

  useEffect(() => {
    recomputeImgBox();
  }, [recomputeImgBox, src, fullscreen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => recomputeImgBox());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [recomputeImgBox]);

  const reset = useCallback(() => setState((s) => ({ ...DEFAULT_STATE, brightness: s.brightness, contrast: s.contrast, inverted: s.inverted })), []);
  const fitToScreen = reset;
  const actualSize = useCallback(() => setState((s) => ({ ...s, zoom: 1, panX: 0, panY: 0 })), []);

  const zoomBy = useCallback((delta: number) => {
    setState((s) => {
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s.zoom + delta));
      if (nextZoom === s.zoom) return s;
      return { ...s, zoom: nextZoom, panX: nextZoom === MIN_ZOOM ? 0 : s.panX, panY: nextZoom === MIN_ZOOM ? 0 : s.panY };
    });
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!fullscreen) return;
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 0.25 : -0.25);
  }, [fullscreen, zoomBy]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (state.zoom <= MIN_ZOOM) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: state.panX, panY: state.panY };
  }, [state.zoom, state.panX, state.panY]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setState((s) => ({ ...s, panX: dragRef.current!.panX + dx, panY: dragRef.current!.panY + dy }));
  }, []);

  const endDrag = useCallback(() => { dragRef.current = null; }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
      if (e.key === '+' || e.key === '=') zoomBy(0.25);
      if (e.key === '-') zoomBy(-0.25);
      if (e.key === '0') reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen, zoomBy, reset]);

  // basic pinch-to-zoom support
  const pinchRef = useRef<number | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = Math.hypot(dx, dy);
    } else if (e.touches.length === 1 && state.zoom > MIN_ZOOM) {
      dragRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, panX: state.panX, panY: state.panY };
    }
  }, [state.zoom, state.panX, state.panY]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current != null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const delta = (dist - pinchRef.current) / 100;
      pinchRef.current = dist;
      zoomBy(delta);
    } else if (e.touches.length === 1 && dragRef.current) {
      const dx = e.touches[0].clientX - dragRef.current.startX;
      const dy = e.touches[0].clientY - dragRef.current.startY;
      setState((s) => ({ ...s, panX: dragRef.current!.panX + dx, panY: dragRef.current!.panY + dy }));
    }
  }, [zoomBy]);

  const onTouchEnd = useCallback(() => { pinchRef.current = null; dragRef.current = null; }, []);

  // Two overlay modes, distinguished by whether a badge position was given:
  //  - REPLACE (no labelX/labelY): the badge sits exactly on the label the
  //    source atlas already printed, covering it. The source's own arrow is
  //    part of the image and still points where it always did, so drawing
  //    another one would duplicate it.
  //  - ARROW (labelX/labelY present): a custom case, where the badge is
  //    offset off the structure and we draw the leader line ourselves.
  /* An editor-authored pointer states its badge offset in polar form (angle +
     length) rather than as an absolute labelX/labelY, because that is what the
     two dials produce. Resolving it here — the one place that knows the
     rendered image box — keeps the visual angle honest: percentages are of
     width horizontally but of HEIGHT vertically, so the y component has to be
     scaled by the aspect ratio or a "45°" arrow comes out at some other angle
     on any non-square film. Without this the dials moved nothing at all. */
  const resolved = (markers ?? []).map((m) => {
    if (m.labelX != null && m.labelY != null) return m;
    if (!imgBox || !imgBox.height) return m;
    const clamp = (v: number) => Math.min(96, Math.max(4, v));
    const shape = m.shape ?? 'arrow';

    /* A bare dot marks a spot precisely because it does not cover it — so the
       letter has to sit clear of it, exactly as the editor draws it. Left
       centred on the tip the badge sat right on top of its own dot and the
       "point" style was indistinguishable from a plain badge. */
    if (shape === 'point') {
      const lift = (m.sizePct ?? markerSizePct) * 1.15 * (imgBox.width / imgBox.height);
      return { ...m, labelX: clamp(m.x), labelY: clamp(m.y - lift) };
    }
    /* A ring encloses its region; the letter belongs in the middle of it, and
       there is no source glyph under it to mask out. */
    if (shape === 'circle') return { ...m, labelX: m.x, labelY: m.y };

    if (m.lengthPct == null) return m;
    const a = ((m.angle ?? 0) * Math.PI) / 180;
    const dx = m.lengthPct * Math.cos(a);
    const dy = m.lengthPct * Math.sin(a) * (imgBox.width / imgBox.height);
    return { ...m, labelX: clamp(m.x + dx), labelY: clamp(m.y + dy) };
  });

  /* Strokes are non-scaling, so they are set in screen pixels — converted here
     from the authored percentage against the film's rendered width. */
  const strokePx = (pct: number | undefined) =>
    Math.max(1, ((pct ?? DEFAULT_THICKNESS_PCT) / 100) * (imgBox?.width ?? 600));

  /* markerUnits="strokeWidth" makes the head a fixed MULTIPLE of the shaft, so
     a heavy stroke on a short leader produced a head longer than the arrow it
     belonged to. Held to a fraction of the leader's own length instead, the
     head stays in proportion at every weight. */
  function headUnits(m: ImageMarker, strokeW: number, leaderPx: number): number {
    const wanted = m.headSize ?? 5;
    const maxByLeader = (leaderPx * 0.4) / Math.max(strokeW, 0.001);
    return Math.max(2, Math.min(wanted, maxByLeader));
  }

  const arrowMarkers = resolved.filter(
    (m) => m.labelX != null && m.labelY != null && (m.shape ?? 'arrow') !== 'point' && (m.shape ?? 'arrow') !== 'circle'
  );
  /* Shapes drawn at the tip itself rather than as a leader line. */
  const tipMarkers = resolved.filter(
    (m) => m.shape === 'point' || m.shape === 'circle' || m.shape === 'arrow-point'
  );

  /* Each leader resolved once: where the line starts, how heavy it is, and how
     big a head that weight can carry. The arrowhead defs are built from these,
     so a def exists for every (size, colour) actually drawn. */
  const arrowSpecs = arrowMarkers.map((m) => {
    const lx = m.labelX!;
    const ly = m.labelY!;
    // Stop the line short of the badge so it meets the rim instead of running
    // underneath the letter.
    const vx = m.x - lx;
    const vy = m.y - ly;
    const len = Math.hypot(vx, vy) || 1;
    const gap = markerSizePct * 0.55;
    const sx = lx + (vx / len) * Math.min(gap, len * 0.9);
    const sy = ly + (vy / len) * Math.min(gap, len * 0.9);
    const bw = imgBox?.width ?? 600;
    const bh = imgBox?.height ?? 600;
    const leaderPx = Math.hypot(((m.x - sx) / 100) * bw, ((m.y - sy) / 100) * bh);
    const w = strokePx(m.thickness);
    return { m, sx, sy, w, hs: headUnits(m, w, leaderPx), ink: inkOf(m), halo: haloOf(m) };
  });

  const filterStyle = `brightness(${state.brightness}%) contrast(${state.contrast}%) ${state.inverted ? 'invert(1)' : ''}`;
  const transformStyle = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;

  const controls = (
    <div className="iv-controls" onMouseDown={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => zoomBy(-0.25)} title="Zoom out">−</button>
      <span className="iv-zoom-label">{Math.round(state.zoom * 100)}%</span>
      <button type="button" onClick={() => zoomBy(0.25)} title="Zoom in">+</button>
      <button type="button" onClick={fitToScreen} title="Fit to screen">Fit</button>
      <button type="button" onClick={actualSize} title="Actual size">100%</button>
      <span className="iv-sep" />
      <label className="iv-slider" title="Brightness">
        B
        <input
          type="range" min={50} max={150} value={state.brightness}
          onChange={(e) => setState((s) => ({ ...s, brightness: Number(e.target.value) }))}
        />
      </label>
      <label className="iv-slider" title="Contrast">
        C
        <input
          type="range" min={50} max={150} value={state.contrast}
          onChange={(e) => setState((s) => ({ ...s, contrast: Number(e.target.value) }))}
        />
      </label>
      <button
        type="button"
        className={state.inverted ? 'iv-toggle active' : 'iv-toggle'}
        onClick={() => setState((s) => ({ ...s, inverted: !s.inverted }))}
        title="Invert grayscale"
      >
        Invert
      </button>
      <button type="button" onClick={reset} title="Reset all adjustments">Reset</button>
      <button type="button" onClick={() => setFullscreen((f) => !f)} title="Toggle full screen">
        {fullscreen ? 'Close' : 'Full screen'}
      </button>
    </div>
  );

  return (
    <div className={fullscreen ? 'iv-root iv-fullscreen' : 'iv-root'} ref={containerRef}>
      <div
        className="iv-canvas"
        ref={canvasRef}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onDoubleClick={() => (state.zoom > MIN_ZOOM ? reset() : zoomBy(1.5))}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ cursor: state.zoom > MIN_ZOOM ? (dragRef.current ? 'grabbing' : 'grab') : (fullscreen ? 'zoom-in' : 'zoom-in') }}
        onClick={() => { if (!fullscreen) setFullscreen(true); }}
      >
        <div
          className="iv-image-wrap"
          style={{
            transform: transformStyle,
            ...(imgBox
              ? { left: imgBox.left, top: imgBox.top, width: imgBox.width, height: imgBox.height, opacity: 1 }
              : { left: 0, top: 0, width: '100%', height: '100%', opacity: 0 }),
          }}
        >
          {/* The orient layer carries the film in its UN-rotated proportions
              and is then turned inside the wrapper, which is sized to the
              rotated result. Both are centred on the same point, so a quarter
              turn lands exactly. The markers stay outside this layer: they are
              already stored in the oriented space and must not be turned a
              second time. */}
          <div
            className="iv-orient"
            style={{
              width: imgBox ? (quarterTurn ? imgBox.height : imgBox.width) : '100%',
              height: imgBox ? (quarterTurn ? imgBox.width : imgBox.height) : '100%',
              transform:
                `translate(-50%, -50%) rotate(${rotate}deg)` +
                ` scale(${orientation?.flipH ? -1 : 1}, ${orientation?.flipV ? -1 : 1})`,
            }}
          >
            <img
              ref={imgRef}
              src={src}
              alt={alt}
              draggable={false}
              style={
                crop
                  ? {
                      filter: filterStyle,
                      position: 'absolute',
                      width: `${100 / crop.w}%`,
                      height: `${100 / crop.h}%`,
                      left: `${(-crop.x / crop.w) * 100}%`,
                      top: `${(-crop.y / crop.h) * 100}%`,
                      maxWidth: 'none',
                      maxHeight: 'none',
                    }
                  : { filter: filterStyle }
              }
              className="iv-image"
              onLoad={recomputeImgBox}
            />
          </div>
          {(arrowMarkers.length > 0 || tipMarkers.length > 0) && (
            <svg className="iv-arrow-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                {/* markerUnits="strokeWidth" would tie head size to shaft
                    width; these are separate controls, so a def is emitted per
                    distinct head size and sized in user units instead. */}
                {/* A marker element bakes in its own fill, so the def has to
                    be keyed by colour as well as by head size — one def per
                    distinct (size, colour) pair actually in use. */}
                {[...new Map(
                  arrowSpecs.flatMap(({ hs, ink, halo }) =>
                    /* One def for the ink, one for its halo — the halo line is
                       drawn with a wider stroke, and markerUnits="strokeWidth"
                       makes its head grow to match automatically. */
                    [ink, halo].map((c) => [`${hs}|${c}`, { hs, ink: c }] as const)
                  )
                ).values()].map(({ hs, ink }) => (
                  <marker
                    key={headId(hs, ink)}
                    id={headId(hs, ink)}
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth={hs}
                    markerHeight={hs}
                    orient="auto-start-reverse"
                    markerUnits="strokeWidth"
                  >
                    <path d="M 0 1 L 9 5 L 0 9 z" fill={ink} />
                  </marker>
                ))}
              </defs>
              {arrowSpecs.map(({ m, w, hs, ink, halo, sx, sy }, i) => {
                const headed = (m.shape ?? 'arrow') !== 'line';
                const headInk = headed ? `url(#${headId(hs, ink)})` : undefined;
                const headHalo = headed ? `url(#${headId(hs, halo)})` : undefined;
                return (
                  <g key={m.id ?? `${m.label}-${i}`}>
                    <line
                      x1={sx} y1={sy} x2={m.x} y2={m.y}
                      stroke={halo}
                      strokeWidth={w + HALO_EXTRA}
                      strokeLinecap="round"
                      markerEnd={headHalo}
                      vectorEffect="non-scaling-stroke"
                    />
                    <line
                      x1={sx} y1={sy} x2={m.x} y2={m.y}
                      stroke={ink}
                      strokeWidth={w}
                      strokeLinecap="round"
                      markerEnd={headInk}
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                );
              })}
              {/* Shapes drawn ON the structure: a filled dot to mark a spot
                  without covering it, or an open ring to enclose a region
                  that no single point describes. */}
              {tipMarkers.map((m, i) => {
                /* Ring and dot are both diameters in % of the film's width —
                   the editor's size dial writes circlePct for either. */
                const r = (m.circlePct ?? (m.shape === 'circle' ? 9 : 2.5)) / 2;
                const ink = inkOf(m);
                const halo = haloOf(m);
                const key = `t-${m.id ?? m.label}-${i}`;
                return m.shape === 'circle' ? (
                  /* Ring: halo underneath, ink on top — same reason as the
                     leader lines. A hairline ring on a radiograph reads as
                     nothing at all. */
                  <g key={key}>
                    <circle cx={m.x} cy={m.y} r={r} fill="none" stroke={halo}
                      strokeWidth={strokePx(m.thickness) + HALO_EXTRA} vectorEffect="non-scaling-stroke" />
                    <circle cx={m.x} cy={m.y} r={r} fill="none" stroke={ink}
                      strokeWidth={strokePx(m.thickness)} vectorEffect="non-scaling-stroke" />
                  </g>
                ) : (
                  <circle
                    key={key}
                    cx={m.x} cy={m.y} r={Math.max(0.9, r)}
                    fill={ink} stroke={halo}
                    strokeWidth={1.6} vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>
          )}
          {resolved.map((m, i) => {
            const replacing = m.labelX == null || m.labelY == null;
            return (
              <div
                key={m.id ?? `${m.label}-${i}`}
                className={replacing ? 'iv-marker iv-marker-replacing' : 'iv-marker'}
                style={{
                  left: `${m.labelX ?? m.x}%`,
                  top: `${m.labelY ?? m.y}%`,
                  ['--marker-size' as string]: `${m.sizePct ?? markerSizePct}%`,
                  // The badge was hardcoded white with a teal rim, so choosing
                  // a colour recoloured the arrow and left the letter looking
                  // exactly as before. Badge and pointer now share one ink.
                  ['--marker-ink' as string]: inkOf(m),
                  ['--marker-halo' as string]: haloOf(m),
                  ['--marker-text' as string]: (m.colour ?? 'white') === 'black' ? '#f4f6f8' : '#14181d',
                }}
              >
                {/* In replace mode the badge sits exactly where the source
                    atlas printed its own label, so an opaque backing plate
                    slightly larger than the badge hides that original glyph
                    (including its anti-aliased edge) completely. */}
                {replacing && <span className="iv-marker-mask" />}
                <span className="iv-marker-dot">{m.label}</span>
              </div>
            );
          })}
        </div>
      </div>
      {fullscreen && controls}
      {fullscreen && (
        <button type="button" className="iv-close-x" onClick={() => setFullscreen(false)} title="Close (Esc)">✕</button>
      )}
    </div>
  );
}

export default memo(ImageViewer);
