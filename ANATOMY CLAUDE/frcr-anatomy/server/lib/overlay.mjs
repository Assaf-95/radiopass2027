/* ===========================================================================
   The content overlay — the one editable copy of the anatomy dataset.

   The 501 extracted questions ship inside the JavaScript bundle and are never
   written to. Everything an editor changes online is recorded HERE, as a
   patch on top of that base, and both interfaces read the base through the
   patch:

       bundled question  ->  overlay  ->  Question Bank
                                      ->  Structure Atlas

   There is exactly one overlay document and exactly one asset store. The
   Atlas has no image records of its own and no copy of anything; it is a view
   over the same resolved questions the Question Bank renders. That is what
   makes "replace once, replace everywhere" true by construction rather than
   by a synchronisation step that could be forgotten.

   Shape of one question's patch. Every field is optional; an absent field
   means "unchanged from the bundled question".

     {
       questionId: 'thorax-p0036',
       updatedAt:  '2026-08-12T10:04:00.000Z',

       image: {                        // the asset behind this question now
         assetId:   'ast_a1b2c3',      // changes on every upload...
         version:   3,                 // ...and so does this, for caches
         filename:  'rv-new.png',
         replacedAt:'2026-08-12T10:04:00.000Z',
         removedAt: null,              // set = soft-deleted, shown nowhere
         previous:  { assetId: 'ast_...', sourcePath: '/images/thorax/p0036.webp' },
       },

       labels: {                       // KEYED BY LETTER, never by position
         B: { visible: false },        // hidden from the question...
         D: { inAtlas: false },        // ...removed from the Atlas instead
       },

       answers: { C: { officialAnswer: 'Right atrium' } },

       atlas: { include: true, description: '...', modality: 'CT',
                plane: 'Axial', sequence: 'T2', representativeFor: [...] },

       relationships: [ { target: 'right ventricle',
                          neighbour: 'left ventricle',
                          text: 'Posterior to the target on this image.' } ],
     }

   The letter IS the stable label id in this dataset: answers are stored as a
   MAP keyed by letter, not as an array, so hiding B cannot renumber C. That
   is the whole of requirement "hiding an option must not change the answer
   mapping" — there is no index to shift.
   =========================================================================== */

export const OVERLAY_KEY = 'overlay';
export const AUDIT_KEY = 'audit';
export const AUDIT_LIMIT = 500;

export function emptyOverlay() {
  return { rev: 0, updatedAt: null, questions: {} };
}

/** Never mutates its input: every write produces a new document with a new
 *  rev, so a client can tell whether what it holds is current. */
export function withQuestionPatch(overlay, questionId, patch, now) {
  const base = overlay?.questions?.[questionId] ?? { questionId };
  const next = mergeQuestion(base, patch, now);
  return {
    rev: (overlay?.rev ?? 0) + 1,
    updatedAt: now,
    questions: { ...(overlay?.questions ?? {}), [questionId]: next },
  };
}

function mergeQuestion(base, patch, now) {
  const out = { ...base, questionId: base.questionId, updatedAt: now };

  /* The annotation editor's own document — marker positions, arrow shapes,
     angles, lengths, colours, crop, orientation, answers. Replaced wholesale
     rather than merged, because the editor always sends the complete thing
     and a deep merge could resurrect a label the editor had just deleted. */
  if (patch.edit !== undefined) {
    if (patch.edit === null) delete out.edit;
    else out.edit = patch.edit;
  }

  if (patch.image !== undefined) {
    out.image = patch.image === null ? null : { ...(base.image ?? {}), ...patch.image };
  }

  /* Labels merge per letter so a single toggle does not wipe the others, and
     so a letter that is not mentioned keeps whatever it had. */
  if (patch.labels) {
    out.labels = { ...(base.labels ?? {}) };
    for (const [letter, value] of Object.entries(patch.labels)) {
      if (value === null) delete out.labels[letter];
      else out.labels[letter] = { ...(out.labels[letter] ?? {}), ...value };
    }
    if (Object.keys(out.labels).length === 0) delete out.labels;
  }

  if (patch.answers) {
    out.answers = { ...(base.answers ?? {}) };
    for (const [letter, value] of Object.entries(patch.answers)) {
      if (value === null) delete out.answers[letter];
      else out.answers[letter] = { ...(out.answers[letter] ?? {}), ...value };
    }
    if (Object.keys(out.answers).length === 0) delete out.answers;
  }

  if (patch.atlas) {
    out.atlas = { ...(base.atlas ?? {}) };
    for (const [k, v] of Object.entries(patch.atlas)) {
      // An empty string means "clear this field", not "store a blank".
      if (v === null || v === '') delete out.atlas[k];
      else out.atlas[k] = v;
    }
    if (Object.keys(out.atlas).length === 0) delete out.atlas;
  }

  /* Relationships are addressed by (target, neighbour); blank text removes
     the note rather than storing an empty sentence. */
  if (patch.relationships) {
    const byKey = new Map(
      (base.relationships ?? []).map((r) => [`${r.target}|${r.neighbour}`, r])
    );
    for (const r of patch.relationships) {
      const key = `${r.target}|${r.neighbour}`;
      if (!r.text || !String(r.text).trim()) byKey.delete(key);
      else byKey.set(key, { target: r.target, neighbour: r.neighbour, text: String(r.text).trim() });
    }
    out.relationships = [...byKey.values()];
    if (out.relationships.length === 0) delete out.relationships;
  }

  return out;
}

/** One line in the change log. Kept small and appended to a capped list. */
export function auditEntry(action, questionId, detail) {
  return { action, questionId, detail: detail ?? null, at: new Date().toISOString() };
}

export function appendAudit(log, entry) {
  return [entry, ...(Array.isArray(log) ? log : [])].slice(0, AUDIT_LIMIT);
}
