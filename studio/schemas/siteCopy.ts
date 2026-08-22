import { defineField, defineType } from 'sanity'

/* Everything a visitor reads that is not a question or a lesson.
 *
 * This is the part of the migration with the clearest payoff: 74 separate
 * strings currently live as literals inside App.tsx, Portal.tsx and
 * FreeTrial.tsx, so changing a headline means a code edit and a deploy. After
 * this, it is an edit and a Publish.
 *
 * What deliberately did NOT come here: the paywall. TRIAL in src/lib/access.ts
 * decides what a signed-out visitor may read, and plans[].comingSoon /
 * .monthly / .annual drive billing behaviour. Those are logic wearing the
 * costume of copy — an author "fixing a price" in a CMS would be changing what
 * the product charges and what it gives away. They stay in code.
 */

export const page = defineType({
  name: 'page',
  title: 'Page',
  type: 'document',
  fields: [
    defineField({
      name: 'slug',
      title: 'Which page',
      type: 'string',
      readOnly: true,
      description: 'Matches the route. Read-only: the app looks pages up by this.',
      options: {
        list: [
          { title: 'Home', value: 'home' },
          { title: 'Physics', value: 'physics' },
          { title: 'Anatomy', value: 'anatomy' },
          { title: 'Free trial', value: 'free-trial' },
          { title: 'Pricing', value: 'pricing' },
          { title: 'About', value: 'about' },
          { title: 'Privacy', value: 'privacy' },
          { title: 'Terms', value: 'terms' },
        ],
      },
      validation: (r) => r.required(),
    }),
    defineField({ name: 'heading', title: 'Heading', type: 'string' }),
    defineField({ name: 'subheading', title: 'Subheading', type: 'string' }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'array',
      of: [{ type: 'block' }, { type: 'image', options: { hotspot: true } }],
      description: 'Rich text. Images here are served resized and re-encoded from the CDN.',
    }),
    defineField({
      name: 'sections',
      title: 'Sections',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'copySection',
          fields: [
            { name: 'key', title: 'Key', type: 'string', description: 'Where the app slots this in.' },
            { name: 'heading', title: 'Heading', type: 'string' },
            { name: 'body', title: 'Body', type: 'text', rows: 4 },
            { name: 'image', title: 'Image', type: 'image', options: { hotspot: true } },
          ],
          preview: { select: { title: 'heading', subtitle: 'key' } },
        },
      ],
    }),
    defineField({
      name: 'seoDescription',
      title: 'Search description',
      type: 'text',
      rows: 2,
      validation: (r) => r.max(160).warning('Search engines truncate past about 160 characters.'),
    }),
  ],
  preview: { select: { title: 'heading', subtitle: 'slug' } },
})

export const faq = defineType({
  name: 'faq',
  title: 'FAQ',
  type: 'document',
  fields: [
    defineField({ name: 'question', title: 'Question', type: 'string', validation: (r) => r.required() }),
    defineField({
      name: 'answer',
      title: 'Answer',
      type: 'array',
      of: [{ type: 'block' }],
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'order',
      title: 'Order',
      type: 'number',
      description: 'Low numbers first. Ties fall back to the question text.',
    }),
    defineField({
      name: 'audience',
      title: 'Shown on',
      type: 'string',
      options: { list: ['everywhere', 'home', 'pricing', 'free-trial'] },
      initialValue: 'everywhere',
    }),
  ],
  orderings: [{ title: 'Display order', name: 'order', by: [{ field: 'order', direction: 'asc' }] }],
  preview: { select: { title: 'question', subtitle: 'audience' } },
})
