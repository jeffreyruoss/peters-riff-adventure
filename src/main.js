import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { AudioEngine } from './audio.js';
import { Music, BEAT } from './music.js';
import { buildWorld } from './world.js';
import { createPlayer, createEnemy, Fx, LANE_COLORS } from './entities.js';
import {
  buildHighway,
  makeNoteMesh,
  noteZ,
  laneX,
  LANES,
  STRIKE_Z,
  SPAWN_Z,
  WINDOWS,
} from './highway.js';

const RUN_SPEED = 3.0;
const SPAWN_AHEAD = 48;
const ATTACK_RANGE = 1.9;
const MAX_ENEMIES = 16;

// ---------------------------------------------------------------- renderer

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.32;

const world = buildWorld();
const scene = world.scene;
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.5, 900);
scene.add(camera);

const hw = buildHighway();

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const hwPass = new RenderPass(hw.scene, hw.camera);
hwPass.clear = false;
hwPass.clearDepth = true;
composer.addPass(hwPass);

const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.52,
  0.6,
  0.85,
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  hw.camera.aspect = w / h;
  hw.camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  // Pull the fretboard back on narrow screens so all five lanes stay visible.
  hw.camera.position.set(0, 3, w / h < 1.4 ? 7.6 : 6);
  hw.camera.lookAt(0, 0.97, -14);
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- entities

const audio = new AudioEngine();
const music = new Music(audio);
const fx = new Fx(scene);

const player = createPlayer();
scene.add(player.group);

const targetRing = new THREE.Mesh(
  new THREE.RingGeometry(0.85, 1.05, 28),
  new THREE.MeshBasicMaterial({
    color: '#ffd93d',
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }),
);
targetRing.rotation.x = -Math.PI / 2;
targetRing.visible = false;
scene.add(targetRing);

// ---------------------------------------------------------------- state

const state = {
  mode: 'menu',
  t: 0,
  health: 100,
  score: 0,
  combo: 0,
  bestCombo: 0,
  mult: 1,
  kills: 0,
  hits: 0,
  attempts: 0,
  wave: 1,
  shake: 0,
  danger: 0,
  notes: [],
  enemies: [],
  nextSpawnBar: 2,
  lastBeat: -1,
  laneHeld: [false, false, false, false, false],
};

const el = {
  hud: document.getElementById('hud'),
  menu: document.getElementById('menu'),
  over: document.getElementById('gameover'),
  paused: document.getElementById('paused'),
  health: document.getElementById('health-fill'),
  score: document.getElementById('score'),
  combo: document.getElementById('combo'),
  mult: document.getElementById('multiplier'),
  wave: document.getElementById('wave'),
  kills: document.getElementById('kills'),
  judge: document.getElementById('judge'),
  flash: document.getElementById('flash-damage'),
};

// ---------------------------------------------------------------- input

const KEY_LANE = {
  KeyA: 0, KeyS: 1, KeyD: 2, KeyF: 3, KeyG: 4,
  Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4,
  KeyH: 0, KeyJ: 1, KeyK: 2, KeyL: 3, Semicolon: 4,
};

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyP') {
    togglePause();
    return;
  }
  if (e.code === 'Enter' || e.code === 'Space') {
    if (state.mode === 'menu') startGame();
    else if (state.mode === 'over') startGame();
    if (e.code === 'Space') e.preventDefault();
  }
  const lane = KEY_LANE[e.code];
  if (lane === undefined || e.repeat) return;
  state.laneHeld[lane] = true;
  if (state.mode === 'playing') strike(lane);
});

window.addEventListener('keyup', (e) => {
  const lane = KEY_LANE[e.code];
  if (lane !== undefined) state.laneHeld[lane] = false;
});

window.addEventListener('blur', () => {
  if (state.mode === 'playing') togglePause();
});

// Browsers throttle rAF in hidden tabs while the audio clock keeps running,
// which would return the player to a wall of missed notes.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.mode === 'playing') togglePause();
});

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('retry-btn').addEventListener('click', startGame);

function togglePause() {
  if (state.mode === 'playing') {
    state.mode = 'paused';
    audio.suspend();
    el.paused.classList.remove('hidden');
  } else if (state.mode === 'paused') {
    state.mode = 'playing';
    audio.resume();
    el.paused.classList.add('hidden');
  }
}

// ---------------------------------------------------------------- gameplay

function startGame() {
  audio.init();
  audio.resume();
  audio.master.gain.cancelScheduledValues(audio.now());
  audio.master.gain.setValueAtTime(0.85, audio.now());

  for (const n of state.notes) hw.notes.remove(n.mesh);
  for (const e of state.enemies) scene.remove(e.group);
  fx.clear();

  Object.assign(state, {
    mode: 'playing',
    health: 100,
    score: 0,
    combo: 0,
    bestCombo: 0,
    mult: 1,
    kills: 0,
    hits: 0,
    attempts: 0,
    wave: 1,
    shake: 0,
    danger: 0,
    notes: [],
    enemies: [],
    nextSpawnBar: 2,
    lastBeat: -1,
  });
  player.group.position.set(0, 0, 0);
  music.start();

  el.menu.classList.add('hidden');
  el.over.classList.add('hidden');
  el.paused.classList.add('hidden');
  el.hud.classList.remove('hidden');
  syncHud();
}

function endGame() {
  state.mode = 'over';
  const t = audio.now();
  audio.master.gain.cancelScheduledValues(t);
  audio.master.gain.setValueAtTime(audio.master.gain.value, t);
  audio.master.gain.linearRampToValueAtTime(0.0001, t + 1.2);

  document.getElementById('go-score').textContent = state.score.toLocaleString();
  document.getElementById('go-kills').textContent = state.kills;
  document.getElementById('go-streak').textContent = state.bestCombo;
  const acc = state.attempts ? Math.round((state.hits / state.attempts) * 100) : 0;
  document.getElementById('go-acc').textContent = acc + '%';
  el.over.classList.remove('hidden');
}

function nearestTarget() {
  let best = null;
  let bestD = Infinity;
  for (const e of state.enemies) {
    if (e.dead) continue;
    const d = e.group.position.x - player.group.position.x;
    if (d < -3) continue;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function strike(lane) {
  const now = audio.now();
  let best = null;
  let bestDt = Infinity;
  for (const n of state.notes) {
    if (n.judged || n.lane !== lane) continue;
    const dt = Math.abs(n.time - now);
    if (dt < bestDt) {
      bestDt = dt;
      best = n;
    }
  }
  hw.pads[lane].glow = 1;

  if (!best || bestDt > WINDOWS.good) {
    audio.dead(now, 0.7);
    return;
  }

  best.judged = true;
  state.attempts++;
  state.hits++;

  const grade = bestDt <= WINDOWS.perfect ? 'PERFECT' : bestDt <= WINDOWS.great ? 'GREAT' : 'GOOD';
  const base = grade === 'PERFECT' ? 120 : grade === 'GREAT' ? 80 : 45;

  state.combo++;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  const prevMult = state.mult;
  state.mult = Math.min(6, 1 + Math.floor(state.combo / 10));
  state.score += base * state.mult;

  audio.lead(now, best.midi, grade === 'PERFECT' ? 0.42 : 0.3, grade === 'PERFECT' ? 1.15 : 0.9);
  if (state.combo > 0 && state.combo % 25 === 0) {
    state.health = Math.min(100, state.health + 6);
  }

  showJudge(grade, LANE_COLORS[lane]);
  if (state.mult !== prevMult) {
    el.mult.classList.add('pop');
    setTimeout(() => el.mult.classList.remove('pop'), 130);
  }

  // Muzzle flash at the strike pad and a riff-bolt at the current target.
  fx.ring(
    new THREE.Vector3(laneX(lane), 0.1, STRIKE_Z),
    LANE_COLORS[lane],
    9,
    0.3,
    true,
  );

  const target = nearestTarget();
  const muzzle = new THREE.Vector3().copy(player.group.position).add(new THREE.Vector3(0.9, 1.35, 0.4));
  player.strumPhase = 1;
  if (target) {
    const dmg = grade === 'PERFECT' ? 2 : 1;
    const dest = target.group.position.clone().add(new THREE.Vector3(0, 1.3, 0));
    fx.shot(muzzle, dest, LANE_COLORS[lane], () => damageEnemy(target, dmg, LANE_COLORS[lane]));
  } else {
    fx.burst(muzzle, LANE_COLORS[lane], 5, 0.5);
  }

  removeNote(best);
  syncHud();
}

function missNote(note) {
  state.attempts++;
  state.combo = 0;
  state.mult = 1;
  state.health -= 1.2;
  state.shake = Math.min(0.5, state.shake + 0.14);
  audio.dead(audio.now(), 1);
  showJudge('MISS', '#ff3b52');
  // The horde smells blood.
  for (const e of state.enemies) e.surge = 1.1;
  removeNote(note);
  syncHud();
  if (state.health <= 0) endGame();
}

function removeNote(note) {
  hw.notes.remove(note.mesh);
  note.mesh.traverse((o) => {
    if (o.material) o.material.dispose?.();
  });
  const i = state.notes.indexOf(note);
  if (i >= 0) state.notes.splice(i, 1);
}

function damageEnemy(enemy, dmg, color) {
  if (enemy.dead) return;
  enemy.hp -= dmg;
  enemy.flash = 1;
  enemy.knock = 0.5;
  const p = enemy.group.position;
  fx.burst(new THREE.Vector3(p.x, p.y + 1.4, p.z), color, 5, 0.5);
  updatePips(enemy);
  if (enemy.hp <= 0) {
    enemy.dead = true;
    state.kills++;
    state.score += 250 * state.mult;
    audio.shatter(audio.now());
    fx.burst(new THREE.Vector3(p.x, p.y + 1.2, p.z), enemy.color, 20, 1.2);
    fx.ring(new THREE.Vector3(p.x, 0.15, p.z), enemy.color, 9, 0.55, true, 0.6);
    scene.remove(enemy.group);
    const i = state.enemies.indexOf(enemy);
    if (i >= 0) state.enemies.splice(i, 1);
    syncHud();
  }
}

function updatePips(enemy) {
  enemy.pips.children.forEach((pip, i) => {
    pip.visible = i < enemy.hp;
  });
}

function spawnEnemy() {
  if (state.enemies.length >= MAX_ENEMIES) return;
  const e = createEnemy(state.wave);
  const x = player.group.position.x + SPAWN_AHEAD + Math.random() * 22;
  const z = (Math.random() - 0.5) * 4.4;
  e.group.position.set(x, 0, z);
  e.surge = 0;

  const pips = new THREE.Group();
  const pipGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
  const pipMat = new THREE.MeshBasicMaterial({ color: e.color });
  for (let i = 0; i < e.hpMax; i++) {
    const p = new THREE.Mesh(pipGeo, pipMat);
    p.position.set((i - (e.hpMax - 1) / 2) * 0.2, 2.55, 0);
    pips.add(p);
  }
  e.pips = pips;
  e.group.add(pips);

  scene.add(e.group);
  state.enemies.push(e);
  fx.ring(new THREE.Vector3(x, 0.15, z), e.color, 10, 0.5);
}

function showJudge(text, color) {
  el.judge.textContent = text;
  el.judge.style.color = color;
  el.judge.classList.remove('show');
  void el.judge.offsetWidth;
  el.judge.classList.add('show');
}

function syncHud() {
  el.health.style.width = Math.max(0, state.health) + '%';
  el.score.textContent = state.score.toLocaleString();
  el.combo.textContent = state.combo + ' NOTE STREAK';
  el.mult.textContent = state.mult + 'x';
  el.wave.textContent = 'WAVE ' + state.wave;
  el.kills.textContent = state.kills + (state.kills === 1 ? ' SOUL' : ' SOULS');
}

// ---------------------------------------------------------------- loop

const clock = new THREE.Clock();
const camTarget = new THREE.Vector3();

function updateNotes(now) {
  for (const note of music.update()) {
    note.mesh = makeNoteMesh(note.lane, !!note.chordWith);
    hw.notes.add(note.mesh);
    state.notes.push(note);
  }
  for (let i = state.notes.length - 1; i >= 0; i--) {
    const n = state.notes[i];
    const z = noteZ(n, now);
    // Charted up to a couple of seconds early — keep them off the board until
    // they actually enter the approach window.
    n.mesh.visible = z >= SPAWN_Z;
    n.mesh.position.z = z;
    n.mesh.rotation.y += 0.02;
    const fade = THREE.MathUtils.clamp((z - SPAWN_Z) / 3, 0, 1);
    n.mesh.scale.setScalar(0.6 + 0.4 * fade);
    if (now > n.time + WINDOWS.good) missNote(n);
  }
}

function updateEnemies(dt, now) {
  const px = player.group.position.x;
  let closest = Infinity;

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    const d = e.group.position.x - px;
    closest = Math.min(closest, d);

    e.surge = Math.max(0, (e.surge || 0) - dt * 0.6);
    e.knock = Math.max(0, e.knock - dt * 3);

    // They hesitate as they close in, which keeps them on screen longer.
    const menace = d < 13 ? 0.45 : 1;
    const vx = -(e.speed * menace + e.surge * 2.2) + e.knock * 12;
    e.group.position.x += vx * dt;

    e.bob += dt * (5 + e.speed);
    e.group.position.y = Math.abs(Math.sin(e.bob)) * 0.09;
    e.legL.rotation.x = Math.sin(e.bob) * 0.55;
    e.legR.rotation.x = -Math.sin(e.bob) * 0.55;
    e.armL.rotation.x = -0.5 + Math.sin(e.bob + 1) * 0.35;
    e.armR.rotation.x = -0.5 - Math.sin(e.bob + 1) * 0.35;
    e.pips.rotation.y = 0;
    e.pips.lookAt(camera.position);

    if (e.flash > 0) {
      e.flash = Math.max(0, e.flash - dt * 4);
      e.torso.material.emissiveIntensity = e.flash * 2.5;
    }

    if (d < ATTACK_RANGE) {
      state.health -= 12;
      state.shake = 0.75;
      state.combo = 0;
      state.mult = 1;
      audio.hurt(audio.now());
      el.flash.style.opacity = '1';
      setTimeout(() => (el.flash.style.opacity = '0'), 120);
      fx.burst(new THREE.Vector3(e.group.position.x, 1.3, e.group.position.z), '#ff2d55', 18, 1.1);
      scene.remove(e.group);
      state.enemies.splice(i, 1);
      syncHud();
      if (state.health <= 0) {
        endGame();
        return;
      }
    }
  }

  state.danger = THREE.MathUtils.lerp(state.danger, closest < 9 ? 1 : 0, dt * 3);

  const bar = music.bar;
  state.wave = music.waveAt(bar);
  while (bar >= state.nextSpawnBar) {
    const count = 1 + Math.floor(state.wave / 3) + (Math.random() < 0.3 ? 1 : 0);
    for (let i = 0; i < count; i++) spawnEnemy();
    state.nextSpawnBar += state.wave >= 4 ? 2 : 3;
  }

  const target = nearestTarget();
  if (target) {
    targetRing.visible = true;
    targetRing.position.set(target.group.position.x, 0.12, target.group.position.z);
    targetRing.scale.setScalar(0.9 + Math.sin(state.t * 8) * 0.08);
  } else {
    targetRing.visible = false;
  }
}

function updatePlayer(dt) {
  const g = player.group;
  g.position.x += RUN_SPEED * dt;
  const cycle = state.t * 9;
  player.legL.rotation.x = Math.sin(cycle) * 0.55;
  player.legR.rotation.x = -Math.sin(cycle) * 0.55;
  player.strumPhase = Math.max(0, player.strumPhase - dt * 6);
  // Near arm strums over the body, far arm stays up on the neck.
  player.armL.rotation.x = -0.92 - player.strumPhase * 0.55;
  player.armL.rotation.z = player.strumPhase * 0.4;
  player.armR.rotation.x = -1.24;
  g.position.y = Math.abs(Math.sin(cycle)) * 0.06;
  player.head.rotation.z = Math.sin(state.t * 4.5) * 0.06;
}

function updateHighway(dt, now) {
  for (let i = 0; i < LANES; i++) {
    const pad = hw.pads[i];
    pad.glow = Math.max(0, pad.glow - dt * 5);
    const held = state.laneHeld[i] ? 0.35 : 0;
    pad.mesh.material.emissiveIntensity = 0.35 + pad.glow * 5 + held;
    pad.mesh.material.opacity = 0.55 + pad.glow * 0.45;
    pad.mesh.scale.setScalar(1 + pad.glow * 0.35);
  }
  hw.strike.material.color.setScalar(0.75 + Math.sin(state.t * 10) * 0.1);

  // Beat lines scroll in lockstep with the chart.
  const beatNow = music.elapsed / BEAT;
  hw.beatLines.forEach((line, i) => {
    const beat = Math.ceil(beatNow) + i;
    const t = music.startTime + beat * BEAT;
    const z = noteZ({ time: t }, now);
    if (z > SPAWN_Z - 2 && z < STRIKE_Z + 1) {
      line.visible = true;
      line.position.z = z;
      line.material.opacity = beat % 4 === 0 ? 0.3 : 0.12;
    } else {
      line.visible = false;
    }
  });
}

function updateCamera(dt) {
  const px = player.group.position.x;
  const beatPulse = state.mode === 'playing' ? 1 - music.beatPhase() : 0;
  const punch = beatPulse * beatPulse * 0.35;

  camera.position.set(px + 5, 6.1 + punch * 0.3, 25);
  camTarget.set(px + 5, 0.63, 0);

  if (state.shake > 0) {
    state.shake = Math.max(0, state.shake - dt * 1.8);
    const s = state.shake * state.shake;
    camera.position.x += (Math.random() - 0.5) * 4 * s;
    camera.position.y += (Math.random() - 0.5) * 4 * s;
  }
  camera.lookAt(camTarget);

  world.spot.position.set(px + 2, 7, 7);
  world.spot.intensity = 12 + punch * 40 + state.danger * 10;
  world.spot.color.setHSL(0.9 - state.danger * 0.12, 0.8, 0.55);
  world.hemi.intensity = 1.1 + punch * 0.5;
  world.embers.position.x = px + 6;
  world.sunDisc.position.x = px + 40;
  scene.fog.color.setHSL(0.93 - state.danger * 0.05, 0.4 + state.danger * 0.25, 0.24 + punch * 0.05);
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (state.mode === 'playing') {
    state.t += dt;
    const now = audio.now();
    updateNotes(now);
    updateEnemies(dt, now);
    updatePlayer(dt);
    updateHighway(dt, now);

    // Ground pulse on every beat.
    const beat = Math.floor(music.elapsed / BEAT);
    if (beat !== state.lastBeat && beat >= 0) {
      state.lastBeat = beat;
      fx.ring(
        new THREE.Vector3(player.group.position.x, 0.06, 0),
        beat % 4 === 0 ? '#ff6fd8' : '#5ac8ff',
        beat % 4 === 0 ? 11 : 7,
        0.6,
        true,
        0.3,
      );
    }
    syncHud();
  } else if (state.mode === 'menu' || state.mode === 'over') {
    state.t += dt;
    player.group.position.x += RUN_SPEED * 0.25 * dt;
    updatePlayer(dt * 0.25);
  }

  fx.update(state.mode === 'paused' ? 0 : dt);
  updateCamera(state.mode === 'paused' ? 0 : dt);
  composer.render();
}

resize();
player.group.position.set(0, 0, 0);
frame();

window.__game = { state, hw, camera, world, renderer, bloom, music, audio, player, spawnEnemy, THREE };
