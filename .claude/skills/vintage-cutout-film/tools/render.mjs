#!/usr/bin/env node
// Render a vintage-cutout-film page to JPEG frames and (optionally) an MP4 with audio.
//
//   node render.mjs <film.html> <outDir> [--from 0] [--to N] [--times 1.2,8.4] [--grid 24] [--workers 4]
//                   [--mp4 out.mp4] [--audio mix.wav] [--web] [--query k=v&k2=v2]
//
// --times writes stills (t in seconds) and stops. --grid N writes <outDir>/grid.jpg, N evenly spaced frames
// labelled with their time, and stops. Otherwise every frame from..to is written as f00000.jpg and, with
// --mp4, packed at the film's fps (x264 crf 17, yuv420p, +faststart) with --audio muxed in as AAC. Grain makes
// that master large (~2 MB/s); --web also writes <name>-web.mp4 at 1080 px wide, lightly denoised, crf 27 (~0.1 MB/s).
//
// The page must set window.film (from CF.film) and window.ready = true once fonts and images are loaded.
// Page errors are printed and fail the render. Chromium: CHROME env, else Playwright's bundled browser.
import { createRequire } from 'module';
import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
let chromium;
for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright', 'playwright-core']) { try { ({ chromium } = require(p)); break; } catch {} }
if (!chromium) { console.error('playwright not found: npm i -D playwright-core (uses an existing Chromium)'); process.exit(1); }

const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const [html, outDir] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!html || !outDir) { console.error('usage: render.mjs <film.html> <outDir> [--from] [--to] [--times] [--grid] [--mp4] [--audio] [--workers]'); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });

const exe = process.env.CHROME || ['/opt/pw-browsers/chromium/chrome-linux/chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
async function open() {
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--allow-file-access-from-files', '--disable-web-security'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.resolve(html) + '?render=1' + (flag('query') ? '&' + flag('query') : ''));
  try { await page.waitForFunction(() => window.ready === true || window.failed, null, { timeout: 60000 }); }
  catch { errors.push('timed out waiting for window.ready'); }
  const failed = await page.evaluate(() => window.failed || null).catch(() => null);
  if (failed) errors.push(failed);
  if (errors.length) { await browser.close(); console.error('page errors:\n  ' + [...new Set(errors)].join('\n  ')); process.exit(1); }
  return { browser, page, errors };
}
const shot = (page, f) => page.evaluate((f) => { window.film.renderFrame(f); return document.querySelector('canvas').toDataURL('image/jpeg', 0.95); }, f);
const save = (file, data) => fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));

const { browser, page, errors } = await open();
const { frames, fps } = await page.evaluate(() => ({ frames: window.film.frames, fps: window.film.fps }));

if (flag('times') || flag('grid')) {
  if (flag('grid')) {
    const n = +flag('grid');
    const data = await page.evaluate(async (n) => {
      const cv = document.querySelector('canvas'), cols = 6, cw = 320, ch = Math.round(cw * cv.height / cv.width), rows = Math.ceil(n / cols);
      const s = document.createElement('canvas'); s.width = cols * cw; s.height = rows * (ch + 18); const g = s.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, s.width, s.height); g.font = '13px monospace'; g.fillStyle = '#ddd';
      for (let k = 0; k < n; k++) { const f = Math.round(k * (window.film.frames - 1) / Math.max(1, n - 1)); window.film.renderFrame(f); const x = (k % cols) * cw, y = Math.floor(k / cols) * (ch + 18); g.drawImage(cv, x, y, cw, ch); g.fillText((f / window.film.fps).toFixed(2) + 's', x + 4, y + ch + 13); }
      return s.toDataURL('image/jpeg', 0.9);
    }, n);
    save(path.join(outDir, 'grid.jpg'), data); console.log('grid:', path.join(outDir, 'grid.jpg'));
  }
  if (flag('times')) for (const t of flag('times').split(',').map(Number)) { const f = Math.min(frames - 1, Math.round(t * fps)); save(path.join(outDir, `t${t.toFixed(2)}.jpg`), await shot(page, f)); }
  await browser.close();
  if (errors.length) { console.error('page errors:\n  ' + errors.join('\n  ')); process.exit(1); }
  process.exit(0);
}

const from = +flag('from', 0), to = Math.min(+flag('to', frames - 1), frames - 1);
const workers = flag('worker') ? 1 : Math.max(1, Math.min(+flag('workers', os.cpus().length), to - from + 1));
const t0 = Date.now();
if (workers > 1) {
  await browser.close();
  const per = Math.ceil((to - from + 1) / workers);
  const keep = []; for (let i = 0; i < args.length; i++) { if (['--from', '--to', '--mp4', '--audio', '--workers'].includes(args[i])) { i++; continue; } keep.push(args[i]); }
  await Promise.all(Array.from({ length: workers }, (_, k) => new Promise((ok, bad) => {
    const a = from + k * per, b = Math.min(to, a + per - 1); if (a > b) return ok();
    const c = spawn(process.execPath, [process.argv[1], ...keep, '--from', String(a), '--to', String(b), '--worker', String(k)], { stdio: ['ignore', 'ignore', 'inherit'] });
    c.on('exit', (code) => (code ? bad(new Error(`worker ${k} failed`)) : ok()));
  })));
} else {
  for (let f = from; f <= to; f++) save(path.join(outDir, `f${String(f).padStart(5, '0')}.jpg`), await shot(page, f));
  await browser.close();
  if (errors.length) { console.error('page errors:\n  ' + [...new Set(errors)].join('\n  ')); process.exit(1); }
}
if (flag('worker')) process.exit(0);
console.log(`rendered frames ${from}..${to} of ${frames} @ ${fps} fps in ${((Date.now() - t0) / 1000).toFixed(0)} s`);

const mp4 = flag('mp4');
if (mp4) {
  const a = ['-y', '-v', 'error', '-framerate', String(fps), '-start_number', String(from), '-i', path.join(outDir, 'f%05d.jpg')];
  if (flag('audio')) a.push('-i', flag('audio'), '-af', 'apad', '-c:a', 'aac', '-b:a', '192k', '-shortest'); // audio padded, so the picture sets the length
  a.push('-frames:v', String(to - from + 1), '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4);
  execFileSync('ffmpeg', a, { stdio: 'inherit' });
  console.log('wrote', mp4);
  if (args.includes('--web')) {
    const web = mp4.replace(/\.mp4$/, '') + '-web.mp4';
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', mp4, '-vf', 'scale=1080:-2,hqdn3d=1.5:1.5:3:3', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '160k', web], { stdio: 'inherit' });
    console.log('wrote', web);
  }
}
