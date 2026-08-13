import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { assetUrl } from '../lib/assetUrl';
import './AnatomyJourney.css';

/* ONE continuous frontal body. The specimen is a single composed image —
   the radiographic point-cloud frame (skull, spine, arms, pelvis, legs)
   with the premium thorax and abdomen renders seated on it — so the page
   scrolls through one anatomical person, head to toe, facing the reader.

   The wrapper is many viewports tall; the sticky viewport pins; the body
   translates upward with damped scroll progress. Native scroll only; every
   mapping is a pure function of progress, so the film runs identically in
   reverse. React renders once; the rAF loop owns every moving style. */

interface JourneyProps {
  startTo: string;
  onQuestionBank: () => void;
  /* The six module chips that used to sit here are gone. They repeated the
     topic list further down the same page, so the reader met the identical
     six links twice before reaching anything they had not already seen. The
     topics live once, in the worklist, where they carry progress with them. */
  metaLine?: string;
  onSkip?: () => void;
  /* When the skull hero above owns the h1, this section must not render a
     second one. Set by Home only when frames exist; with no frames on disk
     this file behaves exactly as it did before. */
  showCopy?: boolean;
}

/* Body space: the composed image is 1200x3600 (1:3), displayed BODY_VH tall.
   Landmarks, measured off the composition itself:
   vertex 7 · chin 58 · shoulder 75 · xiphoid 130 · pubis 200 · knee 297 ·
   ankle 377 · sole 393 (vh). */
const BODY_VH = 400;

/* Bands drive the region names and callout focus as the scan plane passes. */
interface Band {
  key: string;
  index: string;
  name: string;
  centre: number; // vh, body space
  half: number;
}

const BANDS: Band[] = [
  { key: 'head', index: '01', name: 'Neuroanatomy', centre: 34, half: 46 },
  { key: 'thorax', index: '02', name: 'Thoracic anatomy', centre: 105, half: 45 },
  { key: 'abdomen', index: '03', name: 'Abdominal & pelvic', centre: 172, half: 42 },
  { key: 'msk', index: '04', name: 'Musculoskeletal', centre: 240, half: 42 },
  { key: 'legs', index: '05', name: 'Lower limb', centre: 330, half: 62 },
];

interface Callout {
  band: string;
  title: string;
  top: number; // vh, body space
  x: number; // vw offset from the axis
  side: 'left' | 'right';
}

const CALLOUTS: Callout[] = [
  { band: 'head', title: 'Calvarium', top: 24, x: 7, side: 'right' },
  { band: 'head', title: 'Cervical spine', top: 60, x: -10, side: 'left' },
  { band: 'thorax', title: 'Aortic arch', top: 92, x: 12, side: 'right' },
  { band: 'thorax', title: 'Pulmonary trunk', top: 106, x: 10, side: 'right' },
  { band: 'thorax', title: 'Right main bronchus', top: 114, x: -13, side: 'left' },
  { band: 'abdomen', title: 'Liver', top: 148, x: -12, side: 'left' },
  { band: 'abdomen', title: 'Portal vein', top: 160, x: -9, side: 'left' },
  { band: 'abdomen', title: 'Pancreas', top: 154, x: 11, side: 'right' },
  { band: 'msk', title: 'Iliac wing', top: 178, x: -11, side: 'left' },
  { band: 'msk', title: 'Carpus', top: 214, x: 13, side: 'right' },
  { band: 'msk', title: 'Proximal femur', top: 232, x: 9, side: 'right' },
  { band: 'legs', title: 'Femoral shaft', top: 262, x: -9, side: 'left' },
  { band: 'legs', title: 'Patella', top: 297, x: 8, side: 'right' },
  { band: 'legs', title: 'Tibial shaft', top: 330, x: -8, side: 'left' },
  { band: 'legs', title: 'Ankle mortise', top: 374, x: 8, side: 'right' },
];

interface Panel {
  src: string;
  label: string;
  top: number;
  x: number;
  w: number;
}

const PANELS: Panel[] = [
  { src: '/ct/head-bone/s012.webp', label: 'AXIAL', top: 12, x: 76, w: 13 },
  { src: '/ct/head-bone/s020.webp', label: 'AXIAL', top: 48, x: 8, w: 11 },
  { src: '/cxr/radiograph-1.png', label: 'PA', top: 92, x: 78, w: 12 },
  { src: '/cxr/radiograph-2.png', label: 'PA', top: 138, x: 6, w: 12 },
  { src: '/mri/hip-axial-t1/s006.webp', label: 'T1', top: 188, x: 77, w: 13 },
  { src: '/mri/hip-axial-t1/s012.webp', label: 'T1', top: 236, x: 7, w: 12 },
  { src: '/ct/head-bone/s028.webp', label: 'AXIAL', top: 292, x: 78, w: 11 },
  { src: '/mri/hip-axial-t1/s018.webp', label: 'T1', top: 344, x: 8, w: 12 },
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const win = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const ease = (t: number) => t * t * (3 - 2 * t);

export default function AnatomyJourney({ startTo, onQuestionBank, metaLine, onSkip, showCopy = true }: JourneyProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const panelsRef = useRef<HTMLDivElement>(null);
  const farRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const calloutRefs = useRef<(HTMLDivElement | null)[]>([]);
  const nameRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const planeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      wrap.classList.add('is-static');
      return;
    }

    let target = 0;
    let value = -1;
    let raf = 0;

    const measure = () => {
      const rect = wrap.getBoundingClientRect();
      const span = wrap.offsetHeight - window.innerHeight;
      target = span > 0 ? clamp01(-rect.top / span) : 0;
    };

    const paint = (p: number) => {
      const vh = window.innerHeight;
      const bodyPx = (BODY_VH / 100) * vh;
      const travel = bodyPx - vh;

      /* The camera travels the specimen: 1.0x for the body, slower for the
         imaging planes and the far rulings — three depths of parallax. */
      const y = -travel * p;
      const body = bodyRef.current;
      if (body) body.style.transform = `translate3d(0, ${y}px, 0)`;
      const panels = panelsRef.current;
      if (panels) panels.style.transform = `translate3d(0, ${y * 0.78}px, 0)`;
      const far = farRef.current;
      if (far) far.style.transform = `translate3d(0, ${y * 0.35}px, 0)`;

      /* Focus: whichever band's centre is nearest the scan plane. */
      const planeY = 0.46 * vh;
      const focus: Record<string, number> = {};
      for (const b of BANDS) {
        const centre = (b.centre / 100) * vh + y;
        const f = 1 - clamp01(Math.abs(centre - planeY) / ((b.half / 100) * vh + 0.28 * vh));
        focus[b.key] = ease(f);
      }

      CALLOUTS.forEach((c, i) => {
        const el = calloutRefs.current[i];
        if (!el) return;
        /* Each callout also wants its OWN anchor near the plane, so labels
           light up as their structure passes, not all at once per band. */
        const own = 1 - clamp01(Math.abs((c.top / 100) * vh + y - planeY) / (0.34 * vh));
        const f = ease(Math.min(win(focus[c.band] ?? 0, 0.3, 0.9), own));
        el.style.opacity = String(f);
        el.style.setProperty('--line-draw', String(f));
      });

      /* Hero copy leaves early; the body takes the page. */
      const COPY_GONE = 0.16;
      const copyFade = ease(win(p, 0.06, COPY_GONE));

      /* Region names share the lower-left corner with the copy column, so
         they may only appear once the copy has completely gone. Starting
         them at 0.10 while the copy faded until 0.16 left a stretch of
         scroll where the module chips and the region name were drawn over
         each other. The gate now begins where the copy ends.

         Accepted cosmetic cost of the showCopy prop: with the copy hoisted
         into the skull hero there is nothing left for the names to avoid,
         yet they still wait ~58vh. Making the gate conditional means putting
         showCopy into this effect's dependency list; not worth it. */
      const nameGate = ease(win(p, COPY_GONE, COPY_GONE + 0.08));
      BANDS.forEach((b, i) => {
        const el = nameRefs.current[i];
        if (!el) return;
        el.style.opacity = String(ease(win(focus[b.key] ?? 0, 0.55, 1)) * 0.9 * nameGate);
      });
      const copy = copyRef.current;
      if (copy) {
        copy.style.opacity = String(1 - copyFade);
        copy.style.transform = `translate3d(0, ${-6 * copyFade}vh, 0)`;
        copy.style.pointerEvents = copyFade > 0.6 ? 'none' : '';
      }

      /* The scan plane arrives with movement, leaves with the ending. */
      const exit = ease(win(p, 0.9, 1));
      const plane = planeRef.current;
      if (plane) {
        plane.style.opacity = String((0.25 + 0.35 * ease(win(p, 0.05, 0.2))) * (1 - exit));
      }
      if (body) body.style.opacity = String(1 - 0.6 * exit);
      if (panels) panels.style.opacity = String(1 - exit);
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const next = value < 0 ? target : value + (target - value) * 0.08;
      if (Math.abs(next - value) < 0.0004) return;
      value = next;
      paint(value);
    };

    const onScroll = () => measure();
    const onResize = () => {
      measure();
      value = -1; // repaint everything against the new viewport
    };
    /* rAF stops in a hidden tab, so the damped value freezes wherever it
       was. Coming back, snap to the scroll's true position — otherwise the
       page replays the catch-up as a visible sweep. */
    const onVisible = () => {
      if (!document.hidden) {
        measure();
        value = -1;
      }
    };

    measure();
    paint(target);
    value = target;
    raf = requestAnimationFrame(loop);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <div className="anatomy-journey" ref={wrapRef}>
      <section className="journey-viewport" aria-label="A scroll through the human body">
        <div className="journey-far" ref={farRef} aria-hidden="true">
          {[36, 90, 144, 198, 252, 306, 360].map((t) => (
            <span className="far-rule mono" style={{ top: `${t}vh` }} key={t}>
              {String(t * 10).padStart(4, '0')}
            </span>
          ))}
        </div>

        <div className="journey-panels" ref={panelsRef} aria-hidden="true">
          {PANELS.map((panel) => (
            <div
              className="journey-panel"
              key={panel.src + panel.top}
              style={{ top: `${panel.top}vh`, left: `${panel.x}%`, width: `${panel.w}vw` }}
            >
              <img src={assetUrl(panel.src)} alt="" loading="lazy" />
              <span className="journey-panel-label mono">{panel.label}</span>
            </div>
          ))}
        </div>

        {/* THE BODY — one frontal specimen, head to toe. */}
        <div className="giant-human" ref={bodyRef}>
          <img className="body-full" src={assetUrl("/images/hero/body-full.webp")} alt="" aria-hidden="true" />

          {CALLOUTS.map((c, i) => (
            <div
              className={`journey-callout is-${c.side}`}
              key={c.title}
              ref={(el) => {
                calloutRefs.current[i] = el;
              }}
              style={{
                top: `${c.top}vh`,
                left: c.side === 'right' ? `calc(57% + ${c.x}vw)` : undefined,
                right: c.side === 'left' ? `calc(43% + ${-c.x}vw)` : undefined,
              }}
              aria-hidden="true"
            >
              <span className="journey-callout-line" />
              <span className="journey-callout-title">{c.title}</span>
            </div>
          ))}
        </div>

        <span className="journey-beam" aria-hidden="true" />
        <span className="journey-plane" ref={planeRef} aria-hidden="true" />

        {showCopy && (
        <div className="journey-copy" ref={copyRef}>
          <h1 className="hero-title">
            Radiology Anatomy,
            <br />
            <em>Made Visible.</em>
          </h1>
          <p className="hero-eq">See what the structure means.</p>
          <p className="hero-sub">Interactive visual learning for FRCR anatomy.</p>
          {metaLine && <p className="hero-meta mono">{metaLine}</p>}
          <div className="rpa-hero-actions">
            <Link className="btn btn-primary" to={startTo}>
              Explore the Modules
              <span aria-hidden="true">→</span>
            </Link>
            <button type="button" className="btn" onClick={onQuestionBank}>
              Question Bank
            </button>
          </div>
          {onSkip && (
            <button type="button" className="journey-skip" onClick={onSkip}>
              Skip the scan — straight to the modules ↓
            </button>
          )}
        </div>
        )}

        <div className="journey-names" aria-hidden="true">
          {BANDS.map((b, i) => (
            <p
              className="journey-name"
              key={b.key}
              ref={(el) => {
                nameRefs.current[i] = el;
              }}
            >
              <span className="mono">{b.index}</span>
              {b.name}
            </p>
          ))}
        </div>

        {showCopy && (
          <p className="hero-cue">
            Scroll to explore
            <span className="cue-arrow" aria-hidden="true" />
          </p>
        )}
      </section>
    </div>
  );
}
