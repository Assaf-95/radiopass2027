import { HERO_FRAMES } from '../data/heroFrames';
import { posterUrl } from '../lib/skullFrames';
import './SkullHero.css';

/* One still skull beside the copy, in one viewport, scrolling away like any
   other section.

   The lineage matters here because each cut was the owner's call. This began
   as a ten-frame rotation scrubbed across 300vh of pinned scroll; the turn
   ghosted ("whenever you turn the skull, you make it so ugly"), so it became
   a pinned dissolve to the chest; the pin itself then read as a jump — the
   page freezes while the dissolve spends scroll, then lurches on — so the pin
   went too ("scrolled smoothly as one page... no jumps"). And the chest is no
   longer a destination at all: it lives in Home as a fixed, faint layer BEHIND
   the modules, felt rather than presented.

   What survives is deliberately boring: a static section, no refs, no effects,
   no rAF, no scroll maths. There is nothing left to jump. */

interface SkullHeroProps {
  /** Where an unfinished session resumes; empty when nothing has been started. */
  startTo: string;
  onQuestionBank: () => void;
  metaLine?: string;
  onSkip?: () => void;
}

export default function SkullHero({
  startTo,
  onQuestionBank,
  metaLine,
  onSkip,
}: SkullHeroProps) {
  /* Safe even if someone later forgets the gate in Home. */
  if (!HERO_FRAMES.ladders.length) return null;

  const poster = posterUrl();

  return (
    <div className="skull-hero" data-hero-ready="1">
      <section className="skull-pin" aria-label="Introduction">
        <div className="skull-stage">
          {poster && (
            <img
              className="skull-poster"
              src={poster}
              alt=""
              aria-hidden="true"
              fetchPriority="high"
              decoding="async"
            />
          )}
        </div>

        <div className="skull-copy">
          <h1 className="hero-title">
            Radiology Anatomy,
            <br />
            <em>Made Visible.</em>
          </h1>
          <p className="hero-eq">See what the structure means.</p>
          <p className="hero-sub">Interactive visual learning for FRCR anatomy.</p>
          {metaLine && <p className="hero-meta mono">{metaLine}</p>}
          {/* One way in, not three. The six region chips and "Explore the
              Modules" repeated the topic list further down the same page —
              the reader met the same six links twice before reaching anything
              they had not already seen. The question bank is the thing the
              page is for, so it is the only action here. */}
          <div className="hero-actions">
            <button type="button" className="btn btn-primary" onClick={onQuestionBank}>
              {startTo ? 'Resume the question bank' : 'Start the question bank'}
              <span aria-hidden="true">→</span>
            </button>
          </div>
          {onSkip && (
            <button type="button" className="journey-skip" onClick={onSkip}>
              Skip — straight to the modules ↓
            </button>
          )}
        </div>

        <p className="hero-cue">
          Scroll to explore
          <span className="cue-arrow" aria-hidden="true" />
        </p>
      </section>
    </div>
  );
}
