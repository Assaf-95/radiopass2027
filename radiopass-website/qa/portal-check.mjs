import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
const errs=[]; p.on('pageerror', e=>errs.push(String(e.message).slice(0,140)));

await p.goto('https://radiopass.netlify.app/', { waitUntil:'networkidle' });
await p.waitForTimeout(2500);
const portal = await p.evaluate(() => ({
  h1: document.querySelector('.pt-hero h1')?.textContent?.replace(/\s+/g,' ').trim(),
  doors: [...document.querySelectorAll('.pt-door')].map(d => ({
    tag: d.querySelector('.pt-door-tag')?.textContent,
    href: d.getAttribute('href'),
  })),
  adminLink: document.querySelector('.pt-admin-link')?.getAttribute('href'),
  canvases: document.querySelectorAll('.pt-door-art').length,
  drawn: [...document.querySelectorAll('.pt-door-art')].map(c=>c.width>0),
}));
await p.screenshot({ path:'/tmp/portal.png' });

// physics home still intact at its new address
await p.goto('https://radiopass.netlify.app/physics', { waitUntil:'networkidle' });
await p.waitForTimeout(2500);
const physics = await p.evaluate(() => ({
  hero: document.querySelector('.hm-hero-copy h1')?.textContent?.replace(/\s+/g,' ').trim(),
  nav: document.querySelectorAll('.hm-nav-links a').length,
}));

// key physics routes unaffected
const routes = ['/question-bank','/visual-lab','/fact-bank','/mri-lab/course','/library'];
const checks = [];
for (const r of routes) {
  const res = await p.request.get('https://radiopass.netlify.app'+r);
  checks.push(r+' → '+res.status());
}

// admin gate
await p.goto('https://radiopass.netlify.app/admin', { waitUntil:'networkidle' });
await p.waitForTimeout(1500);
const gate = await p.evaluate(() => ({
  locked: !!document.querySelector('.pt-gate-form'),
  warns: !!document.querySelector('.pt-admin-warning'),
}));
await p.fill('#pt-pass','radiopass-author');
await p.click('.pt-btn-solid');
await p.waitForTimeout(1200);
const unlocked = await p.evaluate(() => ({
  groups: document.querySelectorAll('.pt-admin-group').length,
  tools: document.querySelectorAll('.pt-admin-card').length,
}));

console.log(JSON.stringify({ portal, physics, checks, gate, unlocked, errs }, null, 1));
await b.close();
