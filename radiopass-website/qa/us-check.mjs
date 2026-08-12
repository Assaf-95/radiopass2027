import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.goto('https://radiopass.netlify.app/ultrasound-lab?focus=1', { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
const m = await p.evaluate(() => {
  const btn = document.querySelector('.us-transport .us-btn');
  const next = document.querySelector('.us-zen-chain-next');
  const cap = document.querySelector('.us-step-caption');
  const capP = cap && cap.querySelector('p');
  const cs = (el) => el ? getComputedStyle(el) : null;
  const tb = cs(btn), nx = cs(next);
  return {
    transportBtn: tb && { fontSize: tb.fontSize, padding: tb.padding },
    nextConcept: nx && { fontSize: nx.fontSize, padding: nx.padding },
    factBody: capP && getComputedStyle(capP).fontSize,
    captionAboveTransport: (cap && document.querySelector('.us-transport'))
      ? cap.getBoundingClientRect().top < document.querySelector('.us-transport').getBoundingClientRect().top : null,
  };
});
console.log(JSON.stringify(m, null, 1));
await p.screenshot({ path: '/tmp/us-check.png' });
await b.close();
