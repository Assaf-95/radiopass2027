/* ===========================================================================
   Structure Atlas — how a neighbouring structure sits relative to the one
   being studied, on one particular film.

   Every Atlas film lists the other structures its question teaches, and every
   one of those is a link to its own Atlas page. That much is derived from the
   question bank and needs no help. What cannot be derived is the ONE LINE
   that makes a neighbour useful:

       Left ventricle
       Posterior to the right ventricle on this image.      <- this line
       -> View Left ventricle

   That line is a spatial claim about a specific film in a specific plane. The
   question bank does not record it, and it is not something to infer from a
   structure's name: on one axial image the left ventricle is posterior, on a
   four-chamber view it is beside, and on a coronal it is below and left. A
   wrong line here is worse than no line at all, so this table SHIPS EMPTY and
   the Atlas simply omits the sentence until someone writes it.

   Add entries as you go. Nothing else has to change — the page picks them up.

       { on: 'thorax-p0012', target: 'right ventricle',
         neighbour: 'left ventricle',
         text: 'Posterior to the right ventricle on this image.' },

   `on`         the question id of the film. Omit it to state a relationship
                that holds on every film where the two appear together.
   `target`     structure key of the structure being studied (the page you
                are on).
   `neighbour`  structure key of the structure the line is about.
   `text`       one sentence. Two only if unavoidable. No physiology, no
                embryology, no pathology — just what helps you find the
                target on the film.

   Structure keys are the normalised word bags printed by
   `npm run atlas:report` (for example "right ventricle", "bronchus
   intermedius", "artery main pulmonary").
   =========================================================================== */

export interface AtlasRelationship {
  /** Question id of the film this holds on. Omitted = holds generally. */
  on?: string;
  /** Structure key of the page being viewed. */
  target: string;
  /** Structure key of the neighbouring structure. */
  neighbour: string;
  text: string;
}

export const RELATIONSHIPS: AtlasRelationship[] = [];

/* Indexed on first use. Film-specific text beats general text; nothing is
   returned when neither exists, which is the normal case. */
let index: Map<string, string> | null = null;

function build(): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of RELATIONSHIPS) {
    if (!r.text?.trim()) continue;
    // General first, then film-specific, so the specific one overwrites.
    if (!r.on) m.set(`*|${r.target}|${r.neighbour}`, r.text.trim());
  }
  for (const r of RELATIONSHIPS) {
    if (!r.text?.trim() || !r.on) continue;
    m.set(`${r.on}|${r.target}|${r.neighbour}`, r.text.trim());
  }
  return m;
}

export function relationshipFor(
  questionId: string,
  targetKey: string,
  neighbourKey: string
): string | null {
  if (!index) index = build();
  return (
    index.get(`${questionId}|${targetKey}|${neighbourKey}`) ??
    index.get(`*|${targetKey}|${neighbourKey}`) ??
    null
  );
}
