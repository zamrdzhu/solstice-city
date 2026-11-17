// Screenshot staging: ?shot=chase|street|mission|coast&seed=N builds a fixed
// scene, runs it for a couple of simulated seconds so traffic, police and
// pedestrians settle into frame, refreshes the HUD, paints it twice and sets
// window.__shotReady. The same code path as the live game — nothing is faked
// for the camera.
export function stageShot(name, game) {
  game.startPlay(false);
  const { player } = game;
  // Driving shots keep the throttle open while settling; on-foot shots stand still.
  let settleMove = { x: 0, y: 0 };
  // The chase settles briefly so the police are still flanking the player car
  // (given longer they converge dead behind it and the camera hides them).
  let settleSteps = 150;

  if (name === 'chase') {
    // Cover: Mara fleeing south down the western avenue in a red Sunrunner, two
    // police cars on her tail, three stars, minimap and a mission objective.
    const car = game.spawnParkedCar(-72, 0, 0, 0xd94f3d, 'Sunrunner');
    player.x = -72;
    player.z = 0;
    game.enterCar(car);
    car.speed = 26;
    startMissionAt(game, 1, 1);
    game.setStars(3);
    game.placePoliceBehind();
    game.hudHint('Wanted: 3 stars — outrun the Suncoast PD!');
    settleMove = { x: 0, y: 1 };
    settleSteps = 70;
  } else if (name === 'street') {
    // On foot on the plaza avenue: the fountain and tower ahead, traffic and
    // pedestrians around, the city opening up down the avenue.
    player.x = 60;
    player.z = 24;
    player.camYaw = -Math.PI / 2;
    player.angle = -Math.PI / 2;
    startMissionAt(game, 0, 0);
    game.hudHint('WASD move · E enter car · Click shoot');
  } else if (name === 'mission') {
    // The pier job mid-fight: Mara on the planks, Gull Gang shooters ahead,
    // two stars, the sea on both sides.
    player.x = -224;
    player.z = 96;
    player.camYaw = -Math.PI / 2;
    player.angle = -Math.PI / 2;
    player.health = 82;
    startMissionAt(game, 2, 1);
    game.spawnMissionEnemies();
    game.setStars(2);
    game.hudHint('Clear out the Gull Gang!');
  } else if (name === 'coast') {
    // Golden-hour cruise up the beach, palms and the sea to the left.
    const car = game.spawnParkedCar(-240, -40, Math.PI, 0x4ecdc4, 'Coastline');
    player.x = -240;
    player.z = -40;
    game.enterCar(car);
    car.speed = 20;
    game.goldenHour();
    startMissionAt(game, 0, 0);
    game.hudHint('The coast road, golden hour.');
    settleMove = { x: 0, y: 1 };
  }

  // Let the world settle: traffic moves, peds walk, police close in. The
  // camera math runs every step so the follow camera tracks tightly; the
  // actual WebGL render runs every 15th step to keep this fast.
  for (let i = 0; i < settleSteps; i += 1) {
    game.stepWorld(1 / 60, settleMove, { dx: 0, dy: 0 }, 0);
    if (game.screen !== 'play') break;
    game.updateCameraOnly();
    if (i % 15 === 0) game.renderFrame();
  }
  if (name === 'chase') game.pullCameraBack();
  let painted = 0;
  function paint() {
    game.renderFrame();
    game.refreshHud();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function startMissionAt(game, index, step) {
  game.missions.index = index;
  game.missions.step = step;
  game.missions.completed = [];
  for (let i = 0; i < index; i += 1) game.missions.completed.push(game.missionDefs[i].id);
  game.missions.active = game.missionDefs[index].steps[step];
  game.missions.allDone = false;
  game.missionTitle = game.missionDefs[index].title;
}
