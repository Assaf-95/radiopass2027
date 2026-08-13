import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { ImageOrientation } from '../../types';
import type { AtlasCrop, AtlasMarker } from '../../lib/atlas/types';
import './AtlasFilm.css';

/* ===========================================================================
   One film, shown the way the question player shows it.

   The source pages carry the printed question stem above the image and the
   answer key below, so every film is cropped; a few were extracted rotated.
   Both corrections live in the question data and are applied here, at render
   time, exactly as QuestionPlayer applies them — a film that is right in the
   player is right in the Atlas, and a crop fixed for one is fixed for both.

   Labels. Most of the bank has its letters burned into the raster: A, B, C
   are part of the picture and there is nothing to place. Those films get a
   legend under them instead. Where the extraction DID record where each
   letter sits, a badge is drawn over it — the current structure's in amber,
   the rest in white — so the eye lands on the right one immediately.
   =========================================================================== */

export interface AtlasFilmProps {
  src: string;
  alt: string;
  crop?: AtlasCrop;
  orientation?: ImageOrientation;
  markers?: AtlasMarker[];
  markerSizePct?: number;
  /** The letter this Atlas page is about. Drawn in the accent colour. */
  activeLabel?: string;
  /** Hidden for self-testing. The burned-in letters remain, which is the
   *  point: you still have to say what A is. */
  showLabels?: boolean;
  /** Called with a label letter when its badge is clicked. */
  onLabelClick?: (label: string) => void;
  /** Loading strategy. The first row of a gallery is eager, the rest lazy. */
  loading?: 'eager' | 'lazy';
  className?: string;
}

function AtlasFilm({
  src,
  alt,
  crop,
  orientation,
  markers,
  markerSizePct = 6,
  activeLabel,
  showLabels = true,
  onLabelClick,
  loading = 'lazy',
  className,
}: AtlasFilmProps) {
  const rotate = orientation?.rotate ?? 0;
  const quarterTurn = rotate === 90 || rotate === 270;

  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  /* The rendered box of the image inside the frame. Percentages in the marker
     data are percentages of THIS, not of the frame, so a letterboxed film
     still has its badges on its anatomy. */
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(
    null
  );

  const measure = useCallback(() => {
    const frame = frameRef.current;
    const img = imgRef.current;
    if (!frame || !img?.naturalWidth || !img.naturalHeight) return;
    const fw = frame.clientWidth;
    const fh = frame.clientHeight;
    if (!fw || !fh) return;
    const cropW = img.naturalWidth * (crop ? crop.w : 1);
    const cropH = img.naturalHeight * (crop ? crop.h : 1);
    const natW = quarterTurn ? cropH : cropW;
    const natH = quarterTurn ? cropW : cropH;
    const scale = Math.min(fw / natW, fh / natH);
    const width = natW * scale;
    const height = natH * scale;
    setBox({ left: (fw - width) / 2, top: (fh - height) / 2, width, height });
  }, [crop, quarterTurn]);

  useEffect(() => {
    measure();
  }, [measure, src]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(frame);
    return () => ro.disconnect();
  }, [measure]);

  /* Nothing is drawn until the film has been measured. A badge placed against
     an unmeasured frame sits in the wrong place, and on a lazily-loaded card
     that wrong place is visible — five letters floating over black while the
     image is still on its way. */
  const visible = showLabels && box ? markers ?? [] : [];

  return (
    <div className={className ? `atlas-film ${className}` : 'atlas-film'} ref={frameRef}>
      <div
        className="atlas-film-box"
        style={
          box
            ? { left: box.left, top: box.top, width: box.width, height: box.height }
            : { left: 0, top: 0, right: 0, bottom: 0 }
        }
      >
        <div
          className="atlas-film-orient"
          style={{
            width: box ? (quarterTurn ? box.height : box.width) : '100%',
            height: box ? (quarterTurn ? box.width : box.height) : '100%',
            transform:
              `translate(-50%, -50%) rotate(${rotate}deg)` +
              ` scale(${orientation?.flipH ? -1 : 1}, ${orientation?.flipV ? -1 : 1})`,
          }}
        >
          <img
            ref={imgRef}
            className="atlas-film-img"
            src={src}
            alt={alt}
            loading={loading}
            decoding="async"
            draggable={false}
            onLoad={measure}
            style={
              crop
                ? {
                    position: 'absolute',
                    width: `${100 / crop.w}%`,
                    height: `${100 / crop.h}%`,
                    left: `${(-crop.x / crop.w) * 100}%`,
                    top: `${(-crop.y / crop.h) * 100}%`,
                    maxWidth: 'none',
                    maxHeight: 'none',
                  }
                : undefined
            }
          />
        </div>

        {/* A leader line only where the data says where the arrow should
            start. The 39 extracted pages that carry glyph positions already
            have the source atlas's own arrow printed in the film. */}
        {visible.some((m) => m.labelX != null && m.labelY != null) && (
          <svg className="atlas-film-leaders" viewBox="0 0 100 100" preserveAspectRatio="none">
            {visible
              .filter((m) => m.labelX != null && m.labelY != null)
              .map((m) => (
                <g key={`l-${m.id}`}>
                  <line
                    x1={m.labelX} y1={m.labelY} x2={m.x} y2={m.y}
                    stroke="rgba(0,0,0,0.85)" strokeWidth={3.2} strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={m.labelX} y1={m.labelY} x2={m.x} y2={m.y}
                    stroke={m.label === activeLabel ? 'var(--amber-accent)' : '#ffffff'}
                    strokeWidth={1.4} strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              ))}
          </svg>
        )}

        {visible.map((m) => {
          const isActive = m.label === activeLabel;
          const style = {
            left: `${m.labelX ?? m.x}%`,
            top: `${m.labelY ?? m.y}%`,
            ['--badge-size' as string]: `${m.sizePct ?? markerSizePct}%`,
          };
          const cls = isActive ? 'atlas-badge is-active' : 'atlas-badge';
          return onLabelClick && !isActive ? (
            <button
              key={m.id}
              type="button"
              className={cls}
              style={style}
              onClick={(e) => {
                e.stopPropagation();
                onLabelClick(m.label);
              }}
              title={`Go to the structure labelled ${m.label}`}
            >
              {m.label === 'Answer' ? '•' : m.label}
            </button>
          ) : (
            <span key={m.id} className={cls} style={style} aria-hidden="true">
              {m.label === 'Answer' ? '•' : m.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default memo(AtlasFilm);
