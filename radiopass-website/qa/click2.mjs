import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 950 } });
await p.goto('https://radiopass.netlify.app/visual-lab', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
const cards = await p.evaluate(() => [...document.querySelectorAll('.labs-grid article')].map((a,i)=>({
  i, title: a.querySelector('h3')?.textContent, href: a.querySelector('a')?.getAttribute('href') })));
await p.getByRole('link', { name: /Open the laboratory/i }).nth(2).click();
await p.waitForTimeout(1800);
const afterCard = p.url().replace('https://radiopass.netlify.app','');
const linksOnPage = await p.evaluate(() => [...document.querySelectorAll('a')].slice(0,14).map(a=>a.textContent.trim().slice(0,40)));
console.log(JSON.stringify({ cards, afterCard, linksOnPage }, null, 1));
await b.close();
