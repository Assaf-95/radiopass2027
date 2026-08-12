import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 950 } });
const errs=[]; p.on('pageerror', e=>errs.push(String(e).slice(0,160)));

// 1. Visual Lab — is the MRI course and the archive reachable by clicking?
await p.goto('https://radiopass.netlify.app/visual-lab', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
const visualLab = await p.evaluate(() => ({
  mriCard: [...document.querySelectorAll('.labs-grid article')].map(a => ({
    title: a.querySelector('h3')?.textContent,
    main: a.querySelector('a[href]')?.getAttribute('href'),
    extras: [...a.querySelectorAll('.lab-extras a')].map(x=>x.getAttribute('href')),
  })).find(c => /MRI/i.test(c.title||'')),
  archiveLink: document.querySelector('.lab-archive-note a')?.getAttribute('href'),
}));

// 2. click through: Visual Lab -> MRI course
await p.click('.labs-grid article:has(h3:text-matches("MRI")) a');
await p.waitForTimeout(1500);
const onCourse = await p.evaluate(() => ({ url: location.pathname, h1: document.querySelector('h1')?.textContent?.trim() }));

// 3. Begin the module -> core physics
await p.evaluate(() => [...document.querySelectorAll('a')].find(a=>/begin the module/i.test(a.textContent))?.click());
await p.waitForTimeout(1800);
const onCore = await p.evaluate(() => ({ url: location.pathname, title: document.querySelector('.lx-bar-title')?.textContent }));

// 4. from inside the OLD lab, can you get back to the course?
await p.goto('https://radiopass.netlify.app/mri-lab', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
const insideLab = await p.evaluate(() => ({
  courseChip: !!document.querySelector('.mri-stage-course'),
  crumbHasCourse: [...document.querySelectorAll('.mri-eyebrow a')].map(a=>a.getAttribute('href')),
}));

// 5. archive
await p.goto('https://radiopass.netlify.app/library', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
const archive = await p.evaluate(() => ({ cards: document.querySelectorAll('.lx-lib-card').length }));

console.log(JSON.stringify({ visualLab, onCourse, onCore, insideLab, archive, errs }, null, 1));
await b.close();
