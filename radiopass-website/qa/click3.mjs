import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 950 } });
const errs=[], cons=[];
p.on('pageerror', e => errs.push({ m: String(e.message||e).slice(0,200), s: String(e.stack||'').split('\n').slice(0,5).join(' | ').slice(0,400) }));
p.on('console', m => { if (m.type()==='error') cons.push(m.text().slice(0,200)); });
const failed=[];
p.on('requestfailed', r => failed.push(r.url().slice(-70)));
p.on('response', r => { if (r.status()>=400) failed.push(r.status()+' '+r.url().slice(-70)); });

await p.goto('https://radiopass.netlify.app/visual-lab', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
await p.getByRole('link', { name: /Open the laboratory/i }).nth(2).click();
await p.waitForTimeout(3000);
const state = await p.evaluate(() => ({
  url: location.pathname,
  rootChildren: document.getElementById('root')?.children.length,
  bodyText: document.body.innerText.slice(0,200),
  mainClass: document.querySelector('main')?.className,
}));
console.log(JSON.stringify({ state, errs, cons, failed }, null, 1));
await b.close();
