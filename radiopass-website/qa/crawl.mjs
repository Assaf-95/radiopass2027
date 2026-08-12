// QA crawler for the physics site. Loads every route from routes-physics.json
// at each of several viewports, checks console errors, horizontal overflow,
// and DOM-level text/interactive-element collisions (verified against
// elementFromPoint to rule out elements merely clipped by an ancestor's
// overflow, which getBoundingClientRect alone can't tell apart from a real
// paint-level overlap), and saves a full-page screenshot per route+viewport.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.QA_BASE_URL || 'https://radiopass.netlify.app';
const routesPath = process.argv[2] || 'qa/routes-physics.json';
const outDir = process.argv[3] || 'qa/screenshots/physics';
const siteLabel = process.argv[4] || 'physics';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 834, height: 1194 },
  { name: 'mobile', width: 390, height: 844 },
];

const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));

const COLLISION_SCRIPT = `(() => {
  const results = { horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, overlaps: [] };
  const candidates = [...document.querySelectorAll('h1,h2,h3,h4,p,a,button,label')].filter(el => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && el.textContent.trim().length > 1 && cs.visibility !== 'hidden' && cs.opacity !== '0';
  });
  const sample = candidates.slice(0, 300);
  for (let i = 0; i < sample.length; i++) {
    for (let j = i + 1; j < sample.length; j++) {
      const A = sample[i], B = sample[j];
      if (A.contains(B) || B.contains(A)) continue;
      const a = A.getBoundingClientRect(), b = B.getBoundingClientRect();
      const ox = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const oy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const overlapArea = ox * oy;
      const minArea = Math.min(a.width * a.height, b.width * b.height);
      if (minArea > 0 && overlapArea / minArea > 0.4) {
        // Verify with elementFromPoint at the overlap centroid so a merely
        // scrolled-out-of-view element (real rect, but clipped by an
        // ancestor's overflow:hidden/auto) doesn't register as a false hit.
        const cx = Math.max(a.left, b.left) + ox / 2;
        const cy = Math.max(a.top, b.top) + oy / 2;
        const painted = document.elementFromPoint(cx, cy);
        const paintedIsEitherOrDescendant = painted && (painted === A || painted === B || A.contains(painted) || B.contains(painted));
        if (paintedIsEitherOrDescendant) {
          // still ambiguous which one is actually on top / whether both are legible — flag for visual review
          results.overlaps.push({
            a: A.tagName + ':' + A.textContent.trim().slice(0, 40),
            b: B.tagName + ':' + B.textContent.trim().slice(0, 40),
            overlapRatio: +(overlapArea / minArea).toFixed(2),
            paintedText: painted ? painted.textContent.trim().slice(0, 40) : null,
          });
        }
      }
    }
  }
  return results;
})()`;

async function run() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const report = [];

  for (const route of routes) {
    const routeReport = { url: route.url, name: route.name, viewports: {} };
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300)); });
      page.on('pageerror', (err) => { pageErrors.push(String(err).slice(0, 300)); });

      let loadError = null;
      try {
        await page.goto(BASE + route.url, { waitUntil: 'networkidle', timeout: 20000 });
        await page.waitForTimeout(500);
      } catch (e) {
        loadError = String(e).slice(0, 300);
      }

      let collision = null;
      try {
        collision = await page.evaluate(COLLISION_SCRIPT);
      } catch (e) {
        collision = { error: String(e).slice(0, 200) };
      }

      const shotName = `${route.url.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'}__${vp.name}.png`;
      const shotPath = path.join(outDir, shotName);
      try {
        await page.screenshot({ path: shotPath, fullPage: true, timeout: 15000 });
      } catch (e) {
        // full-page screenshot can fail on infinite-scroll/canvas-heavy pages; fall back to viewport shot
        try { await page.screenshot({ path: shotPath, timeout: 15000 }); } catch {}
      }

      routeReport.viewports[vp.name] = {
        loadError,
        consoleErrors,
        pageErrors,
        horizontalOverflow: collision?.horizontalOverflow ?? null,
        scrollWidth: collision?.scrollWidth,
        clientWidth: collision?.clientWidth,
        overlaps: collision?.overlaps ?? [],
        screenshot: shotName,
      };

      await context.close();
    }
    report.push(routeReport);
    console.log(`done: ${route.url}`);
  }

  await browser.close();
  fs.writeFileSync(path.join(outDir, '..', `${siteLabel}-crawl-report.json`), JSON.stringify(report, null, 2));
  console.log('WROTE REPORT');
}

run().catch((e) => { console.error(e); process.exit(1); });
