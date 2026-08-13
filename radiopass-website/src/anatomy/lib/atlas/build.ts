/* ===========================================================================
   Structure Atlas — building the index.

   Pure: questions in, atlas out. No imports from the app, no localStorage, no
   React — which is what lets the same function run inside the browser and
   inside `npm run atlas:report`, so the audit and the site can never disagree
   about what the Atlas contains.

   The question bank is the ONLY source. Every structure exists because some
   question labels it, every image exists because that question uses it, and
   adding a question to the bank adds its structures here with no further
   work. Nothing is invented and nothing is hard-coded per chapter.
   =========================================================================== */

import type { Question } from '../../types';
import { ATLAS_CHAPTERS, chaptersForQuestion, type ChapterId } from '../../data/atlas/chapters';
import {
  EXTRA_ALIASES,
  MERGE_KEYS,
  NAME_OVERRIDES,
  REPRESENTATIVE_IMAGES,
  SIDE_IS_IDENTITY_KEYS,
  SIDE_IS_IDENTITY_WORDS,
  SIDE_IS_QUALIFIER_KEYS,
  STRUCTURE_NOTES,
  KEEP_SEPARATE_FAMILIES,
} from '../../data/atlas/atlasOverrides';
import { IMAGE_NOTES, PLANE_PATTERNS } from '../../data/atlas/imageNotes';
import {
  ABSORBABLE_WORDS,
  isCategoryOnly,
  isMeasurementAnswer,
  isNeutralAbsorbable,
  parseStructureName,
  PARENT_BONES,
  slugify,
  structureKey,
  tidy,
  TISSUE_WORDS,
} from './normalise';
import { familyKey, familyName } from './related';
import type { StudyImage } from './studies';
import type {
  AtlasChapter,
  AtlasCompanion,
  AtlasImage,
  AtlasIndex,
  AtlasMarker,
  AtlasStructure,
} from './types';

/* --- Side policy ----------------------------------------------------------
   Asked once per structure, with the side already removed, so the question
   is exactly "would pooling left and right here be an anatomical error?" */
function sideIsIdentity(coreKey: string): boolean {
  if (SIDE_IS_QUALIFIER_KEYS.has(coreKey)) return false;
  if (SIDE_IS_IDENTITY_KEYS.has(coreKey)) return true;
  return coreKey.split(' ').some((w) => SIDE_IS_IDENTITY_WORDS.has(w));
}

const PARSE_OPTIONS = { sideIsIdentity };

/* --- Per-film facts ------------------------------------------------------ */

/** Reads an imaging plane out of the question's own projection line, and only
 *  out of that. A film nobody described stays undescribed. */
function planeOf(q: Question): string | null {
  /* An editor's online value first, then the checked-in notes file, then the
     question's own projection line. Nothing is guessed at any step. */
  if (q.atlasNote?.plane) return q.atlasNote.plane;
  const note = IMAGE_NOTES[q.id];
  if (note?.plane) return note.plane;
  const text = q.projection ?? '';
  if (!text.trim()) return null;
  for (const [re, plane] of PLANE_PATTERNS) if (re.test(text)) return plane;
  return null;
}

function descriptionOf(q: Question): string {
  if (q.atlasNote?.description) return q.atlasNote.description;
  const note = IMAGE_NOTES[q.id];
  if (note?.description) return note.description;
  // The projection line IS the author's own caption. Used verbatim, minus a
  // trailing full stop so captions sit evenly under the films.
  return tidy(q.projection ?? '').replace(/\.$/, '');
}

/** Every badge on one film, worked out once and shared by all of its labels.
 *
 *  Two shapes exist in the bank and both are handled exactly as the question
 *  player handles them: an extracted atlas page carries `labelGlyphs`, the
 *  spot where the source printed its own letter, which our badge covers in
 *  place; an authored or edited case carries `markerPositions` with our own
 *  arrow drawn to it. A question with neither has its letters burned into the
 *  film itself and needs no overlay at all. */
function markersOf(q: Question): AtlasMarker[] {
  if (q.labelGlyphs?.length) {
    return q.labelGlyphs.map((g, i) => ({
      id: `${g.letter}-${i}`,
      label: g.letter,
      x: g.x,
      y: g.y,
      sizePct: (g.sizePct ?? 3) * 1.5,
    }));
  }
  if (q.markerPositions) {
    return q.labels
      .filter((l) => q.markerPositions?.[l])
      .map((l) => ({
        id: l,
        label: l,
        x: q.markerPositions![l].x,
        y: q.markerPositions![l].y,
        labelX: q.markerLabelPositions?.[l]?.x,
        labelY: q.markerLabelPositions?.[l]?.y,
        thickness: q.markerArrows?.[l]?.thickness,
        headSize: q.markerArrows?.[l]?.headSize,
        shape: q.markerShapes?.[l] ?? 'arrow',
        circlePct: q.markerCirclePct?.[l],
        angle: q.markerAngles?.[l],
        lengthPct: q.markerLengthPct?.[l],
        colour: q.markerColours?.[l],
      }));
  }
  return [];
}

/* --- The build ----------------------------------------------------------- */

interface Bucket {
  key: string;
  chapter: ChapterId;
  /** Set when several structures were folded into one entity, so the card is
   *  titled "Aorta" rather than after whichever member happened to win a
   *  vote between "Abdominal aorta" and "Arch of aorta". */
  forcedName?: string;
  /** Every key that resolves to this structure — its own, plus the key of
   *  anything merged into it. A companion on a film still carries the key its
   *  own answer produced, so without this a structure that was merged away
   *  becomes an unlinkable dead name in the legend. */
  keys: Set<string>;
  images: AtlasImage[];
  /** Every display spelling seen, and how many labels used it. The most
   *  used one names the structure, so the Atlas speaks the bank's own
   *  vocabulary rather than one imposed here. */
  names: Map<string, number>;
  aliases: Set<string>;
}

function addAlias(set: Set<string>, value: string) {
  const t = tidy(value);
  if (t.length > 1) set.add(t);
}

export interface BuildOptions {
  /** Recognition cues already held by the marking engine, keyed however the
   *  caller likes; looked up by official answer. Optional: the audit script
   *  runs without it. */
  recognitionCue?: (officialAnswer: string) => string | null;
  /** Labelled images that do not come from a question — the CT and MRI
   *  studies and the chest radiograph atlas. They are keyed by exactly the
   *  same normalisation, so a CT frontal sinus joins the plain-film frontal
   *  sinus on one page instead of starting a second one. */
  studies?: StudyImage[];
}

export function buildAtlas(questions: Question[], options: BuildOptions = {}): AtlasIndex {
  const buckets = new Map<string, Bucket>(); // `${chapter}|${key}`
  const skipped: { questionId: string; reason: string }[] = [];
  const filmsPerChapter = new Map<ChapterId, Set<string>>();
  let filmsUsed = 0;

  for (const q of questions) {
    if (!q.imagePath) {
      /* Either never had one, or an editor removed it online. Removing a
         film from a question removes it from every Atlas gallery here, with
         no Atlas-side bookkeeping and nothing left dangling. */
      skipped.push({
        questionId: q.id,
        reason: q.imageRemoved ? 'image removed by an editor' : 'no image path',
      });
      continue;
    }
    if (q.excludeFromAtlas) {
      skipped.push({ questionId: q.id, reason: 'withheld from the Atlas by an editor' });
      continue;
    }
    const answered = (q.labels ?? []).filter((l) => q.answers?.[l]?.officialAnswer?.trim());
    /* A few questions ask for a normal calibre rather than a name. "6 mm" is
       a fact about a structure, not a structure, so it is reported here
       instead of becoming a card nobody could use. */
    /* A label may be hidden from the CANDIDATE and still belong in the Atlas —
       that is the whole point of keeping the two switches apart — so only an
       explicit Atlas withdrawal drops one here. */
    const withheld = new Set(q.atlasExcludedLabels ?? []);
    const labels = answered.filter(
      (l) => !isMeasurementAnswer(q.answers[l].officialAnswer) && !withheld.has(l)
    );
    for (const l of answered) {
      if (!labels.includes(l)) {
        skipped.push({
          questionId: `${q.id}:${l}`,
          reason: `answer is a measurement, not a structure ("${q.answers[l].officialAnswer}")`,
        });
      }
    }
    if (labels.length === 0) {
      skipped.push({ questionId: q.id, reason: 'no answered labels' });
      continue;
    }

    const chapters = chaptersForQuestion(q);
    const markers = markersOf(q);
    const description = descriptionOf(q);
    const note = IMAGE_NOTES[q.id];
    const plane = planeOf(q);
    const modality = (q.atlasNote?.modality as typeof q.imagingModality) ?? note?.modality ?? q.imagingModality;

    // Parsed once per label, then reused for this film's own entry and for
    // its appearance in every other label's companion list.
    const parsed = labels.map((label) => ({
      label,
      answer: q.answers[label],
      parsed: parseStructureName(q.answers[label].officialAnswer, PARSE_OPTIONS),
    }));

    filmsUsed++;

    for (const entry of parsed) {
      const { label, answer, parsed: p } = entry;

      const companions: AtlasCompanion[] = parsed
        .filter((other) => other.label !== label && other.parsed.key !== p.key)
        .map((other) => ({
          label: other.label,
          officialAnswer: other.answer.officialAnswer,
          structureKey: other.parsed.key,
        }));

      const image: AtlasImage = {
        id: `${q.id}:${label}`,
        questionId: q.id,
        section: q.section,
        label,
        officialAnswer: answer.officialAnswer,
        src: q.imagePath,
        crop: q.imageCrop,
        orientation: q.imageOrientation,
        markers,
        markerSizePct: q.markerSizePct,
        description,
        modality,
        modalitySection: q.modalitySection,
        plane,
        sequence: q.atlasNote?.sequence ?? note?.sequence ?? null,
        level: p.level,
        side: p.side,
        sideInName: p.sideInKey,
        caseLabel: q.caseLabel,
        sourceFile: q.sourceFile,
        questionNumber: q.questionNumber,
        teachingText: q.teachingText,
        relationships: q.atlasRelationships ?? [],
        companions,
        labelCount: labels.length,
      };

      for (const chapter of chapters) {
        let films = filmsPerChapter.get(chapter);
        if (!films) filmsPerChapter.set(chapter, (films = new Set()));
        films.add(q.id);

        const id = `${chapter}|${p.key}`;
        let bucket = buckets.get(id);
        if (!bucket) {
          bucket = {
            key: p.key,
            chapter,
            keys: new Set([p.key]),
            images: [],
            names: new Map(),
            aliases: new Set(),
          };
          buckets.set(id, bucket);
        }
        /* One film may label the same structure twice — the same asset under
           two letters. Shown once: it is the same picture of the same thing,
           which is what §"multiple images" asks to be deduplicated, as
           against two different films of one structure, which are both
           kept. */
        if (!bucket.images.some((i) => i.src === image.src && i.officialAnswer === image.officialAnswer)) {
          bucket.images.push(image);
        }
        bucket.names.set(p.display, (bucket.names.get(p.display) ?? 0) + 1);
        for (const a of p.aliases) addAlias(bucket.aliases, a);
        addAlias(bucket.aliases, answer.officialAnswer);
        for (const v of answer.acceptedVariants ?? []) addAlias(bucket.aliases, v);
      }
    }
  }

  /* --- The studies ------------------------------------------------------
     Same buckets, same keying, same merging as the question bank. The only
     difference is that a study states its chapters outright, having no region
     tags to derive them from. */
  for (const { image, chapters, structureName } of options.studies ?? []) {
    const parsed = parseStructureName(structureName, PARSE_OPTIONS);

    /* Companions arrive without keys — keying belongs to the builder, so the
       study file cannot drift from the question bank's normalisation. */
    const resolved: AtlasImage = {
      ...image,
      companions: image.companions.map((c) => ({
        ...c,
        structureKey: parseStructureName(c.officialAnswer, PARSE_OPTIONS).key,
      })),
    };

    for (const chapter of chapters) {
      let films = filmsPerChapter.get(chapter);
      if (!films) filmsPerChapter.set(chapter, (films = new Set()));
      films.add(resolved.questionId);

      const id = `${chapter}|${parsed.key}`;
      let bucket = buckets.get(id);
      if (!bucket) {
        bucket = {
          key: parsed.key,
          chapter,
          keys: new Set([parsed.key]),
          images: [],
          names: new Map(),
          aliases: new Set(),
        };
        buckets.set(id, bucket);
      }
      if (!bucket.images.some((i) => i.id === resolved.id)) bucket.images.push(resolved);
      bucket.names.set(parsed.display, (bucket.names.get(parsed.display) ?? 0) + 1);
      for (const a of parsed.aliases) addAlias(bucket.aliases, a);
    }
  }

  /* Hand-declared merges, applied after collection so they can name any two
     keys regardless of the order the questions were read in. */
  for (const [canonical, mergedIn] of MERGE_KEYS) {
    for (const chapter of ATLAS_CHAPTERS) {
      const target = buckets.get(`${chapter.id}|${canonical}`);
      const source = buckets.get(`${chapter.id}|${mergedIn}`);
      if (!target || !source) continue;
      foldInto(target, source);
      buckets.delete(`${chapter.id}|${mergedIn}`);
    }
  }

  /* Two structures that name each other are one structure written twice —
     "Sella turcica or pituitary fossa" on one page and "Pituitary fossa or
     sella turcica" on another. The test is mutual on purpose: a one-way
     mention is a cross-reference, not an identity. */
  mergeMutualAliases(buckets);

  /* "Greater trochanter of the femur" folded into "Greater trochanter", and
     "Acromion of scapula" into "Acromion process". */
  absorbQualifiers(buckets);

  /* Then the parts fold into the whole: every aorta under Aorta, every
     carotid under Carotid artery, every part of the humerus under Humerus. */
  mergeFamilies(buckets);

  /* --- Assemble ---------------------------------------------------------- */

  const byChapter = new Map<ChapterId, Map<string, AtlasStructure>>();
  const byKey = new Map<string, AtlasStructure[]>();
  const chapters: AtlasChapter[] = [];
  /* Which keys each finished structure answers to, carried out of its
     bucket so companion links resolve even after a merge. */
  const keysOf = new Map<AtlasStructure, Set<string>>();
  let totalStructures = 0;
  let totalImages = 0;

  for (const meta of ATLAS_CHAPTERS) {
    const mine = [...buckets.values()].filter((b) => b.chapter === meta.id);
    const slugs = new Map<string, number>();
    const structures: AtlasStructure[] = [];

    for (const bucket of mine) {
      const name = NAME_OVERRIDES[bucket.key] ?? bucket.forcedName ?? preferredName(bucket.names);

      let slug = slugify(name);
      const seen = slugs.get(slug) ?? 0;
      slugs.set(slug, seen + 1);
      if (seen > 0) slug = `${slug}-${seen + 1}`;

      const images = [...bucket.images].sort(imageOrder);
      const representative =
        images.find((i) => i.id === REPRESENTATIVE_IMAGES[bucket.key]) ??
        pickRepresentative(images);

      const aliases = tidyAliases(bucket.aliases, EXTRA_ALIASES[bucket.key] ?? [], name);

      const notes = STRUCTURE_NOTES[bucket.key] ?? {};
      const cue =
        notes.keyRecognitionFeature ??
        options.recognitionCue?.(representative.officialAnswer) ??
        undefined;

      const structure: AtlasStructure = {
        id: slug,
        key: bucket.key,
        name,
        aliases,
        chapter: meta.id,
        images,
        representative,
        description: notes.description,
        keyRecognitionFeature: cue ?? undefined,
        commonPitfall: notes.commonPitfall,
        examTip: notes.examTip,
        modalities: [...new Set(images.map((i) => i.modality))].sort(),
        planes: [...new Set(images.map((i) => i.plane).filter((p): p is string => !!p))].sort(),
        variants: variantsOf(images),
      };
      keysOf.set(structure, bucket.keys);
      structures.push(structure);
    }

    structures.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

    const bySlug = new Map<string, AtlasStructure>();
    for (const s of structures) {
      bySlug.set(s.id, s);
      for (const key of keysOf.get(s) ?? [s.key]) {
        const list = byKey.get(key);
        if (list) { if (!list.includes(s)) list.push(s); }
        else byKey.set(key, [s]);
      }
    }
    byChapter.set(meta.id, bySlug);

    const imageCount = structures.reduce((n, s) => n + s.images.length, 0);
    totalStructures += structures.length;
    totalImages += imageCount;

    chapters.push({
      ...meta,
      structures,
      filmCount: filmsPerChapter.get(meta.id)?.size ?? 0,
      imageCount,
    });
  }

  return {
    chapters,
    byChapter,
    byKey,
    skipped,
    totals: {
      questions: questions.length,
      films: filmsUsed,
      structures: totalStructures,
      images: totalImages,
    },
  };
}

/* --- Folding the parts into the whole -------------------------------------

   The owner's rule: one entity per organ. "Any carotid artery will go under
   carotid artery, either common carotid, internal carotid, external
   carotid... Humerus is the same if it's the head of the humerus, body,
   shaft of the humerus, it's a humerus."

   So structures whose names reduce to the same entity are folded together,
   and the card is titled after the entity. Nothing is lost: each image keeps
   the exact answer the book printed, and the page groups them under their own
   sub-headings, so a descending thoracic aorta is still labelled as one.

   A family listed in KEEP_SEPARATE_FAMILIES is left alone. */
function mergeFamilies(buckets: Map<string, Bucket>) {
  const groups = new Map<string, Bucket[]>();

  for (const bucket of buckets.values()) {
    const family = familyKey(bucket.key);
    if (!family || KEEP_SEPARATE_FAMILIES.has(family)) continue;
    const id = `${bucket.chapter}|${family}`;
    const list = groups.get(id);
    if (list) list.push(bucket);
    else groups.set(id, [bucket]);
  }

  for (const [id, members] of groups) {
    if (members.length < 2) continue;
    const family = id.slice(id.indexOf('|') + 1);

    /* Every image is stamped with the name of the structure it came from
       BEFORE the merge, which is what lets the page group them afterwards. */
    for (const member of members) {
      const label = NAME_OVERRIDES[member.key] ?? preferredName(member.names);
      for (const image of member.images) {
        if (!image.variantName) image.variantName = label;
      }
    }

    const keep = [...members].sort((a, b) => b.images.length - a.images.length)[0];
    for (const member of members) {
      if (member === keep) continue;
      foldInto(keep, member);
      buckets.delete(`${member.chapter}|${member.key}`);
    }
    keep.forcedName = familyName(family);
  }
}

/** The parts this entity is made of, in the order they should be read: the
 *  best-covered first, so the page opens on the fullest set of films. */
function variantsOf(images: AtlasImage[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const i of images) counts.set(i.variantName ?? '', (counts.get(i.variantName ?? '') ?? 0) + 1);
  return [...counts.entries()]
    .filter(([name]) => name)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/* --- Helpers ------------------------------------------------------------- */

/** Folds `source` into `target`. Images are deduplicated on the film plus the
 *  answer, so one picture of one structure appears once however many routes
 *  led to it. */
function foldInto(target: Bucket, source: Bucket) {
  for (const img of source.images) {
    if (!target.images.some((i) => i.src === img.src && i.officialAnswer === img.officialAnswer)) {
      target.images.push(img);
    }
  }
  for (const [n, c] of source.names) target.names.set(n, (target.names.get(n) ?? 0) + c);
  for (const a of source.aliases) target.aliases.add(a);
  for (const k of source.keys) target.keys.add(k);
}

function mergeMutualAliases(buckets: Map<string, Bucket>) {
  for (const [id, bucket] of [...buckets]) {
    if (!buckets.has(id)) continue;
    for (const alias of bucket.aliases) {
      const otherKey = `${bucket.chapter}|${keyOfAlias(alias)}`;
      if (otherKey === id) continue;
      const other = buckets.get(otherKey);
      if (!other) continue;
      const mutual = [...other.aliases].some((a) => keyOfAlias(a) === bucket.key);
      if (!mutual) continue;
      // Larger absorbs smaller, so the merge is order-independent.
      const [keep, drop] =
        bucket.images.length >= other.images.length ? [bucket, other] : [other, bucket];
      const dropId = `${drop.chapter}|${drop.key}`;
      foldInto(keep, drop);
      buckets.delete(dropId);
      if (dropId === id) break;
    }
  }
}

/* --- Absorbing a parent or a tissue word ---------------------------------

   "Greater trochanter of the femur" is "Greater trochanter"; "Profunda
   femoris artery" is "Profunda femoris". Both differ from the shorter name
   by one word that says which bone the landmark sits on, or what tissue the
   structure is made of.

   The whole safety of this rests on one condition, checked across the whole
   chapter: the shorter name must already exist AND exactly one longer name
   may reduce to it. That is what keeps the coronoid process of the ulna
   away from the coronoid process of the mandible when a chapter happens to
   contain both, and — the case that would be worst of all — what keeps the
   hepatic artery and the hepatic vein from meeting on "Liver". */
function absorbQualifiers(buckets: Map<string, Bucket>) {
  // chapter|reduced key -> what could fold onto it, and by dropping which word.
  const groups = new Map<string, { bucket: Bucket; word: string }[]>();

  for (const bucket of buckets.values()) {
    const words = bucket.key.split(' ').filter(Boolean);
    if (words.length < 2) continue;

    /* Neutral words come out first and together: "external acoustic meatus of
       temporal bone" has to lose both "bone" and "temporal" to reach
       "external acoustic meatus", and one-at-a-time never gets there. */
    const core = words.filter((w) => !isNeutralAbsorbable(w));
    const droppedNeutral = core.length !== words.length;
    if (core.length === 0) continue;

    const candidates: { reduced: string; word: string }[] = [];
    // Always safe: dropping "bone" or "process" cannot change which
    // structure is meant, so this one runs even for the guarded names below.
    if (droppedNeutral) candidates.push({ reduced: core.join(' '), word: '' });

    /* A name that mentions TWO bones is describing a landmark of one ON the
       other — the frontal process of the zygoma, the temporal process of the
       zygomatic bone. Dropping either bone changes which structure is meant,
       so no bone or tissue is absorbed out of those. This is the guard that
       keeps the frontal process of the zygoma away from the frontal bone. */
    const namesTwoBones = core.filter((w) => PARENT_BONES.has(w)).length > 1;

    for (const word of namesTwoBones ? [] : core) {
      if (!ABSORBABLE_WORDS.has(word)) continue;
      const rest = core.filter((w) => w !== word);
      if (rest.length === 0) continue;
      // "Femoral artery" must never shorten to "Femur".
      if (TISSUE_WORDS.has(word) && rest.some((w) => PARENT_BONES.has(w))) continue;
      candidates.push({ reduced: rest.join(' '), word });
    }

    for (const { reduced, word } of candidates) {
      if (!reduced || reduced === bucket.key || isCategoryOnly(reduced)) continue;
      const id = `${bucket.chapter}|${reduced}`;
      const list = groups.get(id);
      if (list) list.push({ bucket, word });
      else groups.set(id, [{ bucket, word }]);
    }
  }

  for (const [targetId, sources] of groups) {
    /* The shorter name may or may not exist as a structure of its own.
       "Acromion" does, so everything folds into it; "Acromion process" and
       "Acromion of scapula" in a chapter with no bare "Acromion" fold into
       each other instead. One lone longer name with nothing to join is left
       exactly as it is. */
    const bare = buckets.get(targetId);
    const members = [...new Set([...(bare ? [bare] : []), ...sources.map((s) => s.bucket)])].filter(
      (b) => buckets.has(`${b.chapter}|${b.key}`)
    );
    if (members.length < 2) continue;

    /* Two DIFFERENT bones or tissues folding onto one name is the dangerous
       case — the ulnar and the mandibular coronoid process meeting on
       "coronoid process", or the hepatic artery and the hepatic vein meeting
       on "liver". A region or a word like "process" never distinguishes two
       structures, so it never counts towards the conflict. */
    const discriminating = new Set(
      sources.map((s) => s.word).filter((w) => w && !isNeutralAbsorbable(w))
    );
    if (discriminating.size > 1) continue;

    // The bare name wins if it exists; otherwise the best-evidenced spelling.
    const target =
      bare ?? [...members].sort((a, b) => b.images.length - a.images.length || a.key.localeCompare(b.key))[0];

    for (const source of members) {
      if (source === target) continue;
      const sourceId = `${source.chapter}|${source.key}`;
      if (!buckets.has(sourceId)) continue;
      foldInto(target, source);
      buckets.delete(sourceId);
    }
  }
}

/* Aliases are compared in the same normalised space as names, so "Sella
   turcica" and "sella turcica." are one string. */
function keyOfAlias(alias: string): string {
  return structureKey(tidy(alias));
}

/* The wording the most labels used.

   Ties are broken on content — words that are not "of", "the" or "and". More
   content means a fuller name, so "Sternocleidomastoid muscle" beats
   "Sternomastoid". Equal content means the two are the same name written two
   ways, and then the shorter is the better title: "Aortic arch" over "Arch
   of aorta", "Acromion process" over "Acromion of scapula". */
const FILLER = new Set(['of', 'the', 'a', 'an', 'and', 'to', 'in', 'on', 'at']);

function contentWords(s: string): number {
  return s.toLowerCase().split(/\s+/).filter((w) => w && !FILLER.has(w)).length;
}

/* "Aortic knuckle" and "aortic knuckle" are one alias, and a bare "arch"
   under a structure called "Aortic arch" is noise. Search still matches on
   the structure's own name, so nothing is lost by dropping either. */
function tidyAliases(harvested: Set<string>, extra: string[], name: string): string[] {
  const nameWords = new Set(name.toLowerCase().split(/\s+/));
  const byLower = new Map<string, string>();
  for (const raw of [...harvested, ...extra]) {
    const a = raw.trim();
    const lower = a.toLowerCase();
    if (!a || lower === name.toLowerCase()) continue;
    // A single word the name already uses adds nothing.
    if (!lower.includes(' ') && nameWords.has(lower)) continue;
    const seen = byLower.get(lower);
    // Prefer the form that is not shouting: lower case reads as prose in the
    // "Also written ..." line, which is where these appear.
    if (!seen || (seen[0] === seen[0].toUpperCase() && a[0] === a[0].toLowerCase())) {
      byLower.set(lower, a);
    }
  }
  return [...byLower.values()].sort((a, b) => a.length - b.length || a.localeCompare(b));
}

function preferredName(names: Map<string, number>): string {
  let best = '';
  let bestCount = -1;
  for (const [name, count] of names) {
    const better =
      count > bestCount ||
      (count === bestCount &&
        (contentWords(name) > contentWords(best) ||
          (contentWords(name) === contentWords(best) &&
            (name.length < best.length ||
              (name.length === best.length && name.localeCompare(best) < 0)))));
    if (better) {
      best = name;
      bestCount = count;
    }
  }
  return best || 'Structure';
}

/* Films are shown in a stable, meaningful order: modality first so the same
   kind of picture sits together, then the module, then the question. */
function imageOrder(a: AtlasImage, b: AtlasImage): number {
  return (
    a.modality.localeCompare(b.modality) ||
    a.section.localeCompare(b.section) ||
    a.questionNumber - b.questionNumber ||
    a.label.localeCompare(b.label)
  );
}

/** The least cluttered film that shows this structure: fewest other labels
 *  competing with it, and a described film in preference to an undescribed
 *  one when they are otherwise equal. */
function pickRepresentative(images: AtlasImage[]): AtlasImage {
  return [...images].sort(
    (a, b) =>
      a.labelCount - b.labelCount ||
      Number(!!b.description) - Number(!!a.description) ||
      a.id.localeCompare(b.id)
  )[0];
}
