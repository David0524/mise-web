#!/usr/bin/env sh
# Master the render for delivery.
#
# `hyperframes render` mixes the composition's own gains faithfully, which lands this
# film at -17.8 LUFS integrated / -1.4 dBTP. Web players normalise to about -14 LUFS, so
# a file delivered at -17.8 plays noticeably quiet — the complaint that produced this
# step was, literally, "no sound?". The composition's gains are already as high as they
# can go without the bed plus a contact sound clipping, so the last 4 dB has to come from
# a limiter rather than from more gain.
#
# One pass: +4.0 dB, then a true-peak limiter at 0.78 (-2.2 dBFS) with a 5ms attack, which
# only touches the impacts. Result: -14.0 LUFS, -1.3 dBTP, LRA 7.9 — dead on spec, and the
# quiet open is still 14 dB below the loudest beat.
#
# Usage: ./master.sh composition/renders/<render>.mp4
set -eu
SRC="$1"
DIR="$(cd "$(dirname "$0")" && pwd)"

ffmpeg -hide_banner -v error -y -i "$SRC" \
  -c:v copy \
  -af "volume=4.0dB,alimiter=limit=0.78:attack=5:release=60:level=disabled" \
  -c:a aac -b:a 192k -movflags +faststart \
  "$DIR/brag.mp4"

# The poster is the pan at full flame — the one frame that says "cooking" on its own.
ffmpeg -hide_banner -v error -y -ss 45.15 -i "$DIR/brag.mp4" -frames:v 1 -q:v 2 "$DIR/brag.jpg"

ffmpeg -hide_banner -i "$DIR/brag.mp4" -af loudnorm=print_format=summary -f null /dev/null 2>&1 \
  | grep -E "Input (Integrated|True Peak|LRA)"
