/* Replace the image on an existing question, keeping everything else.

   The operation this page exists for is content maintenance: the film is
   wrong or cannot be used, but the teaching — the structures named, their
   accepted variants, the teaching text — is still good and must survive
   untouched. So the image is the only thing this page changes by default.
   Answer text is rendered read-only; the only answer operation offered is
   removal, and nothing here rewrites wording.

   Nothing is committed until Save. The original question is never mutated:
   the result is stored as an override that can be reverted. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getSectionQuestions, getSectionMeta, getStaticSectionQuestions } from '../data/sections';
import ImageViewer, { defaultLabelPos, DEFAULT_THICKNESS_PCT } from '../components/ImageViewer';
import { assetUrl } from '../lib/assetUrl';
import { isCustomImageRef, resolveCustomImageSrc } from '../lib/customStore';
import {
  applyEdit, auditAnnotations, clearEdit, getEdit, reletter, saveEdit,
  toEditableAnswers, type EditableAnswer, type QuestionEdit,
} from '../lib/questionEdits';
import { NO_ORIENTATION, isOriented, remapMarker, type ImageOrientation, type SectionId } from '../types';
import { hasServerSession } from '../lib/admin';
import { patchQuestion, uploadAsset } from '../lib/content/api';
import { contentState, loadContent, overlayFor, setOverlay } from '../lib/content/store';
import './ReplaceImageEditor.css';

/* A data URL back into bytes, so the picture the editor is already previewing
   is the picture that gets uploaded. The alternative — holding the original
   File around — breaks the moment an edit is reopened from a saved draft. */
async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], name, { type: blob.type || 'image/png' });
}

type Confirm = { message: string; onYes: () => void } | null;

/* Default diameters, as a percentage of the film's width. Both the ring and
   the dot are sized by `circlePct`, so the size dial drives whichever of the
   two the label is currently using. */
const RING_PCT = 9;
const DOT_PCT = 2.5;
/** Shapes whose size dial sets a diameter rather than a pointer length. */
const ROUND_SHAPES = new Set(['circle', 'point']);

/* Stroke weight and head size, in pixels of the rendered film. The head is
   held to a fraction of the shaft's own length — a heavy stroke on a short
   pointer otherwise grows a head longer than the arrow carrying it. Kept in
   step with headUnits() in ImageViewer so the stage and the candidate's view
   draw the same arrow. */
function headVars(a: EditableAnswer, plateW: number): Record<string, string> {
  const thick = Math.max(1, ((a.thicknessPct ?? DEFAULT_THICKNESS_PCT) / 100) * plateW);
  const shaft = ((a.lengthPct ?? 12) / 100) * plateW;
  const head = Math.max(2 * thick, Math.min(thick * 4.2, shaft * 0.4));
  return { '--thick': `${thick}px`, '--head': `${head}px` };
}

/* Question images are stored root-absolute ("/images/…") and the build is
   published with a relative base, so a raw path only happens to work at a
   domain root; a custom case's "idb://…" reference never resolves on its own
   at all. QuestionPlayer has always gone through this; the editor did not, so
   the film it exists to replace could come up blank on the deployed site. */
function useResolvedSrc(path: string | undefined): string {
  const [src, setSrc] = useState('');
  useEffect(() => {
    if (!path) {
      setSrc('');
      return;
    }
    if (!isCustomImageRef(path)) {
      setSrc(assetUrl(path));
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    resolveCustomImageSrc(path).then((u) => {
      if (cancelled) return;
      objectUrl = u;
      setSrc(u ?? '');
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);
  return src;
}

/* The pointer styles. Different structures want different pointers: an arrow
   aims at a thing, a ring encloses a region no single point describes, a bare
   dot marks a spot without covering it, a plain line indicates without the
   weight of a head. */
const SHAPES: { id: 'arrow' | 'point' | 'line' | 'circle' | 'arrow-point'; glyph: string; title: string }[] = [
  { id: 'arrow',       glyph: '\u2192', title: 'Arrow' },
  { id: 'point',       glyph: '\u25CF', title: 'Point' },
  { id: 'line',        glyph: '\u2015', title: 'Line (no head)' },
  { id: 'circle',      glyph: '\u25CB', title: 'Circle (open ring)' },
  { id: 'arrow-point', glyph: '\u21A6', title: 'Arrow + point' },
];

/* Every piece of the editor's state — the answers, the stem, the crop — is
   seeded from the question at mount time. Moving between two questions without
   leaving this route would keep the same instance alive and carry one film's
   labels onto another's, so the key forces a fresh mount per question. */
export default function ReplaceImageEditor() {
  const { questionId } = useParams<{ questionId: string }>();
  return <Editor key={questionId ?? 'none'} />;
}

function Editor() {
  const { sectionId, questionId } = useParams<{ sectionId: SectionId; questionId: string }>();
  const navigate = useNavigate();
  const section = sectionId as SectionId;
  const meta = getSectionMeta(section);
  const questions = useMemo(() => getSectionQuestions(section), [section]);
  const original = questions.find((q) => q.id === questionId);
  const displayNumber = questions.findIndex((q) => q.id === questionId) + 1;

  /* getSectionQuestions() already layers any saved override, so `original` is
     the question as it currently stands — which is what should be edited, but
     NOT what "the old image" means. Re-opening the page after a replacement
     otherwise showed the new film in both panes and called one of them old. */
  const shipped = useMemo(
    () => getStaticSectionQuestions(section).find((q) => q.id === questionId),
    [section, questionId]
  );

  const saved = questionId ? getEdit(questionId) : null;

  /* How the question's own film is framed and turned. Held separately from the
     state so that undoing a replacement can put them back — uploading a new
     film clears both, since neither describes it. */
  const seededCrop = saved?.imageCrop ?? original?.imageCrop ?? null;
  const seededOrientation = saved?.imageOrientation ?? original?.imageOrientation ?? NO_ORIENTATION;

  const [newImage, setNewImage] = useState<string | undefined>(saved?.imageDataUrl);
  const [imageRemoved, setImageRemoved] = useState(!!saved?.imageRemoved);
  const [stem, setStem] = useState(saved?.questionText ?? original?.questionText ?? '');
  const [answers, setAnswers] = useState<EditableAnswer[]>(
    saved?.answers ?? (original ? toEditableAnswers(original) : [])
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [showOld, setShowOld] = useState(true);
  const [preview, setPreview] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [note, setNote] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);
  /* Seeded from the crop the question ALREADY has, not only from a crop this
     editor previously saved. Starting at null made the stage show the raw
     scanned page — printed stem, answer key and all — while the candidate saw
     the cropped film, and every label was placed against the wrong picture. */
  const [cropRect, setCropRect] = useState<{x:number;y:number;w:number;h:number} | null>(seededCrop);
  const [savedOnce, setSavedOnce] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  /* Magnification of the working stage. 1 is "fits the stage"; above that the
     plate scrolls. Cropping to a tall strip makes the film NARROWER, not
     bigger, so without this the answer to "I cropped it, why is it not zoomed
     in" is that it genuinely is not — the fit just got tighter. */
  const [zoom, setZoom] = useState(1);
  const [orientation, setOrientation] = useState<ImageOrientation>(seededOrientation);
  const fileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  /* The clipped box: what the candidate actually sees, and therefore what
     label percentages are measured against. */
  const frameRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  /* --- Online publishing -------------------------------------------------
     When the content service is reachable and this session is signed in
     against it, Save writes to the server: the picture becomes an asset with
     a URL of its own, and the editor's document goes into the shared overlay.
     Both interfaces read that, so one save updates the Question Bank and
     every Atlas gallery at once. Without a service the page behaves exactly
     as it always has and says so. */
  const live = hasServerSession() && contentState().online;
  const published = questionId ? overlayFor(questionId) : undefined;
  const [publishing, setPublishing] = useState(false);

  /* Label visibility, and Atlas association, held apart on purpose: hiding a
     letter from the candidate is a presentation choice, and must not delete
     the anatomy the Atlas is built from. Seeded from what is already saved. */
  const [hidden, setHidden] = useState<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {};
    for (const [letter, v] of Object.entries(published?.labels ?? {})) {
      if (v?.visible === false) out[letter] = true;
    }
    return out;
  });
  const [outOfAtlas, setOutOfAtlas] = useState<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {};
    for (const [letter, v] of Object.entries(published?.labels ?? {})) {
      if (v?.inAtlas === false) out[letter] = true;
    }
    return out;
  });
  const [atlasMeta, setAtlasMeta] = useState({
    include: published?.atlas?.include !== false,
    description: published?.atlas?.description ?? '',
    modality: published?.atlas?.modality ?? '',
    plane: published?.atlas?.plane ?? '',
    sequence: published?.atlas?.sequence ?? '',
  });

  const audit = useMemo(() => (original ? auditAnnotations(original) : null), [original]);

  /* Both resolutions happen before the not-found early return, so the hook
     order is the same on every render. */
  const shownPath = imageRemoved ? undefined : newImage ?? original?.imagePath;
  const shownSrc = useResolvedSrc(shownPath);
  const oldSrc = useResolvedSrc(shipped?.imagePath);

  /* Label geometry is authored as a percentage of the IMAGE's width, but the
     pointer is drawn inside a zero-width pin, so a CSS percentage resolved
     against ~30px of badge instead: a "12%" arrow came out 3.6px long and the
     size dial moved it by fractions of a pixel. Measuring the rendered film
     and handing the pin real pixels is what makes those dials visible. */
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });
  const plateW = frameSize.w;
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const r = frame.getBoundingClientRect();
      setFrameSize((prev) =>
        Math.abs(prev.w - r.width) < 0.5 && Math.abs(prev.h - r.height) < 0.5
          ? prev
          : { w: r.width, h: r.height }
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(frame);
    return () => ro.disconnect();
  }, [shownSrc, cropping, natural, cropRect, orientation]);

  /* The frame is the picture as displayed, so a quarter turn swaps its
     proportions; the film inside keeps its own and is rotated within. */
  const quarterTurn = orientation.rotate === 90 || orientation.rotate === 270;
  const effCrop = cropRect ?? { x: 0, y: 0, w: 1, h: 1 };
  const frameAspect = natural
    ? quarterTurn
      ? `${natural.h * effCrop.h} / ${natural.w * effCrop.w}`
      : `${natural.w * effCrop.w} / ${natural.h * effCrop.h}`
    : null;

  const dirty = {
    image: !!newImage || imageRemoved,
    questionText: stem !== (original?.questionText ?? ''),
    answers:
      !!original &&
      (answers.length !== original.labels.length ||
        answers.some((a) => a.officialAnswer !== original.answers[a.letter]?.officialAnswer)),
    annotations: answers.some((a) => a.needsReview === false) || !!newImage,
  };
  const unreviewed = answers.filter((a) => a.needsReview).length;

  /* Keyboard nudging: the difference between "about right" and "on the
     structure" is a pixel or two, which a mouse drag will not give you. */
  useEffect(() => {
    if (!selected) return;
    function onKey(e: KeyboardEvent) {
      const step = e.shiftKey ? 2 : 0.25;
      const d: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
      };
      const move = d[e.key];
      if (!move) return;
      e.preventDefault();
      setAnswers((prev) =>
        prev.map((a) =>
          a.id === selected
            ? {
                ...a,
                marker: {
                  x: Math.min(100, Math.max(0, (a.marker?.x ?? 50) + move[0])),
                  y: Math.min(100, Math.max(0, (a.marker?.y ?? 50) + move[1])),
                },
                needsReview: false,
              }
            : a
        )
      );
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  if (!original || !meta) {
    return (
      <div className="empty-state">
        <h1>Question not found</h1>
        <Link className="btn btn-primary" to="/">Back to the modules</Link>
      </div>
    );
  }

  function onPick(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setNewImage(String(reader.result));
      setImageRemoved(false);
      /* A replacement is a DIFFERENT film, so neither the framing nor the
         turning of the old one describes it. The crop is seeded from the
         question's existing crop — which nearly every question has, because
         the source pages carry a printed stem — so leaving it in place would
         cut the new upload down to a rectangle chosen for another image
         entirely, and an orientation correction would turn a film that was
         never crooked. */
      setCropRect(null);
      setOrientation(NO_ORIENTATION);
      /* Not one of the source questions stores marker positions — the
         letters live in the scan. Without a starting spread every label
         would inherit the same 50/50 default, stack in the centre of the new
         image and be impossible to pick apart. They are dealt around the
         edge instead, each one individually grabbable. */
      setAnswers((prev) =>
        prev.map((a, i, all) => {
          if (a.marker) return { ...a, needsReview: true };
          const t = (i + 0.5) / all.length;
          return {
            ...a,
            marker: { x: 12 + 76 * t, y: i % 2 === 0 ? 16 : 84 },
            needsReview: true,
          };
        })
      );
      setNote(
        `New image applied. ${answers.length} label${answers.length === 1 ? '' : 's'} and all answer text preserved — reposition each label, then save.`
      );
    };
    reader.readAsDataURL(file);
  }

  /* Percent of the VISIBLE FILM, not of the stage and not of the file.

     Two corrections live here. The film is letterboxed inside its container,
     so measuring the container put every placement off by the width of the
     black bars. And 492 of the 501 questions carry an imageCrop — the source
     pages have their printed question stem cropped away — which the candidate
     sees applied and this editor did not: a label dropped halfway down the
     page went to the middle of the FILE while the student's viewer read the
     same 50% as the middle of the CROP, and the arrow pointed at the wrong
     anatomy. Measuring the cropped frame makes the two agree.

     While the crop tool itself is open the whole file is shown instead, since
     re-framing means seeing what is currently being cut off; the rectangle
     dragged there is in the file's own fractions, which is how it is stored. */
  function pctFromEvent(e: { clientX: number; clientY: number }) {
    const box = (cropping ? imgRef.current : frameRef.current) ?? imgRef.current;
    if (!box) return null;
    const r = box.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return {
      x: Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)),
    };
  }

  function place(id: string, e: { clientX: number; clientY: number }) {
    const p = pctFromEvent(e);
    if (!p) return;
    setAnswers((prev) =>
      prev.map((a) => (a.id === id ? { ...a, marker: p, needsReview: false } : a))
    );
  }

  function stageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!selected) return;
    place(selected, e);
  }

  /* Crop is a rectangle in the image's own fractions, applied at render time
     like every other crop in the app — the uploaded file is never rewritten,
     so a bad crop is undone by dragging a new one. */
  function startCrop(e: React.PointerEvent) {
    const a = pctFromEvent(e);
    if (!a) return;
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      const b = pctFromEvent(ev);
      if (!b) return;
      setCropRect({
        x: Math.min(a.x, b.x) / 100,
        y: Math.min(a.y, b.y) / 100,
        w: Math.abs(b.x - a.x) / 100,
        h: Math.abs(b.y - a.y) / 100,
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function startDrag(id: string, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSelected(id);
    const move = (ev: PointerEvent) => place(id, ev);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /* Turning the film moves the anatomy, so the labels have to travel with it —
     otherwise correcting an upside-down scan silently detaches every arrow
     from the structure it names. Marker positions are stored in the DISPLAYED
     space, so the same transform that turns the pixels is applied once to the
     stored coordinates and nothing downstream has to know. */
  function reorient(step: Partial<ImageOrientation>) {
    const next: ImageOrientation = { ...orientation, ...step };
    setOrientation(next);
    setAnswers((prev) =>
      prev.map((a) => (a.marker ? { ...a, marker: remapMarker(a.marker, orientation, next) } : a))
    );
  }

  function rotateBy(deg: 90 | 270) {
    reorient({ rotate: (((orientation.rotate + deg) % 360) as ImageOrientation['rotate']) });
  }

  function removeAnswer(a: EditableAnswer) {
    setConfirm({
      message: `Remove answer ${a.letter} — "${a.officialAnswer}"? The wording of every other answer stays exactly as it is.`,
      onYes: () => {
        setAnswers((prev) => reletter(prev.filter((x) => x.id !== a.id)));
        setSelected(null);
        setConfirm(null);
      },
    });
  }

  /* One description of the pending edit, used both to save and to preview.
     They were built separately and had drifted: the preview's version dropped
     `cropRect`, so a crop the author had just dragged was invisible in
     "Preview as student" and only appeared after saving and reloading. */
  function pendingEdit(): QuestionEdit {
    return {
      questionId: questionId ?? original!.id,
      ...(newImage ? { imageDataUrl: newImage } : {}),
      ...(imageRemoved ? { imageRemoved: true } : {}),
      /* A replacement is a different film; the crop that framed the old scan
         does not describe it. */
      imageCrop: cropRect ?? (newImage || imageRemoved ? null : undefined),
      imageOrientation: isOriented(orientation) ? orientation : null,
      questionText: stem,
      answers,
      /* saveEdit stamps the real time on write; this is called during render
         for the preview too, and a fresh clock reading there would be a new
         value on every pass for no benefit. */
      updatedAt: '',
      dirty,
    };
  }

  /* Everything the editor knows, sent to the content service in one write:
     the picture as an uploaded asset, the annotation document, which letters
     are shown, which associations feed the Atlas, and the film's metadata.
     One request, one record, both interfaces. */
  async function publish() {
    if (!questionId || !original) return;
    setPublishing(true);
    setSaveError(null);
    try {
      const edit = pendingEdit();
      const patch: Parameters<typeof patchQuestion>[1] = {
        ifRev: contentState().overlay.rev,
        action: newImage ? 'image replaced' : imageRemoved ? 'image removed' : 'question edited',
      };

      if (imageRemoved) {
        /* Soft. The question, its answers and its teaching stay exactly as
           they are; only the film stops being shown, and it can come back. */
        patch.image = { removedAt: new Date().toISOString() };
      } else if (newImage?.startsWith('data:')) {
        const file = await dataUrlToFile(newImage, `${questionId}.png`);
        const { assetId } = await uploadAsset(file);
        patch.image = {
          assetId,
          /* A fresh version on every replacement, so no cache anywhere can
             keep serving the picture that was just replaced. */
          version: (published?.image?.version ?? 0) + 1,
          filename: file.name,
          replacedAt: new Date().toISOString(),
          removedAt: null,
          previous: {
            assetId: published?.image?.assetId,
            sourcePath: shipped?.imagePath,
          },
        };
      }

      /* The picture is now an asset; carrying the data URL as well would
         double the document and go stale the moment it is replaced again. */
      const { imageDataUrl, ...documentWithoutImage } = edit;
      void imageDataUrl;
      patch.edit = documentWithoutImage;

      const labels: Record<string, { visible?: boolean; inAtlas?: boolean }> = {};
      for (const a of answers) {
        labels[a.letter] = {
          visible: !hidden[a.letter],
          inAtlas: !outOfAtlas[a.letter],
        };
      }
      patch.labels = labels;

      patch.atlas = {
        include: atlasMeta.include,
        description: atlasMeta.description,
        modality: atlasMeta.modality,
        plane: atlasMeta.plane,
        sequence: atlasMeta.sequence,
      };

      setOverlay(await patchQuestion(questionId, patch));
      setSavedOnce(true);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? `${error.message} Nothing has been changed.`
          : 'The content service refused the change. Nothing has been changed.'
      );
      setSavedOnce(false);
      // Re-read, so a rejected write leaves the page showing what is real.
      loadContent(true);
    } finally {
      setPublishing(false);
    }
  }

  function save() {
    if (!questionId) return;
    if (live) {
      void publish();
      return;
    }
    const result = saveEdit(pendingEdit());
    if (!result.ok) {
      setSaveError(result.reason);
      setSavedOnce(false);
      return;
    }
    setSaveError(null);
    /* Saving does not walk away. The film is usually right long before the
       labels are, so the page stays open and offers to carry on placing
       them; the work so far is already committed either way. */
    setSavedOnce(true);
  }

  const previewQuestion = applyEdit(original, pendingEdit());

  return (
    <div className="rie">
      <header className="rie-head">
        <Link className="back-link" to={`/section/${section}/q/${original.id}`}>
          ← {meta.title} Question {displayNumber}
        </Link>
        <h1>Replace image</h1>
        <p className="rie-sub">
          The image is the only thing this page changes. Answer text, accepted variants,
          teaching text and all metadata are preserved.
        </p>
      </header>

      {savedOnce && (
        <div className="rie-saved" role="status">
          <strong>Saved.</strong> The image is committed. Labels are often the part that
          still needs work — carry on placing them, or view it as a student.
          <span className="rie-saved-actions">
            <button type="button" className="btn btn-primary" onClick={() => setSavedOnce(false)}>
              Keep editing labels
            </button>
            <button type="button" className="btn" onClick={() => setPreview(true)}>Preview</button>
            <button
              type="button"
              className="btn"
              onClick={() => navigate(`/section/${section}/q/${original!.id}`)}
            >
              Done — back to the question
            </button>
          </span>
        </div>
      )}

      {note && (
        <div className="rie-banner" role="status">
          <strong>New image applied.</strong> {note}
          <button
            type="button"
            className="btn"
            onClick={() => {
              setNewImage(undefined);
              setNote(null);
              setAnswers(saved?.answers ?? toEditableAnswers(original));
              /* Uploading cleared these because they belonged to the old film;
                 putting that film back has to put them back with it. */
              setCropRect(seededCrop);
              setOrientation(seededOrientation);
            }}
          >
            Undo image replacement
          </button>
        </div>
      )}

      {saveError && (
        <div className="rie-warn" role="alert">
          <strong>Not saved.</strong> {saveError}
        </div>
      )}

      {orientation.flipH && (
        <div className="rie-warn" role="alert">
          <strong>This film is mirrored left to right.</strong> That swaps the sides of
          everything on it — an L marker now reads R, and a right-sided structure appears
          on the left. Only keep this if the scan was genuinely extracted mirrored.
        </div>
      )}

      {audit?.hasBakedInAnnotations && (
        <div className="rie-warn" role="alert">
          <strong>Some labels are part of the image.</strong> {audit.reason}
        </div>
      )}

      <div className="rie-body">
        <section className="rie-stage-wrap">
          <div className="rie-toolbar">
            <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()}>
              Replace image
            </button>
            <button
              type="button"
              className="btn"
              onClick={() =>
                setConfirm({
                  message: 'Remove the image? The question, labels, answers and teaching text are all kept.',
                  onYes: () => { setImageRemoved(true); setNewImage(undefined); setConfirm(null); },
                })
              }
            >
              Remove image
            </button>
            {(newImage || imageRemoved) && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setNewImage(undefined);
                  setImageRemoved(false);
                  setNote(null);
                  setCropRect(seededCrop);
                  setOrientation(seededOrientation);
                }}
              >
                Restore previous image
              </button>
            )}
            {shownSrc && (
              <button
                type="button"
                className={'btn' + (cropping ? ' btn-primary' : '')}
                onClick={() => setCropping((v) => !v)}
              >
                {cropping ? 'Done cropping' : 'Crop image'}
              </button>
            )}
            {cropRect && (
              <button type="button" className="btn" onClick={() => setCropRect(null)}>
                Clear crop
              </button>
            )}
            {shownSrc && !cropping && (
              <span className="rie-orient-group" role="group" aria-label="Correct the film's orientation">
                <button type="button" className="btn btn-icon" title="Rotate 90° anticlockwise"
                  onClick={() => rotateBy(270)}>↺</button>
                <button type="button" className="btn btn-icon" title="Rotate 90° clockwise"
                  onClick={() => rotateBy(90)}>↻</button>
                <button
                  type="button"
                  className={'btn btn-icon' + (orientation.flipV ? ' is-on' : '')}
                  title="Flip top to bottom"
                  onClick={() => reorient({ flipV: !orientation.flipV })}
                >⇕</button>
                <button
                  type="button"
                  className={'btn btn-icon' + (orientation.flipH ? ' is-on' : '')}
                  title="Mirror left to right — changes laterality"
                  onClick={() => reorient({ flipH: !orientation.flipH })}
                >⇔</button>
                {isOriented(orientation) && (
                  <button
                    type="button"
                    className="btn"
                    title="Back to the file's own orientation"
                    onClick={() => reorient({ rotate: 0, flipH: false, flipV: false })}
                  >
                    Reset orientation
                  </button>
                )}
              </span>
            )}
            {newImage && (
              <label className="rie-toggle">
                <input type="checkbox" checked={showOld} onChange={(e) => setShowOld(e.target.checked)} />
                Show old image beside it
              </label>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }}
            />
            {shownSrc && (
              <span className="rie-zoom" role="group" aria-label="Magnify the working image">
                <button type="button" className="btn" title="Zoom out"
                  onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}>−</button>
                <output>{Math.round(zoom * 100)}%</output>
                <button type="button" className="btn" title="Zoom in"
                  onClick={() => setZoom((z) => Math.min(6, +(z + 0.25).toFixed(2)))}>+</button>
                {zoom !== 1 && (
                  <button type="button" className="btn" title="Back to fitting the stage"
                    onClick={() => setZoom(1)}>Fit</button>
                )}
              </span>
            )}
          </div>

          <div className={showOld && newImage ? 'rie-stages rie-stages-split' : 'rie-stages'}>
            {showOld && newImage && (
              <figure className="rie-stage rie-stage-old">
                <figcaption>Old image — reference only, never published</figcaption>
                <div className="rie-plate">
                  {/* Resolution is asynchronous for an idb:// custom-case
                      image, so this is empty on the first render. An <img>
                      with src="" makes the browser re-request the page
                      itself, so nothing is rendered until there is a real
                      source. */}
                  {oldSrc && <img src={oldSrc} alt="previous image" draggable={false} />}
                </div>
              </figure>
            )}

            <figure className="rie-stage">
              <figcaption>
                {imageRemoved
                  ? 'No image currently assigned'
                  : newImage
                    ? 'New image — drag a label onto its structure, or select one and click'
                    : 'Current image'}
              </figcaption>
              {shownSrc ? (
                /* A plain image with an overlay of its own, rather than the
                   student's ImageViewer. The viewer letterboxes and zooms, so
                   a click on it does not map to a position on the film; here
                   the overlay is the image's own box and the arithmetic is
                   exact. */
                <div
                  className={'rie-stage-click' + (cropping ? ' is-cropping' : '')}
                  ref={stageRef}
                  onClick={cropping ? undefined : stageClick}
                  onPointerDown={cropping ? startCrop : undefined}
                >
                  <div className="rie-plate">
                    {/* The frame is the cropped film — the exact picture the
                        candidate is shown. Labels are positioned inside it, so
                        a pin at 40%/60% here is 40%/60% there. While the crop
                        tool is open the frame opens out to the whole file, so
                        the region being cut away is visible to drag against. */}
                    <div
                      className={'rie-frame' + (cropping ? ' is-full' : '')}
                      ref={frameRef}
                      style={{
                        ...(!cropping && frameAspect ? { aspectRatio: frameAspect } : {}),
                        ...({ '--zoom': zoom } as React.CSSProperties),
                      }}
                    >
                      {/* Same construction as the student's viewer: the film
                          sits un-rotated in an inner layer that is turned as a
                          whole, while the frame around it is sized to the
                          turned result. Keeping the two identical is the only
                          way "Preview as student" can be trusted. */}
                      <div
                        className="rie-orient"
                        style={
                          cropping
                            ? undefined
                            : {
                                transform:
                                  `translate(-50%, -50%) rotate(${orientation.rotate}deg)` +
                                  ` scale(${orientation.flipH ? -1 : 1}, ${orientation.flipV ? -1 : 1})`,
                                ...(quarterTurn
                                  ? { width: frameSize.h, height: frameSize.w }
                                  : { width: '100%', height: '100%' }),
                              }
                        }
                      >
                        <img
                          ref={imgRef}
                          src={shownSrc}
                          alt={stem}
                          draggable={false}
                          onLoad={(e) => {
                            const el = e.currentTarget;
                            setNatural({ w: el.naturalWidth, h: el.naturalHeight });
                          }}
                          style={
                            !cropping && cropRect
                              ? {
                                  position: 'absolute',
                                  width: `${100 / cropRect.w}%`,
                                  height: `${100 / cropRect.h}%`,
                                  left: `${(-cropRect.x / cropRect.w) * 100}%`,
                                  top: `${(-cropRect.y / cropRect.h) * 100}%`,
                                  /* Both caps have to go: the stylesheet's
                                     max-height clamped the oversized image back
                                     to the frame and silently undid the crop's
                                     vertical scaling. */
                                  maxWidth: 'none',
                                  maxHeight: 'none',
                                }
                              : undefined
                          }
                        />
                      </div>
                      {cropping && cropRect && (
                        <div
                          className="rie-croprect"
                          style={{
                            left: `${cropRect.x * 100}%`, top: `${cropRect.y * 100}%`,
                            width: `${cropRect.w * 100}%`, height: `${cropRect.h * 100}%`,
                          }}
                        />
                      )}
                      <div className="rie-overlay">
                      {answers.map((a) => (
                        /* The pin draws the pointer style that is actually
                           selected. It used to be a lettered circle whatever
                           the choice was, so picking "arrow" or "line"
                           changed the data but nothing on screen — it read as
                           a broken control. */
                        <button
                          type="button"
                          key={a.id}
                          className={
                            'rie-pin rie-pin-' + (a.shape ?? 'arrow') +
                            ' rie-c-' + (a.colour ?? 'white') +
                            (selected === a.id ? ' is-selected' : '') +
                            (a.needsReview ? ' needs-review' : '')
                          }
                          style={{
                            left: `${a.marker?.x ?? 50}%`,
                            top: `${a.marker?.y ?? 50}%`,
                            ...{
                              /* Both are a percentage of the FILM's width,
                                 turned into pixels here. A ring wants a large
                                 default, a dot a small one. */
                              '--ring': `${((a.circlePct ?? (a.shape === 'point' ? DOT_PCT : RING_PCT)) / 100) * plateW}px`,
                              '--len': `${((a.lengthPct ?? 12) / 100) * plateW}px`,
                              ...headVars(a, plateW),
                              '--ang': `${a.angle ?? 0}deg`,
                            } as React.CSSProperties,
                          }}
                          onPointerDown={(e) => startDrag(a.id, e)}
                          onClick={(e) => e.stopPropagation()}
                          title={`${a.letter} — ${a.officialAnswer} (${a.shape ?? 'arrow'})`}
                        >
                          <span className="rie-pin-mark" aria-hidden="true" />
                          <span className="rie-pin-letter">{a.letter}</span>
                        </button>
                      ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rie-noimage">
                  <p>NO IMAGE CURRENTLY ASSIGNED</p>
                  <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()}>
                    Upload replacement image
                  </button>
                </div>
              )}
            </figure>
          </div>
        </section>

        <aside className="rie-side">
          <label className="rie-field">
            <span>Question stem <em>(editable)</em></span>
            <textarea rows={3} value={stem} onChange={(e) => setStem(e.target.value)} />
          </label>

          <div className="rie-answers">
            <h2>
              Answers <span className="rie-lock">read-only — protected</span>
            </h2>
            <p className="rie-hint">
              Wording is never changed here. Select one to place its label; use arrow keys to nudge.
            </p>
            {answers.map((a) => (
              <div
                key={a.id}
                className={`rie-answer${selected === a.id ? ' is-selected' : ''}${a.needsReview ? ' needs-review' : ''}`}
              >
                <button type="button" className="rie-pick" onClick={() => setSelected(a.id)}>
                  <span className="rie-letter">{a.letter}</span>
                  <span className="rie-text">{a.officialAnswer}</span>
                </button>
                {a.needsReview && <span className="rie-flag" title="Inherited from the previous image">review</span>}
                <button type="button" className="rie-remove" onClick={() => removeAnswer(a)}>Remove</button>
                <div className="rie-shapes" role="group" aria-label={`Pointer style for ${a.letter}`}>
                  {SHAPES.map((sh) => (
                    <button
                      type="button"
                      key={sh.id}
                      className={'rie-shape' + ((a.shape ?? 'arrow') === sh.id ? ' is-on' : '')}
                      title={sh.title}
                      onClick={() =>
                        setAnswers((prev) =>
                          prev.map((x) => (x.id === a.id ? { ...x, shape: sh.id } : x))
                        )
                      }
                    >
                      {sh.glyph}
                    </button>
                  ))}
                  {/* Angle, size and colour on every label, not only on the
                      ring. The size control used to appear for circles alone,
                      so most labels had no way to be resized at all. */}
                  <div className="rie-dials">
                    {(a.shape ?? 'arrow') !== 'point' && (a.shape ?? 'arrow') !== 'circle' && (
                      <label className="rie-dial" title="Angle">
                        <span>∠</span>
                        <input
                          type="range" min={0} max={359} step={1}
                          value={a.angle ?? 0}
                          onChange={(e) =>
                            setAnswers((prev) => prev.map((x) =>
                              x.id === a.id ? { ...x, angle: Number(e.target.value) } : x))
                          }
                        />
                        <b>{a.angle ?? 0}°</b>
                      </label>
                    )}
                    <label className="rie-dial" title="Size">
                      <span>↔</span>
                      <input
                        type="range" min={1} max={40} step={0.5}
                        value={
                          ROUND_SHAPES.has(a.shape ?? 'arrow')
                            ? (a.circlePct ?? (a.shape === 'point' ? DOT_PCT : RING_PCT))
                            : (a.lengthPct ?? 12)
                        }
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setAnswers((prev) => prev.map((x) =>
                            x.id === a.id
                              ? (ROUND_SHAPES.has(x.shape ?? 'arrow')
                                  ? { ...x, circlePct: v }
                                  : { ...x, lengthPct: v })
                              : x));
                        }}
                      />
                      <b>{
                        ROUND_SHAPES.has(a.shape ?? 'arrow')
                          ? (a.circlePct ?? (a.shape === 'point' ? DOT_PCT : RING_PCT))
                          : (a.lengthPct ?? 12)
                      }%</b>
                    </label>
                    {/* Weight. A hairline gets lost on a bright film and a
                        heavy stroke buries the anatomy it points at, so this
                        is per label like the rest. */}
                    <label className="rie-dial" title="Thickness">
                      <span>═</span>
                      <input
                        type="range" min={0.2} max={2.4} step={0.05}
                        value={a.thicknessPct ?? DEFAULT_THICKNESS_PCT}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setAnswers((prev) => prev.map((x) =>
                            x.id === a.id ? { ...x, thicknessPct: v } : x));
                        }}
                      />
                      <b>{(a.thicknessPct ?? DEFAULT_THICKNESS_PCT).toFixed(2)}</b>
                    </label>
                    <div className="rie-colours" role="group" aria-label="Colour">
                      {(['white','black','yellow','blue'] as const).map((c) => (
                        <button
                          key={c} type="button" title={c}
                          className={'rie-colour rie-colour-' + c + ((a.colour ?? 'white') === c ? ' is-on' : '')}
                          onClick={() =>
                            setAnswers((prev) => prev.map((x) =>
                              x.id === a.id ? { ...x, colour: c } : x))
                          }
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {answers.length === 0 && <p className="rie-hint">All answers removed.</p>}
          </div>

          {/* Which letters the candidate is asked, and which associations
              reach the Atlas. Two switches, because they are two decisions:
              a letter can be taken off the question without the anatomy
              leaving the Atlas, and vice versa. Nothing here renumbers
              anything — answers are stored against their letter, so C is
              still C with A and B switched off. */}
          <div className="rie-visibility">
            <h3>Shown to the candidate</h3>
            <p className="rie-hint">
              Turning a letter off hides the question's box for it. It keeps its own
              letter and its own answer, and turning it back on restores both.
            </p>
            <ul className="rie-vis-list">
              {answers.map((a) => (
                <li key={`vis-${a.id}`}>
                  <span className="rie-vis-letter mono">{a.letter}</span>
                  <span className="rie-vis-name">{a.officialAnswer}</span>
                  <label className="rie-vis-toggle">
                    <input
                      type="checkbox"
                      checked={!hidden[a.letter]}
                      onChange={(e) =>
                        setHidden((h) => ({ ...h, [a.letter]: !e.target.checked }))
                      }
                    />
                    <span>Asked</span>
                  </label>
                  <label className="rie-vis-toggle">
                    <input
                      type="checkbox"
                      checked={!outOfAtlas[a.letter]}
                      onChange={(e) =>
                        setOutOfAtlas((o) => ({ ...o, [a.letter]: !e.target.checked }))
                      }
                    />
                    <span>In Atlas</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div className="rie-atlasmeta">
            <h3>Structure Atlas</h3>
            <label className="rie-vis-toggle rie-atlas-include">
              <input
                type="checkbox"
                checked={atlasMeta.include}
                onChange={(e) => setAtlasMeta((m) => ({ ...m, include: e.target.checked }))}
              />
              <span>Include this film in the Atlas</span>
            </label>
            <label className="rie-field">
              <span>Description</span>
              <input
                type="text"
                value={atlasMeta.description}
                placeholder={original.projection ?? 'e.g. Axial contrast-enhanced CT chest'}
                onChange={(e) => setAtlasMeta((m) => ({ ...m, description: e.target.value }))}
              />
            </label>
            <div className="rie-meta-row">
              <label className="rie-field">
                <span>Modality</span>
                <select
                  value={atlasMeta.modality}
                  onChange={(e) => setAtlasMeta((m) => ({ ...m, modality: e.target.value }))}
                >
                  <option value="">From the question</option>
                  {['Radiograph', 'Fluoroscopy', 'CT', 'MRI', 'Ultrasound', 'Angiogram', 'Other'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="rie-field">
                <span>Plane</span>
                <select
                  value={atlasMeta.plane}
                  onChange={(e) => setAtlasMeta((m) => ({ ...m, plane: e.target.value }))}
                >
                  <option value="">Not stated</option>
                  {['Axial', 'Coronal', 'Sagittal', 'Oblique', 'AP', 'PA', 'Lateral', 'Other'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="rie-field">
                <span>Sequence</span>
                <input
                  type="text"
                  value={atlasMeta.sequence}
                  placeholder="T1, T2…"
                  onChange={(e) => setAtlasMeta((m) => ({ ...m, sequence: e.target.value }))}
                />
              </label>
            </div>
            <p className="rie-hint">
              {live
                ? 'Saved centrally. The Atlas reads these the moment you save — there is nothing to rebuild.'
                : 'Atlas metadata is only saved when signed in against a content service.'}
            </p>
          </div>

          <div className="rie-preserved">
            <h3>Preserved unchanged</h3>
            <ul>
              <li>
                {original.teachingText
                  ? `Teaching text (${original.teachingText.length} chars)`
                  : 'Teaching text (none on this question)'}
              </li>
              <li>Accepted variants ({answers.reduce((n, a) => n + a.acceptedVariants.length, 0)})</li>
              <li>References, tags, source metadata, question id</li>
            </ul>
          </div>

          <div className="rie-actions">
            <button type="button" className="btn" onClick={() => setPreview(true)}>Preview as student</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={save}
              disabled={answers.length === 0 || publishing}
            >
              {publishing ? 'Saving…' : live ? 'Save — live for everyone' : 'Save to this browser'}
            </button>
            {saved && (
              <button
                type="button"
                className="btn"
                onClick={() =>
                  setConfirm({
                    message: 'Revert this question to the original shipped version? Your edits are discarded.',
                    onYes: () => { clearEdit(original.id); navigate(`/section/${section}/q/${original.id}`); },
                  })
                }
              >
                Revert to original
              </button>
            )}
          </div>

          {unreviewed > 0 && (
            <p className="rie-unreviewed">
              {unreviewed} annotation{unreviewed === 1 ? '' : 's'} inherited from the previous image
              and not yet repositioned.
            </p>
          )}
        </aside>
      </div>

      {preview && (
        <div className="rie-modal" role="dialog" onClick={() => setPreview(false)}>
          <div className="rie-modal-inner" onClick={(e) => e.stopPropagation()}>
            <h2>Student preview</h2>
            <p className="rie-preview-stem">{previewQuestion.questionText}</p>
            {shownSrc ? (
              <ImageViewer
                src={shownSrc}
                alt={previewQuestion.questionText}
                crop={previewQuestion.imageCrop}
                orientation={previewQuestion.imageOrientation}
                markers={previewQuestion.labels.map((l) => {
                  const x = previewQuestion.markerPositions?.[l]?.x ?? 50;
                  const y = previewQuestion.markerPositions?.[l]?.y ?? 50;
                  /* An edited question draws its own pointer, so the badge is
                     offset off the structure and a leader line is drawn — the
                     opposite of the extracted questions, where the badge sits
                     on the source's own printed letter to cover it.

                     Where the author has set the angle and size dials, the
                     offset they describe wins over the generic fallback;
                     otherwise this preview would show a different arrow from
                     the one just drawn on the stage next to it. */
                  const stored = previewQuestion.markerLabelPositions?.[l];
                  const angle = previewQuestion.markerAngles?.[l];
                  const lengthPct = previewQuestion.markerLengthPct?.[l];
                  const polar = lengthPct != null;
                  const fallback = defaultLabelPos(x, y);
                  return {
                    id: l, label: l, x, y,
                    labelX: stored?.x ?? (polar ? undefined : fallback.labelX),
                    labelY: stored?.y ?? (polar ? undefined : fallback.labelY),
                    shape: previewQuestion.markerShapes?.[l] ?? 'arrow',
                    circlePct: previewQuestion.markerCirclePct?.[l],
                    angle,
                    lengthPct,
                    colour: previewQuestion.markerColours?.[l],
                    thickness: previewQuestion.markerArrows?.[l]?.thickness,
                  };
                })}
              />
            ) : (
              <p>No image assigned.</p>
            )}
            <ol className="rie-preview-answers">
              {previewQuestion.labels.map((l) => (
                <li key={l}><strong>{l}</strong> {previewQuestion.answers[l]?.officialAnswer}</li>
              ))}
            </ol>
            <button type="button" className="btn btn-primary" onClick={() => setPreview(false)}>Close</button>
          </div>
        </div>
      )}

      {confirm && (
        <div className="rie-modal" role="dialog">
          <div className="rie-modal-inner rie-confirm">
            <p>{confirm.message}</p>
            <div className="rie-actions">
              <button type="button" className="btn" onClick={() => setConfirm(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={confirm.onYes}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
