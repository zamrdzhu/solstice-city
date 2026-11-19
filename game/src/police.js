// The wanted system: stars 0-5, patrol cars that chase and ram, roadblocks
// across the road at three stars, and a police helicopter with a searchlight
// circling overhead at four stars and above. Heat cools when the player stays
// out of trouble and out of sight.

import { POLICE, WANTED } from './config.js';
import { makeRng, range } from './rng.js';

export class Police {
  constructor(game, seed = 11) {
    this.game = game;
    this.rng = makeRng(seed);
    this.wanted = 0;
    this.lastCrime = -999;
    this.patrols = [];
    this.roadblocks = [];
    this.roadblockTimer = 0;
    this.heli = null;
    this.shootTimer = 0;
  }

  addWanted(amount, reason) {
    if (this.wanted >= 5) return;
    this.wanted = Math.min(5, this.wanted + amount);
    this.lastCrime = this.game.time;
    if (reason) this.game.hud.flash(`WANTED +${amount} — ${reason}`);
  }

  clearWanted() {
    this.wanted = 0;
    this.removeAllPatrols();
    this.removeRoadblocks();
    this.removeHeli();
    this.game.audio.setSiren(false);
  }

  removeAllPatrols() {
    for (const car of this.patrols) this.game.vehicles.removeCar(car);
    this.patrols = [];
  }

  removeRoadblocks() {
    for (const block of this.roadblocks) {
      for (const car of block.cars) this.game.vehicles.removeCar(car);
    }
    this.roadblocks = [];
  }

  removeHeli() {
    if (!this.heli) return;
    this.game.scene.remove(this.heli.group);
    this.heli = null;
  }

  update(dt) {
    // Heat cools when the player has been clean for a while.
    const sinceCrime = this.game.time - this.lastCrime;
    const anyNear = this.patrols.some((car) => Math.hypot(car.x - this.game.player.x, car.z - this.game.player.z) < 30);
    if (this.wanted > 0 && sinceCrime > WANTED.coolDelay && !anyNear) {
      this.wanted = Math.max(0, this.wanted - WANTED.coolPerSecond * dt);
    }
    const level = Math.floor(this.wanted + 0.001);

    // Patrol cars: one per wanted star, up to the cap.
    const wantPatrols = Math.min(level, POLICE.maxPatrolCars);
    while (this.patrols.length < wantPatrols) this.spawnPatrol();
    while (this.patrols.length > wantPatrols) {
      const car = this.patrols.pop();
      this.game.vehicles.removeCar(car);
    }
    this.game.audio.setSiren(this.patrols.length > 0);

    // Patrol chase steering.
    for (const car of this.patrols) {
      const dx = this.game.player.x - car.x;
      const dz = this.game.player.z - car.z;
      const dist = Math.hypot(dx, dz);
      const desired = Math.atan2(dx, dz);
      let diff = desired - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      car.speed = Math.min(POLICE.chaseSpeed, car.speed + 14 * dt);
      // Ram the player's car.
      if (dist < 4 && this.game.vehicles.playerCar) {
        const playerCar = this.game.vehicles.playerCar;
        playerCar.speed *= 0.92;
        this.game.player.takeDamage(POLICE.ramDamage * dt);
      }
    }

    // Officers shoot at the player on foot at three stars and up.
    if (level >= 3 && !this.game.player.inCar) {
      this.shootTimer -= dt;
      const near = this.patrols.find((car) => Math.hypot(car.x - this.game.player.x, car.z - this.game.player.z) < POLICE.shootRange);
      if (near && this.shootTimer <= 0) {
        this.shootTimer = 0.9 + this.rng() * 0.7;
        if (this.rng() < 0.6) this.game.player.takeDamage(POLICE.shootDamage);
        this.game.audio.gunshot();
      }
    }

    // Roadblocks at three stars and up, ahead of the player's travel.
    if (level >= POLICE.roadblockAt) {
      this.roadblockTimer -= dt;
      if (this.roadblockTimer <= 0) {
        this.roadblockTimer = 35;
        this.spawnRoadblock();
      }
    }
    for (const block of this.roadblocks) {
      block.life -= dt;
      if (block.life <= 0) {
        for (const car of block.cars) this.game.vehicles.removeCar(car);
      }
    }
    this.roadblocks = this.roadblocks.filter((b) => b.life > 0);

    // Helicopter at four stars and up.
    if (level >= POLICE.heliAt && !this.heli) this.spawnHeli();
    if (level < POLICE.heliAt && this.heli) this.removeHeli();
    if (this.heli) this.updateHeli(dt);
  }

  spawnPatrol() {
    const player = this.game.player;
    const angle = this.rng() * Math.PI * 2;
    const x = player.x + Math.cos(angle) * 70;
    const z = player.z + Math.sin(angle) * 70;
    const roadX = this.game.city.nearestRoad(x);
    const roadZ = this.game.city.nearestRoad(z);
    const onX = Math.abs(x - roadX) < Math.abs(z - roadZ);
    const px = onX ? roadX : x;
    const pz = onX ? z : roadZ;
    const heading = Math.atan2(player.x - px, player.z - pz);
    const car = this.game.vehicles.spawnCar('police', 0x1a1a1a, px, pz, heading, false);
    car.isPolice = true;
    car.speed = 12;
    this.patrols.push(car);
  }

  spawnRoadblock() {
    const player = this.game.player;
    const car = this.game.vehicles.playerCar;
    const heading = car ? car.heading : player.heading;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const cx = player.x + fx * 45;
    const cz = player.z + fz * 45;
    const cars = [];
    // Two patrol cars parked across the road, plus a gap the player can thread.
    // Roadblock cars are tracked on the block itself, not in the patrol list,
    // so the patrol cap never prunes them on the next frame.
    for (const side of [-3.2, 3.2]) {
      const px = cx + Math.cos(heading) * side;
      const pz = cz - Math.sin(heading) * side;
      const blockCar = this.game.vehicles.spawnCar('police', 0x1a1a1a, px, pz, heading + Math.PI / 2, false);
      blockCar.isPolice = true;
      blockCar.speed = 0;
      cars.push(blockCar);
    }
    this.roadblocks.push({ cars, life: 60 });
    this.game.hud.flash('ROADBLOCK AHEAD');
  }

  spawnHeli() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 1.6, 6),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
    );
    body.castShadow = true;
    group.add(body);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 4.5),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
    );
    tail.position.set(0, 0.3, -4.5);
    group.add(tail);
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(11, 0.1, 0.6),
      new THREE.MeshLambertMaterial({ color: 0x333333 }),
    );
    rotor.position.y = 1.1;
    group.add(rotor);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.8, 1.6),
      new THREE.MeshLambertMaterial({ color: 0x9fd8e8 }),
    );
    glass.position.set(0, 0.2, 2.2);
    group.add(glass);
    // Searchlight cone and real spotlight, both aimed at the player.
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(6, 40, 14, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }),
    );
    cone.position.y = -20;
    cone.rotation.x = Math.PI;
    group.add(cone);
    const spot = new THREE.SpotLight(0xfff2b0, 3, 90, 0.32, 0.4, 1);
    spot.position.set(0, -1, 0);
    group.add(spot);
    group.add(spot.target);
    this.game.scene.add(group);
    this.heli = { group, rotor, cone, spot, angle: 0 };
    this.game.hud.flash('AIR 1 · TRACKING YOU');
  }

  updateHeli(dt) {
    const heli = this.heli;
    const player = this.game.player;
    heli.angle += dt * 0.35;
    const radius = 26;
    heli.group.position.set(
      player.x + Math.cos(heli.angle) * radius,
      POLICE.heliHeight,
      player.z + Math.sin(heli.angle) * radius,
    );
    heli.group.lookAt(player.x, POLICE.heliHeight, player.z);
    heli.rotor.rotation.y += dt * 22;
    // Keep the searchlight on the player.
    heli.spot.target.position.set(player.x, 0, player.z);
    heli.cone.lookAt(player.x, 0, player.z);
    heli.cone.rotateX(-Math.PI / 2);
    void range;
  }

  /** Blips for the minimap: police cars red, helicopter as a diamond. */
  minimapBlips() {
    const blips = this.patrols.map((car) => ({ x: car.x, z: car.z, kind: 'police' }));
    for (const block of this.roadblocks) {
      for (const car of block.cars) blips.push({ x: car.x, z: car.z, kind: 'police' });
    }
    if (this.heli) {
      blips.push({ x: this.heli.group.position.x, z: this.heli.group.position.z, kind: 'heli' });
    }
    return blips;
  }
}
