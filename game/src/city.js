// Costa Alba itself: a sun-soaked coastal city on a road grid, with a beach
// and pier on the west edge, a lighthouse on the point, a marina in the south
// and a downtown cluster of towers in the middle. Everything is built from
// boxes, cylinders and canvas textures — no loaded assets, all local.

import { WORLD, PALETTE } from './config.js';
import { makeRng, pick, range, int } from './rng.js';

const ROADS = [-180, -120, -60, 0, 60, 120, 180];
const WALL_COLORS = [PALETTE.wallWhite, PALETTE.wallTerra, PALETTE.wallBlue, 0xe8c9a0, 0xc9d6c5];
const ROOF_COLORS = [PALETTE.roofTerra, PALETTE.roofSlate, 0x8a5a44, 0x6b7a6b];

/** A canvas texture of lit and dark windows on a wall colour. */
function facadeTexture(rng, wall, floors, cols) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#' + wall.toString(16).padStart(6, '0');
  ctx.fillRect(0, 0, 128, 256);
  const litColors = ['#ffd98a', '#fff3c9', '#cfe8ff'];
  for (let f = 0; f < floors; f += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = 10 + c * ((128 - 20) / cols);
      const y = 12 + f * ((256 - 24) / floors);
      const lit = rng() < 0.45;
      ctx.fillStyle = lit ? pick(rng, litColors) : '#2b3542';
      ctx.fillRect(x, y, (128 - 20) / cols - 8, (256 - 24) / floors - 10);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 2;
  return texture;
}

/** A shop sign texture with big readable text. */
function signTexture(text, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = fg;
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  return new THREE.CanvasTexture(canvas);
}

function box(w, h, d, color, x, y, z, material) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    material || new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export class City {
  constructor(scene, seed = 1) {
    this.scene = scene;
    this.rng = makeRng(seed);
    this.colliders = []; // { minX, maxX, minZ, maxZ }
    this.buildings = [];
    this.roadMaterial = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
    this.buildGround();
    this.buildRoads();
    this.buildBlocks();
    this.buildBeach();
    this.buildPier();
    this.buildLighthouse();
    this.buildMarina();
    this.buildProps();
  }

  addCollider(minX, maxX, minZ, maxZ) {
    this.colliders.push({ minX, maxX, minZ, maxZ });
  }

  buildGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD.halfSize * 2 + 320, WORLD.halfSize * 2 + 320),
      new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Sand strip along the west edge.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(44, WORLD.halfSize * 2 + 320),
      new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(-218, 0.02, 0);
    sand.receiveShadow = true;
    this.scene.add(sand);

    // The sea, west of the sand.
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(180, WORLD.halfSize * 2 + 320),
      new THREE.MeshLambertMaterial({ color: PALETTE.sea, transparent: true, opacity: 0.92 }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(-330, 0.01, 0);
    this.scene.add(sea);
  }

  buildRoads() {
    const rng = this.rng;
    for (const x of ROADS) {
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(WORLD.roadWidth, WORLD.halfSize * 2),
        this.roadMaterial,
      );
      road.rotation.x = -Math.PI / 2;
      road.position.set(x, 0.04, 0);
      road.receiveShadow = true;
      this.scene.add(road);
      // Centre dashes.
      for (let z = -WORLD.halfSize + 8; z < WORLD.halfSize; z += 16) {
        const dash = new THREE.Mesh(
          new THREE.PlaneGeometry(0.5, 5),
          new THREE.MeshBasicMaterial({ color: 0xd8c25a }),
        );
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(x, 0.06, z);
        this.scene.add(dash);
      }
    }
    for (const z of ROADS) {
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(WORLD.halfSize * 2, WORLD.roadWidth),
        this.roadMaterial,
      );
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0.04, z);
      road.receiveShadow = true;
      this.scene.add(road);
      for (let x = -WORLD.halfSize + 8; x < WORLD.halfSize; x += 16) {
        const dash = new THREE.Mesh(
          new THREE.PlaneGeometry(5, 0.5),
          new THREE.MeshBasicMaterial({ color: 0xd8c25a }),
        );
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(x, 0.06, z);
        this.scene.add(dash);
      }
    }
    // Crosswalk stripes at the central intersection.
    for (const [cx, cz] of [[0, 0], [60, 60], [-60, -60], [120, 0], [0, 120]]) {
      for (let i = -2; i <= 2; i += 1) {
        const stripe = new THREE.Mesh(
          new THREE.PlaneGeometry(1.1, 4),
          new THREE.MeshBasicMaterial({ color: 0xf2f2ee }),
        );
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(cx + i * 2.4, 0.07, cz - 8);
        this.scene.add(stripe);
      }
    }
    void rng;
  }

  buildBlocks() {
    const rng = this.rng;
    for (let bx = 0; bx < ROADS.length - 1; bx += 1) {
      for (let bz = 0; bz < ROADS.length - 1; bz += 1) {
        const cx = (ROADS[bx] + ROADS[bx + 1]) / 2;
        const cz = (ROADS[bz] + ROADS[bz + 1]) / 2;
        // Skip the block where the pier meets the beach, and the marina block.
        if (cx < -150 && Math.abs(cz) < 40) continue;
        if (cx < -150 && cz > 120) continue;
        // Sidewalk slab for the block.
        const slab = new THREE.Mesh(
          new THREE.BoxGeometry(WORLD.blockSize, 0.3, WORLD.blockSize),
          new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk }),
        );
        slab.position.set(cx, 0.15, cz);
        slab.receiveShadow = true;
        this.scene.add(slab);
        const downtown = Math.abs(cx) <= 60 && Math.abs(cz) <= 60;
        const count = downtown ? int(rng, 2, 3) : int(rng, 1, 3);
        for (let i = 0; i < count; i += 1) {
          const w = range(rng, 12, 18);
          const d = range(rng, 12, 18);
          const h = downtown ? range(rng, 28, 68) : range(rng, 9, 26);
          const ox = range(rng, -9, 9);
          const oz = range(rng, -9, 9);
          const wall = pick(rng, WALL_COLORS);
          const floors = Math.max(2, Math.floor(h / 4));
          const texture = facadeTexture(rng, wall, floors, 4);
          const material = new THREE.MeshLambertMaterial({ map: texture });
          const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
          building.position.set(cx + ox, 0.3 + h / 2, cz + oz);
          building.castShadow = true;
          building.receiveShadow = true;
          this.scene.add(building);
          const roof = box(w + 0.6, 0.8, d + 0.6, pick(rng, ROOF_COLORS), cx + ox, 0.3 + h + 0.4, cz + oz);
          this.scene.add(roof);
          this.addCollider(cx + ox - w / 2, cx + ox + w / 2, cz + oz - d / 2, cz + oz + d / 2);
          this.buildings.push(building);
          // A shop sign on some ground-floor fronts.
          if (rng() < 0.4 && h < 30) {
            const sign = new THREE.Mesh(
              new THREE.PlaneGeometry(9, 2.2),
              new THREE.MeshBasicMaterial({
                map: signTexture(pick(rng, ['CAFÉ', 'TACOS', '24H MART', 'SURF SHOP', 'PIZZA', 'LAUNDRY']), pick(rng, ['#20303c', '#7a2e2e', '#1f4d3a', '#5a3a7a']), '#ffffff'),
              }),
            );
            sign.position.set(cx + ox, 3.4, cz + oz + d / 2 + 0.1);
            this.scene.add(sign);
          }
        }
      }
    }
  }

  buildBeach() {
    const rng = this.rng;
    // Palm trees along the beachfront.
    for (let z = -220; z <= 220; z += 22) {
      if (Math.abs(z) < 18) continue; // keep the pier mouth clear
      this.palm(-198 + range(rng, -3, 3), z + range(rng, -4, 4));
    }
    // A few umbrellas and towels on the sand.
    for (let i = 0; i < 8; i += 1) {
      const x = range(rng, -232, -204);
      const z = range(rng, -200, 200);
      const umbrella = new THREE.Mesh(
        new THREE.ConeGeometry(2.4, 1.2, 8),
        new THREE.MeshLambertMaterial({ color: pick(rng, [0xff5da2, 0x59e6ff, 0xffb347, 0xffffff]) }),
      );
      umbrella.position.set(x, 2.2, z);
      umbrella.castShadow = true;
      this.scene.add(umbrella);
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6),
        new THREE.MeshLambertMaterial({ color: 0x8a7a5a }),
      );
      pole.position.set(x, 1.1, z);
      this.scene.add(pole);
    }
  }

  palm(x, z) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.34, 6.5, 7),
      new THREE.MeshLambertMaterial({ color: 0x8a6a4a }),
    );
    trunk.position.set(x, 3.25, z);
    trunk.rotation.z = 0.08;
    trunk.castShadow = true;
    this.scene.add(trunk);
    const fronds = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 2.2, 7),
      new THREE.MeshLambertMaterial({ color: PALETTE.palm }),
    );
    fronds.position.set(x + 0.5, 7.2, z);
    fronds.castShadow = true;
    this.scene.add(fronds);
    this.addCollider(x - 0.4, x + 0.4, z - 0.4, z + 0.4);
  }

  buildPier() {
    // Wooden pier reaching west from the beach at z = 0.
    for (let x = -196; x >= -258; x -= 4) {
      const plank = box(4, 0.4, 10, 0x9a7a52, x, 0.9, 0);
      this.scene.add(plank);
    }
    for (const z of [-4.6, 4.6]) {
      for (let x = -196; x >= -258; x -= 8) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.22, 2.4, 6),
          new THREE.MeshLambertMaterial({ color: 0x6b4a2a }),
        );
        post.position.set(x, 0.6, z);
        this.scene.add(post);
      }
    }
    // Crates stacked near the pier mouth (cover for the pier fight).
    for (let i = 0; i < 6; i += 1) {
      const crate = box(1.8, 1.8, 1.8, 0xa8845a, -204 - (i % 3) * 2.4, 0.9 + Math.floor(i / 3) * 1.8, -2 + (i % 2) * 4);
      this.scene.add(crate);
      this.addCollider(crate.position.x - 0.9, crate.position.x + 0.9, crate.position.z - 0.9, crate.position.z + 0.9);
    }
    // A small bait shack at the pier mouth.
    const shack = box(6, 3.4, 5, 0x7a9ab0, -200, 1.7, 8);
    this.scene.add(shack);
    this.addCollider(-203, -197, 5.5, 10.5);
  }

  buildLighthouse() {
    // The finale landmark: a striped lighthouse on the point at (-225, -150).
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 4.2, 4, 10),
      new THREE.MeshLambertMaterial({ color: 0x8a8a7a }),
    );
    base.position.set(-225, 2, -150);
    base.castShadow = true;
    this.scene.add(base);
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.8, 16, 10),
      new THREE.MeshLambertMaterial({ color: 0xf2ead8 }),
    );
    tower.position.set(-225, 12, -150);
    tower.castShadow = true;
    this.scene.add(tower);
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(2.45, 2.6, 2.4, 10),
      new THREE.MeshLambertMaterial({ color: 0xc0392b }),
    );
    band.position.set(-225, 13, -150);
    this.scene.add(band);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0 }),
    );
    lamp.position.set(-225, 20.8, -150);
    this.scene.add(lamp);
    // The rotating beam: a long translucent cone, spun by main.js.
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(4, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.set(-225, 20.8, -150);
    beam.rotation.z = Math.PI / 2;
    this.scene.add(beam);
    this.lighthouseBeam = beam;
    this.addCollider(-229, -221, -154, -146);
  }

  buildMarina() {
    // Docks and moored boats in the south bay, near (-160, 170).
    for (let i = 0; i < 3; i += 1) {
      const dock = box(2, 0.5, 26, 0x9a7a52, -170 + i * 8, 0.6, 185);
      this.scene.add(dock);
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 1.4, 9),
        new THREE.MeshLambertMaterial({ color: pick(this.rng, [0xffffff, 0x2e6f8f, 0xc0392b]) }),
      );
      hull.position.set(-170 + i * 8 + 3.4, 0.8, 182);
      hull.castShadow = true;
      this.scene.add(hull);
      const cabin = box(2.2, 1.4, 3, 0xf2ead8, -170 + i * 8 + 3.4, 2.1, 182);
      this.scene.add(cabin);
    }
  }

  buildProps() {
    const rng = this.rng;
    // Streetlights at every other intersection, palms along the main avenue.
    for (const [x, z] of ROADS.flatMap((rx) => ROADS.map((rz) => [rx, rz]))) {
      if ((x + z) % 120 !== 0) continue;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 7, 6),
        new THREE.MeshLambertMaterial({ color: 0x3a3d42 }),
      );
      pole.position.set(x + 7, 3.5, z + 7);
      this.scene.add(pole);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xfff2b0 }),
      );
      lamp.position.set(x + 7, 7.1, z + 7);
      this.scene.add(lamp);
    }
    // Palms down the central avenue.
    for (let z = -180; z <= 180; z += 30) {
      this.palm(7, z);
      this.palm(-7, z + 15);
    }
    // Traffic lights at the centre intersection.
    for (const [x, z, ry] of [[7, -7, 0], [-7, 7, Math.PI], [7, 7, Math.PI / 2], [-7, -7, -Math.PI / 2]]) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 5, 6),
        new THREE.MeshLambertMaterial({ color: 0x222222 }),
      );
      pole.position.set(x, 2.5, z);
      this.scene.add(pole);
      const head = box(0.5, 1.4, 0.5, 0x1a1a1a, x, 5.4, z);
      this.scene.add(head);
      const light = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshBasicMaterial({ color: pick(rng, [0x2eff5a, 0xffb347, 0xff3b30]) }),
      );
      light.position.set(x, 5.7, z);
      this.scene.add(light);
      void ry;
    }
  }

  /** The nearest road coordinate to a point, on the given axis. */
  nearestRoad(value) {
    let best = ROADS[0];
    for (const r of ROADS) if (Math.abs(r - value) < Math.abs(best - value)) best = r;
    return best;
  }

  /** Push a circle (x, z, radius) out of every building collider it overlaps. */
  resolveCollision(x, z, radius) {
    for (const c of this.colliders) {
      const nx = Math.max(c.minX, Math.min(x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - nx;
      const dz = z - nz;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        if (distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          x = nx + (dx / dist) * radius;
          z = nz + (dz / dist) * radius;
        } else {
          x += radius;
        }
      }
    }
    return { x, z };
  }

  /** True when the point is on a road (used by traffic and the wanted system). */
  onRoad(x, z) {
    for (const r of ROADS) {
      if (Math.abs(x - r) < WORLD.roadWidth / 2 + 1) return true;
      if (Math.abs(z - r) < WORLD.roadWidth / 2 + 1) return true;
    }
    return false;
  }
}
