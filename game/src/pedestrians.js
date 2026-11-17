// Pedestrians: low-poly city folk who stroll the sidewalks, cross at corners and
// run when a crime happens nearby. Each one is a small group of boxes with a
// walking bob, so a crowd reads as a crowd even at a glance.
import { CITY } from './config.js';
import { pick, range } from './random.js';
import { collideCircle } from './city.js';

const SHIRTS = [0xff6b6b, 0x4ecdc4, 0xffd23e, 0x6c5ce7, 0x00b894, 0xe17055, 0x74b9ff, 0xfdcb6e];
const PANTS = [0x2d3436, 0x636e72, 0x6c5ce7, 0x2e4053];
const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];

export function makePedMesh(random) {
  const group = new THREE.Group();
  const skin = pick(random, SKINS);
  const shirt = pick(random, SHIRTS);
  const pants = pick(random, PANTS);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.8, 0.24), new THREE.MeshLambertMaterial({ color: pants }));
  legs.position.y = 0.4;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.62, 0.3), new THREE.MeshLambertMaterial({ color: shirt }));
  torso.position.y = 1.11;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 1.62;
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.36), new THREE.MeshLambertMaterial({ color: pick(random, [0x2d3436, 0x6e4b2a, 0x111111, 0xd63031]) }));
  hair.position.y = 1.82;
  for (const m of [legs, torso, head, hair]) m.castShadow = true;
  group.add(legs, torso, head, hair);
  return group;
}

export function createPedestrians(scene, random, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const mesh = makePedMesh(random);
    const bx = pick(random, CITY.streets);
    const bz = pick(random, CITY.streets);
    const x = bx + range(random, -14, 14);
    const z = bz + range(random, -14, 14);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    peds.push({
      mesh,
      x,
      z,
      angle: random() * Math.PI * 2,
      speed: range(random, 1.1, 2.2),
      walkPhase: random() * Math.PI * 2,
      flee: 0,
      targetX: x,
      targetZ: z,
      retarget: 0,
      alive: true,
    });
  }
  return peds;
}

function pickSidewalkTarget(ped, random) {
  // Wander to a random corner of the block the ped is on.
  const bx = CITY.streets.reduce((a, b) => (Math.abs(b - ped.x) < Math.abs(a - ped.x) ? b : a));
  const bz = CITY.streets.reduce((a, b) => (Math.abs(b - ped.z) < Math.abs(a - ped.z) ? b : a));
  ped.targetX = bx + range(random, -15, 15);
  ped.targetZ = bz + range(random, -15, 15);
}

export function stepPedestrians(peds, dt, colliders, danger) {
  for (const ped of peds) {
    if (!ped.alive) continue;
    ped.retarget -= dt;
    if (ped.flee > 0) ped.flee -= dt;
    if (danger && Math.hypot(danger.x - ped.x, danger.z - ped.z) < 22) ped.flee = 2.5;
    if (ped.retarget <= 0) {
      pickSidewalkTarget(ped, Math.random);
      ped.retarget = range(Math.random, 3, 7);
    }
    const dx = ped.targetX - ped.x;
    const dz = ped.targetZ - ped.z;
    const dist = Math.hypot(dx, dz);
    let speed = ped.speed;
    if (ped.flee > 0) {
      // Run away from the danger point.
      const fx = ped.x - danger.x;
      const fz = ped.z - danger.z;
      const fl = Math.hypot(fx, fz) || 1;
      ped.targetX = ped.x + (fx / fl) * 20;
      ped.targetZ = ped.z + (fz / fl) * 20;
      speed = 5.5;
    }
    if (dist > 0.5) {
      const want = Math.atan2(dx, dz);
      let diff = want - ped.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ped.angle += Math.max(-3 * dt, Math.min(3 * dt, diff));
      const nx = ped.x + Math.sin(ped.angle) * speed * dt;
      const nz = ped.z + Math.cos(ped.angle) * speed * dt;
      const hit = collideCircle(colliders, nx, nz, 0.5);
      ped.x = hit.x;
      ped.z = hit.z;
      ped.walkPhase += dt * speed * 3.2;
    }
    ped.mesh.position.set(ped.x, Math.abs(Math.sin(ped.walkPhase)) * 0.06, ped.z);
    ped.mesh.rotation.y = ped.angle;
    ped.mesh.rotation.z = Math.sin(ped.walkPhase) * 0.05;
  }
}
