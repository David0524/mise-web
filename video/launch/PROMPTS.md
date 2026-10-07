# Mise launch film: generation prompts

Put every output in `video/launch/assets/` using the file names below. After that I'll time the cuts to the
voice (faster-whisper), swap the stand-ins for these assets, mix the audio and render the final.

Brand references for ChatGPT (upload both with the image prompts):
- **Mise the character:** `components/MiseHello.jsx` (export it as a PNG, or screenshot the app's "happy" Mise).
  A sous-chef with a puffy white toque, a round white face with two dot eyes and a small smile, a rust
  neckerchief (`#B44722`), a white chef jacket, a pink name tag (`#F0D9D5`) and dark-brown ink outlines (`#221A15`).
- **Logo / app icon:** `public/icon-512.png`, a white toque silhouette on rust (`#A84E40`).

---

## ElevenLabs

### 1. Voiceover → `assets/voice.mp3`
**Text to Speech.** Model: Eleven Multilingual v2. Settings: Stability 55 %, Similarity 75 %, Style 15 %,
Speaker boost on. If no library voice fits, make one in **Voice Design** with this description:

```
A warm, unhurried voice in its late twenties to thirties, gender-neutral to light-feminine, close to the
microphone like talking to one friend in a quiet kitchen at night. Soft, slightly breathy, a smile in the
voice, no announcer energy. Natural American accent. Short words land crisp; pauses feel calm, not dramatic.
```

Script. Paste it exactly; the breaks set the film's rhythm. "Meez" is spelled phonetically on purpose.

```
Mess. <break time="0.5s" />
Every good recipe starts the same way. <break time="0.35s" />
Then <break time="0.25s" /> a counter full of maybe. <break time="0.6s" />
So. <break time="0.3s" />
Prep. <break time="0.55s" /> Place. <break time="0.55s" /> Play. <break time="0.8s" />
Everything right where your hands expect it. <break time="0.4s" />
Now. <break time="0.5s" />
Meez.
```
Aim for 15–18 s in total. If it runs long, regenerate rather than speeding it up. Generate 3 takes and send the one where
"Prep. Place. Play." sounds most like three separate decisions.

### 2. Music bed → `assets/music.mp3`
**Eleven Music**, instrumental:

```
18-second instrumental bed for a calm cooking-app launch film. Lo-fi, warm and tactile: soft felt piano,
brushed snare, a muted upright-bass pulse, faint vinyl crackle, occasional kitchen-like percussion
(a wooden-spoon tap, a light glass clink) used as rhythm, not as sound effects. 88 BPM, key of F major.
Structure: 0–6 s slightly cluttered and off-balance (sparse hits, a piano phrase that doesn't resolve);
6–10 s three clean accented hits about 1.3 s apart, then drop to near-silence; 10–15 s warm, steady groove,
the piano phrase now resolves; 15–18 s everything settles onto one held major chord with a soft bell on top,
ending clean (no fade-out tail longer than 1 s). No vocals, no risers, no drops, no EDM, no cinematic
trailer drums. Mix it quiet enough to sit under a spoken voice.
```

### 3. Sound effects (optional) → `assets/sfx-*.mp3`
**Sound Effects**, one generation each, all very short and quiet:

| File | Prompt |
|---|---|
| `sfx-type.mp3` | `Soft mechanical keyboard typing, 6 quick keystrokes, close and quiet, dry room, 1 second` |
| `sfx-flash.mp3` | `Single crisp paper snap, like flicking a sheet of thick paper, very short, 0.2 seconds` |
| `sfx-flood.mp3` | `Soft low whoosh of ink spreading through water, smooth, 0.7 seconds, no reverb tail` |
| `sfx-chop.mp3` | `One clean knife chop on a wooden cutting board, close mic, 0.3 seconds` |
| `sfx-chime.mp3` | `Gentle warm kitchen-timer ding, single soft bell tone, 1.5 seconds, natural decay` |

---

## ChatGPT (images)

Upload the two brand references above with prompts 1 and 2. Ask for a **transparent PNG**. If it can't do that,
say "flat pure magenta #FF00FF background" and I'll key it out.

### 1. Mise as a pixel sprite → `assets/mise-pixel.png`
Goes above the final "mise" title and fills a slot in the spelled word.
```
Using the attached Mise character as the exact reference (same design, proportions and colours), draw Mise
as a single pixel-art sprite: chunky 32×32-pixel-era game art, about 32 pixels tall at native resolution,
upscaled with crisp nearest-neighbour pixels (no anti-aliasing, no blur). Keep her puffy white toque, round
white face with two dot eyes and a small smile, rust neckerchief #B44722, white chef jacket and pink name tag
#F0D9D5, with a 1-pixel dark brown #221A15 outline, 2–3 flat shading tones and one small highlight. Front
view, head and shoulders, centred, filling about 70% of a 1024×1024 canvas. No text, no shadow, no background
objects. Transparent background PNG.
```

### 2. Toque logo as a pixel sprite → `assets/toque-pixel.png`
Used in the letter slots so the spelled word morphs into the logo.
```
Using the attached app icon as the exact reference, draw only the white chef's-toque shape as a single
pixel-art sprite: chunky 32×32-pixel-era style, upscaled with crisp nearest-neighbour pixels, warm off-white
#F8F2EE with a 1-pixel dark brown #221A15 outline, one subtle grey-pink shading tone on the lower band, one small
highlight. Centred, filling about 70% of a 1024×1024 canvas. No background tile, no text, no shadow.
Transparent background PNG.
```

### 3. Heat-camera hand → `assets/hand.png`
Best result: upload a phone photo of **your own hand**, raised and open, palm to camera, fingers
slightly spread, in front of a plain wall. Then:
```
Turn the hand in this photo into a thermal-camera / infrared silhouette: a solid hand-and-forearm silhouette,
open palm facing the camera, fingers slightly spread, rising from the bottom edge of the frame (the forearm
continues off the bottom). No skin texture, no nails, no background detail. Fill it with a smooth heat
gradient that depends on thickness: the palm and wrist hottest (cream #FFF4D6), then yellow #FFB21E, then
orange #FF6A00, and the thin fingertips and the edges coolest (red #E2261A), with a soft warm glow just outside
the edge. Pure flat black background #000000. 4:3 landscape, 1440×1080, the hand centred horizontally
with the wrist at the bottom edge and fingertips about 35% from the top.
```
No photo? Use the same prompt without an upload and change the first line to: *"Create an anonymous
thermal-camera / infrared silhouette of a generic adult hand:"*.
