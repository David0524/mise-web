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
