#!/usr/bin/env python3
"""Intelligibility check for the whispered VO: transcribe each line back and compare it with the script.

  python3 asr.py out/vo.wav out/lines.json [--model small.en]

Needs faster-whisper (pip install faster-whisper; downloads the model on first use). Prints per line the
script text, what was heard, and a word-match score; exit code 1 if any line scores under 0.7. A whisper
loses some consonants, so judge the key words, not the score alone. Fix a line with `say` (spell it as it
sounds), a slower `speed`, or more `voiced` in script.json, then re-run vo.py.
"""
import argparse, json, re, sys, wave
from difflib import SequenceMatcher
import numpy as np


ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
TENS = 'x x twenty thirty forty fifty sixty seventy eighty ninety'.split()


def say_num(n):
    n = int(n)
    if n < 20: return ONES[n]
    if n < 100: return TENS[n // 10] + ('' if n % 10 == 0 else ' ' + ONES[n % 10])
    if 1100 <= n < 2100 and n % 100: return say_num(n // 100) + ' ' + (('oh ' + ONES[n % 100]) if n % 100 < 10 else say_num(n % 100))
    if n % 100 == 0 and n < 10000: return say_num(n // 100) + ' hundred'
    return ' '.join(ONES[int(d)] for d in str(n))


def words(s):
    s = s.lower().replace('-', ' ')
    s = re.sub(r'\d+', lambda m: ' ' + say_num(m.group()) + ' ', s)
    return re.findall(r"[a-z']+", s)


def main():
    p = argparse.ArgumentParser(); p.add_argument('vo'); p.add_argument('lines'); p.add_argument('--model', default='small.en')
    a = p.parse_args()
    from faster_whisper import WhisperModel
    from scipy.signal import resample_poly
    w = wave.open(a.vo); sr = w.getframerate(); ch = w.getnchannels()
    x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    if ch > 1: x = x.reshape(-1, ch).mean(1)
    x = resample_poly(x, 16000, sr).astype(np.float32)
    m = WhisperModel(a.model, device='cpu', compute_type='int8')
    bad = 0
    for s, e, text in json.load(open(a.lines)):
        seg = x[max(0, int((s - .1) * 16000)):int((e + .15) * 16000)]
        heard = ' '.join(t.text.strip() for t in m.transcribe(seg, language='en', beam_size=5)[0])
        sc = SequenceMatcher(None, words(text), words(heard)).ratio()
        bad += sc < .7
        print(f"{'  ' if sc >= .7 else '!!'} {sc:.2f}  {text.replace(chr(10), ' ')!r:45} heard {heard!r}")
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
