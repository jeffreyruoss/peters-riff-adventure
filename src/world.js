import * as THREE from 'three';

export const WORLD_LEN = 9000;
const HALF_DEPTH = 110;

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Only the far side of the runway rises — the near side stays flat so nothing
// ever pokes between the camera and the action.
export function groundHeight(x, z) {
  const band = -z - 12;
  if (band <= 0) return 0;
  const ramp = Math.min(1, band / 46) ** 1.35;
  const h =
    Math.sin(x * 0.021) * 2.1 +
    Math.sin(x * 0.057 + 1.7) * 1.1 +
    Math.sin(z * 0.041 + 0.4) * 1.8 +
    Math.sin(x * 0.14 + z * 0.09) * 0.55 +
    Math.sin((x + z * 1.7) * 0.0115) * 3.4 +
    Math.sin(x * 0.0071 - z * 0.013) * 4.2;
  return (h + 6.5) * ramp * 0.9;
}

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  // v maps to elevation: 0 = zenith, 0.5 = horizon, 1 = straight down.
  grad.addColorStop(0.0, '#0d0722');
  grad.addColorStop(0.22, '#1d0f3d');
  grad.addColorStop(0.38, '#4a1c56');
  grad.addColorStop(0.455, '#a33a63');
  grad.addColorStop(0.487, '#e86a45');
  grad.addColorStop(0.5, '#ffc074');
  grad.addColorStop(0.53, '#8d3f5e');
  grad.addColorStop(1.0, '#2a1330');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

function buildTerrain() {
  const segX = Math.floor(WORLD_LEN / 9);
  const geo = new THREE.PlaneGeometry(WORLD_LEN, HALF_DEPTH * 2, segX, 40);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const cPath = new THREE.Color('#584a76');
  const cGrass = new THREE.Color('#1f6b52');
  const cMoss = new THREE.Color('#2f8f5e');
  const cRock = new THREE.Color('#5b5470');
  const cSnow = new THREE.Color('#dfe6ff');
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = groundHeight(x + WORLD_LEN / 2, z);
    pos.setY(i, h);

    // Blend the runway into the grass by distance so there is no hard seam.
    if (h < 3) tmp.copy(cGrass).lerp(cMoss, h / 3);
    else if (h < 11) tmp.copy(cMoss).lerp(cRock, (h - 3) / 8);
    else tmp.copy(cRock).lerp(cSnow, Math.min(1, (h - 11) / 9));
    const road = 1 - THREE.MathUtils.smoothstep(Math.abs(z), 4.5, 12);
    if (road > 0) tmp.lerp(cPath, road);

    const n = 0.9 + ((i * 9301 + 49297) % 233280) / 233280 * 0.2;
    colors[i * 3] = tmp.r * n;
    colors[i * 3 + 1] = tmp.g * n;
    colors[i * 3 + 2] = tmp.b * n;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.95,
    metalness: 0.0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.x = WORLD_LEN / 2 - 600;
  mesh.receiveShadow = false;
  return mesh;
}

// A jagged silhouette strip used for parallax ridges.
function ridge(height, jag, color, z, seed) {
  const rand = mulberry32(seed);
  const step = 70;
  const count = Math.ceil((WORLD_LEN + 800) / step);
  const verts = [];
  let prevH = height;
  for (let i = 0; i < count; i++) {
    const x0 = -400 + i * step;
    const x1 = x0 + step;
    const h0 = prevH;
    const h1 = height + (rand() - 0.5) * jag;
    prevH = h1;
    verts.push(x0, -20, z, x1, -20, z, x1, h1, z);
    verts.push(x0, -20, z, x1, h1, z, x0, h0, z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ color, fog: false });
  return new THREE.Mesh(geo, mat);
}

function buildProps(scene) {
  const rand = mulberry32(777);

  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 1.5, 5);
  trunkGeo.translate(0, 0.75, 0);
  const leafGeo = new THREE.ConeGeometry(1.15, 3.4, 6);
  leafGeo.translate(0, 2.9, 0);
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const crystalGeo = new THREE.OctahedronGeometry(1, 0);

  const flat = (opts) => new THREE.MeshStandardMaterial({ flatShading: true, ...opts });

  const TREES = 1500;
  const ROCKS = 700;
  const CRYSTALS = 260;

  const trunks = new THREE.InstancedMesh(trunkGeo, flat({ color: '#3a2a2f', roughness: 1 }), TREES);
  const leaves = new THREE.InstancedMesh(leafGeo, flat({ color: '#1c5f47', roughness: 0.9 }), TREES);
  const rocks = new THREE.InstancedMesh(rockGeo, flat({ color: '#4c4661', roughness: 1 }), ROCKS);
  const crystals = new THREE.InstancedMesh(
    crystalGeo,
    flat({ color: '#7be7ff', emissive: '#2ad4ff', emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.2 }),
    CRYSTALS,
  );

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const col = new THREE.Color();

  const place = (mesh, i, x, z, y, scale, rotY, tilt = 0) => {
    p.set(x, y, z);
    q.setFromEuler(new THREE.Euler(tilt, rotY, tilt * 0.6));
    s.setScalar(scale);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  };

  for (let i = 0; i < TREES; i++) {
    const x = rand() * WORLD_LEN;
    const z = -(14 + rand() * 74);
    const y = groundHeight(x, z) - 0.2;
    const sc = 0.7 + rand() * 1.5;
    place(trunks, i, x, z, y, sc, rand() * 6.28);
    place(leaves, i, x, z, y, sc, rand() * 6.28);
    col.setHSL(0.36 + rand() * 0.09, 0.45 + rand() * 0.2, 0.16 + rand() * 0.12);
    leaves.setColorAt(i, col);
  }
  for (let i = 0; i < ROCKS; i++) {
    const x = rand() * WORLD_LEN;
    const z = -(18 + rand() * 74);
    const y = groundHeight(x, z) - 0.3;
    place(rocks, i, x, z, y, 0.45 + rand() * 1.3, rand() * 6.28, rand() * 0.5);
    col.setHSL(0.7, 0.12, 0.22 + rand() * 0.18);
    rocks.setColorAt(i, col);
  }
  for (let i = 0; i < CRYSTALS; i++) {
    const x = rand() * WORLD_LEN;
    const z = -(20 + rand() * 70);
    const y = groundHeight(x, z) + 0.6;
    place(crystals, i, x, z, y, 0.4 + rand() * 0.9, rand() * 6.28, (rand() - 0.5) * 0.4);
    col.setHSL(rand() < 0.5 ? 0.52 : 0.83, 0.85, 0.62);
    crystals.setColorAt(i, col);
  }
  for (const mesh of [trunks, leaves, rocks, crystals]) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
  }
  return { crystals };
}

// Dashed glow strips along both edges of the runway — these sell forward speed.
function buildRunway(scene) {
  const geo = new THREE.PlaneGeometry(2.4, 0.28);
  geo.rotateX(-Math.PI / 2);
  const per = Math.floor(WORLD_LEN / 6);
  const mesh = new THREE.InstancedMesh(
    geo,
    new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    per * 2,
  );
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  let i = 0;
  for (let k = 0; k < per; k++) {
    for (const z of [-4.6, 4.6]) {
      m.makeTranslation(k * 6, 0.03, z);
      mesh.setMatrixAt(i, m);
      col.set(z < 0 ? '#ff5fc8' : '#4fd2ff');
      mesh.setColorAt(i, col);
      i++;
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
}

function buildEmbers() {
  const COUNT = 700;
  const pos = new Float32Array(COUNT * 3);
  const rand = mulberry32(4242);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (rand() - 0.5) * 80;
    pos[i * 3 + 1] = rand() * 26;
    pos[i * 3 + 2] = (rand() - 0.5) * 70;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: '#ffc98a',
    size: 0.16,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

export function buildWorld() {
  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog('#8d3f5e', 70, 235);

  const hemi = new THREE.HemisphereLight('#ffb072', '#2a1b46', 1.45);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight('#ffd0a0', 2.9);
  sun.position.set(-60, 40, -30);
  scene.add(sun);

  const rim = new THREE.DirectionalLight('#6fd8ff', 1.1);
  rim.position.set(40, 18, 40);
  scene.add(rim);

  // Follows the player for a stage-light feel.
  const spot = new THREE.PointLight('#ff6fd8', 12, 60, 2);
  spot.position.set(0, 8, 6);
  scene.add(spot);

  scene.add(buildTerrain());
  scene.add(ridge(30, 24, '#5b2a55', -118, 11));
  scene.add(ridge(46, 36, '#4a2350', -150, 22));
  scene.add(ridge(66, 50, '#3a1c48', -195, 33));

  const props = buildProps(scene);
  buildRunway(scene);
  const embers = buildEmbers();
  scene.add(embers);

  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(20, 32),
    new THREE.MeshBasicMaterial({ color: '#ffd98d', fog: false }),
  );
  sunDisc.position.set(0, 20, -300);
  scene.add(sunDisc);

  return { scene, hemi, sun, rim, spot, embers, sunDisc, ...props };
}
