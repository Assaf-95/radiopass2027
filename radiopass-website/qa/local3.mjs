import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
const logs=[];
p.on('console', m => logs.push(m.type()+': '+m.text().slice(0,900)));
await p.goto('http://localhost:5199/visual-lab', { waitUntil: 'load' });
await p.waitForTimeout(6000);
console.log(logs.filter(l=>/error|warn|component|Effect|destroy/i.test(l)).slice(0,6).join('\n\n---\n\n'));
await b.close();
