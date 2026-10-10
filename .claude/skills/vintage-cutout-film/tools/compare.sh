#!/usr/bin/env bash
# Side by side: a reference still and a still from your film, same height, labelled. For the reviewer.
#   compare.sh ref.mp4 <t_ref> film.mp4|still.jpg <t_film|-> out.jpg
set -euo pipefail
ref=$1 tr=$2 film=$3 tf=$4 out=$5
tmp=$(mktemp -d)
ffmpeg -v error -y -ss "$tr" -i "$ref" -frames:v 1 -vf "scale=-2:720,drawtext=text='REFERENCE %{pts\:hms}':x=10:y=10:fontcolor=white:fontsize=22:box=1:boxcolor=black@0.5" "$tmp/a.png" 2>/dev/null \
  || ffmpeg -v error -y -ss "$tr" -i "$ref" -frames:v 1 -vf scale=-2:720 "$tmp/a.png"
if [ "$tf" = "-" ]; then ffmpeg -v error -y -i "$film" -vf scale=-2:720 "$tmp/b.png"; else ffmpeg -v error -y -ss "$tf" -i "$film" -frames:v 1 -vf scale=-2:720 "$tmp/b.png"; fi
ffmpeg -v error -y -i "$tmp/a.png" -i "$tmp/b.png" -filter_complex hstack=inputs=2 -q:v 3 "$out"
rm -rf "$tmp"; echo "$out"
