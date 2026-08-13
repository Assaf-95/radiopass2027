import { Link } from 'react-router-dom';
import type { ChapterId } from '../../data/atlas/chapters';
import { relationshipFor } from '../../data/atlas/relationships';
import { findByKey } from '../../lib/atlas';
import type { AtlasImage } from '../../lib/atlas/types';

/* ===========================================================================
   What else is on this film.

   Every question in the bank labels four or five structures on one image, so
   the film a learner is looking at for the right ventricle already has the
   left ventricle, the septum and the atria named on it — by the question's
   own answer key, not by anything guessed here. Listing them turns the Atlas
   from a set of galleries into a map: each one is a link to its own page,
   where it becomes the structure in focus and brings its own films with it.

   Names only, by default. A one-line note on how a neighbour sits relative
   to the current structure ON THIS FILM is far more useful than a paragraph
   about the neighbour, but it is a spatial claim about a particular plane
   and nobody has written those yet — so the line simply does not appear
   until it exists in src/data/atlas/relationships.ts. A missing note is
   better than a wrong one.
   =========================================================================== */

/* `labelStyle: 'single'` questions carry one label literally called
   "Answer" — there is no letter printed on the film to key against, so the
   legend shows a bullet rather than the word. */
function keyGlyph(label: string): string {
  return label === 'Answer' ? '•' : label;
}

interface Props {
  image: AtlasImage;
  /** The structure whose page this is. */
  currentKey: string;
  currentName: string;
  chapter: ChapterId;
  compact?: boolean;
}

export default function FilmLegend({ image, currentKey, currentName, chapter, compact }: Props) {
  const rows = [
    { label: image.label, name: currentName, current: true, to: null as string | null, note: null as string | null },
    ...image.companions.map((c) => {
      const target = findByKey(c.structureKey, chapter);
      return {
        label: c.label,
        name: target?.name ?? c.officialAnswer,
        current: false,
        to: target ? `/atlas/${target.chapter}/${target.id}` : null,
        /* An editor's note, written online for this film, beats the
           checked-in table; neither is invented, and when there is no note
           at all the line simply does not appear. */
        note:
          image.relationships.find(
            (r) => r.target === currentKey && r.neighbour === c.structureKey
          )?.text ?? relationshipFor(image.questionId, currentKey, c.structureKey),
      };
    }),
  ].sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));

  return (
    <div className={compact ? 'film-legend film-legend-compact' : 'film-legend'}>
      <p className="film-legend-head eyebrow">Structures in this image</p>
      <ul className="film-legend-list">
        {rows.map((r) => (
          <li key={r.label} className={r.current ? 'is-current' : undefined}>
            <span className="legend-key mono" aria-hidden="true">{keyGlyph(r.label)}</span>
            {r.current ? (
              <span className="legend-name">
                {r.name}
                <span className="legend-tag mono">current</span>
              </span>
            ) : r.to ? (
              <Link className="legend-name legend-link" to={r.to}>
                {r.name}
                <span className="legend-arrow" aria-hidden="true">→</span>
              </Link>
            ) : (
              <span className="legend-name">{r.name}</span>
            )}
            {r.note && <span className="legend-note">{r.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
