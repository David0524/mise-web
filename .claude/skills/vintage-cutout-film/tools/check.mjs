#!/usr/bin/env node
// Lint a film spec before rendering: timeline, captions, plates against VO lines, assets.
//   node check.mjs <name>.film.js [--fix-captions]     (run from the folder the spec's paths are relative to)
// Exit code 1 if there are errors. --fix-captions rewrites nothing; it prints captions with short gaps closed,
// ready to paste (or use the CF-style `holdCaptions` helper in your spec).
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const file = process.argv[2];
if (!file) { console.error('usage: check.mjs <name>.film.js'); process.exit(2); }
const dir = path.dirname(path.resolve(file));
const sandbox = { window: {}, console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
// a spec may load its captions from a lines.js written next to it
for (const extra of ['lines.js']) { const p = path.join(dir, extra); if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox); }
vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
const S = sandbox.window.SPEC;
const errors = [], warns = [];
const E = (m) => errors.push(m), Wn = (m) => warns.push(m);

// segments contiguous
const segs = [...S.segments].sort((a, b) => a.at - b.at);
let end = 0;
for (const s of segs) {
  if (Math.abs(s.at - end) > 0.021) (s.at > end ? E : Wn)(`segment at ${s.at}: ${s.at > end ? 'gap' : 'overlap'} of ${(s.at - end).toFixed(2)} s after the previous one`);
  end = s.at + s.dur;
  if (!s.kind && !s.scene) E(`segment at ${s.at} has neither kind nor scene`);
}
const duration = S.duration || end;
if (Math.abs(end - duration) > 0.05) Wn(`segments end at ${end.toFixed(2)} s but duration is ${duration}`);
const fps = S.fps || 25;
for (const s of segs) if (Math.abs(s.at * fps - Math.round(s.at * fps)) > 0.01) Wn(`segment at ${s.at} is not on a frame boundary (1/${fps} s)`);

// captions
const caps = S.captions || [];
caps.forEach(([a, b, txt], i) => {
  const lines = String(txt).split('\n');
  if (lines.length > 2) E(`caption ${i} "${txt}" has ${lines.length} lines (max 2)`);
  lines.forEach((l) => { if (l.length > 28) E(`caption ${i} line "${l}" is ${l.length} chars (max ~26): break it with \\n`); });
  if (b <= a) E(`caption ${i} ends before it starts`);
  if (i && a < caps[i - 1][1] - 0.01) E(`caption ${i} overlaps the previous one`);
  if (i && a - caps[i - 1][1] > 0.02 && a - caps[i - 1][1] < 0.6) Wn(`caption ${i - 1} -> ${i}: ${(a - caps[i - 1][1]).toFixed(2)} s blank gap (under 0.6 s, hold the previous caption: --fix-captions)`);
  if (!/[.?!…]$/.test(String(txt).trim())) Wn(`caption ${i} "${txt}" has no end punctuation`);
});

// litany: one plate per line
for (const s of segs.filter((s) => s.kind === 'stack')) {
  const P = s.plates, inside = caps.filter(([a]) => a >= s.at - 0.05 && a < s.at + s.dur);
  if (P.length < inside.length) E(`stack at ${s.at}: ${inside.length} VO lines but only ${P.length} plates (one plate per line)`);
  inside.forEach(([a, , txt]) => {
    const p = P.reduce((best, q) => (Math.abs(q.at - a) < Math.abs(best.at - a) ? q : best), P[0]);
    if (Math.abs(p.at - a) > 0.35) Wn(`line at ${a.toFixed(2)} "${String(txt).replace('\n', ' ')}": nearest plate starts at ${p.at.toFixed(2)} (put it on the line, within ±0.2 s)`);
  });
  P.forEach((p, j) => {
    if (j && p.at <= P[j - 1].at) E(`plate ${j} starts before plate ${j - 1}`);
    const next = P[j + 1]; const enter = p.enter ?? 0.5;
    if (next && next.at < p.at + enter) E(`plate ${j} enters for ${enter}s but plate ${j + 1} starts ${(next.at - p.at).toFixed(2)} s later`);
    if (next && next.at - p.at < 0.55) Wn(`plate ${j} holds only ${(next.at - p.at).toFixed(2)} s`);
    if (p.at < s.at - 0.001 || p.at >= s.at + s.dur) E(`plate ${j} at ${p.at} is outside its stack segment`);
    if (p.hole) {
      const k = p.k ?? 1.9; const cover = Math.max(p.hole[2], p.hole[3]) * k * (p.fromScale ?? 1);
      if (Math.min(p.hole[2], p.hole[3]) * k * (p.fromScale ?? 1) < 0.85) Wn(`portal plate ${j}: the hole only spans ${cover.toFixed(2)} H at entry; raise k or fromScale so it starts beyond the frame (>= 0.85)`);
      if (p.bg && (Math.abs(p.bg[0] - (p.pos?.[0] ?? 0) - p.hole[0]) > 0.02 || Math.abs(p.bg[1] - (p.pos?.[1] ?? 0.04) - p.hole[1]) > 0.02)) Wn(`portal plate ${j}: bg should be pos + hole centre so the old scene sits in the hole`);
    }
    (p.pieces || []).forEach((pc) => { if (!S.assets?.[pc.img]) E(`plate ${j}: unknown image "${pc.img}"`); });
  });
}
// assets exist
for (const [k, v] of Object.entries(S.assets || {})) { const p = path.join(dir, S.base || '', typeof v === 'string' ? v : v.src); if (!fs.existsSync(p)) E(`asset ${k}: ${p} not found`); }
if (S.audio && !fs.existsSync(path.join(dir, S.audio))) Wn(`audio ${S.audio} not found (render without --audio, or make it first)`);

console.log(`${S.title || file}: ${duration.toFixed(2)} s, ${segs.length} segments, ${caps.length} captions, ${segs.filter((s) => s.kind === 'stack').reduce((n, s) => n + s.plates.length, 0)} plates`);
warns.forEach((w) => console.log('  warn  ' + w));
errors.forEach((e) => console.log('  ERROR ' + e));
if (process.argv.includes('--fix-captions')) {
  const fixed = caps.map(([a, b, t], i) => { const nx = caps[i + 1]; return [a, nx && nx[0] - b < 0.6 ? nx[0] : b, t]; });
  console.log(JSON.stringify(fixed));
}
if (!errors.length) console.log('  ok');
process.exit(errors.length ? 1 : 0);
