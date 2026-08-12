/* ===========================================================================
   Account and study activity

   There is no server here. The account is held in this browser's local
   storage, which is what makes it survive closing the tab, quitting the
   browser and shutting the machine down — but it is per-browser and per-
   machine, and clearing site data clears it. Everything the learner does is
   written the moment they do it, so nothing depends on remembering to save.
   =========================================================================== */

const ACCOUNT_KEY = 'radiopass-account-v1';
const ACTIVITY_KEY = 'radiopass-activity-v1';
const QUIZ_KEY = 'radiopass-quiz-v1';

export type Plan = 'trial' | 'pass' | 'pass-plus';

export interface Account {
  name: string;
  email: string;
  plan: Plan;
  /** ISO date the account was created in this browser. */
  memberSince: string;
  /** Exam the learner is working toward, shown on the dashboard. */
  examDate?: string;
}

export interface Activity {
  /** ISO dates (YYYY-MM-DD) on which at least one question was submitted. */
  days: string[];
  lastActive?: string;
  /** Seconds spent with a question open, accumulated. */
  secondsStudied: number;
  /** Questions submitted, all time — not the same as unique questions. */
  submissions: number;
}

export interface QuizRecord {
  attempts: number;
  correct: number;
  bestStreak: number;
  missed: string[];
}

export const PLAN_LABEL: Record<Plan, string> = {
  trial: 'Trial',
  pass: 'Pass',
  'pass-plus': 'Pass Plus',
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private browsing or quota: the session still works, it just will not
       outlive the tab, and the sign-in screen will say so */
  }
}

/** True when writes actually survive — private browsing silently discards. */
export function storageWorks(): boolean {
  try {
    const probe = '__rp_probe__';
    localStorage.setItem(probe, '1');
    const ok = localStorage.getItem(probe) === '1';
    localStorage.removeItem(probe);
    return ok;
  } catch {
    return false;
  }
}

export function getAccount(): Account | null {
  return read<Account | null>(ACCOUNT_KEY, null);
}

export function signIn(name: string, email: string, plan: Plan = 'pass'): Account {
  const existing = getAccount();
  const account: Account = existing
    ? { ...existing, name, email, plan }
    : { name, email, plan, memberSince: new Date().toISOString().slice(0, 10) };
  write(ACCOUNT_KEY, account);
  return account;
}

export function updateAccount(patch: Partial<Account>): Account | null {
  const a = getAccount();
  if (!a) return null;
  const next = { ...a, ...patch };
  write(ACCOUNT_KEY, next);
  return next;
}

/** Signs out without destroying anything — the work is still here on return. */
export function signOut() {
  try {
    localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    /* nothing to do */
  }
}

export function getActivity(): Activity {
  return read<Activity>(ACTIVITY_KEY, { days: [], secondsStudied: 0, submissions: 0 });
}

/** Called when a question is submitted. Records the day for the streak. */
export function recordSubmission() {
  const a = getActivity();
  const today = new Date().toISOString().slice(0, 10);
  if (!a.days.includes(today)) a.days.push(today);
  a.lastActive = new Date().toISOString();
  a.submissions += 1;
  write(ACTIVITY_KEY, a);
}

export function recordStudySeconds(seconds: number) {
  if (seconds <= 0 || seconds > 3600) return; // ignore a tab left open overnight
  const a = getActivity();
  a.secondsStudied += Math.round(seconds);
  a.lastActive = new Date().toISOString();
  write(ACTIVITY_KEY, a);
}

/** Consecutive days up to today, or up to yesterday if today is not done yet. */
export function currentStreak(days: string[] = getActivity().days): number {
  if (!days.length) return 0;
  const set = new Set(days);
  const d = new Date();
  // A streak survives until the end of tomorrow: studying yesterday and not
  // yet today should not read as a broken streak at breakfast.
  if (!set.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  let n = 0;
  for (;;) {
    if (!set.has(d.toISOString().slice(0, 10))) break;
    n += 1;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/* --- Quiz scores ----------------------------------------------------------
   The quizzes in the chest film atlas and the MRI viewer kept their score in
   component state, so a reload wiped it. They are recorded here instead. */

export function getQuiz(id: string): QuizRecord {
  const all = read<Record<string, QuizRecord>>(QUIZ_KEY, {});
  return all[id] ?? { attempts: 0, correct: 0, bestStreak: 0, missed: [] };
}

export function recordQuizAnswer(id: string, correct: boolean, missedLabel?: string, streak = 0) {
  const all = read<Record<string, QuizRecord>>(QUIZ_KEY, {});
  const r = all[id] ?? { attempts: 0, correct: 0, bestStreak: 0, missed: [] };
  r.attempts += 1;
  if (correct) r.correct += 1;
  r.bestStreak = Math.max(r.bestStreak, streak);
  if (!correct && missedLabel && !r.missed.includes(missedLabel)) r.missed.push(missedLabel);
  all[id] = r;
  write(QUIZ_KEY, all);
  recordSubmission();
}

export function resetQuiz(id: string) {
  const all = read<Record<string, QuizRecord>>(QUIZ_KEY, {});
  delete all[id];
  write(QUIZ_KEY, all);
}

export function allQuizzes(): Record<string, QuizRecord> {
  return read<Record<string, QuizRecord>>(QUIZ_KEY, {});
}
