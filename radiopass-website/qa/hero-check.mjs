import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('https://radiopass.netlify.app/', { waitUntil: 'networkidle' });
await p.waitForTimeout(4000);
// sample the canvas: is anything actually drawn?
const stats = await p.evaluate(() => {
  const c = document.querySelector('.hm-proton-host canvas');
  if (!c) return { canvas: false };
  const g = c.getContext('webgl2') || c.getContext('webgl');
  const px = new Uint8Array(4 * 200 * 200);
  g.readPixels(c.width/2 - 100, c.height/2 - 100, 200, 200, g.RGBA, g.UNSIGNED_BYTE, px);
  let lit = 0, max = 0;
  for (let i = 0; i < px.length; i += 4) {
    const v = px[i] + px[i+1] + px[i+2];
    if (v > 24) lit++;
    if (v > max) max = v;
  }
  return { canvas: true, litPixels: lit, maxBrightness: max, sampled: 200*200 };
});
console.log(JSON.stringify(stats));
await p.screenshot({ path: '/tmp/hero-check.png' });
await b.close();
