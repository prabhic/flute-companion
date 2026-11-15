// Self-check for the pure music + DSP core. Run: npm run check
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { caughtPhrase, freshPractice, practiceFocus, practiceTurn, restorePractice } from './practice.ts';
import { yin } from '../audio/pitch.ts';
import { segmentNotes, type Frame } from '../audio/phrase.ts';
import { matchRaga, addToHistogram, ragaById, RAGAS } from './ragas.ts';
import { composeResponse } from './companion.ts';
import { semiToHz, swara, pc } from './swara.ts';
import { bol, nextSam, respondBeat, toBeat, type Hit } from './rhythm.ts';
import { createOnsets, detectOnsets } from '../audio/onset.ts';

const seeded = (s = 7) => {
  const next = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 10; i++) next(); // small seeds start near 0 — warm up
  return next;
};

// YIN: within 5 cents on a breathy two-harmonic tone across the bansuri range.
const sr = 48000;
const rng = seeded();
for (const f of [196, 330, 440, 880, 1760]) {
  const buf = new Float32Array(2048).map((_, i) =>
    Math.sin((2 * Math.PI * f * i) / sr) + 0.3 * Math.sin((4 * Math.PI * f * i) / sr) + 0.05 * (rng() - 0.5));
  const r = yin(buf, sr);
  assert.ok(r, `no pitch at ${f}`);
  assert.ok(Math.abs(1200 * Math.log2(r.hz / f)) < 5, `${f}Hz detected as ${r.hz}`);
}
const noiseP = yin(new Float32Array(2048).map(() => rng() - 0.5), sr);
assert.ok(!noiseP || noiseP.clarity < 0.6, 'noise should be unvoiced');
// Airy bansuri tone: heavy breath noise must not hide the pitch.
const airy = new Float32Array(2048).map((_, i) => Math.sin((2 * Math.PI * 440 * i) / sr) + 0.9 * (rng() - 0.5));
const airyP = yin(airy, sr);
assert.ok(airyP && airyP.clarity > 0.6 && Math.abs(1200 * Math.log2(airyP.hz / 440)) < 20, `airy tone lost: ${JSON.stringify(airyP)}`);

// Segmentation: Sa held, glide up to Pa, silence, Ga.
const frames: Frame[] = [];
let t = 0;
const push = (c: number | null, n: number) => { for (let i = 0; i < n; i++) frames.push({ t: (t += 1 / 60), cents: c === null ? null : c + (i % 2 ? 8 : -8), db: c === null ? -60 : -20, air: 0.1 }); };
push(0, 20);
for (let c = 90; c < 700; c += 90) push(c, 1);
push(700, 20);
push(null, 10);
push(400, 15);
const notes = segmentNotes(frames);
assert.deepEqual(notes.map((n) => n.semi), [0, 7, 4]);
assert.equal(notes[1].glide, true, 'meend into Pa');
assert.ok(!notes[2].glide, 'silence is not a meend');

// Breath expression: build frames from (cents, db) functions of time within the note.
const breathe = (secs: number, cents: (x: number) => number | null, db: (x: number) => number) =>
  Array.from({ length: Math.round(secs * 60) }, (_, i) => ({ t: i / 60, cents: cents(i / 60), db: db(i / 60), air: 0.1 }));
const at = (x: number, ...spans: [number, number, number][]) => spans.find(([a, b]) => x >= a && x < b)?.[2];

// Three breath pulses on one Sa (voiced dips) → three notes, not one long Sa.
const pulsed = segmentNotes(breathe(1.5, () => 0, (x) => at(x, [0.45, 0.52, -29], [0.97, 1.04, -29]) ?? -20));
assert.deepEqual(pulsed.map((n) => [n.semi, !!n.pulse]), [[0, false], [0, true], [0, true]], 'breath pulses split the note');
// A ramped dip (as real breath does) must not mark the note before it as a fade.
const ramped = segmentNotes(breathe(1.5, () => 0, (x) => (x > 0.35 && x < 0.52 ? -20 - 9 * Math.sin(Math.PI * (x - 0.35) / 0.17) : -20)));
assert.ok(ramped.length === 2 && !ramped[0].shape, `pulse is not a fade ${JSON.stringify(ramped)}`);
// Deep breath dip (pitch drops out AND loudness drops) is also the player, not a glitch.
const deep = segmentNotes(breathe(1, (x) => (x > 0.45 && x < 0.5 ? null : 0), (x) => (x > 0.45 && x < 0.5 ? -40 : -20)));
assert.equal(deep.length, 2, 'loudness dip keeps notes apart');
// Pitch dropout at steady loudness is a detector glitch → merged.
const glitch = segmentNotes(breathe(1, (x) => (x > 0.45 && x < 0.5 ? null : 0), () => -20));
assert.equal(glitch.length, 1, 'dropout without breath dip is merged');

// Same notes, different strength → different dyn.
const softStrong = segmentNotes(breathe(1, (x) => (x < 0.5 ? 0 : 700), (x) => (x < 0.5 ? -38 : -16)));
assert.ok(softStrong[1].dyn! - softStrong[0].dyn! > 0.5, 'soft Sa, strong Pa');
assert.ok(segmentNotes(breathe(1, () => 400, (x) => -35 + 20 * x))[0].shape === 'swell', 'swell');
assert.ok(segmentNotes(breathe(1, () => 400, (x) => -15 - 20 * x))[0].shape === 'fade', 'fade');
const trem = segmentNotes(breathe(1, () => 700, (x) => -20 + 3 * Math.sin(2 * Math.PI * 5 * x)))[0];
assert.ok(trem.tremolo && !trem.shake, `breath tremolo ${JSON.stringify(trem)}`);
const andolan = segmentNotes(breathe(1.2, (x) => 100 + 30 * Math.sin(2 * Math.PI * 2 * x), () => -20))[0];
assert.ok(andolan.shake && andolan.shake >= 20 && !andolan.tremolo, `andolan ${JSON.stringify(andolan)}`);
assert.ok(segmentNotes(breathe(0.6, () => 0, (x) => (x < 0.1 ? -12 : -20)))[0].accent, 'accent');
assert.ok(!segmentNotes(breathe(1.1, () => 700, (x) => -12 - 25 * x))[0].accent, 'a fade is not an accent');
assert.equal(segmentNotes(breathe(0.6, () => -30, () => -20))[0].bend, -30, 'lip shading kept');
const plain = segmentNotes(breathe(1, () => 0, () => -20))[0];
assert.ok(!plain.pulse && !plain.accent && !plain.shape && !plain.tremolo && !plain.shake, 'steady note has no invented expression');

// Raga matching prefers the smallest raga that explains the phrase.
const bhupaliPhrase = [0, 2, 4, 7, 9, 7, 4, 2, 0].map((semi) => ({ semi, dur: 0.4 }));
assert.equal(matchRaga(addToHistogram(Array(12).fill(0), bhupaliPhrase))!.raga.id, 'bhupali');
const yamanPhrase = [-1, 2, 4, 6, 7, 9, 11, 12].map((semi) => ({ semi, dur: 0.4 }));
assert.equal(matchRaga(addToHistogram(Array(12).fill(0), yamanPhrase))!.raga.id, 'yaman');
for (const r of RAGAS) assert.ok(r.pakad.every((s) => r.notes.includes(pc(s))), `${r.id} pakad stays in raga`);

// Companion: responses stay in raga, in range, and early exchanges mostly echo.
const bhupali = ragaById('bhupali');
const played = [{ semi: 0, dur: 0.5 }, { semi: 2, dur: 0.3 }, { semi: 5, dur: 0.6 }]; // Ma is outside Bhupali
const r0 = composeResponse(played, { raga: bhupali, exchange: 0 }, seeded(1));
assert.ok(r0.notes.every((n) => bhupali.notes.includes(pc(n.semi))), 'snapped into raga');
for (let x = 0; x < 12; x++) {
  for (let s = 1; s < 20; s++) {
    const r = composeResponse(played, { raga: x > 2 ? bhupali : null, exchange: x }, seeded(s));
    assert.ok(r.notes.length > 0 && r.whisper);
    assert.ok(r.notes.every((n) => n.semi >= -5 && n.semi <= 19 && n.dur > 0), `range/dur ${r.move}`);
    assert.doesNotMatch(r.whisper, /\d|%|wrong|score/i, 'whispers never grade');
  }
}
const unknown = composeResponse(played, { raga: null, exchange: 5 }, seeded(3));
assert.ok(unknown.notes.every((n) => [0, 2, 5, 7].includes(pc(n.semi))), 'no foreign notes before raga emerges');

// Companion mirrors breath: strength, pulses and accents survive the echo.
const breathPhrase = [{ semi: 0, dur: 0.4, dyn: 0.3 }, { semi: 0, dur: 0.4, dyn: 0.8, pulse: true }, { semi: 0, dur: 0.4, dyn: 0.8, pulse: true, accent: true }];
const e = composeResponse(breathPhrase, { raga: bhupali, exchange: 0 }, seeded(2));
assert.equal(e.move, 'echo');
assert.deepEqual(e.notes.map((n) => [n.dyn, !!n.pulse]), [[0.3, false], [0.8, true], [0.8, true]], 'echo keeps breath');
assert.doesNotMatch(e.whisper, /\d/);
const moves = new Set(Array.from({ length: 40 }, (_, k) => composeResponse(breathPhrase, { raga: bhupali, exchange: 4 }, seeded(k + 1))));
const br = [...moves].find((r) => r.move === 'breath');
assert.ok(br, 'breath move is offered when the player pulses');
assert.ok(br.notes.every((n) => n.semi === 2) && br.notes.filter((n) => n.pulse).length === 2, 'same breaths, one raga step up');

// The guru leads: offers a phrase, recognises when it's caught, replays it after a miss.
let lead = null as ReturnType<typeof composeResponse> | null;
for (let k = 1; k < 60 && !lead; k++) {
  const r = composeResponse(bhupaliPhrase.slice(0, 5), { raga: bhupali, exchange: 8 }, seeded(k));
  if (r.move === 'lead') lead = r;
}
assert.ok(lead && lead.offer, 'companion sometimes leads once a raga is known');
assert.ok(lead.notes.every((n) => bhupali.notes.includes(pc(n.semi))), 'offered phrase stays in raga');
for (let k = 1; k < 30; k++) {
  assert.notEqual(composeResponse(played, { raga: null, exchange: 8 }, seeded(k)).move, 'lead', 'no leading before a raga');
  assert.notEqual(composeResponse(played, { raga: bhupali, exchange: 1 }, seeded(k)).move, 'lead', 'no leading before trust');
}
const offer = lead.offer!;
const caught = composeResponse(offer.notes.map((n) => ({ ...n })), { raga: bhupali, exchange: 9, offer }, seeded(4));
assert.equal(caught.offer, null);
assert.match(caught.whisper, /caught/);
const wrong = offer.notes.map((n, i) => ({ ...n, semi: i === 1 ? n.semi + 1 : n.semi + (i > 1 ? 5 : 0) }));
const retry = composeResponse(wrong, { raga: bhupali, exchange: 9, offer }, seeded(4));
assert.deepEqual([retry.move, retry.offer?.tries, retry.notes], ['lead', 1, offer.notes], 'a miss replays the same phrase');
assert.match(retry.whisper, /listen for the/);
assert.doesNotMatch(retry.whisper, /\d|wrong|score/i);
const letGo = composeResponse(wrong, { raga: bhupali, exchange: 9, offer: { ...offer, tries: 2 } }, seeded(4));
assert.equal(letGo.offer, null, 'after two tries the guru lets it go');

// Demonstrations favour techniques the player hasn't used yet.
const longPhrase = [0, 2, 4, 7].map((semi) => ({ semi, dur: 0.8 }));
const demos = (unheard: ('glide' | 'swell')[]) => Array.from({ length: 60 }, (_, k) =>
  composeResponse(longPhrase, { raga: bhupali, exchange: 5, unheard }, seeded(k + 1))).filter((r) => r.move === 'ornament');
const swellShare = (rs: ReturnType<typeof demos>) => rs.filter((r) => r.notes.some((n) => n.shape === 'swell')).length / rs.length;
assert.ok(swellShare(demos(['swell'])) > swellShare(demos([])), 'unheard swell is demonstrated more');

// Swara labels + just tuning.
assert.equal(swara(6).roman, 'tivra Ma');
assert.equal(swara(-3).short, '.Dha');
assert.equal(semiToHz(7, 300), 450);
assert.equal(semiToHz(12, 300), 600);

// Beat mode: onsets on a synthetic tap stream, timed to a block, deep vs bright told apart.
{
  const len = sr * 2;
  const sig = new Float32Array(len).map(() => 0.001 * (rng() - 0.5));
  const strokes = [[0.2, 90], [0.45, 900], [0.7, 900], [0.95, 90]] as const;
  for (const [at, f] of strokes) {
    for (let i = 0; i < 0.15 * sr; i++) sig[Math.round(at * sr) + i] += 0.5 * Math.exp(-i / sr / 0.04) * Math.sin((2 * Math.PI * f * i) / sr);
  }
  const st = createOnsets();
  const found: Hit[] = [];
  for (let end = 2048; end <= len; end += 1024) found.push(...detectOnsets(st, sig.subarray(end - 2048, end), end / sr, sr));
  assert.equal(found.length, 4, `four strokes, got ${JSON.stringify(found)}`);
  found.forEach((h, i) => assert.ok(Math.abs(h.t - strokes[i][0]) < 0.006, `onset ${i} at ${h.t}`));
  assert.deepEqual(found.map((h) => h.low), [true, false, false, true], 'bayan vs dayan');
}
// Grid: Dha · Na Na | Dha · Na Na at 0.25s steps with human jitter → a 4-step cycle.
{
  const jit = [0, 0.015, -0.012, 0.01, -0.008, 0.014];
  const hits: Hit[] = [0, 2, 3, 4, 6, 7].map((p, i) => ({ t: 1 + p * 0.25 + jit[i], db: p % 4 === 0 ? -10 : -16, low: p % 4 === 0 }));
  const b = toBeat(hits)!;
  assert.ok(Math.abs(b.step - 0.25) < 0.01, `step ${b.step}`);
  assert.equal(b.slots.map(bol).join(' '), 'Ge · Ta Ta', 'repeat found, strokes named');
  assert.ok(Math.abs(nextSam(b, 3.1) - 4) < 0.05, 'reply lands on the next sam');
  for (let x = 0; x < 12; x++) for (let k = 1; k < 10; k++) {
    const r = respondBeat(b, x, seeded(k));
    assert.ok(r.slots.length >= b.slots.length && r.whisper);
    assert.doesNotMatch(r.whisper, /\d|%|wrong|score/i, 'beat whispers never grade');
    if (r.move === 'tihai') {
      assert.equal(r.slots.length % b.slots.length, 1, 'tihai ends on a sam');
      assert.equal(bol(r.slots[r.slots.length - 1]), 'Dha');
    }
  }
  assert.equal(respondBeat(b, 0, seeded(1)).move, 'echo', 'first reply echoes');
  // Real hands: 3 cycles of an 8-step theka, ±25ms drift and a bounce. Every player gets a prompt
  // reply (never silence, never a whole long cycle's wait), and nearly all get the 8-step cycle.
  let right = 0;
  for (let k = 1; k <= 50; k++) {
    const jr = seeded(k);
    const messy: Hit[] = [];
    for (let c = 0; c < 3; c++) [0, 1, 2, 3, 4, 6, 7].forEach((i) => messy.push({ t: (c * 8 + i) * 0.22 + (jr() * 2 - 1) * 0.025, db: -12 - jr() * 8, low: i % 4 === 0 }));
    messy.push({ t: messy[4].t + 0.07, db: -30, low: false });
    messy.sort((x, y) => x.t - y.t);
    const mb = toBeat(messy);
    assert.ok(mb, `messy beat ${k} got no reply`);
    const endT = messy[messy.length - 1].t + 1;
    assert.ok(nextSam(mb, endT) - endT < 0.5, `messy beat ${k}: reply waits too long`);
    if (mb.slots.length === 8 && Math.abs(mb.step - 0.22) < 0.01) right++;
  }
  assert.ok(right >= 48, `messy beats: only ${right}/50 heard as the 8-step cycle`);
  // Uneven phrase (5 steps) rounds up to a cycle of 8; no pattern from two taps.
  assert.equal(toBeat([0, 1, 2, 4].map((p) => ({ t: p * 0.3, db: -12, low: false })))!.slots.length, 8);
  assert.equal(toBeat([{ t: 0, db: -10, low: true }, { t: 0.5, db: -10, low: true }]), null);
}

// Explicit practice choices mirror every note and breath, or alter only one pitch.
{
  const phrase = Array.from({ length: 15 }, (_, i) => ({ semi: [0, 2, 4][i % 3], dur: 0.3 + i / 20, restAfter: 0.12, dyn: 0.4, pulse: true, at: i }));
  const mirror = composeResponse(phrase, { raga: bhupali, exchange: 99, preference: 'echo' });
  assert.deepEqual(mirror.notes, phrase, 'explicit echo neither truncates nor stretches');
  const variation = composeResponse(phrase, { raga: bhupali, exchange: 99, preference: 'vary' });
  assert.equal(variation.notes.filter((n, i) => n.semi !== phrase[i].semi).length, 1);
  assert.deepEqual(variation.notes.map((n) => [n.dur, n.restAfter, n.dyn, n.pulse]), phrase.map((n) => [n.dur, n.restAfter, n.dyn, n.pulse]));
  assert.ok(notes[1].restAfter > 0.1, 'segmentation keeps the breath gap before Ga');
}

// Learning is earned by repetition, not time spent or unrelated notes.
{
  let memory = freshPractice();
  const seedMemory = JSON.stringify(memory);
  let offer = practiceTurn([], { memory, selected: 'follow', offer: null, turns: 0, leadNow: true });
  assert.deepEqual(offer.response.notes.map((n) => n.semi), [0, 0]);
  const miss = practiceTurn([{ semi: 7, dur: 0.5 }], { memory, selected: 'follow', offer: offer.response.offer, turns: 0 });
  assert.deepEqual(miss.memory, memory, 'a miss never advances the lesson');
  assert.ok(miss.response.notes[0].dur > offer.response.notes[0].dur, 'a missed phrase slows down');
  const pause = practiceTurn([{ semi: 7, dur: 0.5 }], { memory, selected: 'follow', offer: { ...offer.response.offer!, tries: 2 }, turns: 0 });
  assert.equal(pause.response.offer, null, 'give the learner breathing room');
  assert.deepEqual(pause.memory, memory);
  const source = offer.response.notes;
  assert.ok(caughtPhrase(source.map((n) => ({ ...n, semi: n.semi + 12, dur: n.dur * 1.5 })), source), 'slower and another octave are welcome');
  assert.ok(!caughtPhrase([{ semi: 0, dur: 0.5 }], source), 'a held Sa is not two breaths');
  assert.ok(!caughtPhrase(source.map((n, i) => ({ ...n, dur: i ? 3 : 0.1 })), source), 'note order alone is insufficient');
  assert.ok(!caughtPhrase([], []));

  // Walk the entire beginner path, preserving memory through a reload at every step.
  for (const raga of RAGAS) {
    const known = new Set<number>([0]);
    while (!practiceFocus(memory, raga.id).done) {
      const before = practiceFocus(memory, raga.id).step;
      for (let repeat = 0; repeat < 2; repeat++) {
        offer = practiceTurn([], { memory, selected: raga.id, offer: null, turns: 2, leadNow: true });
        assert.ok(offer.response.notes.every((n) => raga.notes.includes(pc(n.semi))));
        const unfamiliar = new Set(offer.response.notes.map((n) => pc(n.semi)).filter((n) => !known.has(n)));
        assert.ok(unfamiliar.size <= 1, 'no more than one new pitch class in a lesson');
        const learned = practiceTurn(offer.response.notes, { memory, selected: raga.id, offer: offer.response.offer, turns: 0 });
        memory = restorePractice(JSON.parse(JSON.stringify(learned.memory)));
        assert.equal(practiceFocus(memory, raga.id).step, before + repeat, 'advance only after revisiting');
      }
      offer.response.notes.forEach((n) => known.add(pc(n.semi)));
    }
    const stillHere = practiceTurn(bhupaliPhrase, { memory, selected: raga.id, offer: null, turns: 3 });
    assert.equal(stillHere.raga.id, raga.id, 'an explicitly chosen raga stays selected');
  }
  assert.equal(seedMemory, JSON.stringify(freshPractice()), 'fresh memory stays fresh');
  const completedBhupali = { ...freshPractice(), progress: { bhupali: memory.progress.bhupali } };
  const nextRaga = practiceTurn([], { memory: completedBhupali, selected: 'follow', offer: null, turns: 2, leadNow: true });
  assert.equal(nextRaga.raga.id, 'durga', 'discover mode moves to a new raga after familiarity');
  const restarted = practiceTurn([], { memory: restorePractice(JSON.parse(JSON.stringify(nextRaga.memory))), selected: 'follow', offer: null, turns: 2, leadNow: true });
  assert.equal(restarted.raga.id, 'durga', 'new raga survives a restart');
  assert.deepEqual(restorePractice({ ragaId: 'missing', progress: { bhupali: { step: -1, caught: 99 } } }), freshPractice());
  assert.deepEqual(restorePractice(null), freshPractice());
}

console.log('✓ music + DSP core checks passed');

// Real-playing fixtures (fixtures/README.md): recorded frames + what the player says they played.
// These, not the synthetic cases above, are the ground truth for every breath threshold.
type Expect = { semi: number; glide?: boolean; pulse?: boolean; accent?: boolean; shape?: string; sway?: 'tremolo' | 'shake' };
const dir = new URL('../../fixtures/', import.meta.url);
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
let failed = 0;
for (const file of files) {
  const fx = JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as { label: string; refDb: number; frames: Frame[]; expect: Expect[] };
  const heard: Expect[] = segmentNotes(fx.frames, fx.refDb).map((n) => ({
    semi: n.semi,
    ...(n.glide && { glide: true }),
    ...(n.pulse && { pulse: true }),
    ...(n.accent && { accent: true }),
    ...(n.shape && { shape: n.shape }),
    ...(n.tremolo && { sway: 'tremolo' as const }),
    ...(n.shake && { sway: 'shake' as const }),
  }));
  try {
    assert.deepEqual(heard, fx.expect);
    console.log(`  ✓ ${file} — ${fx.label}`);
  } catch {
    failed++;
    console.log(`  ✗ ${file} — ${fx.label}\n      expected ${JSON.stringify(fx.expect)}\n      heard    ${JSON.stringify(heard)}`);
  }
}
if (files.length) console.log(`${files.length - failed}/${files.length} real-playing fixtures agree`);
else console.log('  (no real-playing fixtures yet — see fixtures/README.md)');
if (failed) process.exit(1);
