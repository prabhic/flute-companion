// Stroke onsets from the capture windows — tabla, table, box, anything (rhythm-companion skill).
import type { Hit } from '../music/rhythm.ts';

const BLOCK = 128; // ~2.7ms at 48k: onset timing resolution
const JUMP = 2; // a block this many times above the decaying envelope is a new stroke
const REFRACTORY = 0.07; // s — fastest stroke we separate
const MIN_LEVEL = 0.008;
const BASS_HZ = 300;
const LOW_SHARE = 0.5; // ponytail: one threshold for bayan vs dayan, tune on real fixtures

export interface OnsetState {
  env: number;
  floor: number;
  last: number;
  pending: { t: number; idx: number }[]; // found in the newest half, classified next window
}

export const createOnsets = (): OnsetState => ({ env: 0, floor: 0.002, last: -Infinity, pending: [] });

const blockRms = (x: Float32Array, from: number, to: number) => {
  let s = 0;
  for (let i = from; i < to; i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, to - from));
};

/** Share of a stroke's energy below ~300Hz: a thump or bayan is deep, a tap or dayan is not. */
export function bassShare(x: Float32Array, sr: number) {
  const a = 1 - Math.exp((-2 * Math.PI * BASS_HZ) / sr);
  let lp = 0, lo = 0, all = 0;
  for (let i = 0; i < x.length; i++) {
    lp += a * (x[i] - lp);
    lo += lp * lp;
    all += x[i] * x[i];
  }
  return all > 0 ? lo / all : 0;
}

/**
 * Feed one capture window (each call's window overlaps the last by half; tEnd = ctx time of its
 * last sample). Returns strokes found in the previous call, now classified.
 */
export function detectOnsets(st: OnsetState, win: Float32Array, tEnd: number, sr: number): Hit[] {
  const hop = win.length >> 1;
  const hits = st.pending.map(({ t, idx }) => {
    const body = win.subarray(idx - hop, idx);
    return { t, db: 20 * Math.log10(Math.max(blockRms(body, 0, body.length), 1e-6)), low: bassShare(body, sr) > LOW_SHARE };
  });
  st.pending = [];

  const decay = Math.exp(-BLOCK / sr / 0.06);
  for (let i = hop; i + BLOCK <= win.length; i += BLOCK) {
    const b = blockRms(win, i, i + BLOCK);
    const t = tEnd - (win.length - i) / sr;
    if (b > JUMP * st.env && b > Math.max(MIN_LEVEL, st.floor * 4) && t - st.last > REFRACTORY) {
      st.pending.push({ t, idx: i });
      st.last = t;
    }
    st.env = Math.max(b, st.env * decay);
    st.floor = b < st.floor ? st.floor * 0.9 + b * 0.1 : st.floor * 1.0005;
  }
  return hits;
}
