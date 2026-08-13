import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { assetUrl } from '../lib/assetUrl';
import { getChapter } from '../lib/atlas';
import type { AtlasImage, AtlasStructure } from '../lib/atlas/types';
import AtlasFilm from '../components/atlas/AtlasFilm';
import AtlasSearch from '../components/atlas/AtlasSearch';
import AtlasBreadcrumbs from '../components/atlas/AtlasBreadcrumbs';
import './Atlas.css';

/* ===========================================================================
   One chapter: every structure the question bank teaches in that region.

   Alphabetical by default, with an A–Z rail because two hundred structures
   is more than a page of scrolling. "Most images" is offered as well — it is
   the fastest way to find the anatomy the bank actually drills.

   The second tab shows the same chapter as films rather than as structures,
   for the times you remember the picture and not the name.
   =========================================================================== */

type SortMode = 'alpha' | 'images';
type View = 'structures' | 'images';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function firstLetter(name: string): string {
  const m = name.toUpperCase().match(/[A-Z]/);
  return m ? m[0] : '#';
}

export default function AtlasChapter() {
  const { chapterId = '' } = useParams();
  const chapter = getChapter(chapterId);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('alpha');
  const [view, setView] = useState<View>('structures');
  const [letter, setLetter] = useState<string | null>(null);

  const structures = useMemo(() => {
    if (!chapter) return [];
    const list = [...chapter.structures];
    if (sort === 'images') list.sort((a, b) => b.images.length - a.images.length || a.name.localeCompare(b.name));
    return letter ? list.filter((s) => firstLetter(s.name) === letter) : list;
  }, [chapter, sort, letter]);

  /* Every film in the chapter, once — the structures overlap, so the same
     image is reached from several of them. */
  const films = useMemo(() => {
    if (!chapter) return [];
    const seen = new Map<string, { image: AtlasImage; structures: AtlasStructure[] }>();
    for (const s of chapter.structures) {
      for (const i of s.images) {
        const found = seen.get(i.questionId);
        if (found) {
          if (!found.structures.includes(s)) found.structures.push(s);
        } else {
          seen.set(i.questionId, { image: i, structures: [s] });
        }
      }
    }
    return [...seen.values()].sort(
      (a, b) =>
        a.image.modality.localeCompare(b.image.modality) ||
        a.image.questionId.localeCompare(b.image.questionId)
    );
  }, [chapter]);

  const present = useMemo(() => {
    const set = new Set<string>();
    for (const s of chapter?.structures ?? []) set.add(firstLetter(s.name));
    return set;
  }, [chapter]);

  if (!chapter) {
    return (
      <div className="empty-state">
        <h1>Chapter not found</h1>
        <p>That address does not match any of the seven Atlas chapters.</p>
        <Link className="btn btn-primary" to="/anatomy/atlas">Back to the Structure Atlas</Link>
      </div>
    );
  }

  return (
    <div className="atlas atlas-chapter">
      <AtlasBreadcrumbs
        trail={[
          { label: 'Structure Atlas', to: '/anatomy/atlas' },
          { label: chapter.title },
        ]}
      />

      <header className="atlas-head">
        <p className="rpa-eyebrow">Structure Atlas</p>
        <h1>{chapter.title}</h1>
        <p className="atlas-lede">{chapter.blurb}</p>
        <p className="atlas-figures mono">
          {chapter.structures.length} structures · {chapter.imageCount} labelled images ·{' '}
          {chapter.filmCount} films
        </p>
      </header>

      <section className="atlas-search-band" aria-label={`Search ${chapter.title}`}>
        <AtlasSearch
          value={query}
          onChange={setQuery}
          chapter={chapter.id}
          placeholder={`Search structures in ${chapter.title}…`}
        />
      </section>

      {!query.trim() && (
        <>
          <div className="atlas-controls">
            <div className="seg" role="tablist" aria-label="View">
              <button
                type="button" role="tab" aria-selected={view === 'structures'}
                className={view === 'structures' ? 'seg-btn is-on' : 'seg-btn'}
                onClick={() => setView('structures')}
              >
                Structures
              </button>
              <button
                type="button" role="tab" aria-selected={view === 'images'}
                className={view === 'images' ? 'seg-btn is-on' : 'seg-btn'}
                onClick={() => setView('images')}
              >
                All images
              </button>
            </div>

            {view === 'structures' && (
              <div className="seg" role="group" aria-label="Sort">
                <button
                  type="button"
                  className={sort === 'alpha' ? 'seg-btn is-on' : 'seg-btn'}
                  onClick={() => setSort('alpha')}
                >
                  A–Z
                </button>
                <button
                  type="button"
                  className={sort === 'images' ? 'seg-btn is-on' : 'seg-btn'}
                  onClick={() => setSort('images')}
                >
                  Most images
                </button>
              </div>
            )}
          </div>

          {view === 'structures' && (
            <nav className="az-rail" aria-label="Jump to letter">
              <button
                type="button"
                className={letter === null ? 'az-btn is-on' : 'az-btn'}
                onClick={() => setLetter(null)}
              >
                All
              </button>
              {LETTERS.map((l) => (
                <button
                  key={l}
                  type="button"
                  className={letter === l ? 'az-btn is-on' : 'az-btn'}
                  onClick={() => setLetter(letter === l ? null : l)}
                  disabled={!present.has(l)}
                >
                  {l}
                </button>
              ))}
            </nav>
          )}

          {view === 'structures' ? (
            <section className="structure-grid" aria-label="Structures">
              {structures.map((s, i) => (
                <Link key={s.id} to={`/anatomy/atlas/${chapter.id}/${s.id}`} className="structure-card">
                  <span className="sc-thumb">
                    <AtlasFilm
                      src={assetUrl(s.representative.src)}
                      alt=""
                      crop={s.representative.crop}
                      orientation={s.representative.orientation}
                      showLabels={false}
                      /* The first rows are on screen already; the other two
                         hundred wait until they are scrolled to. */
                      loading={i < 12 ? 'eager' : 'lazy'}
                    />
                  </span>
                  <span className="sc-body">
                    <span className="sc-name">{s.name}</span>
                    <span className="sc-count mono">
                      {s.images.length} {s.images.length === 1 ? 'image' : 'images'}
                    </span>
                    {s.modalities.length > 1 && (
                      <span className="sc-mods">
                        {s.modalities.slice(0, 3).map((m) => (
                          <span className="pill" key={m}>{m}</span>
                        ))}
                      </span>
                    )}
                  </span>
                </Link>
              ))}
              {structures.length === 0 && (
                <p className="atlas-empty">
                  {chapter.structures.length === 0
                    ? 'No questions in the bank are filed under this chapter yet, so it has no structures. Add a question in the module and its structures appear here.'
                    : 'No structures start with that letter.'}
                </p>
              )}
            </section>
          ) : (
            <section className="film-grid" aria-label="All images">
              {films.map(({ image, structures: on }, i) => (
                <article key={image.questionId} className="film-card">
                  <Link
                    className="film-card-thumb"
                    to={`/anatomy/atlas/${chapter.id}/${on[0].id}`}
                    aria-label={`Open ${on[0].name}`}
                  >
                    <AtlasFilm
                      src={assetUrl(image.src)}
                      alt=""
                      crop={image.crop}
                      orientation={image.orientation}
                      showLabels={false}
                      loading={i < 9 ? 'eager' : 'lazy'}
                    />
                  </Link>
                  <div className="film-card-body">
                    <p className={image.description ? 'film-desc' : 'film-desc is-blank'}>
                      {image.description || 'Description not yet added'}
                    </p>
                    <p className="film-structures">
                      {on.slice(0, 6).map((s, i) => (
                        <span key={s.id}>
                          {i > 0 && <span className="fact-sep" aria-hidden="true">·</span>}
                          <Link to={`/anatomy/atlas/${chapter.id}/${s.id}`}>{s.name}</Link>
                        </span>
                      ))}
                      {on.length > 6 && <span className="mono"> +{on.length - 6}</span>}
                    </p>
                    <Link
                      className="film-source mono"
                      to={image.sourceHref ?? `/anatomy/section/${image.section}/q/${image.questionId}`}
                    >
                      {image.sourceLabel ?? 'View original question'}
                    </Link>
                  </div>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
