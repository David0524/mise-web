# Review log

## Round 1 (golden-r1): OVERALL FAIL
Reviewer's top fixes, and what changed:
1. 12 of 16 plates were rectangular prints, not cut-outs -> recut with BiRefNet / u2net (people) and a new `--sky` skyline cut (landscapes); only the malted-milk ad keeps its printed border. Thicker default rim (0.5 % of the long side).
2. Plates too small, parked beside each other -> h 0.8-1.0, `bg` pulled in to about [±0.22, -0.16] so the old plate sits behind a shoulder; tannery `keep: 1.9`; hats bg [-0.38, -0.18].
3. Entries didn't loom from the lens; the litany sagged in the middle -> `fromScale 2.0`, `fromDist 0.6`; lines 10-13 sped up, "April 7, 1933." -> "April 1933."; film 52.4 -> 51.2 s.
4. Captions too small and over lit areas -> engine default size 0.043 H, baseline 0.948; every settled plate's bottom edge kept above +0.36 H; "Adolph Coors.\nOrphaned at fifteen." on two lines.
5. Product light dull -> curtain amt 1.7-1.8, narrow light sweeps (`sweep` width option), rimless bottle (`--no-rim`), bottle fully in frame, floor glow and stronger reflection.
Also: lifted black point in the treatment (`lighten` with #181512), VO lines re-voiced for intelligibility (remaining ASR misses are British pronunciations: "Kors", "brood").

## Round 2 (golden-r2): OVERALL FAIL
Must-fixes and what changed:
1. Five entries filled the frame on their first frame (read as hard cuts) -> `fromScale 1.4`, `fromDist 0.95`, `ease: 'inOut'` on every plate; hats no longer enters from the camera.
2. Portal payoff invisible (porthole radius 0.054 H, k 17.7) -> stoker piece h 1.6 (radius 0.082 H, auto k 11.6), `pos` puts the porthole at (0, -0.36); the bricklayer scene now fills the frame through it.
3. Brewers plate was two silhouettes from a 308 px source -> a 1920 px public-domain brewery crew photo (Alpen Brau), cut with BiRefNet. Low-res kegs at `--rim 2`.
4. Leftover background (bricklayer), rim islands (stoker) -> u2net_human_seg for the bricklayer; prep.py now drops mask islands under 0.5 % of the subject.
5. Script credit appeared 2.7 s early (matched the wrong "Adolph Coors" line) -> exact match; the title now builds on "The Golden Brewery." (VO moved onto the hero shot), "since 1873" and "Adolph Coors" on theirs.
6. Hidden receding plates -> new `bg` for steerage, Stenger, sewer and the last plate; tannery recut at contrast 1.0, gamma 1.2 (was bleached).
Also: truck crowd dropped; hats now play "April 1933." and a 1933 beer advertising photo plays "Beer is back."; reveal curtain warmer and brighter, floor reflection visible; macro lighting per the review; litany middle lines tightened; film 50.8 s.

## Round 3 (golden-r3): OVERALL FAIL (7 must-fix)
1. Portal blotted out the old scene for 4 frames -> engine bug: the entry zoom (`fromScale`) scaled a portal plate about its centre and threw the hole off screen. Portals now zoom about their hole. Stoker `k: 5` (old scene fills the porthole), `fromScale 1.8`, `enter 1.3`, `nearBlur 14` (no bright wash).
2. Near-beer cut-out broken (trailing arm, stray hand) -> tighter crop, h 0.72, centred.
3. Final 1933 plate small and low (transparent margins) -> tight crop, h 0.82 centred.
4. Hero bottle floated, no floor -> curtain bottom = floor line, floor sheen, contact glow, reflection alpha 0.6.
5. Neck macro unreadable -> two hard 0.008-wide light lines on the glass, brighter glass, cap inside the frame.
6. Pool bottle floated -> shadow anchored at the base, contact shadow, warmer pool.
7. "Dug ditches" misheard -> vo.py --best-of 5 (records each line five times, keeps the take ASR understands best); all lines now 1.00 except the British "Kors"/"brood".
Also: curtain redrawn as one broad glow plus wide folds (was a comb); gentler entries on steerage, Stenger, kegs and sewer; receding plates kept inside the frame; void exactly #191716.

## Round 4 (golden-r4): OVERALL FAIL (6 must-fix); grade, treatment, rims, captions, mix and litany continuity all PASS
1. Hero floor read as a matte shelf, curtain folds invisible -> floor glow alphas 0.06/0.10, curtain 5 wide folds at amt 3.2 with the sides falling to the void; title fade 0.08 s, bevel 0.006.
2. Neck macro: light cut across the glass -> glass brighter (bright 0.55, contrast 1.6), two vertical hard lines down the neck's edges (`sweep` slant option, 0 = vertical).
3. Three lines misheard in the finished track ("coal", "foreman", "Malted") -> say spellings, more voice on the marginal lines; vo.py now verifies every line in the finished mix and re-records the ones that fail there (`--verify-rounds`).
4. 7 s without a face (building, kegs, landscape) -> "Bottling beer." now plays over the crew's front row beside crates stamped BOTTLED BEER.
5. Portal: settled hole too small, caption on bright metal -> k 4.2, plate lifted (pos y -0.02), fromScale 2.2, enter 1.6.
Also: softer entries (enter 0.65-0.7) on the six punchiest plates; receding steerage and Adolph kept inside the frame; warmer pool.

## Round 5 (golden-r5): OVERALL FAIL (3 must-fix); grade, treatment, captions, audio (ASR matches; "Kors" only), stack continuity PASS
1. Headless man at the right of the bottled-beer crew -> crop narrowed (560,760,760,700).
2. Hero floor and reflection invisible, curtain hard-stopped at the floor line -> curtain runs to 0.45 H and fades into the floor; floor glows alpha 0.25/0.35, ry 0.12; reflection alpha 0.9; curtain amt 5.
3. Neck macro: no edge light. Cause: the sweeps were placed on the body's edges, off the narrower neck. Neck edges measured from the PNG alpha (0.435-0.56 of its width -> sweep p 0.468-0.53); two thin bands plus a core line.
Nice-to-haves applied: adolph_young rim 7; brewers crop drops a sliver of another person; waiting crop runs off the frame bottom; calmer entries (fromDist 0.7-0.75 on Stenger, kegs, sewer, beer ad; steerage k 1.8, fromDist 1.2; hats fromDist 1.2); stoker lifted (pos y -0.08).

## Round 6 (golden-r6): OVERALL FAIL (2 must-fix)
1. Hero reflection drawn 0.18 H too low (wrong sign: mirroring about the floor line needs dy = +(1 - base/h)·bh), no contact shadow -> fixed sign, alpha 0.42, contact pool; curtain to 0.55 H, x1 0.45, amt 6.5; bottle 0.74; bevel 0.009.
2. Young Adolph receded exactly behind a worker's head (double head) -> brewers bg [-0.44, -0.22].
Nice-to-haves applied: steerage bg y -0.22; stoker h 1.35, pos y -0.14; waiting h 0.8, y -0.04; hats bg [0.44, -0.3]; beer-ad inner hole filled (prep.py --fill-holes .05); thinner neck edge lines; entries fromScale 1.25 by default.

## Round 7 (golden-r7): OVERALL FAIL (4 must-fix)
1. Hats entry flashed on its first frame (diff 51.6) -> fromDist 1.6, fromScale 1.1, entryEase inOut, enter 0.65.
2. Curtain folds a third of the reference's contrast -> engine `curtain({gaps: true})`: folds barely overlap so dark troughs show; amt 3.2-3.4, 6 folds, label shot widened to ±0.55.
3. Bricklayer kept his wall shadow -> BiRefNet plus two `--erase` polygons (new prep.py option; it re-runs the island filter afterwards, so no slivers are left).
4. Stoker inner hole -> `--fill-holes .05`.
Nice-to-haves applied: neck highlight amt 0.8 (no clipping), steerage fromDist 1.5 / fromScale 1.1 / inOut, enter +0.15 s on brewers, Stenger, kegs and sewer; rim 4 on sewer and old Adolph.
(Tried and dropped: an automatic dark-shadow trim, which ate dark hats and faces.)

## Round 8 (golden-r8): OVERALL FAIL (2 must-fix, both the reveal curtain); litany fully PASS
Rounds 7 and 8 measured curtain folds with different methods and asked for opposite changes. Settled with one tool (foldm.py: relative fold contrast + detrended std, upper and middle bands) run on the reference's own reveal frames: ref upper 0.09-0.25 / mid 0.18-0.34. The label shot already matched (0.28 / 0.25); the hero was too hard (0.35 / 0.37).
1. Hero curtain -> a soft overlapping drape (amt 1.6, 5 folds) under a light gapped layer (amt 1.1): now 0.156 / 0.237, inside the reference's range.
2. Curtain ran through the floor -> curtain stops at the floor line (0.3), then a full-width dark glossy floor plane; pools, contact shadow and reflection on top.
Nice-to-haves applied: brewers crop keeps the back two rows only (the front row is the bottled-beer plate); bricklayer rim 7, old Adolph rim 3; neck edge sweeps 0.006 wide so the light stays on the glass where the neck steps in; neck core line amt 0.85.

## Round 9 (golden-r9): OVERALL FAIL (1 must-fix); everything else PASS
1. "Beer is back.": the cut-out dropped the glass of beer (transparent glass, every mask model loses it) and cut her hand at the crop edge -> crop widened (330,240,694,610), u2net, and a new prep.py `--add` polygon forces the glass into the mask.
Nice-to-haves applied: hats and steerage fromDist 2.2 (softer first frames); hero curtains end at 0.24 with the floor gradient from 0.23 (no seam); second curtain layer amt 1.5.
Left as is: the waiting woman's "chair-back" is her bundle tied in a shawl (part of the photo's story); the rhythm of lines 10-13 would need the VO retimed.

## Round 10 (golden-r10): OVERALL FAIL (1 must-fix); everything else PASS (curtain inside the reference's foldm range)
1. "Beer is back.": the glass is back but her head was sliced above the eyes (the crop started below her hair) -> crop 330,200,694,650 (u2net keeps the hair once it is inside the crop), glass `--add` moved down 40 px, the wicker chair arm at the bottom left cut with `--erase`.
Nice-to-haves applied: entries 0.15 s longer on brewers, steerage, Stenger, kegs, malted milk and the beer ad (entry diff peaks 37-41 vs the reference's 23-35); brewers x 0.12 -> 0.04 (clears the right edge); young Adolph rim 7 -> 5; waiting `--gamma 1.25`.

## Round 11 (golden-r11): OVERALL FAIL (1 must-fix); 1933 couple, entries, grade, audio, reveal PASS
1. Brewers rim a soft 9-16 px halo: the 560 px crop was masked and rimmed small, then shown 2.7x larger -> new prep.py `--upscale` enlarges the crop to `--max` before masking, so the edge and rim are drawn at screen size; `--rim 5`.
Nice-to-haves applied: grey chair back between the couple cut with a second `--erase` (and `--fill-holes .012` so the gap stays open); hats crop widened to 120,100,2780,2050; waiting `--gamma 1.4`.
Not applied: shortening entries back to 0.6 s (round 10 asked for longer ones; round 11 measured the entry peaks inside the reference's range); the "slab" above the waiting woman's bundle is the bundle's dark cloth; the hats plate's straight left edge is the 1923 print's own border.

## Round 12 (golden-r12): OVERALL PASS (no must-fix), first passing round
Nice-to-haves applied for round 13: bottling crew `--erase` on a dark sliver at the left and on the photo border slicing the right man's arm; 1933 couple `--rim 3`.
Not applied: stoker `--rim 4` (the portal hole is given in padded PNG pixels, which a rim change would move); grain/vignette and the bottle tint (global looks a passing round already matched); litany retiming (needs the VO re-recorded).

## Round 13 (golden-r13): OVERALL FAIL (1 must-fix); everything else PASS
1. Bricklayer sliced lengthwise: the two rectangular shadow `--erase` polygons from round 7 had a straight left edge about 30-60 px inside his jacket and trouser front (missed by rounds 8-12) -> one polygon whose left edge traces the cloth, removing only the wall shadow.
Lesson for the skill: trace `--erase` polygons along the figure; a rectangle that clears a shadow also slices the body beside it.

## Round 14 (golden-r14): OVERALL PASS (no must-fix)
Optional fixes noted, not applied (to keep the passing cut under a second independent review): ground-shadow lumps on the sewer plate, straight bottom edges on the steerage and couple plates, Stenger fromDist 0.95, warmer neck edge light.
Round 15 = a fresh reviewer on the same render, as the second consecutive check.
