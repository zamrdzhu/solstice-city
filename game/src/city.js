// Solstice City itself: a low-poly sun-soaked coastal grid — roads, sidewalks,
// towers, shops, palms, streetlights, the beach, the sea and the old pier.
// Builds every mesh once, and hands back the collision boxes and the road graph
// the traffic, the pedestrians and the missions drive on.
import { CITY, PALETTE } from './config.js';
import { pick, range } from './random.js';

const BUILDING_COLORS = [0xf2e3c6, 0xe8b48c, 0xd9a0a0, 0xa8c8d8, 0xf5f0e6, 0xc9b8d8, 0x9fc8a8, 0xe8d27a];
const ROOF_COLORS = [0x8a6f5c, 0x5c6e7a, 0x7a5c6e, 0x4a5a6a];
const SHOP_COLORS = [0xff6b6b, 0xffd23e, 0x4ecdc4, 0xff9f43, 0x6c5ce7, 0x00b894];

function box(w, h, d, color, x, y, z, opts = {}) {
  const mat = new THREE.MeshLambertMaterial({ color, emissive: opts.emissive ?? 0x000000 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  if (opts.ry) mesh.rotation.y = opts.ry;
  mesh.castShadow = opts.shadow !== false;
  mesh.receiveShadow = true;
  return mesh;
}

function windowStrip(mat, w, h, x, y, z, ry) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  return mesh;
}

export function buildCity(scene, random) {
  const colliders = []; // {minX, maxX, minZ, maxZ} — buildings and props the player bumps into
  const group = new THREE.Group();
  scene.add(group);

  const groundMat = new THREE.MeshLambertMaterial({ color: PALETTE.grass });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  ground.receiveShadow = true;
  group.add(ground);

  // City slab: asphalt base under the whole grid, sidewalks as a lighter inset.
  const slab = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2 + CITY.road, CITY.half * 2 + CITY.road),
    new THREE.MeshLambertMaterial({ color: PALETTE.asphalt }),
  );
  slab.rotation.x = -Math.PI / 2;
  slab.position.set(0, 0, 0);
  slab.receiveShadow = true;
  group.add(slab);

  // Sidewalk tiles per block, with a thin curb look.
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf5f0dc });
  for (const bx of CITY.streets) {
    for (const bz of CITY.streets) {
      const tile = new THREE.Mesh(new THREE.PlaneGeometry(CITY.block, CITY.block), sidewalkMat);
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(bx, 0.02, bz);
      tile.receiveShadow = true;
      group.add(tile);
      // Dashed centre lines on the roads around each block.
      for (let i = -2; i <= 2; i += 1) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 4), stripeMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(bx + i * 9, 0.03, bz + CITY.block / 2 + CITY.road / 2);
        group.add(dash);
      }
    }
  }

  // Beach and sea, west of the city.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(60, CITY.half * 2 + 120),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-CITY.half - 30, 0.01, 0);
  sand.receiveShadow = true;
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(300, CITY.half * 2 + 240),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-CITY.half - 210, -0.4, 0);
  group.add(sea);

  // Buildings: one or two per block, heights by district (tall near the plaza,
  // low near the beach), with lit window strips and a roof box.
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x2a4a66, emissive: 0x112233 });
  const litMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x664411 });
  for (const bx of CITY.streets) {
    for (const bz of CITY.streets) {
      // The plaza block stays open: fountains and palms, no tower.
      if (bx === 0 && bz === 0) continue;
      const dist = Math.hypot(bx, bz) / 270;
      const tall = random() < (0.55 - dist * 0.35);
      const w = range(random, 16, 26);
      const d = range(random, 16, 26);
      const h = tall ? range(random, 34, 72) : range(random, 8, 20);
      const cx = bx + range(random, -4, 4);
      const cz = bz + range(random, -4, 4);
      const color = pick(random, BUILDING_COLORS);
      const tower = box(w, h, d, color, cx, h / 2, cz);
      group.add(tower);
      colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
      // Roof box + window strips on the two street-facing sides.
      group.add(box(w * 0.4, 2.2, d * 0.4, pick(random, ROOF_COLORS), cx, h + 1.1, cz));
      const floors = Math.max(1, Math.floor(h / 7));
      for (let f = 0; f < floors; f += 1) {
        const wy = 4 + f * 7;
        if (wy > h - 3) break;
        const lit = random() < 0.25;
        group.add(windowStrip(lit ? litMat : glassMat, w * 0.7, 3.2, cx, wy, cz + d / 2 + 0.06, 0));
        group.add(windowStrip(lit ? litMat : glassMat, w * 0.7, 3.2, cx, wy, cz - d / 2 - 0.06, Math.PI));
      }
      // A shop awning on some low buildings.
      if (!tall && random() < 0.5) {
        const awn = box(w * 0.6, 0.5, 3, pick(random, SHOP_COLORS), cx, 3.4, cz + d / 2 + 1.2, { shadow: false });
        group.add(awn);
      }
    }
  }

  // Solstice Plaza: fountain, benches and palms in the open centre block.
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 1.2, 20), new THREE.MeshLambertMaterial({ color: 0x9fb8c8 }));
  fountain.position.set(0, 0.6, 0);
  fountain.castShadow = true;
  group.add(fountain);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.4, 20), new THREE.MeshLambertMaterial({ color: 0x3a9fc0 }));
  water.position.set(0, 1.1, 0);
  group.add(water);
  colliders.push({ minX: -8, maxX: 8, minZ: -8, maxZ: 8 });

  // Landmarks: Solstice Tower (tallest, plaza north), the Marina (south-west) and
  // Kestrel's garage (north-east) get a sign so the player can navigate by them.
  function sign(text, x, z, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const c = canvas.getContext('2d');
    c.fillStyle = '#10202e';
    c.fillRect(0, 0, 512, 96);
    c.fillStyle = color;
    c.font = 'bold 52px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 256, 52);
    const tex = new THREE.CanvasTexture(canvas);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 2.6),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    mesh.position.set(x, 12, z);
    group.add(mesh);
    return mesh;
  }
  group.add(box(24, 96, 24, 0xdde8f0, 0, 48, -48));
  colliders.push({ minX: -12, maxX: 12, minZ: -60, maxZ: -36 });
  sign('SOLSTICE TOWER', 0, -35.6, '#ffd23e');
  sign('MARINA', -168, -155.5, '#4ecdc4');
  sign('KESTREL GARAGE', 168, -155.5, '#ff9f43');
  sign('SOLSTICE MOTORS', -96, 131.5, '#ff6b6b');

  // The old pier: wooden planks out over the sea, with posts and a shack.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
  for (let i = 0; i < 14; i += 1) {
    const plank = box(6, 0.5, 4.4, 0x9a7a55, -CITY.half - 6 - i * 4.4, 0.6, CITY.pierZ, { shadow: false });
    group.add(plank);
  }
  const shack = box(8, 5, 7, 0x6a8a9a, -CITY.half - 58, 3.1, CITY.pierZ);
  group.add(shack);
  colliders.push({ minX: -CITY.half - 62, maxX: -CITY.half - 54, minZ: CITY.pierZ - 3.5, maxZ: CITY.pierZ + 3.5 });

  // Palm trees along the beach road and the plaza.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d });
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), trunkMat);
    trunk.position.y = 3.5;
    trunk.castShadow = true;
    g.add(trunk);
    for (let i = 0; i < 6; i += 1) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.5, 4), leafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.6, 7.4, Math.sin(a) * 1.6);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    group.add(g);
    colliders.push({ minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.6, maxZ: z + 0.6 });
  }
  for (let z = -200; z <= 200; z += 24) {
    if (Math.abs(z - CITY.pierZ) < 14) continue; // keep the pier mouth clear
    palm(-CITY.half - 6, z + range(random, -3, 3));
  }
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    palm(Math.cos(a) * 14, Math.sin(a) * 14);
  }

  // Streetlights at every other intersection.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const sx of CITY.streets) {
    for (const sz of CITY.streets) {
      if ((sx + sz) % 96 !== 0) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), poleMat);
      pole.position.set(sx + 8, 3.5, sz + 8);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
      lamp.position.set(sx + 8, 7.1, sz + 8);
      group.add(lamp);
    }
  }

  // Road graph: every road centreline, for traffic and for spawning.
  const roads = { vertical: CITY.roads.slice(), horizontal: CITY.roads.slice() };
  return { group, colliders, roads, spawnPoints: { plaza: CITY.plaza, safehouse: CITY.safehouse } };
}

// Circle (player, car, ped) against the building boxes: push out and report a hit.
export function collideCircle(colliders, x, z, radius) {
  let hit = false;
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nx;
    const dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (radius - d) / d;
        x += dx * push;
        z += dz * push;
      } else {
        x += radius;
      }
    }
  }
  return { x, z, hit };
}

export function clampToCity(x, z, margin) {
  return {
    x: Math.max(-CITY.half - 70, Math.min(CITY.half + margin, x)),
    z: Math.max(-CITY.half - margin, Math.min(CITY.half + margin, z)),
  };
}
