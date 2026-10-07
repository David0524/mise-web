#!/usr/bin/env bash
# Contact sheet with timestamps: contact-sheet.sh <video.mp4> <out.png> [fps=4] [cols=4] [width=480]
set -euo pipefail
in=$1; out=$2; fps=${3:-4}; cols=${4:-4}; w=${5:-480}
n=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in" | awk -v f="$fps" '{print int($1*f+0.999)}')
rows=$(( (n + cols - 1) / cols ))
ffmpeg -v error -y -i "$in" -vf "fps=$fps,scale=$w:-1,drawtext=text='%{pts\:hms}':x=8:y=8:fontsize=18:fontcolor=red:box=1:boxcolor=white@0.7,tile=${cols}x${rows}" -frames:v 1 "$out"
echo "$out ($n frames, ${cols}x${rows})"
