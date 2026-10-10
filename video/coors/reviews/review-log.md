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
