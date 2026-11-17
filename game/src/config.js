// Solstice City tuning: every number the rest of the game reads lives here, so a
// balance pass touches one file. Coordinates are metres, +X east, +Z south, Y up.
// The city is a 9x9 street grid; the sea and beach sit west of x = -216.
export const CITY = {
  half: 216,            // half-size of the built-up city square
  block: 36,            // block side length
  road: 12,             // road width
  pitch: 48,            // street centreline spacing (block + road)
  streets: [-192, -144, -96, -48, 0, 48, 96, 144, 192],
  // Road centrelines run BETWEEN the blocks: a block centred at bx has its
  // edges at bx +/- 18, so the road beside it is centred at bx +/- 24.
  roads: [-168, -120, -72, -24, 24, 72, 120, 168],
  seaX: -264,           // where the water starts
  beachX: -216,         // where the sand starts
  pierZ: 96,            // pier runs west from the beach at this z
  safehouse: { x: 168, z: 168 },
  plaza: { x: 0, z: 0 },
  marina: { x: -168, z: -168 },
  garage: { x: 168, z: -168 },
  dealership: { x: -96, z: 120 },
};

export const PLAYER = {
  walkSpeed: 6.5,
  sprintSpeed: 10.5,
  radius: 0.55,
  maxHealth: 100,
  startCash: 120,
};

export const CAR = {
  accel: 16,
  brake: 30,
  maxSpeed: 34,
  maxReverse: 10,
  steer: 1.9,
  grip: 6.5,
  radius: 1.6,
};

// Wanted stars: heat thresholds, how many police cars hunt, how fast they are.
export const WANTED = [
  { stars: 0, police: 0, policeSpeed: 0 },
  { stars: 1, police: 1, policeSpeed: 24 },
  { stars: 2, police: 2, policeSpeed: 27 },
  { stars: 3, police: 3, policeSpeed: 30 },
  { stars: 4, police: 3, policeSpeed: 33 },
  { stars: 5, police: 4, policeSpeed: 36 },
];

export const CRIME = {
  stealCar: 1,
  hitPedestrian: 1,
  shoot: 1,
  killPolice: 2,
  damageCar: 0, // bumping a car is a fine, not a star (keeps driving fun, not punishing)
};

// The story: three jobs for fixer Dario Kestrel. Each mission is a list of steps;
// a step is a place to reach, a car to steal, or a fight to win.
export const MISSIONS = [
  {
    id: 'first-fare',
    title: 'JOB 1 — FIRST FARE',
    client: 'Lena Marlowe',
    brief: 'Pick up Lena at Solstice Plaza and drive her to the Marina. Mind the traffic — she tips for a smooth ride.',
    reward: 250,
    steps: [
      { kind: 'goto', label: 'Pick up Lena at Solstice Plaza', x: 0, z: 0, radius: 5 },
      { kind: 'goto', label: 'Drive Lena to the Marina', x: -168, z: -168, radius: 6, needCar: true },
    ],
  },
  {
    id: 'hot-wheels',
    title: 'JOB 2 — HOT WHEELS',
    client: 'Dario Kestrel',
    brief: 'A gold Comet GT is parked at the Solstice Motors lot. Take it — quietly, if you can — and bring it to Kestrel\u2019s garage. The police will not love this.',
    reward: 600,
    steps: [
      { kind: 'steal', label: 'Steal the gold Comet GT at Solstice Motors', x: -96, z: 120, radius: 4 },
      { kind: 'goto', label: 'Deliver the Comet GT to Kestrel\u2019s garage', x: 168, z: -168, radius: 6, needCar: true },
    ],
  },
  {
    id: 'pier-pressure',
    title: 'JOB 3 — PIER PRESSURE',
    client: 'Dario Kestrel',
    brief: 'The Gull Gang runs the old pier and they owe Kestrel money. Clear them out, then get back to the safehouse before their friends arrive.',
    reward: 900,
    steps: [
      { kind: 'goto', label: 'Go to the old pier', x: -216, z: 96, radius: 7 },
      { kind: 'fight', label: 'Clear out the Gull Gang (4)', x: -232, z: 96, radius: 26, enemies: 4 },
      { kind: 'goto', label: 'Escape to the safehouse', x: 168, z: 168, radius: 6 },
    ],
  },
];

export const SAVE_KEY = 'solstice-city-save-v1';
export const BEST_KEY = 'solstice-city-best-v1';

export const PALETTE = {
  sky: 0x8ec9ee,
  sun: 0xfff2cf,
  sea: 0x2e8fb0,
  sand: 0xe8d29a,
  asphalt: 0x3a3f46,
  sidewalk: 0xb9b3a4,
  grass: 0x7fae62,
};
