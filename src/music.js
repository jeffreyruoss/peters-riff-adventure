// Conductor: schedules the backing track bar-by-bar and emits the playable
// note chart. Playable notes are NOT auto-played — the lead guitar only sounds
// when the player hits them, so a good run literally performs the melody.

export const BPM = 132;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const STEP = BEAT / 4; // sixteenth
const LOOKAHEAD = 2.6; // seconds of chart generated ahead of the audio clock

// E minor pentatonic, two octaves. Lane = degree % 5, so the melody line and
// the fret lanes rise and fall together.
const PENT = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22];
const ROOT = 52; // E3

// Em - C - G - D
const PROGRESSION = [
  { bassRoot: 28, chugRoot: 40 },
  { bassRoot: 24, chugRoot: 36 },
  { bassRoot: 31, chugRoot: 43 },
  { bassRoot: 26, chugRoot: 38 },
];

// Sixteenth-grid rhythms, unlocked as the run escalates.
const RHYTHMS = [
  { tier: 0, slots: [0, 4, 8, 12] },
  { tier: 0, slots: [0, 4, 6, 8, 12] },
  { tier: 0, slots: [0, 2, 4, 8, 10, 12] },
  { tier: 1, slots: [0, 3, 6, 8, 11, 14] },
  { tier: 1, slots: [0, 2, 4, 6, 8, 12, 14] },
  { tier: 2, slots: [0, 1, 2, 4, 6, 8, 9, 10, 12, 14] },
  { tier: 2, slots: [0, 2, 3, 5, 6, 8, 10, 11, 13, 14] },
  { tier: 3, slots: [0, 1, 2, 3, 4, 6, 8, 9, 10, 11, 12, 14] },
];

// Melodic contours over the pentatonic degrees.
const PHRASES = [
  [0, 1, 2, 1, 3, 2, 1, 0, 2, 3, 4, 3, 2, 1, 0, 1],
  [4, 3, 2, 3, 1, 2, 0, 1, 2, 1, 3, 4, 5, 4, 3, 2],
  [0, 2, 4, 2, 5, 4, 2, 0, 1, 3, 5, 3, 6, 5, 3, 1],
  [5, 4, 5, 6, 4, 3, 4, 2, 3, 2, 1, 2, 0, 1, 2, 3],
  [2, 2, 4, 4, 3, 3, 1, 1, 0, 2, 4, 6, 5, 3, 1, 0],
];

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Music {
  constructor(audio) {
    this.audio = audio;
    this.rand = mulberry32(1337);
    this.reset();
  }

  reset() {
    this.startTime = 0;
    this.nextBar = 0;
    this.pending = [];
    this.rand = mulberry32(Math.floor(Math.random() * 1e9));
  }

  start() {
    this.reset();
    // One empty bar of count-in so the first notes are readable.
    this.startTime = this.audio.now() + 0.4;
  }

  barTime(bar) {
    return this.startTime + bar * BAR;
  }

  get elapsed() {
    return this.audio.now() - this.startTime;
  }

  get bar() {
    return Math.floor(this.elapsed / BAR);
  }

  // 0..1 sawtooth within the current beat, for visual pulsing.
  beatPhase() {
    const b = this.elapsed / BEAT;
    return b - Math.floor(b);
  }

  waveAt(bar) {
    return 1 + Math.floor(Math.max(0, bar - 1) / 8);
  }

  // Generates ahead of the clock and returns any newly charted notes.
  update() {
    if (!this.startTime) return [];
    const horizon = this.audio.now() + LOOKAHEAD;
    let guard = 0;
    while (this.barTime(this.nextBar) < horizon && guard++ < 16) {
      this.scheduleBar(this.nextBar);
      this.nextBar++;
    }
    const out = this.pending;
    this.pending = [];
    return out;
  }

  scheduleBar(bar) {
    const a = this.audio;
    const t0 = this.barTime(bar);
    const wave = this.waveAt(bar);
    const chord = PROGRESSION[bar % 4];
    const intro = bar === 0;

    // --- Drums ---
    for (let i = 0; i < 16; i++) {
      const t = t0 + i * STEP;
      if (intro) {
        if (i % 4 === 0) a.hat(t, false, 0.5);
        if (i === 12) a.snare(t, 0.5);
        continue;
      }
      const kickHit = i === 0 || i === 6 || i === 8 || (wave >= 3 && i === 11) || (wave >= 5 && i === 3);
      if (kickHit) a.kick(t, 0.95);
      if (i === 4 || i === 12) a.snare(t);
      if (wave >= 4 && i === 14 && bar % 4 === 3) a.snare(t, 0.6);
      if (i % 2 === 0) a.hat(t, i === 14, i % 4 === 0 ? 1 : 0.6);
      if (wave >= 3 && i % 2 === 1) a.hat(t, false, 0.3);
    }
    if (!intro && bar % 8 === 0) a.crash(t0, 0.9);

    // --- Bass ---
    if (!intro) {
      const pattern = wave >= 3 ? [0, 3, 6, 8, 11, 14] : [0, 4, 8, 12];
      for (const i of pattern) {
        const oct = i === 0 ? 0 : this.rand() < 0.25 ? 12 : 0;
        a.bass(t0 + i * STEP, chord.bassRoot + oct, STEP * 1.6, 1);
      }
    }

    // --- Rhythm guitar chugs ---
    if (!intro) {
      for (let i = 0; i < 16; i += 2) {
        if (i === 4 || i === 12 || this.rand() < 0.75) {
          a.chug(t0 + i * STEP, chord.chugRoot, STEP * 1.4, i % 4 === 0 ? 1 : 0.7);
        }
      }
    }

    // --- Playable lead chart ---
    if (intro) return;
    const tier = Math.min(3, Math.floor((wave - 1) / 2));
    const options = RHYTHMS.filter((r) => r.tier <= tier);
    const rhythm = options[Math.floor(this.rand() * options.length)];
    const phrase = PHRASES[Math.floor(bar / 4) % PHRASES.length];
    const chordChance = wave >= 4 ? Math.min(0.3, 0.14 + wave * 0.02) : 0;

    rhythm.slots.forEach((slot, idx) => {
      const t = t0 + slot * STEP;
      const degree = phrase[(bar * 4 + idx) % phrase.length];
      const lane = degree % 5;
      const midi = ROOT + PENT[degree % PENT.length];
      const note = { time: t, lane, midi, judged: false, chordWith: null };
      this.pending.push(note);

      if (this.rand() < chordChance && slot % 4 === 0) {
        const lane2 = (lane + 2) % 5;
        const partner = {
          time: t,
          lane: lane2,
          midi: midi + 7,
          judged: false,
          chordWith: note,
        };
        note.chordWith = partner;
        this.pending.push(partner);
      }
    });
  }
}
