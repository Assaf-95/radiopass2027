/* ===========================================================================
   Structure Atlas — the hand-editable layer.

   Everything the Atlas shows is derived automatically from the question bank.
   This file is where a human overrules that derivation, and it is the ONLY
   file that needs editing to do so. Nothing here is required: with every
   list below empty the Atlas still builds, it is just less tidy.

   Add a new anatomy question to the bank and its structures appear on their
   own. Come back here only when the automatic result is wrong.
   =========================================================================== */

/* --- 1. Left and right: same structure, or two structures? ----------------

   "Right acromion process" and "Left acromion process" are one structure
   photographed on two sides of one body, so the Atlas pools them under
   "Acromion process" and prints the side under each image.

   "Left main bronchus" and "Right main bronchus" are NOT one structure, and
   neither are the cardiac chambers, the lung lobes or the hepatic veins.
   Pooling those would be an anatomical error, so the side stays welded to
   the name.

   The rule below is stated in normalised words (lower case, singular, word
   order irrelevant, adjectives resolved to their noun — "renal" is "kidney",
   "hepatic" is "liver", "cardiac" is "heart"). If ANY word of a structure's
   name appears in this set, its left and right stay apart. */
export const SIDE_IS_IDENTITY_WORDS = new Set<string>([
  // Heart and its chambers.
  'ventricle', 'ventricular', 'atrium', 'atrial', 'appendage', 'auricle', 'heart',
  // Airway and lung. Left and right differ in length, angle and lobes, and
  // the exam turns on exactly that difference.
  'bronchus', 'bronchial', 'lung', 'pulmonary', 'hilum', 'hilar',
  // Great vessels. A right-sided arch is a different finding, not a side.
  'aorta', 'aortic', 'brachiocephalic',
  // Diaphragm: the right sits higher because the liver is under it.
  'diaphragm', 'hemidiaphragm',
  // Abdominal viscera and their pedicles.
  'liver', 'kidney', 'portal', 'adrenal', 'suprarenal',
]);

/** Exact structure keys — the sorted, normalised word bag — whose sides must
 *  stay apart even though no word above applies. Use when the word rule is
 *  too blunt. */
export const SIDE_IS_IDENTITY_KEYS = new Set<string>([]);

/** The reverse: keys the word rule splits that should in fact be pooled.
 *  Takes priority over both sets above. */
export const SIDE_IS_QUALIFIER_KEYS = new Set<string>([]);

/* --- 2. Structures the automatic grouping keeps apart ---------------------

   Each entry merges the SECOND key into the FIRST. Keys are the normalised
   word bags shown by `npm run atlas:report`, which is the quickest way to
   find the exact string to write here.

   Only for genuine duplicates. Two structures that are merely adjacent, or
   that share a parent bone, must stay separate. */
export const MERGE_KEYS: [canonical: string, mergedIn: string][] = [
  // "Psoas" and "Psoas major" name the same muscle on these films; the bank
  // writes it both ways on neighbouring pages.
  ['psoas', 'major muscle psoas'],
];

/* --- 2b. Entities that must NOT swallow their parts -----------------------

   The Atlas groups by entity: every aorta under Aorta, every carotid under
   Carotid artery, every part of the humerus under Humerus. Name a family here
   to stop that happening for it, and its parts stay as separate cards.

   Written as the family key — the entity's own words, which is what
   `npm run atlas:report` prints. For example 'ventricle' would keep the left
   and right ventricle apart. */
export const KEEP_SEPARATE_FAMILIES = new Set<string>([]);

/* --- 3. Preferred names ---------------------------------------------------

   By default the Atlas titles a structure with the wording used by the most
   questions, which keeps the vocabulary the owner's own. Override it here
   when the majority spelling is not the one you want on the card.

   Keyed by structure key. */
export const NAME_OVERRIDES: Record<string, string> = {};

/* --- 4. Extra aliases -----------------------------------------------------

   Aliases feed search, so "RV" finds the right ventricle even though no
   question ever writes it that way. The Atlas already harvests aliases from
   the answers themselves — bracketed asides, and anything after "or" — so
   this is only for words the bank never uses.

   Keyed by structure key. */
export const EXTRA_ALIASES: Record<string, string[]> = {
  'right ventricle': ['RV'],
  'left ventricle': ['LV'],
  'right atrium': ['RA'],
  'left atrium': ['LA'],
  'cava inferior vena': ['IVC'],
  'cava superior vena': ['SVC'],
  'bile common duct': ['CBD'],
  'artery mesenteric superior': ['SMA'],
  'artery carotid internal': ['ICA'],
  'artery carotid external': ['ECA'],
  'artery carotid common': ['CCA'],
};

/* --- 5. Which image represents a structure on its chapter card ------------

   Left alone, the Atlas picks the image whose question teaches the fewest
   other structures — the least cluttered film showing this anatomy. Name an
   image explicitly to override that.

   Keyed by structure key; the value is an image id, which is the question id
   and the label letter joined by a colon, e.g. "thorax-p0012:B". Every image
   id is printed by `npm run atlas:report`. */
export const REPRESENTATIVE_IMAGES: Record<string, string> = {};

/* --- 6. Optional teaching, per structure ----------------------------------

   All four fields are optional and all four are blank by default. NOTHING is
   generated for them: an empty field means nobody has written it yet, which
   is a true statement, whereas a plausible-sounding invented one is not.

   `keyRecognitionFeature` is the exception — where the question bank already
   carries a recognition cue for a structure (src/data/structureCues.json,
   used by the marking engine), the Atlas shows that cue automatically. Text
   written here wins over it.

   Keyed by structure key. */
export interface StructureNotes {
  description?: string;
  keyRecognitionFeature?: string;
  commonPitfall?: string;
  examTip?: string;
}

export const STRUCTURE_NOTES: Record<string, StructureNotes> = {};
