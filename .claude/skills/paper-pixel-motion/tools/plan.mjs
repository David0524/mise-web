#!/usr/bin/env node
// Plan and lint a film spec without rendering: prints the timed beat sheet, warnings and errors.
//
//   node plan.mjs <spec.film.js|spec.json> [words.json] [--mode cut|flow] [--md out.md] [--json out.json]
//
// Exit code 1 if the spec has errors. Use this after every script/spec edit, before any render.
import fs from 'fs';
import vm from 'vm';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const P = require('../engine/plan.js');

const args = process.argv.slice(2), flag = (k) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
const [specPath, wordsPath] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!specPath) { console.error('usage: plan.mjs <spec.film.js|spec.json> [words.json] [--mode] [--md out.md] [--json out.json]'); process.exit(2); }
let spec;
if (specPath.endsWith('.json')) spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
else { const sb = { window: {} }; vm.runInNewContext(fs.readFileSync(specPath, 'utf8'), sb); spec = sb.window.SPEC; }
if (flag('mode')) spec.mode = flag('mode');
const words = wordsPath ? JSON.parse(fs.readFileSync(wordsPath, 'utf8')) : null;
const plan = P.plan(spec, words), md = P.table(plan);
console.log(`# ${spec.title || specPath}\n\n${md}`);
if (flag('md')) fs.writeFileSync(flag('md'), `# ${spec.title || specPath}\n\n${md}\n`);
if (flag('json')) fs.writeFileSync(flag('json'), JSON.stringify(plan, null, 1));
process.exit(plan.errors.length ? 1 : 0);
