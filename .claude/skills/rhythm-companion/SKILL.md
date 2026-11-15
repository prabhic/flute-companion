---
name: rhythm-companion
description: Beat mode for echo-flute-flow — hearing strokes played on a tabla, a table, or any surface (onset detection, bass/treble class), inferring the grid and cycle, and answering as a tabla friend would (echo, fill, roll, answer, tihai) in time with the player. Use when touching src/audio/onset.ts, src/music/rhythm.ts, playBeat(), or beat-mode flow.
---

# Rhythm companion

**Lens:** the tabla tradition of sawal-jawab between percussionists (and between tabla and
melody), and Simon Dixon's onset/IOI work for beat tracking from sparse strokes. The player
may be on a real tabla, palms on a desk, or fingers on a box: **never assume pitch, only
when and how deep a stroke is**.

## Pipeline

```
capture worklet window (newest 1024 samples)
  → 128-sample blocks (~2.7ms) → rms jump over a decaying envelope → onset
  → next window: classify 1024 samples after the onset
       bass share (one-pole low-pass ~300Hz) > 0.5 → low (bayan / thump), else high (dayan / tap)
       rms → db
  → hits {t, db, low}  (audio-clock time)
  → silence > clamp(2 × longest gap, 0.8s, 1.6s), or 8s of unbroken playing → toBeat(hits)
  → respondBeat(beat) → playBeat() starting on the player's own next cycle boundary
```

## Rules

1. **Strokes, not pitch.** A hit is time + depth (low/high) + loudness. Tabla bols are only
   a name for that pair: low+high accent = Dha, low = Ge, high accent = Na, high = Ta,
   soft high = ti. No Western note values on screen.
2. **Hands drift and bounce — never demand a perfect fit.** Try steps from each gap ÷ 1–4
   (90–600ms); refine each by least squares over the hits near its lines. Score by timing
   error *as a share of the step* (in seconds a finer grid always wins); the lowest cost wins,
   near-ties go to the coarser grid. Hits off the chosen grid are dropped as ghosts. Demanding
   every hit fit made real playing get no reply at all.
3. **Cycle.** The shortest period that repeats as well as any period (a missing/extra stroke
   counts 1, deep-vs-bright 0.5, at most 20% differing). Exact matching missed real repeats
   and produced 24-step "cycles". With no repeat: the phrase length, rounded up to a multiple
   of 4 unless already a multiple of 3 or 4 (dadra 6, keherwa 8, teental 16 survive).
4. **Land in time, promptly.** The reply starts on the player's next sam if the cycle is
   ≤ 1.5s; otherwise on their next beat (4 or 3 steps), so a long cycle never means a long
   silence. Never at a fixed delay.
5. **Turn-taking is strict** (same as the flute): mic gated while the reply plays + tail,
   and the onset detector is reset after the gate.
6. **Moves grow with trust.** echo (first 2) → fill (soft ti in gaps) → roll/answer →
   tihai (a fragment three times, the last stroke landing on sam) from exchange 5.
   Whispers name what was played, never grade it.
7. **The dayan is tuned to Sa** (lifted into 280–560Hz), so the tabla sits with the drone.

## Validation status (update whenever real evidence arrives)

| Claim | Checked against | Status |
|---|---|---|
| Onset timing within one block | Synthetic decaying clicks in `npm run check` | Passes; real taps untested |
| Low/high split at 0.5 bass share | Synthetic 90Hz vs 900Hz bursts | **Guess** — tune on real desk thumps, tabla bayan/dayan |
| Onset jump ×2, floor ×4, 70ms refractory | Synthetic only | **Guess** — fast tabla rolls (tirakita) may merge |
| Grid inference with drift + a bounce | 300 synthetic players, 8-step theka at 220ms | ±15ms 0 wrong, ±25ms 2, ±40ms 12; never silent. Real players untested |
| First version demanded a perfect grid | The user's real beats (2026-10-07) | **Failed**: mostly no reply, or a long wait. Fixed by rules 2–4 |
| Reply lands on the player's sam | By construction | Never heard by a tabla player |

Real-playing fixtures for beats: **0**.
