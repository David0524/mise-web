#!/usr/bin/env python3
"""Word timestamps for cutting to a voice: word-timings.py <audio> [out.json] [--model small] [--chunk 8] [--transcript "text"]

Runs faster-whisper with word_timestamps on short chunks (default 8 s, 0.5 s overlap) because
long-context alignment drifts on music beds. Output: [{"word", "start", "end"}...] in seconds.
If --transcript is given, the recognised words are snapped onto the transcript's words
(the transcript's spelling wins, the timings come from whisper).
Needs: pip install faster-whisper   (and ffmpeg on PATH)
"""
import json, os, re, subprocess, sys, tempfile, difflib

def arg(name, default=None):
    if name in sys.argv:
        i = sys.argv.index(name); v = sys.argv[i + 1]; del sys.argv[i:i + 2]; return v
    return default

model_name, chunk, transcript = arg('--model', 'small'), float(arg('--chunk', '8')), arg('--transcript')
audio = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else None
from faster_whisper import WhisperModel

dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', audio]).decode())
model = WhisperModel(model_name, device='cpu', compute_type='int8')
words, ov, t = [], 0.5, 0.0
with tempfile.TemporaryDirectory() as td:
    while t < dur:
        wav = os.path.join(td, 'c.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(max(0, t - ov)), '-t', str(chunk + ov), '-i', audio, '-ac', '1', '-ar', '16000', wav], check=True)
        segs, _ = model.transcribe(wav, word_timestamps=True, vad_filter=False, language='en')
        base = max(0, t - ov)
        for s in segs:
            for w in s.words or []:
                st, en = base + w.start, base + w.end
                if st < t - 0.05 and words:  # overlap region already covered by the previous chunk
                    continue
                words.append({'word': w.word.strip(), 'start': round(st, 3), 'end': round(en, 3)})
        t += chunk

if transcript:
    norm = lambda s: re.sub(r"[^a-z0-9']", '', s.lower())
    tw = transcript.split()
    sm = difflib.SequenceMatcher(a=[norm(w['word']) for w in words], b=[norm(x) for x in tw], autojunk=False)
    snapped = [None] * len(tw)
    for a, b, n in sm.get_matching_blocks():
        for k in range(n):
            snapped[b + k] = {**words[a + k], 'word': tw[b + k]}
    # interpolate transcript words whisper missed
    for i, s in enumerate(snapped):
        if s is None:
            prev = next((snapped[j] for j in range(i - 1, -1, -1) if snapped[j]), None)
            nxt = next((snapped[j] for j in range(i + 1, len(tw)) if snapped[j]), None)
            st = prev['end'] if prev else 0.0
            en = nxt['start'] if nxt else (st + 0.3)
            snapped[i] = {'word': tw[i], 'start': round(st, 3), 'end': round(max(st + 0.05, en), 3), 'interpolated': True}
    words = snapped

js = json.dumps(words, indent=1)
open(out, 'w').write(js) if out else print(js)
print(f'{len(words)} words, {dur:.2f}s', file=sys.stderr)
