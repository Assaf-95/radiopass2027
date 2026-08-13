/* Every scrollable stack in the app, keyed by the id in its route. The viewer
   is one component; the study it shows is data. */
import hipAxialT1 from './mri/hipAxialT1.json';
import headBone from './ct/headBone.json';
import type { MriStudy } from '../lib/mri/types';

export const STUDIES: Record<string, MriStudy> = {
  'hip-axial-t1': hipAxialT1 as unknown as MriStudy,
  'head-bone': headBone as unknown as MriStudy,
};

export interface StudyCard {
  id: string;
  title: string;
  blurb: string;
}

export const STUDY_LIST: StudyCard[] = [
  {
    id: 'head-bone',
    title: 'CT head — bone window',
    blurb: 'Sutures, sinuses, skull-base foramina, internal acoustic meatus and mastoid air cells.',
  },
  {
    id: 'hip-axial-t1',
    title: 'MRI hip — axial T1',
    blurb: 'Gluteals, rotator group, hip joint and the proximal thigh compartments.',
  },
];

export const DEFAULT_STUDY = 'head-bone';
