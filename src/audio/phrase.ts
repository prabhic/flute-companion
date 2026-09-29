import type { Note } from '../music/companion.ts';

export interface Frame {
  t: number; // seconds
  cents: number | null; // relative to Sa; null = unvoiced
  db: number; // loudness, 20·log10(rms) — kept even when unvoiced
  air: number; // 0 clear … 1 pure breath (1 − YIN clarity)
}

const TOL = 60; // cents a stable note may wander (hard blowing pulls ~20¢ sharp — still the same swara)
const MIN_NOTE = 0.07; // s
const MEEND_MIN_TIME = 0.06; // s
const MEEND_MIN_SPAN = 150; // cents
// ponytail: depth-only boundary between a breath pulse (deep single dip) and breath tremolo
// (≤ ±3 dB periodic sway); a periodicity check would separate fast deep pulses from tremolo.
const PULSE_DIP = 6; // dB below the running peak…
const PULSE_RISE = 4; // …then back up by this much…
const PULSE_WINDOW = 0.25; // …within this many seconds = a breath pulse
const DYN_RANGE = 30; // dB of playing range mapped to dyn 0..1

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Least-squares slope of ys over ts. */
function slope(ts: number[], ys: number[]) {
  const mt = mean(ts);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < ts.length; i++) {
    num += (ts[i] - mt) * (ys[i] - my);
    den += (ts[i] - mt) ** 2;
  }
  return den ? num / den : 0;
}

/** Oscillation of a series around its trend: rate (Hz), depth (half peak-to-peak), full cycles. */
function oscillation(ts: number[], ys: number[]) {
  if (ys.length < 8) return { rate: 0, depth: 0, cycles: 0 };
  const k = slope(ts, ys);
  const my = mean(ys);
  const mt = mean(ts);
  const raw = ys.map((y, i) => y - (my + k * (ts[i] - mt)));
  const sm = raw.map((_, i) => mean(raw.slice(Math.max(0, i - 1), i + 2))); // 3-frame smoothing
  const sorted = [...sm].sort((a, b) => a - b);
  const depth = (sorted[Math.floor(sorted.length * 0.9)] - sorted[Math.floor(sorted.length * 0.1)]) / 2;
  // Hysteresis crossings so frame jitter isn't counted as wobble.
  const h = depth * 0.4;
  let sign = 0;
  let crossings = 0;
  for (const v of sm) {
    const now = v > h ? 1 : v < -h ? -1 : 0;
    if (now === 0 || now === sign) continue;
    if (sign !== 0) crossings++;
    sign = now;
  }
  const cycles = crossings / 2;
  const dur = ts[ts.length - 1] - ts[0];
  return { rate: dur > 0 ? cycles / dur : 0, depth, cycles };
}

type Raw = Note & { start: number; end: number; cents: number; frames: Frame[] };

/**
 * Turn a stream of frames into sargam notes that keep the player's breath:
 * strength, breath pulses, accents, swells/fades, tremolo vs andolan, airiness, lip shading.
 * `refDb` = the player's strong-breath loudness (session peak); defaults to this phrase's peak.
 */
export function segmentNotes(frames: Frame[], refDb?: number): Note[] {
  const raw: Raw[] = [];
  let run: Frame[] = [];

  const close = (upto = run.length) => {
    const part = run.slice(0, upto);
    run = run.slice(upto);
    if (part.length < 2) return;
    const start = part[0].t;
    const end = part[part.length - 1].t;
    if (end - start < MIN_NOTE) return;
    const cents = median(part.map((f) => f.cents!));
    raw.push({ semi: Math.round(cents / 100), dur: end - start, start, end, cents, frames: part });
  };

  // Breath-pulse tracking inside a same-pitch run.
  let peak = -Infinity;
  let dip: { db: number; t: number; idx: number } | null = null;

  for (const f of frames) {
    if (f.cents === null) {
      close();
      peak = -Infinity;
      dip = null;
      continue;
    }
    if (run.length && Math.abs(f.cents - median(run.map((r) => r.cents!))) > TOL) {
      close();
      peak = -Infinity;
      dip = null;
    }
    run.push(f);

    if (f.db > peak && !dip) peak = f.db;
    if (f.db < peak - PULSE_DIP && (!dip || f.db < dip.db)) dip = { db: f.db, t: f.t, idx: run.length - 1 };
    if (dip) {
      if (f.db >= dip.db + PULSE_RISE && f.t - dip.t < PULSE_WINDOW) {
        close(dip.idx); // the push of air starts a new note on the same swara
        peak = f.db;
        dip = null;
      } else if (f.t - dip.t >= PULSE_WINDOW) {
        peak = f.db; // it settled lower — a fade, not a pulse
        dip = null;
      }
    }
  }
  close();

  // Merge same-swara fragments ONLY when loudness held up (a detector dropout, not the player).
  const merged: Raw[] = [];
  for (const n of raw) {
    const prev = merged[merged.length - 1];
    if (prev && prev.semi === n.semi && n.start - prev.end < 0.08) {
      const gap = frames.filter((f) => f.t > prev.end && f.t < n.start);
      const sustain = median(prev.frames.map((f) => f.db));
      // No gap frames = a breath-pulse split we made on purpose; keep it.
      if (gap.length && gap.every((f) => f.db > sustain - 3)) {
        prev.end = n.end;
        prev.dur = prev.end - prev.start;
        prev.frames = [...prev.frames, ...gap, ...n.frames];
        continue;
      }
    }
    merged.push(n);
  }

  // Meend: the gap between two notes is filled with voiced, steadily moving frames.
  for (let i = 1; i < merged.length; i++) {
    const a = merged[i - 1];
    const b = merged[i];
    const between = frames.filter((f) => f.t > a.end && f.t < b.start);
    if (between.length < 2 || between.some((f) => f.cents === null)) continue;
    if (b.start - a.end < MEEND_MIN_TIME || Math.abs(b.cents - a.cents) < MEEND_MIN_SPAN) continue;
    const dir = Math.sign(b.cents - a.cents);
    const monotonic = between.every((f, k) => k === 0 || Math.sign(f.cents! - between[k - 1].cents!) !== -dir);
    if (monotonic) b.glide = true;
  }

  // Expression per note (breath-expression-analysis skill).
  const ref = refDb ?? Math.max(...frames.map((f) => f.db));
  return merged.map((n, i) => {
    const ts = n.frames.map((f) => f.t);
    const dbs = n.frames.map((f) => f.db);
    const note: Note = { semi: n.semi, dur: n.dur };
    if (n.glide) note.glide = true;

    note.dyn = +clamp01((mean(dbs) - (ref - DYN_RANGE)) / DYN_RANGE).toFixed(2);

    const prev = merged[i - 1];
    if (prev && prev.semi === n.semi && n.start - prev.end < 0.3) note.pulse = true;

    const head = n.frames.filter((f) => f.t - n.start < 0.12).map((f) => f.db);
    // Compare the attack with the level just after it — not the whole note, or a fade looks like an accent.
    const body = n.frames.filter((f) => f.t - n.start >= 0.12 && f.t - n.start < 0.3).map((f) => f.db);
    // …and an accent settles after the push; a fade keeps falling.
    const rest = n.frames.filter((f) => f.t - n.start >= 0.3).map((f) => f.db);
    const settles = rest.length < 3 || median(body) - median(rest) < 3;
    if (n.dur >= 0.2 && body.length > 2 && settles && Math.max(...head) - median(body) >= 4) note.accent = true;

    if (n.dur >= 0.4) {
      // Skip attack and the last 80ms (the breath dip into a following pulse isn't a fade).
      const settled = n.frames.filter((f) => f.t - n.start > 0.06 && n.end - f.t > 0.08);
      const k = slope(settled.map((f) => f.t), settled.map((f) => f.db));
      if (k >= 8) note.shape = 'swell';
      else if (k <= -8) note.shape = 'fade';
    }

    if (n.dur >= 0.35) {
      const trem = oscillation(ts, dbs);
      const shake = oscillation(ts, n.frames.map((f) => f.cents!));
      const isTrem = trem.cycles >= 2 && trem.rate >= 3 && trem.rate <= 8 && trem.depth >= 1.5;
      const isShake = shake.cycles >= 2 && shake.rate >= 1 && shake.rate <= 8 && shake.depth >= 15;
      if (isTrem && (!isShake || trem.depth / 1.5 >= shake.depth / 15)) note.tremolo = +trem.depth.toFixed(1);
      else if (isShake) note.shake = Math.round(shake.depth);
    }

    note.air = +mean(n.frames.map((f) => f.air)).toFixed(2);
    const bend = Math.round(n.cents - n.semi * 100);
    if (Math.abs(bend) >= 12) note.bend = bend;
    return note;
  });
}
