// Everything is relative to Sa. A "semi" is semitones from madhya Sa (-12 = mandra Sa, 12 = taar Sa).

const NAMES = ['Sa', 'Re', 'Re', 'Ga', 'Ga', 'Ma', 'Ma', 'Pa', 'Dha', 'Dha', 'Ni', 'Ni'];
const DEVANAGARI = ['सा', 'रे', 'रे', 'ग', 'ग', 'म', 'म', 'प', 'ध', 'ध', 'नि', 'नि'];
const KOMAL = new Set([1, 3, 8, 10]);
const TIVRA = 6;

// Just intonation against the drone (bansuri-raga-teaching skill).
const JUST = [1, 16 / 15, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 45 / 32, 3 / 2, 8 / 5, 5 / 3, 9 / 5, 15 / 8];

export const pc = (semi: number) => ((semi % 12) + 12) % 12;

export const semiToHz = (semi: number, saHz: number) =>
  saHz * JUST[pc(semi)] * Math.pow(2, Math.floor(semi / 12));

export const hzToCents = (hz: number, saHz: number) => 1200 * Math.log2(hz / saHz);

export interface SwaraLabel {
  roman: string; // "Re", "komal Re", "tivra Ma"
  short: string; // "Re", "re", "Ma'" — compact sargam for ribbons
  deva: string;
  register: 'mandra' | 'madhya' | 'taar';
}

export function swara(semi: number): SwaraLabel {
  const p = pc(semi);
  const octave = Math.floor(semi / 12);
  const register = octave < 0 ? 'mandra' : octave > 0 ? 'taar' : 'madhya';
  const base = NAMES[p];
  const roman = KOMAL.has(p) ? `komal ${base}` : p === TIVRA ? `tivra ${base}` : base;
  // Bhatkhande-style shorthand: lowercase = komal, ' = tivra; dot marks register.
  let short = KOMAL.has(p) ? base.toLowerCase() : p === TIVRA ? `${base}'` : base;
  if (register === 'mandra') short = `.${short}`;
  if (register === 'taar') short = `${short}.`;
  return { roman, short, deva: DEVANAGARI[p], register };
}

// Common bansuri keys; Sa placed in the madhya octave. "Tune my Sa" refines it.
export const BANSURI_KEYS: { key: string; saHz: number }[] = [
  ['C', 261.63], ['C#', 277.18], ['D', 293.66], ['D#', 311.13], ['E', 329.63], ['F', 349.23],
  ['F#', 369.99], ['G', 392.0], ['G#', 415.3], ['A', 440.0], ['A#', 466.16], ['B', 493.88],
].map(([key, saHz]) => ({ key: key as string, saHz: saHz as number }));
