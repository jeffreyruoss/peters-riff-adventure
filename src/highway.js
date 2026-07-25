import * as THREE from 'three';
import { LANE_COLORS } from './entities.js';

export const LANES = 5;
export const LANE_W = 0.85;
export const STRIKE_Z = -3.4; // where notes must be hit
export const SPAWN_Z = -16; // where notes appear
export const APPROACH = 1.5; // seconds from spawn to strike line
const SPEED = (STRIKE_Z - SPAWN_Z) / APPROACH;

export const laneX = (lane) => (lane - (LANES - 1) / 2) * LANE_W;

// Judgement windows in seconds.
export const WINDOWS = { perfect: 0.045, great: 0.085, good: 0.13 };

const NOTE_GEO = new THREE.CylinderGeometry(0.34, 0.34, 0.16, 10);
const RIM_GEO = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 10);

export function buildHighway() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(31.4, 1, 0.1, 120);
  camera.position.set(0, 3, 6);
  camera.lookAt(0, 0.97, -14);

  scene.add(new THREE.AmbientLight('#ffffff', 1.4));
  const key = new THREE.DirectionalLight('#ffffff', 1.6);
  key.position.set(0, 6, 4);
  scene.add(key);

  const root = new THREE.Group();
  scene.add(root);

  const NEAR_Z = STRIKE_Z + 2.8;
  const FAR_Z = SPAWN_Z - 1;
  const boardLen = NEAR_Z - FAR_Z;
  const boardMid = (NEAR_Z + FAR_Z) / 2;

  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(LANES * LANE_W + 0.3, boardLen),
    new THREE.MeshBasicMaterial({ color: '#08050f', transparent: true, opacity: 0.94 }),
  );
  board.rotation.x = -Math.PI / 2;
  board.position.set(0, 0, boardMid);
  root.add(board);

  // Lane dividers + a tinted strip per lane.
  for (let i = 0; i < LANES; i++) {
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(LANE_W - 0.06, boardLen),
      new THREE.MeshBasicMaterial({
        color: LANE_COLORS[i],
        transparent: true,
        opacity: 0.05,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(laneX(i), 0.01, boardMid);
    root.add(strip);
  }
  for (let i = 0; i <= LANES; i++) {
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(0.035, boardLen),
      new THREE.MeshBasicMaterial({ color: '#7a6fa8', transparent: true, opacity: 0.5, depthWrite: false }),
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set((i - LANES / 2) * LANE_W, 0.02, boardMid);
    root.add(line);
  }

  // Beat lines that scroll with the music.
  const beatLines = [];
  for (let i = 0; i < 10; i++) {
    const l = new THREE.Mesh(
      new THREE.PlaneGeometry(LANES * LANE_W, 0.05),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, depthWrite: false }),
    );
    l.rotation.x = -Math.PI / 2;
    l.position.y = 0.03;
    l.visible = false;
    root.add(l);
    beatLines.push(l);
  }

  // Strike line + per-lane pads.
  const strike = new THREE.Mesh(
    new THREE.PlaneGeometry(LANES * LANE_W + 0.3, 0.14),
    new THREE.MeshBasicMaterial({ color: '#ffffff' }),
  );
  strike.rotation.x = -Math.PI / 2;
  strike.position.set(0, 0.05, STRIKE_Z);
  root.add(strike);

  const pads = [];
  for (let i = 0; i < LANES; i++) {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.44, 0.06, 10),
      new THREE.MeshStandardMaterial({
        color: LANE_COLORS[i],
        emissive: LANE_COLORS[i],
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.55,
        flatShading: true,
      }),
    );
    pad.position.set(laneX(i), 0.06, STRIKE_Z);
    root.add(pad);
    pads.push({ mesh: pad, glow: 0 });
  }

  const notes = new THREE.Group();
  root.add(notes);

  return { scene, camera, root, notes, pads, beatLines, strike };
}

export function makeNoteMesh(lane, isChord) {
  const color = LANE_COLORS[lane];
  const g = new THREE.Group();
  const gem = new THREE.Mesh(
    NOTE_GEO,
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 2.4,
      flatShading: true,
      roughness: 0.25,
      metalness: 0.4,
    }),
  );
  g.add(gem);
  const rim = new THREE.Mesh(
    RIM_GEO,
    new THREE.MeshBasicMaterial({ color: isChord ? '#ffffff' : '#1a1030' }),
  );
  rim.position.y = -0.04;
  g.add(rim);
  g.position.set(laneX(lane), 0.12, SPAWN_Z);
  return g;
}

export function noteZ(note, now) {
  return STRIKE_Z - (note.time - now) * SPEED;
}
