/* ===========================================================================
   Chest radiograph anatomy — structure list

   Numbering and wording follow the supplied reference plate. Several entries
   are the *projected* position of something a plain film cannot actually
   show — a valve is not visible on a radiograph — and that wording is kept
   deliberately rather than tidied into a claim the image does not support.
   =========================================================================== */

export type CxrCategory =
  | 'airways'
  | 'mediastinum'
  | 'heart'
  | 'hila'
  | 'diaphragm'
  | 'bones'
  | 'pleura'
  | 'surface';

export const CXR_CATEGORIES: { id: CxrCategory; label: string }[] = [
  { id: 'airways', label: 'Airways' },
  { id: 'mediastinum', label: 'Mediastinum' },
  { id: 'heart', label: 'Heart' },
  { id: 'hila', label: 'Hila and vessels' },
  { id: 'diaphragm', label: 'Diaphragm and upper abdomen' },
  { id: 'bones', label: 'Bones' },
  { id: 'pleura', label: 'Pleura, fissures and angles' },
  { id: 'surface', label: 'Surface markers' },
];

export interface CxrStructure {
  id: number;
  name: string;
  shortName: string;
  category: CxrCategory;
  /** Shown in the default "Major landmarks" mode. */
  major: boolean;
  /** Accepted in quiz mode besides the name. Never a neighbouring structure. */
  synonyms?: string[];
  /** One line on where to look and what distinguishes it from its neighbour. */
  note: string;
}

export const CXR_STRUCTURES: CxrStructure[] = [
  {
    id: 1,
    name: 'Arch of aorta',
    shortName: 'Aortic arch',
    category: 'mediastinum',
    major: true,
    synonyms: ['aortic knuckle', 'aortic knob', 'arch of the aorta'],
    note: 'The convex contour at the top of the left mediastinal border. It is the highest point of the left heart–mediastinal outline; the pulmonary trunk is the straighter segment immediately below it.',
  },
  {
    id: 2,
    name: 'Clavicle',
    shortName: 'Clavicle',
    category: 'bones',
    major: false,
    note: 'Runs obliquely across the apex. On a well-centred PA film the medial ends should sit equidistant from the spinous processes — that is the rotation check.',
  },
  {
    id: 3,
    name: 'Descending aorta',
    shortName: 'Descending aorta',
    category: 'mediastinum',
    major: true,
    synonyms: ['descending thoracic aorta'],
    note: 'A near-vertical edge running down the left side of the vertebral column below the arch. Do not confuse it with the left heart border, which is further lateral and further down.',
  },
  {
    id: 4,
    name: 'First rib, anterior',
    shortName: '1st rib (anterior)',
    category: 'bones',
    major: false,
    note: 'The anterior first rib and its costal cartilage arc downward and medially below the clavicle. It is a common mimic of an apical lesion.',
  },
  {
    id: 5,
    name: 'Fifth rib, posterior',
    shortName: '5th rib (posterior)',
    category: 'bones',
    major: false,
    note: 'Posterior ribs run more horizontally across the lung than anterior ribs, which slope down and medially. Counting posterior ribs at the mid-clavicular line is how inspiration is assessed.',
  },
  {
    id: 6,
    name: 'Inferior vena cava',
    shortName: 'IVC',
    category: 'diaphragm',
    major: false,
    synonyms: ['inferior vena cava', 'ivc'],
    note: 'Enters the right atrium just above the right hemidiaphragm, sometimes seen as a short oblique edge at the right cardiophrenic region. It is below and medial to the right atrial border, not on it.',
  },
  {
    id: 7,
    name: 'Left cardiophrenic angle',
    shortName: 'L cardiophrenic angle',
    category: 'pleura',
    major: false,
    note: 'The medial angle where the left heart border meets the left hemidiaphragm. Distinct from the costophrenic angle, which is the lateral one against the chest wall.',
  },
  {
    id: 8,
    name: 'Left costophrenic angle',
    shortName: 'L costophrenic angle',
    category: 'pleura',
    major: true,
    note: 'The sharp lateral recess between the left hemidiaphragm and the chest wall. Blunting here is the classic sign of a pleural effusion.',
  },
  {
    id: 9,
    name: 'Left ventricular border',
    shortName: 'LV border',
    category: 'heart',
    major: true,
    synonyms: ['left heart border', 'left cardiac border'],
    note: 'The lower part of the left cardiac outline, running down to the apex. On a PA film the left border is left ventricle below and left atrial appendage / pulmonary trunk above.',
  },
  {
    id: 10,
    name: 'Left dome of diaphragm',
    shortName: 'L hemidiaphragm',
    category: 'diaphragm',
    major: true,
    synonyms: ['left hemidiaphragm', 'left diaphragm'],
    note: 'Normally sits about one to two centimetres lower than the right. The gastric bubble lies beneath it — the bubble is not the diaphragm.',
  },
  {
    id: 11,
    name: 'Left pulmonary artery',
    shortName: 'L pulmonary artery',
    category: 'hila',
    major: true,
    note: 'The left hilum is normally higher than the right, because the left pulmonary artery arches over the left main bronchus. If the left hilum is lower than the right, something is pulling or pushing it.',
  },
  {
    id: 12,
    name: 'Position of aortic valve',
    shortName: 'Aortic valve (position)',
    category: 'heart',
    major: false,
    note: 'A projected position, not a visible structure. It lies central within the cardiac silhouette, below and to the patient’s right of the pulmonary valve.',
  },
  {
    id: 13,
    name: 'Position of mitral valve',
    shortName: 'Mitral valve (position)',
    category: 'heart',
    major: false,
    note: 'A projected position. It sits below and to the patient’s left of the aortic valve. Valve prostheses are what actually make these positions visible.',
  },
  {
    id: 14,
    name: 'Position of pulmonary valve',
    shortName: 'Pulmonary valve (position)',
    category: 'heart',
    major: false,
    note: 'A projected position — the most superior and most left of the four valves, just below the pulmonary trunk.',
  },
  {
    id: 15,
    name: 'Position of tricuspid valve',
    shortName: 'Tricuspid valve (position)',
    category: 'heart',
    major: false,
    note: 'A projected position — the most inferior and the most to the patient’s right of the four.',
  },
  {
    id: 16,
    name: 'Pulmonary trunk',
    shortName: 'Pulmonary trunk',
    category: 'hila',
    major: true,
    synonyms: ['main pulmonary artery'],
    note: 'The segment of the left mediastinal border immediately below the aortic knuckle. Aortic knuckle above, pulmonary trunk below, left atrial appendage below that.',
  },
  {
    id: 17,
    name: 'Region of the tip of the left atrial appendage',
    shortName: 'L atrial appendage',
    category: 'heart',
    major: false,
    synonyms: ['left atrial appendage', 'tip of left atrial appendage', 'left auricle'],
    note: 'The short segment of the left border between the pulmonary trunk and the left ventricle. Normally flat or slightly concave; a convex bulge here suggests left atrial enlargement.',
  },
  {
    id: 18,
    name: 'Right atrial border',
    shortName: 'RA border',
    category: 'heart',
    major: true,
    synonyms: ['right heart border', 'right cardiac border'],
    note: 'The whole lower right cardiac outline is right atrium. The right ventricle does not form a border on the PA projection.',
  },
  {
    id: 19,
    name: 'Right dome of diaphragm',
    shortName: 'R hemidiaphragm',
    category: 'diaphragm',
    major: true,
    synonyms: ['right hemidiaphragm', 'right diaphragm'],
    note: 'Sits higher than the left because of the liver beneath it. Free gas under this dome is the classic sign of perforation.',
  },
  {
    id: 20,
    name: 'Right pulmonary artery',
    shortName: 'R pulmonary artery',
    category: 'hila',
    major: true,
    note: 'The main component of the right hilar shadow. Normal hila are vascular; a hilum that is dense rather than branching is abnormal.',
  },
  {
    id: 21,
    name: 'Right ventricle',
    shortName: 'Right ventricle',
    category: 'heart',
    major: false,
    note: 'A projected position over the lower central silhouette. The right ventricle is anterior and forms no border on a PA film — it is seen in profile on the lateral.',
  },
  {
    id: 22,
    name: 'Spine of scapula',
    shortName: 'Scapular spine',
    category: 'bones',
    major: false,
    note: 'A dense, sharply defined oblique line over the upper outer chest. Distinct from the scapular blade, which is the broader plate below and lateral to it.',
  },
  {
    id: 23,
    name: 'Right main bronchus',
    shortName: 'R main bronchus',
    category: 'airways',
    major: true,
    note: 'Shorter, wider and more vertical than the left — which is why inhaled foreign bodies and an over-inserted endotracheal tube go to the right.',
  },
  {
    id: 24,
    name: 'Left main bronchus',
    shortName: 'L main bronchus',
    category: 'airways',
    major: true,
    note: 'Longer and more horizontal than the right, passing under the aortic arch.',
  },
  {
    id: 25,
    name: 'Carina',
    shortName: 'Carina',
    category: 'airways',
    major: true,
    note: 'The tracheal bifurcation, normally at about T4–T5. It is the landmark for checking endotracheal tube position — the tip should sit a few centimetres above it.',
  },
  {
    id: 26,
    name: 'Right nipple marker',
    shortName: 'R nipple marker',
    category: 'surface',
    major: false,
    note: 'A radiopaque skin marker placed over the nipple to prove that a rounded lower-zone opacity is a nipple shadow rather than a pulmonary nodule. Only labelled when a marker is genuinely present.',
  },
  {
    id: 27,
    name: 'Left nipple marker',
    shortName: 'L nipple marker',
    category: 'surface',
    major: false,
    note: 'As for the right. Without a marker on the film there is nothing to point at, and the expected nipple position is not the same thing.',
  },
  {
    id: 28,
    name: 'Gastric air bubble',
    shortName: 'Gastric bubble',
    category: 'diaphragm',
    major: true,
    synonyms: ['gastric bubble', 'stomach bubble', 'gas in stomach'],
    note: 'Lucency in the gastric fundus beneath the left hemidiaphragm. Its distance from the lung base is a rough guide to whether there is fluid or a subphrenic collection between them.',
  },
  {
    id: 29,
    name: 'Left ventricle',
    shortName: 'Left ventricle',
    category: 'heart',
    major: false,
    note: 'The projected position of the chamber within the lower left silhouette, behind and medial to the border it forms.',
  },
  {
    id: 30,
    name: 'Position of left atrium',
    shortName: 'Left atrium (position)',
    category: 'heart',
    major: false,
    note: 'A projected position — central and posterior, behind the other chambers. Distinct from the left atrial appendage, which reaches the left border.',
  },
  {
    id: 31,
    name: 'Position of liver',
    shortName: 'Liver',
    category: 'diaphragm',
    major: false,
    note: 'Homogeneous soft-tissue density filling the right upper abdomen below the right hemidiaphragm.',
  },
  {
    id: 32,
    name: 'Manubrium',
    shortName: 'Manubrium',
    category: 'bones',
    major: false,
    note: 'The upper sternum, projected over the superior mediastinum on a PA film and only faintly seen. It is properly assessed on the lateral.',
  },
  {
    id: 33,
    name: 'Superior vena cava',
    shortName: 'SVC',
    category: 'mediastinum',
    major: true,
    synonyms: ['superior vena cava', 'svc'],
    note: 'Forms the upper right mediastinal border. It is on the opposite side of the mediastinum from the aortic knuckle — a useful pair to fix left from right.',
  },
  {
    id: 34,
    name: 'Trachea',
    shortName: 'Trachea',
    category: 'airways',
    major: true,
    note: 'The central air column. Slight deviation to the right at the arch is normal; anything more is displacement by a mass, effusion or collapse.',
  },
  {
    id: 35,
    name: 'Twelfth rib, posterior',
    shortName: '12th rib (posterior)',
    category: 'bones',
    major: false,
    note: 'The lowest rib, projected over the upper abdomen. Often short and hard to delineate against bowel and soft tissue.',
  },
  {
    id: 36,
    name: 'Right horizontal fissure',
    shortName: 'R horizontal fissure',
    category: 'pleura',
    major: true,
    synonyms: ['horizontal fissure', 'minor fissure', 'transverse fissure'],
    note: 'A thin line running from the right hilum to the lateral chest wall at about the level of the fourth rib anteriorly, dividing right upper from right middle lobe. Visible on only about half of normal films.',
  },
  {
    id: 37,
    name: 'First thoracic vertebra',
    shortName: 'T1 vertebra',
    category: 'bones',
    major: false,
    synonyms: ['t1', 'first thoracic vertebra', 't1 vertebral body'],
    note: 'The first thoracic level, behind the upper mediastinum — the starting point for counting down to the carina at T4–T5.',
  },
  {
    id: 38,
    name: 'Blade of scapula',
    shortName: 'Scapular blade',
    category: 'bones',
    major: false,
    synonyms: ['body of scapula', 'scapular body'],
    note: 'The broad flat plate of the scapula. Its medial edge is a frequent mimic of a pneumothorax line — but it continues beyond the chest wall, which a pleural line does not.',
  },
  {
    id: 39,
    name: 'Azygo-oesophageal recess',
    shortName: 'Azygo-oesophageal recess',
    category: 'mediastinum',
    major: false,
    synonyms: ['azygooesophageal recess', 'azygo esophageal recess'],
    note: 'The interface where right lower lobe meets the mediastinum beside the vertebral column. Loss or convexity of this line points to subcarinal or right lower lobe disease.',
  },
  {
    id: 40,
    name: 'Position of azygos arch',
    shortName: 'Azygos arch (position)',
    category: 'mediastinum',
    major: false,
    synonyms: ['azygos vein', 'azygos arch'],
    note: 'Sits in the right tracheobronchial angle, arching forward to join the SVC. Normally under one centimetre; it enlarges when the patient is supine or fluid-overloaded.',
  },
];

export const MAJOR_IDS = CXR_STRUCTURES.filter((s) => s.major).map((s) => s.id);
