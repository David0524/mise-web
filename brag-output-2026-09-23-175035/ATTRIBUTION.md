# Third-party assets in this video

The app's palette, Nunito type, `MiseHello` character, copy and interface fragments come
from this repository. The cooking is real photography: four CC0 photographs from the
WordPress Photo Directory, graded to match. The steam over them is generated from seeded
noise for this film. The audio and the animation runtime are third-party.

| Asset | Path | Source |
| --- | --- | --- |
| Music bed | `composition/assets/music/happy-beats-business-moves-vol-9-by-ende-dot-app.mp3` | [ende.app](https://ende.app/en) — "Happy Beats / Business Moves" series, bundled with the `brag` Claude Code plugin |
| Sound effects | `composition/assets/sfx/*` | [Kenney](https://kenney.nl/) — bundled with the `brag` plugin |
| Prep shot (knife on a board, cook behind) | `composition/assets/img/prep.jpg` | Roberto Vazquez, [WordPress Photo Directory](https://wordpress.org/photos/photo/42267aba73/) — CC0 (cropped) |
| Hot-oil shot (wok over flame) | `composition/assets/img/wok.jpg` | Bijay Kumal, [WordPress Photo Directory](https://wordpress.org/photos/photo/184696a6bc/) — CC0 (cropped) |
| Glaze close-up | `composition/assets/img/glaze.jpg` | Manoj Gyawali, [WordPress Photo Directory](https://wordpress.org/photos/photo/2646a1d27f/) — CC0 (cropped) |
| Plate (sesame-glazed chicken) | `composition/assets/img/plate.jpg` | Tawhid Sadman, [WordPress Photo Directory](https://wordpress.org/photos/photo/491695674a/) — CC0 (cropped) |
| Steam textures | `composition/assets/img/steam1-7.png` | Generated for this film from seeded fractal noise; no third-party asset |
| Oil spatter | generated in `composition/index.html` | Deterministic particles drawn for this film |
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
