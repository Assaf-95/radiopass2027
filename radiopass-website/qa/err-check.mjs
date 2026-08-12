import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs=[];
p.on('pageerror', e => errs.push({ msg: String(e.message||e).slice(0,200), stack: String(e.stack||'').split('\n').slice(0,4).join(' | ').slice(0,500) }));
await p.goto('https://radiopass.netlify.app/mri-lab/course', { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
const state = await p.evaluate(() => ({
  h1: document.querySelector('h1')?.textContent?.trim(),
  groups: document.querySelectorAll('.lx-course-group').length,
  links: document.querySelectorAll('.lx-contents a').length,
  beginHref: [...document.querySelectorAll('a')].find(a=>/begin the module/i.test(a.textContent))?.getAttribute('href'),
}));
console.log(JSON.stringify({ state, errs }, null, 1));
await b.close();
