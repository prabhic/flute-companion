import type { Frame } from '@/audio/phrase';
import type { Note } from '@/music/companion';
import { swara } from '@/music/swara';

interface Props {
  phrase: { frames: Frame[]; refDb: number; notes: Note[]; saHz: number } | null;
  onClose: () => void;
}

// What a fixture expects of each note — the fields a player can judge by ear.
const expectOf = (n: Note) => ({
  semi: n.semi,
  ...(n.glide && { glide: true }),
  ...(n.pulse && { pulse: true }),
  ...(n.accent && { accent: true }),
  ...(n.shape && { shape: n.shape }),
  ...(n.tremolo && { sway: 'tremolo' }),
  ...(n.shake && { sway: 'shake' }),
});

function save(phrase: NonNullable<Props['phrase']>) {
  const label = window.prompt('What did you play? (e.g. "three breath pushes on Sa")', '') ?? '';
  const fixture = {
    label,
    saHz: phrase.saHz,
    refDb: phrase.refDb,
    note: 'Edit "expect" to what you actually played, then put this file in fixtures/.',
    expect: phrase.notes.map(expectOf),
    frames: phrase.frames.map((f) => ({ t: +f.t.toFixed(4), cents: f.cents === null ? null : +f.cents.toFixed(1), db: +f.db.toFixed(2), air: +f.air.toFixed(3) })),
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(fixture, null, 1)], { type: 'application/json' }));
  a.download = `${(label || 'phrase').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

const cell = 'px-2 py-1 text-left';

/** Developer view: what the analysis heard, with numbers. Never shown in normal practice. */
export function HeardPanel({ phrase, onClose }: Props) {
  return (
    <aside className="fixed inset-x-0 bottom-0 z-50 max-h-[45vh] overflow-auto bg-card/95 border-t border-border p-4 text-xs font-mono">
      <div className="flex items-center justify-between mb-2 font-sans">
        <strong className="text-sm">What I heard</strong>
        <div className="flex gap-2">
          {phrase && (
            <button className="rounded border border-border px-2 py-1 hover:bg-muted" onClick={() => save(phrase)}>
              Save as fixture
            </button>
          )}
          <button className="rounded border border-border px-2 py-1 hover:bg-muted" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
      </div>
      {!phrase ? (
        <p className="font-sans text-muted-foreground">Play a phrase.</p>
      ) : (
        <table className="w-full">
          <thead className="text-muted-foreground">
            <tr>
              {['swara', 'dur s', 'dyn', 'pulse', 'accent', 'shape', 'tremolo dB', 'shake ¢', 'air', 'bend ¢', 'meend'].map((h) => (
                <th key={h} className={cell}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {phrase.notes.map((n, i) => (
              <tr key={i} className="border-t border-border/50">
                <td className={cell}>{swara(n.semi).short}</td>
                <td className={cell}>{n.dur.toFixed(2)}</td>
                <td className={cell}>{n.dyn?.toFixed(2)}</td>
                <td className={cell}>{n.pulse ? '●' : ''}</td>
                <td className={cell}>{n.accent ? '●' : ''}</td>
                <td className={cell}>{n.shape ?? ''}</td>
                <td className={cell}>{n.tremolo ?? ''}</td>
                <td className={cell}>{n.shake ?? ''}</td>
                <td className={cell}>{n.air?.toFixed(2)}</td>
                <td className={cell}>{n.bend ?? ''}</td>
                <td className={cell}>{n.glide ? '●' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </aside>
  );
}
