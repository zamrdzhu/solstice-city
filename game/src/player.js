// Dante Cruz on foot: WASD movement relative to the camera, a third-person
// follow camera, entering and leaving cars, and combat (punch up close, pistol
// at range). The camera is the game's eyes — shots.js positions it directly.

import { PLAYER, WORLD } from './config.js';

export class PlayerController {
  constructor(game) {
    this.game = game;
    this.x = 0;
    this.z = 30;
    this.heading = 0;
    this.health = PLAYER.health;
    this.inCar = false;
    this.cameraYaw = Math.PI;
    this.cameraPitch = 0.32;
    this.cameraDistance = 9;
    this.mesh = this.buildMesh();
    this.game.scene.add(this.mesh);
    this.shootCooldown = 0;
    this.punchCooldown = 0;
    this.tracer = null;
    this.tracerLife = 0;
  }

  buildMesh() {
    const group = new THREE.Group();
    const jacket = new THREE.MeshLambertMaterial({ color: 0x2e6f8f });
    const skin = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.36), jacket);
    torso.position.y = 1.1;
    torso.castShadow = true;
    group.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
    head.position.y = 1.7;
    head.castShadow = true;
    group.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), pants);
    legL.position.set(-0.16, 0.35, 0);
    group.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), pants);
    legR.position.set(0.16, 0.35, 0);
    group.add(legR);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.65, 0.15), jacket);
    armL.position.set(-0.4, 1.1, 0);
    group.add(armL);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.65, 0.15), jacket);
    armR.position.set(0.4, 1.1, 0);
    group.add(armR);
    group.userData = { legL, legR, armL, armR };
    return group;
  }

  get position() {
    return { x: this.x, z: this.z };
  }

  setPosition(x, z, heading = 0) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.visible = !this.inCar;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  update(dt, input) {
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    if (this.tracer) {
      this.tracerLife -= dt;
      if (this.tracerLife <= 0) {
        this.game.scene.remove(this.tracer);
        this.tracer = null;
      }
    }
    if (this.inCar) {
      const car = this.game.vehicles.playerCar;
      if (car) {
        this.x = car.x;
        this.z = car.z;
        this.heading = car.heading;
        this.syncMesh();
      }
      this.updateCamera(dt, true);
      return;
    }
    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const moveZ = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const len = Math.hypot(moveX, moveZ);
    if (len > 0) {
      // Movement is relative to the camera yaw.
      const sin = Math.sin(this.cameraYaw);
      const cos = Math.cos(this.cameraYaw);
      const dx = (moveX * cos - moveZ * sin) / len;
      const dz = (moveX * sin + moveZ * cos) / len;
      this.x += dx * speed * dt;
      this.z += dz * speed * dt;
      this.heading = Math.atan2(dx, dz);
      const fixed = this.game.city.resolveCollision(this.x, this.z, PLAYER.radius);
      this.x = fixed.x;
      this.z = fixed.z;
      this.x = Math.max(-238, Math.min(238, this.x));
      this.z = Math.max(-238, Math.min(238, this.z));
      const swing = Math.sin(this.game.time * 11) * 0.55;
      this.mesh.userData.legL.rotation.x = swing;
      this.mesh.userData.legR.rotation.x = -swing;
      this.mesh.userData.armL.rotation.x = -swing * 0.7;
      this.mesh.userData.armR.rotation.x = swing * 0.7;
    } else {
      this.mesh.userData.legL.rotation.x = 0;
      this.mesh.userData.legR.rotation.x = 0;
      this.mesh.userData.armL.rotation.x = 0;
      this.mesh.userData.armR.rotation.x = 0;
    }
    this.syncMesh();
    this.updateCamera(dt, false);
  }

  updateCamera(dt, inCar) {
    const camera = this.game.camera;
    const distance = inCar ? this.cameraDistance + 4 : this.cameraDistance;
    const height = inCar ? 4.2 : 3.4;
    const targetYaw = this.inCar && this.game.vehicles.playerCar
      ? this.game.vehicles.playerCar.heading + Math.PI
      : this.cameraYaw;
    const cx = this.x + Math.sin(targetYaw) * distance;
    const cz = this.z + Math.cos(targetYaw) * distance;
    const cy = height + Math.tan(this.cameraPitch) * distance * 0.4;
    camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 6);
    camera.position.y += (cy - camera.position.y) * Math.min(1, dt * 6);
    camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 6);
    camera.lookAt(this.x, 1.6, this.z);
  }

  /** Place the camera exactly (used by screenshot staging). */
  setCamera(x, y, z, lookX, lookY, lookZ) {
    const camera = this.game.camera;
    camera.position.set(x, y, z);
    camera.lookAt(lookX, lookY, lookZ);
  }

  orbit(dx, dy) {
    this.cameraYaw -= dx * 0.005;
    this.cameraPitch = Math.max(-0.15, Math.min(0.9, this.cameraPitch + dy * 0.003));
  }

  tryEnterCar() {
    if (this.inCar) return false;
    const car = this.game.vehicles.nearestCar(this.x, this.z, 3.2);
    if (!car) return false;
    this.game.vehicles.enterCar(car);
    this.inCar = true;
    this.game.addWanted(1, 'stole a car');
    this.game.audio.pickup();
    this.syncMesh();
    return true;
  }

  exitCar() {
    if (!this.inCar) return false;
    const car = this.game.vehicles.exitCar();
    this.inCar = false;
    if (car) {
      const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
      this.setPosition(car.x + side.x * 2.4, car.z + side.z * 2.4, car.heading);
    }
    this.syncMesh();
    return true;
  }

  punch() {
    if (this.punchCooldown > 0 || this.inCar) return;
    this.punchCooldown = 0.45;
    this.game.audio.punch();
    const f = { x: Math.sin(this.heading), z: Math.cos(this.heading) };
    for (const ped of this.game.peds.peds) {
      if (ped.state === 'down') continue;
      const dx = ped.x - this.x;
      const dz = ped.z - this.z;
      const dist = Math.hypot(dx, dz);
      const dot = (dx * f.x + dz * f.z) / (dist || 1);
      if (dist < PLAYER.punchRange && dot > 0.5) {
        this.damagePed(ped, PLAYER.punchDamage);
        this.game.addWanted(1, 'assault');
        break;
      }
    }
  }

  shoot() {
    if (this.shootCooldown > 0 || this.inCar) return;
    this.shootCooldown = 0.28;
    this.game.audio.gunshot();
    this.game.addWanted(2, 'fired a shot');
    this.game.peds.scare(this.x, this.z, 30);
    // Ray from the camera through the screen centre.
    const camera = this.game.camera;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const origin = camera.position.clone();
    let best = null;
    let bestDist = PLAYER.pistolRange;
    for (const ped of this.game.peds.peds) {
      if (ped.state === 'down') continue;
      const to = new THREE.Vector3(ped.x - origin.x, 1.2 - origin.y, ped.z - origin.z);
      const dist = to.length();
      if (dist > bestDist) continue;
      const angle = to.normalize().dot(dir);
      if (angle > 0.985) {
        best = ped;
        bestDist = dist;
      }
    }
    const end = origin.clone().add(dir.clone().multiplyScalar(best ? bestDist : PLAYER.pistolRange));
    this.showTracer(origin, end);
    if (best) this.damagePed(best, PLAYER.pistolDamage);
  }

  showTracer(from, to) {
    if (this.tracer) this.game.scene.remove(this.tracer);
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
    this.tracer = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 }));
    this.tracerLife = 0.09;
    this.game.scene.add(this.tracer);
  }

  damagePed(ped, amount) {
    ped.health = (ped.health ?? 100) - amount;
    if (ped.health <= 0) {
      ped.state = 'down';
      ped.stateTime = 0;
      if (ped.isPolicePed) this.game.addWanted(2, 'took down an officer');
    }
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.game.wasted();
    }
  }

  heal(amount) {
    this.health = Math.min(PLAYER.health, this.health + amount);
  }
}
