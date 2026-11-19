// The people of Costa Alba: pedestrians strolling the sidewalks, who scatter
// and run when a gun goes off or a car comes at them too fast.

import { PEDESTRIANS, WORLD } from './config.js';
import { makeRng, pick, range } from './rng.js';

const SHIRT_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0xffffff, 0x1abc9c, 0xe67e22];
const SKIN_COLORS = [0xe8b98a, 0xc98a5a, 0x8a5a34, 0xf2c9a0];

function makePedMesh(rng) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, SHIRT_COLORS) });
  const skin = new THREE.MeshLambertMaterial({ color: pick(rng, SKIN_COLORS) });
  const pants = new THREE.MeshLambertMaterial({ color: pick(rng, [0x2c3e50, 0x5a4a3a, 0x34495e]) });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), shirt);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.62;
  head.castShadow = true;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.2), pants);
  legL.position.set(-0.15, 0.33, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.2), pants);
  legR.position.set(0.15, 0.33, 0);
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), shirt);
  armL.position.set(-0.36, 1.05, 0);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), shirt);
  armR.position.set(0.36, 1.05, 0);
  group.add(armR);
  group.userData = { legL, legR, armL, armR };
  return group;
}

class Pedestrian {
  constructor(mesh) {
    this.mesh = mesh;
    this.x = 0;
    this.z = 0;
    this.heading = 0;
    this.speed = PEDESTRIANS.walkSpeed;
    this.targetX = 0;
    this.targetZ = 0;
    this.state = 'walk'; // walk | flee | down
    this.stateTime = 0;
    this.walkPhase = Math.random() * 6;
  }

  syncMesh() {
    this.mesh.position.set(this.x, this.state === 'down' ? 0.3 : 0, this.z);
    this.mesh.rotation.y = this.heading;
    if (this.state === 'down') {
      this.mesh.rotation.x = -Math.PI / 2;
    } else {
      this.mesh.rotation.x = 0;
      const swing = Math.sin(this.walkPhase) * 0.5;
      this.mesh.userData.legL.rotation.x = swing;
      this.mesh.userData.legR.rotation.x = -swing;
      this.mesh.userData.armL.rotation.x = -swing * 0.7;
      this.mesh.userData.armR.rotation.x = swing * 0.7;
    }
  }
}

export class PedestrianManager {
  constructor(game, seed = 5) {
    this.game = game;
    this.rng = makeRng(seed);
    this.peds = [];
  }

  randomSidewalkPoint() {
    const rng = this.rng;
    // Pick a block centre, then a point near its edge (the sidewalk).
    const bx = Math.floor(rng() * 6);
    const bz = Math.floor(rng() * 6);
    const cx = -150 + bx * 60;
    const cz = -150 + bz * 60;
    const edge = Math.floor(rng() * 4);
    const along = range(rng, -18, 18);
    if (edge === 0) return { x: cx + along, z: cz - 20 };
    if (edge === 1) return { x: cx + along, z: cz + 20 };
    if (edge === 2) return { x: cx - 20, z: cz + along };
    return { x: cx + 20, z: cz + along };
  }

  spawnPeds() {
    for (let i = 0; i < PEDESTRIANS.count; i += 1) {
      const mesh = makePedMesh(this.rng);
      const ped = new Pedestrian(mesh);
      const point = this.randomSidewalkPoint();
      ped.x = point.x;
      ped.z = point.z;
      const next = this.randomSidewalkPoint();
      ped.targetX = next.x;
      ped.targetZ = next.z;
      ped.heading = Math.atan2(next.x - point.x, next.z - point.z);
      this.game.scene.add(mesh);
      ped.syncMesh();
      this.peds.push(ped);
    }
  }

  /** A car ran over this spot: knock down any ped inside the radius. */
  hitByCar(x, z, radius) {
    let hit = false;
    for (const ped of this.peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - x, ped.z - z) < radius) {
        ped.state = 'down';
        ped.stateTime = 0;
        hit = true;
      }
    }
    return hit;
  }

  /** A gunshot or a speeding car nearby: peds run away from the point. */
  scare(x, z, radius) {
    for (const ped of this.peds) {
      if (ped.state !== 'walk') continue;
      if (Math.hypot(ped.x - x, ped.z - z) < radius) {
        ped.state = 'flee';
        ped.stateTime = 0;
        const dx = ped.x - x;
        const dz = ped.z - z;
        const dist = Math.hypot(dx, dz) || 1;
        ped.targetX = ped.x + (dx / dist) * 60;
        ped.targetZ = ped.z + (dz / dist) * 60;
      }
    }
  }

  update(dt) {
    for (const ped of this.peds) {
      ped.stateTime += dt;
      if (ped.state === 'down') {
        if (ped.stateTime > 8) {
          ped.state = 'flee';
          ped.stateTime = 0;
          ped.targetX = ped.x + range(this.rng, -50, 50);
          ped.targetZ = ped.z + range(this.rng, -50, 50);
        }
        ped.syncMesh();
        continue;
      }
      const speed = ped.state === 'flee' ? PEDESTRIANS.fleeSpeed : PEDESTRIANS.walkSpeed;
      const dx = ped.targetX - ped.x;
      const dz = ped.targetZ - ped.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.5) {
        if (ped.state === 'flee') {
          ped.state = 'walk';
          ped.stateTime = 0;
        }
        const next = this.randomSidewalkPoint();
        ped.targetX = next.x;
        ped.targetZ = next.z;
        continue;
      }
      ped.heading = Math.atan2(dx, dz);
      ped.x += (dx / dist) * speed * dt;
      ped.z += (dz / dist) * speed * dt;
      ped.walkPhase += dt * speed * 2.2;
      const fixed = this.game.city.resolveCollision(ped.x, ped.z, 0.5);
      ped.x = fixed.x;
      ped.z = fixed.z;
      ped.syncMesh();
    }
  }

  /** Hostile crew members for the pier fight: peds that stand and shoot. */
  spawnGang(x, z, count) {
    const gang = [];
    for (let i = 0; i < count; i += 1) {
      const mesh = makePedMesh(this.rng);
      // Gang members wear dark shirts.
      mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
      const ped = new Pedestrian(mesh);
      ped.x = x + range(this.rng, -8, 8);
      ped.z = z + range(this.rng, -6, 6);
      ped.targetX = ped.x;
      ped.targetZ = ped.z;
      ped.health = 100;
      this.game.scene.add(mesh);
      ped.syncMesh();
      this.peds.push(ped);
      gang.push(ped);
    }
    return gang;
  }
}
