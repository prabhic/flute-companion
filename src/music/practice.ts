import { composeResponse, type Note, type Offer, type Response, type Technique } from './companion.ts';
import { RAGAS, ragaById, type Raga } from './ragas.ts';
import { pc, swara } from './swara.ts';

export type PracticeStyle = 'echo' | 'vary' | 'learn';
export interface PracticeMemory {
  ragaId: string;
  progress: Record<string, { step: number; caught: number }>;
}
export const freshPractice = (): PracticeMemory => ({ ragaId: RAGAS[0].id, progress: {} });

/** Validate device memory rather than trusting old or partially written localStorage. */
export function restorePractice(value: unknown): PracticeMemory {
  const fresh = freshPractice();
  if (!value || typeof value !== 'object') return fresh;
  const v = value as Partial<PracticeMemory>;
  if (typeof v.ragaId === 'string' && ragaById(v.ragaId)) fresh.ragaId = v.ragaId;
  for (const r of RAGAS) {
    const p = v.progress?.[r.id];
    if (p && Number.isInteger(p.step) && p.step >= 0 && Number.isInteger(p.caught) && p.caught >= 0) {
      fresh.progress[r.id] = { step: Math.min(lessons(r).length, p.step), caught: Math.min(1, p.caught) };
    }
  }
  return fresh;
}

// These are note-familiarity exercises, not a complete model of raga grammar.
// Introduce one pitch class at a time, then revisit fragments of the existing pakad.
function lessons(raga: Raga): number[][] {
  return [
    [0, 0],
    ...raga.notes.slice(1).map((semi, i) => [0, raga.notes[i], semi, raga.notes[i], 0].filter((s, j, a) => j === 0 || s !== a[j - 1])),
    raga.pakad.slice(0, 4),
    raga.pakad.slice(-4),
  ];
}

export function practiceFocus(memory: PracticeMemory, selected: string) {
  const raga = ragaById(selected) ?? ragaById(memory.ragaId) ?? RAGAS[0];
  const step = memory.progress[raga.id]?.step ?? 0;
  const phrases = lessons(raga);
  const done = step >= phrases.length;
  const focus = done ? `Trading phrases in ${raga.name}`
    : step === 0 ? 'An easy breath on Sa'
    : step < raga.notes.length ? `Making room for ${swara(raga.notes[step]).roman}`
    : `A little phrase from ${raga.name}`;
  return { raga, step, done, focus, semis: phrases[step] ?? [] };
}

/** Same note order and relative rhythm; a slower whole phrase and octave slips are welcome.
 * Tolerances are provisional, covered by synthetic checks, not validated with learners.
 */
export function caughtPhrase(played: Note[], target: Note[]): boolean {
  if (!target.length || played.length !== target.length) return false;
  if (played.some((n, i) => pc(n.semi) !== pc(target[i].semi) || !Number.isFinite(n.dur) || n.dur <= 0)) return false;
  const ratios = played.map((n, i) => n.dur / target[i].dur).sort((a, b) => a - b);
  const tempo = ratios[Math.floor(ratios.length / 2)];
  return played.every((n, i) => Math.abs(Math.log2(n.dur / target[i].dur / tempo)) <= 0.65);
}

interface PracticeContext {
  memory: PracticeMemory;
  selected: string;
  offer: Offer | null;
  turns: number; // free turns since the last offer, reset on session start
  leadNow?: boolean;
  unheard?: Technique[];
}

export function practiceTurn(played: Note[], ctx: PracticeContext): {
  response: Response; memory: PracticeMemory; turns: number; raga: Raga;
} {
  let memory = restorePractice(ctx.memory);
  let focus = practiceFocus(memory, ctx.selected);
  const lessonId = `${focus.raga.id}:${focus.step}`;
  const echo = () => composeResponse(played, { raga: focus.raga, exchange: 0, preference: 'echo' });
  if (ctx.offer?.lessonId === lessonId && !ctx.leadNow && played.length) {
    if (caughtPhrase(played, ctx.offer.notes)) {
      const previous = memory.progress[focus.raga.id] ?? { step: 0, caught: 0 };
      const settled = previous.caught >= 1;
      memory.progress[focus.raga.id] = { step: previous.step + (settled ? 1 : 0), caught: settled ? 0 : 1 };
      return { response: { ...echo(), whisper: settled ? 'That phrase is settling in. Let’s play freely for a breath.' : 'We found it together. We’ll return to it before adding anything new.' }, memory, turns: 0, raga: focus.raga };
    }
    if (ctx.offer.tries < 2) {
      const notes = ctx.offer.notes.map((n) => ({ ...n, dur: n.dur * 1.15 }));
      return { response: { notes, move: 'lead', whisper: 'Let’s give it more room. Listen, then play this back.', offer: { ...ctx.offer, notes, tries: ctx.offer.tries + 1 } }, memory, turns: 0, raga: focus.raga };
    }
    return { response: { ...echo(), whisper: 'Let’s stay with your sound for a while. That little phrase can wait.' }, memory, turns: 0, raga: focus.raga };
  }

  if (focus.done && ctx.offer && !ctx.offer.lessonId && played.length) {
    return { response: composeResponse(played, { raga: focus.raga, exchange: 8, unheard: ctx.unheard, offer: ctx.offer }), memory, turns: 0, raga: focus.raga };
  }
  if (!ctx.leadNow && ctx.turns < 2) return { response: echo(), memory, turns: ctx.turns + 1, raga: focus.raga };
  let newRaga = false;
  if (focus.done && ctx.selected === 'follow') {
    const next = RAGAS[RAGAS.findIndex((r) => r.id === focus.raga.id) + 1];
    if (next) {
      memory = { ...memory, ragaId: next.id };
      focus = practiceFocus(memory, 'follow');
      newRaga = true;
    }
  }
  if (focus.done && ctx.leadNow) {
    const notes = focus.raga.pakad.slice(-4).map((semi) => ({ semi, dur: 0.7 }));
    return { response: { notes, move: 'lead', offer: { notes, tries: 0 }, whisper: 'A familiar phrase, together again. Listen, then echo me.' }, memory, turns: 0, raga: focus.raga };
  }
  if (focus.done) {
    return { response: composeResponse(played, { raga: focus.raga, exchange: 8, unheard: ctx.unheard, offer: ctx.offer?.lessonId ? null : ctx.offer }), memory, turns: 0, raga: focus.raga };
  }
  const notes: Note[] = focus.semis.map((semi, i) => ({ semi, dur: i === focus.semis.length - 1 ? 0.9 : 0.6, dyn: 0.55 }));
  return {
    response: {
      notes, move: 'lead', offer: { notes, tries: 0, lessonId: `${focus.raga.id}:${focus.step}` },
      whisper: newRaga ? `Let’s explore ${focus.raga.name}, beginning on Sa. Listen, then echo me.`
        : `${focus.focus}. Listen, then echo me.`,
    }, memory, turns: 0, raga: focus.raga,
  };
}
