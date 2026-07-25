# Peter's Riff Adventure

**Play:** https://jeffreyruoss.github.io/peters-riff-adventure/

A 3D low-poly rhythm-survival side-scroller. You auto-run through a sunset valley
with a guitar; ghouls march at you from ahead. The only weapon is the song —
every note you nail on the fretboard fires a riff-bolt at the nearest one.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static bundle in dist/
npm run deploy   # build + force-push dist/ to the gh-pages branch
```

`npm run deploy` publishes from your machine rather than from CI, because a
GitHub Actions workflow file needs a token with the `workflow` scope. To move it
into CI instead, run `gh auth refresh -s workflow` and add
`.github/workflows/pages.yml`.

## Controls

| Key | Action |
| --- | --- |
| `A S D F G` | Frets (also `1–5`, or `H J K L ;`) |
| `Enter` / `Space` | Start / restart |
| `P` | Pause |

Hit a gem as it crosses the strike line. Timing grades are PERFECT / GREAT / GOOD;
a perfect hit does double damage. Every 10 notes of streak adds a score multiplier
(up to 6×), and every 25 heals you a little. Missing costs health and makes the
whole horde surge forward. Let one reach you and it takes a 12-point bite.

## How it works

**No audio files.** The entire soundtrack is synthesized in Web Audio — drums,
bass, and a distorted rhythm guitar are scheduled bar-by-bar from a chord loop
(Em–C–G–D at 132 BPM). The *lead* guitar is deliberately not scheduled: it only
sounds when you hit a note, so a clean run performs the melody and a sloppy one
sounds like a band missing its guitarist. Missed notes get a muted dead-string
thunk instead.

Because the chart and the music come from the same `AudioContext` clock, note
positions on the board are derived from `audio.currentTime` rather than frame
time — so the gems stay locked to the beat even if the framerate drops.

The chart itself is generated, not authored: each bar picks a sixteenth-grid
rhythm (unlocked by wave) and walks a pentatonic phrase. Lane = scale degree % 5,
which is why the fret pattern rises and falls with the melody instead of feeling
random.

### Source map

| File | Role |
| --- | --- |
| `src/audio.js` | Web Audio instrument synths (kick, snare, bass, chug, lead, FX) |
| `src/music.js` | Conductor: schedules the backing track and emits the note chart |
| `src/highway.js` | The fretboard — rendered as its own scene over the world |
| `src/world.js` | Terrain, props, runway, sky gradient, lighting |
| `src/entities.js` | Player, enemies, and the particle/ring/projectile FX pool |
| `src/main.js` | Game loop, input, judgement, scoring, cameras |

The fretboard is a separate scene drawn by a second `RenderPass` with
`clearDepth`, so it always composites over the world without the two ever
intersecting — and both still pass through the same bloom.

`window.__game` exposes live handles (`state`, cameras, `spawnEnemy`) for tuning
in the devtools console.
