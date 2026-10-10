# Writing the film

Words come first. The picture is built line by line from the script, and every line is one plate.

## The shape (four acts, about 48 s)

| act | length | lines | job |
|---|---|---|---|
| 1 Invocation | 7–9 s | 3 | Address the hero in second person, sincerely, like a luxury ad. Three parallel lines ("You are the…", "You are the…", "You put the…"). Over product macros |
| 2 Litany | 22–26 s | 14–18 | The story (or the list) as short, concrete beats, one per plate. Start at about 2–2.5 s per line, accelerate to 0.8–1.1 s. The momentum is in the pile-up and the pictures |
| 3 Reveal | 10–12 s | 3 | The product's name; the title on screen; the maker's credit. Slow again |
| 4 Coda | 3 s | 1 | One quiet line on black that lands the film: a fact, a turn, a last word. Silence underneath |

## Line rules

- **Short.** Litany lines are 2–7 words. A caption is at most two lines of about 26 characters.
- **Concrete nouns and numbers.** "An old tannery in Golden." beats "a new beginning". Dates are said in full
  ("Eighteen seventy-three.") and captioned as numerals.
- **Fragments are fine.** "Bricklayer. Stonecutter." is one line. Periods everywhere; they set the whisper's
  rhythm.
- **One idea per line, one picture per idea.** If you can't name the photo for a line, cut the line.
- **Escalate.** The litany gets faster and denser toward its end, then lands on one line that holds.
- **Facts are facts.** In a history film, every litany line must be checkable. Keep a `facts.md` with a source
  for each claim and run the fact-check reviewer on the script before recording.
- **The coda lands it.** One plain sentence, said softly: where it stands today, what lasted, a last fact.
  Sincere, never a punchline at the subject's expense.

## Picking the photo for a line

For each line, write the plate in the beat sheet before sourcing:

```
| # | t | line | plate (who / what, expression) | glue prop | enters from | old plate goes to |
```

- Expression first: shocked, proud, laughing, crying, determined. The caption names the moment; the face
  makes you feel it.
- Real archival photos of the real people for the historical beats; period stock or ad people for the
  reactions; one **glue prop** every three or four plates where it makes a point visible (a keg on a
  shoulder, a bottle in a hand).
- Alternate scale: a close face, then a group, then a waist-up figure.
- Plan one or two portals: anything with a hole (binoculars, a keyhole, a mouth, a bottle neck, a barrel bung,
  a porthole, a monocle, a pocket watch).

## Speaking it

`tools/vo.py` whispers each line with a pause after it. Typical pauses: 0.5–0.8 s in the invocation, 0.25–0.4 s
in the litany shrinking toward 0.15 s at the end, 1.0 s before the reveal, 1.5–2.5 s of silence before the
coda. Use `say` to steer pronunciation ("Coors" -> "Coors", "1873" -> "Eighteen seventy-three"). Then run
the ASR check (`tools/asr.py`) and fix any line that comes back wrong by changing `say`, `speed` (slower) or
`voiced` (more voice, e.g. 0.2).
