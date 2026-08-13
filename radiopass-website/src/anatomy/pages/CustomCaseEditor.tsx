import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { AnswerSpec, ImagingModality, Question, SectionId } from '../types';
import type { MarkerColour } from '../components/ImageViewer';
import { getSectionMeta, getStaticSectionQuestions } from '../data/sections';
import { saveImageBlob, resolveCustomImageSrc } from '../lib/customStore';
import { getCustomQuestions, saveCustomQuestion, deleteCustomQuestion, nextCustomQuestionNumber } from '../lib/customQuestions';
import { invalidateAtlas } from '../lib/atlas';
import { defaultLabelPos } from '../components/ImageViewer';
import './CustomCaseEditor.css';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const MODALITIES: ImagingModality[] = ['Radiograph', 'CT', 'MRI', 'Ultrasound', 'Fluoroscopy', 'Angiogram', 'Other'];

interface DraftMarker {
  label: string;
  // Arrow tip: the exact point on the structure being pointed at.
  x: number;
  y: number;
  // Badge (tail) position. The arrow runs badge -> tip, so rotation and length
  // are stored implicitly as the badge's position relative to the tip. Keeping
  // the tip authoritative is deliberate: however the arrow is rotated or
  // resized, the thing it points AT never drifts off the anatomy.
  labelX: number;
  labelY: number;
  thickness: number;
  headSize: number;
  /** Badge diameter as a % of image width. Per marker, so a crowded film can
   * carry small badges and a single-structure film a large one. */
  sizePct: number;
  /** Pointer and badge colour. Four choices, each legible on some film that
   * defeats the others. */
  colour: MarkerColour;
  answer: string;
}

const DEFAULT_THICKNESS = 0.55;
const DEFAULT_HEAD = 5;
/** Deliberately smaller than the old fixed 6%: a badge is an annotation on a
 * radiograph, not a sticker over it. Adjustable per marker either way. */
const DEFAULT_SIZE = 3.4;
const DEFAULT_COLOUR: MarkerColour = 'white';

/** Kept in step with COLOURS in ImageViewer. */
const SWATCHES: { value: MarkerColour; label: string; css: string }[] = [
  { value: 'white', label: 'White', css: '#ffffff' },
  { value: 'black', label: 'Black', css: '#000000' },
  { value: 'yellow', label: 'Yellow', css: '#ffd23f' },
  { value: 'blue', label: 'Blue', css: '#4db2ff' },
];

/** Badge position expressed as an angle and a length away from the tip. */
function polarOf(m: DraftMarker) {
  const dx = m.labelX - m.x;
  const dy = m.labelY - m.y;
  return {
    length: Math.hypot(dx, dy),
    // Screen y grows downward; negate so 0 deg reads as "to the right" and the
    // dial turns anticlockwise the way a protractor does.
    angle: ((Math.atan2(-dy, dx) * 180) / Math.PI + 360) % 360,
  };
}

/** Rebuild the badge position from an angle and length about a fixed tip. */
function fromPolar(m: DraftMarker, angleDeg: number, length: number): DraftMarker {
  const r = (angleDeg * Math.PI) / 180;
  return {
    ...m,
    labelX: clampPct(m.x + Math.cos(r) * length),
    labelY: clampPct(m.y - Math.sin(r) * length),
  };
}

const clampPct = (v: number) => Math.max(1, Math.min(99, v));

export default function CustomCaseEditor() {
  const { sectionId } = useParams<{ sectionId: SectionId }>();
  const navigate = useNavigate();
  const section = sectionId as SectionId;
  const meta = getSectionMeta(section);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [markers, setMarkers] = useState<DraftMarker[]>([]);
  const [questionText, setQuestionText] = useState('Identify the structures labelled A–E.');
  const [questionTextTouched, setQuestionTextTouched] = useState(false);
  const [modality, setModality] = useState<ImagingModality>('Radiograph');
  const [regionTags, setRegionTags] = useState('');
  const [teachingText, setTeachingText] = useState('');
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  // Which handle is being dragged: the tip (the anatomy it points at) or the
  // badge (which sets rotation and length together).
  const dragRef = useRef<{ label: string; part: 'tip' | 'badge' } | null>(null);
  const imgWrapRef = useRef<HTMLDivElement>(null);

  const [existing, setExisting] = useState<Question[]>([]);
  const [existingPreviews, setExistingPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    setExisting(getCustomQuestions(section));
  }, [section]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries: Record<string, string> = {};
      for (const q of existing) {
        const src = await resolveCustomImageSrc(q.imagePath);
        if (src) entries[q.id] = src;
      }
      if (!cancelled) setExistingPreviews(entries);
    })();
    return () => {
      cancelled = true;
    };
  }, [existing]);

  useEffect(() => {
    if (!questionTextTouched) {
      const labels = markers.map((m) => m.label);
      if (labels.length === 0) setQuestionText('Identify the labelled structure(s).');
      else if (labels.length === 1) setQuestionText('Identify the structure labelled A.');
      else setQuestionText(`Identify the structures labelled ${labels[0]}–${labels[labels.length - 1]}.`);
    }
  }, [markers, questionTextTouched]);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setMarkers([]);
  }

  const onImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgWrapRef.current) return;
    const rect = imgWrapRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMarkers((prev) => {
      if (prev.length >= LETTERS.length) return prev;
      const label = LETTERS[prev.length];
      const tipX = Math.round(x * 10) / 10;
      const tipY = Math.round(y * 10) / 10;
      const { labelX, labelY } = defaultLabelPos(tipX, tipY);
      setSelected(label);
      return [
        ...prev,
        {
          label, x: tipX, y: tipY, labelX, labelY,
          thickness: DEFAULT_THICKNESS, headSize: DEFAULT_HEAD,
          sizePct: DEFAULT_SIZE, colour: DEFAULT_COLOUR, answer: '',
        },
      ];
    });
  }, []);

  function updateMarkerAnswer(label: string, answer: string) {
    setMarkers((prev) => prev.map((m) => (m.label === label ? { ...m, answer } : m)));
  }

  const patchMarker = useCallback((label: string, next: Partial<DraftMarker>) => {
    setMarkers((prev) => prev.map((m) => (m.label === label ? { ...m, ...next } : m)));
  }, []);

  /** Rotation and length are edited in polar terms about the fixed tip. */
  const setPolar = useCallback((label: string, angle: number, length: number) => {
    setMarkers((prev) => prev.map((m) => (m.label === label ? fromPolar(m, angle, length) : m)));
  }, []);

  const duplicateMarker = useCallback((label: string) => {
    setMarkers((prev) => {
      if (prev.length >= LETTERS.length) return prev;
      const src = prev.find((m) => m.label === label);
      if (!src) return prev;
      const next = LETTERS[prev.length];
      setSelected(next);
      return [...prev, { ...src, label: next, x: clampPct(src.x + 4), y: clampPct(src.y + 4), labelX: clampPct(src.labelX + 4), labelY: clampPct(src.labelY + 4), answer: '' }];
    });
  }, []);

  /* Pointer dragging. The image box is the coordinate space, so a drag is
     just the pointer position expressed as a percentage of that box — which
     keeps the arrow anchored to the anatomy at any zoom or window size. */
  const pointerPct = useCallback((e: { clientX: number; clientY: number }) => {
    const rect = imgWrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: clampPct(((e.clientX - rect.left) / rect.width) * 100),
      y: clampPct(((e.clientY - rect.top) / rect.height) * 100),
    };
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const pt = pointerPct(e);
      if (!pt) return;
      e.preventDefault();
      setMarkers((prev) =>
        prev.map((m) => {
          if (m.label !== drag.label) return m;
          if (drag.part === 'tip') {
            // Move the whole arrow: the badge follows so rotation and length
            // are preserved while the tip is repositioned.
            const dx = m.labelX - m.x;
            const dy = m.labelY - m.y;
            return { ...m, x: pt.x, y: pt.y, labelX: clampPct(pt.x + dx), labelY: clampPct(pt.y + dy) };
          }
          return { ...m, labelX: pt.x, labelY: pt.y };
        }),
      );
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [pointerPct]);

  /* Keyboard nudging, for the last bit of precision a pointer cannot give.
     Ignored while typing, so answer fields keep their normal arrow-key
     behaviour. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selected) return;
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      const step = e.shiftKey ? 1 : 0.2;
      const delta: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
      };
      if (delta[e.key]) {
        e.preventDefault();
        const [dx, dy] = delta[e.key];
        setMarkers((prev) =>
          prev.map((m) =>
            m.label === selected
              ? { ...m, x: clampPct(m.x + dx), y: clampPct(m.y + dy), labelX: clampPct(m.labelX + dx), labelY: clampPct(m.labelY + dy) }
              : m,
          ),
        );
      } else if (e.key === 'Escape') {
        setSelected(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  function removeMarker(label: string) {
    setMarkers((prev) => prev.filter((m) => m.label !== label).map((m, i) => ({ ...m, label: LETTERS[i] })));
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setMarkers([]);
    setQuestionText('Identify the structures labelled A–E.');
    setQuestionTextTouched(false);
    setModality('Radiograph');
    setRegionTags('');
    setTeachingText('');
  }

  async function handleSave() {
    if (!file || markers.length === 0) return;
    setSaving(true);
    try {
      const imageId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await saveImageBlob(imageId, file);

      const answers: Record<string, AnswerSpec> = {};
      const markerPositions: Record<string, { x: number; y: number }> = {};
      const markerLabelPositions: Record<string, { x: number; y: number }> = {};
      const markerArrows: Record<string, { thickness?: number; headSize?: number; sizePct?: number }> = {};
      const markerColours: Record<string, MarkerColour> = {};
      for (const m of markers) {
        answers[m.label] = {
          officialAnswer: m.answer.trim() || '(no answer given)',
          acceptedVariants: [],
          lateralityRequired: /\b(right|left)\b/i.test(m.answer),
        };
        markerPositions[m.label] = { x: m.x, y: m.y };
        markerLabelPositions[m.label] = { x: m.labelX, y: m.labelY };
        markerArrows[m.label] = { thickness: m.thickness, headSize: m.headSize, sizePct: m.sizePct };
        markerColours[m.label] = m.colour;
      }

      const staticCount = getStaticSectionQuestions(section).length;
      const question: Question = {
        id: `custom-${section}-${imageId}`,
        section,
        questionNumber: nextCustomQuestionNumber(section, staticCount),
        sourceFile: 'My Cases',
        sourcePageQuestion: 0,
        sourcePageAnswer: 0,
        caseLabel: null,
        modalitySection: 'My Cases',
        imagingModality: modality,
        projection: null,
        questionText: questionText.trim() || 'Identify the labelled structure(s).',
        labelStyle: 'letter',
        labels: markers.map((m) => m.label),
        answers,
        teachingText: teachingText.trim(),
        references: [],
        regionTags: regionTags.split(',').map((t) => t.trim()).filter(Boolean),
        structureTags: [],
        imagePath: `idb://${imageId}`,
        flagForReview: null,
        markerPositions,
        markerLabelPositions,
        markerArrows,
        markerColours,
        isCustom: true,
      };

      saveCustomQuestion(question);
      // The new case's structures belong in the Atlas straight away.
      invalidateAtlas();
      reset();
      setExisting(getCustomQuestions(section));
      navigate(`/anatomy/section/${section}/q/${question.id}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteCustomQuestion(id);
    setExisting(getCustomQuestions(section));
  }

  const canSave = !!file && markers.length > 0 && markers.every((m) => m.answer.trim().length > 0);

  /* A mistyped or stale URL is a normal thing to arrive with; it should read
     as a wrong turn, not a white screen. */
  if (!meta) {
    return (
      <div className="empty-state">
        <h1>Section not found</h1>
        <p>That address does not match any of the six anatomy modules.</p>
        <Link className="btn btn-primary" to="/anatomy">Back to the modules</Link>
      </div>
    );
  }
  return (
    <div className="cce-root">
      <Link to={`/anatomy/section/${section}`} className="back-link">← {meta.title}</Link>
      <h1>Add your own case — {meta.title}</h1>
      <p className="cce-sub">Upload an image, click anywhere on it to drop a marker, then give each marker its answer. It's graded and reviewed exactly like the rest of the section.</p>

      {!previewUrl ? (
        <label className="cce-upload card">
          <input type="file" accept="image/*" onChange={onFileChange} />
          <span>Click to choose an image</span>
        </label>
      ) : (
        <div className="cce-body">
          <div className="cce-image-pane card">
            <div
              className="cce-image-wrap"
              ref={imgWrapRef}
              onClick={onImageClick}
            >
              <img src={previewUrl} alt="Custom case upload" draggable={false} />
              {markers.length > 0 && (
                <svg className="cce-arrow-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    {[...new Set(markers.map((m) => m.headSize))].map((hs) => (
                      <marker
                        key={hs}
                        id={`cce-arrowhead-${String(hs).replace('.', '_')}`}
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth={hs}
                        markerHeight={hs}
                        orient="auto-start-reverse"
                        markerUnits="strokeWidth"
                      >
                        <path d="M 0 1 L 9 5 L 0 9 z" fill="#ffffff" />
                      </marker>
                    ))}
                  </defs>
                  {markers.map((m) => {
                    // Stop the line at the badge rim rather than under the letter.
                    const vx = m.x - m.labelX;
                    const vy = m.y - m.labelY;
                    const len = Math.hypot(vx, vy) || 1;
                    const gap = Math.min(3, len * 0.9);
                    return (
                      <line
                        key={m.label}
                        x1={m.labelX + (vx / len) * gap}
                        y1={m.labelY + (vy / len) * gap}
                        x2={m.x}
                        y2={m.y}
                        stroke={m.label === selected ? '#D9A84E' : (SWATCHES.find((s) => s.value === m.colour)?.css ?? '#ffffff')}
                        strokeWidth={m.thickness}
                        strokeLinecap="round"
                        markerEnd={`url(#cce-arrowhead-${String(m.headSize).replace('.', '_')})`}
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                </svg>
              )}
              {markers.map((m) => (
                <div
                  key={m.label}
                  className={m.label === selected ? 'cce-marker is-selected' : 'cce-marker'}
                  // Sized and coloured exactly as the saved case will render,
                  // so the editor is a preview rather than an approximation.
                  style={{
                    left: `${m.labelX}%`,
                    top: `${m.labelY}%`,
                    ['--cce-badge' as string]: `${m.sizePct}%`,
                    ['--cce-ink' as string]: SWATCHES.find((s) => s.value === m.colour)?.css ?? '#ffffff',
                    ['--cce-text' as string]: m.colour === 'black' ? '#f4f6f8' : '#14181d',
                    ['--cce-halo' as string]: m.colour === 'black' ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.9)',
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelected(m.label);
                    dragRef.current = { label: m.label, part: 'badge' };
                  }}
                  title="Drag to rotate and lengthen the arrow"
                >
                  <span className="cce-marker-glyph">{m.label}</span>
                </div>
              ))}
              {/* The tip handle: drags the whole arrow, keeping its angle and
                  length, so the thing it points at can be corrected without
                  rebuilding the arrow. */}
              {markers.map((m) => (
                <div
                  key={`tip-${m.label}`}
                  className={m.label === selected ? 'cce-tip is-selected' : 'cce-tip'}
                  style={{ left: `${m.x}%`, top: `${m.y}%` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelected(m.label);
                    dragRef.current = { label: m.label, part: 'tip' };
                  }}
                  title="Drag to move the arrow, keeping its angle and length"
                />
              ))}
            </div>
            <p className="cce-hint">
              {markers.length === 0
                ? 'Click anywhere on the image to place your first arrow.'
                : `${markers.length} arrow${markers.length > 1 ? 's' : ''} placed. Click the image to add another (up to ${LETTERS.length}); drag the tip to move it, drag the letter to rotate and lengthen it, or nudge with the arrow keys.`}
            </p>
            <button type="button" className="btn" onClick={reset}>Choose a different image</button>
          </div>

          <div className="cce-form-pane">
            <label className="cce-field">
              Question text
              <input
                type="text"
                value={questionText}
                onChange={(e) => { setQuestionText(e.target.value); setQuestionTextTouched(true); }}
              />
            </label>

            <label className="cce-field">
              Modality
              <select value={modality} onChange={(e) => setModality(e.target.value as ImagingModality)}>
                {MODALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>

            <label className="cce-field">
              Region / organ tags (comma separated, optional)
              <input type="text" value={regionTags} onChange={(e) => setRegionTags(e.target.value)} placeholder="e.g. Orbit, Sinus" />
            </label>

            <div className="cce-markers-list">
              {markers.length === 0 && <p className="cce-empty">No markers yet — click the image.</p>}
              {markers.map((m) => (
                <div
                  key={m.label}
                  className={m.label === selected ? 'cce-marker-row is-selected' : 'cce-marker-row'}
                  onFocus={() => setSelected(m.label)}
                >
                  <span className="cce-marker-label">{m.label}</span>
                  <input
                    type="text"
                    value={m.answer}
                    placeholder="Official answer for this arrow"
                    onChange={(e) => updateMarkerAnswer(m.label, e.target.value)}
                  />
                  <button type="button" className="cce-remove" onClick={() => removeMarker(m.label)} title="Remove arrow">✕</button>

                  {/* The arrow's own geometry. Rotation and length are edited
                      about the tip, so adjusting either never moves the point
                      the arrow is identifying. */}
                  {m.label === selected && (() => {
                    const { angle, length } = polarOf(m);
                    return (
                      <div className="cce-arrow-controls">
                        <label>
                          Rotation
                          <input
                            type="range" min={0} max={359} step={1} value={Math.round(angle)}
                            onChange={(e) => setPolar(m.label, Number(e.target.value), length)}
                          />
                          <b>{Math.round(angle)}°</b>
                        </label>
                        <label>
                          Length
                          <input
                            type="range" min={3} max={45} step={0.5} value={Number(length.toFixed(1))}
                            onChange={(e) => setPolar(m.label, angle, Number(e.target.value))}
                          />
                          <b>{length.toFixed(1)}</b>
                        </label>
                        <label>
                          Thickness
                          <input
                            type="range" min={0.2} max={2.4} step={0.05} value={m.thickness}
                            onChange={(e) => patchMarker(m.label, { thickness: Number(e.target.value) })}
                          />
                          <b>{m.thickness.toFixed(2)}</b>
                        </label>
                        <label>
                          Arrowhead
                          <input
                            type="range" min={2} max={12} step={0.5} value={m.headSize}
                            onChange={(e) => patchMarker(m.label, { headSize: Number(e.target.value) })}
                          />
                          <b>{m.headSize}</b>
                        </label>
                        <label>
                          Letter size
                          <input
                            type="range" min={1.6} max={9} step={0.1} value={m.sizePct}
                            onChange={(e) => patchMarker(m.label, { sizePct: Number(e.target.value) })}
                          />
                          <b>{m.sizePct.toFixed(1)}%</b>
                        </label>
                        <div className="cce-colour-row">
                          <span className="cce-colour-label">Colour</span>
                          <div className="cce-swatches" role="group" aria-label={`Colour for marker ${m.label}`}>
                            {SWATCHES.map((s) => (
                              <button
                                key={s.value}
                                type="button"
                                className={m.colour === s.value ? 'cce-swatch is-on' : 'cce-swatch'}
                                style={{ background: s.css }}
                                aria-label={s.label}
                                aria-pressed={m.colour === s.value}
                                title={s.label}
                                onClick={() => patchMarker(m.label, { colour: s.value })}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="cce-arrow-actions">
                          <button type="button" className="btn" onClick={() => duplicateMarker(m.label)}>Duplicate</button>
                          <span className="cce-arrow-hint">Drag the tip to move · drag the letter to aim · arrow keys nudge (Shift = bigger)</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>

            <label className="cce-field">
              Teaching point (optional)
              <textarea rows={3} value={teachingText} onChange={(e) => setTeachingText(e.target.value)} placeholder="Any explanation to show after the learner submits" />
            </label>

            <button type="button" className="btn btn-primary" disabled={!canSave || saving} onClick={handleSave}>
              {saving ? 'Saving…' : 'Save case'}
            </button>
          </div>
        </div>
      )}

      {existing.length > 0 && (
        <div className="cce-existing">
          <h2>Your cases in {meta.title} ({existing.length})</h2>
          <div className="cce-existing-grid">
            {existing.map((q) => (
              <div key={q.id} className="cce-existing-card card">
                {existingPreviews[q.id] && <img src={existingPreviews[q.id]} alt={q.questionText} />}
                <p>{q.questionText}</p>
                <div className="cce-existing-actions">
                  <Link to={`/anatomy/section/${section}/q/${q.id}`} className="btn">Open</Link>
                  <button type="button" className="btn cce-delete" onClick={() => handleDelete(q.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
