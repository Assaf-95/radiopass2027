import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CXR_STRUCTURES,
  CXR_CATEGORIES,
  type CxrCategory,
  type CxrStructure,
} from '../data/cxr/chestStructures';
import {
  RADIOGRAPHS,
  NOT_DEMONSTRATED,
  type Placement,
  type Radiograph,
} from '../data/cxr/radiographs';
import { assetUrl } from '../lib/assetUrl';
import AnnotationOverlay, { layoutLabels, type Box, type Placed } from '../components/cxr/AnnotationOverlay';
import { getQuiz, recordQuizAnswer } from '../lib/account';
import './ChestXrayAtlas.css';
import { isAdmin } from '../lib/admin';

type LabelMode = 'clean' | 'major' | 'all';
type QuizKind = 'name' | 'locate';
type QuizScope = 'both' | 'radiograph-1' | 'radiograph-2';

const RAIL_GAP = 12;
const EDIT_KEY = 'radiopass-cxr-annotations-v1';

function normalise(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\b(the|of|position|region|tip|border|right|left)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function editDistance(a: string, b: string) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return dp[b.length];
}

/** Accepts synonyms and small spelling slips, never a neighbouring structure.
    Laterality is stripped from the comparison only because it is already in
    the printed answer; "left main bronchus" and "right main bronchus" remain
    distinct because the quiz compares against one specific structure. */
function answerMatches(given: string, s: CxrStructure) {
  const g = normalise(given);
  if (!g) return false;
  const targets = [s.name, s.shortName, ...(s.synonyms ?? [])].map(normalise);
  return targets.some((t) => {
    if (!t) return false;
    const tol = t.length > 14 ? 2 : t.length > 7 ? 1 : 0;
    return t === g || editDistance(t, g) <= tol;
  });
}

/* Laterality must survive normalisation for the paired structures, or naming
   the left main bronchus would score the right. */
function lateralityOk(given: string, s: CxrStructure) {
  const g = given.toLowerCase();
  const wantsLeft = /\bleft\b|\bl\b/.test(s.name.toLowerCase());
  const wantsRight = /\bright\b|\br\b/.test(s.name.toLowerCase());
  if (!wantsLeft && !wantsRight) return true;
  const saysLeft = /\bleft\b/.test(g);
  const saysRight = /\bright\b/.test(g);
  if (!saysLeft && !saysRight) return true; // side omitted: allowed
  return wantsLeft ? !saysRight : !saysLeft;
}

export default function ChestXrayAtlas() {
  const [params, setParams] = useSearchParams();
  /* Gated on the author, not on the URL: the query parameter alone let a
     candidate into the annotation editor on the live site. */
  const editMode = params.get('editAnnotations') === 'true' && isAdmin();

  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<LabelMode>('major');
  const [active, setActive] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [pulse, setPulse] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<CxrCategory | 'all'>('all');
  const [quiz, setQuiz] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [box, setBox] = useState<Box | null>(null);

  /* Editor overrides, kept out of the shipped data until exported. */
  const [overrides, setOverrides] = useState<Record<string, Record<number, Placement | null>>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(EDIT_KEY);
      if (raw) setOverrides(JSON.parse(raw));
    } catch {
      /* a corrupt local copy must not stop the atlas loading */
    }
  }, []);

  const film: Radiograph = RADIOGRAPHS[index];

  const placementFor = useCallback(
    (id: number): Placement | null => {
      const o = overrides[film.id];
      if (o && Object.prototype.hasOwnProperty.call(o, id)) return o[id];
      return film.placements[id] ?? null;
    },
    [overrides, film]
  );

  const measure = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const stage = stageRef.current;
    if (!canvas || !img || !stage || !img.naturalWidth) return;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (!cw || !ch) return;
    // object-fit: contain — the annotation layer must use the same box or the
    // arrows drift as soon as the aspect ratios differ.
    const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    const c = canvas.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    setBox({ left: c.left - s.left + (cw - w) / 2, top: c.top - s.top + (ch - h) / 2, w, h });
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
  }, [measure, index]);

  const go = useCallback(
    (d: number) => {
      setIndex((i) => Math.min(RADIOGRAPHS.length - 1, Math.max(0, i + d)));
      setActive(null);
    },
    []
  );

  /* Wheel over the film moves between radiographs and does not scroll the
     page; everywhere else the page scrolls normally. */
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    let acc = 0;
    let lock = false;
    function onWheel(e: WheelEvent) {
      if (e.ctrlKey) return;
      e.preventDefault();
      if (lock) return;
      acc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(acc) > 90) {
        go(acc > 0 ? 1 : -1);
        acc = 0;
        lock = true;
        window.setTimeout(() => {
          lock = false;
        }, 320);
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [go]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'Escape') setActive(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  /* Touch swipe. */
  const touch = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const s = touch.current;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(t.clientY - s.y)) go(dx < 0 ? 1 : -1);
    touch.current = null;
  }

  const visible = useMemo(() => {
    if (mode === 'clean' && !quiz) return [];
    const wanted = CXR_STRUCTURES.filter((s) => {
      if (cat !== 'all' && s.category !== cat) return false;
      if (mode === 'major' && !s.major) return false;
      return true;
    });
    const items: { s: CxrStructure; p: Placement }[] = [];
    for (const s of wanted) {
      const p = placementFor(s.id);
      if (p) items.push({ s, p });
    }
    return items;
  }, [mode, cat, placementFor, quiz]);

  /* When a structure is picked it must be drawn even if its mode filters it
     out, otherwise clicking a list entry appears to do nothing. */
  const placed: Placed[] = useMemo(() => {
    const items = [...visible];
    if (active != null && !items.some((i) => i.s.id === active)) {
      const s = CXR_STRUCTURES.find((x) => x.id === active);
      const p = s && placementFor(s.id);
      if (s && p) items.push({ s, p });
    }
    return layoutLabels(items);
  }, [visible, active, placementFor]);

  const matches = useMemo(() => {
    const q = normalise(query);
    const base = CXR_STRUCTURES.filter((s) => cat === 'all' || s.category === cat);
    if (!q) return base;
    return base.filter((s) =>
      [s.name, s.shortName, ...(s.synonyms ?? [])].some((n) => normalise(n).includes(q))
    );
  }, [query, cat]);

  const pick = useCallback(
    (id: number) => {
      const here = placementFor(id);
      if (!here) {
        // Move to a film that actually demonstrates it, if there is one.
        const other = RADIOGRAPHS.findIndex((r) => r.placements[id]);
        if (other >= 0 && other !== index) {
          setIndex(other);
          setActive(id);
          setPulse(id);
          window.setTimeout(() => setPulse(null), 1200);
          return;
        }
      }
      setActive(id);
      setPulse(id);
      window.setTimeout(() => setPulse(null), 1200);
      const el = listRef.current?.querySelector(`[data-sid="${id}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    },
    [placementFor, index]
  );

  const activeStructure = active != null ? CXR_STRUCTURES.find((s) => s.id === active) ?? null : null;
  const activePlacement = active != null ? placementFor(active) : null;
  const missingReason = active != null ? NOT_DEMONSTRATED[film.id]?.[active] : undefined;

  /* --- Quiz -------------------------------------------------------------- */
  const [quizKind, setQuizKind] = useState<QuizKind>('name');
  const [scope, setScope] = useState<QuizScope>('both');
  const [target, setTarget] = useState<{ id: number; film: number } | null>(null);
  const [answer, setAnswer] = useState('');
  const [verdict, setVerdict] = useState<'right' | 'wrong' | null>(null);
  // Seeded from the stored record, so the score is the same on the way back.
  const [score, setScore] = useState(() => {
    const q = getQuiz('cxr');
    return { right: q.correct, total: q.attempts };
  });
  const [streak, setStreak] = useState(0);
  const [missed, setMissed] = useState<number[]>([]);
  const [retryOnly, setRetryOnly] = useState(false);

  const pool = useMemo(() => {
    const out: { id: number; film: number }[] = [];
    RADIOGRAPHS.forEach((r, fi) => {
      if (scope !== 'both' && scope !== r.id) return;
      for (const s of CXR_STRUCTURES) {
        if (retryOnly && !missed.includes(s.id)) continue;
        if (r.placements[s.id]) out.push({ id: s.id, film: fi });
      }
    });
    return out;
  }, [scope, retryOnly, missed]);

  const nextQuestion = useCallback(() => {
    if (!pool.length) return;
    const q = pool[Math.floor(Math.random() * pool.length)];
    setIndex(q.film);
    setTarget(q);
    setAnswer('');
    setVerdict(null);
    setActive(null);
  }, [pool]);

  useEffect(() => {
    if (quiz && !target) nextQuestion();
    if (!quiz) {
      setTarget(null);
      setVerdict(null);
    }
  }, [quiz, target, nextQuestion]);

  function submit(given: string) {
    if (!target || verdict) return;
    const s = CXR_STRUCTURES.find((x) => x.id === target.id)!;
    const ok = answerMatches(given, s) && lateralityOk(given, s);
    setVerdict(ok ? 'right' : 'wrong');
    const nextStreak = ok ? streak + 1 : 0;
    setStreak(nextStreak);
    setScore((v) => ({ right: v.right + (ok ? 1 : 0), total: v.total + 1 }));
    recordQuizAnswer('cxr', ok, s.name, nextStreak);
    if (!ok) setMissed((m) => (m.includes(s.id) ? m : [...m, s.id]));
  }

  function clickLocate(e: React.MouseEvent) {
    if (!quiz || quizKind !== 'locate' || !target || verdict || !box || !stageRef.current) return;
    const r = stageRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left - box.left) / box.w;
    const y = (e.clientY - r.top - box.top) / box.h;
    const p = placementFor(target.id);
    if (!p) return;
    const dist = Math.hypot(x - p.targetX, y - p.targetY);
    const ok = dist < 0.06;
    setVerdict(ok ? 'right' : 'wrong');
    const nextStreak = ok ? streak + 1 : 0;
    setStreak(nextStreak);
    setScore((v) => ({ right: v.right + (ok ? 1 : 0), total: v.total + 1 }));
    recordQuizAnswer('cxr', ok, CXR_STRUCTURES.find((x) => x.id === target.id)?.name, nextStreak);
    if (!ok) setMissed((m) => (m.includes(target.id) ? m : [...m, target.id]));
  }

  /* --- Editor ------------------------------------------------------------ */
  const [editId, setEditId] = useState<number | null>(null);
  const [dragging, setDragging] = useState<'tip' | 'label' | null>(null);

  const saveOverride = useCallback(
    (filmId: string, id: number, p: Placement | null) => {
      setOverrides((prev) => {
        const next = { ...prev, [filmId]: { ...(prev[filmId] ?? {}), [id]: p } };
        try {
          localStorage.setItem(EDIT_KEY, JSON.stringify(next));
        } catch {
          /* private browsing */
        }
        return next;
      });
    },
    []
  );

  function stagePoint(e: React.MouseEvent) {
    if (!box || !stageRef.current) return null;
    const r = stageRef.current.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left - box.left) / box.w)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top - box.top) / box.h)),
    };
  }

  function onStageClick(e: React.MouseEvent) {
    if (quiz && quizKind === 'locate') return clickLocate(e);
    if (editMode && editId != null && dragging) {
      const pt = stagePoint(e);
      const cur = placementFor(editId);
      if (pt && cur) {
        saveOverride(
          film.id,
          editId,
          dragging === 'tip'
            ? { ...cur, targetX: +pt.x.toFixed(4), targetY: +pt.y.toFixed(4) }
            : { ...cur, labelY: +pt.y.toFixed(4), labelSide: pt.x < 0.5 ? 'left' : 'right' }
        );
      }
      setDragging(null);
      return;
    }
    setActive(null);
  }

  function exportJson() {
    const payload = RADIOGRAPHS.map((r) => ({
      id: r.id,
      placements: Object.fromEntries(
        CXR_STRUCTURES.map((s) => {
          const o = overrides[r.id];
          const p = o && Object.prototype.hasOwnProperty.call(o, s.id) ? o[s.id] : r.placements[s.id] ?? null;
          return [s.id, p];
        })
      ),
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cxr-annotations.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importJson(file: File) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const arr = JSON.parse(String(r.result)) as { id: string; placements: Record<number, Placement | null> }[];
        const next: Record<string, Record<number, Placement | null>> = {};
        for (const f of arr) next[f.id] = f.placements;
        setOverrides(next);
        localStorage.setItem(EDIT_KEY, JSON.stringify(next));
      } catch {
        window.alert('That file is not valid annotation JSON.');
      }
    };
    r.readAsText(file);
  }

  const editPlacement = editId != null ? placementFor(editId) : null;

  return (
    <div className="cxr">
      <header className="cxr-top">
        <Link to="/" className="back-link">
          ← RadioPass
        </Link>
        <div className="cxr-ident">
          <span className="cxr-title">Chest radiograph anatomy</span>
          <span className="cxr-sub mono">
            {film.label} of {RADIOGRAPHS.length} · {film.projection}
          </span>
        </div>

        <div className="cxr-tools">
          <div className="cxr-seg" role="group" aria-label="Label mode">
            {(['clean', 'major', 'all'] as LabelMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={mode === m && !quiz ? 'is-on' : ''}
                onClick={() => {
                  setMode(m);
                  setQuiz(false);
                }}
              >
                {m === 'clean' ? 'Clean' : m === 'major' ? 'Major' : 'All'}
              </button>
            ))}
            <button type="button" className={quiz ? 'is-on' : ''} onClick={() => setQuiz((q) => !q)}>
              Quiz
            </button>
          </div>
          <button type="button" className="btn" onClick={() => setActive(null)}>
            Reset view
          </button>
          {/* The annotation editor stays reachable by URL in any build, but
              the button is authoring furniture: a learner who clicks "Edit"
              on the live site lands in a tool meant for building the atlas,
              not for revising from it. */}
          {!editMode && isAdmin() && (
            <button
              type="button"
              className="btn"
              onClick={() => setParams({ editAnnotations: 'true' }, { replace: true })}
              title="Development annotation editor"
            >
              Edit
            </button>
          )}
        </div>
      </header>

      <div className="cxr-body">
        <div
          className="cxr-stage"
          ref={stageRef}
          onClick={onStageClick}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="cxr-canvas" ref={canvasRef}>
            <img
              ref={imgRef}
              className="cxr-image"
              src={assetUrl(film.file)}
              alt={`${film.label} — ${film.projection}. ${film.sideMarker}`}
              onLoad={measure}
              draggable={false}
            />
          </div>

          {box && (
            <AnnotationOverlay
              box={box}
              placed={placed}
              activeId={active}
              hoverId={hover}
              pulseId={pulse}
              quizOnly={quiz && target ? target.id : null}
              onPick={pick}
              onHover={setHover}
              railGap={RAIL_GAP}
            />
          )}

          <div className="cxr-hud cxr-hud-l mono">
            <span>{film.label}</span>
            <span>{film.projection}</span>
          </div>
          <div className="cxr-hud cxr-hud-r mono">
            <span>PATIENT RIGHT = VIEWER LEFT</span>
          </div>

          <div className="cxr-pager">
            <button type="button" className="btn" onClick={() => go(-1)} disabled={index === 0}>
              ← Previous
            </button>
            <div className="cxr-dots">
              {RADIOGRAPHS.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  className={i === index ? 'is-on' : ''}
                  aria-label={`Show ${r.label}`}
                  aria-current={i === index}
                  onClick={() => {
                    setIndex(i);
                    setActive(null);
                  }}
                >
                  <img src={assetUrl(r.file)} alt="" />
                  <span className="mono">{i + 1}</span>
                </button>
              ))}
            </div>
            <span className="cxr-count mono">
              Radiograph {index + 1} of {RADIOGRAPHS.length}
            </span>
            <button
              type="button"
              className="btn"
              onClick={() => go(1)}
              disabled={index === RADIOGRAPHS.length - 1}
            >
              Next →
            </button>
          </div>
        </div>

        <aside className="cxr-side">
          {quiz ? (
            <div className="cxr-panel">
              <h2 className="cxr-h">Quiz</h2>
              <div className="cxr-row">
                <select
                  className="cxr-input"
                  value={quizKind}
                  onChange={(e) => setQuizKind(e.target.value as QuizKind)}
                >
                  <option value="name">Arrow → name it</option>
                  <option value="locate">Name → click it</option>
                </select>
                <select
                  className="cxr-input"
                  value={scope}
                  onChange={(e) => setScope(e.target.value as QuizScope)}
                >
                  <option value="both">Both films</option>
                  <option value="radiograph-1">Radiograph 1</option>
                  <option value="radiograph-2">Radiograph 2</option>
                </select>
              </div>

              {target && quizKind === 'name' && (
                <>
                  <p className="cxr-q">What is arrowed?</p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      submit(answer);
                    }}
                  >
                    <input
                      className="cxr-input cxr-wide"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Name the structure"
                      disabled={!!verdict}
                    />
                    <button type="submit" className="btn btn-primary" disabled={!!verdict}>
                      Check
                    </button>
                  </form>
                </>
              )}

              {target && quizKind === 'locate' && (
                <p className="cxr-q">
                  Click on: <strong>{CXR_STRUCTURES.find((s) => s.id === target.id)?.name}</strong>
                </p>
              )}

              {verdict && target && (
                <div className={verdict === 'right' ? 'cxr-verdict is-right' : 'cxr-verdict is-wrong'}>
                  <strong>{verdict === 'right' ? 'Correct' : 'Not quite'}</strong>
                  <p>{CXR_STRUCTURES.find((s) => s.id === target.id)?.name}</p>
                  <p className="cxr-note">{CXR_STRUCTURES.find((s) => s.id === target.id)?.note}</p>
                </div>
              )}

              <div className="cxr-row">
                <button type="button" className="btn" onClick={() => setVerdict('wrong')} disabled={!!verdict}>
                  Show answer
                </button>
                <button type="button" className="btn btn-primary" onClick={nextQuestion}>
                  Next
                </button>
              </div>
              <p className="mono cxr-score">
                Score {score.right}/{score.total}
              </p>
              {missed.length > 0 && (
                <label className="cxr-check">
                  <input
                    type="checkbox"
                    checked={retryOnly}
                    onChange={(e) => {
                      setRetryOnly(e.target.checked);
                      setTarget(null);
                    }}
                  />
                  <span>Retry missed only ({missed.length})</span>
                </label>
              )}
            </div>
          ) : editMode ? (
            <div className="cxr-panel">
              <h2 className="cxr-h">Annotation editor</h2>
              <p className="cxr-note">
                Development only. Pick a structure, choose what to move, then click the film.
              </p>
              <select
                className="cxr-input cxr-wide"
                value={editId ?? ''}
                onChange={(e) => setEditId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Choose a structure…</option>
                {CXR_STRUCTURES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id}. {s.name}
                  </option>
                ))}
              </select>
              {editId != null && (
                <>
                  <div className="cxr-row">
                    <button
                      type="button"
                      className={dragging === 'tip' ? 'btn btn-primary' : 'btn'}
                      onClick={() => setDragging('tip')}
                    >
                      Set arrow tip
                    </button>
                    <button
                      type="button"
                      className={dragging === 'label' ? 'btn btn-primary' : 'btn'}
                      onClick={() => setDragging('label')}
                    >
                      Set label
                    </button>
                  </div>
                  <p className="mono cxr-coords">
                    {editPlacement
                      ? `x ${editPlacement.targetX.toFixed(3)}  y ${editPlacement.targetY.toFixed(3)}  rail ${editPlacement.labelSide}`
                      : 'hidden on this radiograph'}
                  </p>
                  <div className="cxr-row">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => saveOverride(film.id, editId, null)}
                    >
                      Hide here
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() =>
                        saveOverride(film.id, editId, film.placements[editId] ?? null)
                      }
                    >
                      Reset
                    </button>
                    {editPlacement && (
                      <button
                        type="button"
                        className="btn"
                        onClick={() =>
                          saveOverride(film.id, editId, { ...editPlacement, verified: !editPlacement.verified })
                        }
                      >
                        {editPlacement.verified ? 'Verified ✓' : 'Mark verified'}
                      </button>
                    )}
                  </div>
                </>
              )}
              <div className="cxr-row cxr-io">
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
                <button
                  type="button"
                  className="btn"
                  onClick={() => setParams({}, { replace: true })}
                >
                  Leave editor
                </button>
              </div>
            </div>
          ) : activeStructure ? (
            <div className="cxr-panel">
              <button type="button" className="cxr-close" onClick={() => setActive(null)}>
                ×
              </button>
              <p className="cxr-cat mono">
                {CXR_CATEGORIES.find((c) => c.id === activeStructure.category)?.label}
              </p>
              <h2 className="cxr-name">{activeStructure.name}</h2>
              {!activePlacement && (
                <p className="cxr-missing">
                  Not demonstrated on this radiograph.
                  {missingReason ? ` ${missingReason}` : ''}
                </p>
              )}
              {activePlacement?.uncertain && (
                <p className="cxr-uncertain">
                  Edge inferred rather than sharply profiled on this film.
                </p>
              )}
              <p className="cxr-note">{activeStructure.note}</p>
              <p className="mono cxr-avail">
                {RADIOGRAPHS.map((r) => `${r.label}: ${r.placements[activeStructure.id] ? 'shown' : '—'}`).join(
                  '   '
                )}
              </p>
            </div>
          ) : (
            <div className="cxr-panel">
              <h2 className="cxr-h">This radiograph</h2>
              <p className="cxr-note">{film.notes}</p>
              <p className="mono cxr-avail">{film.sideMarker}</p>
            </div>
          )}

          <div className="cxr-finder">
            <input
              className="cxr-input cxr-wide"
              type="search"
              placeholder="Search structures"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="cxr-input cxr-wide"
              value={cat}
              onChange={(e) => setCat(e.target.value as CxrCategory | 'all')}
            >
              <option value="all">All categories</option>
              {CXR_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <ul className="cxr-list" ref={listRef}>
              {matches.map((s) => {
                const here = !!placementFor(s.id);
                return (
                  <li key={s.id} data-sid={s.id}>
                    <button
                      type="button"
                      className={[active === s.id ? 'is-on' : '', here ? '' : 'is-absent']
                        .filter(Boolean)
                        .join(' ')}
                      onMouseEnter={() => setHover(s.id)}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => pick(s.id)}
                    >
                      <span className="cxr-num mono">{s.id}</span>
                      <span className="cxr-lname">{s.name}</span>
                      {!here && <span className="cxr-absent mono">n/a</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
