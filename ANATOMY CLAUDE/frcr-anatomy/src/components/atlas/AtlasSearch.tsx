import { useDeferredValue, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { searchStructures } from '../../lib/atlas';
import { assetUrl } from '../../lib/assetUrl';
import AtlasFilm from './AtlasFilm';

/* ===========================================================================
   One search field for the whole Atlas.

   Results carry their chapter, because the same structure legitimately
   appears in more than one — the inferior vena cava is taught on four
   thoracic films and on twelve abdominal ones, and those are two different
   pages worth opening. Collapsing them would hide the more useful one.
   =========================================================================== */

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Narrows the results to one chapter; the chapter pages use this. */
  chapter?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

export default function AtlasSearch({ value, onChange, chapter, placeholder, autoFocus }: Props) {
  const deferred = useDeferredValue(value);
  const results = useMemo(() => {
    const hits = searchStructures(deferred);
    return chapter ? hits.filter((h) => h.structure.chapter === chapter) : hits;
  }, [deferred, chapter]);

  const searching = deferred.trim().length >= 2;

  return (
    <div className="atlas-search">
      <input
        type="search"
        className="atlas-search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search anatomical structures…'}
        aria-label="Search anatomical structures"
        autoFocus={autoFocus}
      />

      {searching && (
        <div className="atlas-search-results" role="listbox" aria-label="Search results">
          {results.length === 0 ? (
            <p className="atlas-search-empty">
              Nothing matches “{deferred.trim()}”. Structure names come from the answers in the
              question bank, so try the wording an answer would use.
            </p>
          ) : (
            <ul className="atlas-hit-list">
              {results.map(({ structure, chapterTitle, matchedAlias }) => (
                <li key={`${structure.chapter}-${structure.id}`}>
                  <Link
                    className="atlas-hit"
                    to={`/atlas/${structure.chapter}/${structure.id}`}
                    onClick={() => onChange('')}
                  >
                    <span className="atlas-hit-thumb" aria-hidden="true">
                      <AtlasFilm
                        src={assetUrl(structure.representative.src)}
                        alt=""
                        crop={structure.representative.crop}
                        orientation={structure.representative.orientation}
                        showLabels={false}
                      />
                    </span>
                    <span className="atlas-hit-main">
                      <span className="atlas-hit-name">{structure.name}</span>
                      <span className="atlas-hit-meta mono">
                        {chapterTitle} · {structure.images.length}{' '}
                        {structure.images.length === 1 ? 'image' : 'images'}
                        {matchedAlias && <> · also “{matchedAlias}”</>}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
