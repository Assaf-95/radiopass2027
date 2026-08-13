import type { DisputeRecord, QuestionProgress, SectionId } from '../types';

const STORAGE_KEY = 'frcr-anatomy-progress-v1';
const DISPUTES_KEY = 'frcr-anatomy-disputes-v1';
const LAST_QUESTION_KEY = 'frcr-anatomy-last-question-v1';

export interface ProgressStore {
  questions: Record<string, QuestionProgress>;
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode / quota) — fail silently, in-memory state still works this session
  }
}

/* The progress store is held in memory and written back on a short delay.
   Both halves of that matter for how the app feels.

   Every answered question lives under one key, so the whole store is parsed
   on read and serialised on write. The question player saves on EVERY
   keystroke, and each save previously did two full parses (once to load, once
   to read the attempt count) plus a full stringify and a synchronous
   localStorage write. Measured on a real bank part-way through — a 260 KB
   store — that was 3.4 ms per character and 28 ms for a single Flag click, on
   a fast desktop; on a phone, several times worse, and all of it blocking the
   keystroke that triggered it.

   Reads now hit the cache, and writes coalesce, so typing costs a render and
   nothing else. */
let cache: ProgressStore | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
const WRITE_DELAY_MS = 400;

export function loadProgress(): ProgressStore {
  if (!cache) cache = readJSON<ProgressStore>(STORAGE_KEY, { questions: {} });
  return cache;
}

function scheduleWrite() {
  if (writeTimer !== null) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    if (cache) writeJSON(STORAGE_KEY, cache);
  }, WRITE_DELAY_MS);
}

/** Writes any pending change out immediately. */
export function flushProgress() {
  if (writeTimer !== null) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  if (cache) writeJSON(STORAGE_KEY, cache);
}

if (typeof window !== 'undefined') {
  /* A delayed write must never be the reason work is lost. Both events fire
     before the page goes away — pagehide covers a real navigation or close,
     visibilitychange covers a phone being locked or the tab being switched,
     which on mobile is often the last callback a page gets. */
  window.addEventListener('pagehide', flushProgress);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushProgress();
  });
  /* Another tab of the same site wrote the store: drop the cache so this one
     re-reads rather than overwriting their work from a stale copy. */
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) cache = null;
  });
}

export function saveQuestionProgress(qp: QuestionProgress) {
  const store = loadProgress();
  store.questions[qp.questionId] = qp;
  scheduleWrite();
}

export function getQuestionProgress(questionId: string): QuestionProgress | undefined {
  return loadProgress().questions[questionId];
}

export function resetSectionProgress(questionIds: string[]) {
  const store = loadProgress();
  for (const id of questionIds) delete store.questions[id];
  flushProgress();
}

export function resetAllProgress() {
  cache = { questions: {} };
  flushProgress();
  writeJSON(DISPUTES_KEY, []);
}

export function loadDisputes(): DisputeRecord[] {
  return readJSON<DisputeRecord[]>(DISPUTES_KEY, []);
}

export function saveDispute(record: DisputeRecord) {
  const disputes = loadDisputes();
  disputes.push(record);
  writeJSON(DISPUTES_KEY, disputes);
}

export function updateDispute(id: string, update: Partial<DisputeRecord>) {
  const disputes = loadDisputes();
  const idx = disputes.findIndex((d) => d.id === id);
  if (idx >= 0) {
    disputes[idx] = { ...disputes[idx], ...update };
    writeJSON(DISPUTES_KEY, disputes);
  }
}

export function setLastQuestion(section: SectionId, questionId: string) {
  const map = readJSON<Record<string, string>>(LAST_QUESTION_KEY, {});
  map[section] = questionId;
  writeJSON(LAST_QUESTION_KEY, map);
}

export function getLastQuestion(section: SectionId): string | undefined {
  const map = readJSON<Record<string, string>>(LAST_QUESTION_KEY, {});
  return map[section];
}
