// Cars: building them, driving them, and the traffic that fills the streets.
// A car is a low-poly group (body, cabin, wheels, lights); traffic follows the
// road grid and stops for the car ahead; the player's car uses arcade physics
// with a grip factor the weather system feeds in.

import { CAR, TRAFFIC, WORLD, PALETTE } from './config.js';
import { makeRng, pick, range } from './rng.js';

const ROADS = [-180, -120, -60, 0, 60, 120, 180];
const CAR_COLORS = [0xc0392b, 0x2e6f8f, 0xd8c25a, 0x7a7a7a, 0x2f8f5a, 0xe8e8e8, 0x8a5a9a, 0xcc7a2e];
const TAXI_COLOR = 0xf2c94c;

export function createCarMesh(kind, color) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1c2b33 });
  const tyre = new THREE.MeshLambertMaterial({ color: 0x141414 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glass);
  cabin.position.set(0, 1.1, -0.2);
  cabin.castShadow = true;
  group.add(cabin);

  if (kind === 'sports') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.4), tyre);
    spoiler.position.set(0, 1.0, -2.1);
    group.add(spoiler);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 4.0), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    stripe.position.set(0, 0.87, 0.1);
    group.add(stripe);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
    sign.position.set(0, 1.5, -0.2);
    group.add(sign);
  }
  if (kind === 'van' || kind === 'truck') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 2.6), paint);
    box.position.set(0, 1.5, -0.8);
    box.castShadow = true;
    group.add(box);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
    bar.position.set(-0.3, 1.45, -0.2);
    group.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x2e6fff }));
    bar2.position.set(0.55, 1.45, -0.2);
    group.add(bar2);
  }

  // Headlights and taillights.
  for (const x of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.06), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
    head.position.set(x, 0.6, 2.21);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.06), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
    tail.position.set(x, 0.6, -2.21);
    group.add(tail);
  }

  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const wheel = new THREE.Mesh(wheelGeo, tyre);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.36, z);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  group.userData.wheels = wheels;
  return group;
}

class Car {
  constructor(mesh, kind, color) {
    this.mesh = mesh;
    this.kind = kind;
    this.color = color;
    this.x = 0;
    this.z = 0;
    this.heading = 0;
    this.speed = 0;
    this.steer = 0;
    this.axis = 'z';
    this.dir = 1;
    this.lane = 2.8;
    this.nextTurn = 0;
    this.blocked = false;
    this.isPlayer = false;
    this.isPolice = false;
    this.health = 100;
  }

  get forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * 0.12;
    for (const wheel of this.mesh.userData.wheels) wheel.rotation.x += spin;
  }
}

export class VehicleManager {
  constructor(game, seed = 3) {
    this.game = game;
    this.rng = makeRng(seed);
    this.cars = [];
    this.playerCar = null;
  }

  spawnCar(kind, color, x, z, heading, traffic = false) {
    const mesh = createCarMesh(kind, color);
    const car = new Car(mesh, kind, color);
    car.x = x;
    car.z = z;
    car.heading = heading;
    if (traffic) {
      car.axis = Math.abs(Math.sin(heading)) > 0.5 ? 'x' : 'z';
      car.dir = Math.cos(heading) >= 0 ? 1 : -1;
      if (car.axis === 'x') car.dir = Math.sin(heading) >= 0 ? 1 : -1;
      car.lane = 2.8;
      car.speed = TRAFFIC.speed * (0.8 + this.rng() * 0.4);
    }
    this.game.scene.add(mesh);
    car.syncMesh();
    this.cars.push(car);
    return car;
  }

  spawnTraffic() {
    const rng = this.rng;
    for (let i = 0; i < TRAFFIC.count; i += 1) {
      const road = pick(rng, ROADS);
      const along = range(rng, -200, 200);
      const axis = rng() < 0.5 ? 'x' : 'z';
      const heading = axis === 'x' ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
      const kind = pick(rng, ['sedan', 'sedan', 'sedan', 'van', 'taxi']);
      const color = kind === 'taxi' ? TAXI_COLOR : pick(rng, CAR_COLORS);
      const x = axis === 'x' ? along : road + (rng() < 0.5 ? 2.8 : -2.8);
      const z = axis === 'x' ? road + (rng() < 0.5 ? 2.8 : -2.8) : along;
      this.spawnCar(kind, color, x, z, heading, true);
    }
    // The hero car: a red Cometa GT parked by the plaza for chapter 2.
    this.spawnCar('sports', 0xc0392b, 62, -58, Math.PI / 2, false);
    // A taxi near the start for chapter 1.
    this.spawnCar('taxi', TAXI_COLOR, 6, 18, 0, false);
  }

  nearestCar(x, z, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const car of this.cars) {
      if (car.isPolice) continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestDist) {
        bestDist = d;
        best = car;
      }
    }
    return best;
  }

  enterCar(car) {
    if (this.playerCar) this.playerCar.isPlayer = false;
    this.playerCar = car;
    car.isPlayer = true;
    car.speed = 0;
    return car;
  }

  exitCar() {
    if (!this.playerCar) return null;
    const car = this.playerCar;
    car.isPlayer = false;
    car.speed = 0;
    this.playerCar = null;
    return car;
  }

  update(dt, input, grip) {
    for (const car of this.cars) {
      if (car.isPlayer) this.drivePlayer(car, dt, input, grip);
      else if (car.isPolice) this.drivePolice(car, dt);
      else if (car.speed > 0 || car.axis) this.driveTraffic(car, dt);
      car.syncMesh();
    }
    this.resolveCarCollisions();
  }

  drivePlayer(car, dt, input, grip) {
    const forward = input.forward ? 1 : 0;
    const back = input.back ? 1 : 0;
    if (forward) car.speed += CAR.accel * dt;
    if (back) car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.reverseAccel) * dt;
    if (!forward && !back) car.speed *= Math.max(0, 1 - 0.9 * dt);
    // Handbrake.
    if (input.handbrake) car.speed *= Math.max(0, 1 - 3.5 * dt);
    car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
    const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const speedFactor = Math.max(-1, Math.min(1, car.speed / 12));
    car.heading += steerInput * CAR.turnRate * speedFactor * grip * dt;
    const f = car.forward;
    const slide = (1 - grip) * 0.35;
    car.x += f.x * car.speed * dt + Math.cos(car.heading) * car.speed * slide * dt * steerInput;
    car.z += f.z * car.speed * dt - Math.sin(car.heading) * car.speed * slide * dt * steerInput;
    // Buildings stop the car.
    const fixed = this.game.city.resolveCollision(car.x, car.z, 1.7);
    if (fixed.x !== car.x || fixed.z !== car.z) {
      if (Math.abs(car.speed) > 14) this.game.audio.crash();
      car.speed *= 0.35;
      car.x = fixed.x;
      car.z = fixed.z;
    }
    // Stay in the world.
    car.x = Math.max(-236, Math.min(236, car.x));
    car.z = Math.max(-236, Math.min(236, car.z));
    // Running over pedestrians.
    if (Math.abs(car.speed) > 5 && this.game.peds) {
      const hit = this.game.peds.hitByCar(car.x, car.z, 2.2);
      if (hit) this.game.addWanted(1, 'hit pedestrian');
    }
  }

  driveTraffic(car, dt) {
    // Follow the road grid: drive along the current axis, turn at random
    // intersections, and slow down for the car ahead.
    const ahead = this.carAhead(car, 9);
    const targetSpeed = ahead ? 0 : TRAFFIC.speed;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
    const f = car.forward;
    car.x += f.x * car.speed * dt;
    car.z += f.z * car.speed * dt;
    // At an intersection, sometimes turn onto the crossing road.
    const along = car.axis === 'x' ? car.x : car.z;
    const nearest = this.game.city.nearestRoad(along);
    if (Math.abs(along - nearest) < 1.2 && this.rng() < 0.006) {
      const turnLeft = this.rng() < 0.5;
      const newHeading = car.heading + (turnLeft ? -Math.PI / 2 : Math.PI / 2);
      car.heading = newHeading;
      car.axis = car.axis === 'x' ? 'z' : 'x';
      car.dir = Math.cos(newHeading) >= 0 ? 1 : -1;
      if (car.axis === 'x') car.dir = Math.sin(newHeading) >= 0 ? 1 : -1;
    }
    // Wrap around the city edge so traffic never runs out.
    if (car.x > 232) car.x = -232;
    if (car.x < -232) car.x = 232;
    if (car.z > 232) car.z = -232;
    if (car.z < -232) car.z = 232;
  }

  drivePolice(car, dt) {
    // Police steering lives in police.js; this keeps the mesh moving.
    const f = car.forward;
    car.x += f.x * car.speed * dt;
    car.z += f.z * car.speed * dt;
    const fixed = this.game.city.resolveCollision(car.x, car.z, 1.7);
    car.x = fixed.x;
    car.z = fixed.z;
  }

  carAhead(car, distance) {
    const f = car.forward;
    for (const other of this.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const along = dx * f.x + dz * f.z;
      const side = Math.abs(dx * f.z - dz * f.x);
      if (along > 0 && along < distance && side < 2.4) return other;
    }
    return null;
  }

  resolveCarCollisions() {
    for (let i = 0; i < this.cars.length; i += 1) {
      for (let j = i + 1; j < this.cars.length; j += 1) {
        const a = this.cars[i];
        const b = this.cars[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 3.6 && dist > 0.01) {
          const push = (3.6 - dist) / 2;
          const nx = dx / dist;
          const nz = dz / dist;
          a.x -= nx * push;
          a.z -= nz * push;
          b.x += nx * push;
          b.z += nz * push;
          if (a.isPlayer || b.isPlayer) {
            const playerCar = a.isPlayer ? a : b;
            if (Math.abs(playerCar.speed) > 12) this.game.audio.crash();
            playerCar.speed *= 0.6;
          }
        }
      }
    }
  }

  removeCar(car) {
    this.game.scene.remove(car.mesh);
    const index = this.cars.indexOf(car);
    if (index >= 0) this.cars.splice(index, 1);
  }
}
