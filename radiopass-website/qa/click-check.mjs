import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 950 } });
const errs=[]; p.on('pageerror', e=>errs.push(String(e.message||e).slice(0,140)));
const hops = [];

await p.goto('https://radiopass.netlify.app/visual-lab', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);

// real click on the MRI card's main link
await p.getByRole('link', { name: /Open the laboratory/i }).nth(2).click();
await p.waitForTimeout(1600);
hops.push({ step: 'visual-lab -> MRI card', url: p.url().replace('https://radiopass.netlify.app','') });

// real click on Begin the module
await p.getByRole('link', { name: /Begin the module/i }).click();
await p.waitForTimeout(1800);
hops.push({ step: 'course -> begin', url: p.url().replace('https://radiopass.netlify.app',''),
            title: await p.evaluate(()=>document.querySelector('.lx-bar-title')?.textContent) });

// back to course, then into spatial encoding
await p.goto('https://radiopass.netlify.app/mri-lab/course', { waitUntil: 'networkidle' });
await p.waitForTimeout(1000);
await p.getByRole('link', { name: /Spatial Encoding/i }).click();
await p.waitForTimeout(1600);
hops.push({ step: 'course -> encoding', url: p.url().replace('https://radiopass.netlify.app',''),
            title: await p.evaluate(()=>document.querySelector('.lx-bar-title')?.textContent) });

// from the old lab, click the Course chip
await p.goto('https://radiopass.netlify.app/mri-lab', { waitUntil: 'networkidle' });
await p.waitForTimeout(1400);
await p.click('.mri-stage-course');
await p.waitForTimeout(1600);
hops.push({ step: 'mri-lab -> Course chip', url: p.url().replace('https://radiopass.netlify.app','') });

// visual lab -> archive
await p.goto('https://radiopass.netlify.app/visual-lab', { waitUntil: 'networkidle' });
await p.waitForTimeout(1000);
await p.click('.lab-archive-note a');
await p.waitForTimeout(1600);
hops.push({ step: 'visual-lab -> archive', url: p.url().replace('https://radiopass.netlify.app',''),
            cards: await p.evaluate(()=>document.querySelectorAll('.lx-lib-card').length) });

console.log(JSON.stringify({ hops, errs }, null, 1));
await b.close();
