#!/usr/bin/env bash
# Make every cut-out for the Coors film from assets/src into assets/cut (needs the skill's tools/prep.py + rembg).
#   PY=/path/to/venv/python ./cut.sh [name ...]      (no names = all)
set -euo pipefail
cd "$(dirname "$0")/assets"
PY=${PY:-python3}
PREP="$PY -I ../../../.claude/skills/vintage-cutout-film/tools/prep.py"
mkdir -p cut
HUMAN="--model u2net_human_seg"
OBJ="--model isnet-general-use"
BIREF="--model birefnet-general"   # slower, much better on busy period photos (crowds, workers in machinery)
declare -A J
# name                    source                                                         options
J[adolph_young]="src/hist/hc-youngadolph.jpg --crop 900,0,7300,7369 $HUMAN --max 1800 --rim 5"
J[brewers]="src/people/p4_alpen_brau_brewery_workers.jpg --crop 520,400,620,560 $BIREF --max 1500 --rim 4"
J[steerage]="src/people/p1_steerage_passengers_ship_bow_1915.jpg --crop 150,620,1500,1120 $BIREF --max 1800 --rim 4"
J[bricklayer]="src/people/p2_bricklayer_at_work_1923.jpg --crop 80,80,2180,2840 $HUMAN --max 1800"
J[stoker]="src/people/p3_powerhouse_mechanic_steam_pump_hine_1920.jpg --crop 200,0,1955,2850 $OBJ --max 2200 --hole 1265,640,150,150"
J[stenger]="src/web/mcb_Stenger.jpg --crop 0,135,1560,860 --sky .82 --max 1600"
J[kegs]="src/people/p4_brewery_kegs_c1920_small.jpg $BIREF --max 1400 --rim 2"
J[tannery]="src/web/mcb_1880s-Coors-Brewery-300dpi.jpg --sky .8 --contrast 1.0 --gamma 1.2 --max 1800"
J[adolph_old]="src/web/ce_Adolph-Coors_Media-2_10026119_0.jpg $HUMAN --max 1400"
J[sewer]="src/people/p5_stern_officials_liquor_into_sewer_1921.jpg --crop 250,420,2200,1500 $HUMAN --max 1800"
J[maltedmilk]="src/web/mcb_Coors-also-made-malted-milk-during-Prohibition.jpg --card --max 1600"
J[nearbeer]="src/people/p6_men_celebrating_repeal_drinking_paris_1933.jpg --crop 1340,230,520,560 $BIREF --max 1500"
J[porcelain]="src/web/mcb_Porcelain-Plant-Image-1920s.jpg --sky .8 --max 1800"
J[waiting]="src/people/p5_stern_immigrant_face_hine_1907.jpg --crop 60,300,900,900 $BIREF --max 1500 --rim 4"
J[truck1933]="src/people/p7_crowd_at_beer_truck_unloading_cases_night_1933.jpg --crop 60,520,1700,1600 $BIREF --max 1800"
J[hats]="src/people/p6_crowd_cheering_waving_hats_1923.jpg --crop 100,100,2800,2050 $BIREF --max 1800 --rim 4"
J[beerad]="src/people/p6_beer_ad_pouring_1933.jpg --crop 400,250,620,600 --model u2net --max 1500 --rim 4"
J[bottle]="src/web/mcb_Bot12-300dpi.jpg $OBJ --max 2400 --no-rim"
J[bottle_green]="src/web/ww_feature_bottle_1.jpg $OBJ --max 2000 --rim 2"
names=("$@"); [ ${#names[@]} -eq 0 ] && names=("${!J[@]}")
for n in "${names[@]}"; do
  read -r src opts <<<"${J[$n]}"
  echo -n "$n: "; $PREP $src cut/$n.png $opts 2>/dev/null | tail -1
done
