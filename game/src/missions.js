// The story thread: three jobs for fixer Dario Kestrel, run in order. A mission
// is a list of steps (go somewhere, steal a car, win a fight); the manager tracks
// the current step, places the glowing beacon and the minimap blip, and pays out
// when the last step lands.
import { MISSIONS } from './config.js';

export function createMissionManager(scene) {
  // Beacon: a pulsing column of light plus a floating diamond over the target.
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.35, depthWrite: false });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true), beaconMat);
  beacon.position.y = 30;
  beacon.visible = false;
  scene.add(beacon);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  diamond.visible = false;
  scene.add(diamond);

  return {
    index: 0,          // which mission is active
    step: 0,           // which step of it
    completed: [],     // ids of finished missions
    active: null,      // current step object, or null in free roam
    beacon,
    diamond,
    allDone: false,
  };
}

export function missionTitle(mgr) {
  if (mgr.allDone) return 'STORY COMPLETE';
  const m = MISSIONS[mgr.index];
  return m ? m.title : 'FREE ROAM';
}

export function currentStep(mgr) {
  if (mgr.allDone || mgr.index >= MISSIONS.length) return null;
  return MISSIONS[mgr.index].steps[mgr.step];
}

export function startMission(mgr, index) {
  mgr.index = index;
  mgr.step = 0;
  mgr.active = currentStep(mgr);
  return mgr.active;
}

export function advanceStep(mgr) {
  const mission = MISSIONS[mgr.index];
  mgr.step += 1;
  if (mgr.step >= mission.steps.length) {
    mgr.completed.push(mission.id);
    const reward = mission.reward;
    if (mgr.index + 1 >= MISSIONS.length) {
      mgr.allDone = true;
      mgr.active = null;
    } else {
      mgr.index += 1;
      mgr.step = 0;
      mgr.active = currentStep(mgr);
    }
    return { done: true, mission, reward, next: mgr.active };
  }
  mgr.active = currentStep(mgr);
  return { done: false, next: mgr.active };
}

export function updateBeacon(mgr, now) {
  const step = mgr.active;
  if (!step) {
    mgr.beacon.visible = false;
    mgr.diamond.visible = false;
    return;
  }
  mgr.beacon.visible = true;
  mgr.diamond.visible = true;
  mgr.beacon.position.set(step.x, 30, step.z);
  mgr.beacon.material.opacity = 0.25 + Math.sin(now * 3) * 0.12;
  mgr.diamond.position.set(step.x, 6 + Math.sin(now * 2) * 0.6, step.z);
  mgr.diamond.rotation.y = now;
}

export function describeProgress(mgr) {
  return MISSIONS.map((m) => ({
    title: m.title,
    done: mgr.completed.includes(m.id),
    active: !mgr.allDone && MISSIONS[mgr.index] === m,
  }));
}
