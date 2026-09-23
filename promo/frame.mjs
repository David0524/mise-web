import { chromium } from 'playwright';
import fs from 'fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true });
await p.goto('file://' + process.cwd() + '/render.html'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
const ts = process.argv.slice(2).map(Number);
const FPS = 30; const all = process.env.ALL === '1';
const list = all ? Array.from({ length: 48 * FPS }, (_, i) => i / FPS) : ts;
fs.mkdirSync(all ? 'out' : 'prev', { recursive: true });
let i = 0; const T = Date.now();
for (const t of list) { await p.evaluate((t) => window.render(t), t);
  await p.screenshot({ path: all ? `out/${String(i).padStart(5, '0')}.jpg` : `prev/${t.toFixed(2)}.jpg`, type: 'jpeg', quality: 94 }); i++;
  if (all && i % 150 === 0) console.log(i, ((Date.now() - T) / i).toFixed(0) + 'ms/f'); }
await b.close();
