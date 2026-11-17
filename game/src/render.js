// The renderer: WebGL through the vendored three.js, a warm late-afternoon sun,
// soft sky and fog, and the third-person camera that follows Mara on foot and
// chases her car. The camera eases toward its target so turns feel smooth.
import { PALETTE } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(0xa8c8e0, 180, 520);

  // Sun: warm, low, from the south-west so the beach glows.
  const sun = new THREE.DirectionalLight(0xfff2cf, 1.25);
  sun.position.set(-140, 160, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xbfd9ee, 0.55));
  const hemi = new THREE.HemisphereLight(0x9ec8ee, 0x8a7a5c, 0.35);
  scene.add(hemi);

  // A few soft clouds: flat white blobs drifting slowly over the city.
  const clouds = [];
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 9; i += 1) {
    const cloud = new THREE.Group();
    for (let j = 0; j < 3; j += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(9 + j * 3, 10, 8), cloudMat);
      puff.position.set(j * 10 - 10, j * 1.5, 0);
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    cloud.position.set(-260 + i * 65, 95 + (i % 3) * 12, -220 + ((i * 53) % 440));
    scene.add(cloud);
    clouds.push(cloud);
  }

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(0, 8, -12);

  const rig = {
    renderer,
    scene,
    camera,
    clouds,
    camPos: new THREE.Vector3(0, 8, -12),
    camLook: new THREE.Vector3(0, 1.5, 0),
    shake: 0,
  };

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  return rig;
}

// Follow the player: on foot the camera sits behind the camera yaw at 7 m;
// driving it pulls back to 11 m and swings behind the car.
export function updateCamera(rig, player, dt, time) {
  const inCar = player.inCar;
  const yaw = inCar ? player.car.angle : player.camYaw;
  const dist = inCar ? 11.5 : 7.5;
  const height = inCar ? 4.6 : 3.4;
  const tx = player.x - Math.sin(yaw) * dist;
  const tz = player.z - Math.cos(yaw) * dist;
  const ty = height + (inCar ? Math.abs(player.car.speed) * 0.02 : 0);
  const k = 1 - Math.pow(0.0001, dt); // frame-rate independent easing
  rig.camPos.x += (tx - rig.camPos.x) * k;
  rig.camPos.y += (ty - rig.camPos.y) * k;
  rig.camPos.z += (tz - rig.camPos.z) * k;
  const lx = player.x + Math.sin(yaw) * 4;
  const lz = player.z + Math.cos(yaw) * 4;
  rig.camLook.x += (lx - rig.camLook.x) * k;
  rig.camLook.y += (1.6 - rig.camLook.y) * k;
  rig.camLook.z += (lz - rig.camLook.z) * k;
  let shakeX = 0;
  let shakeY = 0;
  if (rig.shake > 0) {
    shakeX = (Math.random() - 0.5) * rig.shake;
    shakeY = (Math.random() - 0.5) * rig.shake;
    rig.shake = Math.max(0, rig.shake - dt * 1.4);
  }
  rig.camera.position.set(rig.camPos.x + shakeX, rig.camPos.y + shakeY, rig.camPos.z);
  rig.camera.lookAt(rig.camLook.x, rig.camLook.y, rig.camLook.z);
  for (const cloud of rig.clouds) {
    cloud.position.x += dt * 1.2;
    if (cloud.position.x > 300) cloud.position.x = -300;
  }
}

export function addShake(rig, amount) {
  rig.shake = Math.max(rig.shake, amount);
}

// A golden-hour pass for the coast screenshot: lower sun, warmer light.
export function goldenHour(rig) {
  rig.scene.background = new THREE.Color(0xf2a35e);
  rig.scene.fog = new THREE.Fog(0xe8a86a, 160, 480);
}
