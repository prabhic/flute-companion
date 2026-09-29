# Real-playing fixtures

The breath and note thresholds in `src/audio/phrase.ts` were first tuned on synthetic
tones. These fixtures replace guesses with your actual bansuri.

## Record one

1. `npm run dev`, open `http://localhost:5180/?heard` (or press **H**).
2. Play **one** phrase that shows **one** technique, then rest.
3. In the "What I heard" panel, click **Save as fixture** and name what you played.
4. Open the downloaded JSON and fix `expect` so it says what you *actually* played.
   Only list what a listener could hear: `semi`, `glide`, `pulse`, `accent`,
   `shape` (`swell`/`fade`), `sway` (`tremolo`/`shake`).
5. Move the file here. `npm run check` now fails whenever the analysis disagrees with you.

A failing fixture is information, not a nuisance: fix the threshold, not the fixture.

## Suggested first set (15–20 phrases)

| # | Play | Tests |
|---|---|---|
| 1–2 | Sa Re Ga Pa Dha, clean, medium breath | swara naming, segmentation |
| 3–4 | Sa three times with pushes of breath (no tongue) | `pulse` |
| 5 | Same, but very gentle pushes | where pulse detection stops |
| 6 | Pa with a strong push that settles | `accent` |
| 7 | Long Ga that grows | `shape: swell` |
| 8 | Long Pa that dies away | `shape: fade` |
| 9 | Long Sa with breath tremolo | `sway: tremolo` |
| 10 | Bhairav's komal Re with andolan | `sway: shake` |
| 11–12 | Sa → Pa and Ga → Re with meend | `glide` |
| 13 | A soft, airy alap phrase | airy tone still detected |
| 14 | Loud and soft versions of the same phrase | `dyn` ordering |
| 15 | Mandra Pa to taar Sa | register edges |
| 16 | A fast taan | limits of segmentation |

Record in the room you usually practise in, with the mic you usually use.
