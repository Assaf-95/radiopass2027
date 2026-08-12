import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 950 } });

// hub: per-subject counts + review filters
await p.goto('https://radiopass.netlify.app/question-bank', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
const hub = await p.evaluate(() => ({
  subjectCounts: [...document.querySelectorAll('.qb-subject-card .qb-subject-count')].map(e => e.textContent.trim()),
  progressBars: document.querySelectorAll('.qb-subject-progress').length,
  reviewCards: [...document.querySelectorAll('.qb-review-card')].map(e => e.textContent.trim().replace(/\s+/g,' ')),
}));

// subject page: filters must be GONE
await p.goto('https://radiopass.netlify.app/question-bank/ct', { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
const subj = await p.evaluate(() => ({ filterBar: !!document.querySelector('.qb-filter-bar') }));

// answer + submit, then leave and return — must be locked and visible
await p.evaluate(() => document.querySelectorAll('.qb-stem').forEach(s => s.querySelector('.qb-tf button')?.click()));
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /check my answers/i.test(b.textContent))?.click());
await p.waitForTimeout(500);
const stored = await p.evaluate(() => {
  const o = JSON.parse(localStorage.getItem('radiopass.qbank.progress.v1') || '{}');
  const k = Object.keys(o)[0];
  return { count: Object.keys(o).length, hasChoices: !!o[k]?.choices, hasSubmittedAt: !!o[k]?.submittedAt };
});
await p.goto('https://radiopass.netlify.app/question-bank', { waitUntil: 'networkidle' });
await p.goto('https://radiopass.netlify.app/question-bank/ct', { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
const afterReturn = await p.evaluate(() => ({
  locked: document.querySelectorAll('.qb-tf button').length === 0,
  verdicts: document.querySelectorAll('.qb-verdict').length,
  savedNote: !!document.querySelector('.qb-saved-note'),
}));

// mock must still be a fresh sit
await p.goto('https://radiopass.netlify.app/question-bank/mock', { waitUntil: 'networkidle' });
await p.evaluate(() => [...document.querySelectorAll('button,a')].find(b => /start the paper/i.test(b.textContent))?.click());
await p.waitForTimeout(900);
const mock = await p.evaluate(() => ({
  tfButtons: document.querySelectorAll('.qb-tf button').length,
  prefilledVerdicts: document.querySelectorAll('.qb-verdict').length,
}));

console.log(JSON.stringify({ hub, subj, stored, afterReturn, mock }, null, 1));
await b.close();
