/* paper-pixel-motion · planner (pure JS, runs in node and the browser)
 *
 * Turns a film spec (see references/spec.md) into a timed, validated plan:
 *   - matches each beat's text to word timings (faster-whisper JSON) or estimates timing from word count
 *   - assigns worlds by the pacing rules when a beat doesn't set one
 *   - applies section-end acceleration and per-type duration limits
 *   - chooses transitions (cut mode: hard cut / flash; flow mode: continuous handoff)
 *   - lints the result (errors block rendering, warnings are advice)
 *
 *   const plan = PPMPlan.plan(spec, words?)   →  { beats:[{...beat, start, dur, world, reveal:[{word,t}], transition}], duration, errors, warnings }
 *   PPMPlan.table(plan)                       →  markdown beat sheet
 */
(function (root) {
  'use strict';

  // Per-type timing rules (seconds). base + perWord·n, clamped to [min, max].
  const TYPES = {
    hero:       { base: .35, perWord: .2,  min: .15, max: .7,  world: ['yellow', 'red'], words: [1, 1],   text: true },
    sentence:   { base: .6,  perWord: .26, min: 1.2, max: 3.2, world: ['paper'],          words: [3, 12],  text: true },
    flare:      { base: .8,  perWord: .12, min: 1.2, max: 2.2, world: ['paper'],          words: [0, 12],  text: 'optional' },
    silhouette: { base: .9,  perWord: .3,  min: 1.6, max: 3.0, world: ['void'],           words: [1, 7],   text: true, needs: 'shape' },
    ring:       { base: 1.6, perWord: 0,   min: 1.4, max: 2.4, world: ['paper'],          words: [0, 0],   text: false },
    card:       { base: .55, perWord: .25, min: .7,  max: 1.1, world: ['void'],           words: [1, 2],   text: true, needs: 'object' },
    conveyor:   { base: .4,  perWord: 0,   min: .3,  max: .6,  world: ['paper'],          words: [0, 0],   text: false },
    scatter:    { base: 1.6, perWord: 0,   min: 1.2, max: 2.2, world: ['paper'],          words: [0, 0],   text: false },
    spell:      { base: .25, perWord: 0,   min: .2,  max: .35, world: ['paper', 'void', 'red', 'void'], words: [1, 1], text: true, perLetter: true },
    resolve:    { base: 2.4, perWord: .2,  min: 2.0, max: 3.4, world: ['paper'],          words: [1, 2],   text: true },
    flash:      { base: .12, perWord: 0,   min: .08, max: .16, world: ['yellow', 'red'],  words: [0, 1],   text: 'optional' },
  };
  const WPS_LIMIT = 4.2;
  const FLOW_CARD_MIN = .95;     // flow cards type, hold the word >= HOLD, then flood out
  const FLASH_MAX = 4 / 24;      // flashes never exceed 4 frames, even when voice-timed
  const HOLD = .35;              // seconds a beat's last word stays on screen after it is spoken          // readable kinetic-type speed (words per second on screen)
  const SECTION_ACCEL = [1, .8, .6, .45]; // multiplier on the last beats of a section (last beat first)

  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9']/g, '');
  const tokens = (s) => String(s || '').split(/\s+/).filter(Boolean);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function estimate(beat, mode) {
    const T = TYPES[beat.type], n = tokens(beat.text).length;
    if (mode === 'flow' && beat.type === 'card') return clamp(T.base + T.perWord * n, FLOW_CARD_MIN, Math.max(T.max, FLOW_CARD_MIN)); // flow: typing (~.22s) + hold + flood-out
    if (T.perLetter) return T.base * Math.max(1, norm(beat.text).length);
    return clamp(T.base + T.perWord * n, T.min, T.max);
  }

  /** Assign word timings to beats in order. Returns per-beat {start, end, reveal[]} or null if no words. */
  function align(beats, words) {
    if (!words || !words.length) return null;
    let wi = 0; const out = [];
    for (const b of beats) {
      const toks = tokens(b.text).map(norm).filter(Boolean);
      if (!toks.length || !TYPES[b.type].text) { out.push(null); continue; }
      const reveal = [];
      for (const tk of toks) {
        let k = wi; while (k < words.length && norm(words[k].word) !== tk && k < wi + 4) k++; // tolerate small ASR drift
        if (k < words.length && norm(words[k].word) === tk) { reveal.push({ word: tk, t: words[k].start, end: words[k].end }); wi = k + 1; }
        else reveal.push({ word: tk, t: null });
      }
      // fill unmatched words by interpolation
      for (let i = 0; i < reveal.length; i++) if (reveal[i].t == null) {
        const prev = reveal.slice(0, i).reverse().find(r => r.t != null), next = reveal.slice(i + 1).find(r => r.t != null);
        reveal[i].t = prev && next ? (prev.t + next.t) / 2 : prev ? prev.t + .25 : next ? next.t - .25 : 0; reveal[i].interpolated = true;
      }
      out.push({ start: reveal[0].t, end: reveal[reveal.length - 1].end ?? reveal[reveal.length - 1].t + .3, reveal });
    }
    return out;
  }

  function plan(spec, words) {
    const errors = [], warnings = [], mode = spec.mode || 'cut';
    const beats = (spec.beats || []).map((b, i) => ({ ...b, i, section: b.section ?? 0 }));
    const objects = spec.objects || [];

    // ── validate beats ──
    beats.forEach(b => {
      const T = TYPES[b.type];
      if (!T) { errors.push(`beat ${b.i}: unknown type "${b.type}" (use ${Object.keys(TYPES).join(', ')})`); return; }
      const n = tokens(b.text).length;
      if (T.text === true && !n) errors.push(`beat ${b.i} (${b.type}): needs text`);
      if (n && (n < T.words[0] || n > T.words[1])) warnings.push(`beat ${b.i} (${b.type}): ${n} words; this type reads best with ${T.words[0]}–${T.words[1]}`);
      if (T.needs === 'object' && !b.object) errors.push(`beat ${b.i} (${b.type}): needs "object"`);
      if (b.object && objects.length && !objects.includes(b.object)) warnings.push(`beat ${b.i}: object "${b.object}" is not in spec.objects`);
      if (T.needs === 'shape' && !b.shape) errors.push(`beat ${b.i} (silhouette): needs "shape" (a key of spec.silhouettes)`);
      if (b.shape && !(spec.silhouettes || {})[b.shape]) errors.push(`beat ${b.i}: silhouette "${b.shape}" is not defined in spec.silhouettes`);
      if (b.text && b.text !== b.text.toLowerCase() && !['spell', 'hero'].includes(b.type)) warnings.push(`beat ${b.i}: speech is lower-case in this style`);
      if (b.type === 'card' && !/[.!?]$/.test(b.text || '')) warnings.push(`beat ${b.i} (card): card words end with a period ("word.")`);
    });
    if (errors.length) return { beats, duration: 0, errors, warnings, mode };

    // ── timing ──
    const al = align(beats, words);
    beats.forEach((b, k) => {
      const a = al && al[k];
      if (b.dur != null) { b.timing = 'fixed'; }
      else if (a) { b.timing = 'voice'; b._voice = a; }
      else { b.dur = estimate(b, mode); b.timing = 'estimate'; }
    });
    // voice-timed beats: start a little before the first word, run to the next voiced beat
    if (al) {
      const LEAD = .12;
      let cursor = 0;
      beats.forEach((b, k) => {
        if (b.timing === 'voice') {
          const st = Math.max(cursor, b._voice.start - LEAD), nextV = beats.slice(k + 1).find(x => x.timing === 'voice');
          const gapFill = beats.slice(k + 1, nextV ? beats.indexOf(nextV) : beats.length).reduce((s, x) => s + (x.dur ?? estimate(x)), 0);
          const end = nextV ? nextV._voice.start - LEAD - gapFill : Math.max(b._voice.end + .5, st + estimate(b));
          const T = TYPES[b.type], floor = T.perLetter ? T.min * Math.max(1, norm(b.text).length) : T.min;
          // readability: the last word must stay on screen >= HOLD after it is spoken; borrow from the following text-less beats
          const need = b.type === 'flash' ? 0 : b._voice.end + HOLD; let e2 = end; // flashes are subliminal: no hold
          if (e2 < need && nextV) {
            let short = need - e2;
            for (const x of beats.slice(k + 1, beats.indexOf(nextV))) { const give = Math.max(0, x.dur - TYPES[x.type].min); const d = Math.min(give, short); x.dur -= d; short -= d; if (short <= 0) break; }
            e2 = need - Math.max(0, short);
            if (short > .05) errors.push(`beat ${b.i}: last word "${b._voice.reveal.at(-1).word}" gets ${(HOLD - short).toFixed(2)}s on screen (needs ${HOLD}s); move the next line later in the voice, or shorten this beat's text`);
          }
          b.dur = Math.max(floor, Math.max(e2, end) - st);
          if (b.type === 'flash' && b.dur > FLASH_MAX) { const prevB = beats[k - 1]; if (prevB) prevB.dur += b.dur - FLASH_MAX; b.dur = FLASH_MAX; } // a flash is 2–4 frames; the spare time extends the previous hold
          b.reveal = b._voice.reveal.map(r => ({ word: r.word, t: Math.max(0, r.t - st) }));
          cursor = st + b.dur;
        } else cursor += b.dur;
        delete b._voice;
      });
    }
    // section-end acceleration for estimated beats (not voice-timed: the voice owns those)
    const sections = [...new Set(beats.map(b => b.section))];
    sections.forEach(sec => {
      const sb = beats.filter(b => b.section === sec && b.timing === 'estimate');
      // the beats leading into a section's last beat get progressively shorter (the cut rhythm accelerates)
      sb.slice(-4, -1).reverse().forEach((b, j) => { const T = TYPES[b.type], readable = b.type === 'flash' ? 0 : mode === 'flow' && b.type === 'card' ? FLOW_CARD_MIN : tokens(b.text).length / WPS_LIMIT + HOLD; b.dur = Math.max(readable, clamp(b.dur * SECTION_ACCEL[j + 1], T.min, T.max)); });
    });
    // spell beats split into one shot per letter
    const out = [];
    beats.forEach(b => {
      if (b.type === 'spell') {
        const afterInk = mode === 'flow' && out.length && out[out.length - 1].type === 'scatter'; // flow scatter ends on black: spell from void
        const letters = [...String(b.text).replace(/\s/g, '')], per = b.dur / letters.length, cyc = b.worlds || (afterInk ? ['void', 'red', 'void', 'paper'] : TYPES.spell.world);
        letters.forEach((ch, j) => out.push({ ...b, letterIndex: j, letters, dur: b.timing === 'voice' ? per : TYPES.spell.base, world: cyc[j % cyc.length], text: b.text }));
      } else out.push(b);
    });

    // ── worlds ──
    let prev = null;
    out.forEach((b, k) => {
      if (!b.world) {
        const opts = TYPES[b.type].world;
        b.world = opts.find(w => w !== prev) || opts[0];
        if (b.type === 'flash') b.world = opts[k % opts.length];
      }
      prev = b.world;
    });
    // ── reveals (estimated beats: words spread over the first ~60 % of the beat) ──
    out.forEach(b => {
      if (b.reveal || !b.text || b.type === 'spell') return;
      const t = tokens(b.text), span = Math.min(b.dur * .6, t.length / WPS_LIMIT * 1.4), lead = b.type === 'card' ? .12 : .08;
      const sp = Math.min(span, Math.max(0, b.dur - HOLD - lead));
      b.reveal = t.map((w, j) => ({ word: w, t: lead + (t.length > 1 ? sp * j / (t.length - 1) : 0) }));
    });
    // ── transitions ──
    out.forEach((b, k) => {
      const n = out[k + 1];
      if (!n) { b.transition = 'end'; return; }
      if (mode === 'flow') b.transition = (b.type === 'spell' && n.type === 'spell') || b.type === 'flash' || n.type === 'flash' ? 'cut' : 'handoff'; // flashes always cut, in and out
      else b.transition = n.section !== b.section ? 'cut-on-beat' : 'cut';
    });
    // ── start times ──
    let acc = 0; out.forEach(b => { b.start = +acc.toFixed(3); b.dur = +b.dur.toFixed(3); acc += b.dur; });

    // ── lint the whole ──
    const duration = +acc.toFixed(2);
    if (spec.length && Math.abs(duration - spec.length) > spec.length * .15) warnings.push(`duration ${duration}s vs requested ${spec.length}s: add or cut beats`);
    const avg = duration / out.length;
    if (avg > 1.5) warnings.push(`average shot ${avg.toFixed(2)}s is slow for this style (aim 0.8–1.2s)`);
    out.forEach((b, k) => {
      const n = out[k + 1]; if (!n) return;
      if (n.world === b.world && n.type === b.type && b.type !== 'spell') warnings.push(`beats ${b.i}→${n.i}: same type and world back to back; change scale or world`);
      const wps = tokens(b.text).length / b.dur; if (b.text && !['spell', 'flash'].includes(b.type) && wps > WPS_LIMIT) warnings.push(`beat ${b.i}: ${wps.toFixed(1)} words/s is too fast to read (max ${WPS_LIMIT})`);
    });
    for (let k = 0; k + 2 < out.length; k++) { const run = out.slice(k, k + 3); if (run.every(b => b.world === run[0].world) && run.reduce((s, b) => s + b.dur, 0) > 2.2) warnings.push(`beats ${run[0].i}–${run[2].i}: one world for ${run.reduce((s, b) => s + b.dur, 0).toFixed(1)}s; alternate worlds on each idea`); }
    if (!out.some(b => b.type === 'resolve' || b.type === 'spell')) warnings.push('no ending beat (resolve or spell): the style ends messier, on a mark or a word');
    // word budget (writing.md §2)
    const spoken = spec.beats.reduce((n, b) => n + (TYPES[b.type]?.text && b.type !== 'spell' ? tokens(b.text).length : 0), 0);
    const L = spec.length || duration, lo = Math.round(L * 1.45), hi = Math.round(L * 2.3);
    if (spoken < lo || spoken > hi) warnings.push(`${spoken} spoken words for ${L}s; the budget is about ${lo}–${hi} (writing.md §2)`);
    // one world held too long across different beat types
    for (let k = 0; k < out.length; k++) { let j = k, t = 0; while (j < out.length && out[j].world === out[k].world) { t += out[j].dur; j++; } if (j - k > 1 && t > 3) { warnings.push(`beats ${out[k].i}–${out[j - 1].i}: ${out[k].world} for ${t.toFixed(1)}s straight; insert a contrasting beat (conveyor, flash)`); k = j - 1; } }
    out.forEach(b => { if (b.dur > 2.5 && b.type !== 'resolve') warnings.push(`beat ${b.i} (${b.type}): ${b.dur.toFixed(1)}s in one shot; holds cap around 2–2.5s, so split it into two beats`); });
    out.filter(b => b.type === 'silhouette' && /hand/i.test(b.shape || '')).forEach(b => { const w = tokens(b.text), h = Math.ceil(w.length / 2), L = w.slice(0, h).join(' '), R = w.slice(h).join(' '); if (Math.max(L.length, R.length) > 16) warnings.push(`beat ${b.i}: "${L.length > R.length ? L : R}" is ${Math.max(L.length, R.length)} chars beside the hand (max ~16); shorten the line or it will be shrunk`); });
    const accents = out.filter(b => b.type === 'flare').length; if (accents > 1) warnings.push('more than one flare: the cyan moment should happen once');
    return { beats: out, duration, errors, warnings, mode, fps: spec.fps || (mode === 'flow' ? 60 : 24) };
  }

  function table(p) {
    const rows = p.beats.map(b => `| ${b.start.toFixed(2)} | ${b.dur.toFixed(2)} | ${b.world} | ${b.type}${b.letterIndex != null ? `[${b.letters[b.letterIndex]}]` : ''} | ${b.text ? (b.type === 'spell' ? b.letters.slice(0, b.letterIndex + 1).join(' ') : b.text) : '—'} | ${[b.type === 'resolve' && !b.object ? null : b.object, b.shape, b.accent].filter(Boolean).join(', ') || '—'} | ${b.timing} | ${b.transition} |`);
    return [`**${p.duration}s · ${p.beats.length} shots · ${p.mode} @ ${p.fps}fps · avg ${(p.duration / p.beats.length).toFixed(2)}s**`, '',
      '| t | dur | world | beat | words | objects | timing | out |', '|---|---|---|---|---|---|---|---|', ...rows, '',
      ...(p.errors.length ? ['**Errors**', ...p.errors.map(e => '- ' + e), ''] : []),
      ...(p.warnings.length ? ['**Warnings**', ...p.warnings.map(e => '- ' + e)] : ['No warnings.'])].join('\n');
  }

  const api = { plan, table, TYPES, estimate, align };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PPMPlan = api;
})(typeof window !== 'undefined' ? window : globalThis);
