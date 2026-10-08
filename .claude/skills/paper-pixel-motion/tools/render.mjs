#!/usr/bin/env node
// Render a paper-pixel-motion HTML film to frames (JPEG q.98 by default, --png for lossless) and (optionally) MP4.
//
//   node render.mjs <film.html> <outDir> [--from 0] [--to N] [--step 1] [--times 0.4,2.1] [--subframes 8] [--query fps=60]
//                   [--mp4 out.mp4] [--audio track.mp3] [--workers 4] [--png]
//
// Speed: frames are split across --workers browser processes (default: CPU cores, max 6). Motion blur is adaptive in
// the engine (still frames cost 2 samples, not N). For web delivery render at the delivery rate (fps=30), not 60.
//
// The HTML must expose `window.film` (from PPM.film) and set `window.ready = true`
// once fonts/images are loaded. Frames are deterministic, so any subset can be rendered.
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
let chromium;
for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright', '@playwright/test']) {
  try { ({ chromium } = require(p)); break; } catch {}
}
if (!chromium) { console.error('playwright not found: npm i -D playwright (browsers not needed if Chromium exists)'); process.exit(1); }

const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const [html, outDir] = args;
if (!html || !outDir) { console.error('usage: render.mjs <film.html> <outDir> [--from] [--to] [--step] [--mp4] [--audio] [--workers] [--png]'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });
const EXT = args.includes('--png') ? 'png' : 'jpg';

const exe = ['/opt/pw-browsers/chromium/chrome-linux/chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files', '--disable-web-security'] });
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
page.on('pageerror', e => console.error('[pageerror]', e.message));
await page.goto('file://' + path.resolve(html) + '?render=1' + (flag('query') ? '&' + flag('query') : ''));
await page.waitForFunction(() => window.ready === true && window.film, null, { timeout: 30000 });
const total = await page.evaluate(() => window.film.frames);
const from = +flag('from', 0), to = Math.min(+flag('to', total - 1), total - 1), step = +flag('step', 1);
const fps = await page.evaluate(() => window.film.fps);
if (flag('subframes')) await page.evaluate((n) => { window.film.subframes = n; }, +flag('subframes'));
const list = flag('times') ? flag('times').split(',').map(t => Math.round(+t * fps)) : null;
console.log(list ? `stills at frames ${list}` : `frames ${from}..${to} step ${step} of ${total} @ ${fps}fps`);
const workers = list ? 1 : Math.max(1, +flag('workers', Math.min(6, (await import('os')).cpus().length)));
if (workers > 1 && !flag('worker')) { // split the range across child processes (each its own browser), then continue to the mux
  await browser.close();
  const { spawn } = await import('child_process'), n = to - from + 1, per = Math.ceil(n / workers), t0 = Date.now();
  const strip = (a) => { const out = []; for (let i = 0; i < a.length; i++) { if (['--from', '--to', '--mp4', '--audio', '--workers'].includes(a[i])) { i++; continue; } out.push(a[i]); } return out; };
  await Promise.all(Array.from({ length: workers }, (_, k) => new Promise((ok, bad) => {
    const a = from + k * per, b = Math.min(to, a + per - 1); if (a > b) return ok();
    const c = spawn(process.execPath, [process.argv[1], ...strip(args), '--from', String(a), '--to', String(b), '--workers', '1', '--worker', String(k)], { stdio: ['ignore', 'ignore', 'inherit'] });
    c.on('exit', (code) => code ? bad(new Error(`worker ${k} exited ${code}`)) : ok());
  })));
  console.log(`rendered ${n} frames with ${workers} workers in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
} else {
  for (const f of list || Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step)) {
    const data = await page.evaluate(([f, ext]) => { window.film.renderFrame(f); return document.querySelector('canvas').toDataURL(ext === 'png' ? 'image/png' : 'image/jpeg', .98); }, [f, EXT]);
    fs.writeFileSync(path.join(outDir, `f${String(f).padStart(5, '0')}.${EXT}`), Buffer.from(data.split(',')[1], 'base64'));
  }
  await browser.close();
}
if (flag('worker')) process.exit(0);

const mp4 = flag('mp4');
if (mp4) {
  const a = ['-y', '-v', 'error', '-framerate', String(fps), '-start_number', String(from), '-i', path.join(outDir, 'f%05d.' + EXT)];
  const audio = flag('audio'); if (audio) a.push('-i', audio, '-shortest');
  a.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', mp4);
  execFileSync('ffmpeg', a, { stdio: 'inherit' });
  console.log('wrote', mp4);
}
