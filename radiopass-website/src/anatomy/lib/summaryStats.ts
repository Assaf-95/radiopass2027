/**
 * Region statistics for the anatomy home, computed WITHOUT the question bank.
 *
 * computeSectionStats() in stats.ts is the full reckoning: it walks every
 * question to count laterality errors, which needs each answer's
 * `lateralityRequired` flag and its official wording. That is the right
 * function for a section page, where the bank is loaded anyway because the
 * learner is about to answer from it.
 *
 * It is the wrong function for the home, which displays only totals, an
 * attempted count and a percentage — and paid a one-megabyte javascript chunk
 * for the privilege. Everything the home shows comes from two much smaller
 * places: the generated summary (how many questions, how many answers each),
 * and the learner's own progress store, which already records the score and
 * maximum of every attempt at the moment it was marked.
 *
 * The numbers this returns are the same numbers computeSectionStats returns
 * for the fields the home uses — summaryStats.test.ts asserts exactly that
 * against the real data, so the cheap path cannot quietly disagree with the
 * expensive one.
 */

import { ANATOMY_SUMMARY } from '../data/summary';
import { loadProgress } from './progress';
import type { SectionId } from '../types';

export type HomeStats = {
  /** Questions a learner can actually reach in this region. */
  total: number;
  attempted: number;
  fullyCorrect: number;
  partiallyCorrect: number;
  incorrect: number;
  /** Marks earned across submitted questions. */
  rawScore: number;
  /** Two marks per label, across the whole region. */
  maxScore: number;
  /** The maximum of only what was attempted — what a percentage divides by. */
  attemptedMaxScore: number;
  flagged: number;
  percentScore: number;
  /** How much of the region has been attempted — the worklist bar. */
  completionPercent: number;
};

const EMPTY: HomeStats = {
  total: 0, attempted: 0, fullyCorrect: 0, partiallyCorrect: 0, incorrect: 0,
  rawScore: 0, maxScore: 0, attemptedMaxScore: 0, flagged: 0, percentScore: 0,
  completionPercent: 0,
};

export function computeHomeStats(section: SectionId): HomeStats {
  const summary = ANATOMY_SUMMARY[section];
  if (!summary) return EMPTY;

  const progress = loadProgress();
  let attempted = 0;
  let fullyCorrect = 0;
  let partiallyCorrect = 0;
  let incorrect = 0;
  let rawScore = 0;
  let attemptedMaxScore = 0;
  let flagged = 0;
  let maxScore = 0;

  for (const [id, answerCount] of summary.questions) {
    /* Two marks per label — the bank's marking scheme, and the only thing
       the region's own maximum depends on. */
    maxScore += answerCount * 2;

    const p = progress.questions[id];
    if (!p) continue;
    if (p.flaggedForReview) flagged++;
    if (p.status === 'submitted' && p.graded) {
      attempted++;
      rawScore += p.graded.totalScore;
      /* The question's own maximum as recorded when it was marked, so a
         hidden label never inflates the denominator. */
      attemptedMaxScore += p.graded.maxScore;
      if (p.graded.overallResult === 'correct') fullyCorrect++;
      else if (p.graded.overallResult === 'partial') partiallyCorrect++;
      else if (p.graded.overallResult === 'incorrect') incorrect++;
    }
  }

  return {
    total: summary.questions.length,
    attempted,
    fullyCorrect,
    partiallyCorrect,
    incorrect,
    rawScore,
    maxScore,
    attemptedMaxScore,
    flagged,
    percentScore:
      attemptedMaxScore > 0 ? Math.round((rawScore / attemptedMaxScore) * 100) : 0,
    completionPercent:
      summary.questions.length > 0
        ? Math.round((attempted / summary.questions.length) * 100)
        : 0,
  };
}

/** The distinct modalities in a region, for the home's card metadata. */
export function sectionModalities(section: SectionId): string[] {
  return ANATOMY_SUMMARY[section]?.modalities ?? [];
}

/** A question id chosen at random — what the home's "surprise me" opens. */
export function randomQuestionId(section: SectionId): string | null {
  const items = ANATOMY_SUMMARY[section]?.questions ?? [];
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)][0];
}
