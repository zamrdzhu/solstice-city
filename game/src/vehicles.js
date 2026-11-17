// Cars: the low-poly body builder, the player's arcade driving, and the traffic
// that loops the street grid. One Car object per vehicle, player or traffic.
import { CAR, CITY } from './config.js';
import { pick, range } from './random.js';
import { collideCircle, clampToCity } from './city.js';

export const CAR_COLORS = [0xd94f3d, 0x3d7ad9, 0xe8b73d, 0x4ecdc4, 0x8a5fd6, 0xe8e8e8, 0x2e2e34, 0x7fae62, 0xff9f43];
const CAR_NAMES = ['Comet GT', 'Sunrunner', 'Bayliner', 'Coastline', 'Palmera', 'Vortex', 'Tide Runner', 'Solstice'];
export const POLICE_COLOR = 0x1c2a3a;

export function makeCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1a1e });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 4.4), paint);
  body.position.y = 0.65;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 2.2), glass);
  cabin.position.set(0, 1.35, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 1.1), paint);
  hood.position.set(0, 0.95, 1.6);
  group.add(hood);
  // Headlights and taillights.
  for (const sx of [-0.65, 0.65]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), new THREE.MeshBasicMaterial({ color: 0xfff6c8 }));
    head.position.set(sx, 0.7, 2.22);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    tail.position.set(sx, 0.7, -2.22);
    group.add(tail);
  }
  // Wheels.
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2233 }));
    bar.position.set(0, 1.85, -0.2);
    group.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0x2255ff }));
    bar2.position.set(0, 1.85, 0.3);
    group.add(bar2);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 2.2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    badge.position.set(1.01, 0.75, 0);
    group.add(badge);
  }
  return { group, wheels };
}

export function createCar(scene, x, z, angle, color, isPolice, name) {
  const { group, wheels } = makeCarMesh(color, isPolice);
  group.position.set(x, 0, z);
  group.rotation.y = angle;
  scene.add(group);
  return {
    mesh: group,
    wheels,
    x,
    z,
    angle,
    speed: 0,
    steer: 0,
    color,
    name: name ?? pick(Math.random, CAR_NAMES),
    isPolice: !!isPolice,
    isTraffic: false,
    ai: null,
    alive: true,
    honkTimer: 0,
  };
}

// Arcade driving: accelerate, brake, reverse, steer harder at low speed, grip
// pulls the heading toward the velocity so drifts feel right without a physics lib.
export function driveCar(car, input, dt, colliders) {
  const forward = input.y;
  const steerInput = input.x;
  if (forward > 0) car.speed += CAR.accel * dt;
  else if (forward < 0) {
    car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.accel * 0.6) * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  }
  if (input.brake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), CAR.brake * dt);
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  const speedRatio = Math.min(1, Math.abs(car.speed) / CAR.maxSpeed);
  const steerTarget = steerInput * CAR.steer * (1 - speedRatio * 0.55);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  car.angle += car.steer * (car.speed / CAR.maxSpeed) * dt * 2.2 * Math.sign(car.speed || 1);
  let nx = car.x + Math.sin(car.angle) * car.speed * dt;
  let nz = car.z + Math.cos(car.angle) * car.speed * dt;
  const hit = collideCircle(colliders, nx, nz, CAR.radius);
  if (hit.hit) {
    // A wall hit scrubs speed and bounces the car off.
    car.speed *= -0.25;
    nx = hit.x;
    nz = hit.z;
  }
  const clamped = clampToCity(nx, nz, 6);
  car.x = clamped.x;
  car.z = clamped.z;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.angle;
  for (const w of car.wheels) w.rotation.x += car.speed * dt * 2;
  // Body roll and pitch sell the speed.
  car.mesh.rotation.z = -car.steer * speedRatio * 0.06;
  car.mesh.rotation.x = -forward * speedRatio * 0.02;
  return hit.hit;
}

// Traffic: each car owns one street and one direction; at an intersection it may
// turn onto the crossing street. Lanes keep right, speed varies by car.
export function createTraffic(scene, random, count, colliders) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const vertical = random() < 0.5;
    const street = pick(random, CITY.roads);
    const lane = range(random, -2.5, 2.5);
    const dir = random() < 0.5 ? 1 : -1;
    const along = range(random, -CITY.half, CITY.half);
    const x = vertical ? street + lane : along;
    const z = vertical ? along : street + lane;
    const angle = vertical ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const car = createCar(scene, x, z, angle, pick(random, CAR_COLORS), false);
    car.isTraffic = true;
    car.ai = { vertical, street, dir, speed: range(random, 7, 12), turnCooldown: 0 };
    cars.push(car);
  }
  return cars;
}

export function stepTraffic(cars, dt, colliders, playerCar) {
  for (const car of cars) {
    if (!car.alive) continue;
    const ai = car.ai;
    ai.turnCooldown -= dt;
    const atStreet = (v) => {
      for (const s of CITY.roads) if (Math.abs(v - s) < 3) return s;
      return null;
    };
    // At an intersection, sometimes turn onto the crossing street.
    const cross = ai.vertical ? atStreet(car.z) : atStreet(car.x);
    if (cross !== null && ai.turnCooldown <= 0 && Math.random() < 0.004) {
      ai.vertical = !ai.vertical;
      ai.street = cross;
      ai.dir = Math.random() < 0.5 ? 1 : -1;
      ai.turnCooldown = 4;
    }
    const targetAngle = ai.vertical ? (ai.dir > 0 ? 0 : Math.PI) : (ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    let diff = targetAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
    // Ease back onto the lane centreline.
    const lanePos = ai.vertical ? car.x : car.z;
    const laneErr = lanePos - ai.street;
    car.angle -= Math.max(-0.5 * dt, Math.min(0.5 * dt, laneErr * 0.02 * ai.dir));
    car.speed = ai.speed;
    let nx = car.x + Math.sin(car.angle) * car.speed * dt;
    let nz = car.z + Math.cos(car.angle) * car.speed * dt;
    // Wrap around the city edge instead of driving into the sea.
    if (nx > CITY.half + 8 || nx < -CITY.half - 8 || nz > CITY.half + 8 || nz < -CITY.half - 8) {
      const vertical = Math.random() < 0.5;
      const street = pick(Math.random, CITY.roads);
      const along = -CITY.half + Math.random() * 20;
      car.x = vertical ? street : along;
      car.z = vertical ? along : street;
      car.ai.vertical = vertical;
      car.ai.street = street;
      car.ai.dir = 1;
      nx = car.x;
      nz = car.z;
    }
    const hit = collideCircle(colliders, nx, nz, CAR.radius);
    car.x = hit.x;
    car.z = hit.z;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.angle;
    for (const w of car.wheels) w.rotation.x += car.speed * dt * 2;
    // Gentle avoidance: slow down if the player's car is right ahead.
    if (playerCar) {
      const dx = playerCar.x - car.x;
      const dz = playerCar.z - car.z;
      if (dx * dx + dz * dz < 30) car.speed *= 0.4;
    }
  }
}
