/* ===========================================================================
   The learner event log — anatomy's half.

   MIRRORED, NOT COPIED CASUALLY. This is deliberately the same key, the same
   schema and the same version as
   radiopass-website/src/lib/learner.ts. Anatomy is still a separate Vite
   build so it cannot import that module, but both halves share an origin in
   the packaged deployment and therefore share localStorage: one timeline, two
   writers. Physics reads anatomy's events and anatomy reads physics'.

   THE TWO COPIES MUST CHANGE TOGETHER. LEARNER_SCHEMA is how a mismatch is
   caught instead of silently corrupting the log — events at an unrecognised
   version are kept on disk and ignored on read, so a half-deployed change
   loses nothing. This duplication is the single clearest thing the eventual
   physical merge deletes.

   ADDITIVE. Nothing here migrates, resets or reads the existing anatomy
   progress store. `frcr-anatomy-progress-v1` remains the source of truth for
   what has been answered and scored; this records WHEN things happened, which
   nothing previously did.
   =========================================================================== */

export const LEARNER_EVENTS_KEY = 'radiopass.learner.events.v1';
export const LEARNER_SCHEMA = 1;

export type Subject = 'anatomy' | 'physics';

type Base = {
  v: typeof LEARNER_SCHEMA;
  /** ISO 8601, UTC. */
  at: string;
  subject: Subject;
};

export type LearnerEvent =
  | (Base & { type: 'question.viewed'; contentId: string; topic?: string })
  | (Base & {
      type: 'question.answered';
      contentId: string;
      topic?: string;
      /** Anatomy scores 0/1/2 per label; physics one per stem. Both fit. */
      correct: number;
      outOf: number;
    })
  | (Base & { type: 'question.flagged'; contentId: string; on: boolean })
  | (Base & { type: 'structure.encountered'; contentId: string; chapter?: string })
  | (Base & { type: 'module.started' | 'module.completed'; contentId: string; topic?: string })
  | (Base & { type: 'lab.opened' | 'lab.completed'; contentId: string })
  | (Base & { type: 'mock.started'; attemptId: string; paper: string; questionCount: number })
  | (Base & {
      type: 'mock.completed';
      attemptId: string;
      paper: string;
      correct: number;
      outOf: number;
      attempted: number;
      questionCount: number;
      perTopic?: Record<string, { correct: number; outOf: number }>;
    });

const MAX_EVENTS = 4000;

function readAll(): LearnerEvent[] {
  try {
    const raw = localStorage.getItem(LEARNER_EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    /* Defensive on every field, because the other build writes this too. One
       malformed entry must not throw inside a render and blank the page. */
    return parsed.filter(
      (e): e is LearnerEvent =>
        e &&
        typeof e === 'object' &&
        e.v === LEARNER_SCHEMA &&
        typeof e.type === 'string' &&
        typeof e.at === 'string'
    );
  } catch {
    return [];
  }
}

function writeAll(events: LearnerEvent[]) {
  try {
    localStorage.setItem(LEARNER_EVENTS_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    /* Quota or private browsing. History is the least important thing on the
       device — never let losing it break the session that produced it. */
  }
}

export function readEvents(): LearnerEvent[] {
  return readAll();
}

/** Distributive: a plain Omit over a union collapses it to the shared keys. */
type Recordable<T> = T extends unknown ? Omit<T, 'v' | 'at'> & { at?: string } : never;

export function record(event: Recordable<LearnerEvent>): void {
  const full = {
    ...event,
    v: LEARNER_SCHEMA,
    at: (event as { at?: string }).at ?? new Date().toISOString(),
  } as LearnerEvent;
  writeAll([...readAll(), full]);
}

export function clearEvents(): void {
  try {
    localStorage.removeItem(LEARNER_EVENTS_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** The most recent event, optionally in one branch. */
export function lastActivity(subject?: Subject): LearnerEvent | null {
  const all = readAll().filter((e) => !subject || e.subject === subject);
  return all.length ? all[all.length - 1] : null;
}

/** The most recent event of one kind — what "continue" is built from. */
export function lastOfType<K extends LearnerEvent['type']>(
  type: K,
  subject?: Subject
): Extract<LearnerEvent, { type: K }> | null {
  const all = readAll().filter(
    (e): e is Extract<LearnerEvent, { type: K }> =>
      e.type === type && (!subject || e.subject === subject)
  );
  return all.length ? all[all.length - 1] : null;
}

/** Distinct days carrying at least one event — an honest streak input. */
export function activeDays(subject?: Subject): string[] {
  const days = new Set<string>();
  for (const e of readAll()) {
    if (!subject || e.subject === subject) days.add(e.at.slice(0, 10));
  }
  return [...days].sort();
}
