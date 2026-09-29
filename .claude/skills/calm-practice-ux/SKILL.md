---
name: calm-practice-ux
description: Interface and interaction design for echo-flute-flow — an immersive, metric-free practice space built around one breathing focal point, sargam display, whispers instead of feedback panels, and graceful mic-permission flows. Use when changing layout, copy, visuals, settings, or onboarding.
---

# Calm practice UX

**Lens:** Amber Case and Mark Weiser on *calm technology* (the interface lives at the
periphery until it's needed), and thatgamecompany's *Journey* (emotion through light, sound,
and motion, with no HUD). The player's eyes are closed half the time. The screen should
reward a glance, never demand one.

## Principles → concrete rules

| Vision says | So the UI does |
|---|---|
| Companionship over instruction | One primary action ("Begin" / "Rest"). No dashboards and no side-by-side panels. |
| Immersion over metrics | No %, no confidence bars, no timers in the foreground, no accuracy gauges. |
| No Western notation | Current swara in Devanagari plus a romanised label. Never C/D/E, never a staff. |
| Alive, not robotic | One orb that breathes with your volume (warm saffron) and glows moonlight while the companion plays. |
| Theory emerges gradually | The raga name appears quietly, and only after it emerges. Settings hide raga choice behind "Wander in…". |

## Layout

- Full-height stage with night-raga colours: ink-indigo background, saffron for the player,
  moon-silver for the companion.
- Center: the orb, 240–320px, with the current swara inside it.
- Below the orb: the dialogue ribbon. The last phrase you played and the reply, as sargam
  syllables, in two colours. This is ear training by glance, not notation.
- Below that: the whisper, one line that fades in with each exchange.
- Top: a small wordmark on the left. The raga story appears on the right once revealed.
- Bottom: Begin/Rest, drone toggle, and settings (a sheet with the bansuri key, "Tune my Sa",
  and "Wander in…").
- Must work at 375px width. The orb shrinks and the controls stay thumb-reachable.

## Showing breath without measuring it

- Sargam syllables in the ribbon carry the breath: size and weight follow `dyn`, a
  pulse-repeated swara appears again as its own syllable, an accent gets a small mark above
  it, and a swell or fade gets a thin hairpin under it. Tremolo and andolan use a wavy
  underline.
- The orb already breathes with live loudness. Nothing numeric is ever shown.

## First run and hidden tools

- The first session (or a new bansuri key) opens with "give me your Sa". A saffron ring
  fills as the hold steadies, and no swaras are named until Sa is known.
- `?heard` or the **H** key opens "What I heard": the numeric analysis plus "Save as
  fixture". It's a developer and tuning tool, and never part of normal practice.
- Memory is disclosed plainly in settings, with "Forget our history".

## Permission and failure

- Ask for the mic only on "Begin" (a user gesture). On denial, show one sentence on how to
  allow it, not a troubleshooting wall.
- If no sound comes in for 8s after Begin, whisper: "I can't hear you yet — is the right
  mic selected?"
- Recommend headphones once, quietly, next to the drone toggle.

## Motion

- Orb scale follows a smoothed level (CSS transform, 120ms transition), never a jittery
  per-frame change.
- Colour transitions take 600ms. Nothing flashes. `prefers-reduced-motion` disables the
  breathing loop.

## Copy voice

A gentle friend who plays better than you. Use "Begin", "Rest", "I'm listening", "Your turn",
"Tune my Sa", "Wander in Bhupali". Never use "Start session", "Score", "Try again", "Error",
or "Force response".

## Accessibility basics (never skipped)

- Real `<button>`s with labels. The orb state is mirrored in an `aria-live="polite"` region.
- Contrast ≥ 4.5:1 for all text on the ink background.

Code: `src/components/Companion.tsx`, `src/index.css`.

## Validation status (update whenever real evidence arrives)

A skill is a hypothesis until it's checked against real playing or a real expert.
Record what it has been checked against, so no one mistakes a guess for a fact.

| Claim | Checked against | Status |
|---|---|---|
| Desktop and 375px layouts | Screenshots | Checked |
| Calm, un-gamified feel | Not tested with a player | Unvalidated |
| iOS/Safari mic + worklet | — | **Untested** |
