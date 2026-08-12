import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
const errs=[]; p.on('pageerror', e=>errs.push(String(e.message).slice(0,140)));
await p.goto('https://radiopass.netlify.app/ultrasound-lab/transducer?focus=1', { waitUntil:'networkidle' });
await p.waitForTimeout(2000);

// does the fixed chrome still sit on the canvas?
const overlap = await p.evaluate(() => {
  const stage = document.querySelector('.us-stage');
  const all = document.querySelector('.us-zen-top a');
  const exit = document.querySelector('.us-zen-exit');
  const r = (e) => e ? e.getBoundingClientRect() : null;
  const s = r(stage), a = r(all), x = r(exit);
  const hits = (p1,p2) => p1&&p2 ? !(p1.right<p2.left||p1.left>p2.right||p1.bottom<p2.top||p1.top>p2.bottom) : null;
  return { stageTop: s && Math.round(s.top), allBottom: a && Math.round(a.bottom),
           exitBottom: x && Math.round(x.bottom), allOverStage: hits(a,s), exitOverStage: hits(x,s) };
});

// sound toggle present + default on?
const sound = await p.evaluate(() => {
  const b = [...document.querySelectorAll('.us-transport button')].find(x=>/mute|unmute/i.test(x.getAttribute('aria-label')||''));
  return { present: !!b, label: b?.getAttribute('aria-label'), pressed: b?.getAttribute('aria-pressed'),
           pref: localStorage.getItem('radiopass.sound.v1') };
});

// step to the array steps and confirm the clock restarts (motion from t=0)
for (let i=0;i<7;i++){ await p.evaluate(()=>[...document.querySelectorAll('.us-transport button')].find(b=>/next step/i.test(b.getAttribute('aria-label')||''))?.click()); await p.waitForTimeout(450); }
const step = await p.evaluate(()=>document.querySelector('.us-step-caption strong')?.textContent);
await p.screenshot({ path:'/tmp/transducer.png' });
console.log(JSON.stringify({ overlap, sound, step, errs }, null, 1));
await b.close();
