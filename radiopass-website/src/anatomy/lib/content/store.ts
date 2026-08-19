/* ===========================================================================
   The overlay, applied.

   This is the join between the two interfaces. `getSectionQuestions()` — the
   single function the Question Bank AND the Structure Atlas both call to get
   questions — runs every question through `applyOverlay()` on the way out.
   So there is one resolved question record, and:

       replace an image   ->  both interfaces show the new asset
       remove an image    ->  the question loses its film, the Atlas loses
                              the entry, nothing is left dangling
       hide a label       ->  the candidate stops being asked it; the Atlas
                              keeps the anatomy unless the association is
                              explicitly withdrawn
       edit metadata      ->  the Atlas caption changes

   with no second database and no rebuild step. The Atlas cannot drift from
   the Question Bank because there is nothing for it to drift from.

   The overlay is fetched once on start-up and cached in localStorage so a
   repeat visit paints immediately. To be explicit, because it matters: that
   cache is a copy of server state, never the record itself. Edits are saved
   by the API and survive a different browser, a different machine and a
   redeploy; the cache is only there so the first paint is not blank.
   =========================================================================== */

import type { Question } from '../../types';
import { applyEdit } from '../questionEdits';
import { assetSrc, fetchContent } from './api';
import { EMPTY_OVERLAY, type ContentOverlay, type ContentState, type QuestionOverlay } from './types';

const CACHE_KEY = 'radiopass-content-cache-v1';

let state: ContentState = {
  overlay: EMPTY_OVERLAY,
  editingConfigured: false,
  online: false,
  error: null,
};

let loaded = false;
let inflight: Promise<ContentState> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

export function subscribeContent(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function contentState(): ContentState {
  return state;
}

export function contentLoaded(): boolean {
  return loaded;
}

function readCache(): ContentOverlay | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ContentOverlay;
    return parsed && typeof parsed.rev === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(overlay: ContentOverlay) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(overlay));
  } catch {
    /* Quota or private browsing — the next load just refetches. */
  }
}

/** Applies a freshly saved overlay straight away, so the editor's own view
 *  updates without waiting for a refetch. */
export function setOverlay(overlay: ContentOverlay) {
  state = { ...state, overlay };
  writeCache(overlay);
  notify();
}

export function setEditingConfigured(value: boolean) {
  if (state.editingConfigured === value) return;
  state = { ...state, editingConfigured: value };
  notify();
}

/**
 * Loads the overlay. Called once at start-up and again after any save.
 *
 * A cached copy is applied first so the first paint is not delayed by a
 * network round trip, then the server's answer replaces it. On a static host
 * with no API this settles as `online: false` and the site runs exactly as it
 * did before online editing existed.
 */
export function loadContent(force = false): Promise<ContentState> {
  if (inflight && !force) return inflight;

  const cached = readCache();
  if (cached && !loaded) {
    state = { ...state, overlay: cached };
    notify();
  }

  inflight = fetchContent().then((result) => {
    state = {
      overlay: result.overlay ?? (cached ?? EMPTY_OVERLAY),
      editingConfigured: result.editingConfigured,
      online: result.online,
      error: result.error,
    };
    if (result.overlay) writeCache(result.overlay);
    loaded = true;
    inflight = null;
    notify();
    return state;
  });

  return inflight;
}

/* --- Applying it to a question ------------------------------------------- */

export function overlayFor(questionId: string): QuestionOverlay | undefined {
  return state.overlay.questions[questionId];
}

/**
 * The resolved question: the bundled record with the editor's changes on top.
 *
 * Deliberately conservative about what it touches. Replacing an image swaps
 * ONE field — `imagePath`. It does not go near `answers`, `labels`, marker
 * geometry or teaching text, because an asset change is not a change of
 * meaning: the question that asked for the right ventricle still asks for the
 * right ventricle after a better film is uploaded.
 */
export function applyOverlay(question: Question): Question {
  const patch = state.overlay.questions[question.id];
  if (!patch) return question;

  /* The annotation editor's document goes on FIRST — marker positions, arrow
     geometry, crop, orientation, answers — using the same function the
     browser-only override has always used. The image resolution below then
     overrides whatever path that left behind, because the asset is the one
     thing the editor cannot carry in a document. */
  let next = patch.edit ? applyEdit(question, patch.edit) : question;
  const original = next;
  const change = <K extends keyof Question>(key: K, value: Question[K]) => {
    if (next === original) next = { ...original };
    next[key] = value;
  };

  /* --- The image ------------------------------------------------------- */
  if (patch.image?.removedAt) {
    // Soft-deleted. Both interfaces treat an empty path as "no film": the
    // player shows a placeholder, and the Atlas builder skips the question.
    change('imagePath', '');
    change('imageRemoved', true);
    // A crop and an orientation describe the film that is no longer there.
    change('imageCrop', undefined);
    change('imageOrientation', undefined);
  } else if (patch.image?.assetId) {
    change('imagePath', assetSrc(patch.image.assetId, patch.image.version));
    /* An uploaded film is exactly what the editor chose to upload — there is
       no printed question stem to cut off it, so the crop that belonged to
       the scanned source page must not be carried over onto it. */
    if (!patch.image.keepGeometry) {
      change('imageCrop', undefined);
      change('imageOrientation', undefined);
    }
  }

  /* --- Labels ------------------------------------------------------------
     Two different things, kept apart on purpose. `hiddenLabels` is a
     presentation choice in the Question Bank. `atlasExcludedLabels` withdraws
     the anatomical association from the Atlas. Hiding a label never does the
     second: the anatomy is not deleted because a letter was turned off. */
  if (patch.labels) {
    const hidden = Object.entries(patch.labels)
      .filter(([, v]) => v?.visible === false)
      .map(([letter]) => letter);
    const excluded = Object.entries(patch.labels)
      .filter(([, v]) => v?.inAtlas === false)
      .map(([letter]) => letter);
    if (hidden.length) change('hiddenLabels', hidden);
    if (excluded.length) change('atlasExcludedLabels', excluded);
  }

  /* --- Answer wording ---------------------------------------------------
     Only ever reached through the editor's explicit answer field. Keyed by
     letter, so editing C cannot disturb A, B, D or E. */
  if (patch.answers) {
    /* Built on `next`, not on the bundled `question`.
       Sourced from the original, this silently reverted every answer the
       annotation editor had rewritten: that editor writes wording into
       `patch.edit.answers`, which applyEdit has already put onto `next` by
       the time we get here, and re-spreading the shipped record threw it
       away. Only questions carrying BOTH documents were affected, which is
       exactly what happens once a question is edited on two different
       pages — so it would have started biting as soon as the wording editor
       was used on anything already annotated. */
    const answers = { ...next.answers };
    let touched = false;
    for (const [letter, value] of Object.entries(patch.answers)) {
      if (!answers[letter] || !value?.officialAnswer) continue;
      answers[letter] = { ...answers[letter], officialAnswer: value.officialAnswer };
      touched = true;
    }
    if (touched) change('answers', answers);
  }

  /* --- What the Atlas shows under the film ------------------------------ */
  if (patch.atlas) {
    if (patch.atlas.include === false) change('excludeFromAtlas', true);
    const { description, modality, plane, sequence } = patch.atlas;
    if (description || modality || plane || sequence) {
      change('atlasNote', { description, modality, plane, sequence });
    }
  }

  if (patch.relationships?.length) change('atlasRelationships', patch.relationships);

  return next;
}

/** True when this question's film has been removed by an editor. */
export function isImageRemoved(question: Question): boolean {
  return question.imageRemoved === true;
}
