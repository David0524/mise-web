#!/usr/bin/env node
// Render a paper-pixel-motion HTML film to PNG frames and (optionally) MP4.
//
//   node render.mjs <film.html> <outDir> [--from 0] [--to N] [--step 1] [--mp4 out.mp4] [--audio track.mp3] [--scale 1]
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
if (!html || !outDir) { console.error('usage: render.mjs <film.html> <outDir> [--from] [--to] [--step] [--mp4] [--audio]'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

const exe = ['/opt/pw-browsers/chromium/chrome-linux/chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files', '--disable-web-security'] });
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
page.on('pageerror', e => console.error('[pageerror]', e.message));
await page.goto('file://' + path.resolve(html) + '?render=1');
await page.waitForFunction(() => window.ready === true && window.film, null, { timeout: 30000 });
const total = await page.evaluate(() => window.film.frames);
const from = +flag('from', 0), to = Math.min(+flag('to', total - 1), total - 1), step = +flag('step', 1);
const fps = await page.evaluate(() => window.film.fps);
console.log(`frames ${from}..${to} step ${step} of ${total} @ ${fps}fps`);
for (let f = from; f <= to; f += step) {
  const data = await page.evaluate((f) => { window.film.renderFrame(f); return document.querySelector('canvas').toDataURL('image/png'); }, f);
  fs.writeFileSync(path.join(outDir, `f${String(f).padStart(5, '0')}.png`), Buffer.from(data.split(',')[1], 'base64'));
}
await browser.close();

const mp4 = flag('mp4');
if (mp4) {
  const a = ['-y', '-v', 'error', '-framerate', String(fps), '-start_number', String(from), '-i', path.join(outDir, 'f%05d.png')];
  const audio = flag('audio'); if (audio) a.push('-i', audio, '-shortest');
  a.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', mp4);
  execFileSync('ffmpeg', a, { stdio: 'inherit' });
  console.log('wrote', mp4);
}
