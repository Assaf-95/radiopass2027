import { defineField } from 'sanity'

/* The one field that decides who may open an item.
 *
 * Spread into every document type, so the question is asked the same way
 * everywhere and an author never has to remember which content has a paywall
 * and which does not — they all do.
 *
 * Defaults to 'subscriber'. That is deliberate and is the only safe default:
 * a new item that is accidentally free costs money quietly and nobody
 * notices, while a new item that is accidentally locked is reported within
 * the hour by the first person who wants it.
 */
export const accessLevelField = defineField({
  name: 'accessLevel',
  title: 'Who can see this',
  type: 'string',
  initialValue: 'subscriber',
  validation: (r) => r.required(),
  options: {
    layout: 'radio',
    list: [
      { title: 'Anyone — including visitors who are not signed in', value: 'guest' },
      { title: 'Signed-in accounts — free or paid', value: 'free' },
      { title: 'Subscribers only', value: 'subscriber' },
    ],
  },
  description:
    'Changing this takes effect as soon as you press Publish — no deploy. ' +
    'Note that "Subscribers only" HIDES an item; it does not yet make it ' +
    'unreadable to somebody technical, because the question banks are still ' +
    'compiled into the site. See docs/CONTENT-ACCESS.md.',
})
