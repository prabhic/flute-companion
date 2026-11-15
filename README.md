# Echo Flute Flow

A bansuri friend: play a short phrase, pause, listen to its answer, and play again.
Learning happens by ear, through a musical conversation, without scores or sheet music.

## Play

```sh
npm ci
npm run dev
```

Open http://localhost:5180 (microphone access needs localhost or HTTPS). Choose **Begin**,
allow your microphone, and hold your Sa until the companion finds your tuning. Let it
rest, then play a short phrase. A pause of about a breath ends your turn.

- **Echo me** returns your notes, timing and breath. By default it uses your own recording.
- **Vary a little** keeps your phrase and changes one note. Listen for the little turn.
- **Learn together** begins by echoing you, then offers small phrases to repeat. It revisits
  each phrase before adding another note. If a phrase isn't heard back, it slows down;
  after a few attempts it returns to free play and revisits the same material later.
- **You lead** asks for the current practice phrase; **Play it again** repeats the last reply.
  **Again, slower** plays it on the companion's synthesized flute without lowering pitch.
- **Rest** ends the exchange, fades playback and the drone, and releases the microphone.

In Learn together, **Discover together** starts with Bhupali and gradually explores the
existing raga collection. Choosing a particular raga keeps practice there. Phrase familiarity,
Sa, and settings are remembered on this device. Settings includes **Forget our history**.
Audio recordings are temporary in-memory buffers, never uploaded or saved to localStorage.
Headphones help, especially with the optional tanpura. The Drum control retains the separate
rhythm call-and-response mode.

## How it works

`AudioWorklet → YIN pitch / breath analysis → phrase segmentation → musical response → Web Audio`

The microphone is gated during the reply and its tail so the companion does not answer
itself. `src/music/practice.ts` owns the remembered note-by-note practice path; only a
recognized imitation advances it. Matching checks pitch-class order and relative note
lengths, allowing a slower tempo and octave slips. `src/music/companion.ts` owns mirroring,
small variations and freer musical answers. The hook coordinates microphone, memory and turns.

## Verify

Use Node 22.6+ for the pure TypeScript checks.

```sh
npm run check
npm run typecheck
npm run lint
npm run build
```

For browser regression checks, start the dev server, then:

```sh
npx playwright install chromium
npm run check:browser
```

Alternatively set `CHROME_PATH` to an installed Chrome executable. `APP_URL` overrides the
local test URL. The browser checks supply synthetic microphone audio through a real Web Audio
graph and capture worklet: tuning, echo, replay, slower playback, learning, persistence,
permission cancellation/recovery, Rest, and mobile overflow. They never request a real mic.

For real-playing evidence, open `/?heard` and follow [fixtures/README.md](fixtures/README.md).

## Current limits

This is a **turn-taking duet**, not simultaneous listening and accompaniment. Full duplex
playing needs echo cancellation designed for music. Raga exercises currently model note sets
and short fragments of the existing pakad data, not full raga grammar or mastery. That data
and the teaching sequence still need a bansuri teacher's review. Imitation tolerances and DSP
thresholds have synthetic coverage; there are no real bansuri fixtures yet. Safari/iOS and
musical sound quality still need hands-on validation. Own-recording pitch changes also change
duration slightly; slower replay uses synthesis to avoid that pitch/time coupling.
