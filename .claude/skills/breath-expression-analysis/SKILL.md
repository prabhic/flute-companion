---
name: breath-expression-analysis
description: Hearing HOW a bansuri note is played, not just which note — breath strength (dynamics), breath-pulse re-articulation of the same note, accents, swells and fades, breath tremolo vs pitch shake (andolan/gamak), airy vs clear tone, and lip/angle pitch shading. Use when touching loudness, onsets, note splitting, the Note expression fields, or anything that should respond to the player's breath in echo-flute-flow.
---

# Breath expression analysis

**Lens:** Neville Fletcher and Joe Wolfe (the acoustics of air-jet instruments: how blowing
pressure and lip coverage shape a flute's sound), and Preeti Rao and Xavier Serra's
CompMusic work on the computational analysis of Indian art music (expression lives
*between* the notes, in the breath and the inflection). On a bansuri there is no key and no
bow. **The mouth is the instrument.** Two players can play the same Sa and say completely
different things.

## What a bansuri player controls with breath and mouth

| Technique | What you hear | What it does acoustically | Field on `Note` |
|---|---|---|---|
| Strength (soft ↔ full) | quiet, veiled ↔ bold, ringing | more pressure → louder, brighter, and a few cents **sharper** | `dyn` 0..1 |
| Breath pulse | same swara restarted with a push of air (no tonguing) | level dips ≥ 6 dB then rises ≥ 4 dB, pitch unchanged | a separate note with `pulse: true` |
| Accent / push | sharp, strong start that settles | attack peak ≫ sustain in the first ~120ms | `accent: true` |
| Swell / fade | note grows (crescendo) or dies away | level slope ≥ +8 / ≤ −8 dB/s over the note | `shape: 'swell' \| 'fade'` |
| Breath tremolo | pulsing loudness on one note | amplitude modulation 3–8 Hz, ≥ 1.5 dB deep, pitch steady | `tremolo` (dB depth) |
| Andolan / gamak | the pitch itself sways | cents oscillation 1–8 Hz, ≥ 15¢ deep | `shake` (¢ depth) |
| Airy vs clear tone | breathy "hawa" sound vs focused tone | aperiodicity (YIN's minimum d′) rises with breath noise | `air` 0..1 |
| Shading (lip / angle) | a swara pitched slightly low or high on purpose | median offset from the swara's centre | `bend` (¢) |

The **same pitch played with different strength is different music**. Anything that merges,
ignores, or randomises these is flattening the player's voice.

## Detection rules

1. **Every frame carries `db` and `air`, not just `cents`.** Keep loudness in dB (20·log10 rms)
   so a pulse is the same shape whether the mic is near or far.
2. **Normalise dynamics to the player, not to the mic.** Map dB into 0..1 against a slowly
   decaying session peak (30 dB range). The phrase-local max alone would make every phrase
   "full strength".
3. **Split a same-pitch run on a breath pulse.** Inside a stable-pitch run, a dip of ≥ 6 dB
   below the running peak, followed by a rise back of ≥ 4 dB within 250ms, starts a new
   note. Mark it `pulse: true`. The depth is what separates a pulse from breath tremolo,
   which sways ≤ ±3 dB. A shallower threshold chops a tremolo into fake pulses (a test
   guards this).
4. **Merge same-swara fragments only across a real dropout gap where loudness stayed within 3 dB.** A pitch dropout at
   constant loudness is a detector glitch. A dip in loudness is the player speaking.
5. **Don't let breath hide the pitch.** Airy tone often keeps YIN's d′ above 0.15. Use YIN's
   fallback (the global minimum) and accept clarity ≥ 0.6. Pure noise stays well below that.
6. **Pressure pulls pitch.** A hard-blown note sits 10–25¢ sharp. That is still the same
   swara: keep the ±60¢ note tolerance. `bend` is reported but never re-quantises the swara.
7. **Tremolo vs shake.** Count oscillations on the detrended series (dB for tremolo, cents
   for shake). Require ≥ 2 full cycles, and a rate in range, before claiming either. When
   both are present, the stronger relative one wins.

## Tests (in `src/music/check.ts`)

- Three pulses on Sa at the same pitch give three notes, the 2nd and 3rd with `pulse`.
- A soft note followed by a strong note: `dyn` ordering is preserved.
- A rising level gives `swell`. A 5 Hz ±3 dB loudness wobble gives `tremolo`. A ±30¢ sway
  gives `shake` and not tremolo.
- Breathy YIN input (tone + heavy noise) still returns the pitch.

## Don'ts

- Don't show dB, "power", or strength bars. Expression is mirrored in sound and in the
  size/weight of the sargam syllables, never scored (see `calm-practice-ux`).
- Don't treat a loud note as "better". Soft playing is a choice, often the more beautiful one.

Code: `src/audio/phrase.ts` (analysis), `src/audio/pitch.ts` (breathy YIN),
`src/hooks/useCompanion.ts` (frames, dynamic reference).

## Validation status (update whenever real evidence arrives)

A skill is a hypothesis until it's checked against real playing or a real expert.
Record what it has been checked against, so no one mistakes a guess for a fact.

| Claim | Checked against | Status |
|---|---|---|
| Pulse = ≥ 6 dB dip + ≥ 4 dB rise | Synthetic envelopes, chosen to separate pulse from ±3 dB tremolo | **Guess.** Measure gentle real pushes (fixture #5) |
| Accent, swell/fade, tremolo, andolan thresholds | Synthetic envelopes | **Guesses** |
| Airy tone detected (clarity ≥ 0.6) | Sine + heavy noise | Plausible; real airy alap untested |
| Pressure pulls pitch 10–25¢ sharp | Acoustics literature | Not measured on this player's flute |

The player reported the original gap (breath strength ignored) from real playing within minutes.
Synthetic tests never caught it. Real fixtures are the priority.
