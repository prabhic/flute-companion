---
name: bansuri-raga-teaching
description: Hindustani bansuri pedagogy and raga grammar for this app — sargam, Sa-relative tuning, raga note sets, time/mood, ornaments (meend, kan, andolan, murki), and the oral guru-shishya way of teaching. Use when adding or editing ragas, swara naming, ornament logic, teaching copy, or anything that claims musical authority in echo-flute-flow.
---

# Bansuri raga teaching

**Lens:** think like Pt. Hariprasad Chaurasia teaching a shishya in the gurukul, or like
Pannalal Ghosh, who brought the bansuri into the classical concert world: teaching happens
by *playing a phrase and letting it be played back*, not by explaining. Your job is to keep
every musical fact in the app correct, and to sequence beauty so it arrives naturally.

## Non-negotiables

1. **Everything is relative to Sa.** There are no absolute notes. A bansuri is named by its
   Sa (an "E bansuri" plays Sa ≈ E). Never show C/D/E note names to the player. Show
   sargam: Sa Re Ga Ma Pa Dha Ni (सा रे ग म प ध नि).
2. **Komal / tivra spelling.** Semitones from Sa:
   `0 Sa · 1 komal Re · 2 Re · 3 komal Ga · 4 Ga · 5 Ma · 6 tivra Ma · 7 Pa · 8 komal Dha · 9 Dha · 10 komal Ni · 11 Ni`.
   Register: mandra (below Sa, dot below), madhya, taar (dot above).
3. **Just intonation when *sounding* notes.** Against a tanpura, 12-TET thirds sound sour.
   Ratios: 1, 16/15, 9/8, 6/5, 5/4, 4/3, 45/32, 3/2, 8/5, 5/3, 9/5, 15/8.
   For *detection*, rounding to the nearest semitone (±50¢) is fine.
4. **A raga is not a scale.** Scale = note set. Raga = note set + movement (aroha/avaroha),
   important notes (vadi/samvadi), signature phrases (pakad), ornaments, time, and mood.
   When the code only models the note set, say so in a `ponytail:` comment. Don't claim more.
5. **Never invent raga facts.** If unsure about a vadi or pakad, leave it out.

## Beginner raga ladder (all distinguishable by note set)

| Raga | Semitones | Time | Feel | Why it's here |
|---|---|---|---|---|
| Bhupali | 0 2 4 7 9 | evening | serene, devotional | Pentatonic, no half-steps. Everything sounds right. First raga. |
| Durga | 0 2 5 7 9 | night | bright, joyful | One note different from Bhupali (Ma for Ga). Teaches that one swara changes the colour. |
| Yaman | 0 2 4 6 7 9 11 | evening | romantic, prayerful | First tivra Ma. The classic first "full" raga. |
| Kafi | 0 2 3 5 7 9 10 | night / spring | playful, folk | Komal Ga and Ni. Holi songs live here. |
| Malkauns | 0 3 5 8 10 | late night | deep, meditative | Pentatonic but all komal. A sudden gravity. |
| Bhairav | 0 1 4 5 7 8 11 | dawn | grave, devotional | Andolan on komal Re and Dha. Introduce late. |
| Bhairavi | 0 1 3 5 7 8 10 | morning / closing | tender, devotional | All komal. Traditionally sung last. |

Kafi and Bhimpalasi share one note set, so a histogram cannot tell them apart. Don't add both.
Carnatic cousins: Bhupali ≈ Mohanam, Yaman ≈ Kalyani, Durga ≈ Shuddha Saveri, Malkauns ≈ Hindolam.

## Ornaments (introduce one at a time, by example, never by name first)

- **Meend** — a continuous glide between two swaras. On bansuri it comes from slowly
  uncovering or covering holes. In code: frames that move steadily across ≥150¢ for ≥60ms
  between two stable notes.
- **Kan** — a grace note touched for 30–60ms before the main note, usually the upper neighbour
  in the raga.
- **Andolan** — a slow oscillation (±20–30¢, ~1–2 Hz) on one note. Belongs to Bhairav's
  komal Re and Dha. Do not put it on Sa or Pa.
- **Murki** — a quick 3–4 note turn. Advanced; last to arrive.
- **Vibrato** is not a classical bansuri ornament in the Western sense. Keep any synth
  vibrato subtle and delayed.

## Breath is part of the music (the mouth is the instrument)

A bansuri has no keys and no tonguing tradition like the Western flute. Expression comes from
the breath and the lips:
- **Strength.** The same Sa, soft or full, carries a different mood. Soft often means
  devotion and inwardness; full means declaration. Neither is "correct".
- **Breath pulses.** Hindustani flautists re-articulate a repeated swara with a push of air,
  not the tongue. "Sa Sa Sa" in three breaths is three notes, and the rhythm lives in those
  pushes.
- **Swell and fade.** A long note that grows (or dies away) is a phrase in itself. Players
  often let the resting note of a phrase fade.
- **Shading with the lips.** Covering more of the blow-hole, or rolling the flute inward,
  lowers the pitch slightly. This is how players shade komal swaras (e.g. Bhairav's Re) and
  approach a note from below.
- **Airy tone.** A breathier sound is a colour choice, common in slow alap.
- **Oscillations.** A breath tremolo (loudness sways) is not the same as andolan or gamak
  (pitch sways). Name each correctly.

The companion should **mirror these first, then teach them**: echo the player's
strength and pulses faithfully, and later demonstrate a swell or a fade the player hasn't
tried yet. Detection details: `breath-expression-analysis`.

## Pedagogy rules (from the gurukul)

- **Imitate first, then vary.** Early exchanges should mostly be echoes. Variation and
  new material grow with trust (exchange count).
- **Sa and Pa are home.** Phrases resolve to Sa (or Pa, or the vadi). An answer that ends
  mid-air feels like a question, which is useful on purpose.
- **Name things after they are felt.** Reveal a raga's name only after the player has been
  living in its notes for a few phrases. Reveal it as a story (time of day, mood), never as
  a verdict.
- **Correction is by example.** If the player plays a note outside the raga, the companion
  plays the phrase back with the right note. No text says "wrong".

## Checklist before merging musical changes

- [ ] Semitone sets checked against the table above
- [ ] Anything the player sees uses sargam, not Western names
- [ ] Synth uses just ratios relative to Sa
- [ ] Copy says "wander", "feel", "home" — never "score", "accuracy", "wrong"
- [ ] Unmodelled raga grammar has a `ponytail:` note
- [ ] Breath expression (strength, pulses, swells) survives from input to reply

Code: `src/music/swara.ts`, `src/music/ragas.ts`, `src/music/companion.ts`.
