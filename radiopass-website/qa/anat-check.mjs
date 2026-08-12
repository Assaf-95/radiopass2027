import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 1500, height: 1000 },
  httpCredentials: { username: 'frcr', password: 'frcr-anatomy-2026' },
});
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0,200)));

// The authoring route is guarded client-side (a deterrent, per the app's own
// comments, not a security boundary). Set the author flag and the local
// account directly so the tool under test can be exercised.
await p.goto('https://radiopass-anatomy.netlify.app/', { waitUntil: 'domcontentloaded' });
await p.evaluate(() => localStorage.setItem('radiopass-admin-v1', 'yes'));

await p.goto('https://radiopass-anatomy.netlify.app/#/section/upper-limb/custom', { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);

// the app's own local sign-in gate (no password, device-local)
if (await p.$('input[type=email]')) {
  const ins = await p.$$('input');
  await ins[0].fill('QA Tester');
  await p.fill('input[type=email]', 'qa@example.com');
  await p.click('button:has-text("Start studying")');
  await p.waitForTimeout(2500);
  await p.goto('https://radiopass-anatomy.netlify.app/#/section/upper-limb/custom', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);
}

// upload a small generated PNG so the canvas appears
const png = Buffer.from(
 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAP0lEQVR4nO3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHgNIQAAAdbHUxIAAAAASUVORK5CYII=','base64');
await p.setInputFiles('input[type=file]', { name: 't.png', mimeType: 'image/png', buffer: png });
await p.waitForTimeout(1200);

const wrap = await p.$('.cce-image-wrap');
const box = await wrap.boundingBox();
// place two arrows
await p.mouse.click(box.x + box.width*0.35, box.y + box.height*0.4);
await p.waitForTimeout(400);
await p.mouse.click(box.x + box.width*0.65, box.y + box.height*0.6);
await p.waitForTimeout(500);

const afterPlace = await p.evaluate(() => ({
  arrows: document.querySelectorAll('.cce-marker').length,
  tips: document.querySelectorAll('.cce-tip').length,
  controlsVisible: !!document.querySelector('.cce-arrow-controls'),
  sliders: document.querySelectorAll('.cce-arrow-controls input[type=range]').length,
}));

// read geometry, then drag the badge to rotate/lengthen
const before = await p.evaluate(() => {
  const m = document.querySelectorAll('.cce-marker');
  const last = m[m.length-1];
  return { left: last.style.left, top: last.style.top };
});
const badge = (await p.$$('.cce-marker')).slice(-1)[0];
const bb = await badge.boundingBox();
await p.mouse.move(bb.x + bb.width/2, bb.y + bb.height/2);
await p.mouse.down();
await p.mouse.move(bb.x + 90, bb.y - 60, { steps: 12 });
await p.mouse.up();
await p.waitForTimeout(400);
const after = await p.evaluate(() => {
  const m = document.querySelectorAll('.cce-marker');
  const last = m[m.length-1];
  const line = [...document.querySelectorAll('.cce-arrow-layer line')].slice(-1)[0];
  return { left: last.style.left, top: last.style.top, strokeWidth: line?.getAttribute('stroke-width'), markerEnd: line?.getAttribute('marker-end') };
});

// change thickness via slider
await p.evaluate(() => {
  const r = document.querySelectorAll('.cce-arrow-controls input[type=range]')[2];
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  setter.call(r, '1.8');
  r.dispatchEvent(new Event('input', { bubbles: true }));
});
await p.waitForTimeout(400);
const thick = await p.evaluate(() => {
  const line = [...document.querySelectorAll('.cce-arrow-layer line')].slice(-1)[0];
  return line?.getAttribute('stroke-width');
});

console.log(JSON.stringify({ afterPlace, badgeMoved: before.left !== after.left || before.top !== after.top, after, thicknessAfterSlider: thick, pageErrors: errs }, null, 1));
await p.screenshot({ path: '/tmp/anat-editor.png' });
await b.close();
