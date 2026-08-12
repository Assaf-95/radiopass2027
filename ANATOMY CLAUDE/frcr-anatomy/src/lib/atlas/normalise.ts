/* ===========================================================================
   Structure Atlas — turning an official answer into an atlas structure.

   The question bank is the source of truth. Every label on every question
   carries an `officialAnswer`, and that string — not the image, not a tag —
   is what the question is teaching. The Atlas groups those strings into
   structures, so the same anatomy written five different ways across five
   questions becomes ONE card with five images behind it.

   Three things are pulled OUT of the name and kept as per-image facts rather
   than as part of the structure's identity:

     - the vertebral level      "Vertebral body of C6"   -> level C6
     - the side                 "Right acromion process" -> side right
     - parenthetical asides     "Right atrium (right heart border)"

   Level always comes out: a candidate learns to recognise a pedicle, not a
   pedicle-of-L3, and the level is still printed under every image. Side comes
   out only where left and right are the same structure seen on two sides of
   the body — for cardiac chambers, bronchi, hepatic lobes and the rest, left
   and right name genuinely different things, so the side stays welded to the
   name. That decision is data, not code: see SIDE_IS_IDENTITY in
   ../../data/atlas/atlasOverrides.ts.

   Nothing here ever rewrites the question bank. The official answer is
   displayed verbatim under its own image; only the GROUPING is normalised.
   =========================================================================== */

export interface ParsedStructureName {
  /** Grouping key. Word-order independent, so "Spinous process of C4" and
   *  "C4 spinous process" land on the same structure. */
  key: string;
  /** What the card and the page are titled, before the group votes on a
   *  preferred spelling. Level and (where policy allows) side removed. */
  display: string;
  /** Alternative wordings harvested from the answer itself — the text in
   *  brackets, and whatever followed an "or" or a slash. */
  aliases: string[];
  /** Vertebral level named in the answer: "C6", "L4-L5", "L5-S1". */
  level: string | null;
  /** Side named anywhere in the answer, including inside brackets. */
  side: 'left' | 'right' | null;
  /** True when the side is part of `key` — i.e. left and right are being
   *  kept as two separate structures. */
  sideInKey: boolean;
}

/* --- Text tidying ---------------------------------------------------------
   The source PDFs use en dashes, curly quotes and non-breaking spaces
   interchangeably with their ASCII equivalents, so two spellings of the same
   answer differ by a character nobody can see. */

export function tidy(raw: string): string {
  return raw
    .replace(/[‐-―−]/g, '-')
    .replace(/[‘’ʼ′`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*\.\s*$/, '')
    .trim();
}

/* Vertebral levels are written "L3/4", "L3-4", "L3/L4", "L3 - L4" and
   "C 7". They all name the same level, and the slash forms have to be
   rewritten BEFORE anything splits on a slash or strips punctuation. */
function unifyLevels(s: string): string {
  return s
    .replace(/\b([CTLScts])\s*(\d{1,2})\s*[/-]\s*([CTLScts])\s*(\d{1,2})\b/g, (_m, a, b, c, d) =>
      `${String(a).toUpperCase()}${b}-${String(c).toUpperCase()}${d}`)
    .replace(/\b([CTLScts])\s*(\d{1,2})\s*[/-]\s*(\d{1,2})\b/g, (_m, a, b, c) =>
      `${String(a).toUpperCase()}${b}-${String(a).toUpperCase()}${c}`)
    .replace(/\b([CTLScts])\s+(\d{1,2})\b/g, (_m, a, b) => `${String(a).toUpperCase()}${b}`);
}

/** Text in brackets is never part of the structure's identity here. It is
 *  either an alternative name ("(or antrum)"), an abbreviation ("(DRUJ)"),
 *  a level ("(C2)"), a side ("(left)") or a clarifying aside ("(tip of)").
 *  All four are more useful as aliases and per-image facts than as part of
 *  the name, and leaving them in fragments the atlas. */
function splitParentheticals(s: string): { base: string; parts: string[] } {
  const parts: string[] = [];
  let base = s;
  /* Repeated rather than global, because the bank contains nested brackets
     — "(profunda femoris artery (PFA))" — and one global pass leaves the
     outer closing bracket stranded in the middle of the name. */
  for (let i = 0; i < 4; i++) {
    const next = base.replace(/\(([^()]*)\)/g, (_m, inner: string) => {
      const t = tidy(inner);
      if (t) parts.push(t);
      return ' ';
    });
    if (next === base) break;
    base = next;
  }
  // An unmatched bracket left by a malformed source line.
  base = base.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  // "(nucleus pulposus)" on its own would leave nothing behind.
  if (!base && parts.length) return { base: parts[0], parts: parts.slice(1) };
  return { base, parts: parts.map((p) => p.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim()) };
}

/** "Sella turcica or pituitary fossa" is one structure with two names. The
 *  first is taken as the name and the rest become aliases; a later pass
 *  merges two structures that name each other. */
function splitAlternatives(s: string): { base: string; alts: string[] } {
  const alts: string[] = [];
  let base = s;

  const orParts = base.split(/\s+or\s+/i);
  if (orParts.length > 1) {
    base = orParts[0].trim();
    for (const p of orParts.slice(1)) if (p.trim()) alts.push(p.trim());
  }

  /* A slash after level-unification is an author writing two names for the
     same label — "Lateral malleolus/distal fibula", "Azygos lobe/fissure".
     Taking the first and keeping the rest as aliases is what lets that
     image join the "Lateral malleolus" page instead of sitting alone. */
  const slashParts = base.split('/');
  if (slashParts.length > 1 && slashParts[0].trim().length > 2) {
    base = slashParts[0].trim();
    for (const p of slashParts.slice(1)) if (p.trim()) alts.push(p.trim());
  }

  return { base: base.trim(), alts };
}

const SIDE_RE = /\b(right|left)\b/i;

function findSide(s: string): 'left' | 'right' | null {
  const m = s.match(SIDE_RE);
  return m ? (m[1].toLowerCase() as 'left' | 'right') : null;
}

/** Removes every laterality word and tidies the wreckage: "of the left
 *  scapula" -> "of scapula", "Right shaft of humerus" -> "Shaft of humerus". */
function dropSide(s: string): string {
  return cleanupDanglers(s.replace(/\b(right|left)\b/gi, ' '));
}

const LEVEL_RE = /\b([CTLS])(\d{1,2})(?:-([CTLS])?(\d{1,2}))?\b/;

/** Pulls a vertebral level out of an already level-unified string. C1 and C2
 *  are deliberately left alone: they are named as the atlas and the axis and
 *  behave as proper nouns rather than as a level qualifier. */
function extractLevel(s: string): { core: string; level: string | null } {
  /* Two levels in one answer means the name is ABOUT the pair — "Facet joint
     between L3 and L4" — and taking one out leaves nonsense. Left whole. */
  if ((s.match(new RegExp(LEVEL_RE.source, 'g')) ?? []).length > 1) {
    return { core: s, level: null };
  }
  const m = s.match(LEVEL_RE);
  if (!m || m.index === undefined) return { core: s, level: null };
  const single = !m[4];
  if (single && m[1] === 'C' && (m[2] === '1' || m[2] === '2')) return { core: s, level: null };
  const level = single ? `${m[1]}${m[2]}` : `${m[1]}${m[2]}-${m[3] ?? m[1]}${m[4]}`;
  const core = cleanupDanglers(s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length));
  return { core, level };
}

/** Removes the prepositions and articles left hanging when a level or a side
 *  is lifted out of the middle of a phrase — "Pedicle of L3" without its
 *  level is "Pedicle", not "Pedicle of". Deliberately narrow: it only ever
 *  collapses a doubled connective or trims one off an end, so a legitimate
 *  "of the" in the middle of a name survives untouched. */
function cleanupDanglers(s: string): string {
  let t = s.replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim();
  t = t.replace(/\b(of|at|in|on)\s+(of|at|in|on)\b/gi, '$2');
  t = t.replace(/\bthe\s+the\b/gi, 'the');
  t = t.replace(/\b(of|at|in|on)\s+the\s+(of|at|in|on)\b/gi, '$2');
  t = t.replace(/[\s,]*\b(of the|of|at|in|on|the|and)\s*$/i, '');
  t = t.replace(/^\s*\b(of the|of|at|in|on|the|a|an|and)\b\s*/i, '');
  return t.replace(/\s+/g, ' ').trim();
}

/* --- Key construction ---------------------------------------------------- */

/* British/American and Latin/English spellings that appear on both sides of
   the same structure across the bank. Applied to the KEY only; the official
   answer keeps whatever the author wrote. */
const SPELLING: [RegExp, string][] = [
  [/oesophag/g, 'esophag'],
  [/foetal/g, 'fetal'],
  [/haemat/g, 'hemat'],
  [/haemo/g, 'hemo'],
  [/colour/g, 'color'],
  [/fibre/g, 'fiber'],
  [/centre/g, 'center'],
  [/\bgrey\b/g, 'gray'],
  [/isation\b/g, 'ization'],
  [/\bmusculus\b/g, 'muscle'],
  [/zygapophysial/g, 'zygapophyseal'],
  [/apophysial/g, 'apophyseal'],
];

/* Spellings that are simply wrong in one or two source pages and correct
   everywhere else. Left in the question data (changing an author's wording
   is not this feature's business) and folded together here so the atlas does
   not carry the same structure twice under a typo. */
const MISSPELLINGS: Record<string, string> = {
  intermedious: 'intermedius',
  supraspinatous: 'supraspinatus',
  infraspinatous: 'infraspinatus',
  subscapularus: 'subscapularis',
  fibrosis: 'fibrosus', // only ever seen as "annulus fibrosis"
  anulus: 'annulus',
  vertebrae: 'vertebra',
  odontiod: 'odontoid',
  calcaneum: 'calcaneus',
  acromium: 'acromion',
  abdominus: 'abdominis',
  pheripheral: 'peripheral',
  pinnae: 'pinna',
  infrapinatus: 'infraspinatus',
  gali: 'galli',
};

/* Words that name the CLASS a structure belongs to rather than the structure
   itself. Once something is already specific — acromion, navicular, pedicle —
   adding "process", "bone" or "vertebra" says nothing new, and the bank
   writes it both ways on different pages.

   These are NOT stripped out of the key. Stripping them here looked tidy and
   was wrong: "frontal process of zygoma" reduced to "frontal", which is the
   frontal BONE, and two unrelated structures merged. They are absorbed in
   build.ts instead, where the whole chapter is visible and a merge can be
   refused when something else already reduces to the same name. */
export const NEUTRAL_WORDS = new Set([
  'bone', 'process', 'vertebra', 'gland', 'tooth',
]);

/* Words that carry no anatomical meaning on their own, so word order and
   connectives cannot split one structure into two. */
const STOP_WORDS = new Set([
  'of', 'the', 'a', 'an', 'and', 'to', 'in', 'at', 'on', 'within', 'into',
  'from', 'with', 'its', 'this', 'view',
]);

/* Alternative names that share no words, so nothing shorter than a phrase
   table can bring them together. Kept deliberately small: every entry is a
   claim that two names mean the same structure. */
const PHRASE_SYNONYMS: [RegExp, string][] = [
  [/\bcollar ?bone\b/g, 'clavicle'],
  [/\bknee ?cap\b/g, 'patella'],
  [/\bshoulder ?blade\b/g, 'scapula'],
  [/\btail ?bone\b/g, 'coccyx'],
  [/\bheel ?bone\b/g, 'calcaneus'],
  [/\bbreast ?bone\b/g, 'sternum'],
  [/\bshin ?bone\b/g, 'tibia'],
  [/\bthigh ?bone\b/g, 'femur'],
  [/\bjaw ?bone\b/g, 'mandible'],
  [/\bwindpipe\b/g, 'trachea'],
  [/\bvoice box\b/g, 'larynx'],
  [/\bgall bladder\b/g, 'gallbladder'],
  [/\bsacro ?iliac\b/g, 'sacroiliac'],
  [/\bos calcis\b/g, 'calcaneus'],
  /* Compound joint and vessel adjectives, which the bank hyphenates on some
     pages and not others. A hyphen reads as a space here, so without these
     "acromio-clavicular joint" and "acromioclavicular joint" would be two
     structures. */
  [/\bacromio clavicular\b/g, 'acromioclavicular'],
  [/\bsterno clavicular\b/g, 'sternoclavicular'],
  [/\bcoraco clavicular\b/g, 'coracoclavicular'],
  [/\bcoraco acromial\b/g, 'coracoacromial'],
  [/\bgleno humeral\b/g, 'glenohumeral'],
  [/\bradio ulnar\b/g, 'radioulnar'],
  [/\bcarpo metacarpal\b/g, 'carpometacarpal'],
  [/\bmetacarpo phalangeal\b/g, 'metacarpophalangeal'],
  [/\bmetatarso phalangeal\b/g, 'metatarsophalangeal'],
  [/\binter phalangeal\b/g, 'interphalangeal'],
  [/\binter tubercular\b/g, 'intertubercular'],
  [/\bcosto vertebral\b/g, 'costovertebral'],
  [/\bcosto transverse\b/g, 'costotransverse'],
  [/\batlanto axial\b/g, 'atlantoaxial'],
  [/\batlanto occipital\b/g, 'atlantooccipital'],
  [/\btemporo mandibular\b/g, 'temporomandibular'],
  [/\btibio fibular\b/g, 'tibiofibular'],
  [/\btalo navicular\b/g, 'talonavicular'],
  [/\bcalcaneo cuboid\b/g, 'calcaneocuboid'],
  [/\bilio pectineal\b/g, 'iliopectineal'],
  [/\bilio ischial\b/g, 'ilioischial'],
  [/\bischio pubic\b/g, 'ischiopubic'],
  [/\bsacro coccygeal\b/g, 'sacrococcygeal'],
  [/\bunco vertebral\b/g, 'uncovertebral'],
  [/\btri radiate\b/g, 'triradiate'],
  [/\bintra hepatic\b/g, 'intrahepatic'],
  [/\bfronto zygomatic\b/g, 'frontozygomatic'],
  [/\bzygomatico ?frontal\b/g, 'frontozygomatic'],
  [/\bocciput ?mastoid\b|\boccipito mastoid\b/g, 'occipitomastoid'],
  [/\btemporo parietal\b/g, 'temporoparietal'],
  [/\btemporosquamal\b/g, 'temporoparietal'],
  [/\bsquamosal suture\b|\bsquamous suture\b/g, 'temporoparietal suture'],
  /* The maxillary antrum is the maxillary sinus, and the ethmoidal air cells
     are the ethmoid sinus. Both pairs appear on neighbouring pages. */
  [/\bmaxillary antrum\b/g, 'maxillary sinus'],
  [/\bethmoidal?\s+air\s+cells?\b/g, 'ethmoid sinus'],
  [/\bethmoidal sinus\b/g, 'ethmoid sinus'],
  /* One meatus, four spellings. */
  [/\bexternal auditory (meatus|canal)\b/g, 'external acoustic meatus'],
  [/\bexternal acoustic canal\b/g, 'external acoustic meatus'],
  [/\bsternomastoid\b/g, 'sternocleidomastoid'],
  [/\bhemi ?mandible\b/g, 'mandible'],
  /* The superior articular FACET is the superior articular PROCESS; the bank
     uses both on facing pages. Scoped to "articular" so a plain facet joint
     is untouched. */
  [/\barticular facets?\b/g, 'articular process'],
  /* The fibular artery, vein and nerve are the peroneal ones. Written out in
     full rather than as a bare "peroneal -> fibular" word rule, because the
     peroneal TUBERCLE is on the calcaneus and has nothing to do with the
     fibula. */
  [/\bperoneal artery\b/g, 'fibular artery'],
  [/\bperoneal vein\b/g, 'fibular vein'],
  [/\bperoneal nerve\b/g, 'fibular nerve'],
  [/\baorto ?pulmonary\b/g, 'aortopulmonary'],
  [/\baortopulmonary window\b/g, 'aortopulmonary angle'],
  [/\bhemi ?diaphragm\b/g, 'hemidiaphragm'],
  [/\bdome of (the )?diaphragm\b/g, 'hemidiaphragm'],
  [/\bazygous\b/g, 'azygos'],
  [/\bodontoid peg\b/g, 'odontoid process'],
  [/\bdens\b/g, 'odontoid process'],
  [/\bsella turcica\b/g, 'pituitary fossa'],
  [/\bcircle of willis\b/g, 'cerebral arterial circle'],
  [/\bpouch of douglas\b/g, 'rectouterine pouch'],
  [/\bpouch of morrison\b/g, 'hepatorenal recess'],
  [/\bmorrisons pouch\b/g, 'hepatorenal recess'],
  [/\bampulla of vater\b/g, 'hepatopancreatic ampulla'],
  [/\bduct of wirsung\b/g, 'main pancreatic duct'],
  [/\bduct of santorini\b/g, 'accessory pancreatic duct'],
];

/* Latin/English and adjective/noun forms of the same word. Same rule as
   above: each line asserts an identity, so the list stays conservative. */
const WORD_SYNONYMS: Record<string, string> = {
  c1: 'atlas',
  c2: 'axis',
  renal: 'kidney',
  radial: 'radius',
  ulnar: 'ulna',
  humeral: 'humerus',
  femoral: 'femur',
  tibial: 'tibia',
  fibular: 'fibula',
  patellar: 'patella',
  clavicular: 'clavicle',
  scapular: 'scapula',
  sternal: 'sternum',
  sacral: 'sacrum',
  vertebral: 'vertebra',
  ethmoidal: 'ethmoid',
  auditory: 'acoustic',
  mandibular: 'mandible',
  ischial: 'ischium',
  pubic: 'pubis',
  teeth: 'tooth',
  /* Safe here only because the peroneal artery, vein and nerve have already
     been rewritten to their fibular names by the phrase table above; what is
     left is muscle and tendon naming, where the two forms are the same. */
  peroneal: 'peroneus',
  // Two spellings of the lateral condyle of the humerus, both in use.
  capitellum: 'capitulum',
  aortic: 'aorta',
  atrial: 'atrium',
  ventricular: 'ventricle',
  zygomatic: 'zygoma',
  zygapophyseal: 'facet',
  apophyseal: 'facet',
  cardiac: 'heart',
  hepatic: 'liver',
  gastric: 'stomach',
  splenic: 'spleen',
};

const ORDINAL_WORDS: Record<string, string> = {
  first: '1', second: '2', third: '3', fourth: '4', fifth: '5', sixth: '6',
  seventh: '7', eighth: '8', ninth: '9', tenth: '10', eleventh: '11',
  twelfth: '12',
};

/* Nouns that end in "s" in the singular. Without them "atlas" becomes
   "atla" and stops matching the C1 synonym. */
const SINGULAR_S = new Set([
  'atlas', 'pancreas', 'psoas', 'iliopsoas', 'glans', 'anus', 'corpus', 'fundus',
  'uterus', 'rectus', 'sinus', 'meniscus', 'humerus', 'radius', 'esophagus',
  'bronchus', 'plexus', 'thymus', 'ramus', 'nucleus', 'ductus', 'processus',
  'annulus', 'discus', 'calcaneus', 'talus', 'pulposus', 'fibrosus', 'vastus',
  'achilles', 'azygos',
  'longus', 'brevis', 'digitorum', 'pollicis', 'hallucis', 'as', 'os',
]);

function depluralize(w: string): string {
  if (w.length <= 4 || SINGULAR_S.has(w)) return w;
  if (/(us|is|ss|sis)$/.test(w)) return w;
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (/(ch|sh|x|z)es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s')) return w.slice(0, -1);
  return w;
}

function normaliseOrdinal(w: string): string {
  if (ORDINAL_WORDS[w]) return ORDINAL_WORDS[w];
  const m = w.match(/^(\d{1,2})(st|nd|rd|th)$/);
  return m ? m[1] : w;
}

/** The grouping key: a sorted bag of normalised words. Sorted so word order
 *  never splits a structure, and normalised so spelling never does either. */
export function structureKey(name: string): string {
  let t = name.toLowerCase();
  t = t.replace(/['’`]/g, '').replace(/[-–—]/g, ' ').replace(/[.,;:()"/]/g, ' ');
  for (const [re, rep] of SPELLING) t = t.replace(re, rep);
  for (const [re, rep] of PHRASE_SYNONYMS) t = t.replace(re, rep);
  const words = t
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => MISSPELLINGS[w] ?? w)
    .filter((w) => !STOP_WORDS.has(w))
    .map(depluralize)
    .map(normaliseOrdinal)
    .map((w) => WORD_SYNONYMS[w] ?? w)
    .filter(Boolean);

  return words.sort().join(' ');
}

/* A key of one generic word names a category, not a structure. Stripping a
   side or a level down to one of these would pool genuinely different
   anatomy — "Left ventricle" and "Right ventricle" both reduce to
   "ventricle" — so when that happens the qualifier is put back. */
const CATEGORY_WORDS = new Set([
  'bone', 'joint', 'muscle', 'artery', 'vein', 'nerve', 'ligament', 'tendon',
  'organ', 'structure', 'process', 'vessel', 'duct', 'gland', 'sinus', 'lobe',
  'ventricle', 'atrium', 'chamber', 'space', 'cavity', 'fossa', 'foramen',
  'canal', 'sulcus', 'gyrus', 'fissure', 'membrane', 'cartilage', 'disc',
  'vertebra', 'rib', 'node', 'cortex', 'lung', 'kidney', 'hemidiaphragm',
  'hilum', 'bronchus', 'ureter', 'ovary', 'testis', 'horn', 'crus', 'wall',
  'border', 'margin', 'angle', 'recess', 'pouch', 'plate', 'physis', 'apex',
  'root', 'trunk', 'branch', 'ramus', 'body', 'head', 'neck', 'base', 'shaft',
]);

export function isCategoryOnly(key: string): boolean {
  const words = key.split(' ').filter(Boolean);
  return words.length === 0 || (words.length === 1 && CATEGORY_WORDS.has(words[0]));
}

/* --- Absorbable qualifiers ------------------------------------------------
   "Greater trochanter of the femur" and "Greater trochanter" are one
   structure; so are "Acromion of scapula" and "Acromion process". The word
   that separates them names the PARENT the landmark sits on, and once the
   landmark is unambiguous the parent adds nothing.

   Absorbing it is only safe when nothing else could reduce to the same
   name — the coronoid process of the ulna and of the mandible must never
   pool — so the decision is taken in build.ts, over the whole chapter, and
   these sets only say which words are candidates. */
export const PARENT_BONES = new Set([
  'scapula', 'humerus', 'radius', 'ulna', 'femur', 'tibia', 'fibula',
  'clavicle', 'sternum', 'mandible', 'maxilla', 'zygoma', 'skull', 'atlas',
  'axis', 'ilium', 'ischium', 'pubis', 'sacrum', 'coccyx', 'patella',
  'calcaneus', 'talus', 'acetabulum', 'carpus', 'tarsus', 'temporal',
  'sphenoid', 'hyoid', 'occipital', 'parietal', 'frontal', 'ethmoid',
  'pancreas', 'liver', 'kidney', 'spleen', 'stomach', 'thyroid',
]);

/** A body region rather than a bone. Naming one never distinguishes two
 *  different structures — "glenoid of the shoulder" and "glenoid of the
 *  scapula" are the same surface — so a region can be absorbed even when a
 *  bone has already been absorbed into the same name. */
export const REGION_PARENTS = new Set([
  'hip', 'knee', 'shoulder', 'ankle', 'wrist', 'elbow', 'foot', 'hand',
  'pelvis', 'thorax', 'chest', 'abdomen', 'forearm', 'arm', 'leg', 'thigh',
]);

export const PARENT_WORDS = new Set([...PARENT_BONES, ...REGION_PARENTS]);

/** Tissue nouns that name what a structure is made of rather than which
 *  structure it is. Absorbed under the same whole-chapter guard as the
 *  parents above, and never when the shortened name is itself a bone or an
 *  organ — "Femoral artery" must not collapse onto "Femur". */
export const TISSUE_WORDS = new Set([
  'artery', 'vein', 'nerve', 'tendon', 'ligament', 'duct', 'muscle', 'joint',
]);

/** Every word that may be absorbed. The neutral ones are absorbed freely;
 *  a bone or a tissue word is absorbed only when nothing else with a
 *  different bone or tissue reduces to the same name. */
export const ABSORBABLE_WORDS = new Set([
  ...NEUTRAL_WORDS,
  ...PARENT_BONES,
  ...REGION_PARENTS,
  ...TISSUE_WORDS,
]);

/** A word that, when absorbed, cannot change WHICH structure is meant. A
 *  body region never distinguishes two structures, and neither does the
 *  word "process". A bone or a tissue can, and does. */
export function isNeutralAbsorbable(word: string): boolean {
  return NEUTRAL_WORDS.has(word) || REGION_PARENTS.has(word);
}

/** An answer that gives a measurement or an age rather than naming anatomy.
 *  A handful of questions ask for a normal calibre, or for the age a
 *  physis fuses; the answer is a fact about a structure, not a structure,
 *  and it has no place as an Atlas card. */
export function isMeasurementAnswer(raw: string): boolean {
  return /^[\d.\s–-]+(mm|cm|m|degrees?|°|%|years?|months?|weeks?|days?)\b/i.test(tidy(raw));
}

function sentenceCase(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

export interface ParseOptions {
  /** Asked once the side-free core is known: should left and right stay as
   *  two separate structures? */
  sideIsIdentity(coreKey: string): boolean;
}

/**
 * Parses one official answer into the structure it teaches.
 *
 * Deliberately total: every answer produces a structure, because every
 * answer IS a labelled structure on a real film. Nothing is dropped for
 * being unparseable.
 */
export function parseStructureName(raw: string, opts: ParseOptions): ParsedStructureName {
  const tidied = unifyLevels(tidy(raw));
  const { base: withoutParens, parts: parenAliases } = splitParentheticals(tidied);
  const { base: headName, alts } = splitAlternatives(withoutParens);

  // The side may be written inside the brackets ("Neck of the rib (left)"),
  // so it is looked for in the whole answer rather than in the head alone.
  const side = findSide(tidied);

  /* The level comes out of the name — a candidate learns to recognise a
     pedicle, not a pedicle-of-L3 — unless taking it out leaves a bare
     category word. "L5/S1 joint" without its level is "joint", which names
     nothing, so there the level stays and only gets reported alongside. */
  const extracted = extractLevel(headName);
  const level = extracted.level;
  const keepLevelInName =
    level !== null && isCategoryOnly(structureKey(dropSide(extracted.core)));
  const nameCore = keepLevelInName ? headName : extracted.core;

  const sideFree = dropSide(nameCore);

  const sideFreeKey = structureKey(sideFree);
  const withSideKey = structureKey(nameCore);

  /* Two independent reasons to keep the side: the anatomy says left and
     right are different structures, or dropping it would leave a bare
     category word that means nothing on its own. */
  const sideInKey =
    side !== null && (opts.sideIsIdentity(sideFreeKey) || isCategoryOnly(sideFreeKey));

  const key = sideInKey ? withSideKey : sideFreeKey;
  const displayRaw = sideInKey ? nameCore : sideFree;

  /* Falling all the way through to nothing means the answer was only a level
     or only a side — keep the tidied original rather than show a blank. */
  const display = sentenceCase(cleanupDanglers(displayRaw) || tidied);

  /* A bracketed aside is only an alias when it names something. "(tip of)",
     "(end on)" and a bare "(left)" describe the pointer, not the anatomy. */
  const aliases = [...parenAliases, ...alts]
    .map(tidy)
    .filter(
      (a) =>
        a.length > 1 &&
        !/^(or\b|tip of$|end on$|left$|right$|anterior$|posterior$|superior$|inferior$|medial$|lateral$|of\b)/i.test(a)
    );

  return { key: key || structureKey(tidied), display, aliases, level, side, sideInKey };
}

/** URL slug for a structure. Stable across rebuilds because it is derived
 *  from the display name, which is itself chosen deterministically. */
export function slugify(name: string): string {
  return tidy(name)
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'structure';
}
