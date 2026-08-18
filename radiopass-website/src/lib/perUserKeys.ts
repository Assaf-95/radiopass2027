/**
 * Local state that belongs to whoever is signed in, and must not outlive them
 * on a shared machine.
 *
 * Its own module so the sign-out path and the test that guards it read the
 * SAME list. Scraping it out of auth.tsx with a regex, which is what the test
 * did first, is a guard that can pass while the real list is wrong.
 *
 * Anatomy's keys are here because anatomy is part of this application now.
 * Before the merge it was a separate build with no account at all, so there
 * was no boundary for its state to cross; there is one now, and every anatomy
 * key below is one person's work.
 *
 * Deliberately NOT here: display preferences. The theme and the reduced-motion
 * choice describe the device and the person sitting at it rather than the
 * account, and wiping them on sign-out is a worse experience for no privacy
 * gain. Nor the published content cache, which is identical for everyone.
 */
export const PER_USER_KEYS: readonly string[] = [
  /* --- Physics ---------------------------------------------------------- */

  /* Unlocks the authoring tools. It gates the interface only — every write is
     re-checked server-side — but leaving it set would hand the next person an
     admin-looking site. */
  'radiopass.author.v1',
  /* A mock paper part-way through, with the answers given so far. Unlike the
     progress stores this has no Supabase copy, so it is genuinely discarded —
     which is right: an unfinished exam belongs to the person sitting it, and
     inheriting a stranger's half-written paper is not a feature. */
  'radiopass.qbank.mock.v1',
  /* The learner event log — mock history, module completions, activity dates.
     Written by both branches under one key. */
  'radiopass.learner.events.v1',
  /* The Continue chip's label cache. The POSITION lives on the shared learner
     timeline (module.started events, synced); this key only remembers the
     human label that goes with it ("CT · Dose — question 3"). Local-only and
     presentation-only, but it is still one person's place. */
  'radiopass.physics2.v1',

  /* --- Anatomy ---------------------------------------------------------- */

  'frcr-anatomy-progress-v1', // answers and marks, question by question
  'frcr-anatomy-disputes-v1', // marks this candidate appealed
  'frcr-anatomy-last-question-v1', // where they were in each region
  'radiopass-activity-v1', // days studied, time, submissions
  'radiopass-quiz-v1', // atlas and viewer quiz scores
  'radiopass-cxr-annotations-v1', // their own drawing on the chest films
  'radiopass-stack-annotations-v1', // and on the cross-sectional stacks

  /* --- Authoring privilege and unpublished authoring work ---------------- *
     Not learner state, but emphatically not something to hand to whoever signs
     in next: these unlock the editor interface and hold one author's unsaved
     changes. */
  'radiopass-admin-v1',
  'radiopass-editor-session-v1',
  'radiopass-question-edits-v1',
  'frcr-anatomy-custom-questions-v1',
]

/** Preferences that describe the device, never the account. */
export const DEVICE_PREFERENCE_KEYS: readonly string[] = [
  'radiopass-theme-v2',
  'radiopass.focus.v1',
  'radiopass.sound.v1',
  'radiopass-content-cache-v1',
]
