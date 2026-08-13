/* ===========================================================================
   Per-radiograph annotation coordinates

   Every structure carries its own coordinates for each film. Nothing is
   shared between them: the two patients differ in rotation, inspiration,
   magnification, scapular position and heart size, so a coordinate that is on
   the carina in one is in the aortic arch in the other.

   All values are fractions of the displayed image, 0..1, measured from the
   top-left of the radiograph itself (not the viewport), so they hold at any
   size and in full screen.

   `null` means the landmark is genuinely not demonstrable on that film. It is
   surfaced to the learner as "Not demonstrated on this radiograph" rather
   than being quietly pointed at where it ought to be.
   =========================================================================== */

export interface Placement {
  targetX: number;
  targetY: number;
  labelSide: 'left' | 'right';
  labelY: number;
  /** Set when the structure is present but its edge is only inferred. */
  uncertain?: boolean;
  /** Replaces the name when the film only supports the expected position. */
  qualifier?: string;
  verified?: boolean;
}

export interface Radiograph {
  id: string;
  label: string;
  file: string;
  width: number;
  height: number;
  projection: string;
  sideMarker: string;
  notes: string;
  placements: Record<number, Placement | null>;
}

/* --- Radiograph 1 ---------------------------------------------------------
   Adult PA chest, well inspired, R marker upper left of the image (patient's
   right). Mediastinum of normal width, heart not enlarged. Scapulae largely
   rotated clear of the lung fields. */
export const RADIOGRAPH_1: Radiograph = {
  id: 'radiograph-1',
  label: 'Radiograph 1',
  file: '/cxr/radiograph-1.png',
  width: 1004,
  height: 989,
  projection: 'PA erect',
  sideMarker: 'R marker upper left of image — patient’s right is on the viewer’s left',
  notes:
    'Well-inspired adult PA film. Both hemidiaphragms, both costophrenic angles and both apices are included. No radiopaque nipple markers have been applied.',
  placements: {
    1: { targetX: 0.588, targetY: 0.285, labelSide: 'right', labelY: 0.24 },
    2: { targetX: 0.245, targetY: 0.075, labelSide: 'left', labelY: 0.05 },
    3: { targetX: 0.588, targetY: 0.44, labelSide: 'right', labelY: 0.44 },
    4: { targetX: 0.335, targetY: 0.115, labelSide: 'left', labelY: 0.11 },
    5: { targetX: 0.235, targetY: 0.385, labelSide: 'left', labelY: 0.36 },
    6: { targetX: 0.435, targetY: 0.665, labelSide: 'left', labelY: 0.65 },
    7: { targetX: 0.695, targetY: 0.735, labelSide: 'right', labelY: 0.72 },
    8: { targetX: 0.9, targetY: 0.795, labelSide: 'right', labelY: 0.81 },
    9: { targetX: 0.73, targetY: 0.575, labelSide: 'right', labelY: 0.6 },
    10: { targetX: 0.745, targetY: 0.775, labelSide: 'right', labelY: 0.77 },
    11: { targetX: 0.615, targetY: 0.375, labelSide: 'right', labelY: 0.35 },
    12: { targetX: 0.545, targetY: 0.455, labelSide: 'right', labelY: 0.48 },
    13: { targetX: 0.575, targetY: 0.515, labelSide: 'right', labelY: 0.53 },
    14: { targetX: 0.575, targetY: 0.415, labelSide: 'right', labelY: 0.41 },
    15: { targetX: 0.51, targetY: 0.545, labelSide: 'left', labelY: 0.56 },
    16: { targetX: 0.596, targetY: 0.345, labelSide: 'right', labelY: 0.3 },
    17: { targetX: 0.648, targetY: 0.415, labelSide: 'right', labelY: 0.45 },
    18: { targetX: 0.407, targetY: 0.565, labelSide: 'left', labelY: 0.56 },
    19: { targetX: 0.265, targetY: 0.685, labelSide: 'left', labelY: 0.7 },
    20: { targetX: 0.4, targetY: 0.425, labelSide: 'left', labelY: 0.44 },
    21: { targetX: 0.51, targetY: 0.615, labelSide: 'left', labelY: 0.62 },
    22: { targetX: 0.115, targetY: 0.095, labelSide: 'left', labelY: 0.17 },
    23: { targetX: 0.435, targetY: 0.365, labelSide: 'left', labelY: 0.3 },
    24: { targetX: 0.525, targetY: 0.365, labelSide: 'right', labelY: 0.36 },
    25: { targetX: 0.475, targetY: 0.34, labelSide: 'left', labelY: 0.25 },
    26: null,
    27: null,
    28: { targetX: 0.755, targetY: 0.805, labelSide: 'right', labelY: 0.86, uncertain: true },
    29: { targetX: 0.665, targetY: 0.575, labelSide: 'right', labelY: 0.65 },
    30: { targetX: 0.53, targetY: 0.485, labelSide: 'right', labelY: 0.5 },
    31: { targetX: 0.28, targetY: 0.8, labelSide: 'left', labelY: 0.83 },
    32: { targetX: 0.48, targetY: 0.145, labelSide: 'left', labelY: 0.19 },
    33: { targetX: 0.452, targetY: 0.245, labelSide: 'left', labelY: 0.24 },
    34: { targetX: 0.465, targetY: 0.2, labelSide: 'left', labelY: 0.06 },
    35: null,
    36: { targetX: 0.27, targetY: 0.44, labelSide: 'left', labelY: 0.5, uncertain: true },
    37: { targetX: 0.485, targetY: 0.075, labelSide: 'right', labelY: 0.06 },
    38: { targetX: 0.07, targetY: 0.25, labelSide: 'left', labelY: 0.25 },
    39: { targetX: 0.5, targetY: 0.53, labelSide: 'left', labelY: 0.5 },
    40: { targetX: 0.445, targetY: 0.305, labelSide: 'left', labelY: 0.37 },
  },
};

/* --- Radiograph 2 ---------------------------------------------------------
   A different patient and a different film. Shallow inspiration with high
   hemidiaphragms, so the lungs are short and the heart sits more transversely;
   the scapulae still overlie the upper lung fields; a large gastric bubble is
   clearly shown. Every coordinate below was read off this film, not scaled
   from Radiograph 1. */
export const RADIOGRAPH_2: Radiograph = {
  id: 'radiograph-2',
  label: 'Radiograph 2',
  file: '/cxr/radiograph-2.png',
  width: 1176,
  height: 1205,
  projection: 'PA erect, shallow inspiration',
  sideMarker: 'R marker upper left of image — patient’s right is on the viewer’s left',
  notes:
    'Shallow inspiration: the hemidiaphragms are high and the lung fields are short, which crowds the lower zones and widens the cardiac outline. The scapulae are not rotated clear and overlie the upper lungs. The gastric bubble is much more obvious than on Radiograph 1.',
  placements: {
    1: { targetX: 0.622, targetY: 0.305, labelSide: 'right', labelY: 0.26 },
    2: { targetX: 0.245, targetY: 0.155, labelSide: 'left', labelY: 0.12 },
    3: { targetX: 0.582, targetY: 0.42, labelSide: 'right', labelY: 0.44 },
    4: { targetX: 0.335, targetY: 0.185, labelSide: 'left', labelY: 0.18 },
    5: { targetX: 0.3, targetY: 0.34, labelSide: 'left', labelY: 0.33 },
    6: { targetX: 0.465, targetY: 0.555, labelSide: 'left', labelY: 0.56 },
    7: { targetX: 0.695, targetY: 0.598, labelSide: 'right', labelY: 0.6 },
    8: { targetX: 0.885, targetY: 0.645, labelSide: 'right', labelY: 0.68 },
    9: { targetX: 0.7, targetY: 0.5, labelSide: 'right', labelY: 0.52 },
    10: { targetX: 0.76, targetY: 0.607, labelSide: 'right', labelY: 0.64 },
    11: { targetX: 0.655, targetY: 0.375, labelSide: 'right', labelY: 0.36 },
    12: { targetX: 0.575, targetY: 0.41, labelSide: 'right', labelY: 0.42 },
    13: { targetX: 0.605, targetY: 0.455, labelSide: 'right', labelY: 0.47 },
    14: { targetX: 0.585, targetY: 0.385, labelSide: 'right', labelY: 0.39 },
    15: { targetX: 0.545, targetY: 0.475, labelSide: 'left', labelY: 0.48 },
    16: { targetX: 0.64, targetY: 0.345, labelSide: 'right', labelY: 0.32 },
    17: { targetX: 0.66, targetY: 0.41, labelSide: 'right', labelY: 0.44 },
    18: { targetX: 0.455, targetY: 0.475, labelSide: 'left', labelY: 0.44 },
    19: { targetX: 0.29, targetY: 0.585, labelSide: 'left', labelY: 0.6 },
    20: { targetX: 0.44, targetY: 0.4, labelSide: 'left', labelY: 0.4 },
    21: { targetX: 0.545, targetY: 0.52, labelSide: 'left', labelY: 0.52 },
    22: { targetX: 0.16, targetY: 0.19, labelSide: 'left', labelY: 0.22 },
    23: { targetX: 0.465, targetY: 0.35, labelSide: 'left', labelY: 0.3 },
    24: { targetX: 0.555, targetY: 0.35, labelSide: 'right', labelY: 0.35 },
    25: { targetX: 0.505, targetY: 0.325, labelSide: 'left', labelY: 0.25 },
    26: null,
    27: null,
    28: { targetX: 0.69, targetY: 0.635, labelSide: 'right', labelY: 0.72 },
    29: { targetX: 0.64, targetY: 0.5, labelSide: 'right', labelY: 0.56 },
    30: { targetX: 0.555, targetY: 0.44, labelSide: 'right', labelY: 0.5 },
    31: { targetX: 0.3, targetY: 0.7, labelSide: 'left', labelY: 0.72 },
    32: { targetX: 0.51, targetY: 0.13, labelSide: 'left', labelY: 0.15 },
    33: { targetX: 0.492, targetY: 0.245, labelSide: 'left', labelY: 0.24 },
    34: { targetX: 0.515, targetY: 0.16, labelSide: 'left', labelY: 0.06 },
    35: null,
    36: null,
    37: { targetX: 0.515, targetY: 0.055, labelSide: 'right', labelY: 0.06 },
    38: { targetX: 0.115, targetY: 0.3, labelSide: 'left', labelY: 0.28 },
    39: { targetX: 0.515, targetY: 0.46, labelSide: 'left', labelY: 0.38 },
    40: { targetX: 0.485, targetY: 0.3, labelSide: 'left', labelY: 0.36 },
  },
};

export const RADIOGRAPHS: Radiograph[] = [RADIOGRAPH_1, RADIOGRAPH_2];

/** Why a landmark is absent, for the learner-facing list and the final audit. */
export const NOT_DEMONSTRATED: Record<string, Record<number, string>> = {
  'radiograph-1': {
    26: 'No radiopaque nipple marker has been applied to this patient.',
    27: 'No radiopaque nipple marker has been applied to this patient.',
    35: 'The posterior twelfth rib cannot be delineated confidently against the upper abdomen on this exposure.',
  },
  'radiograph-2': {
    26: 'No radiopaque nipple marker has been applied to this patient.',
    27: 'No radiopaque nipple marker has been applied to this patient.',
    35: 'The posterior twelfth rib cannot be delineated confidently against the upper abdomen on this exposure.',
    36: 'No horizontal fissure line is visible on this film. It is absent or not profiled on roughly half of normal chest radiographs, and drawing one where none can be seen would be inventing a finding.',
  },
};
