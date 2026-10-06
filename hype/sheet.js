// Contact sheet: one frame per beat (at beat + off), into sheet/NN.png
const { chromium } = require('/opt/node22/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.log('pageerror', e.message));
  p.on('console', m => { if (m.type() === 'error') console.log('console', m.text()); });
  await p.goto('http://localhost:8123/film.html');
  const off = parseFloat(process.argv[2] || '0.35'), from = +(process.argv[3] || 0), to = +(process.argv[4] || 57);
  for (let i = from; i <= to; i++) {
    const t = (i + off) * 0.5;
    await p.evaluate((t) => window.seek(t), t);
    await p.locator('#stage').screenshot({ path: `sheet/${String(i).padStart(2, '0')}.png` });
  }
  await b.close();
})();
