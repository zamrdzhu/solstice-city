// Dynamic weather, the way a real open-world crime game does it: a cycle of
// clear, cloudy, rain, thunderstorm and fog, with smooth transitions between
// them. Rain wets the roads (shinier asphalt, puddles, less grip), storms
// flash lightning with delayed thunder, and fog shortens how far you see.

import { WEATHER_CYCLE, WEATHER_LABELS, PALETTE, CAR } from './config.js';
import { makeRng } from './rng.js';

const SKY = {
  clear: PALETTE.skyClear,
  cloudy: PALETTE.skyCloudy,
  rain: PALETTE.skyRain,
  storm: PALETTE.skyStorm,
  fog: PALETTE.skyFog,
};
const FOG_FAR = { clear: 420, cloudy: 320, rain: 210, storm: 170, fog: 70 };
const FOG_NEAR = { clear: 120, cloudy: 90, rain: 60, storm: 45, fog: 12 };
const SUN_INTENSITY = { clear: 1.25, cloudy: 0.95, rain: 0.7, storm: 0.45, fog: 0.6 };
const HEMI_INTENSITY = { clear: 0.75, cloudy: 0.65, rain: 0.55, storm: 0.4, fog: 0.6 };
const RAIN_COUNT = 1400;

export class Weather {
  constructor(scene, sun, hemi, roadMaterial, audio, seed = 7) {
    this.scene = scene;
    this.sun = sun;
    this.hemi = hemi;
    this.roadMaterial = roadMaterial;
    this.audio = audio;
    this.rng = makeRng(seed);
    this.current = 'clear';
    this.target = 'clear';
    this.blend = 1; // 0 = old state, 1 = target fully applied
    this.timer = WEATHER_CYCLE[0].seconds;
    this.wetness = 0; // 0 dry .. 1 soaked
    this.wetHintShown = false;
    this.lightning = 0; // flash brightness, decays
    this.nextStrike = 6;
    this.time = 0;

    // Sky colour we lerp.
    this.skyColor = new THREE.Color(SKY.clear);
    this.scene.background = this.skyColor;
    this.scene.fog = new THREE.Fog(SKY.clear, FOG_NEAR.clear, FOG_FAR.clear);

    this.buildRain();
    this.buildSplashes();
    this.buildPuddles();
  }

  buildRain() {
    const positions = new Float32Array(RAIN_COUNT * 3);
    for (let i = 0; i < RAIN_COUNT; i += 1) {
      positions[i * 3] = (this.rng() - 0.5) * 70;
      positions[i * 3 + 1] = this.rng() * 32;
      positions[i * 3 + 2] = (this.rng() - 0.5) * 70;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xaac8dd, size: 0.22, transparent: true, opacity: 0, sizeAttenuation: true,
    });
    this.rain = new THREE.Points(geometry, material);
    this.rain.visible = false;
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }

  buildSplashes() {
    this.splashes = [];
    const geometry = new THREE.RingGeometry(0.08, 0.22, 10);
    for (let i = 0; i < 48; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xbfd9e8, transparent: true, opacity: 0, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.06;
      mesh.visible = false;
      this.scene.add(mesh);
      this.splashes.push({ mesh, life: 0 });
    }
  }

  buildPuddles() {
    this.puddles = [];
    const geometry = new THREE.CircleGeometry(1, 18);
    for (let i = 0; i < 12; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: 0x1d2a33, transparent: true, opacity: 0,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      // Scatter puddles along roads, deterministically.
      const road = (Math.floor(this.rng() * 7) - 3) * 60;
      const along = (this.rng() - 0.5) * 360;
      if (this.rng() < 0.5) mesh.position.set(road, 0.05, along);
      else mesh.position.set(along, 0.05, road);
      mesh.scale.set(2 + this.rng() * 3.5, 1.2 + this.rng() * 1.6, 1);
      this.scene.add(mesh);
      this.puddles.push(mesh);
    }
  }

  /** Jump to a state at once (used by ?weather= and the G key). */
  force(name) {
    if (!SKY[name]) return;
    this.current = name;
    this.target = name;
    this.blend = 1;
    const entry = WEATHER_CYCLE.find((w) => w.name === name);
    this.timer = entry ? entry.seconds : 45;
    this.wetness = name === 'rain' || name === 'storm' ? 0.9 : name === 'fog' ? 0.25 : 0;
    this.applyEnvironment(1);
  }

  /** Step to the next state in the cycle, with a smooth transition. */
  cycle() {
    const index = WEATHER_CYCLE.findIndex((w) => w.name === this.target);
    const next = WEATHER_CYCLE[(index + 1) % WEATHER_CYCLE.length];
    this.target = next.name;
    this.timer = next.seconds;
    this.blend = 0;
  }

  update(dt, cameraPosition, onWetHint) {
    this.time += dt;
    this.timer -= dt;
    if (this.timer <= 0) this.cycle();

    // Transition blends over ~8 seconds.
    if (this.blend < 1) this.blend = Math.min(1, this.blend + dt / 8);
    this.applyEnvironment(this.blend);

    const raining = this.target === 'rain' || this.target === 'storm';
    const rainAmount = raining ? this.blend : 1 - this.blend;
    // Wetness rises in rain and dries out in the dry states.
    if (raining) this.wetness = Math.min(1, this.wetness + dt * 0.03);
    else this.wetness = Math.max(0, this.wetness - dt * 0.012);
    if (this.wetness > 0.5 && !this.wetHintShown) {
      this.wetHintShown = true;
      if (onWetHint) onWetHint();
    }
    if (this.wetness < 0.2) this.wetHintShown = false;

    // Road sheen follows wetness: wet asphalt is darker and glossier.
    if (this.roadMaterial) {
      this.roadMaterial.roughness = 0.92 - 0.55 * this.wetness;
      this.roadMaterial.color.setHex(this.wetness > 0.4 ? PALETTE.asphaltWet : PALETTE.asphalt);
    }
    for (const puddle of this.puddles) {
      puddle.material.opacity = this.wetness * 0.55;
    }

    // Rain falls around the camera and recycles.
    const rainVisible = rainAmount > 0.05;
    this.rain.visible = rainVisible;
    if (rainVisible) {
      this.rain.material.opacity = 0.75 * rainAmount;
      this.rain.position.set(cameraPosition.x, 0, cameraPosition.z);
      const positions = this.rain.geometry.attributes.position.array;
      for (let i = 0; i < RAIN_COUNT; i += 1) {
        positions[i * 3 + 1] -= 26 * dt;
        positions[i * 3] += 4 * dt; // wind slant
        if (positions[i * 3 + 1] < 0) {
          positions[i * 3 + 1] = 30 + this.rng() * 4;
          positions[i * 3] = (this.rng() - 0.5) * 70;
          positions[i * 3 + 2] = (this.rng() - 0.5) * 70;
          this.spawnSplash(cameraPosition);
        }
        if (positions[i * 3] > 35) positions[i * 3] -= 70;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }

    // Splash rings expand and fade where drops land.
    for (const splash of this.splashes) {
      if (splash.life <= 0) continue;
      splash.life -= dt * 2.4;
      const scale = 1 + (1 - splash.life) * 2.2;
      splash.mesh.scale.set(scale, scale, 1);
      splash.mesh.material.opacity = Math.max(0, splash.life) * 0.5 * rainAmount;
      if (splash.life <= 0) splash.mesh.visible = false;
    }

    // Lightning during storms: flash, then thunder after a delay.
    if (this.target === 'storm') {
      this.nextStrike -= dt;
      if (this.nextStrike <= 0) {
        this.nextStrike = 3 + this.rng() * 6;
        this.lightning = 1;
        if (this.audio) this.audio.thunder(0.4 + this.rng() * 1.1);
      }
    }
    if (this.lightning > 0) {
      this.lightning = Math.max(0, this.lightning - dt * 3.2);
      this.sun.intensity += this.lightning * 6;
    }
  }

  spawnSplash(cameraPosition) {
    for (const splash of this.splashes) {
      if (splash.life > 0) continue;
      splash.life = 1;
      splash.mesh.position.set(
        cameraPosition.x + (this.rng() - 0.5) * 56,
        0.06,
        cameraPosition.z + (this.rng() - 0.5) * 56,
      );
      splash.mesh.visible = true;
      return;
    }
  }

  applyEnvironment(blend) {
    const from = this.current;
    const to = this.target;
    const sky = new THREE.Color(SKY[from]).lerp(new THREE.Color(SKY[to]), blend);
    this.skyColor.copy(sky);
    this.scene.fog.color.copy(sky);
    this.scene.fog.near = FOG_NEAR[from] + (FOG_NEAR[to] - FOG_NEAR[from]) * blend;
    this.scene.fog.far = FOG_FAR[from] + (FOG_FAR[to] - FOG_FAR[from]) * blend;
    this.sun.intensity = SUN_INTENSITY[from] + (SUN_INTENSITY[to] - SUN_INTENSITY[from]) * blend;
    this.sun.color.setHex(to === 'storm' ? PALETTE.sunStorm : PALETTE.sunClear);
    this.hemi.intensity = HEMI_INTENSITY[from] + (HEMI_INTENSITY[to] - HEMI_INTENSITY[from]) * blend;
    if (blend >= 1) this.current = to;
  }

  /** How much grip the car keeps right now (1 = dry). */
  gripFactor() {
    return 1 - CAR.wetGripLoss * this.wetness;
  }

  label() {
    return WEATHER_LABELS[this.target];
  }
}
