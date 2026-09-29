import { useCallback, useEffect, useRef, useState } from 'react';
import { yin, rms } from '@/audio/pitch';
import { segmentNotes, type Frame } from '@/audio/phrase';
import { createOutput, playOwnVoice, playPhrase, startDrone, type Recording } from '@/audio/voice';
import { composeResponse, type Note, type Offer, type Technique } from '@/music/companion';
import { addToHistogram, matchRaga, ragaById, type Raga } from '@/music/ragas';
import { hzToCents, BANSURI_KEYS } from '@/music/swara';

export type Phase = 'idle' | 'listening' | 'playing' | 'responding' | 'tuning';

interface Settings {
  saHz: number;
  tuned: boolean; // Sa was measured from the player's own flute (octave included)
  ownVoice: boolean; // echoes replay the player's own recording, not the synth flute
  ragaId: string; // 'follow' = let the raga emerge from the player
}

const DEFAULTS: Settings = { saHz: BANSURI_KEYS.find((k) => k.key === 'E')!.saHz, tuned: false, ownVoice: true, ragaId: 'follow' };
const STORE = 'echo-flute-flow:settings';

// What the companion remembers of you between sessions — never a score (VISION: no gamification).
interface Journey {
  exchanges: number; // how far our dialogue has come
  lastRaga: string | null;
  heard: Record<Technique, number>; // techniques you have played at least once
}
const JOURNEY = 'echo-flute-flow:journey';
const FRESH: Journey = { exchanges: 0, lastRaga: null, heard: { glide: 0, swell: 0, pulse: 0, shake: 0 } };
const loadJourney = (): Journey => {
  try {
    const j = JSON.parse(localStorage.getItem(JOURNEY) ?? '{}');
    return { ...FRESH, ...j, heard: { ...FRESH.heard, ...j.heard } };
  } catch {
    return FRESH;
  }
};
const saveJourney = (j: Journey) => {
  try {
    localStorage.setItem(JOURNEY, JSON.stringify(j));
  } catch {
    /* private mode: we just won't remember */
  }
};
const MAX_RESUME = 12; // a returning player resumes the dialogue, capped so it still starts gently

const loadSettings = (): Settings => {
  try {
    const { saHz, tuned, ownVoice, ragaId } = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE) ?? '{}') };
    return { saHz, tuned, ownVoice, ragaId };
  } catch {
    return DEFAULTS;
  }
};

const SILENCE_TO_END = 0.7; // s of quiet that ends a phrase
const MAX_PHRASE = 12; // s
const TAIL = 0.8; // s of reverb the mic must not hear
const TUNE_TIME = 1.5; // s of held Sa for calibration
// Lowest pitch a bansuri plays is mandra Pa (-500¢); every tanpura string sits at or below
// -1200¢. Anything under this is the drone (or a hum), never the flute.
const FLUTE_LOW = -700;
const TUNE_STEADY = 40; // ¢ a held Sa may wander before the hold starts over
const PREROLL = 8; // windows (~0.17s) kept before a phrase starts, so the attack isn't clipped
// Moves that mirror the player's own notes can be voiced with the player's own recording.
const OWN_MOVES = new Set(['echo', 'breath', 'extend']);

export function useCompanion() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [phase, setPhase] = useState<Phase>('idle');
  const [level, setLevel] = useState(0);
  const [liveSemi, setLiveSemi] = useState<number | null>(null);
  const [played, setPlayed] = useState<Note[]>([]);
  const [reply, setReply] = useState<Note[]>([]);
  const [replyIdx, setReplyIdx] = useState<number | null>(null);
  const [whisper, setWhisper] = useState('');
  const [emerged, setEmerged] = useState<Raga | null>(null);
  const [droneOn, setDroneOn] = useState(false);
  const [tuneProgress, setTuneProgress] = useState(0);
  // The raw material of the last phrase, for the hidden "What I heard" view and fixtures.
  const [lastPhrase, setLastPhrase] = useState<{ frames: Frame[]; refDb: number; notes: Note[]; saHz: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Everything the rAF loop touches lives in refs — React state inside a rAF closure goes stale.
  const s = useRef({
    ctx: null as AudioContext | null,
    out: null as AudioNode | null,
    capture: null as AudioWorkletNode | null,
    worklet: null as Promise<void> | null, // module load, once per AudioContext
    source: null as MediaStreamAudioSourceNode | null,
    stream: null as MediaStream | null,
    wakeLock: null as WakeLockSentinel | null,
    timers: [] as number[], // pending reply timers — cleared on Rest
    stopVoice: null as null | (() => void),
    phase: 'idle' as Phase,
    floor: 0.005,
    peakDb: -Infinity, // the player's full breath this session — dynamics are relative to it
    frames: [] as Frame[],
    phraseStart: 0,
    silenceStart: null as number | null,
    muteUntil: 0,
    tuneHz: [] as number[],
    hist: Array(12).fill(0) as number[],
    phrases: 0,
    exchange: 0,
    emerged: null as Raga | null,
    stopDrone: null as null | (() => void),
    heardAt: 0,
    tick: 0,
    hopSec: 1024 / 48000,
    recent: [] as (number | null)[], // last few frames' cents, for a steady live display
    awaitQuiet: false, // after tuning, the held Sa must end before a phrase can begin
    chunks: [] as { t: number; data: Float32Array }[], // the phrase being recorded (plus pre-roll)
    journey: loadJourney(),
    offer: null as Offer | null, // a phrase the companion offered, awaiting your echo
    settings,
  });
  s.current.settings = settings;

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(settings));
    } catch {
      /* private mode: settings just won't persist */
    }
  }, [settings]);

  const later = (fn: () => void, ms: number) => {
    s.current.timers.push(window.setTimeout(fn, Math.max(0, ms)));
  };

  const go = (p: Phase) => {
    s.current.phase = p;
    setPhase(p);
  };

  const ensureAudio = async () => {
    const st = s.current;
    if (!st.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      st.ctx = new Ctx();
      st.out = createOutput(st.ctx);
    }
    if (st.ctx.state === 'suspended') await st.ctx.resume();
    return st.ctx;
  };

  const respond = (notes: Note[], rec: Recording | null) => {
    const st = s.current;
    const ctx = st.ctx!;
    const chosen = ragaById(st.settings.ragaId);

    st.phrases++;
    let story: string | null = null;
    if (!chosen) {
      st.hist = addToHistogram(st.hist, notes);
      const m = matchRaga(st.hist);
      const returning = m?.raga.id === st.journey.lastRaga; // a raga we shared before comes back sooner
      if (m && m.score >= 0.8 && st.phrases >= (returning ? 1 : 3) && m.raga.id !== st.emerged?.id) {
        st.emerged = m.raga;
        setEmerged(m.raga);
        story = returning ? `We're back in ${m.raga.name}. ${m.raga.story}` : `You've wandered into ${m.raga.name}. ${m.raga.story}`;
      }
    }

    // Remember which techniques you've used, so demonstrations can favour the ones you haven't.
    const j = st.journey;
    if (notes.some((n) => n.glide)) j.heard.glide++;
    if (notes.some((n) => n.shape === 'swell')) j.heard.swell++;
    if (notes.some((n) => n.pulse)) j.heard.pulse++;
    if (notes.some((n) => n.shake)) j.heard.shake++;
    const unheard = (Object.keys(j.heard) as Technique[]).filter((k) => j.heard[k] === 0);

    const raga = chosen ?? st.emerged;
    const res = composeResponse(notes, { raga, exchange: st.exchange++, offer: st.offer, unheard });
    st.offer = res.offer;
    Object.assign(j, { exchanges: st.exchange, lastRaga: raga?.id ?? j.lastRaga });
    saveJourney(j);
    setPlayed(notes);
    setReply(res.notes);
    setWhisper(story ?? res.whisper);

    // Leading notes that came from the player can be sung back in the player's own sound.
    let own = 0;
    if (st.settings.ownVoice && rec && OWN_MOVES.has(res.move)) {
      while (own < res.notes.length && res.notes[own].at !== undefined) own++;
    }
    const source = (at: number) => notes.find((n) => n.at === at)!;
    const cents = (n: Note) => n.semi * 100 + (n.bend ?? 0);

    let t = ctx.currentTime + 0.15;
    const starts: number[] = [];
    const stops: (() => void)[] = [];
    if (own > 0) {
      const segs = res.notes.slice(0, own).map((n, i) => {
        const src = source(n.at!);
        const next = res.notes[i + 1];
        return {
          from: n.at! - (i === 0 ? 0.04 : 0),
          to: i + 1 < own ? next.at! : src.at! + src.dur + (own === res.notes.length ? 0.25 : 0.05),
          shift: cents(n) - cents(src), // 0 unless the companion corrected or moved this note
        };
      });
      const v = playOwnVoice(ctx, st.out!, rec!, segs, t);
      starts.push(...v.starts);
      stops.push(v.stop);
      t = v.end + 0.05;
    }
    const synth = res.notes.slice(own);
    const v = playPhrase(ctx, st.out!, synth, st.settings.saHz, t);
    stops.push(v.stop);
    synth.reduce((at, n) => (starts.push(at), at + n.dur), t);
    const end = synth.length ? v.end : t;
    st.stopVoice = () => stops.forEach((f) => f());

    // Light up each swara of the reply as it sounds.
    starts.forEach((at, i) => later(() => setReplyIdx(i), (at - ctx.currentTime) * 1000));
    st.muteUntil = end + TAIL;
    go('responding');
    later(() => {
      setReplyIdx(null);
      st.stopVoice = null;
      if (st.phase === 'responding') go('listening');
    }, (st.muteUntil - ctx.currentTime) * 1000);
  };

  /** One analysis frame, delivered by the capture worklet on the audio clock. */
  const onWindow = (buf: Float32Array, now: number) => {
    const st = s.current;
    const { ctx } = st;
    if (!ctx || st.phase === 'idle') return;

    const lvl = rms(buf);
    const on = Math.max(0.012, st.floor * 3);
    const off = on * 0.6;

    if (now < st.muteUntil) return; // the companion must not hear itself
    if (st.awaitQuiet) {
      if (lvl > off) return;
      st.awaitQuiet = false;
    }
    // Record the newest hop of samples: the phrase itself, or a short pre-roll while waiting.
    st.chunks.push({ t: now, data: buf.slice(buf.length >> 1) });
    if (st.phase !== 'playing' && st.chunks.length > PREROLL) st.chunks.shift();

    const inPhrase = st.phase === 'playing' || st.phase === 'tuning';
    const p = lvl > off ? yin(buf, ctx.sampleRate) : null;
    // Airy tone is still a note: accept clarity ≥ 0.6 (breath-expression-analysis skill).
    const raw = p && p.clarity > 0.6 ? hzToCents(p.hz, st.settings.saHz) : null;
    const cents = raw !== null && raw >= FLUTE_LOW ? raw : null; // drone and hum are not the flute
    const loud = lvl > on && cents !== null;
    if (!inPhrase && lvl <= on) st.floor = st.floor * 0.98 + lvl * 0.02;
    const db = 20 * Math.log10(Math.max(lvl, 1e-6));
    const air = p ? 1 - p.clarity : 1;
    if (loud) st.heardAt = now;

    // Show a swara only once 3 frames agree — transitions between notes would flash false swaras.
    st.recent = [...st.recent.slice(-2), cents];
    const steady = st.recent.length === 3 && st.recent.every((c) => c !== null && Math.abs(c - cents!) < 40);
    if (++st.tick % 2 === 0) {
      setLevel(Math.min(1, lvl * 6));
      setLiveSemi((prev) => (steady ? Math.round(cents! / 100) : cents === null ? null : prev)); // hold through transitions
    }

    if (st.phase === 'tuning') {
      // Tune on the raw pitch: the old Sa may be wrong by an octave, so no flute-range filter here.
      if (!(p && p.clarity > 0.6 && lvl > on)) return;
      const median = () => [...st.tuneHz].sort((a, b) => a - b)[st.tuneHz.length >> 1];
      if (st.tuneHz.length > 4 && Math.abs(1200 * Math.log2(p.hz / median())) > TUNE_STEADY) {
        st.tuneHz = []; // it moved — a Sa has to be held, so start the hold again
        setWhisper('Hold it steady — one long, easy Sa…');
      }
      st.tuneHz.push(p.hz);
      const progress = Math.min(1, (st.tuneHz.length * st.hopSec) / TUNE_TIME);
      setTuneProgress(progress);
      if (progress >= 1) {
        setSettings((prev) => ({ ...prev, saHz: median(), tuned: true }));
        setWhisper("That's your Sa — everything I play will sit on it. Now play anything.");
        setTuneProgress(0);
        st.awaitQuiet = true; // the Sa is still sounding — it is not a phrase
        st.recent = [];
        setLiveSemi(null); // it was named against the old Sa
        go('listening');
      }
      return;
    }

    if (st.phase === 'listening' && loud) {
      go('playing');
      st.frames = [];
      st.phraseStart = now;
    }
    if (st.phase !== 'playing') return;

    const sounding = lvl > off && cents !== null;
    st.frames.push({ t: now, cents: sounding ? cents : null, db, air });
    if (!sounding) st.silenceStart ??= now;
    else st.silenceStart = null;

    const quietLongEnough = st.silenceStart !== null && now - st.silenceStart > SILENCE_TO_END;
    if (quietLongEnough || now - st.phraseStart > MAX_PHRASE) {
      st.silenceStart = null;
      const phrasePeak = Math.max(...st.frames.map((f) => f.db));
      st.peakDb = Math.max(st.peakDb - 1, phrasePeak); // slowly forgets, so a quieter room re-scales
      const notes = segmentNotes(st.frames, st.peakDb);
      setLastPhrase({ frames: st.frames, refDb: st.peakDb, notes, saHz: st.settings.saHz });
      const rec = toRecording(ctx, st.chunks);
      st.chunks = [];
      if (notes.reduce((a, n) => a + n.dur, 0) < 0.25) return go('listening'); // a breath, not a phrase
      respond(notes, rec);
    }
  };

  const toRecording = (ctx: AudioContext, chunks: { t: number; data: Float32Array }[]): Recording | null => {
    if (!chunks.length) return null;
    const hop = chunks[0].data.length;
    const buffer = ctx.createBuffer(1, hop * chunks.length, ctx.sampleRate);
    chunks.forEach((c, i) => buffer.copyToChannel(c.data, 0, i * hop));
    return { buffer, t0: chunks[0].t };
  };

  const keepAwake = async () => {
    try {
      s.current.wakeLock = await navigator.wakeLock?.request('screen');
    } catch {
      /* not supported or denied: the screen may sleep, listening continues */
    }
  };

  const begin = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const ctx = await ensureAudio();
      const st = s.current;
      // Served from public/ as a real file: worklets can't load from inlined data: URLs everywhere.
      st.worklet ??= ctx.audioWorklet.addModule(`${import.meta.env.BASE_URL}capture.worklet.js`);
      await st.worklet;
      const source = ctx.createMediaStreamSource(stream);
      const capture = new AudioWorkletNode(ctx, 'capture');
      const sink = ctx.createGain();
      sink.gain.value = 0; // keeps the worklet pulled by the graph without sounding the mic
      source.connect(capture).connect(sink).connect(ctx.destination);
      capture.port.onmessage = (e) => onWindow(e.data.win, e.data.t - st.hopSec);
      st.journey = loadJourney();
      const back = st.journey.exchanges > 0;
      Object.assign(st, {
        stream, source, capture, hopSec: 1024 / ctx.sampleRate, offer: null,
        heardAt: ctx.currentTime, exchange: Math.min(st.journey.exchanges, MAX_RESUME), phrases: 0, peakDb: -Infinity, hist: Array(12).fill(0),
      });
      const last = back && st.journey.lastRaga ? ragaById(st.journey.lastRaga) : null;
      const welcome = back ? (last ? `Welcome back. Last time we wandered in ${last.name}. ` : 'Welcome back. ') : '';
      keepAwake();
      if (st.settings.tuned) {
        setWhisper(`${welcome}I'm listening. Play a phrase, then let it rest.`);
        go('listening');
      } else {
        // First time with this flute: the opening exchange is Sa itself.
        st.tuneHz = [];
        setWhisper('Before we play — give me your Sa. Play it and hold it, long and easy.');
        go('tuning');
      }
    } catch (err) {
      const name = (err as DOMException)?.name;
      setError(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Your browser blocked the microphone. Allow it from the address bar, then try again.'
          : 'I couldn\'t reach a microphone. Check that one is connected and selected.',
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rest = useCallback(() => {
    const st = s.current;
    st.timers.forEach((id) => window.clearTimeout(id));
    st.stopVoice?.();
    st.stream?.getTracks().forEach((t) => t.stop());
    st.capture?.port.close();
    st.capture?.disconnect();
    st.source?.disconnect();
    st.wakeLock?.release().catch(() => {});
    Object.assign(st, { stream: null, source: null, capture: null, wakeLock: null, timers: [], stopVoice: null, frames: [], emerged: null, muteUntil: 0, offer: null });
    setReplyIdx(null);
    setEmerged(null);
    setLevel(0);
    setLiveSemi(null);
    setWhisper('');
    go('idle');
  }, []);

  const tuneSa = useCallback(() => {
    s.current.tuneHz = [];
    setTuneProgress(0);
    setWhisper('Play your Sa and hold it steady…');
    go('tuning');
  }, []);

  const toggleDrone = useCallback(async () => {
    const st = s.current;
    if (st.stopDrone) {
      st.stopDrone();
      st.stopDrone = null;
      setDroneOn(false);
    } else {
      const ctx = await ensureAudio();
      st.stopDrone = startDrone(ctx, st.out!, st.settings.saHz);
      setDroneOn(true);
    }
  }, []);

  // Retune a running drone when Sa changes.
  useEffect(() => {
    const st = s.current;
    if (!st.stopDrone || !st.ctx) return;
    st.stopDrone();
    st.stopDrone = startDrone(st.ctx, st.out!, settings.saHz);
  }, [settings.saHz]);

  // A wake lock is released whenever the page is hidden; take it back on return.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && s.current.stream) keepAwake();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Gentle nudge if nothing is coming in.
  useEffect(() => {
    if (phase !== 'listening') return;
    const id = window.setInterval(() => {
      const st = s.current;
      if (st.ctx && st.ctx.currentTime - st.heardAt > 8 && st.exchange === 0) {
        setWhisper("I can't hear you yet — is the right microphone selected?");
      }
    }, 2000);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(
    () => () => {
      const st = s.current;
      st.timers.forEach((id) => window.clearTimeout(id));
      st.capture?.port.close();
      st.stopDrone?.();
      st.stream?.getTracks().forEach((t) => t.stop());
      if (st.ctx && st.ctx.state !== 'closed') st.ctx.close();
      Object.assign(st, { ctx: null, out: null, stopDrone: null, worklet: null });
    },
    [],
  );

  const chooseRaga = (ragaId: string) => {
    s.current.emerged = null;
    setEmerged(null);
    setSettings((p) => ({ ...p, ragaId }));
  };

  return {
    phase, level, liveSemi, played, reply, replyIdx, whisper, error, settings, droneOn,
    raga: ragaById(settings.ragaId) ?? emerged,
    begin, rest, tuneSa, toggleDrone, chooseRaga,
    tuneProgress, lastPhrase,
    setOwnVoice: (ownVoice: boolean) => setSettings((p) => ({ ...p, ownVoice })),
    forget: () => {
      saveJourney(FRESH);
      Object.assign(s.current, { journey: { ...FRESH, heard: { ...FRESH.heard } }, exchange: 0, offer: null });
      setWhisper("I've let go of our history. We begin again, fresh.");
    },
    // A new key is only a guess at Sa (and its octave) — ask to hear it again.
    setSa: (saHz: number) => {
      setSettings((p) => ({ ...p, saHz, tuned: false }));
      if (s.current.phase === 'listening') tuneSa();
    },
  };
}
