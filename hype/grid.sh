#!/bin/bash
# grid.sh name "t1,t2,t3,t4" → stills of those beats tiled 2x2 into scratch/name.png
curl -s -o /dev/null localhost:8123/serve.js || { (nohup node "$(dirname "$0")/serve.js" >/dev/null 2>&1 &); sleep 1; }
S=/tmp/claude-0/-home-user-mise-web/4c6135d7-dafc-52ee-8f7c-fde55f386cd2/scratchpad
args=""; i=0
for b in ${2//,/ }; do t=$(python3 -c "print($b*0.5)"); args="$args,$t:g$i"; i=$((i+1)); done
node stills.js "${args:1}" > /dev/null
ffmpeg -v error -y -i stills/g0.png -i stills/g1.png -i stills/g2.png -i stills/g3.png -filter_complex "[0]scale=960:540[a];[1]scale=960:540[b];[2]scale=960:540[c];[3]scale=960:540[d];[a][b][c][d]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0" -frames:v 1 $S/$1.png
rm stills/g?.png
