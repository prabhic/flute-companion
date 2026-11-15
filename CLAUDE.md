# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Commands
- `npm run dev` - Start development server on port 5180 with hot reload
- `npm run build` - Build for production
- `npm run build:dev` - Build in development mode
- `npm run lint` - Run ESLint to check code quality
- `npm run preview` - Preview production build locally

### Environment Setup
- Uses **Node.js with npm** for package management (not Bun, despite bun.lockb presence)
- Development server runs on `localhost:5180` with IPv6 support (`::`)
- Microphone access requires localhost or HTTPS for browser security

## Architecture Overview

A **bansuri companion** (see `VISION.md`): it listens to a phrase, then plays it back —
echoing in the player's **own recorded sound** (only corrected notes are pitch-shifted),
extending, answering, and progressively introducing ornaments. Once a raga is known it also
**leads**: offers a phrase, recognises when it's caught, replays it after a miss. It remembers
the player across sessions (localStorage, never scores). No Western notation.

### Expert skills (load before working in that area)
`.claude/skills/` holds six project skills — use them:
- `bansuri-raga-teaching` — raga data, sargam, just intonation, ornaments, pedagogy
- `realtime-pitch-dsp` — YIN, phrase gating, segmentation, mic/feedback rules
- `breath-expression-analysis` — HOW a note is blown: strength, breath pulses, accent, swell/fade,
  tremolo vs andolan, airy tone, lip shading. On bansuri the mouth is the instrument — never
  drop loudness or merge same-swara notes without checking this skill.
- `flute-sound-synthesis` — breathy voice, meend/kan playback, tanpura, reverb
- `musical-companion-dialogue` — response moves, raga emergence, whispers
- `calm-practice-ux` — orb-centred, metric-free UI and copy
- `rhythm-companion` — beat mode: stroke onsets (tabla, table, anything), grid/cycle inference,
  tabla replies (echo/fill/roll/answer/tihai) that land on the player's own sam

### Flow
```
mic → capture worklet (audio thread, 2048/1024 hop, audio-clock time)
    → rms + yin() → flute-range gate (≥ −700¢; drone can't trigger) → frames {cents, db, air}
    → phrase recorded + (silence 0.7s) segmentNotes() (pitch + breath expression, note `at`)
    → matchRaga() → composeResponse() (echo/extend/answer/ornament/pakad/breath/lead)
    → playOwnVoice() for mirrored notes + playPhrase() synth for the rest
      (mic muted until reply + reverb tail; Rest fades out and clears timers)
```

### Files
```
src/music/swara.ts      sargam labels, just ratios, bansuri keys (pure)
src/music/ragas.ts      7 beginner ragas, matchRaga, histogram (pure)
src/music/companion.ts  composeResponse: echo/extend/answer/ornament/pakad (pure, seeded rng)
src/music/rhythm.ts     beat mode: toBeat (grid + cycle), respondBeat, nextSam (pure)
src/music/check.ts      runnable self-check for all pure code → `npm run check`
src/audio/pitch.ts      yin(), rms() (pure)
src/audio/phrase.ts     segmentNotes(): notes + meend + breath expression (pure)
src/audio/onset.ts      detectOnsets(): stroke onsets + low/high class (pure)
src/audio/voice.ts      Web Audio: output bus + reverb, playPhrase(), playOwnVoice(), playBeat(), startDrone()
public/capture.worklet.js  audio-thread capture (served as a file: worklets can't load data: URLs)
src/components/HeardPanel.tsx  hidden "What I heard" view (?heard or H) + fixture export
fixtures/               real-playing fixtures; npm run check fails if analysis disagrees
src/hooks/useCompanion.ts  the listen → respond state machine (loop state in refs!)
src/components/Companion.tsx  the whole UI
```

### Rules
- Pure modules in `src/music` and `src/audio/{pitch,phrase,onset}.ts` use relative `.ts` imports
  so `npm run check` runs them in Node without a bundler. Keep them free of DOM/Web Audio.
- Analysis runs in `onWindow` (called by the worklet), never a rAF loop. Its state lives in
  the `s` ref in `useCompanion`, never React state.
- **Thresholds are tuned against `fixtures/`, not synthetic tests.** Each skill has a
  "Validation status" table: update it when real evidence arrives, and don't present a guess
  as fact.
- One AudioContext for mic and output; create/resume it inside a click handler.
- `raga-server/` + `raga-models/` (Carnatic deep model) are **not wired in**: the model
  expects 5000-token tonic-normalised sequences from long recordings, not live phrases.

## Commands
- `npm run dev` (port 5180) · `npm run build` · `npm run lint` · `npm run check`
- Node + npm (not Bun). Mic requires localhost or HTTPS.
- TS is relaxed (`strict: false`); path alias `@/*` → `src/*`.

## Not done yet (from the review)
- **Tala**: beat mode is call-and-response only (Drum button). No theka under the flute, no
  playing *along* while you play (needs echo cancellation), low/high split untested on real strokes.
- **Authentic dhuns**: lead phrases come from pakad fragments and scale walks; real tunes
  need a bansuri teacher's input, not invention.
- **Pitch correction without time change** (PSOLA / phase vocoder) for own-voice echoes.
- **Hearing while the companion plays** (turn-taking is strict; needs echo cancellation).
- Never tested on a real bansuri, iOS/Safari, or listened to by a musician.

## Remembered practice path

`src/music/practice.ts` now owns **Learn together** (the default): two free echoes, a short
Sa-relative offer, two recognized imitations on separate offers before advancing. Missed
phrases replay more slowly, then give way to free play without advancing. Per-raga progress
is validated and persisted in journey memory. Discover together moves through existing
ragas; an explicitly chosen raga stays selected. These are note-familiarity exercises, not
claims of complete raga grammar or mastery.

**Echo me** preserves the entire phrase; **Vary a little** changes one note. Both override
random dialogue moves. **You lead**, replay, and slower synthesized replay do not count as
learning attempts. `restAfter` preserves breath gaps in synthesized replies; synthesis
returns actual note start times to synchronize the ribbon.

Run `npm run typecheck`, `npm run check`, `npm run lint`, and `npm run build`. With the dev
server running, `npm run check:browser` checks a synthetic microphone through the real
AudioWorklet (requires Playwright Chromium or CHROME_PATH). No real flute has been validated.
