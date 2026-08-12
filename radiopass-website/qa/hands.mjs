import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
const errs=[]; p.on('pageerror', e=>errs.push(String(e.message).slice(0,120)));
await p.goto('https://radiopass.netlify.app/ultrasound-lab/contrast?focus=1', { waitUntil: 'networkidle' });
await p.waitForTimeout(2000);
const seen = [];
for (let i=0;i<8;i++){
  const s = await p.evaluate(() => ({
    step: document.querySelector('.us-step-caption strong')?.textContent?.slice(0,34),
    controlsVisible: !!document.querySelector('.us-controls-col') &&
      getComputedStyle(document.querySelector('.us-controls-col')).display !== 'none',
    sliders: [...document.querySelectorAll('.us-controls-col input[type=range]')]
      .filter(el=>el.offsetParent!==null).length,
  }));
  seen.push(s);
  await p.evaluate(()=>[...document.querySelectorAll('.us-transport button')].find(b=>/next step/i.test(b.getAttribute('aria-label')||''))?.click());
  await p.waitForTimeout(700);
}
console.log(JSON.stringify({ seen, errs }, null, 1));
await p.screenshot({ path:'/tmp/hands.png' });
await b.close();
