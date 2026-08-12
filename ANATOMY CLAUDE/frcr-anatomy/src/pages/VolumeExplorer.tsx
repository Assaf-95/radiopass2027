/* ===========================================================================
   The scout — a procedural CT volume you scroll through to choose a section.

   RECOVERY NOTE. src/lib/anatomy.ts (1,767 lines) and ScanVolume.tsx (443)
   were finished, committed, and then completely stranded: anatomy.ts was
   imported by ScanVolume alone, and ScanVolume was imported by nothing at all.
   2,210 lines of procedural volumetric rendering that no route could reach.

   They were originally the home-page hero. The home page has since moved to a
   pre-rendered frame sequence (SkullHero / AnatomyJourney, with its own
   build-hero-frames step), and that replacement works — so this does NOT try
   to take the hero back. Putting two heroes in competition would regress a
   page that is already right.

   Instead the engine is given the job it turns out to be perfect for. Its
   seven stops are 'scout' plus SIX SECTION IDS that match the question bank
   exactly — head-neck, thorax, spine, abdo-pelvis, upper-limb, lower-limb —
   and each carries the window a radiologist would actually use to read that
   region: Brain WL40/WW80 for the head, Lung WL-600/WW1500 for the chest,
   Bone WL300/WW1500 for the limbs. So it becomes a scout view: travel down
   the body, watch the window change with the region, and step into that
   section's questions from where you stopped.

   That is a teaching object rather than decoration. Windowing is examined, and
   here the window is not described — it is applied, to a volume carrying real
   Hounsfield densities, and the tissue that appears and disappears as the
   preset changes is the lesson.
   =========================================================================== */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import ScanVolume, { type ScanState } from '../components/ScanVolume';
import { getAnatomyStops } from '../lib/anatomy';
import { getSectionMeta } from '../data/sections';
import './VolumeExplorer.css';

/** Height of the scroll track per stop. Enough that a stop settles before the
    next begins, so the reader can stop and read rather than being swept past. */
const VH_PER_STOP = 90;

export default function VolumeExplorer() {
  const stops = getAnatomyStops();
  const trackRef = useRef<HTMLDivElement>(null);
  /* ScanVolume drives itself from a ref so the 60fps loop never re-renders
     React. The copy panel does need re-rendering, but only when the stop
     actually changes — hence an index in state, not the continuous position. */
  const stateRef = useRef<ScanState>({ scanT: 0, opacity: 1 });
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      // No scrubbing: park on the scout and let the buttons do the travelling.
      stateRef.current.scanT = 0;
      return;
    }

    let raf = 0;
    const read = () => {
      raf = 0;
      const r = track.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      const p = total <= 1 ? 0 : Math.min(1, Math.max(0, -r.top / total));
      const t = p * (stops.length - 1);
      stateRef.current.scanT = t;
      const nearest = Math.round(t);
      setIndex((prev) => (prev === nearest ? prev : nearest));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };

    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [stops.length]);

  /** Scrolls the track so a chosen stop lands under the sticky viewport. */
  const goTo = (i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const total = track.offsetHeight - window.innerHeight;
    const y = track.offsetTop + (total * i) / (stops.length - 1);
    window.scrollTo({ top: y, behavior: 'smooth' });
  };

  const stop = stops[Math.min(index, stops.length - 1)];
  const meta = stop.key === 'scout' ? null : getSectionMeta(stop.key as never);

  return (
    <div className="vx">
      <div className="vx-track" ref={trackRef} style={{ height: `${stops.length * VH_PER_STOP}vh` }}>
        <div className="vx-pin">
          <div className="vx-stage">
            <ScanVolume stateRef={stateRef} />
          </div>

          <div className="vx-copy">
            <p className="vx-eyebrow">
              {stop.key === 'scout' ? 'Scout' : `Series ${index} of ${stops.length - 1}`}
            </p>
            <h1>{meta ? meta.title : 'The whole study'}</h1>
            <p className="vx-desc">
              {meta
                ? meta.description
                : 'Scroll to travel down the body. The window changes with the region, exactly as it would on the workstation — and what each preset lets you see is the point.'}
            </p>
            {meta && (
              <p className="vx-preset">
                Read on a <strong>{stop.window.preset.toLowerCase()}</strong> window — the corner
                console carries the live numbers.
              </p>
            )}

            {/* Deliberately NOT a second window readout.
                ScanVolume already prints the preset, WL/WW and table position
                in the workstation corners, driven by the frame actually on
                screen. A panel here repeating those numbers was the first
                thing that went wrong: because the volume interpolates smoothly
                between stops while this heading snaps to the nearest one, the
                two consoles disagreed mid-travel — this panel read "Thorax ·
                Lung · −600" while the corner still read "BRAIN · WL 40 WW 80".
                Two consoles contradicting each other is worse than one, and
                the corner is where a radiologist looks anyway. */}
            {meta && (
              <Link className="btn btn-primary vx-go" to={`/section/${stop.key}`}>
                Open {meta.title} questions →
              </Link>
            )}
          </div>

          <nav className="vx-rail" aria-label="Jump to a region">
            {stops.map((s, i) => {
              const m = s.key === 'scout' ? null : getSectionMeta(s.key as never);
              return (
                <button
                  key={s.key}
                  type="button"
                  className={i === index ? 'vx-stop is-on' : 'vx-stop'}
                  aria-current={i === index}
                  onClick={() => goTo(i)}
                >
                  <span className="vx-stop-dot" aria-hidden="true" />
                  <span className="vx-stop-label">{m ? m.title : 'Scout'}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="vx-foot">
        <p>
          Every point is computed, not filmed: {stops.length} regions built from real Hounsfield
          densities, windowed live. Nothing here is a photograph or a video.
        </p>
        <Link className="btn" to="/">
          ← Back to the sections
        </Link>
      </div>
    </div>
  );
}
