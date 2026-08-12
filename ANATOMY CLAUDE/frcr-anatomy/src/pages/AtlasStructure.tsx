import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { assetUrl } from '../lib/assetUrl';
import { getAtlas, getChapter, getStructure } from '../lib/atlas';
import { relatedStructures, sameStructureElsewhere } from '../lib/atlas/related';
import { isAdmin } from '../lib/admin';
import AtlasFilm from '../components/atlas/AtlasFilm';
import AtlasBreadcrumbs from '../components/atlas/AtlasBreadcrumbs';
import AtlasLightbox, { ImageFacts } from '../components/atlas/AtlasLightbox';
import FilmLegend from '../components/atlas/FilmLegend';
import './Atlas.css';

/* ===========================================================================
   One structure, and every image in the bank that teaches it.

   This is the page the whole feature exists for. Not a representative image,
   not the three best — all of them, large enough to read, in one scroll, so
   the same anatomy can be recognised on a radiograph, on a CT and on an MRI
   without hunting through the question bank for the films that show it.

   Filters narrow by modality and by plane. They are built from the images
   actually present, so a structure that only ever appears on radiographs
   shows no filter bar at all rather than a row of dead buttons.
   =========================================================================== */

export default function AtlasStructure() {
  const { chapterId = '', structureId = '' } = useParams();
  const chapter = getChapter(chapterId);
  const structure = getStructure(chapterId, structureId);

  const [modality, setModality] = useState<string>('all');
  const [plane, setPlane] = useState<string>('all');
  const [showLabels, setShowLabels] = useState(true);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);

  /* Arriving from a companion link means a different structure under the
     same component; the filters belonged to the old one. */
  useEffect(() => {
    setModality('all');
    setPlane('all');
    setLightbox(null);
  }, [chapterId, structureId]);

  /* The same structure filed in another chapter is the same structure. The
     abdominal aorta is labelled on three spine films and twelve abdominal
     ones; opening it from either side has to show all fifteen, or the page
     is quietly lying about how much of this anatomy the bank holds. */
  const atlas = getAtlas();
  const elsewhere = useMemo(
    () => (structure ? sameStructureElsewhere(structure, atlas) : []),
    [structure, atlas]
  );
  const related = useMemo(
    () => (structure ? relatedStructures(structure, atlas) : []),
    [structure, atlas]
  );

  const allImages = useMemo(() => {
    if (!structure) return [];
    const seen = new Set<string>();
    const out = [];
    for (const source of [structure, ...elsewhere.map((e) => e.structure)]) {
      for (const image of source.images) {
        if (seen.has(image.id)) continue;
        seen.add(image.id);
        out.push(image);
      }
    }
    return out;
  }, [structure, elsewhere]);

  const images = useMemo(
    () =>
      allImages.filter(
        (i) => (modality === 'all' || i.modality === modality) && (plane === 'all' || i.plane === plane)
      ),
    [allImages, modality, plane]
  );

  /* Filters are offered for what is actually on the page, which is now more
     than one chapter's worth. */
  const modalities = useMemo(
    () => [...new Set(allImages.map((i) => i.modality))].sort(),
    [allImages]
  );
  const planes = useMemo(
    () => [...new Set(allImages.map((i) => i.plane).filter((p): p is string => !!p))].sort(),
    [allImages]
  );

  if (!chapter || !structure) {
    return (
      <div className="empty-state">
        <h1>Structure not found</h1>
        <p>That address does not match a structure in this chapter.</p>
        <Link className="btn btn-primary" to={chapter ? `/atlas/${chapter.id}` : '/atlas'}>
          {chapter ? `Back to ${chapter.title}` : 'Back to the Structure Atlas'}
        </Link>
      </div>
    );
  }

  const hasNotes =
    !!structure.description ||
    !!structure.keyRecognitionFeature ||
    !!structure.commonPitfall ||
    !!structure.examTip;

  return (
    <div className="atlas atlas-structure">
      <AtlasBreadcrumbs
        trail={[
          { label: 'Structure Atlas', to: '/atlas' },
          { label: chapter.title, to: `/atlas/${chapter.id}` },
          { label: structure.name },
        ]}
      />

      <header className="atlas-head structure-head">
        <p className="eyebrow">{chapter.title}</p>
        <h1>{structure.name}</h1>
        <p className="atlas-figures mono">
          {allImages.length} {allImages.length === 1 ? 'image' : 'images'}
          {elsewhere.length > 0 && (
            <> · {[chapter.title, ...elsewhere.map((e) => e.chapterTitle)].join(' + ')}</>
          )}
          {images.length !== allImages.length && <> · {images.length} shown</>}
        </p>
        {/* What this entity is made of. The parts are folded into one page,
            so the page has to say plainly which parts — otherwise "Aorta, 16
            images" hides that eight of them are the arch. */}
        {structure.variants.length > 1 && (
          <p className="structure-variants">
            Includes{' '}
            {structure.variants.map((v, i) => (
              <span key={v.name}>
                {i > 0 && ' · '}
                <span className="variant-name">{v.name}</span>
                <span className="variant-count mono"> {v.count}</span>
              </span>
            ))}
          </p>
        )}
        {structure.aliases.length > 0 && (
          <p className="structure-aliases">
            Also written{' '}
            {structure.aliases.slice(0, 6).map((a, i) => (
              <span key={a}>
                {i > 0 && ', '}
                <em>{a}</em>
              </span>
            ))}
            {structure.aliases.length > 6 && <> and {structure.aliases.length - 6} more</>}
          </p>
        )}
      </header>

      {hasNotes && (
        <section className="structure-notes card">
          <button
            type="button"
            className="notes-toggle"
            onClick={() => setNotesOpen((v) => !v)}
            aria-expanded={notesOpen}
          >
            <span>Recognition notes</span>
            <span aria-hidden="true">{notesOpen ? '−' : '+'}</span>
          </button>
          {notesOpen && (
            <div className="notes-body">
              {structure.description && <p>{structure.description}</p>}
              {structure.keyRecognitionFeature && (
                <div className="note-block">
                  <p className="eyebrow">How to recognise it</p>
                  <p>{structure.keyRecognitionFeature}</p>
                </div>
              )}
              {structure.commonPitfall && (
                <div className="note-block">
                  <p className="eyebrow">Common confusion</p>
                  <p>{structure.commonPitfall}</p>
                </div>
              )}
              {structure.examTip && (
                <div className="note-block">
                  <p className="eyebrow">FRCR tip</p>
                  <p>{structure.examTip}</p>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <div className="atlas-controls structure-controls">
        {modalities.length > 1 && (
          <div className="seg" role="group" aria-label="Filter by modality">
            <button
              type="button"
              className={modality === 'all' ? 'seg-btn is-on' : 'seg-btn'}
              onClick={() => setModality('all')}
            >
              All
            </button>
            {modalities.map((m) => (
              <button
                key={m}
                type="button"
                className={modality === m ? 'seg-btn is-on' : 'seg-btn'}
                onClick={() => setModality(m)}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {planes.length > 1 && (
          <div className="seg" role="group" aria-label="Filter by plane">
            <button
              type="button"
              className={plane === 'all' ? 'seg-btn is-on' : 'seg-btn'}
              onClick={() => setPlane('all')}
            >
              Any plane
            </button>
            {planes.map((p) => (
              <button
                key={p}
                type="button"
                className={plane === p ? 'seg-btn is-on' : 'seg-btn'}
                onClick={() => setPlane(p)}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          className={showLabels ? 'seg-btn solo is-on' : 'seg-btn solo'}
          onClick={() => setShowLabels((v) => !v)}
          aria-pressed={showLabels}
          title="Hide the labels to test yourself"
        >
          {showLabels ? 'Labels on' : 'Labels off'}
        </button>
      </div>

      {images.length === 0 ? (
        <p className="atlas-empty">
          No images match this filter. <button type="button" className="btn-line" onClick={() => { setModality('all'); setPlane('all'); }}>Clear filters</button>
        </p>
      ) : (
        <section className="gallery" aria-label={`Images of ${structure.name}`}>
          {images.map((image, i) => (
            <article className="gallery-item" key={image.id}>
              <button
                type="button"
                className="gallery-film"
                onClick={() => setLightbox(i)}
                aria-label={`Open ${structure.name} — image ${i + 1} of ${images.length} at full size`}
              >
                <AtlasFilm
                  src={assetUrl(image.src)}
                  alt={`${structure.name}${image.description ? ` — ${image.description}` : ''}`}
                  crop={image.crop}
                  orientation={image.orientation}
                  markers={image.markers}
                  markerSizePct={image.markerSizePct}
                  activeLabel={image.label}
                  showLabels={showLabels}
                  loading={i < 4 ? 'eager' : 'lazy'}
                />
              </button>

              <div className="gallery-caption">
                {/* WHAT THIS FILM ACTUALLY SHOWS, first and loudest, and
                    carrying the letter it is labelled with.

                    The heading already says which entity you chose; on a page
                    that folds a dozen parts into one, what you cannot work out
                    by looking is which part THIS film is labelling — and then
                    which of the letters printed on it to look at. The badge
                    here is the same amber disc drawn over the film, so the eye
                    goes caption -> marker without reading the legend. */}
                <p className="film-label">
                  <span className="film-label-key" aria-hidden="true">
                    {image.label === 'Answer' ? '•' : image.label}
                  </span>
                  {image.officialAnswer}
                </p>
                <p className={image.description ? 'film-desc' : 'film-desc is-blank'}>
                  {image.description || 'Description not yet added'}
                </p>
                <ImageFacts image={image} />

                {showLabels && image.companions.length > 0 && (
                  <FilmLegend
                    image={image}
                    currentKey={structure.key}
                    currentName={structure.name}
                    chapter={chapter.id}
                  />
                )}

                <div className="film-links">
                  {/* A question image goes back to its question; a study slice
                      goes to the viewer it came from, at that slice. */}
                  <Link
                    className="film-source mono"
                    to={image.sourceHref ?? `/section/${image.section}/q/${image.questionId}`}
                  >
                    {image.sourceLabel ?? 'View original question'}
                  </Link>
                  {isAdmin() && !image.sourceHref && (
                    /* The same editor the Question Bank opens, on the same
                       record. Which side you start from does not matter:
                       there is one image behind this film, and replacing it
                       here replaces it there. */
                    <Link
                      className="film-edit mono"
                      to={`/section/${image.section}/q/${image.questionId}/replace-image`}
                      title="Replace the image, move arrows, show or hide labels, edit this caption"
                    >
                      Edit this film →
                    </Link>
                  )}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {related.length > 0 && (
        <section className="related-band" aria-label="Related structures">
          <header className="related-head">
            <p className="eyebrow">Related anatomy</p>
            <p className="related-note">
              Other parts of the same structure, each under its own name. They are not
              merged into the gallery above — a descending thoracic aorta is not an
              abdominal one.
            </p>
          </header>

          {related.map(({ structure: r, chapterTitle }) => (
            <article className="related-row" key={`${r.chapter}-${r.id}`}>
              <div className="related-row-head">
                <Link className="related-name" to={`/atlas/${r.chapter}/${r.id}`}>
                  {r.name}
                </Link>
                <span className="related-meta mono">
                  {chapterTitle} · {r.images.length} {r.images.length === 1 ? 'image' : 'images'}
                </span>
              </div>
              <div className="related-strip">
                {r.images.slice(0, 8).map((img) => (
                  <Link
                    key={img.id}
                    className="related-thumb"
                    to={`/atlas/${r.chapter}/${r.id}`}
                    aria-label={`${r.name} — ${img.description || 'anatomy image'}`}
                  >
                    <AtlasFilm
                      src={assetUrl(img.src)}
                      alt=""
                      crop={img.crop}
                      orientation={img.orientation}
                      showLabels={false}
                    />
                  </Link>
                ))}
                {r.images.length > 8 && (
                  <Link className="related-more mono" to={`/atlas/${r.chapter}/${r.id}`}>
                    +{r.images.length - 8}
                  </Link>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      {lightbox !== null && images[lightbox] && (
        <AtlasLightbox
          images={images}
          index={lightbox}
          structureName={structure.name}
          structureKey={structure.key}
          chapter={chapter.id}
          showLabels={showLabels}
          onToggleLabels={() => setShowLabels((v) => !v)}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* Deliberately last and quiet: the page is for looking at films, and a
          teaching essay above them would defeat it. */}
      {images.some((i) => i.teachingText) && (
        <details className="teaching-drop">
          <summary>Teaching text from the source questions</summary>
          <div className="teaching-body">
            {images
              .filter((i) => i.teachingText)
              .map((i) => (
                <section key={i.id}>
                  <p className="eyebrow">
                    {i.caseLabel ?? `Question ${i.questionNumber}`} · {i.sourceFile}
                  </p>
                  <p>{i.teachingText}</p>
                  <Link className="mono" to={`/section/${i.section}/q/${i.questionId}`}>
                    Open this question
                  </Link>
                </section>
              ))}
          </div>
        </details>
      )}

      <p className="atlas-foot mono">
        Every image here is a question image from the bank, shown with the structure it teaches.
        <span className="atlas-foot-sep"> </span>
        <Link to={`/atlas/${chapter.id}`}>Back to {chapter.title}</Link>
      </p>
    </div>
  );
}
