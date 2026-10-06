// node render.js k n  → render/seg_k.mp4: worker k of n, a contiguous slice of the
// film's 60 fps frames. Each frame is 4 subframes across a 180° shutter, piped as
// JPEG into ffmpeg, which averages each group of 4 (tmix) and keeps one per frame.
const { chromium } = require('/opt/node22/lib/node_modules/@playwright/mcp/node_modules/playwright');
const { spawn } = require('child_process');
const FPS = 60, SUB = 4, DUR = 54, N = FPS * DUR;
const k = +process.argv[2], n = +process.argv[3];
// optional FROM/TO (frame numbers) re-renders only part of the film
const A0 = +(process.env.FROM || 0), A1 = +(process.env.TO || N);
const f0 = A0 + Math.floor(k * (A1 - A0) / n), f1 = A0 + Math.floor((k + 1) * (A1 - A0) / n);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto('http://localhost:8123/film.html');
  await p.evaluate(() => window.ready);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-c:v', 'mjpeg', '-i', '-',
    '-vf', `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/${FPS}/TB`, '-r', String(FPS),
    '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', '-pix_fmt', 'yuv420p', `render/${process.env.PREFIX || 'seg'}_${k}.mp4`], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    for (let j = 0; j < SUB; j++) {
      const t = Math.min(DUR - 1e-3, Math.max(0, f / FPS + (j - (SUB - 1) / 2) / (FPS * SUB * 2)));
      await p.evaluate((t) => window.seek(t, 40), t);
      const buf = await p.screenshot({ type: 'jpeg', quality: 93 });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    }
    if ((f - f0) % 30 === 0) console.log(`w${k} frame ${f}/${f1} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await b.close();
  console.log(`w${k} done ${((Date.now() - t0) / 1000).toFixed(0)}s`);
})();
