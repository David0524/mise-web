#!/usr/bin/env python3
"""Mix and master the soundtrack for brag.mp4 from the composition's own cue sheet.

Why this exists: `hyperframes render` mixes every lane about 8.5 dB under its
authored gain (a bed-only test render at data-volume 1.0 measured 8.5 dB under
the source file) and then compresses the result, so this cut's punches came out
capped near -12 dBFS with an LRA of 2.3. data-volume is clamped to 1, a media
element's volume cannot exceed 1, and a per-lane +8.5 dB gain stage clips each
lane at 0 dBFS before the loss is applied. None of those can be fixed from
inside the composition without distortion.

So the delivered soundtrack is built here instead, from the same files, times
and levels the composition declares (every <audio> tag in composition/index.html),
with the bed automation below mirroring the GSAP volume tweens exactly. Then it is
mastered to -14 LUFS with a true-peak ceiling and muxed onto the rendered picture.

Usage: python3 mix.py <rendered.mp4> <out.mp4>
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
COMP = os.path.join(HERE, "composition")
DURATION = 25.0
TARGET_LUFS = -14.0
CEILING = 0.82  # limiter ceiling (-1.7 dBFS), so the AAC encode lands at or under -1 dBTP

# Mirrors the #bgm tweens in index.html as (time, volume) breakpoints, linear between:
# 0.5 from 0; 16.34 -> 16.54 down to 0.2 (the hole before the drop); 16.82 -> 16.86
# back to 0.5 on the hit; 24.2 -> 25.0 out to 0.
BED_AUTOMATION = [(0.0, 0.5), (16.34, 0.5), (16.54, 0.2), (16.82, 0.2), (16.86, 0.5), (24.2, 0.5), (25.0, 0.0)]


def attrs(tag):
    return dict(re.findall(r'([\w-]+)="([^"]*)"', tag))


def piecewise(points):
    """An ffmpeg volume expression for linear breakpoints over time t."""
    expr = "%g" % points[-1][1]
    for (t0, v0), (t1, v1) in reversed(list(zip(points, points[1:]))):
        seg = "%g" % v0 if v0 == v1 else "(%g+(%g)*(t-%g)/%g)" % (v0, v1 - v0, t0, t1 - t0)
        expr = "if(lt(t,%g),%s,%s)" % (t1, seg, expr)
    return expr


def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True)


def lufs_of(path):
    err = run(["ffmpeg", "-hide_banner", "-i", path, "-af", "loudnorm=print_format=json", "-f", "null", "-"]).stderr
    return float(json.loads(err[err.rindex("{"):err.rindex("}") + 1])["input_i"])


def master(raw, out, gain_db):
    run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-af",
         "volume=%.2fdB,alimiter=limit=%g:attack=4:release=60:level=disabled" % (gain_db, CEILING),
         "-c:a", "pcm_f32le", out])


def main(src_video, out_video):
    html = open(os.path.join(COMP, "index.html"), encoding="utf-8").read()
    # Only real tags: comments in the file also mention "<audio> tags".
    tags = [a for a in (attrs(t) for t in re.findall(r"<audio\b[^>]*>", html)) if "src" in a]
    bed = [t for t in tags if t.get("id") == "bgm"]
    sfx = [t for t in tags if t.get("id") != "bgm"]
    assert len(bed) == 1 and sfx, "expected one #bgm and at least one sfx lane"

    fmt = "aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo"
    inputs = ["-i", os.path.join(COMP, bed[0]["src"])]
    parts = ["[0:a]atrim=0:%g,%s,volume='%s':eval=frame[a0]" % (DURATION, fmt, piecewise(BED_AUTOMATION))]
    for i, t in enumerate(sfx, start=1):
        inputs += ["-i", os.path.join(COMP, t["src"])]
        ms = int(round(float(t["data-start"]) * 1000))
        parts.append("[%d:a]atrim=0:%s,%s,volume=%s,adelay=%d|%d[a%d]"
                     % (i, t["data-duration"], fmt, t["data-volume"], ms, ms, i))
    n = len(sfx) + 1
    parts.append("%samix=inputs=%d:duration=first:dropout_transition=0:normalize=0,atrim=0:%g[mix]"
                 % ("".join("[a%d]" % k for k in range(n)), n, DURATION))

    raw = os.path.join(HERE, ".mix-raw.wav")
    done = os.path.join(HERE, ".mix-master.wav")
    run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(parts),
         "-map", "[mix]", "-c:a", "pcm_f32le", raw])

    # One gain move to the target, and a true-peak limiter that only touches the hits.
    # The limiter shaves peaks, which costs a little loudness; take that back once.
    raw_lufs = lufs_of(raw)
    gain_db = TARGET_LUFS - raw_lufs
    master(raw, done, gain_db)
    short = TARGET_LUFS - lufs_of(done)
    if abs(short) > 0.3:
        gain_db += short
        master(raw, done, gain_db)

    run(["ffmpeg", "-v", "error", "-y", "-i", src_video, "-i", done, "-map", "0:v", "-map", "1:a",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", out_video])
    for f in (raw, done):
        os.remove(f)
    print("lanes: 1 bed + %d sfx · raw mix %.1f LUFS · master gain %+.2f dB" % (len(sfx), raw_lufs, gain_db))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
