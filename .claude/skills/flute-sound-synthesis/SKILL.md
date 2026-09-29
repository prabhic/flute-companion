---
name: flute-sound-synthesis
description: Web Audio sound design for echo-flute-flow — a breathy, human-sounding bansuri voice (legato glides, kan, delayed vibrato, breath noise, humanised timing), a tanpura drone, and reverb. Use when changing how the companion sounds, adding ornaments to playback, or touching the drone or output graph.
---

# Flute sound synthesis

**Lens:** Julius O. Smith III (physical modelling of wind instruments at CCRMA) for what makes
a flute sound like a flute, and a tanpura maker's ear for the drone. The vision's hardest
constraint is **"no robotic playback"**. A sine beep per note is the robot. Breath, legato,
and imperfection are the human.

## Voice recipe (one continuous voice per phrase, not one oscillator per note)

```
osc(sine, f) ─┐
osc(sine, 2f)·0.12 ─┼→ voiceGain (envelope) → out
osc(sine, 3f)·0.04 ─┘
noise → bandpass(f·2, Q≈1) → breathGain (≈6% of envelope) → out
LFO 5.2 Hz → lfoGain (cents) → every osc.detune     // vibrato, delayed
out → dry + ConvolverNode(generated IR, ~2.4s) wet 0.22 → master
```

- **Legato by default.** The frequency moves with `setTargetAtTime(f, t, 0.012)`, which is
  quick but not instant. For a glide (meend), use
  `linearRampToValueAtTime(f, t + 0.14..0.25)`.
- **Articulation.** Between non-glide notes, dip the envelope to about 35% for ~40ms. This
  imitates a tongued or breath-pulsed re-attack. For glides, don't dip.
- **Kan.** Jump to the grace frequency at t, then return to the main frequency at t + 45ms.
- **Scoop.** Start each attack about 15¢ flat and settle within 60ms. Players do this.
- **Delayed vibrato.** Only on notes ≥ 0.6s: 0 cents until 0.35s into the note, then ramp
  to about 10¢. Constant vibrato sounds cheap.
- **Play the player's breath back.** Map `dyn` to peak gain over a wide range
  (0.12 → 0.7, which is about 15 dB). Louder is also brighter (2nd/3rd harmonic gains rise
  with `dyn`) and slightly sharper (+≈12¢ at full strength), just as with a real air jet.
  - `pulse`: re-attack with a deeper dip (to ~15%) and a quick push. The pitch doesn't move.
  - `accent`: overshoot to 1.5× for ~60ms, then settle.
  - `shape`: swell ramps 0.45× → 1.1× across the note; fade does the reverse.
  - `tremolo`: amplitude LFO at 5 Hz on a separate gain stage, depth from the note.
  - `shake`: pitch LFO depth in cents (andolan). `bend`: static detune in cents.
  - `air`: breath-noise gain 0.03 → 0.16.
- **Humanise.** Jitter timing by ±12ms and velocity by ±8%. Hold the last note of a phrase
  1.4× longer, then taper it with a long release (0.35s).
- **Tuning.** Use just ratios against Sa (see `bansuri-raga-teaching`). Output frequency =
  Sa × ratio × 2^octave.

## Tanpura drone

- Strings: Pa(mandra), Sa, Sa, Sa(kharaj). With base = Sa/2, that is `base·0.75, base, base, base·0.5`.
- One cycle ≈ 4.2s, with plucks spaced unevenly (0, 1.1, 2.0, 2.9s).
- Pluck: a sawtooth into a lowpass whose cutoff falls from 2.2 kHz to 500 Hz over 3s (a
  crude jawari shimmer), with an exponential decay of about 3.5s. Plucks overlap so the drone
  never goes silent.
- Keep the level low (≈0.05 peak per pluck). The drone is the floor, not a voice.
- Schedule with a look-ahead timer: `setInterval` 200ms, scheduling plucks that fall within
  the next 0.6s of `ctx.currentTime`. Never use `setTimeout` per note.

## Rules

1. Use **one AudioContext** for the whole app, shared with the mic. Don't create a new
   context per response. The old code did, and it leaked contexts.
2. **No clicks.** Every gain start and stop ramps. Stop oscillators after their release ends.
3. **Return the end time** from `playPhrase`, so the caller can gate the mic until
   `end + tail`.
4. **Reverb IR is generated, not fetched.** Use stereo noise × exp(−t/0.5) over 2.4s. No
   asset files needed.
5. Never randomise dynamics over the player's own. Jitter only fills in when `dyn` is
   absent.
6. Listen before you merge. Play a phrase, then ask: does it breathe? Does it glide? Would a
   flautist wince?

Code: `src/audio/voice.ts`.
