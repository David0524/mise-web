# Third-party assets in this video

Everything visual is either from this repository or drawn for the Mise story film in `brag-output/` and reused here:
the palette, the Nunito type, the `MiseHello` character, the app's own copy and interface
fragments, one of its photographs used as a dim counter surface, and all of the cooking —
the board, knife, scallion, pan, oil, chicken, glaze, flames, steam and plate are hand-
authored SVG under GSAP, because there is no footage in this repo. The audio and the
animation runtime are third-party.

| Asset | Path | Source |
| --- | --- | --- |
| Music bed | `composition/assets/music/happy-beats-business-moves-vol-9-by-ende-dot-app.mp3` | [ende.app](https://ende.app/en) — "Happy Beats / Business Moves" series, bundled with the `brag` Claude Code plugin |
| Sound effects | `composition/assets/sfx/*` | [Kenney](https://kenney.nl/) — bundled with the `brag` plugin |

| All cooking artwork (board, knife, scallion, pan, oil, chicken, glaze, flames, steam, plate, chillies, equipment icons) | inline SVG in `composition/index.html` | Drawn for this film; no third-party asset involved |
| Nunito (woff2, weights 600/700/800/900) | `composition/assets/fonts/` | Google Fonts — SIL Open Font License 1.1 (the same family `app/layout.js` already loads) |
| GSAP 3.14.2 | `composition/assets/vendor/gsap.min.js` | GreenSock — free "standard" license for this use; vendored so the render needs no network |
| `brag` plugin (skill, music, SFX) | — | MIT, © 2026 Shunit Haviv Hakimi |

## ⚠ Before publishing this video

**The music licence is not verified.** The `brag` plugin ships the track but its own
`assets/music/README.md` says:

> Before publishing or redistributing the skill, verify and document the exact
> music license terms alongside these files.

So the plugin does not assert redistribution rights for the bed, and neither can this
file. Confirm the terms with ende.app before posting the video publicly or using it in
any paid promotion — or re-render with a track you hold a licence for. Swapping it is
cheap: drop the replacement into `composition/assets/music/`, point `#bgm` at it, and
re-derive the cue timings (`npx hyperframes beats`, or the plugin's
`scripts/analyze_music_cues.py`) since the beat-locks in `index.html` are specific to
this track's 109.96 BPM grid.

Kenney's assets are CC0 and carry no such constraint.
