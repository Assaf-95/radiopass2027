import type { ImagingModality, ImageOrientation, SectionId } from '../../types';
import type { ChapterId } from '../../data/atlas/chapters';

/** Region of the file that is actually the film, as fractions of the file's
 *  own width and height. Same shape the question player uses. */
export interface AtlasCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One badge on a film. Percentages of the rendered image, exactly as the
 *  question player stores them, so an Atlas film and a question film mark
 *  the same anatomy in the same place. */
export interface AtlasMarker {
  id: string;
  /** The letter printed on the source page. */
  label: string;
  x: number;
  y: number;
  labelX?: number;
  labelY?: number;
  sizePct?: number;
  shape?: 'arrow' | 'point' | 'line' | 'circle' | 'arrow-point';
  circlePct?: number;
  angle?: number;
  lengthPct?: number;
  thickness?: number;
  headSize?: number;
  colour?: 'white' | 'black' | 'yellow' | 'blue';
}

/** Another structure taught by the same film. This is what turns the Atlas
 *  from a set of galleries into a map: every companion is a link. */
export interface AtlasCompanion {
  label: string;
  /** Verbatim from the question. Never rewritten. */
  officialAnswer: string;
  /** Grouping key of the structure it belongs to, for resolving the link. */
  structureKey: string;
}

/** One appearance of one structure on one film. */
export interface AtlasImage {
  /** `${questionId}:${label}` — stable, and what the overrides file names. */
  id: string;
  questionId: string;
  section: SectionId;
  /** The letter this structure is labelled with on the film. */
  label: string;
  /** The question's own answer, verbatim, including side and level. */
  officialAnswer: string;
  /** Path as written in the question data; assetUrl() is applied at render. */
  src: string;
  crop?: AtlasCrop;
  orientation?: ImageOrientation;
  /** Every badge on this film, shared by reference across the labels of one
   *  question so the film is only described once. */
  markers: AtlasMarker[];
  markerSizePct?: number;
  /** Short caption. The question's own projection line where it has one,
   *  otherwise empty — never guessed. */
  description: string;
  modality: ImagingModality;
  modalitySection: string;
  /** Read from the projection line only where it is unambiguous. Null means
   *  nobody has said, which is a fact rather than a gap to fill in. */
  plane: string | null;
  sequence: string | null;
  /** Vertebral level named in the answer, e.g. "C6". */
  level: string | null;
  side: 'left' | 'right' | null;
  /** True when the side is already part of the structure's name, so printing
   *  it again under the film would just repeat the heading. */
  sideInName: boolean;
  caseLabel: string | null;
  sourceFile: string;
  questionNumber: number;
  /** The question's teaching text, shown only behind a disclosure. */
  teachingText: string | null;
  /** Editor-written notes on how a neighbour sits relative to the structure
   *  being studied, on this film. Empty until someone writes one. */
  relationships: { target: string; neighbour: string; text: string }[];
  /** Where "view the original" goes. Absent for a question image, which goes
   *  to its question; set for a study slice or a chest film, which go to the
   *  viewer they belong to, deep-linked to the slice being shown. */
  sourceHref?: string;
  sourceLabel?: string;
  /** The other structures on this film. */
  companions: AtlasCompanion[];
  /** How many structures this film teaches in total, used to pick the least
   *  cluttered image as a chapter-card thumbnail. */
  labelCount: number;
  /** Which part of the entity this image was labelled as, before the parts
   *  were folded into the whole — "Descending thoracic aorta" on the Aorta
   *  page. Absent when the structure was never merged. */
  variantName?: string;
}

export interface AtlasStructure {
  /** Slug, unique within its chapter. */
  id: string;
  /** Normalised grouping key. Stable identity across renames. */
  key: string;
  /** What the card and the page are titled. */
  name: string;
  aliases: string[];
  chapter: ChapterId;
  images: AtlasImage[];
  /** Chosen automatically, or named in atlasOverrides.ts. */
  representative: AtlasImage;
  /** All four optional, all four blank unless written by hand — except the
   *  recognition cue, which the marking engine already carries for many
   *  structures and which is reused rather than rewritten. */
  description?: string;
  keyRecognitionFeature?: string;
  commonPitfall?: string;
  examTip?: string;
  /** Distinct modalities and planes present, for the chapter-level filters. */
  modalities: string[];
  planes: string[];
  /** The named parts folded into this entity, most-covered first. Empty when
   *  the structure stands on its own. */
  variants: { name: string; count: number }[];
}

export interface AtlasChapter {
  id: ChapterId;
  title: string;
  blurb: string;
  code: string;
  homeSection: SectionId;
  structures: AtlasStructure[];
  /** Distinct films in this chapter, which is smaller than the sum of the
   *  structures' image counts because one film teaches several structures. */
  filmCount: number;
  imageCount: number;
}

export interface AtlasIndex {
  chapters: AtlasChapter[];
  /** chapter id -> slug -> structure */
  byChapter: Map<ChapterId, Map<string, AtlasStructure>>;
  /** key -> every structure with that key, across all chapters. */
  byKey: Map<string, AtlasStructure[]>;
  /** Questions that carry no usable image or no answers, kept so the audit
   *  can report them rather than silently dropping them. */
  skipped: { questionId: string; reason: string }[];
  totals: { questions: number; films: number; structures: number; images: number };
}
