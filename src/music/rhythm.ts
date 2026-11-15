// Beat mode: from heard strokes to a cycle, and a tabla friend's reply (rhythm-companion skill).

/** One heard stroke: audio-clock time, loudness, and whether it was deep (bayan / thump). */
export interface Hit {
  t: number;
  db: number;
  low: boolean;
}

export interface Stroke {
  low: boolean; // bayan (or a thump)
  high: boolean; // dayan (or a tap)
  accent?: boolean;
  soft?: boolean;
  roll?: boolean; // an extra soft stroke half a step later (ti-ra)
}
export type Slot = Stroke | null;

export interface Beat {
  step: number; // seconds per grid step
  slots: Slot[]; // one cycle
  start: number; // ctx time of slot 0 (the player's sam)
}

export type BeatMove = 'echo' | 'fill' | 'roll' | 'answer' | 'tihai';

/** Tabla name for a stroke — a word for what was played, never notation. */
export const bol = (s: Slot) =>
  !s ? '·' : s.low && s.high ? 'Dha' : s.low ? (s.accent ? 'Ge' : 'ge') : s.soft ? 'ti' : s.accent ? 'Na' : 'Ta';

const MIN_STEP = 0.09;
const MAX_STEP = 0.6;
const FIT = 0.25; // a hit may sit this far (in steps) from its grid line
const ON_GRID = 0.6; // below this share of hits on the best grid, there is no pattern to hold
const SLOP = 0.06; // s — beyond this a hit is off the grid however coarse it is (a ghost, a bounce)

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Fit a grid near step g: snap hits to it, least-squares step + offset over the hits that fit, repeat. */
function fitGrid(hits: Hit[], g: number) {
  let step = g;
  let t0 = hits[0].t;
  const off = (h: Hit) => {
    const x = (h.t - t0) / step;
    return Math.abs(x - Math.round(x));
  };
  for (let k = 0; k < 3; k++) {
    const on = hits.filter((h) => off(h) <= FIT);
    if (on.length < 2) break;
    const p = on.map((h) => Math.round((h.t - t0) / step));
    const mp = mean(p);
    const mt = mean(on.map((h) => h.t));
    const sxx = p.reduce((a, x) => a + (x - mp) ** 2, 0);
    if (!sxx) break;
    step = p.reduce((a, x, i) => a + (x - mp) * (on[i].t - mt), 0) / sxx;
    t0 = mt - step * mp;
  }
  // Error as a share of the step: a finer grid only wins if hits really sit between the coarse
  // lines (in seconds a finer grid always fits better). Capped so a ghost costs the same everywhere.
  const cost = hits.reduce((a, h) => a + Math.min(off(h), FIT) ** 2, 0);
  return { step, t0, cost, on: hits.filter((h) => off(h) <= FIT && off(h) * step <= SLOP) };
}

/**
 * Infer grid, cycle and strokes from a phrase of hits. Hands drift and bounce: hits off the best
 * grid are dropped as ghosts. null when there's no pattern to hold.
 */
export function toBeat(hits: Hit[]): Beat | null {
  if (hits.length < 3) return null;
  const gaps = hits.slice(1).map((h, i) => h.t - hits[i].t);
  const fits = gaps
    .flatMap((g) => [1, 2, 3, 4].map((k) => g / k))
    .filter((g) => g >= MIN_STEP && g <= MAX_STEP)
    .map((g) => fitGrid(hits, g))
    .filter((f) => f.step >= MIN_STEP && f.step <= MAX_STEP && f.on.length >= 3);
  if (!fits.length) return null;
  // Tightest timing wins; near-ties go to the coarser grid (the simpler reading).
  const best = Math.min(...fits.map((f) => f.cost));
  const { step, t0, on } = fits.filter((f) => f.cost <= best * 1.15 + 1e-4).sort((a, b) => b.step - a.step)[0];
  if (on.length < ON_GRID * hits.length) return null;

  const maxDb = Math.max(...on.map((h) => h.db));
  const raw = on.map((h) => Math.round((h.t - t0) / step));
  const pos = raw.map((x) => x - raw[0]);
  const all: Slot[] = Array(pos[pos.length - 1] + 1).fill(null);
  on.forEach((h, i) => {
    const prev = all[pos[i]];
    // Two strokes on one grid line (a slightly flammed Dha) merge.
    all[pos[i]] = {
      low: h.low || !!prev?.low,
      high: !h.low || !!prev?.high,
      ...(h.db >= maxDb - 3 || prev?.accent ? { accent: true } : {}),
      ...(h.db < maxDb - 14 && !prev ? { soft: true } : {}),
    };
  });

  const L = cycleLength(all);
  return { step, slots: Array.from({ length: L }, (_, i) => all[i] ?? null), start: t0 + raw[0] * step };
}

// A missing or extra stroke is a full difference; a stroke heard deep once and bright once is half.
const differ = (a: Slot, b: Slot) => (!a !== !b ? 1 : a && b && (a.low !== b.low || a.high !== b.high) ? 0.5 : 0);

function cycleLength(slots: Slot[]) {
  const n = slots.length;
  // Played twice or more? The repeat is the cycle — the shortest period that matches as well as
  // any, allowing a stroke or two to differ (a period that only nearly matches is half a pattern).
  const rate = (p: number) => {
    let diff = 0;
    for (let i = 0; i + p < n; i++) diff += differ(slots[i], slots[i + p]);
    return diff / (n - p);
  };
  const periods = Array.from({ length: Math.max(0, Math.floor(n / 1.5) - 1) }, (_, i) => ({ p: i + 2, r: rate(i + 2) }));
  const best = Math.min(...periods.map((x) => x.r));
  const p = periods.find((x) => x.r <= 0.2 && x.r <= best + 0.04)?.p;
  if (p) return p;
  return n % 4 === 0 || n % 3 === 0 ? n : n + 4 - (n % 4);
}

/** When the reply comes in: the player's next sam — or, if a long cycle puts that far off, their next beat. */
export function nextSam(beat: Beat, after: number) {
  const L = beat.slots.length;
  const unit = (L * beat.step <= 1.5 ? L : L % 4 === 0 ? 4 : L % 3 === 0 ? 3 : 1) * beat.step;
  return beat.start + Math.max(0, Math.ceil((after - beat.start) / unit)) * unit;
}

export interface BeatResponse {
  slots: Slot[];
  move: BeatMove;
  whisper: string;
}

const pickOne = <T,>(rng: () => number, xs: T[]) => xs[Math.floor(rng() * xs.length)];

export function respondBeat(beat: Beat, exchange: number, rng: () => number = Math.random): BeatResponse {
  const you = beat.slots;
  const L = you.length;
  const move: BeatMove =
    exchange < 2 ? 'echo'
    : exchange < 4 ? 'fill'
    : exchange % 4 === 1 ? 'tihai'
    : pickOne(rng, ['fill', 'roll', 'answer'] as BeatMove[]);

  if (move === 'fill') {
    const slots = you.map((s) => s ?? (rng() < 0.55 ? { low: false, high: true, soft: true } : null));
    if (slots.every((s, i) => s === you[i])) return { slots: you, move: 'echo', whisper: 'Your beat, back to you.' };
    return { slots: [...you, ...slots], move, whisper: pickOne(rng, ['Yours, then with the gaps whispered in.', 'Once as you played it, once filled in.']) };
  }

  if (move === 'roll') {
    // A ti-ra roll on the strokes leading into sam.
    const last = you.map((s, i) => (s ? i : -1)).filter((i) => i >= 0).slice(-2);
    const slots = you.map((s, i) => (s && last.includes(i) ? { ...s, roll: true } : s));
    return { slots: [...you, ...slots], move, whisper: 'I rolled into the sam the second time.' };
  }

  if (move === 'answer') {
    // Same question, new reply: keep the first half, recompose the second at the same density.
    const half = Math.ceil(L / 2);
    const density = you.filter(Boolean).length / L;
    const reply = you.map((s, i) => {
      if (i < half) return s;
      if (i === L - 1 || rng() < density) return { low: rng() < 0.4, high: true, ...(i % 4 === 0 ? { accent: true } : {}) };
      return null;
    });
    return { slots: [...you, ...reply], move, whisper: 'You asked; I answered the second half.' };
  }

  if (move === 'tihai') {
    // Your opening fragment three times, the last stroke landing on sam.
    const firsts = you.map((s, i) => (s ? i : -1)).filter((i) => i >= 0).slice(0, 3);
    const frag: Slot[] = you.slice(0, firsts[firsts.length - 1] + 1);
    frag[frag.length - 1] = { low: true, high: true, accent: true };
    const tihai = [...frag, null, ...frag, null, ...frag];
    const total = Math.ceil((tihai.length - 1) / L) * L + 1; // end exactly on a sam
    const pad: Slot[] = Array(total - tihai.length).fill(null);
    return { slots: [...you, ...pad, ...tihai], move, whisper: 'Three times, and home on the sam.' };
  }

  return { slots: you, move: 'echo', whisper: pickOne(rng, ['Your beat, back to you.', 'Again, just as you played it.']) };
}
