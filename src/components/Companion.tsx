import { useEffect, useState } from 'react';
import { Drum, Headphones, Settings2, Waves } from 'lucide-react';
import { HeardPanel } from '@/components/HeardPanel';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useCompanion } from '@/hooks/useCompanion';
import { RAGAS } from '@/music/ragas';
import { BANSURI_KEYS, swara } from '@/music/swara';
import type { Note } from '@/music/companion';
import { bol, type Slot } from '@/music/rhythm';
import { cn } from '@/lib/utils';

// Octave-agnostic: a tuned Sa in any register still names its bansuri key.
const pcDistance = (a: number, b: number) => {
  const d = (((1200 * Math.log2(a / b)) % 1200) + 1200) % 1200;
  return Math.min(d, 1200 - d);
};
const nearestKey = (saHz: number) =>
  BANSURI_KEYS.reduce((a, b) => (pcDistance(b.saHz, saHz) < pcDistance(a.saHz, saHz) ? b : a));

const STATUS: Record<string, string> = {
  idle: 'Resting',
  starting: 'Opening our ears…',
  listening: 'Your turn',
  playing: "I'm listening",
  responding: 'Listen…',
  tuning: 'Hold your Sa',
};

// Breath shown, never measured: size/weight = strength, ˈ = accent, hairpin = swell/fade,
// wavy underline = tremolo or andolan (calm-practice-ux skill).
function Syllable({ n, active, tone }: { n: Note; active: boolean; tone: 'you' | 'me' }) {
  const dyn = n.dyn ?? 0.55;
  const sway = n.tremolo || n.shake;
  return (
    <span
      className={cn(
        'relative inline-flex flex-col items-center transition-all duration-300',
        tone === 'you' ? 'text-saffron' : 'text-moon',
        active && 'scale-125 drop-shadow-[0_0_8px_hsl(var(--moon))]',
        n.glide && 'italic',
      )}
      style={{
        fontSize: `${0.95 + dyn * 0.75}em`,
        fontWeight: dyn > 0.7 ? 600 : 400,
        opacity: active ? 1 : 0.45 + dyn * 0.4,
        textDecoration: sway ? 'underline wavy' : undefined,
        textUnderlineOffset: '0.3em',
        textDecorationThickness: '1px',
      }}
    >
      <span aria-hidden className="h-3 text-xs leading-none">{n.accent ? 'ˈ' : n.pulse ? '·' : ''}</span>
      <span>
        {n.glide && <span aria-hidden className="text-sm opacity-60">⌒</span>}
        {swara(n.semi).short}
      </span>
      {n.shape && (
        <svg aria-hidden viewBox="0 0 24 6" className="w-6 h-1.5 opacity-70">
          <path d={n.shape === 'swell' ? 'M1 3 L23 0.5 M1 3 L23 5.5' : 'M1 0.5 L23 3 M1 5.5 L23 3'} stroke="currentColor" strokeWidth="1" fill="none" />
        </svg>
      )}
    </span>
  );
}

function Ribbon({ notes, active, tone }: { notes: Note[]; active?: number | null; tone: 'you' | 'me' }) {
  if (!notes.length) return null;
  return (
    <div className="flex flex-wrap items-end justify-center gap-x-3 gap-y-1 font-display text-lg sm:text-xl min-h-[3rem]">
      {notes.map((n, i) => (
        <Syllable key={i} n={n} active={active === i} tone={tone} />
      ))}
    </div>
  );
}

// Beat mode: strokes named as tabla bols; size = accent, a dot = an empty step.
function BeatRibbon({ slots, active, tone }: { slots: Slot[]; active?: number | null; tone: 'you' | 'me' }) {
  if (!slots.length) return null;
  return (
    <div className={cn('flex flex-wrap items-end justify-center gap-x-2 gap-y-1 font-display text-lg sm:text-xl min-h-[3rem]', tone === 'you' ? 'text-saffron' : 'text-moon')}>
      {slots.map((s, i) => (
        <span
          key={i}
          className={cn('transition-all duration-150', active === i && 'scale-125 drop-shadow-[0_0_8px_hsl(var(--moon))]')}
          style={{ fontWeight: s?.accent ? 600 : 400, opacity: !s ? 0.3 : active === i ? 1 : s.soft ? 0.5 : 0.8 }}
        >
          {bol(s)}
          {s?.roll && <sup className="text-xs opacity-70">ra</sup>}
        </span>
      ))}
    </div>
  );
}

export function Companion() {
  const c = useCompanion();
  // Hidden developer view: ?heard in the URL, or press H.
  const [heard, setHeard] = useState(() => new URLSearchParams(window.location.search).has('heard'));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h' && !(e.target instanceof HTMLInputElement)) setHeard((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const running = c.phase !== 'idle';
  const replying = c.phase === 'responding';
  const canConfigure = c.phase === 'idle' || c.phase === 'listening';
  // While tuning, the old Sa is untrusted — don't name swaras against it.
  const beatMode = c.settings.mode === 'beat';
  const semi = c.phase === 'tuning' || beatMode ? null : replying ? (c.replyIdx !== null ? c.reply[c.replyIdx]?.semi : null) : c.liveSemi;
  const label = semi === null || semi === undefined ? null : swara(semi);
  const key = nearestKey(c.settings.saHz);

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-between gap-10 px-4 py-6 sm:py-10 overflow-hidden">
      <header className="w-full max-w-3xl flex items-start justify-between gap-4">
        <h1 className="font-display text-xl sm:text-2xl text-foreground/90 tracking-wide whitespace-nowrap">Echo Flute Flow</h1>
        {c.raga && (
          <p className="text-right text-sm text-moon/80 animate-fade-in max-w-[14rem]">
            <span className="font-display text-lg text-moon">{c.raga.name}</span>
            <br />
            {c.raga.time} · {c.raga.feel}
          </p>
        )}
      </header>

      <section className="flex flex-col items-center gap-6 w-full max-w-2xl">
        {!beatMode && (
          <div className="text-center space-y-3 mb-4">
            <p className="text-sm text-muted-foreground">Your flute friend · play, pause, listen, repeat</p>
            <div role="group" aria-label="How we play" className="flex flex-wrap justify-center gap-2">
              {([{ id: 'echo', label: 'Echo me' }, { id: 'vary', label: 'Vary a little' }, { id: 'learn', label: 'Learn together' }] as const).map((style) => (
                <Button key={style.id} size="sm" variant="ghost" disabled={!canConfigure}
                  aria-pressed={c.settings.style === style.id} onClick={() => c.setStyle(style.id)}
                  className={cn('rounded-full', c.settings.style === style.id && 'bg-moon/10 text-moon')}>
                  {style.label}
                </Button>
              ))}
            </div>
            {c.settings.style === 'learn' && <p className="text-sm text-moon">{c.focus}</p>}
          </div>
        )}
        {/* The orb: saffron breath when you play, moonlight when I answer. */}
        <div
          className={cn(
            'orb relative flex items-center justify-center rounded-full w-60 h-60 sm:w-72 sm:h-72',
            replying ? 'orb-moon' : running ? 'orb-saffron' : 'orb-idle',
            (c.phase === 'listening' || c.phase === 'idle') && 'orb-breathe',
          )}
          style={{ transform: `scale(${1 + (replying ? 0.12 : c.level * 0.3)})` }}
        >
          {c.phase === 'tuning' && (
            <svg aria-hidden viewBox="0 0 100 100" className="absolute -inset-5 w-[calc(100%+2.5rem)] h-[calc(100%+2.5rem)] -rotate-90">
              <circle
                cx="50" cy="50" r="48" fill="none" stroke="hsl(var(--saffron))" strokeWidth="1" strokeLinecap="round"
                pathLength={1} strokeDasharray={`${c.tuneProgress} 1`} className="transition-all duration-150"
              />
            </svg>
          )}
          <div className="text-center select-none">
            {beatMode && replying && c.replyIdx !== null ? (
              <div className="font-display text-6xl sm:text-7xl leading-none text-ink">{bol(c.beat.reply[c.replyIdx])}</div>
            ) : label ? (
              <>
                <div className="font-deva text-7xl sm:text-8xl leading-none text-ink">{label.deva}</div>
                <div className="mt-2 text-sm text-ink/70">
                  {label.roman}
                  {label.register !== 'madhya' && ` · ${label.register}`}
                </div>
              </>
            ) : (
              <div className="font-display text-xl text-ink/70">{STATUS[c.phase]}</div>
            )}
          </div>
        </div>

        <div className="space-y-3 min-h-[5rem]">
          {beatMode ? (
            <>
              <BeatRibbon slots={c.beat.heard} tone="you" />
              <BeatRibbon slots={c.beat.reply} active={replying ? c.replyIdx : null} tone="me" />
            </>
          ) : (
            <>
              <Ribbon notes={c.played} tone="you" />
              <Ribbon notes={c.reply} active={replying ? c.replyIdx : null} tone="me" />
            </>
          )}
        </div>

        <p aria-live="polite" key={c.whisper} className="font-display text-lg sm:text-xl text-foreground/80 text-center min-h-[3.5rem] animate-fade-in px-2">
          {c.error ?? (c.whisper || (beatMode ? 'Tap a little pattern, then leave room for my answer.' : 'Bring your flute. We’ll find your Sa, then take turns playing.'))}
        </p>
        {!beatMode && running && c.phase !== 'starting' && (
          <div className="flex flex-wrap justify-center gap-2" aria-label="Listen and repeat">
            {c.settings.style === 'learn' && <Button variant="outline" size="sm" className="rounded-full" disabled={c.phase !== 'listening'} onClick={c.lead}>You lead</Button>}
            <Button variant="ghost" size="sm" disabled={!c.canReplay || c.phase !== 'listening'} onClick={() => c.replay()}>Play it again</Button>
            <Button variant="ghost" size="sm" disabled={!c.canReplay || c.phase !== 'listening'} onClick={() => c.replay(true)}>Again, slower</Button>
          </div>
        )}
        {!running && <p className="text-xs text-muted-foreground text-center">We take turns: I listen while you play, then you listen to my reply.</p>}
      </section>

      <footer className="flex items-center gap-3">
        <Button
          size="lg"
          onClick={running ? c.rest : c.begin}
          className={cn(
            'rounded-full px-10 h-14 text-lg font-display',
            running ? 'bg-muted text-foreground hover:bg-muted/80' : 'bg-saffron text-ink hover:bg-saffron/90',
          )}
        >
          {c.phase === 'starting' ? 'Cancel' : running ? 'Rest' : 'Begin'}
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={c.toggleDrone}
          disabled={c.phase === 'starting' || c.phase === 'tuning'}
          aria-pressed={c.droneOn}
          aria-label={c.droneOn ? 'Stop tanpura drone' : 'Play tanpura drone'}
          title="Tanpura drone (headphones recommended)"
          className={cn('rounded-full h-12 w-12', c.droneOn && 'text-moon bg-moon/10')}
        >
          <Waves className="w-5 h-5" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          disabled={c.phase === 'starting'}
          onClick={() => c.setMode(beatMode ? 'flute' : 'beat')}
          aria-pressed={beatMode}
          aria-label={beatMode ? 'Back to flute' : 'Play beats with me'}
          title="Beats — on a tabla, a table, anything"
          className={cn('rounded-full h-12 w-12', beatMode && 'text-moon bg-moon/10')}
        >
          <Drum className="w-5 h-5" />
        </Button>

        <Sheet>
          <SheetTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="Settings" className="rounded-full h-12 w-12">
              <Settings2 className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="font-display text-2xl">Your bansuri</SheetTitle>
              <SheetDescription>Everything I play is tuned to your Sa.</SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-8">
              <div className="space-y-3">
                <label className="text-sm text-muted-foreground" htmlFor="key">Bansuri key</label>
                <select
                  id="key"
                  disabled={!canConfigure}
                  value={key.key}
                  onChange={(e) => c.setSa(BANSURI_KEYS.find((k) => k.key === e.target.value)!.saHz)}
                  className="w-full rounded-lg bg-input border border-border px-3 py-2"
                >
                  {BANSURI_KEYS.map((k) => (
                    <option key={k.key} value={k.key}>{k.key} bansuri</option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={c.tuneSa}
                  disabled={c.phase !== 'listening' || beatMode}
                >
                  Tune my Sa
                </Button>
                <p className="text-xs text-muted-foreground">
                  {c.phase === 'listening'
                    ? 'Tap, then play and hold your Sa.'
                    : running
                      ? 'Ready when it is your turn.'
                      : c.settings.tuned
                        ? 'Your Sa is tuned. Retune any time after Begin.'
                        : 'When you Begin, I will ask for your Sa first.'}
                </p>
              </div>

              <label className="flex items-start justify-between gap-4 cursor-pointer">
                <span>
                  <span className="block">Echo in your own sound</span>
                  <span className="block text-xs text-muted-foreground">
                    I replay your breath and tone, touching only the notes I correct. Off: I answer on my own flute.
                  </span>
                </span>
                <Switch checked={c.settings.ownVoice} onCheckedChange={c.setOwnVoice} />
              </label>

              <fieldset className="space-y-2">
                <legend className="text-sm text-muted-foreground mb-2">Wander in…</legend>
                {[{ id: 'follow', name: c.settings.style === 'learn' ? 'Discover together' : 'Follow me', time: c.settings.style === 'learn' ? 'new notes, then new ragas' : 'let the raga find us', feel: '' }, ...RAGAS].map((r) => (
                  <label
                    key={r.id}
                    className={cn(
                      'flex items-baseline gap-3 rounded-lg px-3 py-2 cursor-pointer border border-transparent',
                      c.settings.ragaId === r.id && 'border-moon/40 bg-moon/5',
                    )}
                  >
                    <input
                      type="radio"
                      name="raga"
                      disabled={!canConfigure}
                      className="accent-[hsl(var(--moon))]"
                      checked={c.settings.ragaId === r.id}
                      onChange={() => c.chooseRaga(r.id)}
                    />
                    <span className="font-display text-lg">{r.name}</span>
                    <span className="text-xs text-muted-foreground">{[r.time, r.feel].filter(Boolean).join(' · ')}</span>
                  </label>
                ))}
              </fieldset>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  I remember, on this device only, how far our dialogue has come, our last raga, and which breath
                  techniques and little phrases we’ve explored — so I can pick up where we left off. Your recordings stay in memory only while we play.
                </p>
                <Button variant="ghost" size="sm" className="px-0 text-muted-foreground hover:text-foreground" disabled={!canConfigure} onClick={c.forget}>
                  Forget our history
                </Button>
              </div>

              <p className="flex gap-2 text-xs text-muted-foreground">
                <Headphones className="w-4 h-4 shrink-0" />
                With headphones I hear only you, and the drone won't confuse my ears.
              </p>
            </div>
          </SheetContent>
        </Sheet>
      </footer>

      <p className="sr-only" aria-live="polite">{STATUS[c.phase]}</p>
      {heard && <HeardPanel phrase={c.lastPhrase} onClose={() => setHeard(false)} />}
    </main>
  );
}
