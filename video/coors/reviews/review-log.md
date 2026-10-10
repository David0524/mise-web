# Review log

## Round 1 (golden-r1): OVERALL FAIL
Reviewer's top fixes, and what changed:
1. 12 of 16 plates were rectangular prints, not cut-outs -> recut with BiRefNet / u2net (people) and a new `--sky` skyline cut (landscapes); only the malted-milk ad keeps its printed border. Thicker default rim (0.5 % of the long side).
2. Plates too small, parked beside each other -> h 0.8-1.0, `bg` pulled in to about [±0.22, -0.16] so the old plate sits behind a shoulder; tannery `keep: 1.9`; hats bg [-0.38, -0.18].
3. Entries didn't loom from the lens; the litany sagged in the middle -> `fromScale 2.0`, `fromDist 0.6`; lines 10-13 sped up, "April 7, 1933." -> "April 1933."; film 52.4 -> 51.2 s.
4. Captions too small and over lit areas -> engine default size 0.043 H, baseline 0.948; every settled plate's bottom edge kept above +0.36 H; "Adolph Coors.\nOrphaned at fifteen." on two lines.
5. Product light dull -> curtain amt 1.7-1.8, narrow light sweeps (`sweep` width option), rimless bottle (`--no-rim`), bottle fully in frame, floor glow and stronger reflection.
Also: lifted black point in the treatment (`lighten` with #181512), VO lines re-voiced for intelligibility (remaining ASR misses are British pronunciations: "Kors", "brood").
