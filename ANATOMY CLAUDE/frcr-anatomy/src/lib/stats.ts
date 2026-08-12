import type { Question, SectionId } from '../types';
import { getSectionQuestions } from '../data/sections';
import { loadProgress } from './progress';

export interface SectionStats {
  total: number;
  attempted: number;
  fullyCorrect: number;
  partiallyCorrect: number;
  incorrect: number;
  rawScore: number;
  maxScore: number;
  percentScore: number;
  completionPercent: number;
  flagged: number;
  disputed: number;
  lateralityErrors: number;
}

export function computeSectionStats(section: SectionId): SectionStats {
  const questions = getSectionQuestions(section);
  const progress = loadProgress();
  let attempted = 0;
  let fullyCorrect = 0;
  let partiallyCorrect = 0;
  let incorrect = 0;
  let rawScore = 0;
  let maxScore = 0;
  let flagged = 0;
  let lateralityErrors = 0;

  for (const q of questions) {
    maxScore += Object.keys(q.answers).length * 2;
    const p = progress.questions[q.id];
    if (!p) continue;
    if (p.flaggedForReview) flagged++;
    if (p.status === 'submitted' && p.graded) {
      attempted++;
      rawScore += p.graded.totalScore;
      if (p.graded.overallResult === 'correct') fullyCorrect++;
      else if (p.graded.overallResult === 'partial') partiallyCorrect++;
      else if (p.graded.overallResult === 'incorrect') incorrect++;
      for (const g of Object.values(p.graded.graded)) {
        if (g.score === 1) lateralityErrors++;
        if (g.result === 'incorrect' && q.answers[g.label]?.lateralityRequired) {
          const official = q.answers[g.label].officialAnswer.toLowerCase();
          const user = g.userAnswer.toLowerCase();
          const sideWords = ['right', 'left'];
          const officialSide = sideWords.find((s) => official.includes(s));
          const userSide = sideWords.find((s) => user.includes(s));
          if (officialSide && userSide && officialSide !== userSide) lateralityErrors++;
        }
      }
    }
  }

  return {
    total: questions.length,
    attempted,
    fullyCorrect,
    partiallyCorrect,
    incorrect,
    rawScore,
    maxScore,
    percentScore: maxScore > 0 ? Math.round((rawScore / maxScore) * 100) : 0,
    completionPercent: questions.length > 0 ? Math.round((attempted / questions.length) * 100) : 0,
    flagged,
    disputed: 0,
    lateralityErrors,
  };
}

export function questionsByModality(section: SectionId, modality: string): Question[] {
  return getSectionQuestions(section).filter((q) => q.modalitySection === modality);
}

export function questionsByRegion(section: SectionId, region: string): Question[] {
  return getSectionQuestions(section).filter((q) => q.regionTags.includes(region));
}

export function incorrectQuestions(section: SectionId): Question[] {
  const progress = loadProgress();
  return getSectionQuestions(section).filter((q) => {
    const p = progress.questions[q.id];
    return p?.graded && p.graded.overallResult === 'incorrect';
  });
}

export function partiallyCorrectQuestions(section: SectionId): Question[] {
  const progress = loadProgress();
  return getSectionQuestions(section).filter((q) => {
    const p = progress.questions[q.id];
    return p?.graded && p.graded.overallResult === 'partial';
  });
}

export function flaggedQuestions(section: SectionId): Question[] {
  const progress = loadProgress();
  return getSectionQuestions(section).filter((q) => progress.questions[q.id]?.flaggedForReview);
}

export function favouritedQuestions(section: SectionId): Question[] {
  const progress = loadProgress();
  return getSectionQuestions(section).filter((q) => progress.questions[q.id]?.favourited);
}
