import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { assetUrl } from '../lib/assetUrl';
import { getAtlas } from '../lib/atlas';
import AtlasFilm from '../components/atlas/AtlasFilm';
import AtlasSearch from '../components/atlas/AtlasSearch';
import AtlasBreadcrumbs from '../components/atlas/AtlasBreadcrumbs';
import './Atlas.css';

/* ===========================================================================
   Structure Atlas — the seven chapters.

   The other way into the same material. The question bank asks "what is A?";
   the Atlas answers "show me every A you have". Same films, same answers, no
   second database — the numbers on these cards are counted out of the bank
   every time the page opens.
   =========================================================================== */

export default function AtlasHome() {
  const atlas = getAtlas();
  const [query, setQuery] = useState('');

  /* One film to stand for each chapter: the representative image of its
     best-covered structure, which is reliably a clean, central film. */
  const cards = useMemo(
    () =>
      atlas.chapters.map((c) => {
        const busiest = [...c.structures].sort((a, b) => b.images.length - a.images.length)[0];
        return { chapter: c, cover: busiest?.representative, coverName: busiest?.name };
      }),
    [atlas]
  );

  const totalStructures = atlas.totals.structures;

  return (
    <div className="atlas atlas-home">
      <AtlasBreadcrumbs trail={[{ label: 'Modules', to: '/' }, { label: 'Structure Atlas' }]} />

      <header className="atlas-head">
        <p className="rpa-eyebrow">Revision</p>
        <h1>Structure Atlas</h1>
        <p className="atlas-lede">
          Choose a structure and see every image in the question bank that teaches it — across
          modalities, planes and levels, side by side.
        </p>
        <p className="atlas-figures mono">
          {totalStructures} structures · {atlas.totals.images} labelled images · {atlas.totals.films} films
        </p>
      </header>

      <section className="atlas-search-band" aria-label="Search the Atlas">
        <AtlasSearch value={query} onChange={setQuery} />
      </section>

      {!query.trim() && (
        <section className="chapter-grid" aria-label="Chapters">
          {cards.map(({ chapter, cover, coverName }) => (
            <Link key={chapter.id} to={`/anatomy/atlas/${chapter.id}`} className="chapter-card">
              <span className="chapter-cover" aria-hidden="true">
                {cover ? (
                  <AtlasFilm
                    src={assetUrl(cover.src)}
                    alt=""
                    crop={cover.crop}
                    orientation={cover.orientation}
                    showLabels={false}
                    /* Seven images. Deferring them leaves seven black cards
                       on the page a reader lands on. */
                    loading="eager"
                  />
                ) : (
                  <span className="chapter-cover-blank" />
                )}
              </span>
              <span className="chapter-body">
                <span className="chapter-code mono">{chapter.code}</span>
                <span className="chapter-title">{chapter.title}</span>
                <span className="chapter-blurb">{chapter.blurb}</span>
                <span className="chapter-figures mono">
                  {chapter.structures.length} structures · {chapter.imageCount} images
                </span>
                {coverName && (
                  <span className="chapter-cover-note mono">Shown: {coverName}</span>
                )}
              </span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
