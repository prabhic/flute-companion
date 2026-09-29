---
name: realtime-pitch-dsp
description: Real-time browser audio analysis for echo-flute-flow — YIN pitch detection, Sa-relative cents, note segmentation, meend detection, adaptive phrase gating, and keeping the companion from hearing itself. Use when touching mic input, pitch/phrase detection, thresholds, or the rAF analysis loop.
---

# Real-time pitch DSP

**Lens:** Alain de Cheveigné (author of YIN) for pitch, and Miller Puckette (Pd, `sigmund~`)
for "real-time first, and every frame has a budget". Bansuri is close to a pure tone with
strong breath noise. The hard parts are octave errors, breathy onsets, and feedback from the
app's own speaker.

## Pipeline (one rAF tick, ≈16ms budget, target < 3ms)

```
mic → AnalyserNode (fftSize 2048, smoothing 0) → getFloatTimeDomainData
    → rms → dB → adaptive gate ─┐
    → yin(buf, sr) → hz, clarity → cents rel. Sa → frame {t, cents|null, db, air}
                           └→ phrase buffer → on silence: segmentNotes(frames) → notes[]
```

## Rules

1. **Use YIN, not raw autocorrelation or AMDF peak-picking.** Use the cumulative mean
   normalised difference, an absolute threshold of about 0.15, a descent to the local minimum,
   and parabolic interpolation. Limit tau to the bansuri range (≈120–2400 Hz). Doing this
   removes most octave errors.
2. **Keep pure functions separate from the audio graph.** `yin`, `rms`, and `segmentNotes`
   take arrays and numbers and return data, with no Web Audio inside them. This lets
   `npm run check` test them with synthetic sines in Node.
3. **Capture on the audio thread, not the screen loop.** `public/capture.worklet.js` posts a
   2048-sample window every 1024 samples, stamped with audio-clock time. A rAF loop stops
   when the tab is hidden, and it counts screen frames (which made tuning twice as fast on
   120 Hz displays). Keep the analysis state machine in refs, never React state: the original
   app's stale `isPlayingPhrase` closure broke auto-responses. Push UI updates every 2 frames.
   The worklet is served from `public/` because Vite inlines small `?url` assets as `data:`
   URLs, which not every browser accepts for worklet modules.
4. **Use an adaptive gate, not fixed thresholds.** Track a noise floor with a slow EMA while
   the player is not playing. Set on = max(0.015, floor × 3) and off = on × 0.6. The
   hysteresis stops the gate from chattering. The drone and room noise then raise the floor
   automatically.
5. **The companion must not hear itself.** Ignore the mic from the start of a response until
   the reverb tail has faded (response end + ~0.8s). Re-learn the noise floor afterwards.
   Recommend headphones in the UI, but don't depend on them.
6. **Turn off browser DSP on the mic.** Set `echoCancellation`, `noiseSuppression`, and
   `autoGainControl` all to `false`. They smear a flute's pitch and dynamics.
7. **Use one AudioContext.** Put input and output on the same context. Resume it inside the
   click handler, because iOS and Safari require a user gesture.

## Loudness is data, not just a gate

The first version used rms only to decide "playing or not" and threw it away. On a bansuri,
**loudness is half the music** (see `breath-expression-analysis`). Every frame keeps `db`
and `air` (1 − clarity), including frames whose pitch is unvoiced.

## Note segmentation

Frames carry Sa-relative cents or `null` (unvoiced). A note is a run of frames within ±60¢
of the run's median, lasting ≥ 70ms. Its swara = round(median / 100).
- Frames between two notes that move monotonically for ≥ 60ms across ≥ 150¢ mean the second
  note gets `glide: true` (meend).
- Drop notes shorter than 70ms. They are usually breath onsets or kan. Detecting kan is an
  upgrade path.
- Split a same-pitch run on a breath pulse (a dB dip then a rise). Merge same-swara
  fragments only when loudness stayed up: that was a detector dropout, not the player.
- YIN on breathy tone: fall back to the global d′ minimum and accept clarity ≥ 0.6.

## The flute-range gate

A phrase starts only on loud **and** flute-range pitch (≥ −700¢, just under mandra Pa).
Every tanpura string sits at or below −1200¢, so a drone playing through speakers can never
start a phrase. Silence is judged the same way, so the drone can't hold a phrase open either.

## Tonic

The player's Sa is the ground truth, octave included. A first session, or a new key choice,
opens with "give me your Sa". Take the median Hz over 1.5s of *audio time*. If the pitch
moves more than 40¢ from the running median, start the hold over. Tune on raw pitch (the old
Sa may be an octave off), then ignore input until the held Sa ends, so it isn't answered as a
phrase.

## Testing

Synthesise: `sin(2π f t)` + 0.3·`sin(2π 2f t)` + a little noise at 48 kHz, 2048 samples.
Check that YIN returns f within ±5¢ for f in {196, 330, 440, 880, 1760}. Feed segmentNotes a
hand-built cents sequence (Sa, glide, Pa) and check that you get 2 notes and the second has
`glide`. Keep these checks in `src/music/check.ts`.

## Pitfalls seen in this repo

- The AMDF loop in the old `usePitchDetector` ran O(N·τ) with 1900 lags. Keep τ bounded.
- Sending raw pitch-class lists to a model trained on 5000-token tonic-normalised sequences
  gives meaningless output. A model is only valid if its input features match its training
  features.

Code: `src/audio/pitch.ts`, `src/audio/phrase.ts`, `src/hooks/useCompanion.ts`.

## Validation status (update whenever real evidence arrives)

A skill is a hypothesis until it's checked against real playing or a real expert.
Record what it has been checked against, so no one mistakes a guess for a fact.

| Claim | Checked against | Status |
|---|---|---|
| YIN accuracy (±5¢) | Synthetic two-harmonic tones | Passes; real bansuri untested |
| Note segmentation, meend | Hand-built cents sequences | Passes; real bansuri untested |
| Drone can't trigger phrases | 8s of loud synthetic sawtooth plucks in the browser | Passes; real speakers untested |
| Worklet keeps listening when hidden | By design, not measured | Untested on iOS/Safari |

Real-playing fixtures in `fixtures/`: **0**. Add them before tuning any threshold (`fixtures/README.md`).
