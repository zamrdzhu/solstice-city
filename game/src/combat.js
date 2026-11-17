// Combat: the player's pistol (mouse click, raycast from the camera), enemy
// shooters for the pier job, muzzle flashes and hit feedback. Enemies are
// Gull Gang members in green jackets; they take three hits and shoot back badly.
import { CITY } from './config.js';
import { range } from './random.js';

export function createCombat(scene) {
  return {
    scene,
    enemies: [],
    tracer: null,
    tracerTimer: 0,
    flash: null,
    cooldown: 0,
  };
}

function makeEnemyMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2e7d32 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc68642 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.8, 0.24), new THREE.MeshLambertMaterial({ color: 0x2d3436 }));
  legs.position.y = 0.4;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.64, 0.32), jacket);
  torso.position.y = 1.12;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skin);
  head.position.y = 1.64;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.38), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  cap.position.y = 1.84;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.6), new THREE.MeshLambertMaterial({ color: 0x1a1a1e }));
  gun.position.set(0.3, 1.2, 0.4);
  for (const m of [legs, torso, head, cap, gun]) m.castShadow = true;
  group.add(legs, torso, head, cap, gun);
  return group;
}

export function spawnEnemies(combat, random, cx, cz, count) {
  clearEnemies(combat);
  for (let i = 0; i < count; i += 1) {
    const mesh = makeEnemyMesh();
    const x = cx + range(random, -14, 14);
    const z = cz + range(random, -8, 8);
    mesh.position.set(x, 0, z);
    combat.scene.add(mesh);
    combat.enemies.push({
      mesh, x, z, health: 3, alive: true,
      shootTimer: range(random, 0.5, 2.5),
      strafe: range(random, -1, 1),
      angle: random() * Math.PI * 2,
    });
  }
  return combat.enemies;
}

export function clearEnemies(combat) {
  for (const e of combat.enemies) combat.scene.remove(e.mesh);
  combat.enemies = [];
}

export function enemiesLeft(combat) {
  return combat.enemies.filter((e) => e.alive).length;
}

// The player shoots where the camera looks. Returns the enemy hit, if any.
export function playerShoot(combat, camera, playerPos) {
  if (combat.cooldown > 0) return null;
  combat.cooldown = 0.28;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  raycaster.far = 80;
  const meshes = combat.enemies.filter((e) => e.alive).map((e) => e.mesh);
  const hits = raycaster.intersectObjects(meshes, true);
  // Muzzle flash + tracer line from the player to the hit (or 40 m out).
  const end = hits.length ? hits[0].point : raycaster.ray.at(40, new THREE.Vector3());
  showTracer(combat, playerPos, end);
  if (!hits.length) return null;
  let hitEnemy = null;
  for (const e of combat.enemies) {
    if (e.alive && e.mesh === hits[0].object.parent.parent) hitEnemy = e;
    if (e.alive && hits[0].object.parent === e.mesh) hitEnemy = e;
  }
  // intersectObjects returns the child mesh; walk up to the enemy group.
  if (!hitEnemy) {
    let obj = hits[0].object;
    while (obj && obj.parent) {
      const found = combat.enemies.find((e) => e.mesh === obj);
      if (found) { hitEnemy = found; break; }
      obj = obj.parent;
    }
  }
  if (hitEnemy) {
    hitEnemy.health -= 1;
    if (hitEnemy.health <= 0) {
      hitEnemy.alive = false;
      hitEnemy.mesh.visible = false;
    } else {
      hitEnemy.mesh.position.y = 0;
      hitEnemy.mesh.rotation.z = 0.15;
    }
  }
  return hitEnemy;
}

function showTracer(combat, from, to) {
  if (combat.tracer) combat.scene.remove(combat.tracer);
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(from.x, from.y + 1.4, from.z),
    new THREE.Vector3(to.x, to.y, to.z),
  ]);
  combat.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8 }));
  combat.scene.add(combat.tracer);
  combat.tracerTimer = 0.07;
}

export function stepCombat(combat, dt, playerPos, onPlayerHit) {
  combat.cooldown = Math.max(0, combat.cooldown - dt);
  if (combat.tracerTimer > 0) {
    combat.tracerTimer -= dt;
    if (combat.tracerTimer <= 0 && combat.tracer) {
      combat.scene.remove(combat.tracer);
      combat.tracer = null;
    }
  }
  for (const e of combat.enemies) {
    if (!e.alive) continue;
    const dx = playerPos.x - e.x;
    const dz = playerPos.z - e.z;
    const dist = Math.hypot(dx, dz);
    e.angle = Math.atan2(dx, dz);
    e.mesh.rotation.y = e.angle;
    // Strafe sideways and keep a fighting distance of 8–16 m.
    e.strafe += (Math.random() - 0.5) * dt * 2;
    e.strafe = Math.max(-1, Math.min(1, e.strafe));
    const move = dist > 16 ? 1 : dist < 8 ? -1 : 0;
    e.x += (Math.sin(e.angle) * move + Math.cos(e.angle) * e.strafe) * 2.2 * dt;
    e.z += (Math.cos(e.angle) * move - Math.sin(e.angle) * e.strafe) * 2.2 * dt;
    e.x = Math.max(CITY.beachX - 60, Math.min(CITY.half, e.x));
    e.z = Math.max(-CITY.half, Math.min(CITY.half, e.z));
    e.mesh.position.set(e.x, 0, e.z);
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && dist < 40) {
      e.shootTimer = range(Math.random, 1.2, 2.6);
      // Bad aim on purpose: ~35% of shots land.
      if (Math.random() < 0.35) onPlayerHit(9 + Math.floor(Math.random() * 8));
      return 'enemyShot';
    }
  }
  return null;
}
