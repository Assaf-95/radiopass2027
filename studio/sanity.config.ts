import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { schemaTypes } from './schemas'

/* The editing interface.
 *
 * Hosted by Sanity at <studioHost>.sanity.studio rather than embedded in the
 * app, so that none of its weight reaches a learner. Sanity also owns the
 * login, which means there is no second password to manage and no admin
 * session for this project to get wrong.
 */
export default defineConfig({
  name: 'radiopass',
  title: 'RadioPass',
  projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? '',
  dataset: process.env.SANITY_STUDIO_DATASET ?? 'production',
  plugins: [structureTool(), visionTool()],
  schema: { types: schemaTypes },
})
