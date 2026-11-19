// Costa Alba — tuning, palette and story data for the open-world crime game.
// Every number that shapes how the city plays lives here, so the rest of the
// game reads like intent instead of magic constants.

export const CITY_NAME = 'Costa Alba';
export const GAME_TITLE = 'COSTA ALBA';
export const SAVE_KEY = 'costa-alba.save.v1';

// The city is a grid of roads on a flat plain, with the sea and beach on the
// west edge, a pier reaching out at the middle, and a lighthouse on the point.
export const WORLD = {
  halfSize: 240,
  roadSpacing: 60,
  roadWidth: 12,
  blockSize: 44,
  roadCount: 7, // roads at -180, -120, -60, 0, 60, 120, 180 on both axes
  seaEdge: -216, // x below this is water
  beachEdge: -196,
  groundY: 0,
};

// Fixed simulation step: 60 updates a second whatever the display rate.
export const STEP = 1 / 60;

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 9.5,
  radius: 0.7,
  height: 1.8,
  health: 100,
  punchDamage: 25,
  punchRange: 2.2,
  pistolDamage: 34,
  pistolRange: 90,
};

export const CAR = {
  accel: 22,
  brake: 34,
  reverseAccel: 12,
  maxSpeed: 38,
  maxReverse: 10,
  turnRate: 1.9,
  grip: 0.92,
  // Wet-road grip penalty is applied by the weather module.
  wetGripLoss: 0.18,
  enterRange: 3.2,
};

export const TRAFFIC = {
  count: 18,
  speed: 11,
  minGap: 7,
};

export const PEDESTRIANS = {
  count: 40,
  walkSpeed: 1.6,
  fleeSpeed: 4.5,
};

export const POLICE = {
  maxPatrolCars: 4,
  chaseSpeed: 33,
  ramDamage: 6,
  shootRange: 45,
  shootDamage: 4,
  heliHeight: 55,
  heliSpeed: 26,
  roadblockAt: 3,
  heliAt: 4,
};

// Wanted level 0-5. Committing crimes adds heat; it cools when the player
// stays out of trouble and out of police sight.
export const WANTED = {
  stealCar: 1,
  hitPedestrian: 1,
  punch: 1,
  shoot: 2,
  killPolice: 2,
  coolPerSecond: 0.06,
  coolDelay: 12,
};

// In-game clock: one game hour per 100 real seconds, starting at 09:00.
export const CLOCK = { startHour: 9, secondsPerHour: 100 };

// Weather states in cycle order, with how long each lasts (seconds).
export const WEATHER_CYCLE = [
  { name: 'clear', seconds: 75 },
  { name: 'cloudy', seconds: 45 },
  { name: 'rain', seconds: 55 },
  { name: 'storm', seconds: 40 },
  { name: 'fog', seconds: 50 },
];
export const WEATHER_LABELS = {
  clear: 'CLEAR',
  cloudy: 'CLOUDY',
  rain: 'RAIN',
  storm: 'STORM',
  fog: 'FOG',
};

export const PALETTE = {
  skyClear: 0x87bfe8,
  skyCloudy: 0x9fb4c4,
  skyRain: 0x6d7d8c,
  skyStorm: 0x3d4750,
  skyFog: 0xa8b0b4,
  sunClear: 0xfff2d8,
  sunStorm: 0x8fa3b5,
  sea: 0x2e7f8f,
  sand: 0xd9c08a,
  asphalt: 0x3a3d42,
  asphaltWet: 0x23262b,
  sidewalk: 0x9a938a,
  grass: 0x7fae62,
  wallWhite: 0xf2ead8,
  wallTerra: 0xd98a5f,
  wallBlue: 0x7fa8c9,
  roofTerra: 0xb45a3c,
  roofSlate: 0x5a6470,
  palm: 0x4f8f4a,
  neonPink: 0xff5da2,
  neonCyan: 0x59e6ff,
  neonAmber: 0xffb347,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// The story: Dante Cruz, a former getaway driver turned courier, is pulled
// back into Costa Alba's underworld over eight chapters. All names, places
// and vehicles are invented for this game.
export const CHAPTERS = [
  {
    name: 'First Fare',
    giver: 'Lena Ortiz',
    intro: [
      'Lena: Dante! You are late. My best driver is back and already late.',
      'Dante: Traffic, Lena. You know how Alba gets at nine.',
      'Lena: Then drive. Take Mrs. Alvarado to the marina. Smooth and steady.',
    ],
    objective: 'Drive the fare to the marina marker',
    kind: 'goto',
    target: { x: -150, z: 150 },
    reward: 120,
    hint: 'Hold W to drive. The yellow beacon marks the drop-off.',
  },
  {
    name: 'Hot Wheels',
    giver: 'Lena Ortiz',
    intro: [
      'Lena: A Cometa GT is parked by the plaza. Borrow it. Permanently.',
      'Dante: Borrow. Right. And the cops?',
      'Lena: Then do not let them catch you. Lose the heat, bring it here.',
    ],
    objective: 'Steal the Cometa GT and lose the police',
    kind: 'steal',
    target: { x: 60, z: -60 },
    reward: 250,
    hint: 'Press E near a car to take it. Wanted stars fade if you stay hidden.',
  },
  {
    name: 'Harbor Run',
    giver: 'Mr. Kane',
    intro: [
      'Kane: A crate at the docks needs to be across town in four minutes.',
      'Dante: Four minutes? Through Alba traffic?',
      'Kane: I said across town, Mr. Cruz. Not through the gift shop.',
    ],
    objective: 'Deliver the crate to the north gate before time runs out',
    kind: 'timed',
    target: { x: 150, z: -180 },
    seconds: 150,
    reward: 400,
    hint: 'Shortcuts help. Watch the timer — and the police.',
  },
  {
    name: 'Pier Pressure',
    giver: 'Lena Ortiz',
    intro: [
      'Lena: Vex and his crew are shaking down the pier fishermen again.',
      'Dante: And that is my problem because...?',
      'Lena: Because the pier pays my rent. Go. Remind them whose pier it is.',
    ],
    objective: 'Drive the Vex crew off the pier (defeat 4)',
    kind: 'fight',
    target: { x: -205, z: 0 },
    count: 4,
    reward: 500,
    hint: 'Left click shoots. F punches up close. Use the crates as cover.',
  },
  {
    name: 'Night Deposit',
    giver: 'Mr. Kane',
    intro: [
      'Kane: The bank on Meridian Row closes at dusk. The bag will be waiting.',
      'Dante: You want me to walk into a bank and walk out with a bag?',
      'Kane: I want you to be quick about it. The rest is your problem.',
    ],
    objective: 'Grab the cash bag and escape the police',
    kind: 'escape',
    target: { x: 120, z: 60 },
    reward: 800,
    hint: 'Grab the bag, then break line of sight until the heat dies.',
  },
  {
    name: 'Convoy Trouble',
    giver: 'Captain Delgado',
    intro: [
      'Delgado: Off the record, Cruz — Vex is moving product in a convoy tonight.',
      'Dante: A cop asking a crook for a favour? The city really has changed.',
      'Delgado: Stop the lead truck. Do it quietly, and we never met.',
    ],
    objective: 'Stop the lead convoy truck by ramming it',
    kind: 'ram',
    target: { x: 0, z: -120 },
    reward: 900,
    hint: 'Ram the truck from the side to slow it. Mind the escort cars.',
  },
  {
    name: 'Heat Wave',
    giver: 'Mr. Kane',
    intro: [
      'Kane: Vex put a price on your head. Every badge in Alba is looking.',
      'Dante: Then they will have to look harder. I am not stopping.',
      'Kane: Survive ninety seconds. After that, the price is not worth it.',
    ],
    objective: 'Survive the full police hunt for 90 seconds',
    kind: 'survive',
    seconds: 90,
    reward: 1000,
    hint: 'Four stars means a helicopter. Keep moving — never stop in the open.',
  },
  {
    name: 'Last Light',
    giver: 'Lena Ortiz',
    intro: [
      'Lena: Vex is at the lighthouse. End this tonight, Dante.',
      'Dante: He should have stayed on his side of the bay.',
      'Lena: Bring the city back, driver. Then come home.',
    ],
    objective: 'Confront Vex at the lighthouse and end the chase',
    kind: 'finale',
    target: { x: -215, z: -150 },
    reward: 2000,
    hint: 'Reach the lighthouse beacon. Vex will not go quietly.',
  },
];

export const DIALOGUE_COLORS = {
  Lena: '#7fe0a8',
  Dante: '#8ec8ff',
  Kane: '#ffd28e',
  Delgado: '#ff9d9d',
  Vex: '#ff7d7d',
};

// Radio stations: three invented WebAudio stations, each with its own mood.
export const RADIO_STATIONS = [
  { name: 'ALBA FM 88.4', mood: 'Sunny pop', key: 'pop' },
  { name: 'COSTA ROCK 101', mood: 'Driving rock', key: 'rock' },
  { name: 'MARINA NIGHTS 96.2', mood: 'Late synth', key: 'synth' },
];
