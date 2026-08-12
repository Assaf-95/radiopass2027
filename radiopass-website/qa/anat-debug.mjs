import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 },
  httpCredentials: { username: 'frcr', password: 'frcr-anatomy-2026' } });
const p = await ctx.newPage();
const errs=[]; p.on('pageerror', e=>errs.push(String(e).slice(0,300)));
await p.goto('https://radiopass-anatomy.netlify.app/#/section/upper-limb/custom', { waitUntil: 'networkidle' });
await p.waitForTimeout(3000);
console.log(JSON.stringify({
  url: p.url(),
  text: (await p.evaluate(() => document.body.innerText)).slice(0, 500),
  inputs: await p.evaluate(() => [...document.querySelectorAll('input')].map(i => i.type)),
  errs,
}, null, 1));
await b.close();
