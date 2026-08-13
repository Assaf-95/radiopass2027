import type { AnswerSpec, GradedAnswer, LabelResult } from '../types';
// Recognition cues live in data, not code: the set is large, grows with the
// question bank, and is reviewed as content rather than as logic. Keys are
// natural-language structure names; they are canonicalised at load below.
import structureCuesRaw from '../data/structureCues.json';

// Common British/American spelling + abbreviation equivalences used across
// radiology anatomy answers. Applied during normalization only — the
// officially displayed answer text is never altered.
const SPELLING_NORMALIZATIONS: [RegExp, string][] = [
  [/oesophag/g, 'esophag'],
  [/foetal/g, 'fetal'],
  [/haemat/g, 'hemat'],
  [/haemo/g, 'hemo'],
  [/anaesthe/g, 'anesthe'],
  [/colour/g, 'color'],
  [/fibre/g, 'fiber'],
  [/centre/g, 'center'],
  [/ise\b/g, 'ize'],
  [/isation/g, 'ization'],
  [/musculus /g, 'muscle '],
];

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bivc\b/g, 'inferior vena cava'],
  [/\bsvc\b/g, 'superior vena cava'],
  [/\bacl\b/g, 'anterior cruciate ligament'],
  [/\bpcl\b/g, 'posterior cruciate ligament'],
  [/\bmcl\b/g, 'medial collateral ligament'],
  [/\blcl\b/g, 'lateral collateral ligament'],
  [/\bcbd\b/g, 'common bile duct'],
  [/\bchd\b/g, 'common hepatic duct'],
  [/\bpv\b/g, 'portal vein'],
  [/\bgb\b/g, 'gallbladder'],
  [/\bgall bladder\b/g, 'gallbladder'],
  [/\bpuj\b/g, 'pelviureteric junction'],
  // Single-letter Latin-style abbreviations (a. = artery, v. = vein, etc.) —
  // only match when the letter is a standalone token (not the start of a
  // longer word like "anterior"), using a negative lookahead.
  [/\ba(?![a-z])\.?\s*/g, 'artery '],
  [/\bv(?![a-z])\.?\s*/g, 'vein '],
  [/\bm(?![a-z])\.?\s*/g, 'muscle '],
  [/\bn(?![a-z])\.?\s*/g, 'nerve '],
  [/\blig\.?\b/g, 'ligament'],
  [/\bproc\.?\b/g, 'process'],
  // Standard, unambiguous joint/structure abbreviations. Written with the
  // word "joint" optional so both "AC" and "AC joint" expand correctly.
  [/\bac(\s+joint)?\b/g, 'acromioclavicular joint'],
  [/\bsc(\s+joint)?\b/g, 'sternoclavicular joint'],
  [/\btmj\b/g, 'temporomandibular joint'],
  [/\bdip(\s+joint)?\b/g, 'distal interphalangeal joint'],
  [/\bpip(\s+joint)?\b/g, 'proximal interphalangeal joint'],
  [/\bmcp(\s+joint)?\b/g, 'metacarpophalangeal joint'],
  [/\bmtp(\s+joint)?\b/g, 'metatarsophalangeal joint'],
  [/\bsij\b/g, 'sacroiliac joint'],
  [/\bica\b/g, 'internal carotid artery'],
  [/\beca\b/g, 'external carotid artery'],
  [/\bcca\b/g, 'common carotid artery'],
  [/\bsma\b/g, 'superior mesenteric artery'],
  [/\bmca\b/g, 'middle cerebral artery'],
  [/\baca\b/g, 'anterior cerebral artery'],
  [/\bpca\b/g, 'posterior cerebral artery'],
  [/\blad\b/g, 'left anterior descending artery'],
];

// Abbreviations whose meaning depends on the region being imaged — "LLL" is
// the left lobe of the liver in the abdomen but the left lower lobe in the
// chest. Each expands to SEVERAL candidate readings; the answer is credited
// if any one of them matches that question's official answer, so context
// resolves the ambiguity without the grader having to know the region.
const AMBIGUOUS_ABBREVIATIONS: Record<string, string[]> = {
  lll: ['left lobe of liver', 'left lower lobe'],
  rll: ['right lobe of liver', 'right lower lobe'],
  lul: ['left upper lobe'],
  rul: ['right upper lobe'],
  rml: ['right middle lobe'],
  ha: ['hepatic artery'],
  sma: ['superior mesenteric artery'],
  imа: ['inferior mesenteric artery'],
  ivc: ['inferior vena cava'],
  svc: ['superior vena cava'],
  cbd: ['common bile duct'],
  gb: ['gallbladder'],
  pv: ['portal vein'],
};

// Answers so generic they don't identify the labelled structure at all.
// A bare category noun is not a partial answer — it's no answer, so these
// are rejected outright rather than being allowed to reach the
// superset/qualifier logic (where "bone" would otherwise look like a
// harmless dropped word against "collar bone").
const VAGUE_ANSWERS = new Set([
  'bone', 'joint', 'muscle', 'artery', 'vein', 'nerve', 'ligament', 'tendon',
  'organ', 'structure', 'process', 'vessel', 'duct', 'gland', 'sinus', 'lobe',
  'ventricle', 'atrium', 'chamber', 'space', 'cavity', 'fossa', 'foramen',
  'canal', 'sulcus', 'gyrus', 'fissure', 'membrane', 'cartilage', 'disc',
  'vertebra', 'rib', 'node', 'cortex',
]);

// Structure names that are genuinely different but sit within one typo of
// each other (or are routinely confused). Fuzzy matching must never bridge
// these — checked before any tolerance is applied, in canonical form.
/* Any two DISTINCT words from this set contradict each other. Listing only
   the obvious opposites was not enough: "inferior" and "anterior" differ by
   two edits, which is inside the ordinary typo budget for an eight-letter
   word, so "left anterior inferior iliac spine" scored full marks against the
   anterior SUPERIOR iliac spine. */
const DIRECTIONAL_CLASS: Record<string, string> = {
  // Words in the same class name the SAME direction (ventral IS anterior);
  // words in different classes contradict. This is what lets "dorsal"
  // satisfy "posterior" while still zeroing "anterior" against it.
  anterior: 'ant', ventral: 'ant',
  posterior: 'post', dorsal: 'post',
  superior: 'sup', cranial: 'sup', cephalad: 'sup',
  inferior: 'inf', caudal: 'inf',
  medial: 'med', lateral: 'lat',
  proximal: 'prox', distal: 'dist',
  internal: 'int', external: 'ext',
  superficial: 'sfc', deep: 'deep',
};

const NEVER_CONFLATE: [string, string][] = [
  // Directional/comparative modifiers. These flip which structure is meant,
  // yet several are only 1-2 edits apart ("internal"/"external"), so typo
  // tolerance must never bridge them.
  ['internal', 'external'],
  ['superior', 'inferior'],
  ['anterior', 'posterior'],
  ['medial', 'lateral'],
  ['proximal', 'distal'],
  ['greater', 'lesser'],
  ['superficial', 'deep'],
  ['ascending', 'descending'],
  ['afferent', 'efferent'],
  ['dorsal', 'ventral'],
  ['cranial', 'caudal'],
  ['major', 'minor'],
  ['flexor', 'extensor'],
  ['muscle', 'tendon'],
  ['artery', 'vein'],
  ['long', 'short'],
  ['abductor', 'adductor'],
  // Naming tiers: the common and proper hepatic arteries are different
  // vessels, so one must never be accepted for the other.
  ['common', 'proper'],
  // A hand answer must never satisfy a foot question, or vice versa.
  ['toe', 'finger'],
  ['metacarpal', 'metatarsal'],
  ['hand', 'foot'],
  ['left', 'right'],
  // Confusable structure names.
  ['ilium', 'ileum'],
  ['ureter', 'urethra'],
  ['peroneal', 'perineal'],
  ['malleolus', 'malleus'],
  ['fibula', 'tibia'],
  ['radius', 'ulna'],
  ['carpal', 'tarsal'],
  ['metacarpal', 'metatarsal'],
  ['duodenum', 'jejunum'],
  ['ischium', 'ilium'],
  ['sacrum', 'scapula'],
  ['trachea', 'esophagus'],
  // Growth-plate anatomy. "epiphysis" and "metaphysis" are three edits apart
  // in ten characters — inside the ordinary budget — yet they are different
  // parts of the bone and the whole point of a paediatric bone question.
  ['epiphysis', 'metaphysis'],
  ['epiphysis', 'diaphysis'],
  ['metaphysis', 'diaphysis'],
  ['epiphyseal', 'metaphyseal'],
  ['epiphyseal', 'diaphyseal'],
  ['metaphyseal', 'diaphyseal'],
  // One edit apart, and both are bones seen on the same lateral knee.
  ['fabella', 'patella'],
  // Three edits apart, and a carpal bone must never satisfy a hip muscle.
  ['pisiform', 'piriformis'],
  // "brachii" is within the typo budget of "brachialis", which let biceps
  // brachii score full marks for brachialis.
  ['brachii', 'brachialis'],
  ['brachialis', 'brachioradialis'],
  // Which of the three glutei, and which head of a muscle.
  ['maximus', 'medius'],
  ['medius', 'minimus'],
  ['maximus', 'minimus'],
  ['longus', 'brevis'],
  ['medialis', 'lateralis'],
  ['trapezium', 'trapezoid'],
  ['capitate', 'capitulum'],
];

// Alternative names for the same structure — e.g. C1 "is" the atlas, not
// merely similar to it. Word-level, applied after tokenization. Both sides
// of a pair map to the same canonical token so it doesn't matter which
// term the source or the learner used.
//
// This also carries the adjectival forms of named bones ("radial" ->
// "radius"). That's what lets the precision-qualifier machinery below do
// its job: an official answer of "Radial head" canonicalizes to the same
// {radius, head} token set whether it was written "radial head" or "head
// of radius", so a learner who answers just "radius" is correctly scored
// as the right bone but missing the required precision (1/2, not 0 or
// 2/2) — the same tier as omitting laterality, not a wrong answer.
const WORD_SYNONYMS: Record<string, string> = {
  ventral: 'anterior',
  dorsal: 'posterior',
  c1: 'atlas',
  c2: 'axis',
  renal: 'kidney',
  // Adjectival bone forms -> the bone noun.
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
  vertebral: 'vertebra',
  sacral: 'sacrum',
  iliac: 'ilium',
  pubic: 'pubis',
  ischial: 'ischium',
  carpal: 'carpus',
  tarsal: 'tarsus',
  calcaneal: 'calcaneus',
  talar: 'talus',
  mandibular: 'mandible',
  maxillary: 'maxilla',
};

// Ordinals are written every which way in radiology answers — "Fifth
// metatarsal", "5th metatarsal", "5th MT". All three name the same bone, so
// every form collapses to the bare digit before comparison.
const ORDINAL_WORDS: Record<string, string> = {
  first: '1', second: '2', third: '3', fourth: '4', fifth: '5', sixth: '6',
  seventh: '7', eighth: '8', ninth: '9', tenth: '10', eleventh: '11',
  twelfth: '12', thirteenth: '13', fourteenth: '14', fifteenth: '15',
  sixteenth: '16', seventeenth: '17', eighteenth: '18', nineteenth: '19',
  twentieth: '20',
};

function normalizeOrdinal(word: string): string {
  const spelled = ORDINAL_WORDS[word];
  if (spelled) return spelled;
  const m = word.match(/^(\d{1,2})(st|nd|rd|th)$/);
  return m ? m[1] : word;
}

const WORD_SYNONYM_KEYS = Object.keys(WORD_SYNONYMS);
// The canonical targets ("scapula", "clavicle", ...). A word that is already
// one of these is correct as written and must not be fuzzy-matched against a
// KEY — "scapula" sits one edit from the key "scapular", which resolved it to
// itself while spuriously reporting a spelling correction in the feedback.
const WORD_SYNONYM_VALUES = new Set(Object.values(WORD_SYNONYMS));

// Tracks, for a single grading call, notable things about HOW a match was
// reached — used to add gentle notes to the feedback without conflating
// them with the underlying correctness judgement:
//  - corrected: a fuzzy typo-correction was needed (never set for
//    legitimate synonym use — writing "atlas" for "C1" is a correct
//    alternative name, not a spelling mistake).
//  - abbreviationUsed: the learner's answer only matched after expanding a
//    known abbreviation (e.g. "IVC" -> "inferior vena cava"). The exam
//    itself may accept this, but the RCR discourages abbreviations, so we
//    say so without withholding the mark.
interface SpellingTracker {
  corrected: boolean;
  abbreviationUsed: boolean;
  /** Precision qualifiers the official answer had and the learner omitted,
   * used to give a specific teaching note instead of a generic one. */
  omittedQualifiers: string[];
  // The learner's wording only matched after collapsing a recognised
  // alternative name ("collarbone" -> clavicle). Full marks either way; the
  // feedback just names the preferred term so they learn it.
  synonymUsed: boolean;
}

// Multi-word alternative names that don't share a common word, so they
// can't be handled by single-token WORD_SYNONYMS (e.g. "aqueduct of
// sylvius" and "cerebral aqueduct" share no tokens at all). Applied as a
// whole-phrase substitution before tokenization; every synonym in a group
// collapses to the group's first entry.
// NOTE: entries here must already be in "canonicalizable" form -- no
// apostrophes (stripPunctuation contracts them: "Morrison's" -> "morrisons")
// and hyphens written as spaces (stripPunctuation converts "-" -> " ").
const PHRASE_SYNONYM_GROUPS: string[][] = [
  // --- Common lay terms. Canonical (formal) term MUST be first: every
  // other entry in the group collapses to it. Deliberately excludes bare
  // "spine"/"backbone", which would corrupt unrelated structures that use
  // the word as a landmark (ischial spine, spinous process). ---
  // --- Ray numbering. A digit's ray can be named by its number or by the
  // digit itself, and both are correct: the thumb metacarpal IS the first
  // metacarpal. Canonical is the ordinal, since that is how the source
  // answers are written. ---
  ['first metacarpal', 'thumb metacarpal', '1st metacarpal', 'metacarpal of the thumb'],
  ['fifth metacarpal', 'little finger metacarpal', '5th metacarpal'],
  ['first metatarsal', 'great toe metatarsal', '1st metatarsal', 'hallux metatarsal'],
  ['fifth metatarsal', 'little toe metatarsal', '5th metatarsal'],
  ['first proximal phalanx', 'thumb proximal phalanx', 'proximal phalanx of the thumb'],

  ['clavicle', 'collar bone', 'collarbone'],
  ['patella', 'knee cap', 'kneecap'],
  ['scapula', 'shoulder blade', 'shoulderblade'],
  ['coccyx', 'tail bone', 'tailbone'],
  ['calcaneus', 'heel bone', 'heelbone', 'os calcis'],
  ['sternum', 'breast bone', 'breastbone'],
  ['skull', 'cranium'],
  ['mandible', 'jaw bone', 'jawbone', 'lower jaw'],
  ['maxilla', 'upper jaw'],
  ['tibia', 'shin bone', 'shinbone'],
  ['femur', 'thigh bone', 'thighbone'],
  ['trachea', 'windpipe'],
  ['larynx', 'voice box'],
  ['esophagus', 'gullet'],
  // Digit names resolve to ordinal + ray, so "metatarsal of the little toe"
  // and "fifth metatarsal" agree while the ray noun still separates hand
  // from foot (toe/finger sit in NEVER_CONFLATE, and naming the ray counts
  // as added precision rather than a mismatch).
  ['first toe', 'hallux', 'great toe', 'big toe'],
  ['first finger', 'thumb', 'pollex'],
  ['fifth toe', 'little toe'],
  ['fifth finger', 'little finger'],
  ['umbilicus', 'belly button', 'navel'],
  // --- Neuro / head & neck ---
  ['cerebral aqueduct', 'aqueduct of sylvius', 'sylvian aqueduct', 'aqueduct of the midbrain', 'mesencephalic aqueduct'],
  ['lateral fissure', 'sylvian fissure', 'lateral sulcus', 'fissure of sylvius', 'lateral cerebral fissure'],
  ['central sulcus', 'rolandic fissure', 'fissure of rolando'],
  ['interventricular foramen', 'foramen of monro', 'foramen of monroe'],
  ['cerebral arterial circle', 'circle of willis'],
  ['great cerebral vein', 'vein of galen'],
  // Dural venous sinuses. Supplied as acceptable by the author: all three
  // name the sinus running in the attached margin of the falx and tentorium.
  ['straight sinus', 'sinus rectus', 'tentorial sinus'],
  ['cerebellomedullary cistern', 'cisterna magna'],
  ['lateral aperture of fourth ventricle', 'foramen of luschka'],
  ['median aperture of fourth ventricle', 'foramen of magendie'],
  ['uncovertebral joint', 'joint of luschka', 'luschka joint'],
  ['trigeminal cave', 'meckel cave', 'cavum meckeli'],
  ['pterygopalatine fossa', 'sphenopalatine fossa'],
  ['laryngeal prominence', 'adams apple'],
  ['lateral retropharyngeal lymph node of rouviere', 'node of rouviere', 'lateral retropharyngeal node'],
  ['thyroid ligament of berry', 'ligament of berry', 'posterior suspensory ligament of thyroid'],
  // --- Thorax / cardiac ---
  ['atrioventricular bundle', 'bundle of his'],
  ['sinoatrial node', 'sa node', 'node of keith and flack'],
  ['atrioventricular node', 'av node', 'node of aschoff tawara'],
  ['ligamentum arteriosum', 'obliterated ductus arteriosus'],
  ['costophrenic angle', 'costophrenic recess'],
  ['cardiophrenic angle', 'cardiophrenic recess'],
  // --- Abdomen / pelvis / GI / biliary ---
  ['rectouterine pouch', 'pouch of douglas', 'rectovaginal pouch', 'cul de sac'],
  ['hepatorenal recess', 'pouch of morrison', 'morrisons pouch'],
  ['cystohepatic triangle', 'triangle of calot', 'calots triangle'],
  ['epiploic foramen', 'omental foramen', 'foramen of winslow'],
  ['hepatopancreatic ampulla', 'ampulla of vater'],
  ['hepatopancreatic sphincter', 'sphincter of oddi'],
  ['suspensory ligament of duodenum', 'ligament of treitz'],
  ['accessory pancreatic duct', 'duct of santorini'],
  ['main pancreatic duct', 'duct of wirsung'],
  ['pancreatic islets', 'islets of langerhans'],
  ['intestinal glands', 'crypts of lieberkuhn', 'crypts of lieberkuhn'],
  ['transverse rectal fold', 'valve of houston'],
  ['myenteric plexus', 'auerbachs plexus', 'auerbach plexus'],
  ['submucosal plexus', 'meissners plexus', 'meissner plexus'],
  ['ligamentum teres of liver', 'ligamentum teres hepatis', 'obliterated umbilical vein', 'round ligament of liver'],
  ['ligamentum venosum', 'obliterated ductus venosus'],
  ['retropubic space', 'space of retzius', 'retzius space', 'prevesical space'],
  ['rectoprostatic fascia', 'denonvilliers fascia', 'rectovesical septum'],
  ['renal fascia', 'gerotas fascia', 'gerota fascia'],
  ['greater vestibular gland', 'bartholins gland', 'bartholin gland'],
  ['bulbourethral gland', 'cowpers gland', 'cowper gland'],
  ['nephron loop', 'loop of henle'],
  ['glomerular capsule', 'bowmans capsule', 'bowman capsule'],
  ['deep inguinal lymph node', 'node of cloquet', 'cloquets node'],
  // --- Abdominal abbreviations in everyday reporting use.
  // These belong here rather than in a question's acceptedVariants because
  // several of them CARRY the laterality inside the acronym: "LHV" is the
  // left hepatic vein, so it must expand to the full phrase before the
  // laterality check runs, or an answer that did give the side still loses
  // a mark for omitting it. Expanding centrally also stops an acronym being
  // substituted into a longer name that never uses one, which is how
  // "branch of right portal vein" became "branch of right MPV".
  ['inferior vena cava', 'ivc'],
  ['superior vena cava', 'svc'],
  ['common bile duct', 'cbd'],
  ['superior mesenteric artery', 'sma'],
  ['superior mesenteric vein', 'smv'],
  ['inferior mesenteric artery', 'ima'],
  ['inferior mesenteric vein', 'imv'],
  ['common hepatic artery', 'cha'],
  ['middle hepatic vein', 'mhv'],
  ['right hepatic vein', 'rhv'],
  ['left hepatic vein', 'lhv'],
  ['main portal vein', 'mpv'],
  ['anterior superior iliac spine', 'asis'],
  ['anterior inferior iliac spine', 'aiis'],
  ['posterior superior iliac spine', 'psis'],
  ['quadratus lumborum', 'ql'],
  ['gallbladder', 'gall bladder', 'gb'],
  // --- Limb, spine and thoracic abbreviations. Same reasoning as above.
  ['distal radioulnar joint', 'druj'],
  ['proximal radioulnar joint', 'pruj'],
  ['triangular fibrocartilage complex', 'tfcc'],
  ['triangular fibrocartilage', 'tfc'],
  ['scapholunate ligament', 'sl ligament'],
  ['long head of biceps tendon', 'lhbt'],
  ['acromioclavicular joint', 'ac joint', 'acj'],
  ['sternoclavicular joint', 'sc joint', 'scj'],
  ['glenohumeral joint', 'ghj'],
  ['flexor carpi ulnaris', 'fcu'],
  ['flexor carpi radialis', 'fcr'],
  ['flexor pollicis longus', 'fpl'],
  ['flexor digitorum profundus', 'fdp'],
  ['flexor digitorum superficialis', 'fds'],
  ['extensor carpi ulnaris', 'ecu'],
  ['extensor carpi radialis brevis', 'ecrb'],
  ['extensor carpi radialis longus', 'ecrl'],
  ['abductor pollicis longus', 'apl'],
  ['extensor pollicis brevis', 'epb'],
  ['extensor pollicis longus', 'epl'],
  ['flexor hallucis longus', 'fhl'],
  ['flexor hallucis brevis', 'fhb'],
  ['flexor digitorum longus', 'fdl'],
  ['superficial femoral artery', 'sfa'],
  ['common femoral artery', 'cfa'],
  ['common femoral vein', 'cfv'],
  ['profunda femoris artery', 'pfa'],
  ['tibioperoneal trunk', 'tpt'],
  ['anterior tibial artery', 'ata'],
  ['posterior tibial artery', 'pta'],
  ['long saphenous vein', 'lsv'],
  ['short saphenous vein', 'ssv'],
  ['great saphenous vein', 'gsv'],
  ['medial collateral ligament', 'mcl'],
  ['lateral collateral ligament', 'lcl'],
  ['anterior cruciate ligament', 'acl'],
  ['posterior cruciate ligament', 'pcl'],
  ['iliotibial band', 'itb', 'it band'],
  ['tensor fasciae latae', 'tfl'],
  ['metatarsophalangeal joint', 'mtp joint', 'mtpj'],
  ['metacarpophalangeal joint', 'mcp joint', 'mcpj'],
  ['proximal interphalangeal joint', 'pip joint', 'pipj'],
  ['distal interphalangeal joint', 'dip joint', 'dipj'],
  ['carpometacarpal joint', 'cmc joint', 'cmcj'],
  ['anterior longitudinal ligament', 'all ligament'],
  ['posterior longitudinal ligament', 'pll'],
  ['coracoacromial ligament', 'cal'],
];

// Generic head-nouns that add no disambiguating information when appended
// to an already-specific, unambiguous structure name (e.g. "manubrium" is
// unambiguous on its own, so "manubrium of the sternum" must still match
// "manubrium"). Dropping one of these never costs marks. Deliberately
// conservative — words that CAN disambiguate between genuinely different
// structures (e.g. "superficial", "deep", "accessory", "cutaneous") are
// intentionally excluded.
// 'vertebra' lives here rather than in PRECISION_QUALIFIER_WORDS: unlike a
// limb bone name (which disambiguates which of several bones a landmark
// belongs to), every spine structure is implicitly "of a vertebra" — the
// real disambiguator is the level (L1, C4, ...), which the separate
// extractLevel() qualifier phase already handles. So "spinous process of L1
// vertebra" and "spinous process" (level omitted, scored via that phase)
// must not additionally get capped at 'imprecise' purely for dropping the
// word "vertebra" itself.
/* Region names used loosely as the parent of a landmark. "Glenoid of the
   shoulder" and "glenoid of the scapula" are the same surface — one names the
   joint region, the other the bone it belongs to — and the learner naming the
   bone is being more precise, not wrong. */
const REGION_PARENT_WORDS = new Set([
  'shoulder', 'hip', 'knee', 'ankle', 'wrist', 'elbow', 'foot', 'hand',
  'pelvis', 'thorax', 'chest', 'abdomen', 'glenohumeral',
]);

/* Nouns that describe a part of something rather than name a structure. A
   core that reduces to one of these is not specific enough to carry the
   parent-swap rule: "head of humerus" and "head of femur" must never collapse
   onto each other just because both reduce to "head". */
const GENERIC_PART_WORDS = new Set([
  'head', 'neck', 'body', 'base', 'shaft', 'tip', 'process', 'border', 'margin',
  'angle', 'surface', 'aspect', 'blade', 'wing', 'notch', 'groove', 'fossa',
  'end', 'pole', 'rim', 'roof', 'floor', 'wall', 'ramus', 'branch', 'part',
]);

/* Tissue types that name a class rather than a structure. Useful as a
   qualifier ("subscapularis muscle") but meaningless alone, so they never
   carry an answer by themselves. */
const BARE_TISSUE_WORDS = new Set([
  'muscle', 'tendon', 'ligament', 'artery', 'vein', 'nerve', 'bone', 'joint', 'capsule',
]);

/* Nouns that name a soft-tissue structure in its own right. Adding one of
   these to an answer that contains no tissue word at all is not extra
   precision — it names something else: the patellar TENDON is not the
   patella, and the glenoid LABRUM is not the glenoid. Deliberately excludes
   "muscle", which is almost always harmless to add to a muscle name and which
   the learner is expected to be able to add freely. */
const SOFT_TISSUE_NOUNS = new Set([
  'tendon', 'ligament', 'labrum', 'meniscus', 'bursa', 'aponeurosis',
  'fascia', 'cartilage', 'retinaculum',
]);

const TRULY_REDUNDANT_WORDS = new Set([
  'sternum', 'bone', 'joint', 'process', 'cavity', 'space', 'region', 'surface', 'aspect', 'border', 'margin', 'vertebra',
]);

// Words that add REAL precision without naming a different structure —
// dropping the parent bone from an already-specific landmark ("coracoid
// process" needs no "of scapula" to be unambiguous) or dropping a
// sub-region from a bone ("clavicle" instead of "distal clavicle") is a
// genuine loss of precision, not a wrong answer. Graded like laterality:
// present and correct = full marks, present in the official answer but
// omitted by the learner = partial credit, present and contradicted = 0.
// Deliberately excludes medial/lateral/anterior/posterior/superior/inferior
// — those routinely name two DIFFERENT structures (e.g. medial vs lateral
// meniscus), not two precisions of the same one.
const PRECISION_QUALIFIER_WORDS = new Set([
  'distal', 'proximal', 'middle', 'third', 'head', 'neck', 'shaft', 'base', 'tip', 'blade', 'body', 'tuberosity',
  'clavicle', 'scapula', 'humerus', 'radius', 'ulna', 'femur', 'tibia', 'fibula', 'patella',
  'mandible', 'maxilla', 'rib', 'ilium', 'ischium', 'pubis', 'sacrum',
  'carpus', 'tarsus', 'metacarpal', 'metatarsal', 'phalanx', 'calcaneus', 'talus',
  'navicular', 'cuboid', 'cuneiform', 'hamate', 'capitate', 'trapezoid', 'trapezium', 'triquetrum', 'lunate', 'scaphoid', 'pisiform',
  // Naming tiers within one named vessel/duct family. Omitting the tier
  // ("hepatic artery" for "common hepatic artery") names the right vessel
  // imprecisely -> partial. Naming the WRONG tier ("proper" for "common") is
  // a different vessel and still scores zero, because the two words sit in
  // NEVER_CONFLATE and neither answer is then a subset of the other.
  'common', 'proper', 'main', 'accessory',
  // Naming the ray ("metatarsal of the fifth toe") adds precision over
  // "fifth metatarsal"; omitting it costs nothing, contradicting it scores 0
  // because toe/finger sit in NEVER_CONFLATE above.
  'toe', 'finger', 'digit', 'ray',
  // Tissue type. Naming "subscapularis" when the answer is "subscapularis
  // muscle" identifies the right structure but does not say whether the
  // muscle or its tendon is meant, which is the distinction the label turns
  // on. Half marks, and the feedback says which it was. Muscle and tendon
  // are in NEVER_CONFLATE, so naming the WRONG one still scores zero.
  'muscle', 'tendon', 'ligament', 'artery', 'vein', 'nerve',
  // Which head of a two- or three-headed muscle.
  'long', 'short', 'lateral head', 'oblique',
]);

// Where a dropped precision qualifier has a specific teaching point, say what
// the distinction actually is rather than only that the answer was short.
// Keyed by the qualifier word the learner omitted.
const QUALIFIER_NOTES: Record<string, string> = {
  common: 'Name the tier: the common hepatic artery becomes the proper hepatic artery after giving off the gastroduodenal artery, so "hepatic artery" alone is ambiguous between them.',
  proper: 'Name the tier: the proper hepatic artery is the continuation of the common hepatic artery beyond the gastroduodenal branch, so "hepatic artery" alone is ambiguous between them.',
  third: 'Say which third — proximal, middle or distal — since fractures and landmarks are described by the third involved.',
  distal: 'Say which end of the bone: distal and proximal ends are described separately.',
  proximal: 'Say which end of the bone: distal and proximal ends are described separately.',
};

// How to RECOGNISE the correct structure, so a wrong answer teaches the
// discriminating feature rather than just naming the right label. Keyed by
// the canonical form of the official answer with laterality stripped, so one
// entry serves both sides. Deliberately limited to well-established,
// modality-relevant recognition points.

// Well-known FRCR "sibling" confusions: when the learner's wrong answer is
// the paired term, surface a clarifying note alongside the normal reason.
const CONFUSION_PAIRS: [string, string, string][] = [
  ['anterior longitudinal ligament', 'posterior longitudinal ligament', 'Remember: the anterior and posterior longitudinal ligaments are named relative to the front and back of the vertebral body, not relative to the spinal cord — a common point of confusion.'],
  ['medial meniscus', 'lateral meniscus', 'Remember: medial and lateral menisci are distinguished by position relative to the midline of the knee, not by size or shape alone.'],
  ['medial collateral ligament', 'lateral collateral ligament', 'Remember: the medial and lateral collateral ligaments are named by their side of the joint, not by the direction of stress they resist.'],
  ['exiting nerve root', 'traversing nerve root', 'Remember: the exiting nerve root leaves the canal at that level’s foramen; the traversing nerve root is still passing through the canal on its way to exit one level lower.'],

  // Same name, two bones. These are the pairs that lose marks because the
  // structure was recognised but not qualified, so the note names both and
  // says how to tell which one you are looking at.
  ['coronoid process of ulna', 'coronoid process of mandible', 'Remember: there are only two coronoid processes in the body — the ulna’s, projecting forwards from the proximal ulna to form the front of the trochlear notch, and the mandible’s, the anterior of the two rami processes in front of the mandibular notch. Always say which.'],
  ['styloid process of radius', 'styloid process of ulna', 'Remember: styloid processes exist on the radius, ulna, temporal bone, third metacarpal, fibular head and fifth metatarsal base. At the wrist the radial styloid is the more distal of the two, projecting about a centimetre beyond the ulnar styloid on a normal PA.'],
  ['greater tubercle', 'lesser tubercle', 'Remember: on an AP shoulder in external rotation the greater tubercle is lateral and in profile; the lesser tubercle faces anteriorly and only comes into profile with internal rotation. The bicipital groove lies between them.'],
  ['coracoid process', 'acromion', 'Remember: the coracoid projects forwards from the upper scapular neck and points anterolaterally; the acromion is the lateral continuation of the scapular spine and roofs the joint. The coracoid sits lower and more medial on an AP.'],
  ['trapezium', 'trapezoid', 'Remember: the trapezium is the more radial of the two and articulates with the first metacarpal at the thumb’s saddle joint; the trapezoid sits ulnar to it, beneath the second metacarpal. Trapezium — thumb.'],
  ['scaphoid', 'lunate', 'Remember: the scaphoid is the radial bone of the proximal row and bridges both rows; the lunate sits ulnar to it, directly under the lunate fossa of the radius, and is the crescent whose dislocation gives the “piece of pie” sign.'],
  ['hamate', 'pisiform', 'Remember: the pisiform is a sesamoid in flexor carpi ulnaris and overlies the triquetral on a PA; the hamate lies distal and radial to it and carries the hook that projects into the palm.'],
  ['medial malleolus', 'lateral malleolus', 'Remember: the medial malleolus is the tibia’s distal projection; the lateral malleolus is the fibula’s, and extends about a centimetre more distally. Naming the bone is what distinguishes them.'],
  ['navicular', 'cuboid', 'Remember: the navicular is medial, between the talar head and the three cuneiforms; the cuboid is lateral, between the calcaneus and the fourth and fifth metatarsals. Both are midfoot — the ray they lead to identifies them.'],
  ['calcaneus', 'talus', 'Remember: the talus is the upper bone, articulating with the tibia at the ankle mortise and carrying no muscle attachments; the calcaneus lies beneath it and forms the heel.'],
  ['superior vena cava', 'inferior vena cava', 'Remember: both drain to the right atrium, but the SVC enters from above, at the right upper mediastinum; the IVC enters from below, through the central tendon of the diaphragm at T8.'],
  ['internal carotid artery', 'external carotid artery', 'Remember: above the bifurcation the internal carotid gives no branches in the neck and lies posterolateral; the external carotid gives branches immediately and lies anteromedial. Branches in the neck mean external.'],
  ['common bile duct', 'cystic duct', 'Remember: the cystic duct runs from the gallbladder neck to join the common hepatic duct; the common bile duct is what results from that junction and continues to the ampulla. Above the junction it is the common hepatic duct, not the CBD.'],
  ['greater trochanter', 'lesser trochanter', 'Remember: the greater trochanter is the lateral prominence at the femoral neck–shaft junction; the lesser trochanter is the smaller posteromedial one, seen in profile medially on an AP with the leg externally rotated.'],
  ['olecranon', 'coronoid', 'Remember: both belong to the proximal ulna and form the trochlear notch — the olecranon is the posterior, proximal lip that fills the olecranon fossa in extension; the coronoid is the anterior lip. On a lateral elbow the olecranon is behind, the coronoid in front.'],
];

const LATERALITY_WORDS = /\b(right|left)\b/gi;

function stripPunctuation(s: string): string {
  // Apostrophes contract the word rather than splitting it ("Morrison's" ->
  // "morrisons", not a dangling "morrison" + "s" token) so a possessive
  // form and its non-possessive spelling still canonicalize identically.
  // Hyphens behave like spaces, since hyphenation of the same term varies
  // ("gastro-oesophageal" vs "gastro oesophageal").
  return s
    .replace(/['’’`]/g, '')
    .replace(/-/g, ' ')
    .replace(/[.,;:()"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeBase(s: string): string {
  let t = s.toLowerCase();
  /* A level range is written with either separator — "L3/4", "L3-4",
     "L3-L4" — and they mean the same level. The hyphen forms have to be
     converted BEFORE stripPunctuation, which turns a hyphen into a space and
     leaves "l3 4", where extractLevel can no longer see a range at all. That
     scored "L3-4 intervertebral disc" zero against "L3/4 intervertebral disc"
     while the feedback told the candidate the level was L3-L4 — the very
     level they had typed. */
  t = t.replace(/\b([ctls])\s*(\d{1,2})\s*[-–]\s*([ctls]?)\s*(\d{1,2})\b/g, '$1$2/$3$4');
  t = stripPunctuation(t);
  for (const [re, rep] of SPELLING_NORMALIZATIONS) t = t.replace(re, rep);
  // Spine levels get written "C7", "C-7" or "C 7"; stripPunctuation has
  // already turned the hyphen into a space, so rejoin letter and number.
  t = t.replace(/\b([ctls])\s+(\d{1,2})\b/g, '$1$2');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

function expandAbbreviations(s: string, tracker?: SpellingTracker): string {
  let t = ` ${s} `;
  for (const [re, rep] of ABBREVIATIONS) {
    const before = t;
    t = t.replace(re, rep);
    if (tracker && t !== before) tracker.abbreviationUsed = true;
  }
  return t.replace(/\s+/g, ' ').trim();
}

// Scans for a run of words matching a known synonym phrase and splices in
// its canonical form — tolerating a minor typo in any one word of the run
// (same per-word threshold as everywhere else), so "colar bone" still
// resolves to "clavicle" even though "collar bone" is spelled wrong. Runs
// on the full un-filtered word list (stop words like "of" still present),
// since several synonym phrases contain them (e.g. "aqueduct of sylvius").
/* Whether one word of a synonym phrase may be read as another.

   Deliberately stricter than the general typo tolerance, for the same reason
   resolveWordSynonym is: rewriting a word to a DIFFERENT token is far more
   destructive than comparing two words, because the rewritten phrase then
   compares equal to something the learner never wrote. "mental" is one edit
   from "omental", so "mental foramen" was being rewritten to the canonical
   "epiploic foramen" — a mandible landmark scored full marks for an abdominal
   one, and the same rewrite made word order matter for an answer that should
   have been order-free.

   Requiring the first letter to survive is what separates the two cases: a
   typist who writes "colar bone" still starts the word correctly, whereas
   "mental" and "omental" are different words that happen to be one insertion
   apart. */
function phraseWordMatches(word: string, synonymWord: string): boolean {
  if (word === synonymWord) return true;
  if (word[0] !== synonymWord[0]) return false;
  return levenshteinWithinThreshold(word, synonymWord);
}

function expandPhraseSynonyms(s: string, tracker?: SpellingTracker): string {
  let words = s.split(' ').filter(Boolean);
  for (const [canonical, ...synonyms] of PHRASE_SYNONYM_GROUPS) {
    for (const synonym of synonyms) {
      const synWords = synonym.split(' ').filter(Boolean);
      for (let i = 0; i <= words.length - synWords.length; i++) {
        const isMatch = synWords.every((sw, j) => phraseWordMatches(words[i + j], sw));
        if (isMatch) {
          const exact = synWords.every((sw, j) => words[i + j] === sw);
          if (tracker) {
            tracker.synonymUsed = true;
            if (!exact) tracker.corrected = true;
          }
          words = [...words.slice(0, i), ...canonical.split(' '), ...words.slice(i + synWords.length)];
          break;
        }
      }
    }
  }
  return words.join(' ').replace(/\s+/g, ' ').trim();
}

function stripLaterality(s: string): { base: string; side: 'right' | 'left' | null } {
  const match = s.match(LATERALITY_WORDS);
  const side = match ? (match[0].toLowerCase() as 'right' | 'left') : null;
  const base = s.replace(LATERALITY_WORDS, ' ').replace(/\s+/g, ' ').trim();
  return { base, side };
}

// Pulls a vertebral/spinal level (single, e.g. "L3", or a range, e.g.
// "C7-T1" / "L4/5") out of a phrase, leaving the remaining structure name.
// C1/C2 are deliberately left untouched — they're handled as proper-name
// synonyms (atlas/axis) via WORD_SYNONYMS, not as a strippable qualifier.
function extractLevel(s: string): { core: string; level: string | null } {
  const rangeTwoLetters = /\b([ctls])\s*(\d{1,2})\s*[/\-–]\s*([ctls])\s*(\d{1,2})\b/i;
  let m = s.match(rangeTwoLetters);
  if (m && m.index !== undefined) {
    const level = `${m[1].toUpperCase()}${m[2]}-${m[3].toUpperCase()}${m[4]}`;
    const core = (s.slice(0, m.index) + s.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim();
    return { core, level };
  }
  const rangeImplied = /\b([ctls])\s*(\d{1,2})\s*[/\-–]\s*(\d{1,2})\b/i;
  m = s.match(rangeImplied);
  if (m && m.index !== undefined) {
    const level = `${m[1].toUpperCase()}${m[2]}-${m[1].toUpperCase()}${m[3]}`;
    const core = (s.slice(0, m.index) + s.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim();
    return { core, level };
  }
  const single = /\b([ctls])\s*(\d{1,2})\b/i;
  m = s.match(single);
  if (m && m.index !== undefined) {
    const letter = m[1].toUpperCase();
    const num = m[2];
    if (letter === 'C' && (num === '1' || num === '2')) {
      return { core: s, level: null };
    }
    const level = `${letter}${num}`;
    const core = (s.slice(0, m.index) + s.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim();
    return { core, level };
  }
  return { core: s, level: null };
}

// Singular anatomical nouns that happen to end in a bare "s" and would
// otherwise be misread as a plural by the generic rule below (found via
// "atlas" -> "atla", which silently broke the C1/atlas synonym: canonicalForm
// depluralizes "Atlas" directly, but WORD_SYNONYMS["c1"] resolves to the
// literal string "atlas" *after* depluralization already ran, so the two
// paths landed on different strings unless this exception exists).
const SINGULAR_WORDS_ENDING_IN_S = new Set([
  'atlas', 'pancreas', 'psoas', 'iliopsoas', 'glans', 'anus', 'corpus', 'fundus', 'uterus',
  'rectus', 'sinus', 'meniscus', 'humerus', 'radius', 'esophagus', 'oesophagus', 'bronchus',
  'plexus', 'thymus', 'ramus', 'nucleus', 'ductus', 'processus', 'annulus', 'discus',
]);

function depluralize(word: string): string {
  if (word.length <= 4) return word;
  if (SINGULAR_WORDS_ENDING_IN_S.has(word)) return word;
  if (/(us|is|ss|sis)$/.test(word)) return word;
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('es') && /(ch|sh|x|z)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

// Connector/stop words that carry no anatomical meaning on their own, so
// "spinous process of C4" and "C4 spinous process" must compare equal.
const STOP_WORDS = new Set(['of', 'the', 'an', 'and', 'to']);

// Bounded edit distance for tolerating minor typos/misspellings without
// accepting genuinely different words. Threshold scales gently with length.
// (Defined above levenshtein()/fuzzyEditThreshold() in source order, but
// hoisted function declarations make that irrelevant at call time.)
// True when two words are a documented confusable pair, so typo tolerance
// must not bridge them no matter how few edits apart they are.
/* Opposing directional prefixes. Listing every pair by hand does not scale —
   supraspinatus and infraspinatus are three edits apart on thirteen letters,
   and so are dozens of other supra-/infra-, intra-/extra- and pre-/post-
   pairs across the body. Two words that share a stem but carry prefixes from
   opposing groups are different structures, however few edits separate them. */
const PREFIX_GROUPS: Record<string, string> = {
  supra: 'up', super: 'up', epi: 'up',
  infra: 'down', sub: 'down', hypo: 'down',
  intra: 'in', endo: 'in',
  extra: 'out', exo: 'out',
  pre: 'before', ante: 'before',
  post: 'after', retro: 'after',
};

const OPPOSED: [string, string][] = [
  ['up', 'down'],
  ['in', 'out'],
  ['before', 'after'],
];

function prefixOf(word: string): [string, string] | null {
  // Longest prefix first, so "supra" is not read as "sub"-like noise.
  const keys = Object.keys(PREFIX_GROUPS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (word.length > k.length + 3 && word.startsWith(k)) return [PREFIX_GROUPS[k], word.slice(k.length)];
  }
  return null;
}

function opposedPrefixes(a: string, b: string): boolean {
  const pa = prefixOf(a);
  const pb = prefixOf(b);
  if (!pa || !pb || pa[0] === pb[0]) return false;
  const opposed = OPPOSED.some(([x, y]) => (pa[0] === x && pb[0] === y) || (pa[0] === y && pb[0] === x));
  if (!opposed) return false;
  // Only when the rest of the word is the same structure, so "subclavian"
  // and "supraspinatus" are left to the ordinary matcher.
  const rest = Math.max(pa[1].length, pb[1].length);
  return pa[1] === pb[1] || levenshtein(pa[1], pb[1]) <= fuzzyEditThreshold(rest);
}

function isNeverConflate(a: string, b: string): boolean {
  const ca = DIRECTIONAL_CLASS[a];
  const cb = DIRECTIONAL_CLASS[b];
  if (ca && cb && ca !== cb) return true;
  for (const [x, y] of NEVER_CONFLATE) {
    if ((a === x && b === y) || (a === y && b === x)) return true;
  }
  return opposedPrefixes(a, b);
}

/* Four- and five-letter words get no general edit tolerance, because at that
   length one edit usually means a different structure. But two typo classes
   are overwhelmingly slips rather than different words: an adjacent
   transposition ("vien" for "vein") and a vowel-for-vowel substitution
   ("vena cave" for "vena cava"). Both are accepted provided the word starts
   the same way and is the same length. This is deliberately narrower than
   raising the threshold: "duct"/"dust" swaps a consonant and stays wrong,
   and NEVER_CONFLATE is checked before this runs, so ilium/ileum are still
   held apart. */
function shortWordTypo(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  if (len < 4 || len > 5) return false;
  if (a.length !== b.length || a[0] !== b[0]) return false;
  const diffs: number[] = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diffs.push(i);
  if (
    diffs.length === 2 &&
    diffs[1] === diffs[0] + 1 &&
    a[diffs[0]] === b[diffs[1]] &&
    a[diffs[1]] === b[diffs[0]]
  ) {
    return true;
  }
  const VOWELS = 'aeiouy';
  return diffs.length === 1 && VOWELS.includes(a[diffs[0]]) && VOWELS.includes(b[diffs[0]]);
}

function levenshteinWithinThreshold(a: string, b: string): boolean {
  if (a === b) return true;
  if (isNeverConflate(a, b)) return false;
  const threshold = fuzzyEditThreshold(Math.max(a.length, b.length));
  if (threshold === 0) return shortWordTypo(a, b);
  return levenshtein(a, b) <= threshold;
}

// Maps a word to its synonym target, tolerating a minor misspelling of the
// synonym KEY itself (e.g. "ischeal" -> matches key "ischial" within
// threshold -> resolves to "ischium", same as if the user had spelled it
// correctly). Marks the tracker so the caller can mention it was a spelling
// correction, not a wrong-structure answer.
function resolveWordSynonym(word: string, tracker?: SpellingTracker): string {
  const exact = WORD_SYNONYMS[word];
  if (exact) {
    if (tracker) tracker.synonymUsed = true;
    return exact;
  }
  // Deliberately stricter than the general typo tolerance: rewriting a word
  // to a DIFFERENT token is far more destructive than comparing two words,
  // because two unrelated inputs can collapse onto the same key and then
  // compare equal. ("external" and "internal" are each 2 edits from the key
  // "sternal" — at the general threshold both became "sternum" and matched
  // each other.) One edit, on words long enough for that to be unambiguous.
  if (word.length < 6 || WORD_SYNONYM_VALUES.has(word)) return word;
  for (const key of WORD_SYNONYM_KEYS) {
    if (key.length < 6 || isNeverConflate(word, key)) continue;
    if (Math.abs(word.length - key.length) <= 1 && levenshtein(word, key) <= 1) {
      if (tracker) {
        tracker.corrected = true;
        tracker.synonymUsed = true;
      }
      return WORD_SYNONYMS[key];
    }
  }
  return word;
}

function canonicalForm(raw: string, tracker?: SpellingTracker): string {
  let t = normalizeBase(raw);
  t = expandAbbreviations(t, tracker);
  t = expandPhraseSynonyms(t, tracker);
  t = normalizeBase(t);
  const words = t
    .split(' ')
    .filter(Boolean)
    .filter((w) => !STOP_WORDS.has(w))
    .map(depluralize)
    .map(normalizeOrdinal)
    .map((w) => resolveWordSynonym(w, tracker));
  words.sort(); // word-order independence
  return words.join(' ');
}

// Bounded edit distance for tolerating minor typos/misspellings without
// accepting genuinely different words. Threshold scales gently with length.
// Damerau-Levenshtein: counts an adjacent transposition ("scaphiod" for
// "scaphoid") as ONE edit rather than two. Transposition is one of the most
// common real typing slips, and treating it as a single edit lets the
// tolerance stay tight for genuinely different words.
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  // Full matrix (rather than a rolling row) because the transposition case
  // needs the row two back.
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[m][n];
}

// Short words get no tolerance at all — at 4-5 characters, one edit is
// usually a different structure ("ilium"/"ileum", "ulna"/"ulnar"), not a
// typo. Longer words get proportionally more room, since a learner who
// writes 8+ characters has clearly committed to a specific structure and
// NEVER_CONFLATE separately blocks the known-confusable pairs.
function fuzzyEditThreshold(len: number): number {
  // Roughly a third of the word, which is what it takes to accept the
  // misspellings people actually type under time pressure — "tubotisity" for
  // "tuberosity" is three edits in ten characters. Safe because this is
  // applied per word, never to a whole phrase, and because the confusable
  // pairs it must not bridge are held in NEVER_CONFLATE and checked first.
  if (len <= 4) return 0;
  if (len <= 6) return 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  if (len <= 17) return 4;
  return 5;
}

type MatchQuality = 'exact' | 'imprecise' | 'none';

function wordsOf(canon: string): Set<string> {
  return new Set(canon.split(' ').filter(Boolean));
}

// Word-level membership tolerant of a single minor typo (same threshold
// used everywhere else) — this is what lets a multi-word answer with two
// small independent misspellings ("ischeal tunorosity") still match, where
// a single whole-phrase edit-distance check would see the combined
// difference as too large.
function wordFuzzyIncludes(set: Set<string>, word: string, tracker?: SpellingTracker): boolean {
  if (set.has(word)) return true;
  for (const s of set) {
    if (levenshteinWithinThreshold(word, s)) {
      if (tracker) tracker.corrected = true;
      return true;
    }
  }
  return false;
}

// 'exact'    — same structure, fully specified (truly-redundant words on
//              either side don't count against this).
// 'imprecise'— the learner named the right structure family but dropped a
//              real precision qualifier the official answer specified (or
//              vice versa isn't possible — extra qualifiers the learner adds
//              beyond what's required still count as 'exact', see below).
// 'none'     — no meaningful overlap.
function wordSetMatch(userCanon: string, officialCanon: string, tracker?: SpellingTracker): MatchQuality {
  const u = wordsOf(userCanon);
  const o = wordsOf(officialCanon);
  const extraInUser = [...u].filter((w) => !wordFuzzyIncludes(o, w, tracker));
  const extraInOfficial = [...o].filter((w) => !wordFuzzyIncludes(u, w, tracker));
  const officialSubsetOfUser = extraInOfficial.length === 0;
  const userSubsetOfOfficial = extraInUser.length === 0;

  // User said everything official said. Extra words are extra description,
  // not error: naming the long head of biceps brachii when the answer says
  // only "biceps brachii tendon" is more precise, not less. The guard is
  // that no extra may contradict a word in the official answer, and that a
  // scattergun listing several structures is not rewarded.
  if (officialSubsetOfUser) {
    const contradicts = extraInUser.some((w) => [...o].some((ow) => isNeverConflate(w, ow)));
    const addsTissue = extraInUser.some((w) => SOFT_TISSUE_NOUNS.has(w));
    const officialNamesTissue = [...o].some(
      (w) => SOFT_TISSUE_NOUNS.has(w) || BARE_TISSUE_WORDS.has(w)
    );
    if (!contradicts && !(addsTissue && !officialNamesTissue) && extraInUser.length <= 4) {
      return 'exact';
    }
  }
  // Official said everything user said, plus only truly-redundant extras —
  // still a full match (e.g. official "manubrium of the sternum" vs user
  // "manubrium").
  if (userSubsetOfOfficial && extraInOfficial.length > 0 && extraInOfficial.every((w) => TRULY_REDUNDANT_WORDS.has(w))) {
    return 'exact';
  }
  // Official said everything user said, plus a real precision qualifier the
  // user omitted (e.g. official "distal clavicle" vs user "clavicle", or
  // official "coracoid process of scapula" vs user "coracoid process") —
  // right structure, imprecise.
  if (userSubsetOfOfficial && extraInOfficial.length > 0 && extraInOfficial.every((w) => TRULY_REDUNDANT_WORDS.has(w) || PRECISION_QUALIFIER_WORDS.has(w))) {
    if (tracker) {
      tracker.omittedQualifiers = extraInOfficial.filter((w) => PRECISION_QUALIFIER_WORDS.has(w));
    }
    return 'imprecise';
  }

  /* Same landmark, different parent named. Strip the parent bone and the
     region word from both sides; if what is left is identical and actually
     names something, it is the same structure. Guarded by GENERIC_PART_WORDS
     so "head of humerus" and "head of femur" never collapse together. */
  const core = (set: Set<string>) =>
    [...set].filter((w) => !PRECISION_QUALIFIER_WORDS.has(w) && !REGION_PARENT_WORDS.has(w) && !TRULY_REDUNDANT_WORDS.has(w));
  const uCore = core(u);
  const oCore = core(o);
  /* The words this rule sets aside must not be the words that disagree.
     'artery' and 'vein' are both precision qualifiers, so stripping them
     turned "left renal artery" and "left renal vein" into the same core and
     awarded full marks for the wrong vessel — the contradiction was thrown
     away before it could be seen. The same erased 'proper' against 'common'.
     So anything dropped from one side is checked against anything dropped
     from the other before the cores are allowed to match. */
  const dropped = (set: Set<string>, kept: string[]) => [...set].filter((w) => !kept.includes(w));
  const uDropped = dropped(u, uCore);
  const oDropped = dropped(o, oCore);
  const droppedContradiction = uDropped.some((a) =>
    oDropped.some((b) => isNeverConflate(a, b))
  );
  if (
    !droppedContradiction &&
    uCore.length > 0 &&
    uCore.length === oCore.length &&
    uCore.every((w) => oCore.some((x) => x === w || levenshteinWithinThreshold(w, x))) &&
    uCore.some((w) => !GENERIC_PART_WORDS.has(w) && !BARE_TISSUE_WORDS.has(w))
  ) {
    return 'exact';
  }

  /* Everything the learner wrote appears in the official answer, but they
     stopped short of all of it — "glenoid" for "inferior glenoid labrum".
     That is part of the right answer, not a wrong one, so it earns the same
     partial credit as any other dropped qualifier. It does not matter whether
     the omitted words happen to be on the qualifier list; what matters is
     that nothing the learner wrote contradicts the answer.

     Guarded twice over: a bare category noun is rejected earlier by
     isVagueAnswer, and the learner must still have contributed a word that
     names something, so "muscle" alone never earns half of "supraspinatus
     muscle". */
  if (userSubsetOfOfficial && extraInOfficial.length > 0) {
    const substantive = [...u].filter(
      (w) => !TRULY_REDUNDANT_WORDS.has(w) && !BARE_TISSUE_WORDS.has(w)
    );
    if (substantive.length > 0) {
      if (tracker) tracker.omittedQualifiers = extraInOfficial;
      return 'imprecise';
    }
  }
  return 'none';
}

// Expands a bare ambiguous abbreviation into each of its candidate readings,
// so the caller can test them all. Only fires when the whole answer is that
// one token — "LLL" is a confident abbreviation, "LLL something" is not.
function ambiguousReadings(raw: string): string[] {
  const t = normalizeBase(raw).replace(/\./g, '').trim();
  const readings = AMBIGUOUS_ABBREVIATIONS[t];
  return readings ? readings.slice() : [];
}

function structureMatchQuality(userRaw: string, officialRaw: string, variants: string[], tracker?: SpellingTracker): MatchQuality {
  const userCanon = canonicalForm(userRaw, tracker);
  const candidates = [officialRaw, ...variants].map((c) => canonicalForm(c));
  let best: MatchQuality = 'none';
  for (const cand of candidates) {
    if (!cand) continue;
    if (userCanon === cand) return 'exact';
    // Whole-phrase fuzzy matching is only safe for single-word answers. For
    // a multi-word phrase, an edit-distance budget scaled to the FULL
    // phrase length can be "spent" entirely on swapping one word for its
    // directional antonym (e.g. "inferior vena cava" vs "superior vena
    // cava" differ by only 3 edits out of 19 characters — within a naive
    // whole-phrase threshold, even though these are different vessels).
    // wordSetMatch below applies the same tolerance per word instead, whose
    // narrower per-word threshold correctly rejects that swap while still
    // catching genuine multi-word typos like "ischeal tunorosity".
    // Goes through levenshteinWithinThreshold rather than calling levenshtein
    // directly, because that is where NEVER_CONFLATE and the opposed-prefix
    // check live. Measuring raw edit distance here skipped both, and
    // "supraspinatus" scored full marks against "infraspinatus" — 3 edits in
    // 13 characters, inside the ordinary budget — even though the same answer
    // written "supraspinatus muscle" was correctly rejected by the per-word
    // path below.
    if (!userCanon.includes(' ') && !cand.includes(' ')) {
      if (levenshteinWithinThreshold(userCanon, cand)) {
        if (tracker) tracker.corrected = true;
        return 'exact';
      }
    }
    const quality = wordSetMatch(userCanon, cand, tracker);
    if (quality === 'exact') return 'exact';
    if (quality === 'imprecise') best = 'imprecise';
  }
  return best;
}

/* Articles are dropped from both sides before matching. The source answers
   are transcribed verbatim and are inconsistent about them — "coronoid process
   of ulna" in one place, "of the ulna" in another — and a literal substring
   test silently misses half the pairs it was written for. */
function stripArticles(s: string): string {
  return s.toLowerCase().replace(/\b(?:the|a|an)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

function confusionNote(userAnswer: string, officialAnswer: string): string | null {
  const u = stripArticles(userAnswer);
  const o = stripArticles(officialAnswer);
  for (const [a, b, note] of CONFUSION_PAIRS) {
    if ((u.includes(a) && o.includes(b)) || (u.includes(b) && o.includes(a))) return note;
  }
  return null;
}

// Appended to feedback whenever credit was granted despite a typo, and/or
// despite answering with an abbreviation — makes clear neither was actually
// penalized, without repeating the correct spelling (the official answer is
// already shown above it in the UI). The abbreviation note reflects RCR
// guidance to write anatomical terms in full in the real exam.
// Source answers are transcribed verbatim and often end in a full stop,
// which reads badly inside quotes mid-sentence. Display only — the stored
// officialAnswer is never altered.
function lowerFirst(s: string): string {
  if (!s) return s;
  // Leave acronyms and level codes (IVC, C7, MRI) alone — only ease the
  // sentence-case capital off ordinary prose answers.
  if (/^[A-Z]{2,}/.test(s) || /^[A-Z]\d/.test(s)) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function stripTrailingPeriod(s: string): string {
  return s.replace(/\.\s*$/, '');
}

function withNotes(reason: string, notes: SpellingTracker, officialAnswer?: string): string {
  let r = reason;
  if (notes.synonymUsed && officialAnswer) {
    r += ` That's an accepted alternative name; ${lowerFirst(stripTrailingPeriod(officialAnswer))} is the term to use in the exam.`;
  }
  if (notes.corrected) r += " Spelling isn't marked, so that's fine.";
  if (notes.abbreviationUsed) r += ' Write it out in full in the exam — an abbreviation can be ambiguous (LLL is the left lobe of the liver in the abdomen but the left lower lobe in the chest), so it may not always be credited.';
  return r;
}

// A whole answer that is nothing but a generic category noun ("bone",
// "artery") names no particular structure, so it must not reach the
// superset/qualifier logic — there it would look like a merely-imprecise
// version of the real answer and earn partial credit. Only fires when the
// official answer is genuinely more specific, so a question whose real
// answer IS the generic term still grades normally.
function isVagueAnswer(
  userCanon: string,
  officialCanon: string,
  variantCanons: string[] = []
): boolean {
  if (!userCanon || userCanon === officialCanon) return false;
  // An answer the question itself lists as acceptable cannot be too vague,
  // whatever category nouns it happens to use.
  if (variantCanons.includes(userCanon)) return false;
  const words = userCanon.split(' ').filter(Boolean);
  if (words.length === 0) return false;
  // A category noun is only vague in the abstract. When the official answer
  // IS that noun, saying it is the right answer: "atrium" was rejected as
  // vague against an official answer of "Right atrium (right heart border)".
  const official = new Set(officialCanon.split(' ').filter(Boolean));
  if (words.every((w) => official.has(w))) return false;
  return words.every((w) => VAGUE_ANSWERS.has(w));
}


// Built at module load: natural-language keys above are canonicalised so
// laterality, word order, articles and spelling variants all collapse onto
// one entry and the table itself stays readable.
const STRUCTURE_CUES: Map<string, string> = new Map(
  Object.entries(structureCuesRaw as Record<string, string>).map(([name, cue]) => [canonicalForm(name), cue])
);

// Resolves an official answer to its recognition cue. Canonical form is used
// as the key so laterality, word order, articles and spelling variants all
// collapse onto one entry.
function structureCue(officialAnswer: string): string | null {
  const key = canonicalForm(stripLaterality(officialAnswer).base);
  return STRUCTURE_CUES.get(key) ?? null;
}

/* The same lookup, for the Structure Atlas. The cue table is written and
   reviewed as teaching content, so the Atlas shows what is already there
   rather than carrying a second copy that could drift from it. */
export function recognitionCueFor(officialAnswer: string): string | null {
  return structureCue(officialAnswer);
}

/* Recognition teaching is attached in one place, to every result, rather than
   at each of the many exits below. A candidate who gets the structure right
   still has to learn how it was meant to be spotted — the exam is read off the
   image, so knowing the name without the cue is only half the mark. */
export function gradeAnswer(
  label: string,
  userAnswerRaw: string,
  spec: AnswerSpec
): GradedAnswer {
  const graded = gradeAnswerCore(label, userAnswerRaw, spec);
  const parts = [
    structureCue(spec.officialAnswer),
    confusionNote(userAnswerRaw || '', spec.officialAnswer),
  ].filter(Boolean);
  if (parts.length) graded.teaching = parts.join(' ');
  return graded;
}

function gradeAnswerCore(
  label: string,
  userAnswerRaw: string,
  spec: AnswerSpec
): GradedAnswer {
  const userAnswer = (userAnswerRaw || '').trim();
  const base: GradedAnswer = {
    label,
    userAnswer,
    result: 'unanswered',
    score: 0,
    maxScore: 2,
    officialAnswer: spec.officialAnswer,
    reason: '',
  };

  if (!userAnswer) {
    base.reason = 'No answer given.';
    return base;
  }

  // An ambiguous abbreviation ("LLL") is graded by trying each reading as a
  // COMPLETE answer and keeping the best. Done here, before laterality is
  // split off, so a reading like "left lobe of liver" still carries its side
  // and can be matched against a left/right-specific official answer. The
  // reading only wins if it fits this question, which is what resolves the
  // ambiguity between e.g. liver lobe and lung lobe.
  const readings = ambiguousReadings(userAnswer);
  if (readings.length > 0) {
    let best: GradedAnswer | null = null;
    for (const reading of readings) {
      const attempt = gradeAnswer(label, reading, spec);
      if (!best || attempt.score > best.score) best = attempt;
    }
    if (best && best.score > 0) {
      return {
        ...best,
        userAnswer,
        reason: `${best.reason} Write it out in full in the exam — an abbreviation can be ambiguous (LLL is the left lobe of the liver in the abdomen but the left lower lobe in the chest), so it may not always be credited.`,
      };
    }
  }

  const { base: officialAfterSide, side: officialSide } = stripLaterality(spec.officialAnswer);
  /* Tracks whether any credit-granting match below needed a fuzzy typo
     correction, so the feedback can gently note it (never for wrong-side,
     wrong-level, or no-match outcomes — only when credit was actually
     given). Declared here because the side is read off the EXPANDED answer,
     and that expansion is itself worth recording. */
  const spelling: SpellingTracker = { corrected: false, abbreviationUsed: false, synonymUsed: false, omittedQualifiers: [] };

  /* An acronym can carry the side inside it — "LHV" IS the left hepatic vein
     — so abbreviations are expanded BEFORE the side is read off. Reading the
     raw text instead found no side word and docked a mark for laterality the
     learner had in fact given. */
  const expandedUser = expandPhraseSynonyms(
    expandAbbreviations(normalizeBase(userAnswer), spelling),
    spelling
  );
  const { base: userAfterSide, side: userSide } = stripLaterality(expandedUser);
  /* Defended rather than trusted. Every shipped spec carries this and both
     authoring tools always write it, but a spec also reaches here from an
     override in the author's own localStorage — and an unhandled throw in the
     grader takes down the whole question at the moment the candidate submits,
     which is the worst possible time to lose their work. */
  const variantBases = (spec.acceptedVariants ?? []).map((v) => stripLaterality(v).base);

  // The side is unambiguously wrong regardless of anything else — this
  // always overrides down to 0, never just a precision penalty.
  const sideContradicted = spec.lateralityRequired && !!userSide && userSide !== officialSide;

  // A bare category noun identifies nothing — reject before the
  // superset/qualifier logic can read it as a merely-imprecise answer.
  if (
    isVagueAnswer(
      canonicalForm(userAfterSide),
      canonicalForm(officialAfterSide),
      variantBases.map((v) => canonicalForm(v))
    )
  ) {
    base.result = 'incorrect';
    base.score = 0;
    base.reason = `"${userAnswer}" is too vague — it doesn't identify the labelled structure. The answer is "${spec.officialAnswer}".`;
    return base;
  }

  // Phase 1: direct match (handles synonyms like C1/atlas, redundant-word
  // supersets, dropped precision qualifiers, spelling/typo tolerance) with
  // no level-qualifier stripping.
  let quality = structureMatchQuality(userAfterSide, officialAfterSide, variantBases, spelling);
  let levelOmitted = false;
  let wrongLevel = false;
  let requiredLevel: string | null = null;

  // Phase 2: only if phase 1 found no overlap at all, try treating a
  // vertebral/spinal level as a separable qualifier (e.g. "intervertebral
  // disc" vs official "intervertebral disc C7-T1") the same way laterality
  // is handled.
  if (quality === 'none') {
    const official = extractLevel(officialAfterSide);
    if (official.level) {
      requiredLevel = official.level;
      const user = extractLevel(userAfterSide);
      const coreQuality = structureMatchQuality(user.core, official.core, variantBases.map((v) => extractLevel(v).core), spelling);
      if (coreQuality === 'exact') {
        if (!user.level) {
          quality = 'exact';
          levelOmitted = true;
        } else if (user.level === official.level) {
          quality = 'exact';
        } else {
          wrongLevel = true;
        }
      }
    }
  }

  if (wrongLevel) {
    base.result = 'incorrect';
    base.score = 0;
    base.reason = `Right structure, wrong level — this one is ${requiredLevel}.`;
    return base;
  }

  if (quality === 'none') {
    base.result = 'incorrect';
    base.score = 0;
    base.reason = `Not quite — this is the ${lowerFirst(stripTrailingPeriod(spec.officialAnswer))}.`;
    return base;
  }

  if (sideContradicted) {
    base.result = 'incorrect';
    base.score = 0;
    base.reason = `Right structure, wrong side — this is the ${officialSide} one.`;
    return base;
  }

  // Right structure family, but missing a precision qualifier the official
  // answer specified (e.g. "clavicle" for "distal left clavicle", or
  // "coracoid process" for "coracoid process of left scapula") — capped at
  // partial credit even if laterality happened to be given correctly,
  // since the answer still falls short of the full official answer.
  if (quality === 'imprecise') {
    base.result = 'partial';
    base.score = 1;
    {
      const missing = spelling.omittedQualifiers.filter((w) => QUALIFIER_NOTES[w]);
      const teach = missing.length ? ` ${QUALIFIER_NOTES[missing[0]]}` : '';
      base.reason = withNotes(
        `Right structure, but be more specific: ${lowerFirst(stripTrailingPeriod(spec.officialAnswer))}.${teach}`,
        spelling
      );
    }
    return base;
  }

  if (spec.lateralityRequired) {
    if (!userSide) {
      base.result = 'partial';
      base.score = 1;
      base.reason = withNotes(`Right structure — say which side, though: this is the ${officialSide}.`, spelling);
      return base;
    }
    base.result = 'correct';
    base.score = 2;
    base.reason = withNotes('Correct, side included.', spelling, spec.officialAnswer);
    return base;
  }

  if (levelOmitted) {
    base.result = 'partial';
    base.score = 1;
    base.reason = withNotes(`Right structure — give the level too: this one is ${requiredLevel}.`, spelling);
    return base;
  }

  base.result = 'correct';
  base.score = 2;
  base.reason = withNotes('Correct.', spelling, spec.officialAnswer);
  return base;
}

export function overallResult(results: LabelResult[]): LabelResult {
  if (results.length === 0) return 'unanswered';
  if (results.every((r) => r === 'unanswered')) return 'unanswered';
  if (results.every((r) => r === 'correct')) return 'correct';
  if (results.some((r) => r === 'correct' || r === 'partial')) return 'partial';
  return 'incorrect';
}

// Generates a conservative, controlled list of hidden accepted spelling
// variants for grading purposes only. The officially displayed answer is
// never altered by this — see teachingPoint/officialAnswer in AnswerSpec.
export function generateAcceptedVariants(officialAnswer: string): string[] {
  const variants = new Set<string>();
  const noArticle = officialAnswer.replace(/\bthe\b\s*/gi, '').trim();
  if (noArticle !== officialAnswer) variants.add(noArticle);
  const noOf = officialAnswer.replace(/\s+of\s+the\s+/gi, ' of ');
  if (noOf !== officialAnswer) variants.add(noOf);
  return Array.from(variants).filter(Boolean);
}
