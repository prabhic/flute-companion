import { pc } from './swara.ts';

export interface Raga {
  id: string;
  name: string;
  notes: number[]; // pitch classes from Sa
  rest: number[]; // resting notes phrases resolve to (Sa, Pa / vadi)
  pakad: number[]; // signature phrase, semis
  time: string;
  feel: string;
  story: string;
}

// ponytail: models note set + resting notes + one pakad only; aroha/avaroha rules
// (e.g. Yaman avoiding Sa in ascent) are the upgrade path — see bansuri-raga-teaching.
export const RAGAS: Raga[] = [
  {
    id: 'bhupali', name: 'Bhupali', notes: [0, 2, 4, 7, 9], rest: [0, 4, 7],
    pakad: [4, 2, 0, -3, 0, 2, 4, 7, 4, 2, 0], time: 'evening', feel: 'serene, devotional',
    story: 'Five notes, no sharp edges — an evening lamp being lit.',
  },
  {
    id: 'durga', name: 'Durga', notes: [0, 2, 5, 7, 9], rest: [0, 5, 7],
    pakad: [5, 2, 5, 7, 9, 7, 5, 2, 0], time: 'night', feel: 'bright, joyful',
    story: 'Like Bhupali, but Ma stands where Ga was — one note, a whole new colour.',
  },
  {
    id: 'yaman', name: 'Yaman', notes: [0, 2, 4, 6, 7, 9, 11], rest: [0, 4, 11],
    pakad: [-1, 2, 4, 2, 0, -1, -3, -5, -3, -1, 2, 0], time: 'evening', feel: 'romantic, prayerful',
    story: 'The raised Ma leans upward like a question asked at dusk.',
  },
  {
    id: 'kafi', name: 'Kafi', notes: [0, 2, 3, 5, 7, 9, 10], rest: [0, 5, 7],
    pakad: [0, 2, 3, 5, 7, 5, 3, 2, 0], time: 'night, spring', feel: 'playful, folk',
    story: 'Soft Ga and Ni — the colour of Holi songs and village evenings.',
  },
  {
    id: 'malkauns', name: 'Malkauns', notes: [0, 3, 5, 8, 10], rest: [0, 5],
    pakad: [5, 3, 5, 3, 0, -2, 0, 3, 5], time: 'late night', feel: 'deep, meditative',
    story: 'Five soft notes circling Ma — the stillness after midnight.',
  },
  {
    id: 'bhairav', name: 'Bhairav', notes: [0, 1, 4, 5, 7, 8, 11], rest: [0, 8, 1],
    pakad: [0, 4, 5, 7, 8, 7, 5, 4, 1, 0], time: 'dawn', feel: 'grave, devotional',
    story: 'Soft Re and Dha tremble like the first light before sunrise.',
  },
  {
    id: 'bhairavi', name: 'Bhairavi', notes: [0, 1, 3, 5, 7, 8, 10], rest: [0, 5, 7],
    pakad: [5, 3, 1, 0, -2, 0, 3, 5, 7, 5, 3, 1, 0], time: 'morning, closing', feel: 'tender, devotional',
    story: 'Every note softened — the raga musicians play last, to say goodbye.',
  },
];

export const ragaById = (id: string) => RAGAS.find((r) => r.id === id) ?? null;

/** Duration-weighted pitch-class histogram → best raga + score in [0,1]. */
export function matchRaga(hist: number[]): { raga: Raga; score: number } | null {
  const total = hist.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  const played = hist.map((d) => d / total > 0.03); // ignore passing slips
  let best: { raga: Raga; score: number } | null = null;
  for (const raga of RAGAS) {
    const inside = raga.notes.reduce((s, n) => s + hist[n], 0) / total;
    const coverage = raga.notes.filter((n) => played[n]).length / raga.notes.length;
    const score = inside * (0.6 + 0.4 * coverage);
    if (!best || score > best.score) best = { raga, score };
  }
  return best;
}

export function addToHistogram(hist: number[], notes: { semi: number; dur: number }[], decay = 0.85) {
  const next = hist.map((v) => v * decay);
  for (const n of notes) next[pc(n.semi)] += n.dur;
  return next;
}
