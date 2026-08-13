import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { STUDIES, STUDY_LIST, DEFAULT_STUDY } from '../data/studies';
import { assetUrl } from '../lib/assetUrl';
import {
  annotationAt,
  levelFor,
  CATEGORY_LABEL,
  type MriStudy,
  type Structure,
  type StructureCategory,
} from '../lib/mri/types';
import './MriViewer.css';


/* --- Label modes ----------------------------------------------------------
   Muscles first, because that is what this study is for. */
type Mode =
  | 'all'
  | 'muscle'
  | 'tendon'
  | 'bonejoint'
  | 'nerve'
  | 'vessel'
  | 'major'
  | 'other'
  | 'none'
  | 'quiz';

const ALL_MODES: { id: Mode; label: string; needs?: StructureCategory[] }[] = [
  { id: 'major', label: 'Major structures' },
  { id: 'muscle', label: 'Muscles', needs: ['muscle'] },
  { id: 'tendon', label: 'Tendons', needs: ['tendon'] },
  { id: 'bonejoint', label: 'Bones & sutures', needs: ['bone', 'joint'] },
  { id: 'nerve', label: 'Nerves', needs: ['nerve'] },
  { id: 'vessel', label: 'Vessels', needs: ['vessel'] },
  { id: 'other', label: 'Sinuses, foramina & spaces', needs: ['other'] },
  { id: 'all', label: 'All labels' },
  { id: 'none', label: 'No labels' },
  { id: 'quiz', label: 'Quiz' },
];

function modesFor(study: MriStudy) {
  const present = new Set(study.structures.map((s) => s.category));
  return ALL_MODES.filter((m) => !m.needs || m.needs.some((c) => present.has(c)));
}

function inMode(s: Structure, mode: Mode): boolean {
  // A structure that has not been reviewed and is only a guess stays out of
  // the viewer entirely; it lives in the editor until someone approves it.
  if (s.confidence === 'low' && !s.verified) return false;
  switch (mode) {
    case 'none':
      return false;
    case 'muscle':
      return s.category === 'muscle';
    case 'tendon':
      return s.category === 'tendon';
    case 'bonejoint':
      return s.category === 'bone' || s.category === 'joint';
    case 'nerve':
      return s.category === 'nerve';
    case 'vessel':
      return s.category === 'vessel';
    case 'other':
      return s.category === 'other' || s.category === 'fascia';
    case 'major':
      return !!s.major;
    case 'all':
    case 'quiz':
      return true;
  }
}

const STORAGE_KEY_BASE = 'radiopass-stack-annotations-v1';

/* Loose comparison for quiz answers: case, punctuation and the word "muscle"
   should never be the difference between right and wrong, but a different
   muscle always should be. */
function normalise(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\b(muscle|muscles|tendon|the|of|nerve)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function editDistance(a: string, b: string) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

function answerMatches(given: string, s: Structure) {
  const g = normalise(given);
  if (!g) return false;
  const targets = [s.name, ...(s.synonyms ?? [])].map(normalise);
  // Spelling tolerance scales with length, but never enough to let a
  // different muscle through.
  return targets.some((t) => {
    if (!t) return false;
    const tol = t.length > 12 ? 2 : t.length > 6 ? 1 : 0;
    return t === g || editDistance(t, g) <= tol;
  });
}

interface PlacedLabel {
  s: Structure;
  side: 'left' | 'right';
  y: number;
  tipX: number;
  tipY: number;
}

export default function MriViewer() {
  const { studyId } = useParams<{ studyId: string }>();
  /* The Structure Atlas links to a particular slice, so arriving from a CT or
     MRI image in a gallery opens the picture that was being looked at rather
     than the middle of the stack. */
  const [search] = useSearchParams();
  const BASE = STUDIES[studyId ?? DEFAULT_STUDY] ?? STUDIES[DEFAULT_STUDY];
  const [study, setStudy] = useState<MriStudy>(BASE);
  const requestedSlice = (() => {
    const raw = Number(search.get('slice'));
    return Number.isInteger(raw) && raw >= 0 && raw < BASE.sliceCount ? raw : null;
  })();
  const [slice, setSlice] = useState(requestedSlice ?? Math.floor(BASE.sliceCount / 3));

  /* Switching study is a different stack, different annotations and a
     different slice range, so everything resets rather than carrying over.
     Keyed on the study alone, deliberately: including the requested slice
     would make scrolling away from an Atlas link snap straight back to it,
     because the ?slice= parameter is still in the URL. It is a starting
     position, not a lock. */
  useEffect(() => {
    setStudy(BASE);
    setSlice(requestedSlice ?? Math.floor(BASE.sliceCount / 3));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [BASE]);
  const [mode, setMode] = useState<Mode>('major');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [playing, setPlaying] = useState(false);
  const [playDir, setPlayDir] = useState<1 | -1>(1);
  const [speed, setSpeed] = useState(6);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [follow, setFollow] = useState(false);
  const [query, setQuery] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pulse, setPulse] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [box, setBox] = useState<{ left: number; top: number; w: number; h: number } | null>(null);

  /* Restore any locally edited annotations over the shipped ones. */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_BASE}:${BASE.id}`);
      if (raw) setStudy(JSON.parse(raw) as MriStudy);
    } catch {
      /* a corrupt local copy should never stop the viewer loading */
    }
  }, [BASE.id]);

  const persist = useCallback((next: MriStudy) => {
    setStudy(next);
    try {
      localStorage.setItem(`${STORAGE_KEY_BASE}:${BASE.id}`, JSON.stringify(next));
    } catch {
      /* private browsing: the session still works, it just will not persist */
    }
  }, [BASE.id]);

  const src = useCallback(
    (i: number) => assetUrl(study.imagePattern.replace('{index}', String(i).padStart(3, '0'))),
    [study.imagePattern]
  );

  /* Adjacent slices are fetched eagerly so scrolling never shows a gap; the
     rest are left to the browser. */
  useEffect(() => {
    for (const d of [1, -1, 2, -2, 3, -3]) {
      const i = slice + d;
      if (i >= 0 && i < study.sliceCount) {
        const im = new Image();
        im.src = src(i);
      }
    }
  }, [slice, study.sliceCount, src]);

  const measure = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const stage = stageRef.current;
    if (!canvas || !img || !stage || !img.naturalWidth) return;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (!cw || !ch) return;
    const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    const cRect = canvas.getBoundingClientRect();
    const sRect = stage.getBoundingClientRect();
    setBox({
      left: cRect.left - sRect.left + (cw - w) / 2,
      top: cRect.top - sRect.top + (ch - h) / 2,
      w,
      h,
    });
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (canvasRef.current) ro.observe(canvasRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure, fullscreen]);

  const clampSlice = useCallback(
    (v: number) => Math.max(0, Math.min(study.sliceCount - 1, v)),
    [study.sliceCount]
  );

  /* Autoplay. Bounces at the ends rather than jumping back to the start,
     which is how a reader actually reviews a stack. */
  useEffect(() => {
    if (!playing) return;
    // Reduced motion means nothing animates unless the reader asks for it, so
    // autoplay is the reader's own request and is allowed — but it starts at a
    // gentler rate.
    const rate =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? Math.min(speed, 3) : speed;
    const id = window.setInterval(() => {
      setSlice((s) => {
        const next = s + playDir;
        if (next < 0 || next >= study.sliceCount) {
          setPlayDir((d) => (d === 1 ? -1 : 1));
          return s;
        }
        return next;
      });
    }, 1000 / rate);
    return () => window.clearInterval(id);
  }, [playing, playDir, speed, study.sliceCount]);

  /* Wheel over the image changes slice and never scrolls the page; anywhere
     else on the page behaves normally. */
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    let acc = 0;
    function onWheel(e: WheelEvent) {
      if (e.ctrlKey) return; // leave pinch-zoom to the browser
      e.preventDefault();
      acc += e.deltaY;
      const step = 40;
      while (Math.abs(acc) >= step) {
        const dir = acc > 0 ? 1 : -1;
        acc -= dir * step;
        setSlice((s) => clampSlice(s + dir));
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [clampSlice]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        setSlice((s) => clampSlice(s + 1));
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setSlice((s) => clampSlice(s - 1));
      } else if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === 'Escape') {
        setFullscreen(false);
        setSelected(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clampSlice]);

  /* Drag: pans when zoomed in, scrubs slices when not. */
  const drag = useRef<{ x: number; y: number; slice: number; pan: { x: number; y: number } } | null>(
    null
  );
  function onPointerDown(e: React.PointerEvent) {
    if (editing) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, slice, pan };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    if (zoom > 1) {
      setPan({ x: d.pan.x + (e.clientX - d.x), y: d.pan.y + (e.clientY - d.y) });
    } else {
      setSlice(clampSlice(d.slice + Math.round((e.clientY - d.y) / 12)));
    }
  }
  function onPointerUp() {
    drag.current = null;
  }

  const visible = useMemo(
    () =>
      study.structures.filter(
        (s) => slice >= s.firstSlice && slice <= s.lastSlice && inMode(s, mode === 'quiz' ? 'all' : mode)
      ),
    [study.structures, slice, mode]
  );

  /* Label layout: rails outside the image, staggered so no two collide. */
  const placed: PlacedLabel[] = useMemo(() => {
    if (!box) return [];
    const out: PlacedLabel[] = [];
    for (const side of ['left', 'right'] as const) {
      const items = visible
        .map((s) => {
          const a = annotationAt(s, slice);
          if (!a) return null;
          const sd = a.labelSide ?? (a.targetX < 0.5 ? 'left' : 'right');
          if (sd !== side) return null;
          return { s, y: a.labelY ?? a.targetY, tipX: a.targetX, tipY: a.targetY };
        })
        .filter(Boolean) as { s: Structure; y: number; tipX: number; tipY: number }[];
      items.sort((a, b) => a.y - b.y);
      const gap = Math.min(0.075, 0.92 / Math.max(1, items.length));
      let last = -1;
      for (const it of items) {
        const y = Math.min(0.97, Math.max(0.03, last < 0 ? it.y : Math.max(it.y, last + gap)));
        last = y;
        out.push({ s: it.s, side, y, tipX: it.tipX, tipY: it.tipY });
      }
    }
    return out;
  }, [visible, slice, box]);

  const shown = mode === 'quiz' ? [] : placed;

  const level = levelFor(study, slice);
  const pct = Math.round((slice / Math.max(1, study.sliceCount - 1)) * 100);

  /* Search moves to the slice where a structure is best seen — the middle of
     its range — and pulses it. */
  const matches = useMemo(() => {
    const q = normalise(query);
    if (!q) return [];
    return study.structures.filter((s) =>
      [s.name, ...(s.synonyms ?? [])].some((n) => normalise(n).includes(q))
    );
  }, [query, study.structures]);

  function goTo(s: Structure) {
    const mid = Math.round((s.firstSlice + s.lastSlice) / 2);
    setSlice(clampSlice(mid));
    setSelected(s.structureId);
    setPulse(s.structureId);
    setQuery('');
    window.setTimeout(() => setPulse(null), 1400);
  }

  const selectedStructure = study.structures.find((s) => s.structureId === selected) ?? null;

  useEffect(() => {
    if (!follow || !selected) return;
    const s = study.structures.find((x) => x.structureId === selected);
    if (s && (slice < s.firstSlice || slice > s.lastSlice)) setFollow(false);
  }, [follow, selected, slice, study.structures]);

  /* --- Quiz ------------------------------------------------------------- */
  const [quizTarget, setQuizTarget] = useState<Structure | null>(null);
  const [quizInput, setQuizInput] = useState('');
  const [quizResult, setQuizResult] = useState<'right' | 'wrong' | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0, streak: 0, best: 0 });
  const [quizKind, setQuizKind] = useState<'typed' | 'choice'>('typed');
  const [quizFilter, setQuizFilter] = useState<'all' | StructureCategory>('all');
  const [missed, setMissed] = useState<string[]>([]);

  const quizPool = useMemo(
    () =>
      study.structures.filter(
        (s) => !(s.confidence === 'low' && !s.verified) && (quizFilter === 'all' || s.category === quizFilter)
      ),
    [study.structures, quizFilter]
  );

  const nextQuestion = useCallback(() => {
    if (!quizPool.length) return;
    const s = quizPool[Math.floor(Math.random() * quizPool.length)];
    const mid =
      s.firstSlice + Math.floor(Math.random() * Math.max(1, s.lastSlice - s.firstSlice + 1));
    setSlice(clampSlice(mid));
    setQuizTarget(s);
    setQuizInput('');
    setQuizResult(null);
  }, [quizPool, clampSlice]);

  useEffect(() => {
    if (mode === 'quiz' && !quizTarget) nextQuestion();
    if (mode !== 'quiz') {
      setQuizTarget(null);
      setQuizResult(null);
    }
  }, [mode, quizTarget, nextQuestion]);

  const choices = useMemo(() => {
    if (!quizTarget || quizKind !== 'choice') return [];
    const others = quizPool.filter((s) => s.structureId !== quizTarget.structureId);
    const pick: Structure[] = [];
    const used = new Set<string>();
    while (pick.length < 3 && pick.length < others.length) {
      const c = others[Math.floor(Math.random() * others.length)];
      if (used.has(c.structureId)) continue;
      used.add(c.structureId);
      pick.push(c);
    }
    const all = [...pick, quizTarget];
    // Deterministic shuffle by name so the answer is not always last.
    return all.sort((a, b) => a.name.localeCompare(b.name));
  }, [quizTarget, quizKind, quizPool]);

  function submitQuiz(given: string) {
    if (!quizTarget || quizResult) return;
    const ok = answerMatches(given, quizTarget);
    setQuizResult(ok ? 'right' : 'wrong');
    setScore((s) => {
      const streak = ok ? s.streak + 1 : 0;
      return {
        right: s.right + (ok ? 1 : 0),
        total: s.total + 1,
        streak,
        best: Math.max(s.best, streak),
      };
    });
    if (!ok) setMissed((m) => (m.includes(quizTarget.name) ? m : [...m, quizTarget.name]));
  }

  const quizAnno = quizTarget ? annotationAt(quizTarget, slice) : null;

  /* --- Editing ---------------------------------------------------------- */
  const [editTarget, setEditTarget] = useState<string | null>(null);

  function setTip(x: number, y: number) {
    if (!editTarget) return;
    const next: MriStudy = {
      ...study,
      structures: study.structures.map((s) =>
        s.structureId !== editTarget
          ? s
          : {
              ...s,
              firstSlice: Math.min(s.firstSlice, slice),
              lastSlice: Math.max(s.lastSlice, slice),
              annotations: {
                ...s.annotations,
                [String(slice)]: {
                  ...(s.annotations[String(slice)] ?? {}),
                  targetX: Number(x.toFixed(4)),
                  targetY: Number(y.toFixed(4)),
                  labelSide: s.annotations[String(slice)]?.labelSide ?? (x < 0.5 ? 'left' : 'right'),
                  labelY: s.annotations[String(slice)]?.labelY ?? Number(y.toFixed(4)),
                },
              },
            }
      ),
    };
    persist(next);
  }

  function onCanvasClick(e: React.MouseEvent) {
    if (!editing || !editTarget || !box || !stageRef.current) return;
    const r = stageRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left - box.left) / box.w;
    const y = (e.clientY - r.top - box.top) / box.h;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    setTip(x, y);
  }

  function patchStructure(id: string, patch: Partial<Structure>) {
    persist({
      ...study,
      structures: study.structures.map((s) => (s.structureId === id ? { ...s, ...patch } : s)),
    });
  }

  function deleteAnnotationHere(id: string) {
    persist({
      ...study,
      structures: study.structures.map((s) => {
        if (s.structureId !== id) return s;
        const a = { ...s.annotations };
        delete a[String(slice)];
        return { ...s, annotations: a };
      }),
    });
  }

  function copyToAdjacent(id: string, dir: 1 | -1) {
    const s = study.structures.find((x) => x.structureId === id);
    const a = s && annotationAt(s, slice);
    if (!s || !a) return;
    const t = clampSlice(slice + dir);
    persist({
      ...study,
      structures: study.structures.map((x) =>
        x.structureId !== id
          ? x
          : {
              ...x,
              firstSlice: Math.min(x.firstSlice, t),
              lastSlice: Math.max(x.lastSlice, t),
              annotations: { ...x.annotations, [String(t)]: { ...a } },
            }
      ),
    });
    setSlice(t);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(study, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${study.id}-annotations.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importJson(file: File) {
    const r = new FileReader();
    r.onload = () => {
      try {
        persist(JSON.parse(String(r.result)) as MriStudy);
      } catch {
        window.alert('That file is not valid annotation JSON.');
      }
    };
    r.readAsText(file);
  }

  function resetAnnotations() {
    localStorage.removeItem(`${STORAGE_KEY_BASE}:${BASE.id}`);
    setStudy(BASE);
  }

  /* --- Render ----------------------------------------------------------- */

  const emphasise = (id: string) =>
    hovered === id || selected === id || pulse === id || (follow && selected === id);

  return (
    <div className={fullscreen ? 'mri mri-fullscreen' : 'mri'}>
      <header className="mri-top">
        <Link to="/anatomy" className="back-link">
          ← RadioPass
        </Link>
        <div className="mri-ident">
          <span className="mri-title">{study.title}</span>
          <span className="mri-sub mono">
            {study.plane.toUpperCase()} · {study.weighting} · {study.sliceCount} slices
          </span>
        </div>
        <div className="mri-modes">
          <label className="sr-only" htmlFor="mri-study">
            Study
          </label>
          <select
            id="mri-study"
            className="rpa-mri-select"
            value={BASE.id}
            onChange={(e) => {
              window.location.hash = `#/mri/${e.target.value}`;
            }}
          >
            {STUDY_LIST.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="mri-mode">
            Label mode
          </label>
          <select
            id="mri-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="rpa-mri-select"
          >
            {modesFor(BASE).map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <input
            className="mri-search"
            type="search"
            placeholder="Find a structure"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {matches.length > 0 && (
            <ul className="mri-results">
              {matches.slice(0, 7).map((s) => (
                <li key={s.structureId}>
                  <button type="button" onClick={() => goTo(s)}>
                    <span>{s.name}</span>
                    <span className="mono">
                      {s.firstSlice}–{s.lastSlice}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="btn" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Done editing' : 'Edit'}
          </button>
          <button type="button" className="btn" onClick={() => setFullscreen((v) => !v)}>
            {fullscreen ? 'Exit full screen' : 'Full screen'}
          </button>
        </div>
      </header>

      <div className="mri-body">
        <aside className="rpa-mri-controls">
          <section>
            <h2 className="mri-h">Slice</h2>
            <div className="mri-row">
              <button type="button" className="btn" onClick={() => setSlice(clampSlice(slice - 1))}>
                ↑
              </button>
              <span className="mri-readout mono">
                {slice + 1}/{study.sliceCount}
              </span>
              <button type="button" className="btn" onClick={() => setSlice(clampSlice(slice + 1))}>
                ↓
              </button>
            </div>
            <div className="mri-row">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setPlayDir(-1);
                  setPlaying(true);
                }}
              >
                ◀◀
              </button>
              <button type="button" className="btn" onClick={() => setPlaying((p) => !p)}>
                {playing ? 'Pause' : 'Play'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setPlayDir(1);
                  setPlaying(true);
                }}
              >
                ▶▶
              </button>
            </div>
            <label className="mri-field">
              <span>Speed {speed}/s</span>
              <input
                type="range"
                min={1}
                max={20}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              />
            </label>
          </section>

          <section>
            <h2 className="mri-h">Window</h2>
            <label className="mri-field">
              <span>Brightness {brightness}%</span>
              <input
                type="range"
                min={40}
                max={190}
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
              />
            </label>
            <label className="mri-field">
              <span>Contrast {contrast}%</span>
              <input
                type="range"
                min={40}
                max={220}
                value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
              />
            </label>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setBrightness(100);
                setContrast(100);
              }}
            >
              Reset window
            </button>
          </section>

          <section>
            <h2 className="mri-h">View</h2>
            <label className="mri-field">
              <span>Zoom {zoom.toFixed(1)}×</span>
              <input
                type="range"
                min={1}
                max={4}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
            </label>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
                setBrightness(100);
                setContrast(100);
              }}
            >
              Reset view
            </button>
            <label className="mri-check">
              <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
              <span>Follow selected structure</span>
            </label>
          </section>

          <section className="mri-orient">
            <h2 className="mri-h">Orientation</h2>
            <p className="mono">A — anterior (top)</p>
            <p className="mono">P — posterior (foot)</p>
            <p className="mri-sidenote">{study.sideNote}</p>
          </section>
        </aside>

        <div
          className="mri-stage"
          ref={stageRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="rpa-mri-canvas" ref={canvasRef} onClick={onCanvasClick}>
            <img
              ref={imgRef}
              className="mri-image"
              src={src(slice)}
              alt={`Axial slice ${slice + 1} of ${study.sliceCount} — ${level}`}
              draggable={false}
              onLoad={measure}
              style={{
                filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
            />
          </div>

          {box && (
            <svg className="mri-overlay" aria-hidden="true">
              {shown.map((p) => {
                const tx = box.left + p.tipX * box.w;
                const ty = box.top + p.tipY * box.h;
                const lx = p.side === 'left' ? box.left - 14 : box.left + box.w + 14;
                const ly = box.top + p.y * box.h;
                const midX = p.side === 'left' ? lx + (tx - lx) * 0.45 : lx - (lx - tx) * 0.45;
                const on = emphasise(p.s.structureId);
                return (
                  <g
                    key={p.s.structureId}
                    className={on ? 'mri-leader is-on' : 'mri-leader'}
                    data-conf={p.s.confidence}
                  >
                    <path d={`M ${lx} ${ly} Q ${midX} ${ly} ${tx} ${ty}`} fill="none" />
                    <circle cx={tx} cy={ty} r={on ? 4 : 2.6} />
                  </g>
                );
              })}

              {mode === 'quiz' && quizAnno && (
                <g className="mri-leader is-quiz">
                  <circle
                    cx={box.left + quizAnno.targetX * box.w}
                    cy={box.top + quizAnno.targetY * box.h}
                    r={7}
                  />
                  <circle
                    className="mri-quiz-ring"
                    cx={box.left + quizAnno.targetX * box.w}
                    cy={box.top + quizAnno.targetY * box.h}
                    r={16}
                  />
                </g>
              )}

              {editing && editTarget && box && (
                <text x={box.left + 8} y={box.top + 20} className="mri-edit-hint">
                  Click the image to place the arrow tip for slice {slice + 1}
                </text>
              )}
            </svg>
          )}

          {box &&
            shown.map((p) => (
              <button
                type="button"
                key={p.s.structureId}
                className={`mri-label mri-label-${p.side}${
                  emphasise(p.s.structureId) ? ' is-on' : ''
                }${p.s.confidence === 'moderate' ? ' is-moderate' : ''}`}
                style={{
                  top: box.top + p.y * box.h,
                  [p.side]: p.side === 'left' ? undefined : undefined,
                  ...(p.side === 'left'
                    ? { right: `calc(100% - ${box.left - 18}px)` }
                    : { left: box.left + box.w + 18 }),
                }}
                onMouseEnter={() => setHovered(p.s.structureId)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(p.s.structureId)}
                onBlur={() => setHovered(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(p.s.structureId === selected ? null : p.s.structureId);
                }}
              >
                {p.s.name}
                {p.s.confidence === 'moderate' && <span className="mri-conf" title="Moderate confidence">?</span>}
              </button>
            ))}

          <div className="mri-hud mri-hud-tl mono">
            <span>{level}</span>
            <span>
              SLICE {slice + 1} / {study.sliceCount} · {pct}%
            </span>
          </div>
          <div className="mri-hud mri-hud-tr mono">
            <span>{study.plane.toUpperCase()}</span>
            <span>{study.side ?? 'SIDE NOT CONFIRMED'}</span>
          </div>
        </div>

        <aside className="mri-side">
          {mode === 'quiz' ? (
            <div className="mri-quiz">
              <h2 className="mri-h">Quiz</h2>
              <div className="mri-row">
                <select
                  className="rpa-mri-select"
                  value={quizKind}
                  onChange={(e) => setQuizKind(e.target.value as 'typed' | 'choice')}
                >
                  <option value="typed">Typed</option>
                  <option value="choice">Multiple choice</option>
                </select>
                <select
                  className="rpa-mri-select"
                  value={quizFilter}
                  onChange={(e) => setQuizFilter(e.target.value as 'all' | StructureCategory)}
                >
                  <option value="all">All</option>
                  <option value="muscle">Muscles</option>
                  <option value="bone">Bones</option>
                  <option value="nerve">Nerves</option>
                  <option value="vessel">Vessels</option>
                  <option value="tendon">Tendons</option>
                </select>
              </div>
              <p className="mri-quiz-q">What is the marked structure?</p>

              {quizKind === 'typed' ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitQuiz(quizInput);
                  }}
                >
                  <input
                    className="mri-input"
                    value={quizInput}
                    onChange={(e) => setQuizInput(e.target.value)}
                    placeholder="Type the structure"
                    disabled={!!quizResult}
                  />
                  <button type="submit" className="btn btn-primary" disabled={!!quizResult}>
                    Check
                  </button>
                </form>
              ) : (
                <div className="mri-choices">
                  {choices.map((c) => (
                    <button
                      key={c.structureId}
                      type="button"
                      className="btn"
                      disabled={!!quizResult}
                      onClick={() => submitQuiz(c.name)}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}

              {quizResult && quizTarget && (
                <div className={quizResult === 'right' ? 'mri-verdict is-right' : 'mri-verdict is-wrong'}>
                  <strong>{quizResult === 'right' ? 'Correct' : 'Not quite'}</strong>
                  <p>{quizTarget.name}</p>
                  {quizTarget.recognition && <p className="mri-tip">{quizTarget.recognition}</p>}
                </div>
              )}

              <div className="mri-row">
                <button type="button" className="btn" onClick={() => setQuizResult('wrong')} disabled={!!quizResult}>
                  Show answer
                </button>
                <button type="button" className="btn btn-primary" onClick={nextQuestion}>
                  Next
                </button>
              </div>

              <dl className="mri-score mono">
                <div>
                  <dt>Score</dt>
                  <dd>
                    {score.right}/{score.total}
                  </dd>
                </div>
                <div>
                  <dt>Streak</dt>
                  <dd>{score.streak}</dd>
                </div>
                <div>
                  <dt>Best</dt>
                  <dd>{score.best}</dd>
                </div>
              </dl>
              {missed.length > 0 && (
                <div className="mri-missed">
                  <h3 className="mri-h">Review these</h3>
                  <ul>
                    {missed.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : editing ? (
            <div className="mri-editor">
              <h2 className="mri-h">Annotation editor</h2>
              <p className="rpa-mri-note">
                Pick a structure, then click the image to place its arrow tip on this slice.
                Everything is stored per slice; slices between two edited ones are interpolated.
              </p>
              <select
                className="rpa-mri-select mri-wide"
                value={editTarget ?? ''}
                onChange={(e) => setEditTarget(e.target.value || null)}
              >
                <option value="">Choose a structure…</option>
                {study.structures.map((s) => (
                  <option key={s.structureId} value={s.structureId}>
                    {s.name}
                  </option>
                ))}
              </select>

              {editTarget && (
                <>
                  {(() => {
                    const s = study.structures.find((x) => x.structureId === editTarget)!;
                    const here = s.annotations[String(slice)];
                    return (
                      <div className="mri-edit-fields">
                        <label className="mri-field">
                          <span>Name</span>
                          <input
                            className="mri-input"
                            value={s.name}
                            onChange={(e) => patchStructure(s.structureId, { name: e.target.value })}
                          />
                        </label>
                        <label className="mri-field">
                          <span>Category</span>
                          <select
                            className="rpa-mri-select"
                            value={s.category}
                            onChange={(e) =>
                              patchStructure(s.structureId, {
                                category: e.target.value as StructureCategory,
                              })
                            }
                          >
                            {Object.keys(CATEGORY_LABEL).map((c) => (
                              <option key={c} value={c}>
                                {CATEGORY_LABEL[c as StructureCategory]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="mri-row">
                          <label className="mri-field">
                            <span>First slice</span>
                            <input
                              className="mri-input"
                              type="number"
                              value={s.firstSlice}
                              onChange={(e) =>
                                patchStructure(s.structureId, { firstSlice: Number(e.target.value) })
                              }
                            />
                          </label>
                          <label className="mri-field">
                            <span>Last slice</span>
                            <input
                              className="mri-input"
                              type="number"
                              value={s.lastSlice}
                              onChange={(e) =>
                                patchStructure(s.structureId, { lastSlice: Number(e.target.value) })
                              }
                            />
                          </label>
                        </div>
                        <label className="mri-field">
                          <span>Confidence</span>
                          <select
                            className="rpa-mri-select"
                            value={s.confidence}
                            onChange={(e) =>
                              patchStructure(s.structureId, {
                                confidence: e.target.value as Structure['confidence'],
                              })
                            }
                          >
                            <option value="high">High</option>
                            <option value="moderate">Moderate</option>
                            <option value="low">Low (hidden until verified)</option>
                          </select>
                        </label>
                        <label className="mri-check">
                          <input
                            type="checkbox"
                            checked={s.verified}
                            onChange={(e) =>
                              patchStructure(s.structureId, { verified: e.target.checked })
                            }
                          />
                          <span>Verified by a radiologist</span>
                        </label>
                        <label className="mri-field">
                          <span>Teaching note</span>
                          <textarea
                            className="mri-input"
                            rows={3}
                            value={s.recognition ?? ''}
                            onChange={(e) =>
                              patchStructure(s.structureId, { recognition: e.target.value })
                            }
                          />
                        </label>
                        <p className="mono mri-coords">
                          {here
                            ? `slice ${slice + 1}: ${here.targetX.toFixed(3)}, ${here.targetY.toFixed(3)}`
                            : `slice ${slice + 1}: interpolated`}
                        </p>
                        <div className="mri-row">
                          <button type="button" className="btn" onClick={() => copyToAdjacent(s.structureId, -1)}>
                            Copy up
                          </button>
                          <button type="button" className="btn" onClick={() => copyToAdjacent(s.structureId, 1)}>
                            Copy down
                          </button>
                          <button
                            type="button"
                            className="btn"
                            onClick={() => deleteAnnotationHere(s.structureId)}
                          >
                            Clear slice
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

              <div className="mri-row mri-io">
                <button type="button" className="btn" onClick={exportJson}>
                  Export JSON
                </button>
                <label className="btn">
                  Import
                  <input
                    type="file"
                    accept="application/json"
                    hidden
                    onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])}
                  />
                </label>
                <button type="button" className="btn" onClick={resetAnnotations}>
                  Reset
                </button>
              </div>
            </div>
          ) : selectedStructure ? (
            <div className="mri-card">
              <button type="button" className="mri-close" onClick={() => setSelected(null)}>
                ×
              </button>
              <p className="mri-cat mono">
                {CATEGORY_LABEL[selectedStructure.category]}
                {selectedStructure.confidence !== 'high' && ' · moderate confidence'}
              </p>
              <h2>{selectedStructure.name}</h2>
              {selectedStructure.recognition && (
                <>
                  <h3 className="mri-h">How to spot it</h3>
                  <p>{selectedStructure.recognition}</p>
                </>
              )}
              <dl className="mri-facts">
                {selectedStructure.origin && (
                  <div>
                    <dt>Origin</dt>
                    <dd>{selectedStructure.origin}</dd>
                  </div>
                )}
                {selectedStructure.insertion && (
                  <div>
                    <dt>Insertion</dt>
                    <dd>{selectedStructure.insertion}</dd>
                  </div>
                )}
                {selectedStructure.innervation && (
                  <div>
                    <dt>Innervation</dt>
                    <dd>{selectedStructure.innervation}</dd>
                  </div>
                )}
                {selectedStructure.action && (
                  <div>
                    <dt>Action</dt>
                    <dd>{selectedStructure.action}</dd>
                  </div>
                )}
                <div>
                  <dt>Seen on</dt>
                  <dd className="mono">
                    slices {selectedStructure.firstSlice + 1}–{selectedStructure.lastSlice + 1}
                  </dd>
                </div>
              </dl>
              {selectedStructure.note && <p className="rpa-mri-note">{selectedStructure.note}</p>}
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setFollow(true);
                  setSelected(selectedStructure.structureId);
                }}
              >
                Follow through the stack
              </button>
            </div>
          ) : (
            <div className="rpa-mri-legend">
              <h2 className="mri-h">On this slice</h2>
              <p className="rpa-mri-note">{level}</p>
              <ul>
                {visible.map((s) => (
                  <li key={s.structureId}>
                    <button type="button" onClick={() => setSelected(s.structureId)}>
                      <span>{s.name}</span>
                      <span className="mono">{CATEGORY_LABEL[s.category]}</span>
                    </button>
                  </li>
                ))}
                {!visible.length && <li className="rpa-mri-note">No labels in this mode.</li>}
              </ul>
              <p className="mri-provenance">{study.provenance}</p>
            </div>
          )}
        </aside>
      </div>

      <div className="rpa-mri-scrub">
        <input
          type="range"
          min={0}
          max={study.sliceCount - 1}
          value={slice}
          onChange={(e) => setSlice(Number(e.target.value))}
          aria-label="Slice position"
        />
        <span className="mono">
          {slice + 1} / {study.sliceCount}
        </span>
      </div>
    </div>
  );
}
