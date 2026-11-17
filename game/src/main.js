// Solstice City — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The game
// moves between four screens: title, play, paused and end (busted / wasted).
//
// ?seed=N fixes the city. ?shot=chase|street|mission|coast (with &seed=N) stages
// that scene instead of the title screen, paints it twice and sets
// window.__shotReady for a screenshot.
import { CITY, PLAYER, MISSIONS, CAR } from './config.js';
import { createRandom } from './random.js';
import {
  ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER_CAR, ACTION_SHOOT,
  ACTION_RESTART_MISSION, ACTION_MUTE, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import {
  createCar, createTraffic, stepTraffic, driveCar, POLICE_COLOR,
} from './vehicles.js';
import { createPedestrians, stepPedestrians } from './pedestrians.js';
import { createWanted, addCrime, clearWanted, stepPolice } from './police.js';
import {
  createMissionManager, advanceStep, updateBeacon, missionTitle,
} from './missions.js';
import {
  createCombat, spawnEnemies, clearEnemies, enemiesLeft, playerShoot, stepCombat,
} from './combat.js';
import {
  createPlayer, stepPlayerOnFoot, nearestCar, enterCar as playerEnterCar, exitCar,
} from './player.js';
import {
  createHud, updateHud, showToast, showScreen, renderMissionList, announce,
} from './hud.js';
import { saveGame, loadSave, clearSave, readBest, saveBest } from './save.js';
import { createRenderer, updateCamera, addShake, goldenHour as goldenHourRig } from './render.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const random = createRandom(seed);

const canvas = document.getElementById('game');
const hud = createHud();
const input = createInput(canvas);
const audio = createAudio();
const rig = createRenderer(canvas);
const scene = rig.scene;

const city = buildCity(scene, random);
const player = createPlayer(scene, CITY.plaza.x + 10, CITY.plaza.z + 10);
const traffic = createTraffic(scene, random, 14, city.colliders);
const peds = createPedestrians(scene, random, 26);
const wanted = createWanted(scene);
const missions = createMissionManager(scene);
const combat = createCombat(scene);

// Parked cars the player can steal: a few around town, plus the gold Comet GT
// for job 2, parked at Solstice Motors.
const parkedCars = [];
function spawnParkedCar(x, z, angle, color, name) {
  const car = createCar(scene, x, z, angle, color, false, name);
  parkedCars.push(car);
  return car;
}
const cometGT = spawnParkedCar(CITY.dealership.x, CITY.dealership.z, Math.PI / 2, 0xe8b73d, 'Comet GT');
spawnParkedCar(24, 0, 0, 0xd94f3d, 'Sunrunner');
spawnParkedCar(-24, 48, Math.PI, 0x3d7ad9, 'Bayliner');
spawnParkedCar(72, -144, -Math.PI / 2, 0x4ecdc4, 'Coastline');
spawnParkedCar(-168, -144, 0, 0x8a5fd6, 'Palmera');
spawnParkedCar(168, 144, Math.PI, 0xe8e8e8, 'Vortex');
spawnParkedCar(-168, 120, 0, 0xff9f43, 'Tide Runner');
spawnParkedCar(72, 96, Math.PI / 2, 0x7fae62, 'Solstice');

const game = {
  seed,
  elapsed: 0,
  screen: 'title',
  player,
  traffic,
  peds,
  parkedCars,
  wanted,
  missions,
  missionDefs: MISSIONS,
  combat,
  city,
  missionTitle: MISSIONS[0].title,
  best: readBest(),
};

missions.index = 0;
missions.step = 0;
missions.active = MISSIONS[0].steps[0];

function setStars(n) {
  wanted.stars = n;
  wanted.lastCrimeAt = game.elapsed;
  // Re-sync the police cars to the new star count.
  const want = [0, 1, 2, 3, 3, 4][n];
  while (wanted.police.length < want) {
    const car = createCar(scene, player.x + 90, player.z + 90, 0, POLICE_COLOR, true, 'Suncoast PD');
    wanted.police.push(car);
  }
  while (wanted.police.length > want) {
    const car = wanted.police.pop();
    scene.remove(car.mesh);
  }
}

function placePoliceBehind() {
  const car = player.car;
  if (!car) return;
  wanted.police.forEach((cop, i) => {
    const back = 4 + i * 6;
    const side = (i % 2 === 0 ? -1 : 1) * 4;
    cop.x = car.x - Math.sin(car.angle) * back + Math.cos(car.angle) * side;
    cop.z = car.z - Math.cos(car.angle) * back - Math.sin(car.angle) * side;
    cop.angle = car.angle;
    cop.speed = 26;
    cop.mesh.position.set(cop.x, 0, cop.z);
    cop.mesh.rotation.y = cop.angle;
  });
}

function spawnMissionEnemies() {
  const step = missions.active;
  if (!step || step.kind !== 'fight') return;
  spawnEnemies(combat, random, step.x, step.z, step.enemies);
}

function enterCarByPlayer(car) {
  if (car.isTraffic) {
    const i = traffic.indexOf(car);
    if (i >= 0) traffic.splice(i, 1);
    car.isTraffic = false;
  }
  playerEnterCar(player, car);
  audio.click();
  // Stealing a car is a crime — unless it is the Comet GT job, which still is.
  addCrime(wanted, 'stealCar', game.elapsed);
  showToast(hud, `You took the ${car.name}. The city noticed.`);
  if (missions.active && missions.active.kind === 'steal' && car === cometGT) {
    completeStep();
  }
}

function completeStep() {
  const result = advanceStep(missions);
  if (result.done) {
    player.cash += result.reward;
    if (player.cash > game.best) {
      game.best = player.cash;
      saveBest(game.best);
    }
    audio.missionComplete();
    showToast(hud, `${result.mission.title} complete — +$${result.reward}!`, 4);
    announce(hud, `${result.mission.title} complete. Earned $${result.reward}.`);
    clearEnemies(combat);
    saveGame(game);
    if (missions.allDone) {
      showToast(hud, 'STORY COMPLETE — Solstice City is yours!', 5);
    } else if (result.next) {
      showToast(hud, `New job: ${result.next.label}`, 4);
    }
  } else if (result.next) {
    audio.pickup();
    showToast(hud, result.next.label, 3.5);
    if (result.next.kind === 'fight') spawnMissionEnemies();
  }
  game.missionTitle = missionTitle(missions);
}

function checkMissionStep() {
  const step = missions.active;
  if (!step) return;
  if (step.kind === 'goto') {
    const d = Math.hypot(player.x - step.x, player.z - step.z);
    if (d < step.radius) {
      if (step.needCar && !player.inCar) {
        hud.hint.textContent = 'You need a car for this — press E near one.';
        return;
      }
      hud.hint.textContent = '';
      completeStep();
    }
  } else if (step.kind === 'fight') {
    if (enemiesLeft(combat) === 0) completeStep();
  }
}

function hitPedestrianCheck() {
  if (!player.inCar || Math.abs(player.car.speed) < 4) return;
  for (const ped of peds) {
    if (!ped.alive) continue;
    const d = Math.hypot(ped.x - player.x, ped.z - player.z);
    if (d < 2.2) {
      ped.alive = false;
      ped.mesh.visible = false;
      addCrime(wanted, 'hitPedestrian', game.elapsed);
      addShake(rig, 0.5);
      showToast(hud, 'You hit a pedestrian! Wanted level up.', 3);
      announce(hud, 'Pedestrian hit. Wanted level increased.');
    }
  }
}

function bumpTraffic() {
  if (!player.inCar) return;
  for (const car of traffic) {
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (d < 3.4 && d > 0.01) {
      const push = (3.4 - d) / d;
      const px = (player.x - car.x) * push * 0.5;
      const pz = (player.z - car.z) * push * 0.5;
      player.car.x += px;
      player.car.z += pz;
      car.x -= px;
      car.z -= pz;
      player.car.speed *= 0.85;
      car.speed *= 0.8;
    }
  }
}

function endGame(kind) {
  game.screen = 'end';
  input.releasePointer();
  clearWanted(wanted);
  clearEnemies(combat);
  audio.busted();
  audio.setEngine(0, false);
  audio.setSiren(false);
  const fine = kind === 'busted' ? 100 : 150;
  player.cash = Math.max(0, player.cash - fine);
  if (player.inCar) exitCar(player);
  player.health = PLAYER.maxHealth;
  player.x = CITY.safehouse.x;
  player.z = CITY.safehouse.z;
  player.mesh.position.set(player.x, 0, player.z);
  hud.endTitle.textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
  hud.endText.textContent = kind === 'busted'
    ? `The Suncoast PD caught up with you. Fine: $${fine}. Your car is impounded — the safehouse is yours again.`
    : `Mara went down. Hospital bill: $${fine}. The safehouse is yours again.`;
  showScreen(hud, 'end');
  announce(hud, kind === 'busted' ? 'Busted by the police.' : 'Wasted.');
  saveGame(game);
}

function startPlay(fromSave) {
  if (fromSave) {
    const save = loadSave();
    if (save) {
      player.cash = save.cash;
      player.health = save.health;
      player.x = save.x;
      player.z = save.z;
      missions.index = Math.min(save.missionIndex, MISSIONS.length - 1);
      missions.step = save.missionStep;
      missions.completed = save.completed;
      missions.allDone = save.allDone;
      missions.active = missions.allDone ? null : MISSIONS[missions.index].steps[missions.step];
      player.mesh.position.set(player.x, 0, player.z);
      showToast(hud, 'Save loaded. Welcome back to Solstice City.', 3);
    }
  }
  game.screen = 'play';
  showScreen(hud, 'play');
  audio.unlock();
  audio.click();
  game.missionTitle = missionTitle(missions);
  renderMissionList(hud, missions, !!loadSave());
  announce(hud, 'Playing Solstice City.');
}

function quitToTitle() {
  saveGame(game);
  game.screen = 'title';
  showScreen(hud, 'title');
  input.releasePointer();
  renderMissionList(hud, missions, !!loadSave());
}

function restartMission() {
  const index = missions.index;
  missions.index = index;
  missions.step = 0;
  missions.active = MISSIONS[index].steps[0];
  clearEnemies(combat);
  clearWanted(wanted);
  if (player.inCar) exitCar(player);
  player.x = CITY.plaza.x + 10;
  player.z = CITY.plaza.z + 10;
  player.health = PLAYER.maxHealth;
  player.mesh.position.set(player.x, 0, player.z);
  showToast(hud, `${MISSIONS[index].title} restarted.`, 3);
}

// ---- the world step (shared by the live loop and the screenshot stager) ----
function stepWorld(dt, move, mouse, actions) {
  game.elapsed += dt;
  const inCar = player.inCar;

  if (actions & ACTION_ENTER_CAR) {
    if (inCar) {
      exitCar(player);
      audio.click();
    } else {
      const candidates = [...parkedCars, ...traffic];
      const car = nearestCar(player, candidates, 4.5);
      if (car) enterCarByPlayer(car);
    }
  }
  if (actions & ACTION_RESTART_MISSION) restartMission();
  if (actions & ACTION_MUTE) {
    const muted = audio.toggleMute();
    showToast(hud, muted ? 'Sound muted.' : 'Sound on.', 1.5);
  }

  if (inCar) {
    const hitWall = driveCar(player.car, move, dt, city.colliders);
    // The player's map position IS the car's while driving: the camera, the
    // police and the missions all read player.x / player.z.
    player.x = player.car.x;
    player.z = player.car.z;
    if (hitWall && Math.abs(player.car.speed) > 12) addShake(rig, 0.3);
    hitPedestrianCheck();
    bumpTraffic();
  } else {
    stepPlayerOnFoot(player, { move: () => move, takeActions: () => 0 }, dt, city.colliders, mouse);
    if ((actions & ACTION_SHOOT) || input.mouseHeld()) {
      const hit = playerShoot(combat, rig.camera, { x: player.x, y: 0, z: player.z });
      audio.shoot();
      addShake(rig, 0.25);
      if (missions.active?.kind !== 'fight') addCrime(wanted, 'shoot', game.elapsed);
      if (hit) {
        audio.hit();
        showToast(hud, hit.alive ? 'Hit! The Gull Gang member is hurt.' : 'Gull Gang member down!', 1.5);
      }
    }
  }

  stepTraffic(traffic, dt, city.colliders, player.car);
  const danger = wanted.stars > 0 ? { x: player.x, z: player.z } : null;
  stepPedestrians(peds, dt, city.colliders, danger);
  const busted = stepPolice(wanted, dt, player, city.colliders, game.elapsed);
  if (busted) {
    endGame('busted');
    return;
  }
  const shot = stepCombat(combat, dt, { x: player.x, z: player.z }, (dmg) => {
    player.health -= dmg;
    addShake(rig, 0.4);
    audio.hit();
    if (player.health <= 0) endGame('wasted');
  });
  if (shot === 'enemyShot') audio.enemyShoot();

  checkMissionStep();
  updateBeacon(missions, game.elapsed);
  audio.update(dt);
  const speedRatio = inCar ? Math.abs(player.car.speed) / CAR.maxSpeed : Math.abs(player.speed) / 10;
  audio.setEngine(speedRatio, inCar);
  audio.setSiren(wanted.police.length > 0);
}

function renderFrame() {
  updateCamera(rig, player, 1 / 60, game.elapsed);
  rig.renderer.render(scene, rig.camera);
}

// ---- live loop ----
let accumulator = 0;
let last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  accumulator += Math.min((now - last) / 1000, MAX_FRAME);
  last = now;

  const actions = input.takeActions();
  const mouse = input.takeMouse();

  if (game.screen === 'play') {
    if (actions & ACTION_PAUSE) {
      game.screen = 'pause';
      showScreen(hud, 'pause');
      input.releasePointer();
      announce(hud, 'Paused.');
    } else {
      // Edge-triggered actions fire on the first step only, not every catch-up step.
      let firstStep = true;
      while (accumulator >= STEP) {
        stepWorld(STEP, input.move(), mouse, firstStep ? actions : 0);
        accumulator -= STEP;
        firstStep = false;
        if (game.screen !== 'play') break;
      }
    }
  } else if (game.screen === 'pause') {
    if (actions & ACTION_PAUSE) {
      game.screen = 'play';
      showScreen(hud, 'play');
      announce(hud, 'Playing.');
    }
    accumulator = 0;
  } else if (game.screen === 'title') {
    // The title screen shows the city: a slow orbit around the plaza.
    const t = now / 1000;
    player.x = CITY.plaza.x + 10;
    player.z = CITY.plaza.z + 10;
    rig.camera.position.set(Math.sin(t * 0.08) * 55, 26, Math.cos(t * 0.08) * 55);
    rig.camera.lookAt(0, 4, 0);
    rig.renderer.render(scene, rig.camera);
    stepTraffic(traffic, 0.016, city.colliders, null);
    accumulator = 0;
  }
  if (game.screen === 'play' || game.screen === 'pause') {
    renderFrame();
    updateHud(hud, 1 / 60, game);
  }
}

// ---- buttons ----
document.getElementById('btnNew').addEventListener('click', () => {
  clearSave();
  player.cash = PLAYER.startCash;
  player.health = PLAYER.maxHealth;
  missions.index = 0;
  missions.step = 0;
  missions.completed = [];
  missions.allDone = false;
  missions.active = MISSIONS[0].steps[0];
  clearWanted(wanted);
  clearEnemies(combat);
  player.x = CITY.plaza.x + 10;
  player.z = CITY.plaza.z + 10;
  startPlay(false);
});
document.getElementById('btnContinue').addEventListener('click', () => startPlay(true));
document.getElementById('btnResume').addEventListener('click', () => {
  game.screen = 'play';
  showScreen(hud, 'play');
  audio.click();
});
document.getElementById('btnSaveQuit').addEventListener('click', quitToTitle);
document.getElementById('btnRetry').addEventListener('click', () => startPlay(false));
document.getElementById('btnEndTitle').addEventListener('click', () => {
  game.screen = 'title';
  showScreen(hud, 'title');
  renderMissionList(hud, missions, !!loadSave());
});

// ---- the game object the screenshot stager drives ----
game.startPlay = startPlay;
game.spawnParkedCar = spawnParkedCar;
game.enterCar = (car) => enterCarByPlayer(car);
game.setStars = setStars;
game.placePoliceBehind = placePoliceBehind;
game.spawnMissionEnemies = spawnMissionEnemies;
game.hudHint = (text) => { hud.hint.textContent = text; };
game.goldenHour = () => goldenHourRig(rig);
game.stepWorld = stepWorld;
game.renderFrame = renderFrame;
game.updateCameraOnly = () => updateCamera(rig, player, 1 / 60, game.elapsed);
// Pull the chase camera back and up for one wide shot so the pursuing police
// (a few metres behind the player's car) read in frame.
game.pullCameraBack = () => {
  const car = player.car;
  if (!car) return;
  rig.camPos.set(car.x - Math.sin(car.angle) * 20, 7, car.z - Math.cos(car.angle) * 20);
  rig.camLook.set(car.x + Math.sin(car.angle) * 4, 1.6, car.z + Math.cos(car.angle) * 4);
};
game.refreshHud = () => updateHud(hud, 1 / 60, game);

renderMissionList(hud, missions, !!loadSave());
announce(hud, 'Solstice City. Press Enter or click New Game to start.');
// Debug handle for playtesting (harmless in production).
window.__game = game;
window.__rig = rig;

if (shot) {
  // Screenshot mode: skip the title screen, stage the scene, paint twice.
  game.screen = 'play';
  showScreen(hud, 'play');
  stageShot(shot, game);
} else {
  requestAnimationFrame(frame);
}
