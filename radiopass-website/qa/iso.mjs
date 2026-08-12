import { chromium } from 'playwright';
const b = await chromium.launch();
async function hop(from, linkName, nth=0) {
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs=[]; p.on('pageerror', e=>errs.push(String(e.message).slice(0,60)));
  await p.goto('https://radiopass.netlify.app'+from, { waitUntil:'networkidle' });
  await p.waitForTimeout(1200);
  try { await p.getByRole('link', { name: linkName }).nth(nth).click(); } catch(e) { await p.close(); return {from, linkName, click:'FAILED'}; }
  await p.waitForTimeout(2500);
  const r = await p.evaluate(()=>({ url: location.pathname, rootKids: document.getElementById('root')?.children.length, txt: document.body.innerText.slice(0,40) }));
  await p.close();
  return { from, to: r.url, rootKids: r.rootKids, blank: r.rootKids===0, errs };
}
const out = [];
out.push(await hop('/visual-lab', /Open the laboratory/i, 3));   // ultrasound focused course (pre-existing lx-root)
out.push(await hop('/visual-lab', /Open the laboratory/i, 1));   // ct-lab (pre-existing lx-root)
out.push(await hop('/visual-lab', /Open the laboratory/i, 2));   // MRI course (new)
out.push(await hop('/visual-lab', /the archive/i, 0));           // library (new)
out.push(await hop('/', /Question Bank/i, 0));                   // control: non-lx page
console.log(JSON.stringify(out, null, 1));
await b.close();
