// The wanted system: stars, heat, and the Suncoast Police Department.
// Police cars spawn at the city edge, chase the player's car, ram it, and on
// foot they try to corner the player. Get caught and it's BUSTED.
import { WANTED, CRIME, CITY } from './config.js';
import { createCar, POLICE_COLOR } from './vehicles.js';
import { collideCircle } from './city.js';

export function createWanted(scene) {
  return {
    stars: 0,
    heat: 0,
    police: [],
    bustTimer: 0,
    decayTimer: 0,
    lastCrimeAt: -999,
    scene,
  };
}

export function addCrime(wanted, kind, now) {
  const add = CRIME[kind] ?? 0;
  if (add <= 0) return;
  wanted.stars = Math.min(5, wanted.stars + add);
  wanted.heat = Math.min(100, wanted.heat + add * 25);
  wanted.lastCrimeAt = now;
  wanted.decayTimer = 0;
  syncPolice(wanted);
}

export function clearWanted(wanted) {
  wanted.stars = 0;
  wanted.heat = 0;
  syncPolice(wanted);
}

function syncPolice(wanted) {
  const want = WANTED[wanted.stars].police;
  while (wanted.police.length < want) {
    const car = createCar(wanted.scene, 0, 0, 0, POLICE_COLOR, true, 'Suncoast PD');
    car.isTraffic = false;
    wanted.police.push(car);
  }
  while (wanted.police.length > want) {
    const car = wanted.police.pop();
    wanted.scene.remove(car.mesh);
  }
}

// Chase: steer toward the player, ram, and slow down when close so the pursuit
// stays a chase instead of a demolition derby.
export function stepPolice(wanted, dt, player, colliders, now) {
  const level = WANTED[wanted.stars];
  // Wanted decays after 25 quiet seconds.
  if (wanted.stars > 0 && now - wanted.lastCrimeAt > 25) {
    wanted.decayTimer += dt;
    if (wanted.decayTimer > 4) {
      wanted.stars -= 1;
      wanted.decayTimer = 0;
      syncPolice(wanted);
    }
  }
  const px = player.x;
  const pz = player.z;
  for (let i = 0; i < wanted.police.length; i += 1) {
    const car = wanted.police[i];
    // Spread the spawn points so police arrive from different directions.
    if (car.speed === 0 && Math.hypot(car.x - px, car.z - pz) < 8) {
      const a = (i / Math.max(1, wanted.police.length)) * Math.PI * 2 + now;
      car.x = px + Math.sin(a) * 90;
      car.z = pz + Math.cos(a) * 90;
    }
    // Unstick: a cop that is revving but barely moving is wedged on a building
    // corner — send it sidestepping around the block for a second.
    if (car.stuck === undefined) {
      car.stuck = 0;
      car.evade = 0;
      car.evadeDir = 1;
      car.prevX = car.x;
      car.prevZ = car.z;
    }
    const moved = Math.hypot(car.x - car.prevX, car.z - car.prevZ);
    if (car.speed > 8 && moved < car.speed * dt * 0.25) car.stuck += dt;
    else car.stuck = Math.max(0, car.stuck - dt);
    if (car.stuck > 0.6) {
      car.evade = 1.0;
      car.stuck = 0;
      car.evadeDir *= -1;
    }
    car.prevX = car.x;
    car.prevZ = car.z;
    let tx = px;
    let tz = pz;
    if (car.evade > 0) {
      car.evade -= dt;
      const dx0 = px - car.x;
      const dz0 = pz - car.z;
      const len = Math.hypot(dx0, dz0) || 1;
      tx = px + (-dz0 / len) * 30 * car.evadeDir;
      tz = pz + (dx0 / len) * 30 * car.evadeDir;
    }
    const dx = tx - car.x;
    const dz = tz - car.z;
    const dist = Math.hypot(dx, dz);
    const playerDist = Math.hypot(px - car.x, pz - car.z);
    const want = Math.atan2(dx, dz);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const targetSpeed = dist < 6 ? level.policeSpeed * 0.4 : level.policeSpeed;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
    let nx = car.x + Math.sin(car.angle) * car.speed * dt;
    let nz = car.z + Math.cos(car.angle) * car.speed * dt;
    const hit = collideCircle(colliders, nx, nz, 1.6);
    car.x = hit.x;
    car.z = hit.z;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.angle;
    for (const w of car.wheels) w.rotation.x += car.speed * dt * 2;
    // Ramming the player's car shoves it and slows the cop.
    if (player.inCar && playerDist < 3.6) {
      player.car.speed *= 0.92;
      car.speed *= 0.7;
    }
    // On foot, a cop parked on the player for a second means BUSTED.
    if (!player.inCar && playerDist < 2.2) {
      wanted.bustTimer += dt;
    } else {
      wanted.bustTimer = Math.max(0, wanted.bustTimer - dt * 2);
    }
  }
  return wanted.bustTimer > 1.0;
}
