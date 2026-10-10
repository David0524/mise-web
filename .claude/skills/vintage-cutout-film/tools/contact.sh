#!/usr/bin/env bash
# Timestamped contact sheet of a video: contact.sh film.mp4 out.jpg [fps=2] [cols=8] [width=240]
set -euo pipefail
in=$1 out=$2 fps=${3:-2} cols=${4:-8} w=${5:-240}
n=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in"); rows=$(python3 -c "import math;print(math.ceil($n*$fps/$cols))")
ffmpeg -v error -y -i "$in" -vf "fps=$fps,scale=$w:-2,drawtext=text='%{pts\:hms}':x=4:y=4:fontsize=13:fontcolor=white:box=1:boxcolor=black@0.55,tile=${cols}x${rows}" -frames:v 1 -update 1 -q:v 3 "$out" 2>/dev/null \
  || ffmpeg -v error -y -i "$in" -vf "fps=$fps,scale=$w:-2,tile=${cols}x${rows}" -frames:v 1 -update 1 -q:v 3 "$out"
echo "$out"
