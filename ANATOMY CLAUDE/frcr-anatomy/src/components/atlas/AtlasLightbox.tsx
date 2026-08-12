import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { assetUrl } from '../../lib/assetUrl';
import { isAdmin } from '../../lib/admin';
import { findByKey } from '../../lib/atlas';
import type { AtlasImage } from '../../lib/atlas/types';
import type { ChapterId } from '../../data/atlas/chapters';
import AtlasFilm from './AtlasFilm';
import FilmLegend from './FilmLegend';
import './AtlasLightbox.css';

/* ===========================================================================
   The full-size viewer.

   Deliberately a layer over the gallery rather than a page of its own: the
   whole point of a structure page is comparing one film with the next, and
   a round trip through the router loses your place in the grid every time.

   Keyboard: left and right step through the gallery, L toggles the labels,
   Escape closes. Focus is trapped to the dialog while it is open and
   returned to the film that opened it.
   =========================================================================== */

interface Props {
  images: AtlasImage[];
  index: number;
  structureName: string;
  structureKey: string;
  chapter: ChapterId;
  showLabels: boolean;
  onToggleLabels: () => void;
  onIndex: (i: number) => void;
  onClose: () => void;
}

const MAX_ZOOM = 5;

export default function AtlasLightbox({
  images,
  index,
  structureName,
  structureKey,
  chapter,
  showLabels,
  onToggleLabels,
  onIndex,
  onClose,
}: Props) {
  const navigate = useNavigate();
  const image = images[index];
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const reset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // A new film always starts fitted; carrying a zoom across would land the
  // next one showing a corner of nothing.
  useEffect(reset, [index, reset]);

  const step = useCallback(
    (delta: number) => {
      if (images.length < 2) return;
      onIndex((index + delta + images.length) % images.length);
    },
    [images.length, index, onIndex]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        step(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        step(-1);
      } else if (e.key === 'l' || e.key === 'L') {
        onToggleLabels();
      } else if (e.key === '+' || e.key === '=') {
        setZoom((z) => Math.min(MAX_ZOOM, z + 0.5));
      } else if (e.key === '-') {
        setZoom((z) => Math.max(1, z - 0.5));
      } else if (e.key === '0') {
        reset();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onToggleLabels, reset, step]);

  /* The page behind must not scroll while a full-screen layer is open —
     on a phone that is the difference between a viewer and a trap. */
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!image) return null;

  const onLabelClick = (label: string) => {
    if (label === image.label) return;
    const companion = image.companions.find((c) => c.label === label);
    if (!companion) return;
    const target = findByKey(companion.structureKey, chapter);
    if (!target) return;
    onClose();
    navigate(`/atlas/${target.chapter}/${target.id}`);
  };

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={`${structureName}, image ${index + 1} of ${images.length}`}>
      <div className="lightbox-scrim" onClick={onClose} />

      <div className="lightbox-panel" ref={dialogRef} tabIndex={-1}>
        <header className="lightbox-head">
          <div className="lightbox-title">
            <h2>{structureName}</h2>
            <p className="lb-label">
              <span className="film-label-key" aria-hidden="true">
                {image.label === 'Answer' ? '•' : image.label}
              </span>
              {image.officialAnswer}
            </p>
            <p className="mono">
              {index + 1} / {images.length}
            </p>
          </div>
          <div className="lightbox-tools">
            <button type="button" className="lb-btn" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} title="Zoom out">−</button>
            <span className="lb-zoom mono">{Math.round(zoom * 100)}%</span>
            <button type="button" className="lb-btn" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.5))} title="Zoom in">+</button>
            <button type="button" className="lb-btn" onClick={reset} title="Fit to screen">Fit</button>
            <button
              type="button"
              className={showLabels ? 'lb-btn is-on' : 'lb-btn'}
              onClick={onToggleLabels}
              title="Show or hide the structure labels (L)"
            >
              Labels
            </button>
            <button type="button" className="lb-btn lb-close" onClick={onClose} title="Close (Esc)">✕</button>
          </div>
        </header>

        <div
          className="lightbox-stage"
          onWheel={(e) => {
            if (!e.ctrlKey && Math.abs(e.deltaY) < 4) return;
            setZoom((z) => Math.min(MAX_ZOOM, Math.max(1, z + (e.deltaY < 0 ? 0.3 : -0.3))));
          }}
          onMouseDown={(e) => {
            if (zoom <= 1) return;
            dragRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
          }}
          onMouseMove={(e) => {
            const d = dragRef.current;
            if (!d) return;
            setPan({ x: d.panX + (e.clientX - d.x), y: d.panY + (e.clientY - d.y) });
          }}
          onMouseUp={() => { dragRef.current = null; }}
          onMouseLeave={() => { dragRef.current = null; }}
          onDoubleClick={() => (zoom > 1 ? reset() : setZoom(2))}
          style={{ cursor: zoom > 1 ? 'grab' : 'default' }}
        >
          {images.length > 1 && (
            <button type="button" className="lb-nav lb-prev" onClick={() => step(-1)} title="Previous image (←)">‹</button>
          )}
          <div
            className="lightbox-film"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            <AtlasFilm
              src={assetUrl(image.src)}
              alt={`${structureName} — ${image.description || 'anatomy question image'}`}
              crop={image.crop}
              orientation={image.orientation}
              markers={image.markers}
              markerSizePct={image.markerSizePct}
              activeLabel={image.label}
              showLabels={showLabels}
              onLabelClick={onLabelClick}
              loading="eager"
            />
          </div>
          {images.length > 1 && (
            <button type="button" className="lb-nav lb-next" onClick={() => step(1)} title="Next image (→)">›</button>
          )}
        </div>

        <footer className="lightbox-foot">
          <div className="lightbox-caption">
            <p className={image.description ? 'lb-desc' : 'lb-desc is-blank'}>
              {image.description || 'Description not yet added'}
            </p>
            <ImageFacts image={image} />
            <div className="film-links">
              <Link
                className="btn btn-line lb-source"
                to={image.sourceHref ?? `/section/${image.section}/q/${image.questionId}`}
              >
                {image.sourceLabel ?? 'View original question'}
              </Link>
              {isAdmin() && !image.sourceHref && (
                <Link
                  className="btn btn-line lb-source"
                  to={`/section/${image.section}/q/${image.questionId}/replace-image`}
                  onClick={onClose}
                >
                  Edit this film
                </Link>
              )}
            </div>
          </div>
          {showLabels && (
            <FilmLegend
              image={image}
              currentKey={structureKey}
              currentName={structureName}
              chapter={chapter}
              compact
            />
          )}
        </footer>
      </div>
    </div>
  );
}

export function ImageFacts({ image }: { image: AtlasImage }) {
  const facts: string[] = [image.modality];
  if (image.plane) facts.push(image.plane);
  if (image.sequence) facts.push(image.sequence);
  if (image.level) facts.push(image.level);
  if (image.side && !image.sideInName) facts.push(image.side === 'left' ? 'Left' : 'Right');
  if (image.caseLabel) facts.push(image.caseLabel);
  return (
    <p className="lb-facts mono">
      {facts.map((f, i) => (
        <span key={`${f}-${i}`}>
          {i > 0 && <span className="fact-sep" aria-hidden="true">·</span>}
          {f}
        </span>
      ))}
    </p>
  );
}
