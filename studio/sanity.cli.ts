/* The CLI's copy of the project coordinates.

   Read from the environment for the same reason the app reads them: the
   project id is not a secret but it IS deployment-specific, and hard-coding
   it here is how a studio ends up quietly editing the wrong dataset. */
import { defineCliConfig } from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID,
    dataset: process.env.SANITY_STUDIO_DATASET ?? 'production',
  },
  /* Deployed to <hostname>.sanity.studio. Sanity hosts and secures it, so the
     editing interface adds nothing to what a learner downloads. */
  studioHost: 'radiopass',
})
