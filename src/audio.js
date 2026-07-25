// Synthesized soundtrack. Everything is generated with Web Audio oscillators so
// the music and the note chart share a single clock (ctx.currentTime).

function distCurve(amount) {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  return curve;
}

function noiseBuffer(ctx) {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export const mtof = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
  }

  init() {
    if (this.ctx) return;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctor();
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 14;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    comp.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(comp);
    this.master = master;

    this.drumBus = this.bus(0.95);
    this.bassBus = this.bus(0.9);
    this.gtrBus = this.bus(0.5);
    this.leadBus = this.bus(0.55);
    this.sfxBus = this.bus(0.7);

    // Slapback delay on the lead so hits ring out.
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.26;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(master);
    this.leadBus.connect(delay);

    this.noise = noiseBuffer(ctx);
    this.curveHot = distCurve(45);
    this.curveWarm = distCurve(14);
    this.ready = true;
  }

  bus(gain) {
    const g = this.ctx.createGain();
    g.gain.value = gain;
    g.connect(this.master);
    return g;
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  noiseSource(t, dur) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur);
    return src;
  }

  kick(t, gain = 1) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.11);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    osc.connect(g);
    g.connect(this.drumBus);
    osc.start(t);
    osc.stop(t + 0.3);

    const click = this.noiseSource(t, 0.03);
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.35 * gain, t);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200;
    click.connect(hp);
    hp.connect(cg);
    cg.connect(this.drumBus);
  }

  snare(t, gain = 1) {
    const ctx = this.ctx;
    const src = this.noiseSource(t, 0.22);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.7 * gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.drumBus);

    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(210, t);
    body.frequency.exponentialRampToValueAtTime(140, t + 0.1);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.4 * gain, t);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    body.connect(bg);
    bg.connect(this.drumBus);
    body.start(t);
    body.stop(t + 0.14);
  }

  hat(t, open = false, gain = 1) {
    const ctx = this.ctx;
    const dur = open ? 0.24 : 0.05;
    const src = this.noiseSource(t, dur + 0.02);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22 * gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.drumBus);
  }

  crash(t, gain = 1) {
    const ctx = this.ctx;
    const src = this.noiseSource(t, 1.2);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3 * gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.drumBus);
  }

  bass(t, midi, dur, gain = 1) {
    const ctx = this.ctx;
    const f = mtof(midi);
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1400, t);
    lp.frequency.exponentialRampToValueAtTime(320, t + Math.min(dur, 0.25));
    lp.Q.value = 6;

    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = f;
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = f / 2;
    const subG = ctx.createGain();
    subG.gain.value = 0.6;

    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5 * gain, t + 0.01);
    g.gain.setValueAtTime(0.5 * gain, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    saw.connect(lp);
    sub.connect(subG);
    subG.connect(lp);
    lp.connect(g);
    g.connect(this.bassBus);
    saw.start(t);
    sub.start(t);
    saw.stop(t + dur + 0.05);
    sub.stop(t + dur + 0.05);
  }

  // Palm-muted rhythm guitar chug.
  chug(t, midi, dur = 0.12, gain = 1) {
    const ctx = this.ctx;
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.curveHot;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35 * gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    for (const det of [-7, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(midi);
      o.detune.value = det;
      o.connect(shaper);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    const fifth = ctx.createOscillator();
    fifth.type = 'sawtooth';
    fifth.frequency.value = mtof(midi + 7);
    fifth.connect(shaper);
    fifth.start(t);
    fifth.stop(t + dur + 0.05);

    shaper.connect(lp);
    lp.connect(g);
    g.connect(this.gtrBus);
  }

  // Bright distorted lead — this is what a successful hit plays.
  lead(t, midi, dur = 0.35, gain = 1) {
    const ctx = this.ctx;
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.curveWarm;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(5200, t);
    lp.frequency.exponentialRampToValueAtTime(1600, t + dur);
    lp.Q.value = 2;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.45 * gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    const f = mtof(midi);
    const specs = [
      ['sawtooth', f, -8],
      ['sawtooth', f, 9],
      ['square', f * 2, 0],
    ];
    for (const [type, freq, det] of specs) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = det;
      const og = ctx.createGain();
      og.gain.value = type === 'square' ? 0.25 : 0.5;
      o.connect(og);
      og.connect(shaper);
      o.start(t);
      o.stop(t + dur + 0.08);
    }
    shaper.connect(lp);
    lp.connect(g);
    g.connect(this.leadBus);
  }

  // Muted "chk" for a missed or stray note.
  dead(t, gain = 1) {
    const ctx = this.ctx;
    const src = this.noiseSource(t, 0.1);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 380;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3 * gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfxBus);
  }

  // Enemy shatter.
  shatter(t) {
    const ctx = this.ctx;
    const src = this.noiseSource(t, 0.5);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2600, t);
    bp.frequency.exponentialRampToValueAtTime(420, t + 0.4);
    bp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfxBus);
  }

  hurt(t) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g);
    g.connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.34);
  }
}
