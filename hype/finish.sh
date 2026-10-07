#!/bin/bash
# Join the worker segments, mux the soundtrack, and run the pop check.
set -e
cd "$(dirname "$0")"
printf "file 'seg_0.mp4'\nfile 'seg_1.mp4'\nfile 'seg_2.mp4'\n" > render/list.txt
ffmpeg -v error -y -f concat -safe 0 -i render/list.txt -c copy render/picture.mp4
ffmpeg -v error -y -i render/picture.mp4 -i audio/mix-14.wav -c:v libx264 -crf 19 -preset slow -pix_fmt yuv420p -c:a aac -b:a 256k -shortest -movflags +faststart mise-launch.mp4
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,nb_frames -of compact mise-launch.mp4
# pop check: mean luma difference between consecutive frames; print the biggest jumps
ffmpeg -v error -i render/picture.mp4 -vf "scale=480:270,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=render/diff.txt" -f null -
python3 -I - <<'PY'
import re
v=[float(x) for x in re.findall(r"YAVG=([\d.]+)", open("render/diff.txt").read())]
top=sorted(range(len(v)), key=lambda i:-v[i])[:14]
for i in sorted(top): print(f"frame {i+1:5d}  t={(i+1)/60:6.3f}s  beat {(i+1)/30:5.2f}  diff {v[i]:.1f}")
PY
