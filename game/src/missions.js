// The story: eight chapters for Dante Cruz, each with dialogue, an objective
// marker in the world and on the minimap, and a cash reward. Chapters unlock
// in order; progress is saved, so a player can pick up where they left off.

import { CHAPTERS } from './config.js';
import { makeRng } from './rng.js';

export class MissionManager {
  constructor(game) {
    this.game = game;
    this.rng = makeRng(21);
    this.chapterIndex = 0;
    this.state = 'idle'; // idle | active | done
    this.timer = 0;
    this.phase = 0;
    this.gang = [];
    this.convoy = null;
    this.bag = null;
    this.vex = null;
    this.beacon = null;
    this.surviveLeft = 0;
    this.stopTimer = 0;
  }

  get chapter() {
    return CHAPTERS[this.chapterIndex];
  }

  get completed() {
    return this.chapterIndex >= CHAPTERS.length;
  }

  startChapter(index) {
    this.chapterIndex = Math.min(index, CHAPTERS.length - 1);
    const chapter = this.chapter;
    this.state = 'active';
    this.phase = 0;
    this.timer = 0;
    this.gang = [];
    this.convoy = null;
    this.bag = null;
    this.vex = null;
    this.clearBeacon();
    this.game.hud.setMission(chapter.name, chapter.objective, '');
    this.game.hud.showDialogue(chapter.intro);
    const target = chapter.target;
    if (target) this.placeBeacon(target.x, target.z);

    if (chapter.kind === 'timed') this.timer = chapter.seconds;
    if (chapter.kind === 'survive') {
      this.surviveLeft = chapter.seconds;
      this.game.police.addWanted(4, 'Vex put a price on you');
    }
    if (chapter.kind === 'fight' && target) {
      this.gang = this.game.peds.spawnGang(target.x, target.z, chapter.count);
    }
    if (chapter.kind === 'escape' && target) {
      this.placeBag(target.x, target.z);
    }
    if (chapter.kind === 'ram' && target) {
      this.spawnConvoy(target.x, target.z);
    }
    if (chapter.kind === 'finale' && target) {
      this.spawnVex(target.x, target.z);
    }
  }

  placeBeacon(x, z) {
    this.clearBeacon();
    const geometry = new THREE.CylinderGeometry(2.2, 2.2, 30, 12, 1, true);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffd23e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
    });
    this.beacon = new THREE.Mesh(geometry, material);
    this.beacon.position.set(x, 15, z);
    this.game.scene.add(this.beacon);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 3.4, 20),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.1, z);
    this.game.scene.add(ring);
    this.beacon.userData.ring = ring;
  }

  clearBeacon() {
    if (!this.beacon) return;
    this.game.scene.remove(this.beacon);
    if (this.beacon.userData.ring) this.game.scene.remove(this.beacon.userData.ring);
    this.beacon = null;
  }

  placeBag(x, z) {
    const bag = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.8, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x2e6f3e }),
    );
    bag.position.set(x, 0.6, z);
    bag.castShadow = true;
    this.game.scene.add(bag);
    this.bag = bag;
  }

  spawnConvoy(x, z) {
    const truck = this.game.vehicles.spawnCar('truck', 0x5a6b7a, x, z, 0, false);
    truck.speed = 10;
    truck.axis = 'z';
    truck.dir = 1;
    const escort1 = this.game.vehicles.spawnCar('sedan', 0x1a1a1a, x - 6, z - 8, 0, true);
    const escort2 = this.game.vehicles.spawnCar('sedan', 0x1a1a1a, x + 6, z - 8, 0, true);
    this.convoy = { truck, escorts: [escort1, escort2] };
  }

  spawnVex(x, z) {
    const gang = this.game.peds.spawnGang(x, z, 1);
    this.vex = gang[0];
    this.vex.health = 300;
    this.vex.isVex = true;
  }

  update(dt) {
    if (this.state !== 'active') return;
    const chapter = this.chapter;
    const player = this.game.player;
    const dist = chapter.target
      ? Math.hypot(player.x - chapter.target.x, player.z - chapter.target.z)
      : 9999;

    if (this.beacon) {
      this.beacon.rotation.y += dt * 0.8;
      this.beacon.material.opacity = 0.28 + Math.sin(this.game.time * 4) * 0.1;
    }

    switch (chapter.kind) {
      case 'goto':
        if (dist < 9) this.complete();
        break;
      case 'steal': {
        const car = this.game.vehicles.playerCar;
        const inSports = car && car.kind === 'sports';
        if (inSports && this.game.police.wanted < 1) this.complete();
        else if (inSports) this.game.hud.setMission(chapter.name, 'Lose the police, then return to Lena', '');
        break;
      }
      case 'timed':
        this.timer -= dt;
        this.game.hud.setMission(chapter.name, chapter.objective, `⏱ ${Math.max(0, Math.ceil(this.timer))}s`);
        if (dist < 9) this.complete();
        else if (this.timer <= 0) this.fail('Out of time. Kane does not pay late.');
        break;
      case 'fight': {
        const left = this.gang.filter((g) => g.state !== 'down').length;
        this.game.hud.setMission(chapter.name, chapter.objective, `${chapter.count - left}/${chapter.count} down`);
        if (left === 0) this.complete();
        break;
      }
      case 'escape':
        if (this.phase === 0) {
          if (this.bag && Math.hypot(player.x - this.bag.position.x, player.z - this.bag.position.z) < 3) {
            this.game.scene.remove(this.bag);
            this.bag = null;
            this.phase = 1;
            this.game.audio.pickup();
            this.game.police.addWanted(3, 'bank job');
            this.game.hud.setMission(chapter.name, 'Bag secured — lose the police', '');
          }
        } else if (this.game.police.wanted < 1) {
          this.complete();
        }
        break;
      case 'ram': {
        if (!this.convoy) break;
        const truck = this.convoy.truck;
        // The convoy truck keeps driving its route until rammed to a stop.
        if (Math.abs(truck.speed) < 0.5) this.stopTimer += dt;
        else this.stopTimer = 0;
        this.game.hud.setMission(chapter.name, chapter.objective, truck.speed < 4 ? 'STOPPED — hold it!' : `Truck speed ${Math.round(Math.abs(truck.speed) * 3.6)} km/h`);
        if (this.stopTimer > 3) this.complete();
        break;
      }
      case 'survive':
        this.surviveLeft -= dt;
        this.game.hud.setMission(chapter.name, chapter.objective, `${Math.max(0, Math.ceil(this.surviveLeft))}s left`);
        if (this.surviveLeft <= 0) this.complete();
        break;
      case 'finale':
        if (this.phase === 0) {
          if (dist < 12) {
            this.phase = 1;
            this.game.hud.showDialogue([
              'Vex: Cruz. You actually came. Brave. Stupid, but brave.',
              'Dante: It ends tonight, Vex. The city is done paying you.',
              'Vex: Then come and take it from me.',
            ]);
          }
        } else if (this.vex && this.vex.state === 'down') {
          this.complete();
        }
        break;
      default:
        break;
    }
  }

  complete() {
    const chapter = this.chapter;
    this.state = 'done';
    this.clearBeacon();
    this.game.money += chapter.reward;
    this.game.audio.missionDone();
    this.game.hud.flash(`CHAPTER COMPLETE — ${chapter.name}  +$${chapter.reward}`);
    this.game.saveGame();
    if (this.chapterIndex + 1 >= CHAPTERS.length) {
      this.game.hud.showVictory(this.game.money);
      this.game.state = 'victory';
      return;
    }
    this.chapterIndex += 1;
    // A short breather, then the next chapter begins.
    this.state = 'idle';
    this.game.nextChapterAt = this.game.time + 4;
  }

  fail(reason) {
    this.state = 'idle';
    this.clearBeacon();
    this.game.hud.flash(`FAILED — ${reason}`);
    this.game.hud.showDialogue([`Lena: ${reason} Try again, Dante. From the top.`]);
    this.game.nextChapterAt = this.game.time + 5;
  }

  maybeStartNext() {
    if (this.state === 'idle' && this.game.nextChapterAt && this.game.time >= this.game.nextChapterAt && !this.completed) {
      this.game.nextChapterAt = null;
      this.startChapter(this.chapterIndex);
    }
  }

  /** Minimap blip for the current objective, or null. */
  objectiveBlip() {
    if (this.state !== 'active' || !this.chapter.target) return null;
    return { x: this.chapter.target.x, z: this.chapter.target.z, kind: 'mission' };
  }
}
