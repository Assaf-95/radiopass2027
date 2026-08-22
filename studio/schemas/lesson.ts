import { defineField, defineType } from 'sanity'

/* A physics lesson — the PROSE of one, not the lesson itself.
 *
 * This is the hardest domain in the migration and the schema has to be honest
 * about why. Today a lesson is a TypeScript literal in which teaching text sits
 * interleaved with canvas `draw:` functions, React simulation elements, CSS
 * selectors and matcher regexes, all in the same object. The 18 simulation
 * components under src/physics2/components/sims/ are 3,031 lines of code and
 * cannot become content in any form.
 *
 * So the split is: words come here, the simulation stays code, and a block
 * names the simulation it belongs beside by a key the code registers. An
 * author can rewrite every word around a simulation and reorder the steps.
 * An author cannot break the simulation, because they never touch it.
 *
 * `simKey` is read-only for that reason: it is a pointer into a code registry,
 * and a typo would blank the diagram rather than produce an error.
 */
export const lesson = defineType({
  name: 'lesson',
  title: 'Physics lesson',
  type: 'document',
  fields: [
    defineField({
      name: 'lessonId',
      title: 'Lesson ID',
      type: 'string',
      readOnly: true,
      description: 'Matches the route and the course spine. Progress is keyed on it.',
      validation: (r) => r.required(),
    }),
    defineField({ name: 'title', title: 'Title', type: 'string', validation: (r) => r.required() }),
    defineField({
      name: 'subject',
      title: 'Subject',
      type: 'string',
      readOnly: true,
      options: { list: ['xray', 'ct', 'mri', 'ultrasound', 'nuclear', 'fluoro', 'digital', 'mammo', 'dose'] },
    }),
    defineField({
      name: 'intro',
      title: 'Opening',
      type: 'text',
      rows: 3,
      description: 'What this lesson is for, in the learner’s language. Informal, not formal.',
    }),
    defineField({
      name: 'steps',
      title: 'Steps',
      type: 'array',
      description:
        'One concept per step. The learner should never have to scroll while ' +
        'reading one idea against its diagram — keep each step to a single point.',
      of: [
        {
          type: 'object',
          name: 'lessonStep',
          fields: [
            { name: 'heading', title: 'Heading', type: 'string', validation: (r) => r.required() },
            {
              name: 'body',
              title: 'Teaching text',
              type: 'array',
              of: [{ type: 'block' }],
              description: 'The dominant thing on screen. Say why, not just what.',
            },
            {
              name: 'simKey',
              title: 'Simulation shown beside this',
              type: 'string',
              readOnly: true,
              description:
                'Points at a simulation registered in code. Read-only: this is a ' +
                'code reference, and a typo would blank the diagram silently.',
            },
            {
              name: 'image',
              title: 'Still image (when there is no simulation)',
              type: 'image',
              options: { hotspot: true },
            },
            { name: 'equation', title: 'Equation', type: 'string' },
            { name: 'equationNote', title: 'What the equation means', type: 'text', rows: 2 },
            {
              name: 'watchFor',
              title: 'Exam trap',
              type: 'text',
              rows: 2,
              description:
                'Name the classic trap where there is one — e.g. anterior/posterior ' +
                'longitudinal ligament are named relative to the vertebral body, not the cord.',
            },
          ],
          preview: { select: { title: 'heading', subtitle: 'simKey' } },
        },
      ],
    }),
    defineField({
      name: 'synthesis',
      title: 'Closing summary',
      type: 'object',
      fields: [
        { name: 'headline', title: 'Headline', type: 'string' },
        { name: 'bigPicture', title: 'The big picture', type: 'text', rows: 3 },
        { name: 'confuse', title: 'Commonly confused', type: 'text', rows: 3 },
      ],
    }),
  ],
  preview: { select: { title: 'title', subtitle: 'subject' } },
})
