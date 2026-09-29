import type { Note } from '@/music/companion';
import { semiToHz } from '@/music/swara';

/** Master bus: dry + generated reverb. Everything the companion sounds goes through `input`. */
export function createOutput(ctx: AudioContext) {
  const input = ctx.createGain();
  const master = ctx.createGain();
  master.gain.value = 0.9;

  const len = Math.floor(ctx.sampleRate * 2.4);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / ctx.sampleRate / 0.5);
  }
  const verb = ctx.createConvolver();
  verb.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.22;

  input.connect(master);
  input.connect(verb).connect(wet).connect(master);
  master.connect(ctx.destination);
  return input;
}

let noiseBuf: AudioBuffer | null = null;
function noise(ctx: AudioContext) {
  if (!noiseBuf || noiseBuf.sampleRate !== ctx.sampleRate) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  return src;
}

const jitter = (amt: number) => (Math.random() * 2 - 1) * amt;

/**
 * One continuous breathy voice for the whole phrase (flute-sound-synthesis skill).
 * Returns when the phrase (incl. release) ends, in ctx time, and a stop() that fades it out now.
 */
export function playPhrase(ctx: AudioContext, out: AudioNode, notes: Note[], saHz: number, at = ctx.currentTime + 0.12) {
  if (!notes.length) return { end: at, stop: () => {} };
  // env (articulation, strength, swell/fade) → trem (breath tremolo) → out
  const env = ctx.createGain();
  env.gain.value = 0;
  const trem = ctx.createGain();
  env.connect(trem).connect(out);

  const oscs = [1, 2, 3].map((h, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = [0.55, 0.07, 0.025][i];
    o.connect(g).connect(env);
    return { o, h, g };
  });

  const breath = noise(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1;
  const breathGain = ctx.createGain();
  breathGain.gain.value = 0.05;
  breath.connect(bp).connect(breathGain).connect(env);

  // Pitch sway: vibrato on long notes, or the player's andolan/gamak depth.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.2;
  const vib = ctx.createGain();
  vib.gain.value = 0;
  lfo.connect(vib);
  oscs.forEach(({ o }) => vib.connect(o.detune));

  // Loudness sway: breath tremolo.
  const tlfo = ctx.createOscillator();
  tlfo.frequency.value = 5;
  const tdepth = ctx.createGain();
  tdepth.gain.value = 0;
  tlfo.connect(tdepth).connect(trem.gain);

  let prevF = 0;
  const setFreq = (f: number, t: number, glide: boolean) => {
    for (const { o, h } of oscs) {
      if (glide && prevF) {
        o.frequency.setValueAtTime(prevF * h, t); // meend: ramp from where we were
        o.frequency.linearRampToValueAtTime(f * h, t + 0.18);
      } else o.frequency.setTargetAtTime(f * h, t, 0.012);
    }
    bp.frequency.setTargetAtTime(f * 2, t, 0.02);
    prevF = f;
  };

  let t = at;
  const first = semiToHz(notes[0].semi, saHz);
  oscs.forEach(({ o, h }) => o.frequency.setValueAtTime(first * h * 0.991, t)); // slight scoop
  env.gain.setValueAtTime(0, t);

  notes.forEach((n, i) => {
    const f = semiToHz(n.semi, saHz);
    const start = t + (i ? jitter(0.012) : 0);
    const isLast = i === notes.length - 1;
    // The player's breath, played back (flute-sound-synthesis skill). Jitter only when unknown.
    const dyn = n.dyn ?? 0.55 + jitter(0.06);
    const vel = 0.12 + 0.58 * dyn;
    const peak = n.accent ? vel * 1.5 : n.pulse ? vel * 1.2 : vel;
    const from = n.shape === 'swell' ? vel * 0.45 : vel;
    const to = n.shape === 'swell' ? vel * 1.1 : n.shape === 'fade' ? vel * 0.35 : vel;

    if (n.kan !== undefined) {
      setFreq(semiToHz(n.kan, saHz), start, false);
      setFreq(f, start + 0.045, false);
    } else setFreq(f, start, !!n.glide);

    // Harder breath → brighter, and a touch sharp like a real air jet; plus lip shading.
    oscs[1].g.gain.setTargetAtTime(0.07 * (0.5 + dyn), start, 0.03);
    oscs[2].g.gain.setTargetAtTime(0.025 * (0.4 + 1.2 * dyn), start, 0.03);
    const detune = (n.bend ?? 0) + 12 * (dyn - 0.5);
    oscs.forEach(({ o }) => o.detune.setTargetAtTime(detune, start, 0.03));
    breathGain.gain.setTargetAtTime(n.air !== undefined ? Math.min(0.16, 0.03 + 0.4 * n.air) : 0.05, start, 0.03);

    if (i === 0) env.gain.linearRampToValueAtTime(peak, start + 0.06);
    else if (n.glide) env.gain.setTargetAtTime(from, start, 0.05);
    else {
      // A push of air: deeper dip for a breath pulse, shallow for a plain re-attack.
      env.gain.setTargetAtTime(vel * (n.pulse ? 0.15 : 0.35), start - 0.03, 0.01);
      env.gain.setTargetAtTime(peak, start + 0.015, 0.012);
    }
    env.gain.setTargetAtTime(from, start + 0.07, 0.03); // accent/pulse settles
    if (n.shape) env.gain.setTargetAtTime(to, start + 0.15, Math.max(0.05, (n.dur - 0.15) / 3));

    // Sway: the player's andolan (slow, deep) or delayed vibrato on long notes.
    vib.gain.setTargetAtTime(0, start, 0.03);
    if (n.shake) {
      lfo.frequency.setValueAtTime(2.5, start);
      vib.gain.setTargetAtTime(Math.min(40, n.shake), start + 0.1, 0.08);
    } else if (n.dur >= 0.6) {
      lfo.frequency.setValueAtTime(5.2, start);
      vib.gain.setTargetAtTime(10, start + 0.35, 0.15);
    }
    const depth = n.tremolo ? 1 - Math.pow(10, -Math.min(6, n.tremolo) / 20) : 0;
    tdepth.gain.setTargetAtTime(depth, start + 0.08, 0.05);

    t = start + n.dur;
    if (isLast) env.gain.setTargetAtTime(0, t - 0.1, n.shape === 'fade' ? 0.2 : 0.12);
  });

  const end = t + 0.8;
  [...oscs.map((x) => x.o), breath, lfo, tlfo].forEach((node) => {
    node.start(at);
    node.stop(end);
  });
  oscs[0].o.onended = () => trem.disconnect();
  return { end, stop: () => fadeOut(ctx, trem) };
}

/** Fade a node out over ~50ms, then disconnect it — used when the player chooses Rest mid-reply. */
export function fadeOut(ctx: AudioContext, node: GainNode) {
  node.gain.cancelScheduledValues(ctx.currentTime);
  node.gain.setTargetAtTime(0, ctx.currentTime, 0.015);
  window.setTimeout(() => node.disconnect(), 150);
}

/** Tanpura drone: Pa · Sa · Sa · kharaj Sa, looped with a look-ahead scheduler. Returns stop(). */
export function startDrone(ctx: AudioContext, out: AudioNode, saHz: number) {
  const base = saHz / 2;
  const strings = [base * 0.75, base, base, base * 0.5];
  const offsets = [0, 1.1, 2.0, 2.9];
  const cycle = 4.2;
  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.gain.setTargetAtTime(1, ctx.currentTime, 0.8);
  bus.connect(out);

  const pluck = (f: number, t: number) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 6;
    lp.frequency.setValueAtTime(2200, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + 3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 3.8);
    o.connect(lp).connect(g).connect(bus);
    o.start(t);
    o.stop(t + 3.9);
  };

  let next = ctx.currentTime + 0.1;
  const timer = window.setInterval(() => {
    while (next < ctx.currentTime + 0.6 + cycle) {
      strings.forEach((f, i) => pluck(f, next + offsets[i]));
      next += cycle;
    }
  }, 200);

  return () => {
    window.clearInterval(timer);
    bus.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    window.setTimeout(() => bus.disconnect(), 2500);
  };
}

export interface Recording {
  buffer: AudioBuffer;
  t0: number; // ctx time of the buffer's first sample
}

export interface OwnSegment {
  from: number; // ctx time in the recording
  to: number;
  shift: number; // cents to move this segment (0 = exactly as played)
}

const XFADE = 0.012; // s — overlap between segments so joins don't click

/**
 * Replay the player's own recording, segment by segment, pitch-shifting only where asked.
 * playbackRate shifts pitch and stretches time together: a 100¢ correction changes that note's
 * length by ~6%, which the ear accepts. Returns each segment's start so the UI can follow along.
 */
export function playOwnVoice(ctx: AudioContext, out: AudioNode, rec: Recording, segs: OwnSegment[], at = ctx.currentTime + 0.12) {
  const bus = ctx.createGain();
  const data = rec.buffer.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  bus.gain.value = peak > 0 ? Math.min(8, 0.6 / peak) : 1; // quiet mics come back at a friendly level
  bus.connect(out);

  const starts: number[] = [];
  let t = at;
  segs.forEach((seg, i) => {
    const rate = Math.pow(2, seg.shift / 1200);
    const offset = Math.max(0, seg.from - rec.t0);
    const len = Math.max(0.02, Math.min(seg.to, rec.t0 + rec.buffer.duration) - Math.max(seg.from, rec.t0));
    const src = ctx.createBufferSource();
    src.buffer = rec.buffer;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    const outLen = len / rate;
    const first = i === 0;
    const last = i === segs.length - 1;
    g.gain.setValueAtTime(first ? 1 : 0, t);
    if (!first) g.gain.linearRampToValueAtTime(1, t + XFADE);
    g.gain.setValueAtTime(1, t + outLen - (last ? 0.15 : 0));
    g.gain.linearRampToValueAtTime(0, t + outLen + (last ? 0 : XFADE));
    src.connect(g).connect(bus);
    src.start(t, offset, len + (last ? 0 : XFADE * rate));
    starts.push(t);
    t += outLen;
  });
  return { end: t, starts, stop: () => fadeOut(ctx, bus) };
}
