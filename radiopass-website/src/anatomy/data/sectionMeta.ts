/**
 * Region metadata — six rows, no question data.
 *
 * Split out of data/sections.ts because that module imports all six section
 * JSON files, so ANY import from it pulled the whole question bank: a 1 MB
 * javascript chunk. The anatomy home needs only these six titles, and paid
 * for the bank to get them.
 *
 * Nothing here may import the section JSON, directly or transitively. If it
 * ever does, the split silently stops working and the home gets slow again
 * with no test to notice — which is why sections.ts re-exports THIS rather
 * than the other way round.
 */

import type { SectionMeta } from '../types';

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
