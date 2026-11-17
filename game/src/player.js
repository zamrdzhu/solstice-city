// Mara Voss, the player: on-foot movement with a third-person camera yaw, and
// getting in and out of cars. The player object is the one the police, the HUD
// and the missions all read.
import { PLAYER, CITY } from './config.js';
import { collideCircle, clampToCity } from './city.js';

export function makePlayerMesh() {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xe0ac69 });
  const jacket = new THREE.MeshLambertMaterial({ color: 0xd94f3d });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2d3436 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.82, 0.26), pants);
  legs.position.y = 0.41;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.62, 0.32), jacket);
  torso.position.y = 1.13;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skin);
  head.position.y = 1.64;
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.38), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  hair.position.y = 1.84;
  // A yellow scarf so Mara reads at a distance.
  const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.36), new THREE.MeshLambertMaterial({ color: 0xffd23e }));
  scarf.position.y = 1.42;
  for (const m of [legs, torso, head, hair, scarf]) m.castShadow = true;
  group.add(legs, torso, head, hair, scarf);
  group.userData.legs = legs;
  return group;
}

export function createPlayer(scene, x, z) {
  const mesh = makePlayerMesh();
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return {
    mesh,
    x,
    z,
    angle: 0,        // body facing
    camYaw: Math.PI, // camera orbit yaw (behind the player at start)
    health: PLAYER.maxHealth,
    cash: PLAYER.startCash,
    inCar: false,
    car: null,
    walkPhase: 0,
    speed: 0,
  };
}

export function stepPlayerOnFoot(player, input, dt, colliders, mouse) {
  player.camYaw -= mouse.dx * 0.0032;
  const move = input.move();
  const speed = move.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  // Move relative to the camera, not the body, so W always walks away from the camera.
  const sin = Math.sin(player.camYaw);
  const cos = Math.cos(player.camYaw);
  const mx = (move.x * cos - move.y * sin);
  const mz = (-move.x * sin - move.y * cos);
  const len = Math.hypot(mx, mz);
  player.speed = len > 0 ? speed : 0;
  if (len > 0) {
    const nx = player.x + (mx / len) * speed * dt;
    const nz = player.z + (mz / len) * speed * dt;
    const hit = collideCircle(colliders, nx, nz, PLAYER.radius);
    player.x = hit.x;
    player.z = hit.z;
    const clamped = clampToCity(player.x, player.z, 2);
    player.x = clamped.x;
    player.z = clamped.z;
    player.angle = Math.atan2(mx, mz);
    player.walkPhase += dt * speed * 1.6;
  }
  player.mesh.position.set(player.x, Math.abs(Math.sin(player.walkPhase)) * 0.05, player.z);
  player.mesh.rotation.y = player.angle;
  player.mesh.rotation.z = len > 0 ? Math.sin(player.walkPhase) * 0.04 : 0;
}

// Find the nearest car the player could steal (parked or traffic, not police).
export function nearestCar(player, cars, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (!car.alive) continue;
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function enterCar(player, car) {
  player.inCar = true;
  player.car = car;
  player.mesh.visible = false;
  car.speed = 0;
  return car;
}

export function exitCar(player) {
  const car = player.car;
  if (!car) return;
  player.inCar = false;
  player.car = null;
  // Step out to the driver's side.
  player.x = car.x - Math.cos(car.angle) * 2.2;
  player.z = car.z + Math.sin(car.angle) * 2.2;
  player.angle = car.angle;
  player.mesh.visible = true;
  player.mesh.position.set(player.x, 0, player.z);
}
