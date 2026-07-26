import * as THREE from 'three';

export const LANE_COLORS = ['#3df07a', '#ff3b52', '#ffd93d', '#3aa4ff', '#ff8a1f', '#b45cff'];

const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

function bodyMaterial(color, emissive = '#000000', ei = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: ei,
    flatShading: true,
    roughness: 0.75,
    metalness: 0.1,
  });
}

// Low-poly humanoid built from boxes; returns the group plus animatable parts.
function humanoid({ skin, cloth, accent, emissive, ei }) {
  const g = new THREE.Group();
  const mSkin = bodyMaterial(skin);
  const mCloth = bodyMaterial(cloth, emissive, 0); // ei is driven by the hit flash
  const mAccent = bodyMaterial(accent, emissive, ei);

  const torso = box(0.62, 0.86, 0.42, mCloth);
  torso.position.y = 1.32;
  g.add(torso);

  const hips = box(0.56, 0.3, 0.4, mAccent);
  hips.position.y = 0.82;
  g.add(hips);

  const head = box(0.42, 0.44, 0.42, mSkin);
  head.position.y = 2.0;
  g.add(head);

  const hair = box(0.48, 0.2, 0.48, mAccent);
  hair.position.y = 2.22;
  g.add(hair);

  const legL = box(0.22, 0.78, 0.24, mCloth);
  legL.geometry.translate(0, -0.39, 0);
  legL.position.set(-0.15, 0.72, 0.02);
  const legR = legL.clone();
  legR.position.x = 0.15;
  g.add(legL, legR);

  const armL = box(0.18, 0.66, 0.18, mSkin);
  armL.geometry.translate(0, -0.33, 0);
  armL.position.set(-0.39, 1.68, 0.06);
  const armR = armL.clone();
  armR.position.x = 0.39;
  g.add(armL, armR);

  return { group: g, legL, legR, armL, armR, head, torso };
}

// The player is modelled by hand rather than through humanoid(): long hair,
// beard, black tee, olive cargo shorts, black sneakers, and a single-cutaway
// with cream binding. Local +Z is "forward" (the run direction) and local X is
// screen depth, so the side-on silhouette is what all the sizing targets.
const PLAYER = {
  skin: '#e7b58c',
  hair: '#9a7a4e',
  beard: '#87683f',
  shirt: '#191920',
  strap: '#2b2b33',
  shorts: '#4f5537',
  sock: '#e9e7dd',
  shoe: '#141419',
  shoeTrim: '#f0f0ee',
};

function guitarModel() {
  // Outer group swings the instrument into the screen plane; inner group tilts
  // the neck up the way he holds it.
  const mount = new THREE.Group();
  mount.rotation.y = -Math.PI / 2;
  const g = new THREE.Group();
  g.rotation.z = 0.34;
  mount.add(g);

  const black = new THREE.MeshStandardMaterial({
    color: '#101014',
    flatShading: true,
    roughness: 0.28,
    metalness: 0.35,
  });
  const cream = bodyMaterial('#c9b98f');
  const rosewood = bodyMaterial('#42291a');
  const chrome = new THREE.MeshStandardMaterial({
    color: '#c6cad2',
    flatShading: true,
    roughness: 0.2,
    metalness: 0.9,
  });
  const pearl = new THREE.MeshBasicMaterial({ color: '#efeadb' });

  // Body: cream binding disc with the black top sitting slightly proud of it.
  const binding = new THREE.Mesh(new THREE.CylinderGeometry(0.362, 0.362, 0.13, 12), cream);
  binding.rotation.x = Math.PI / 2;
  binding.scale.set(1.15, 1, 1);
  g.add(binding);

  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.18, 12), black);
  top.rotation.x = Math.PI / 2;
  top.scale.set(1.15, 1, 1);
  g.add(top);

  // Cutaway notch on the treble side, then the hardware.
  const cut = box(0.2, 0.26, 0.2, black);
  cut.position.set(0.3, 0.16, 0);
  g.add(cut);

  const pickguard = box(0.26, 0.13, 0.19, chrome);
  pickguard.position.set(-0.02, -0.14, 0.1);
  g.add(pickguard);

  const pickup = box(0.09, 0.16, 0.17, chrome);
  pickup.position.set(0.16, 0.03, 0.09);
  g.add(pickup);

  const bridge = box(0.05, 0.11, 0.15, chrome);
  bridge.position.set(-0.06, 0.0, 0.09);
  g.add(bridge);

  const tailpiece = box(0.16, 0.09, 0.15, chrome);
  tailpiece.position.set(-0.28, -0.02, 0.08);
  g.add(tailpiece);

  // Neck, fretboard, block inlays, headstock.
  const neck = box(0.82, 0.1, 0.14, rosewood);
  neck.position.set(0.72, 0.02, 0);
  g.add(neck);

  const board = box(0.82, 0.05, 0.15, bodyMaterial('#33200f'));
  board.position.set(0.72, 0.07, 0.03);
  g.add(board);

  for (let i = 0; i < 4; i++) {
    const dot = box(0.055, 0.012, 0.09, pearl);
    dot.position.set(0.44 + i * 0.19, 0.1, 0.03);
    g.add(dot);
  }

  const strings = box(0.86, 0.012, 0.1, new THREE.MeshBasicMaterial({ color: '#cfd6de' }));
  strings.position.set(0.7, 0.115, 0.03);
  g.add(strings);

  const headstock = box(0.24, 0.13, 0.12, black);
  headstock.position.set(1.22, 0.02, 0);
  headstock.rotation.z = -0.22;
  g.add(headstock);

  const tuners = box(0.2, 0.03, 0.17, chrome);
  tuners.position.set(1.22, 0.05, 0);
  tuners.rotation.z = -0.22;
  g.add(tuners);

  mount.scale.setScalar(0.92);
  return mount;
}

export function createPlayer() {
  const g = new THREE.Group();
  const mSkin = bodyMaterial(PLAYER.skin);
  const mShirt = bodyMaterial(PLAYER.shirt);
  const mShorts = bodyMaterial(PLAYER.shorts);
  const mHair = bodyMaterial(PLAYER.hair);
  const mShoe = bodyMaterial(PLAYER.shoe);

  const torso = box(0.6, 0.84, 0.44, mShirt);
  torso.position.y = 1.34;
  g.add(torso);

  const hips = box(0.56, 0.24, 0.42, mShorts);
  hips.position.y = 0.94;
  g.add(hips);

  const neck = box(0.2, 0.14, 0.2, mSkin);
  neck.position.y = 1.8;
  g.add(neck);

  const head = box(0.4, 0.44, 0.4, mSkin);
  head.position.y = 2.02;
  g.add(head);

  // Hair: cap, fringe, and a curtain down past the jaw — the silhouette that
  // reads from the side.
  const cap = box(0.45, 0.18, 0.45, mHair);
  cap.position.y = 0.18;
  head.add(cap);

  // Sits back off the face so the profile and beard still read.
  const curtain = box(0.47, 0.46, 0.24, mHair);
  curtain.position.set(0, -0.07, -0.11);
  head.add(curtain);

  const backHair = box(0.44, 0.5, 0.16, mHair);
  backHair.position.set(0, -0.1, -0.21);
  head.add(backHair);

  const fringe = box(0.45, 0.15, 0.14, mHair);
  fringe.position.set(0, 0.14, 0.15);
  head.add(fringe);

  const beard = box(0.41, 0.18, 0.4, bodyMaterial(PLAYER.beard));
  beard.position.set(0, -0.17, 0.02);
  head.add(beard);

  // Guitar strap across the chest.
  const strap = box(0.09, 0.98, 0.08, bodyMaterial(PLAYER.strap));
  strap.position.set(-0.29, 1.34, 0.03);
  strap.rotation.x = -0.42;
  g.add(strap);

  // Legs: pivot at the hip so the walk cycle swings from there.
  const makeLeg = (side) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.16, 0.92, 0.01);

    const thigh = box(0.28, 0.48, 0.34, mShorts); // baggy cargo shorts
    thigh.position.y = -0.24;
    leg.add(thigh);

    const pocket = box(0.03, 0.16, 0.14, bodyMaterial('#454b30'));
    pocket.position.set(side * 0.15, -0.28, 0.02);
    leg.add(pocket);

    const shin = box(0.19, 0.36, 0.2, mSkin);
    shin.position.y = -0.65;
    leg.add(shin);

    const sock = box(0.2, 0.09, 0.21, bodyMaterial(PLAYER.sock));
    sock.position.y = -0.85;
    leg.add(sock);

    const shoe = box(0.21, 0.13, 0.38, mShoe);
    shoe.position.set(0, -0.94, 0.07);
    leg.add(shoe);

    const swoosh = box(0.225, 0.06, 0.12, bodyMaterial(PLAYER.shoeTrim));
    swoosh.position.set(0, -0.94, 0.02);
    leg.add(swoosh);

    const sole = box(0.22, 0.04, 0.39, bodyMaterial('#e6e6e2'));
    sole.position.set(0, -1.0, 0.07);
    leg.add(sole);

    return leg;
  };
  const legL = makeLeg(-1);
  const legR = makeLeg(1);
  g.add(legL, legR);

  // Arms: short sleeve ends above the elbow, bare forearm below.
  const makeArm = (side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.38, 1.7, 0.03);

    const sleeve = box(0.2, 0.32, 0.2, mShirt);
    sleeve.position.y = -0.14;
    arm.add(sleeve);

    const forearm = box(0.16, 0.34, 0.16, mSkin);
    forearm.position.y = -0.47;
    arm.add(forearm);

    const hand = box(0.17, 0.15, 0.17, mSkin);
    hand.position.y = -0.7;
    arm.add(hand);

    return arm;
  };
  const armL = makeArm(-1); // nearest the camera — the strumming hand
  const armR = makeArm(1); // far side — up on the neck
  g.add(armL, armR);

  const guitar = guitarModel();
  guitar.position.set(-0.33, 1.14, 0.24);
  g.add(guitar);

  g.rotation.y = Math.PI / 2; // face +X (the direction of travel)
  g.scale.setScalar(1.15);
  return { group: g, legL, legR, armL, armR, head, torso, guitar, strumPhase: 0 };
}

// `speed` is closing speed relative to the player, who is already running at them.
const ENEMY_KINDS = [
  { cloth: '#3a1f4e', accent: '#ff2f2f', skin: '#8f7f9c', scale: 1.0, speed: 3.0, hp: 3 },
  { cloth: '#1f3a4e', accent: '#00e5ff', skin: '#7f95a0', scale: 0.88, speed: 4.3, hp: 2 },
  { cloth: '#4e2a1f', accent: '#ff8a1f', skin: '#a08472', scale: 1.32, speed: 2.0, hp: 6 },
];

export function createEnemy(wave) {
  const roll = Math.random();
  const kind =
    wave >= 3 && roll < 0.28 ? ENEMY_KINDS[1] : wave >= 4 && roll > 0.86 ? ENEMY_KINDS[2] : ENEMY_KINDS[0];

  const h = humanoid({
    skin: kind.skin,
    cloth: kind.cloth,
    accent: kind.accent,
    emissive: kind.accent,
    ei: 1.6,
  });
  h.group.scale.setScalar(kind.scale);
  h.group.rotation.y = -Math.PI / 2; // face -X, marching at the player

  const eyeMat = new THREE.MeshBasicMaterial({ color: kind.accent });
  const eyes = box(0.3, 0.07, 0.05, eyeMat);
  eyes.position.set(0, 2.02, 0.22);
  h.group.add(eyes);

  const hpMax = kind.hp + Math.floor(wave / 3);
  return {
    ...h,
    kind,
    color: kind.accent,
    hp: hpMax,
    hpMax,
    speed: kind.speed + Math.min(1.6, wave * 0.1),
    dead: false,
    flash: 0,
    knock: 0,
    bob: Math.random() * 6.28,
  };
}

// ---------------------------------------------------------------------------

const FRAG_GEO = new THREE.TetrahedronGeometry(0.26, 0);
const RING_GEO = new THREE.RingGeometry(0.7, 0.92, 32);
const SHOT_GEO = new THREE.OctahedronGeometry(0.22, 0);

export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
  }

  add(mesh, data) {
    this.scene.add(mesh);
    this.items.push({ mesh, life: 0, ...data });
  }

  burst(pos, color, count = 14, power = 1) {
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 2.2,
      flatShading: true,
      roughness: 0.4,
    });
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(FRAG_GEO, mat);
      m.position.copy(pos);
      m.scale.setScalar(0.6 + Math.random() * 1.4);
      this.add(m, {
        type: 'frag',
        ttl: 1.1 + Math.random() * 0.7,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 9 * power,
          2 + Math.random() * 7 * power,
          (Math.random() - 0.5) * 9 * power,
        ),
        spin: new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9),
      });
    }
  }

  ring(pos, color, speed = 9, ttl = 0.55, flat = true, peak = 0.85) {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: peak,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const m = new THREE.Mesh(RING_GEO, mat);
    m.position.copy(pos);
    if (flat) m.rotation.x = -Math.PI / 2;
    this.add(m, { type: 'ring', ttl, speed, peak });
  }

  shot(from, target, color, onHit) {
    const mat = new THREE.MeshBasicMaterial({ color });
    const m = new THREE.Mesh(SHOT_GEO, mat);
    m.position.copy(from);
    this.add(m, { type: 'shot', ttl: 1.2, target, onHit, speed: 42, color });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life += dt;
      const m = it.mesh;

      if (it.type === 'frag') {
        it.vel.y -= 22 * dt;
        m.position.addScaledVector(it.vel, dt);
        m.rotation.x += it.spin.x * dt;
        m.rotation.y += it.spin.y * dt;
        m.rotation.z += it.spin.z * dt;
        if (m.position.y < 0.1) {
          m.position.y = 0.1;
          it.vel.y *= -0.35;
          it.vel.multiplyScalar(0.7);
        }
        m.scale.multiplyScalar(1 - dt * 0.9);
      } else if (it.type === 'ring') {
        const s = 1 + it.life * it.speed;
        m.scale.set(s, s, s);
        m.material.opacity = Math.max(0, it.peak * (1 - it.life / it.ttl));
      } else if (it.type === 'shot') {
        const dir = it.target.clone().sub(m.position);
        const dist = dir.length();
        if (dist < 0.9) {
          it.onHit?.();
          this.ring(m.position, it.color, 14, 0.35, false);
          this.scene.remove(m);
          this.items.splice(i, 1);
          continue;
        }
        m.position.addScaledVector(dir.normalize(), it.speed * dt);
        m.rotation.x += dt * 20;
        m.rotation.y += dt * 16;
      }

      if (it.life > it.ttl) {
        this.scene.remove(m);
        if (it.type !== 'frag') m.material.dispose();
        this.items.splice(i, 1);
      }
    }
  }

  clear() {
    for (const it of this.items) this.scene.remove(it.mesh);
    this.items.length = 0;
  }
}
