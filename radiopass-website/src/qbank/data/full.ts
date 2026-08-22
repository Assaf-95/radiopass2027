/* ===========================================================================
   The bank as AUTHORED, for tests and build-time validators only.

   src/qbank/data/index.ts assembles from the PUBLIC partition, where paid
   questions have no statements — that is what stops the bank being
   downloadable. Content invariants ("five statements per question", "enough
   complete questions for a mock paper") are facts about what was written, not
   about what ships, so they must be checked here.

   NOTHING IN THE APP MAY IMPORT THIS. Doing so puts all 424 paid question sets
   back into the bundle. That is not left to discipline:
   scripts/assert-no-premium-in-bundle.mjs reads the built assets and fails the
   build if the statements reappear, whatever imported them.
   =========================================================================== */

import baseFull from './questions.base.json'
import extractedFull from './extracted.json'
import { assembleFrom } from './index'
import type { QbQuestion } from '../types'

/** Every question with its statements, exactly as authored. */
export const QB_QUESTIONS_FULL: QbQuestion[] = assembleFrom(baseFull, extractedFull)
