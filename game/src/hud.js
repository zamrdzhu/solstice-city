// The HUD: cash and health, wanted stars, the mission objective, the minimap,
// speed, toasts, hints and the title/pause/end screens. The minimap is a 2D
// canvas drawn every frame — roads, beach, player arrow, traffic, police and
// the mission blip.
import { CITY } from './config.js';
import { describeProgress } from './missions.js';

const MAP_SIZE = 190;
const WORLD = CITY.half + 80; // world units shown across the minimap

function toMap(x, z) {
  return {
    x: ((x + WORLD) / (WORLD * 2)) * MAP_SIZE,
    y: ((z + WORLD) / (WORLD * 2)) * MAP_SIZE,
  };
}

export function createHud() {
  const el = (id) => document.getElementById(id);
  return {
    root: el('hud'),
    cash: el('cash'),
    healthFill: el('healthFill'),
    stars: el('stars'),
    objectiveTag: el('objectiveTag'),
    objectiveText: el('objectiveText'),
    speed: el('speed'),
    speedUnit: el('speedUnit'),
    toast: el('toast'),
    hint: el('hint'),
    crosshair: el('crosshair'),
    minimap: el('minimap').getContext('2d'),
    titleScreen: el('titleScreen'),
    pauseScreen: el('pauseScreen'),
    endScreen: el('endScreen'),
    endTitle: el('endTitle'),
    endText: el('endText'),
    missionList: el('missionList'),
    status: el('status'),
    toastTimer: 0,
  };
}

export function showToast(hud, text, seconds = 3) {
  hud.toast.textContent = text;
  hud.toast.classList.add('show');
  hud.toastTimer = seconds;
}

export function updateHud(hud, dt, game) {
  hud.cash.textContent = game.player.cash.toLocaleString('en-US');
  hud.healthFill.style.width = `${Math.max(0, game.player.health)}%`;
  hud.healthFill.style.background = game.player.health > 50
    ? 'linear-gradient(90deg, #37d67a, #a8e063)'
    : game.player.health > 25
      ? 'linear-gradient(90deg, #f5a623, #f7d154)'
      : 'linear-gradient(90deg, #e74c3c, #ff7675)';
  let starsHtml = '';
  for (let i = 0; i < 5; i += 1) {
    starsHtml += i < game.wanted.stars ? '★' : '<span class="dim">★</span>';
  }
  hud.stars.innerHTML = starsHtml;
  const step = game.missions.active;
  if (step) {
    hud.objectiveTag.textContent = game.missions.allDone ? 'STORY COMPLETE' : game.missionTitle;
    hud.objectiveText.textContent = step.label;
  } else if (game.missions.allDone) {
    hud.objectiveTag.textContent = 'STORY COMPLETE';
    hud.objectiveText.textContent = 'All three jobs done. Solstice City is yours — free roam!';
  } else {
    hud.objectiveTag.textContent = 'FREE ROAM';
    hud.objectiveText.textContent = 'Explore Solstice City. Start the next job at the beacon.';
  }
  if (game.player.inCar) {
    const speed = Math.abs(game.player.car.speed) * 2.24;
    hud.speed.textContent = String(Math.round(speed));
    hud.speedUnit.textContent = `MPH · ${game.player.car.name.toUpperCase()}`;
  } else {
    hud.speed.textContent = 'ON FOOT';
    hud.speedUnit.textContent = 'WASD TO MOVE';
  }
  hud.crosshair.style.display = (!game.player.inCar && game.screen === 'play') ? 'block' : 'none';
  if (hud.toastTimer > 0) {
    hud.toastTimer -= dt;
    if (hud.toastTimer <= 0) hud.toast.classList.remove('show');
  }
  drawMinimap(hud, game);
}

function drawMinimap(hud, game) {
  const c = hud.minimap;
  c.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
  c.fillStyle = '#12283a';
  c.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
  // Sea (west) and sand.
  const sea = toMap(CITY.seaX, -WORLD);
  c.fillStyle = '#2e8fb0';
  c.fillRect(0, 0, Math.max(0, sea.x + 60), MAP_SIZE);
  const beach = toMap(CITY.beachX, -WORLD);
  c.fillStyle = '#e8d29a';
  c.fillRect(sea.x + 60, 0, Math.max(0, beach.x - sea.x - 60), MAP_SIZE);
  // Roads.
  c.strokeStyle = '#5a6270';
  c.lineWidth = 4;
  for (const s of CITY.roads) {
    const a = toMap(s, -WORLD);
    const b = toMap(s, WORLD);
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    c.beginPath(); c.moveTo(a.y, a.x); c.lineTo(b.y, b.x); c.stroke();
  }
  // Mission blip, pulsing.
  const step = game.missions.active;
  if (step) {
    const p = toMap(step.x, step.z);
    const r = 5 + Math.sin(performance.now() / 250) * 2;
    c.fillStyle = '#ffd23e';
    c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#fff';
    c.lineWidth = 1.5;
    c.beginPath(); c.arc(p.x, p.y, r + 3, 0, Math.PI * 2); c.stroke();
  }
  // Traffic (white), police (red), pedestrians (faint).
  for (const car of game.traffic) {
    if (!car.alive) continue;
    const p = toMap(car.x, car.z);
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
  }
  for (const car of game.wanted.police) {
    const p = toMap(car.x, car.z);
    c.fillStyle = '#ff4757';
    c.beginPath(); c.arc(p.x, p.y, 3.5, 0, Math.PI * 2); c.fill();
  }
  // Player arrow.
  const p = toMap(game.player.x, game.player.z);
  const ang = game.player.inCar ? game.player.car.angle : game.player.angle;
  c.save();
  c.translate(p.x, p.y);
  c.rotate(-ang + Math.PI);
  c.fillStyle = '#ffd23e';
  c.beginPath();
  c.moveTo(0, -7);
  c.lineTo(5, 5);
  c.lineTo(-5, 5);
  c.closePath();
  c.fill();
  c.strokeStyle = '#10202e';
  c.lineWidth = 1;
  c.stroke();
  c.restore();
}

export function showScreen(hud, name) {
  hud.titleScreen.classList.toggle('on', name === 'title');
  hud.pauseScreen.classList.toggle('on', name === 'pause');
  hud.endScreen.classList.toggle('on', name === 'end');
  hud.root.classList.toggle('on', name === 'play' || name === 'pause' || name === 'end');
}

export function renderMissionList(hud, mgr, hasSave) {
  const rows = describeProgress(mgr).map((m) => {
    const cls = m.done ? 'done' : m.active ? 'todo' : '';
    const mark = m.done ? '✓' : m.active ? '▶' : '·';
    return `<div class="${cls}">${mark} ${m.title}</div>`;
  }).join('');
  hud.missionList.innerHTML = rows;
  document.getElementById('btnContinue').style.display = hasSave ? '' : 'none';
}

export function announce(hud, message) {
  hud.status.textContent = message;
}
