import { defineField, defineType } from 'sanity'
import { accessLevelField } from './accessLevel'

/* A physics question.
 *
 * Two fields here are NOT editable, and that is the point of the schema
 * rather than an oversight.
 *
 * `answer` is the true/false value a candidate is marked against. Changing it
 * re-marks work that has already been submitted — a candidate who answered
 * correctly yesterday becomes wrong today, with no record of why. The existing
 * wording editor has no field for it precisely so this cannot happen
 * (src/qbank/overlay.test.ts pins that). Making it typeable in a CMS would
 * undo that guarantee, so it is readOnly here.
 *
 * `label` (A-E) is the join key for every stored candidate choice. Progress,
 * flags and favourites are keyed on it. Renaming a label silently re-points
 * historic answers at a different statement, so it is readOnly too and must
 * migrate byte-identical.
 */
export const physicsQuestion = defineType({
  name: 'physicsQuestion',
  title: 'Physics question',
  type: 'document',
  fields: [
    accessLevelField,
    defineField({
      name: 'questionId',
      title: 'Question ID',
      type: 'string',
      description: 'The id this question already has in the app. Never change it.',
      readOnly: true,
      validation: (r) => r.required(),
    }),
    defineField({ name: 'heading', title: 'Heading', type: 'string', validation: (r) => r.required() }),
    defineField({
      name: 'stem',
      title: 'Stem',
      type: 'text',
      rows: 3,
      description: 'The shared opening the five statements hang off.',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'stems',
      title: 'Statements',
      type: 'array',
      validation: (r) => r.length(5).error('An FRCR question is exactly five statements.'),
      of: [
        {
          type: 'object',
          name: 'stemItem',
          fields: [
            {
              name: 'label',
              title: 'Label',
              type: 'string',
              readOnly: true,
              description: 'A-E. Read-only: stored candidate answers are keyed on it.',
              validation: (r) => r.required().regex(/^[A-E]$/, { name: 'A to E' }),
            },
            {
              name: 'answer',
              title: 'True / false',
              type: 'boolean',
              readOnly: true,
              description:
                'READ-ONLY BY DESIGN. Editing this re-marks work already submitted. ' +
                'Corrections go through a code change with a migration, never through the CMS.',
            },
            { name: 'text', title: 'Statement', type: 'text', rows: 2, validation: (r) => r.required() },
            { name: 'explanation', title: 'Explanation', type: 'text', rows: 4 },
          ],
          preview: { select: { title: 'text', subtitle: 'label' } },
        },
      ],
    }),
    defineField({ name: 'keyPoint', title: 'Key point', type: 'text', rows: 2 }),
    defineField({
      name: 'topic',
      title: 'Topic',
      type: 'string',
      readOnly: true,
      description: 'Drives which lab and section this belongs to. Changed in code, not here.',
    }),
  ],
  preview: { select: { title: 'heading', subtitle: 'questionId' } },
})
