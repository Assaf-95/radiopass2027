import type { Question, SectionId, SectionMeta } from '../types';
import { getCustomQuestions } from '../lib/customQuestions';
import { applyEdit, getEdit } from '../lib/questionEdits';
import { applyOverlay } from '../lib/content/store';

import spineData from './spine.json';
import upperLimbData from './upperLimb.json';
import lowerLimbData from './lowerLimb.json';
import thoraxData from './thorax.json';
import headNeckData from './headNeck.json';
import abdoPelvisData from './abdoPelvis.json';

export const SECTION_META: SectionMeta[] = [
  {
    id: 'upper-limb',
    title: 'Upper Limb',
    description: 'Shoulder girdle, humerus, elbow, forearm, wrist and hand.',
    modalities: [],
  },
  {
    id: 'lower-limb',
    title: 'Lower Limb',
    description: 'Hip, femur, knee, tibia/fibula, ankle and foot.',
    modalities: ['Plain Film', 'Angiography', 'Ultrasound', 'Cross-sectional imaging', 'Hip', 'Knee', 'Ankle and Foot'],
  },
  {
    id: 'head-neck',
    heroImage: '/images/section-hero/head-neck.jpg',
    title: 'Head and Neck',
    description: 'Skull base, facial bones, orbits, sinuses, temporal bones, neck.',
    modalities: [],
  },
  {
    id: 'spine',
    title: 'Spine',
    description: 'Cervical, thoracic, lumbar spine, sacrum and coccyx.',
    modalities: ['Plain Film', 'Ultrasound', 'Cross-sectional imaging'],
  },
  {
    id: 'thorax',
    title: 'Thorax',
    description: 'Chest wall, lungs, mediastinum, heart and great vessels.',
    modalities: ['Plain Film', 'Fluoroscopy', 'Angiography', 'Ultrasound', 'Cross-sectional imaging'],
  },
  {
    id: 'abdo-pelvis',
    title: 'Abdomen and Pelvis',
    description: 'GI tract, liver, biliary tree, urinary tract, male and female pelvis.',
    modalities: ['Plain Film', 'Ultrasound', 'Fluoroscopy', 'Angiography', 'Biliary imaging', 'Cross-sectional imaging', 'MRI Pelvis'],
  },
];

const DATA: Record<SectionId, Question[]> = {
  spine: spineData as unknown as Question[],
  'upper-limb': upperLimbData as unknown as Question[],
  'lower-limb': lowerLimbData as unknown as Question[],
  thorax: thoraxData as unknown as Question[],
  'head-neck': headNeckData as unknown as Question[],
  'abdo-pelvis': abdoPelvisData as unknown as Question[],
};

export function getStaticSectionQuestions(section: SectionId): Question[] {
  return DATA[section] ?? [];
}

/* A handful of source "images" are printed answer pages rather than films —
   they show the answers, so serving them would give the question away. They
   stay in the data (flagged, never deleted) and are filtered out of play
   until a real image is supplied. */
export function getSectionQuestions(section: SectionId): Question[] {
  /* THE join between the two interfaces. Both the Question Bank and the
     Structure Atlas read questions through this function, so both see the
     same resolved record and neither can drift from the other.

     Two layers go on, in order:
       1. applyOverlay  — the online editor's saved changes, from the content
                          API. Shared by every visitor and every device.
       2. applyEdit     — the older local-only authoring override, kept so a
                          static deployment with no API still has working
                          authoring tools. Applied second so a local draft
                          wins on the machine it was drafted on.

     A question with neither passes through untouched. */
  const base = (DATA[section] ?? [])
    .filter((q) => !q.excludeFromPlay)
    .map((q) => applyEdit(applyOverlay(q), getEdit(q.id)));
  const custom = getCustomQuestions(section).map(applyOverlay);
  return custom.length === 0 ? base : [...base, ...custom];
}

export function getQuestionById(id: string): Question | undefined {
  for (const section of Object.keys(DATA) as SectionId[]) {
    const found = getSectionQuestions(section).find((q) => q.id === id);
    if (found) return found;
  }
  return undefined;
}

/* Returns undefined for an id that is not a section. The non-null assertion
   that used to be here was a lie: a mistyped or stale URL like
   #/section/nope reached the page as `undefined` and crashed it to a blank
   screen on the first property read. */
export function getSectionMeta(id: SectionId): SectionMeta | undefined {
  return SECTION_META.find((s) => s.id === id);
}

export function allModalitiesForSection(section: SectionId): string[] {
  const set = new Set<string>();
  for (const q of getSectionQuestions(section)) set.add(q.modalitySection);
  return Array.from(set);
}

export function allRegionsForSection(section: SectionId): string[] {
  const set = new Set<string>();
  for (const q of getSectionQuestions(section)) for (const t of q.regionTags) set.add(t);
  return Array.from(set).sort();
}
