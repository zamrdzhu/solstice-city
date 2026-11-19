// Costa Alba — bootstrap and game loop. Builds the city, wires every system
// into one game object, runs the simulation at a fixed step, and renders.
// URL params: ?shot=cover|drive|mission|foot stages a screenshot,
// ?weather=clear|cloudy|rain|storm|fog forces the weather, ?seed=N fixes the
// city layout. Played with keyboard and mouse, all assets local.

import { CLOCK, STEP, WORLD } from './config.js';
import { City } from './city.js';
import { Weather } from './weather.js';
import { SoundEngine } from './audio.js';
import { VehicleManager } from './vehicles.js';
import { PedestrianManager } from './pedestrians.js';
import { PlayerController } from './player.js';
import { Police } from './police.js';
import { MissionManager } from './missions.js';
import { HUD } from './hud.js';
import { saveGame, loadGame, hasSave, applySave } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot');
const WEATHER_PARAM = params.get('weather');
const SEED = Number(params.get('seed') || 1);

class Game {
  constructor() {
    this.time = 0;
    this.money = 0;
    this.state = 'menu'; // menu | playing | paused | wasted | victory
    this.nextChapterAt = null;
    this.stagingInput = null;
    this.input = this.blankInput();
    this.dragging = false;
    this.dragMoved = false;
    this.lastX = 0;
    this.lastY = 0;

    const canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(0, 40, 120);

    this.sun = new THREE.DirectionalLight(0xfff2d8, 1.25);
    this.sun.position.set(120, 180, 60);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -260;
    this.sun.shadow.camera.right = 260;
    this.sun.shadow.camera.top = 260;
    this.sun.shadow.camera.bottom = -260;
    this.sun.shadow.camera.far = 600;
    this.scene.add(this.sun);
    this.hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.75);
    this.scene.add(this.hemi);

    this.audio = new SoundEngine();
    this.city = new City(this.scene, SEED);
    this.weather = new Weather(this.scene, this.sun, this.hemi, this.city.roadMaterial, this.audio, SEED + 6);
    this.vehicles = new VehicleManager(this, SEED + 2);
    this.peds = new PedestrianManager(this, SEED + 4);
    this.player = new PlayerController(this);
    this.police = new Police(this, SEED + 10);
    this.missions = new MissionManager(this);
    this.hud = new HUD(this);

    this.vehicles.spawnTraffic();
    this.peds.spawnPeds();
    this.player.setPosition(0, 30, 0);
    if (WEATHER_PARAM) this.weather.force(WEATHER_PARAM);

    this.bindInput();
    window.addEventListener('resize', () => this.onResize());
    window.__game = this;
  }

  blankInput() {
    return { forward: false, back: false, left: false, right: false, run: false, handbrake: false };
  }

  bindInput() {
    const keyMap = {
      KeyW: 'forward', ArrowUp: 'forward',
      KeyS: 'back', ArrowDown: 'back',
      KeyA: 'left', ArrowLeft: 'left',
      KeyD: 'right', ArrowRight: 'right',
      ShiftLeft: 'run', ShiftRight: 'run',
      Space: 'handbrake',
    };
    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      const mapped = keyMap[event.code];
      if (mapped) {
        this.input[mapped] = true;
        event.preventDefault();
      }
      if (this.state !== 'playing') return;
      if (event.code === 'KeyE') {
        if (this.player.inCar) this.player.exitCar();
        else this.player.tryEnterCar();
      }
      if (event.code === 'KeyF') this.player.punch();
      if (event.code === 'KeyT') {
        const next = (this.audio.radioIndex() + 1) % 3;
        this.audio.startRadio(next);
        this.hud.flash(`RADIO — ${this.audio.radioName()}`);
      }
      if (event.code === 'KeyG') {
        this.weather.cycle();
        this.hud.flash(`WEATHER — ${this.weather.label()}`);
      }
      if (event.code === 'Escape') this.pause();
    });
    window.addEventListener('keyup', (event) => {
      const mapped = keyMap[event.code];
      if (mapped) this.input[mapped] = false;
    });
    const canvas = document.getElementById('game');
    canvas.addEventListener('mousedown', (event) => {
      if (this.state !== 'playing') return;
      this.dragging = true;
      this.dragMoved = false;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
    });
    window.addEventListener('mousemove', (event) => {
      if (!this.dragging) return;
      const dx = event.clientX - this.lastX;
      const dy = event.clientY - this.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 4) this.dragMoved = true;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      if (this.state === 'playing' && !this.player.inCar) this.player.orbit(dx, dy);
    });
    window.addEventListener('mouseup', () => {
      if (this.dragging && !this.dragMoved && this.state === 'playing') this.player.shoot();
      this.dragging = false;
    });
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  startNewGame() {
    this.audio.ensure();
    this.audio.startRadio(0);
    this.money = 0;
    this.time = 0;
    this.player.health = 100;
    this.player.setPosition(0, 30, 0);
    this.police.clearWanted();
    this.weather.force('clear');
    this.state = 'playing';
    this.missions.chapterIndex = 0;
    this.missions.startChapter(0);
    this.hud.flash('CHAPTER 1 — FIRST FARE');
  }

  continueGame() {
    const data = loadGame();
    if (!data) return this.startNewGame();
    this.audio.ensure();
    this.audio.startRadio(0);
    applySave(this, data);
    this.player.health = 100;
    this.police.clearWanted();
    this.state = 'playing';
    this.missions.startChapter(data.chapterIndex || 0);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.hud.showPause(
      () => { this.state = 'playing'; },
      () => {
        this.state = 'playing';
        this.missions.startChapter(this.missions.chapterIndex);
        this.player.setPosition(0, 30, 0);
        this.player.health = 100;
      },
    );
  }

  wasted() {
    if (this.state !== 'playing') return;
    this.state = 'wasted';
    this.audio.wasted();
    this.audio.setEngine(false, 0);
    this.audio.setSiren(false);
    this.money = Math.floor(this.money * 0.9);
    this.hud.showWasted(() => {
      this.player.health = 100;
      this.player.setPosition(60, 40, 0);
      if (this.player.inCar) this.player.exitCar();
      this.police.clearWanted();
      this.state = 'playing';
      this.saveGame();
    });
  }

  saveGame() {
    saveGame(this);
  }

  addWanted(amount, reason) {
    if (this.state !== 'playing') return;
    this.police.addWanted(amount, reason);
  }

  /** Advance the simulation by dt seconds. `silent` skips HUD work. */
  update(dt, silent = false) {
    // After screenshot staging the scene is frozen: the loop only renders.
    if (this.staging) return;
    // The lighthouse beam sweeps the bay in every state.
    if (this.city.lighthouseBeam) this.city.lighthouseBeam.rotation.y += dt * 0.5;
    if (this.state === 'menu') {
      // Slow orbit around the city behind the start screen.
      const angle = this.time * 0.05;
      this.camera.position.set(Math.sin(angle) * 190, 90, Math.cos(angle) * 190);
      this.camera.lookAt(0, 0, 0);
      this.weather.update(dt, this.camera.position, null);
      return;
    }
    if (this.state !== 'playing') return;
    this.time += dt;
    const input = this.stagingInput || this.input;
    const grip = this.weather.gripFactor();
    this.weather.update(dt, this.camera.position, () => this.hud.flash('ROADS ARE WET — EASY ON THE CORNERS'));
    this.vehicles.update(dt, input, grip);
    this.peds.update(dt);
    this.player.update(dt, input);
    this.police.update(dt);
    this.missions.update(dt);
    this.missions.maybeStartNext();
    // Slow health recovery when the heat is off.
    if (this.police.wanted < 1) this.player.heal(dt * 2);
    // Engine hum follows the player's car.
    const car = this.vehicles.playerCar;
    this.audio.setEngine(this.player.inCar && car !== null, car ? Math.abs(car.speed) / 38 : 0);
    if (!silent) this.hud.update(dt);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  loop() {
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.update(dt);
      this.render();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  boot() {
    if (SHOT) {
      // Screenshot mode: stage the scene directly, no menu.
      this.state = 'playing';
      this.hud.hideOverlay();
      stageShot(this, SHOT);
      this.loop();
      return;
    }
    this.hud.showStart(
      hasSave(),
      () => this.startNewGame(),
      () => this.continueGame(),
    );
    this.loop();
  }
}

const game = new Game();
game.boot();
