/**
 * Anatomy learner state — answers, appealed marks, and where you had reached.
 *
 * ACCOUNT-BACKED SINCE THIS FILE STOPPED BEING localStorage-ONLY.
 *
 * It used to write straight to localStorage and nowhere else, while the header
 * told a signed-in candidate that "your progress follows this account between
 * devices". It did not. Answer a hundred questions on a laptop, sign in on
 * another machine, and the bank was empty — the account identified you and
 * carried nothing. Everything here now goes through createSyncedStore, the
 * same mechanism the physics question bank has always used.
 *
 * THE LOCAL KEYS ARE UNCHANGED, deliberately: 'frcr-anatomy-progress-v1' and
 * its two siblings are still the localStorage keys, so a candidate who has
 * been working offline keeps every answer, and their first sign-in merges that
 * work upward rather than replacing it.
 *
 * WHY THE WRITE DELAY SURVIVED THE CONVERSION
 * -------------------------------------------
 * Every answered question lives under one key, so the whole store is parsed on
 * read and serialised on write. The question player saves on EVERY keystroke.
 * Measured on a real bank part-way through — a 260 KB store — an immediate
 * write cost 3.4 ms per character and 28 ms for a single Flag click on a fast
 * desktop, several times worse on a phone, and all of it blocking the
 * keystroke that caused it.
 *
 * createSyncedStore.write() persists synchronously and then pushes to
 * Supabase, so calling it per keystroke would have reintroduced exactly that
 * cost and added a network request per character on top. The coalescing layer
 * therefore sits ON TOP of the synced store rather than being replaced by it:
 * edits accumulate in `pending`, and one flush 400 ms later both persists and
 * syncs. Typing costs a render and nothing else, and the network sees one
 * write per pause rather than one per letter.
 */

import type { DisputeRecord, QuestionProgress, SectionId } from '../types';
import { createSyncedStore } from '../../lib/syncedStore';

export interface ProgressStore {
  questions: Record<string, QuestionProgress>;
}

/* ------------------------------------------------------------------ *
 * Answers
 * ------------------------------------------------------------------ */

const progressStore = createSyncedStore<ProgressStore>({
  localKey: 'frcr-anatomy-progress-v1',
  table: 'anatomy_progress',
  empty: { questions: {} },
  /* A question answered on two devices before either synced keeps the local
     attempt, matching the physics stores — the device in front of you is
     treated as the more recent activity, since entries carry no timestamp. */
  merge: (local, remote) => ({ questions: { ...remote.questions, ...local.questions } }),
  /* The store predates any schema discipline and a malformed blob would
     otherwise reach the player as `undefined.questions`. */
  sanitize: (raw) => {
    const r = raw as ProgressStore | null;
    return r && typeof r === 'object' && r.questions && typeof r.questions === 'object'
      ? { questions: r.questions }
      : { questions: {} };
  },
});

/** Edits not yet flushed. Null when everything is written. */
let pending: ProgressStore | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
const WRITE_DELAY_MS = 400;

export function loadProgress(): ProgressStore {
  return pending ?? progressStore.read();
}

function scheduleWrite() {
  if (writeTimer !== null) return;
  writeTimer = setTimeout(flushProgress, WRITE_DELAY_MS);
}

/** Writes any pending change out immediately — locally and to the account. */
export function flushProgress() {
  if (writeTimer !== null) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  if (!pending) return;
  const next = pending;
  /* Cleared BEFORE the write, because write() notifies listeners synchronously
     and one of them is the subscription below. */
  pending = null;
  progressStore.write(next);
}

/* The store changed underneath us — a sign-in merge brought the account's copy
   down, or a sign-out dropped this device's. Either way `pending` describes a
   state that no longer exists, and on sign-out it is the previous candidate's
   work, which must not be written back over the next person's. At most 400 ms
   of typing is discarded, the same window the delay always had. */
progressStore.subscribe(() => {
  if (writeTimer !== null) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  pending = null;
});

if (typeof window !== 'undefined') {
  /* A delayed write must never be the reason work is lost. Both events fire
     before the page goes away — pagehide covers a real navigation or close,
     visibilitychange covers a phone being locked or the tab being switched,
     which on mobile is often the last callback a page gets. */
  window.addEventListener('pagehide', flushProgress);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushProgress();
  });
}

export function saveQuestionProgress(qp: QuestionProgress) {
  /* Copied once per flush cycle, then mutated in place: a 260 KB store must
     not be re-spread on every keystroke. */
  if (!pending) pending = { questions: { ...progressStore.read().questions } };
  pending.questions[qp.questionId] = qp;
  scheduleWrite();
}

export function getQuestionProgress(questionId: string): QuestionProgress | undefined {
  return loadProgress().questions[questionId];
}

export function resetSectionProgress(questionIds: string[]) {
  const next = { questions: { ...loadProgress().questions } };
  for (const id of questionIds) delete next.questions[id];
  pending = next;
  flushProgress();
}

export function resetAllProgress() {
  pending = { questions: {} };
  flushProgress();
  disputesStore.write([]);
}

/** Whether the account copy is currently failing to sync. */
export function progressSyncFailing(): boolean {
  return progressStore.hasSyncError();
}

export function subscribeProgress(listener: () => void): () => void {
  return progressStore.subscribe(listener);
}

/* ------------------------------------------------------------------ *
 * Disputes — marks this candidate appealed
 * ------------------------------------------------------------------ */

const disputesStore = createSyncedStore<DisputeRecord[]>({
  localKey: 'frcr-anatomy-disputes-v1',
  table: 'anatomy_disputes',
  empty: [],
  /* Appeals are append-only and carry their own id, so the two sides are
     unioned rather than one winning: an appeal raised on a phone and another
     on a laptop are both real and both must survive. */
  merge: (local, remote) => {
    const byId = new Map<string, DisputeRecord>();
    for (const d of [...remote, ...local]) if (d && d.id) byId.set(d.id, d);
    return [...byId.values()];
  },
  sanitize: (raw) => (Array.isArray(raw) ? (raw as DisputeRecord[]) : []),
});

export function loadDisputes(): DisputeRecord[] {
  return disputesStore.read();
}

export function saveDispute(record: DisputeRecord) {
  disputesStore.write([...disputesStore.read(), record]);
}

export function updateDispute(id: string, update: Partial<DisputeRecord>) {
  const disputes = disputesStore.read();
  const idx = disputes.findIndex((d) => d.id === id);
  if (idx < 0) return;
  const next = [...disputes];
  next[idx] = { ...next[idx], ...update };
  disputesStore.write(next);
}

/* ------------------------------------------------------------------ *
 * Bookmarks — where the candidate had reached in each region
 * ------------------------------------------------------------------ */

const bookmarksStore = createSyncedStore<Record<string, string>>({
  localKey: 'frcr-anatomy-last-question-v1',
  table: 'anatomy_bookmarks',
  empty: {},
  merge: (local, remote) => ({ ...remote, ...local }),
  sanitize: (raw) => (raw && typeof raw === 'object' ? (raw as Record<string, string>) : {}),
});

export function setLastQuestion(section: SectionId, questionId: string) {
  bookmarksStore.write({ ...bookmarksStore.read(), [section]: questionId });
}

export function getLastQuestion(section: SectionId): string | undefined {
  return bookmarksStore.read()[section];
}
