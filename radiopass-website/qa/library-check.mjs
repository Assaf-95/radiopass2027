import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
const errs=[]; p.on('pageerror', e=>errs.push(String(e).slice(0,160)));
await p.goto('https://radiopass.netlify.app/library', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
const idx = await p.evaluate(() => ({
  groups: document.querySelectorAll('.lx-course-group').length,
  cards: document.querySelectorAll('.lx-lib-card').length,
  firstHrefs: [...document.querySelectorAll('.lx-lib-card')].slice(0,4).map(a=>a.getAttribute('href')),
}));
// do the demos themselves actually serve?
const checks = [];
for (const h of idx.firstHrefs) {
  const r = await p.request.get('https://radiopass.netlify.app' + h);
  checks.push({ h, status: r.status() });
}
// spot-check a k-space and an x-ray demo
for (const h of ['/library/codex/how-k-space-is-formed.html','/library/visual-lab/visuals/xray-beam-quality.html','/library/visual-lab/assets/css/style.css']) {
  const r = await p.request.get('https://radiopass.netlify.app' + h);
  checks.push({ h, status: r.status() });
}
// filter works?
await p.fill('.lx-search', 'k-space');
await p.waitForTimeout(500);
const filtered = await p.evaluate(() => document.querySelectorAll('.lx-lib-card').length);
console.log(JSON.stringify({ idx, checks, filteredToKSpace: filtered, errs }, null, 1));
await p.fill('.lx-search','');
await p.waitForTimeout(400);
await p.screenshot({ path: '/tmp/library.png', fullPage: false });
await b.close();
