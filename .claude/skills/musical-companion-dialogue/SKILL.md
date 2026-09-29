---
name: musical-companion-dialogue
description: Design of the companion's musical responses in echo-flute-flow — call-and-response (sawal-jawab), echo with gentle correction, extension, answering phrases, ornament introduction, raga emergence over a session, and trust-based progression. Use when changing what the companion plays back, how it adapts, or how it reveals ragas.
---

# Musical companion dialogue

**Lens:** François Pachet's *Continuator* (a system that continues a player's phrase in
their own style, so the player feels mirrored and extended), George Lewis's *Voyager*
(the computer as an improvising partner with its own voice), and the jugalbandi tradition of
sawal-jawab (question and answer). The companion is a duet partner who is a little wiser.
It is not a grader.

## The loop

```
you play → silence (≈0.7s) → companion listens back (segment, infer raga)
         → chooses a move → plays → mic is gated during its phrase + tail → your turn
```

## Moves (pure function: `composeResponse(phrase, context, rng) → { notes, move, whisper }`)

| Move | What it plays | When |
|---|---|---|
| echo | Your phrase, snapped into the raga, with the last note held | Always possible. Dominant in the first ~3 exchanges. |
| extend | Echo + 2–4 raga steps that walk to a resting note (Sa / Pa / vadi) | Grows from exchange 2 |
| answer | Starts on your last note, moves the opposite way, lands on Sa | Grows from exchange 3 |
| ornament | Echo with meend into long notes and kan from the upper neighbour | Exchange ≥ 4 |
| pakad | The raga's signature phrase, offered as a gift | Raga known and exchange ≥ 6, rare |
| breath | Your breath rhythm (pulses, accents, strength) played on a neighbouring swara | When you pulsed or accented a note, from exchange 2. It answers in your own breath language. |

**Expression is mirrored in every move.** Echo keeps each note's `dyn`, `pulse`, `accent`,
`shape`, `tremolo`, `shake`, `air`, and `bend`. Extensions inherit the phrase's average
strength and fade into the resting note. The ornament move may add a swell on the longest
note: that teaches strength-shaping by example.

Weights shift with the exchange count, so the partner earns the right to lead.
If you used a meend yourself, the companion mirrors it in its echo. Being heard is the reward.

## Raga emergence

- Accumulate a duration-weighted pitch-class histogram across the session, decayed about
  0.85 per phrase so the listener can follow you if you move to another raga.
- Match score = inFraction × (0.6 + 0.4 × coverage). This prefers the smallest raga that
  explains what you played, so Bhupali wins over Yaman when you never touch tivra Ma or Ni.
- Reveal a raga only when its score is ≥ 0.8 and at least 3 phrases have passed. Reveal it
  once, as a whisper that tells a story ("This is Bhupali, an evening raga…").
- Until a raga is known, the companion's note set is **your** note set plus Sa and Pa. It
  never introduces a foreign note before it understands you.
- The player can choose a raga to wander in. The companion then uses it from the first
  phrase, and gentle correction is active from the start.

## Whispers (the only text the companion says)

- One short line per exchange. Describe what the companion did, never what you did wrong:
  "I held your Pa a little longer." / "I carried it home to Sa." / "Listen to the glide into Ga."
- Name expression as something heard, never as a grade: "I kept your Ga soft." /
  "Three breaths on Sa — here they are on Pa." / "I let the last note fade, the way you did."
- Never write numbers, percentages, "correct", "wrong", "score", "level", or "streak"
  (VISION: no gamification).

## Rules

1. **Deterministic core.** All randomness comes from an injected `rng`, so tests can pass a
   seeded one.
2. **Durations come from the player.** Keep their relative rhythm, clamp each note to
   0.18–2.2s, and hold the final note 1.4×. The companion breathes at your tempo.
3. **Keep the range playable.** Keep notes between mandra Pa (−5) and taar Pa (+19). A
   bansuri can't go much further.
4. **Always resolve or deliberately don't.** Answers end on Sa. Extensions end on a resting
   note. An echo ends where you ended, which is the mirror.
5. **No dead air and no talking over the player.** If you play again while the companion
   plays, it doesn't stop mid-note (upgrade path). But the mic gate means your new phrase is
   the next turn.

Code: `src/music/companion.ts`, `src/music/ragas.ts`, check in `src/music/check.ts`.
