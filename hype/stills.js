const { chromium } = require('/opt/node22/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.log('pageerror', e.message));
  await p.goto('http://localhost:8123/film.html');
  const shots = (process.argv[2] || '0:00-first,6.3:01-open,11.4:02-glass,16.8:03-stage,21.9:04-kitchen').split(',');
  for (const s of shots) { const [t, name] = s.split(':'); await p.evaluate((t) => window.seek(t), parseFloat(t)); await p.locator('#stage').screenshot({ path: `stills/${name}.png` }); console.log('ok', t, name); }
  await b.close();
})();
