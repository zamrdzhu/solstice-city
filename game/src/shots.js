// Screenshot staging: ?shot=cover|drive|mission|foot (with ?weather= and
// ?seed=) sets the game up in a fixed, dramatic state and runs the real
// simulation forward a few seconds, so each screenshot is a frame of actual
// play — dense HUD, traffic, police, weather — and the same seed always gives
// the same frame. When the frame is ready, window.__shotReady is set.

import { STEP } from './config.js';

function runSim(game, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) game.update(STEP, true);
}

function putPlayerInCar(game, kind, x, z, heading, speed) {
  const car = game.vehicles.cars.find((c) => c.kind === kind && !c.isPolice && !c.isPlayer)
    || game.vehicles.spawnCar(kind, 0xc0392b, x, z, heading, false);
  car.x = x;
  car.z = z;
  car.heading = heading;
  car.speed = speed;
  game.vehicles.enterCar(car);
  game.player.inCar = true;
  game.player.setPosition(x, z, heading);
  return car;
}

function stageCover(game) {
  // The cover: a wanted chase in the rain — sports car, helicopter searchlight
  // overhead, patrol cars closing in, wet roads shining. The car sits on the
  // x=0 road so the chase reads down a clear street, and the escort cars and
  // helicopter are placed exactly for the frame after the simulation runs.
  game.weather.force('storm');
  game.weather.wetHintShown = true; // keep the wet-roads flash out of the shot
  game.money = 1250;
  putPlayerInCar(game, 'sports', 0, 40, 0, 22);
  game.police.addWanted(4, 'staged');
  game.police.update(0.1);
  game.police.update(0.1);
  // Two patrol cars for the chase, driven by the sim, then parked on the
  // player's tail for the frame.
  const escorts = [];
  for (const [x, z] of [[3.4, 8], [-3.4, 2]]) {
    const patrol = game.vehicles.spawnCar('police', 0x1a1a1a, x, z, 0, false);
    patrol.isPolice = true;
    patrol.speed = 24;
    escorts.push(patrol);
  }
  game.missions.startChapter(6); // Heat Wave: the helicopter hunt
  game.stagingInput = { forward: true, back: false, left: false, right: false, run: false, handbrake: false };
  runSim(game, 2.5);
  game.stagingInput = null;
  const car = game.vehicles.playerCar;
  // The roadblock the sim spawned sits where the player drove into it; clear
  // it so the chase reads clean.
  game.police.removeRoadblocks();
  escorts[0].x = car.x - 4;
  escorts[0].z = car.z - 6;
  escorts[0].heading = car.heading;
  escorts[0].speed = car.speed;
  escorts[0].syncMesh();
  escorts[1].x = car.x + 4;
  escorts[1].z = car.z - 9;
  escorts[1].heading = car.heading;
  escorts[1].speed = car.speed;
  escorts[1].syncMesh();
  // Park the helicopter ahead and slightly to the side, low enough to be in
  // the frame, with its searchlight aimed at the player car.
  if (game.police.heli) {
    const heli = game.police.heli;
    heli.group.position.set(car.x + 8, 30, car.z + 55);
    heli.spot.target.position.set(car.x, 0, car.z);
    heli.cone.lookAt(car.x, 0, car.z);
    heli.cone.rotateX(-Math.PI / 2);
  }
  game.player.setCamera(
    car.x - Math.sin(car.heading) * 20, 8, car.z - Math.cos(car.heading) * 20,
    car.x + Math.sin(car.heading) * 18, 2, car.z + Math.cos(car.heading) * 18,
  );
}

function stageDrive(game) {
  // Daytime downtown drive: clear sky, traffic, pedestrians, the taxi in flow.
  game.weather.force('clear');
  game.money = 340;
  putPlayerInCar(game, 'taxi', 0, 60, 0, 14);
  // Traffic ahead on the same road so the street reads alive.
  game.vehicles.spawnCar('sedan', 0x2e6f8f, 2.8, 140, 0, true);
  game.vehicles.spawnCar('sedan', 0xd8c25a, -2.8, 165, 0, true);
  game.missions.startChapter(0);
  game.stagingInput = { forward: true, back: false, left: false, right: false, run: false, handbrake: false };
  runSim(game, 3);
  game.stagingInput = null;
  const car = game.vehicles.playerCar;
  game.player.setCamera(
    car.x - Math.sin(car.heading) * 15, 6.5, car.z - Math.cos(car.heading) * 15,
    car.x + Math.sin(car.heading) * 16, 2, car.z + Math.cos(car.heading) * 16,
  );
}

function stageMission(game) {
  // The pier fight under a cloudy sky: mission beacon, dialogue bar, gang.
  // The camera sits high over the beach so the pier, the gang and the beacon
  // are all in frame with no building in the way.
  game.weather.force('cloudy');
  game.money = 860;
  game.player.setPosition(-200, 2, 0.9);
  game.player.cameraYaw = -Math.PI / 2;
  game.missions.startChapter(3); // Pier Pressure
  runSim(game, 1.5);
  // From the south-east so the bait shack does not block the pier deck.
  game.player.setCamera(-188, 5, -14, -210, 1.5, 2);
}

function stageFoot(game) {
  // On foot in the morning fog by the lighthouse, beam sweeping the bay.
  // The camera sits south-east of the player so the beach palms stay out of
  // the sightline to the lighthouse.
  game.weather.force('fog');
  game.money = 2140;
  game.player.setPosition(-214, -138, -0.9);
  game.player.cameraYaw = -Math.PI / 2;
  game.missions.startChapter(7); // Last Light
  runSim(game, 2);
  // Close to the lighthouse: fog swallows anything past ~70 units, so the
  // camera sits 26 units out, with the palms well east of the sightline.
  game.player.setCamera(-208, 3.5, -128, -224, 12, -148);
}

export function stageShot(game, name) {
  const stages = { cover: stageCover, drive: stageDrive, mission: stageMission, foot: stageFoot };
  const stage = stages[name] || stageDrive;
  // Fresh world state for the shot, then the staged scene. Flash messages are
  // suppressed while staging so they never print across the frame, and once
  // the scene is set the simulation freezes — the loop only renders.
  game.state = 'playing';
  game.hud.hideOverlay();
  game.audio.ensure();
  game.suppressFlash = true;
  stage(game);
  game.suppressFlash = false;
  game.staging = true;
  // Paint the HUD once (stars, money, clock, weather, minimap) — the frozen
  // loop will not update it again.
  game.hud.update(0.1);
  game.render();
  window.__shotReady = true;
}
