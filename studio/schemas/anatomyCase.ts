import { defineField, defineType } from 'sanity'
import { accessLevelField } from './accessLevel'

/* An anatomy case: one film, and the structures a candidate must name on it.
 *
 * The marking scheme is the reason this schema is strict. Each answer is worth
 * 2 marks and the candidate scores 0, 1 or 2:
 *   - a synonym scores full marks, which is what acceptedVariants is FOR;
 *   - correct-but-less-specific scores 1;
 *   - missing laterality costs 1 mark, never both;
 *   - spelling is never deducted for.
 *
 * So acceptedVariants is not decoration — an omission there marks a correct
 * candidate wrong. The field is required to be thought about, not required to
 * be non-empty, because some structures genuinely have no synonym.
 *
 * Marker geometry (where each arrow points, its angle, thickness, colour) is
 * millimetre-accurate and belongs to the image, not to prose. It stays
 * structural: authored in the existing annotation editor, carried here as
 * data an author cannot casually retype.
 */
export const anatomyCase = defineType({
  name: 'anatomyCase',
  title: 'Anatomy case',
  type: 'document',
  fields: [
    accessLevelField,
    defineField({
      name: 'caseId',
      title: 'Case ID',
      type: 'string',
      readOnly: true,
      description: 'The id already used by the app and by stored candidate progress.',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'section',
      title: 'Region',
      type: 'string',
      readOnly: true,
      options: {
        list: [
          { title: 'Upper limb', value: 'upper-limb' },
          { title: 'Lower limb', value: 'lower-limb' },
          { title: 'Head & neck', value: 'head-neck' },
          { title: 'Spine', value: 'spine' },
          { title: 'Thorax', value: 'thorax' },
          { title: 'Abdomen & pelvis', value: 'abdo-pelvis' },
        ],
      },
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'questionText',
      title: 'Question stem',
      type: 'text',
      rows: 2,
      description: 'e.g. "Identify the structures labelled A to E."',
    }),
    defineField({
      name: 'image',
      title: 'Film',
      type: 'image',
      options: { hotspot: true },
      description:
        'Uploaded here, served resized and re-encoded from the CDN. Patient ' +
        'identifiable data must be cropped out BEFORE upload — the CDN copy is public.',
    }),
    defineField({
      name: 'imageRemoved',
      title: 'Film withdrawn',
      type: 'boolean',
      initialValue: false,
      description:
        'Withdrawing a film is SOFT. The question, its answers and its teaching ' +
        'all survive, and it can come back. Never delete the case to hide a film.',
    }),
    defineField({
      name: 'imagingModality',
      title: 'Modality',
      type: 'string',
      options: { list: ['X-ray', 'CT', 'MRI', 'Ultrasound', 'Nuclear medicine', 'Fluoroscopy'] },
    }),
    defineField({
      name: 'answers',
      title: 'Labelled structures',
      type: 'array',
      validation: (r) => r.min(1).error('A case with no labelled structure cannot be marked.'),
      of: [
        {
          type: 'object',
          name: 'labelledAnswer',
          fields: [
            {
              name: 'letter',
              title: 'Label',
              type: 'string',
              readOnly: true,
              description: 'a-e, matching the marker on the film. Stored progress is keyed on it.',
              validation: (r) => r.required().regex(/^[a-e]$/, { name: 'a to e' }),
            },
            {
              name: 'officialAnswer',
              title: 'Official answer',
              type: 'string',
              validation: (r) => r.required().error('A label with no answer can never be scored.'),
            },
            {
              name: 'acceptedVariants',
              title: 'Also accept',
              type: 'array',
              of: [{ type: 'string' }],
              description:
                'Synonyms that score FULL marks: C1 = atlas, aqueduct of Sylvius = ' +
                'cerebral aqueduct, fifth phalanx = fifth metatarsal. A missing ' +
                'synonym marks a correct candidate wrong, so this is marking logic, ' +
                'not a nicety.',
            },
            {
              name: 'lateralityRequired',
              title: 'Laterality required',
              type: 'boolean',
              initialValue: false,
              description: 'When true, omitting left/right costs ONE mark of the two — never both.',
            },
            {
              name: 'teaching',
              title: 'Why this is the answer',
              type: 'text',
              rows: 4,
              description:
                'Describe the imaging features that identify it — echogenic borders, ' +
                'branching pattern, location. Never just "incorrect, the answer is X". ' +
                'Name the classic trap where there is one.',
            },
          ],
          preview: { select: { title: 'officialAnswer', subtitle: 'letter' } },
        },
      ],
    }),
  ],
  preview: { select: { title: 'caseId', subtitle: 'section', media: 'image' } },
})
