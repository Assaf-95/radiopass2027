import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs=[]; p.on('pageerror', e=>errs.push(String(e).slice(0,200)));
await p.goto('https://radiopass.netlify.app/mri-lab/encoding', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
await p.evaluate(() => [...document.querySelectorAll('button,a')].find(b=>/^begin/i.test(b.textContent.trim()))?.click());
await p.waitForTimeout(1200);
const titles = [];
for (let i=0;i<8;i++){
  titles.push(await p.evaluate(()=>document.querySelector('.lx-step h2, h2')?.textContent?.trim().slice(0,60)));
  await p.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/next/i.test(b.textContent))?.click());
  await p.waitForTimeout(600);
}
await p.screenshot({ path: '/tmp/mri-encoding.png' });
console.log(JSON.stringify({ titles, errs }, null, 1));
await b.close();
