import { pc, swara } from './swara.ts';
import type { Raga } from './ragas.ts';

export interface Note {
  semi: number; // semitones from madhya Sa
  dur: number; // seconds
  glide?: boolean; // meend into this note
  kan?: number; // grace note (semi) touched before this note
  // Breath expression — how the note was blown (breath-expression-analysis skill).
  dyn?: number; // 0 soft … 1 full breath
  pulse?: boolean; // re-articulated with a push of air on the same swara
  accent?: boolean; // strong attack that settles
  shape?: 'swell' | 'fade';
  tremolo?: number; // breath (loudness) sway depth, dB
  shake?: number; // pitch sway depth, cents (andolan / gamak)
  air?: number; // 0 clear … 1 airy tone
  bend?: number; // lip/angle shading from the swara centre, cents
}

export type Move = 'echo' | 'extend' | 'answer' | 'ornament' | 'pakad' | 'breath';

export interface Response {
  notes: Note[];
  move: Move;
  whisper: string;
}

export interface DialogueContext {
  raga: Raga | null; // null = still learning the player's notes
  exchange: number; // how many exchanges so far this session
}

const LOW = -5; // mandra Pa
const HIGH = 19; // taar Pa

/** Playable notes across octaves for a pitch-class set. */
function ladder(pcs: number[]): number[] {
  const out: number[] = [];
  for (let s = LOW; s <= HIGH; s++) if (pcs.includes(pc(s))) out.push(s);
  return out;
}

const nearest = (steps: number[], semi: number) =>
  steps.reduce((a, b) => (Math.abs(b - semi) < Math.abs(a - semi) ? b : a));

const clampDur = (d: number) => Math.min(2.2, Math.max(0.18, d));

function pick<T>(rng: () => number, weighted: [T, number][]): T {
  const total = weighted.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [v, w] of weighted) if ((r -= w) <= 0) return v;
  return weighted[weighted.length - 1][0];
}

/** Walk the ladder from `from` towards `to`, one raga step at a time. */
function walk(steps: number[], from: number, to: number, dur: number): Note[] {
  const out: Note[] = [];
  let i = steps.indexOf(nearest(steps, from));
  const j = steps.indexOf(nearest(steps, to));
  while (i !== j && out.length < 6) {
    i += i < j ? 1 : -1;
    out.push({ semi: steps[i], dur });
  }
  return out;
}

const WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

/** One line naming the breath the companion heard and kept — never a grade. */
function breathWhisper(notes: Note[]): string | null {
  const pulses = notes.filter((n) => n.pulse);
  if (pulses.length) {
    const count = pulses.length + 1;
    return `${WORDS[count] ? WORDS[count][0].toUpperCase() + WORDS[count].slice(1) : 'Many'} breaths on ${swara(pulses[0].semi).roman} — I kept every push of air.`;
  }
  const dyns = notes.map((n) => n.dyn).filter((d) => d !== undefined);
  if (dyns.length > 1 && Math.max(...dyns) - Math.min(...dyns) >= 0.35) {
    const soft = notes.reduce((a, b) => ((b.dyn ?? 1) < (a.dyn ?? 1) ? b : a));
    const strong = notes.reduce((a, b) => ((b.dyn ?? 0) > (a.dyn ?? 0) ? b : a));
    return `I kept your ${swara(soft.semi).roman} soft and your ${swara(strong.semi).roman} strong.`;
  }
  const last = notes[notes.length - 1];
  if (last.shape === 'fade') return 'I let the last note fade, the way you did.';
  const swelled = notes.find((n) => n.shape === 'swell');
  if (swelled) return `Your ${swara(swelled.semi).roman} grew as you blew into it — so did mine.`;
  const sway = notes.find((n) => n.tremolo || n.shake);
  if (sway) return sway.shake ? `I kept the sway in your ${swara(sway.semi).roman}.` : `Your breath trembled on ${swara(sway.semi).roman}; so did mine.`;
  if (notes.some((n) => n.accent)) return 'I leaned into the notes you pushed.';
  return null;
}

export function composeResponse(played: Note[], ctx: DialogueContext, rng: () => number = Math.random): Response {
  // Until a raga emerges, speak only in the player's own notes plus Sa and Pa.
  const pcs = ctx.raga ? ctx.raga.notes : [...new Set([0, 7, ...played.map((n) => pc(n.semi))])];
  const steps = ladder(pcs);
  const rests = ctx.raga ? ctx.raga.rest : [0, 7];

  // Echo = the player's phrase, gently snapped into the raga, rhythm preserved.
  let corrected: string | null = null;
  const echo: Note[] = played.slice(-12).map((n) => {
    const semi = nearest(steps, Math.min(HIGH, Math.max(LOW, n.semi)));
    const fixed = ctx.raga && semi !== n.semi;
    if (fixed) corrected = swara(semi).roman;
    const { kan: _kan, bend, ...breath } = n;
    return { ...breath, semi, dur: clampDur(n.dur), ...(fixed || bend === undefined ? {} : { bend }) };
  });
  if (echo.length === 0) return { notes: [], move: 'echo', whisper: '' };

  const hold = (notes: Note[]) =>
    notes.map((n, i) => (i === notes.length - 1 ? { ...n, dur: clampDur(n.dur * 1.4) } : n));
  const beat = echo.reduce((s, n) => s + n.dur, 0) / echo.length;
  const last = echo[echo.length - 1].semi;
  const usedMeend = played.some((n) => n.glide);
  const breathy = played.some((n) => n.pulse || n.accent);
  const known = echo.filter((n) => n.dyn !== undefined);
  const dyn = known.length ? known.reduce((a, n) => a + n.dyn!, 0) / known.length : undefined;
  const x = ctx.exchange;

  const move = pick<Move>(rng, [
    ['echo', x < 3 ? 5 : 2],
    ['extend', x < 2 ? 0.5 : 3],
    ['answer', x < 3 ? 0 : 2.5],
    ['ornament', x < 4 ? 0 : 2],
    ['pakad', ctx.raga && x >= 6 ? 1 : 0],
    ['breath', breathy && x >= 2 ? 3 : 0],
  ]);

  if (move === 'breath') {
    // Answer in the player's own breath language, one raga step higher.
    const shifted = echo.map((n) => ({ ...n, semi: steps[Math.min(steps.length - 1, steps.indexOf(n.semi) + 1)], bend: undefined }));
    const pulsed = echo.find((n) => n.pulse);
    return {
      notes: hold(shifted),
      move,
      whisper: pulsed
        ? `Your breaths on ${swara(pulsed.semi).roman} — here they are on ${swara(shifted[echo.indexOf(pulsed)].semi).roman}.`
        : 'The same pushes of breath, one step higher. Blow with me.',
    };
  }

  if (move === 'pakad' && ctx.raga) {
    return {
      notes: hold(ctx.raga.pakad.map((semi, i) => ({ semi, dur: beat * (i % 3 === 2 ? 1.5 : 1), glide: i > 0 && rng() < 0.2, dyn }))),
      move,
      whisper: `A gift — the phrase that makes ${ctx.raga.name} itself.`,
    };
  }

  if (move === 'extend') {
    const home = rests[Math.floor(rng() * rests.length)];
    const target = nearest(steps, home + 12 * Math.round((last - home) / 12));
    let tail = walk(steps, last, target, beat * 0.9);
    if (tail.length === 0) tail = walk(steps, last, nearest(steps, last + 4), beat * 0.9);
    tail = tail.map((n, i) => ({ ...n, dyn, ...(i === tail.length - 1 ? { shape: 'fade' as const } : {}) }));
    return {
      notes: hold([...echo, ...tail]),
      move,
      whisper: `I carried your phrase on to ${swara(tail.at(-1)?.semi ?? last).roman}.`,
    };
  }

  if (move === 'answer') {
    // Sawal-jawab: go the other way from where the player went, then come home to Sa.
    const rising = echo.length > 1 && last > echo[0].semi;
    const turn = nearest(steps, last + (rising ? -5 : 5));
    const out = walk(steps, last, turn, beat);
    const sa = nearest(steps, 12 * Math.round(turn / 12));
    const home = walk(steps, turn, sa, beat);
    const notes: Note[] = [{ semi: last, dur: beat }, ...out, ...home].map((n) => ({ ...n, dyn }));
    if (notes.at(-1)!.semi !== sa) notes.push({ semi: sa, dur: beat, dyn });
    notes[notes.length - 1].shape = 'fade';
    return { notes: hold(notes), move, whisper: 'You asked; I answered — and brought it home to Sa.' };
  }

  if (move === 'ornament') {
    const notes = echo.map((n, i) => {
      if (n.dur < 0.5 || i === 0) return n;
      const up = steps[steps.indexOf(n.semi) + 1];
      return rng() < 0.5 ? { ...n, glide: true } : { ...n, kan: up ?? n.semi };
    });
    const hasKan = notes.some((n) => n.kan !== undefined);
    const longest = notes.reduce((a, b, i) => (b.dur > notes[a].dur ? i : a), 0);
    if (!notes.some((n) => n.shape) && notes[longest].dur >= 0.6 && rng() < 0.5) {
      notes[longest] = { ...notes[longest], shape: 'swell' };
      return { notes: hold(notes), move, whisper: `Listen — I let ${swara(notes[longest].semi).roman} grow with more breath. Try it.` };
    }
    return {
      notes: hold(notes),
      move,
      whisper: hasKan ? 'Hear that tiny touch before the long note? That is a kan.' : 'Listen to how I slide between notes — a meend.',
    };
  }

  const whisper = corrected
    ? `I played it back with ${corrected} — let that one settle in your ear.`
    : breathWhisper(echo) ?? (usedMeend
      ? 'I heard your glide — here it is back to you.'
      : pick(rng, [['Your phrase, back to you.', 1], ['I held your last note a little longer.', 1], ['Again, softly.', 1]]));
  return { notes: hold(echo), move: 'echo', whisper };
}
