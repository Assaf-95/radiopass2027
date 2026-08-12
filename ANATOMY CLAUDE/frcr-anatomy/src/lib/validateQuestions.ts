import type { Question } from '../types';

export interface ValidationIssue {
  questionId: string;
  section: string;
  severity: 'error' | 'warning';
  code: string;
  detail: string;
}

const LETTER_SEQUENCE = 'ABCDEFGH'.split('');

/**
 * Structural checks over a question bank. Every rule here is about internal
 * consistency — things that would leave a learner unable to answer (a label
 * with no input, an input with no label) or would score them wrongly.
 *
 * Deliberately NOT checked: whether an answer is anatomically right. That
 * lives in the source PDFs and is verified during extraction; guessing at it
 * here would risk "correcting" the atlas.
 */
export function validateQuestions(questions: Question[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenIds = new Set<string>();

  for (const q of questions) {
    const add = (severity: ValidationIssue['severity'], code: string, detail: string) =>
      issues.push({ questionId: q.id, section: q.section, severity, code, detail });

    if (seenIds.has(q.id)) add('error', 'duplicate-question-id', `Question id "${q.id}" is used more than once.`);
    seenIds.add(q.id);

    // --- Labels ---
    if (!q.labels || q.labels.length === 0) {
      add('error', 'no-labels', 'Question has no labels.');
    } else {
      const dupes = q.labels.filter((l, i) => q.labels.indexOf(l) !== i);
      if (dupes.length > 0) add('error', 'duplicate-label', `Repeated label(s): ${[...new Set(dupes)].join(', ')}.`);

      const numeric = q.labels.filter((l) => /^\d+$/.test(l));
      if (numeric.length > 0) {
        add('error', 'numeric-label', `Labels still numeric: ${numeric.join(', ')} — should be sequential letters.`);
      }

      // Letters must start at A and run consecutively. "Answer" is the
      // single-answer sentinel used by one-arrow questions and is exempt.
      const isSingleAnswer = q.labels.length === 1 && q.labels[0] === 'Answer';
      if (!isSingleAnswer && numeric.length === 0) {
        const allUpperLetters = q.labels.every((l) => LETTER_SEQUENCE.includes(l));
        const ascending = q.labels.every(
          (l, i) => i === 0 || LETTER_SEQUENCE.indexOf(l) > LETTER_SEQUENCE.indexOf(q.labels[i - 1])
        );
        if (!allUpperLetters || !ascending) {
          const expected = LETTER_SEQUENCE.slice(0, q.labels.length);
          add('error', 'non-sequential-labels', `Labels are ${q.labels.join(', ')}; expected ${expected.join(', ')}.`);
        } else if (q.labels.join(',') !== LETTER_SEQUENCE.slice(0, q.labels.length).join(',')) {
          // Ascending letters with a gap (A, C, D, E). Some source images
          // genuinely skip a letter — usually because two sub-questions ask
          // about the same arrow. Closing the gap here would desync the
          // answer fields from the letters printed on the image, which is
          // worse, so this is surfaced for review rather than auto-fixed.
          add(
            'warning',
            'label-gap',
            `Labels ${q.labels.join(', ')} skip a letter. Confirm this matches the printed image before changing.`
          );
        }
      }
    }

    // --- Label <-> answer symmetry (drives the input fields and the score) ---
    const answerKeys = Object.keys(q.answers ?? {});
    for (const l of q.labels ?? []) {
      if (!q.answers?.[l]) add('error', 'label-without-answer', `Label "${l}" has no answer entry, so it cannot be scored.`);
    }
    for (const k of answerKeys) {
      if (!q.labels?.includes(k)) add('error', 'answer-without-label', `Answer entry "${k}" has no matching visible label.`);
    }

    // --- Answer content ---
    for (const [k, spec] of Object.entries(q.answers ?? {})) {
      if (!spec.officialAnswer || !spec.officialAnswer.trim()) {
        add('error', 'missing-official-answer', `Answer "${k}" has no official answer text.`);
      }
      if (spec.lateralityRequired && !/\b(right|left)\b/i.test(spec.officialAnswer ?? '')) {
        add('warning', 'laterality-flag-mismatch', `Answer "${k}" requires laterality but its official answer names no side.`);
      }
      if (!spec.lateralityRequired && /\b(right|left)\b/i.test(spec.officialAnswer ?? '')) {
        add('warning', 'laterality-not-enforced', `Answer "${k}" names a side but lateralityRequired is false.`);
      }
    }

    // --- Image ---
    if (!q.imagePath || !q.imagePath.trim()) add('error', 'missing-image', 'Question has no image path.');

    // --- Marker overlay (only when a question opts into one) ---
    if (q.markerPositions) {
      for (const l of q.labels ?? []) {
        const p = q.markerPositions[l];
        if (!p) {
          add('error', 'missing-marker', `Label "${l}" has no marker coordinates but the question uses an overlay.`);
          continue;
        }
        if (p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100) {
          add('error', 'marker-out-of-bounds', `Marker "${l}" at (${p.x}, ${p.y}) falls outside the image.`);
        }
      }
      const coords = Object.entries(q.markerPositions).map(([l, p]) => [l, `${p.x},${p.y}`] as const);
      const bySpot = new Map<string, string[]>();
      for (const [l, spot] of coords) bySpot.set(spot, [...(bySpot.get(spot) ?? []), l]);
      for (const [spot, labels] of bySpot) {
        if (labels.length > 1) add('warning', 'duplicate-marker-position', `Labels ${labels.join(', ')} share position ${spot}.`);
      }
    }
  }

  return issues;
}

export function summariseIssues(issues: ValidationIssue[]) {
  const byCode = new Map<string, number>();
  for (const i of issues) byCode.set(i.code, (byCode.get(i.code) ?? 0) + 1);
  return {
    total: issues.length,
    errors: issues.filter((i) => i.severity === 'error').length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    byCode: Object.fromEntries(byCode),
  };
}
