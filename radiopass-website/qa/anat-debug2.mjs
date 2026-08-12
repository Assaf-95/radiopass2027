import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 },
  httpCredentials: { username: 'frcr', password: 'frcr-anatomy-2026' } });
const p = await ctx.newPage();
await p.goto('https://radiopass-anatomy.netlify.app/#/section/upper-limb/custom', { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
if (await p.$('input[type=email]')) {
  const ins = await p.$$('input');
  await ins[0].fill('QA Tester');
  await p.fill('input[type=email]', 'qa@example.com');
  await p.click('button:has-text("Start studying")');
  await p.waitForTimeout(2500);
}
await p.goto('https://radiopass-anatomy.netlify.app/#/section/upper-limb/custom', { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
console.log(JSON.stringify({
  url: p.url(),
  text: (await p.evaluate(() => document.body.innerText)).slice(0, 400),
  inputCount: await p.evaluate(() => document.querySelectorAll('input').length),
  hasUploadLabel: await p.evaluate(() => !!document.querySelector('.cce-upload')),
}, null, 1));
await b.close();
