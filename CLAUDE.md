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
echoing, gently correcting into the raga, extending, answering, and progressively
introducing ornaments and raga phrases. No scores, no Western notation.

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

### Flow
```
mic → AnalyserNode → rms gate + yin() → frames {cents, db, air}
    → (silence 0.7s) segmentNotes() (pitch + breath expression per note) → matchRaga() histogram → composeResponse()
    → playPhrase() through one AudioContext (mic muted until reply + reverb tail)
```

### Files
```
src/music/swara.ts      sargam labels, just ratios, bansuri keys (pure)
src/music/ragas.ts      7 beginner ragas, matchRaga, histogram (pure)
src/music/companion.ts  composeResponse: echo/extend/answer/ornament/pakad (pure, seeded rng)
src/music/check.ts      runnable self-check for all pure code → `npm run check`
src/audio/pitch.ts      yin(), rms() (pure)
src/audio/phrase.ts     segmentNotes(): notes + meend + breath expression (pure)
src/audio/voice.ts      Web Audio: output bus + reverb, playPhrase(), startDrone()
src/hooks/useCompanion.ts  the listen → respond state machine (loop state in refs!)
src/components/Companion.tsx  the whole UI
```

### Rules
- Pure modules in `src/music` and `src/audio/{pitch,phrase}.ts` use relative `.ts` imports
  so `npm run check` runs them in Node without a bundler. Keep them free of DOM/Web Audio.
- Never read React state inside the rAF loop — use the `s` ref in `useCompanion`.
- One AudioContext for mic and output; create/resume it inside a click handler.
- `raga-server/` + `raga-models/` (Carnatic deep model) are **not wired in**: the model
  expects 5000-token tonic-normalised sequences from long recordings, not live phrases.

## Commands
- `npm run dev` (port 5180) · `npm run build` · `npm run lint` · `npm run check`
- Node + npm (not Bun). Mic requires localhost or HTTPS.
- TS is relaxed (`strict: false`); path alias `@/*` → `src/*`.
