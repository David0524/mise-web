#!/usr/bin/env bash
# Mix the whispered VO over the music bed: the music ducks under the voice, the whole mix is normalised to
# about -16 LUFS (the reference), true peak -1.5 dB.
#   mix.sh vo.wav music.wav out/mix.wav [music_gain_db=-3]
set -euo pipefail
vo=$1 music=$2 out=$3 mg=${4:--3}
ffmpeg -v error -y -i "$vo" -i "$music" -filter_complex "
  [1:a]volume=${mg}dB[m];
  [0:a]asplit=2[v][sc];
  [m][sc]sidechaincompress=threshold=0.03:ratio=4:attack=15:release=350:makeup=1[md];
  [v][md]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-16:LRA=7:TP=-1.5[o]" -map "[o]" -ar 48000 "$out"
ffmpeg -v info -i "$out" -af ebur128=framelog=quiet -f null - 2>&1 | grep -E ' I:| LRA:' | sed 's/^ */  /'
