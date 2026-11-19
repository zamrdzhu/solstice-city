// The HUD: wanted stars, health and money, the mission panel, the city clock
// with its weather indicator, the radio readout, a circular minimap drawn on
// a canvas, the dialogue bar, and the start / pause / wasted / victory
// overlays. Everything is DOM and canvas — no images, no network.

import { CITY_NAME, CLOCK, WEATHER_LABELS } from './config.js';

export class HUD {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('hud');
    this.dialogueLines = [];
    this.dialogueTimer = 0;
    this.flashTimer = 0;
    this.build();
  }

  el(tag, cls, parent) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (parent) parent.appendChild(node);
    return node;
  }

  build() {
    // Top-left: wanted stars, health, money.
    const topLeft = this.el('div', 'hud-topleft', this.root);
    this.stars = this.el('div', 'hud-stars', topLeft);
    this.healthWrap = this.el('div', 'hud-health', topLeft);
    this.healthBar = this.el('div', 'hud-healthbar', this.healthWrap);
    this.money = this.el('div', 'hud-money', topLeft);
    this.missionPanel = this.el('div', 'hud-mission', topLeft);
    this.missionName = this.el('div', 'hud-mission-name', this.missionPanel);
    this.missionObjective = this.el('div', 'hud-mission-objective', this.missionPanel);
    this.missionExtra = this.el('div', 'hud-mission-extra', this.missionPanel);

    // Top-right: clock, weather, radio.
    const topRight = this.el('div', 'hud-topright', this.root);
    this.clock = this.el('div', 'hud-clock', topRight);
    this.weather = this.el('div', 'hud-weather', topRight);
    this.radio = this.el('div', 'hud-radio', topRight);

    // Bottom-left: circular minimap.
    const mapWrap = this.el('div', 'hud-mapwrap', this.root);
    this.minimap = this.el('canvas', 'hud-minimap', mapWrap);
    this.minimap.width = 190;
    this.minimap.height = 190;

    // Bottom-centre: dialogue bar.
    this.dialogue = this.el('div', 'hud-dialogue', this.root);
    this.dialogueSpeaker = this.el('span', 'hud-dialogue-speaker', this.dialogue);
    this.dialogueText = this.el('span', 'hud-dialogue-text', this.dialogue);

    // Bottom-right: controls hint.
    const hint = this.el('div', 'hud-hint', this.root);
    hint.textContent = 'WASD move/drive · E car · Click shoot · F punch · T radio · G weather';

    // Centre flash message.
    this.flashEl = this.el('div', 'hud-flash', this.root);

    // Overlays.
    this.overlay = this.el('div', 'hud-overlay', this.root);
  }

  update(dt) {
    const game = this.game;
    // Wanted stars.
    const level = Math.floor(game.police.wanted + 0.001);
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < level ? '★' : '☆';
    this.stars.textContent = stars;
    this.stars.style.color = level >= 4 ? '#ff5a4e' : level >= 2 ? '#ffb347' : '#ffd23e';
    // Health.
    this.healthBar.style.width = `${Math.max(0, game.player.health)}%`;
    this.healthBar.style.background = game.player.health > 50 ? '#58d68d' : game.player.health > 25 ? '#ffb347' : '#ff5a4e';
    this.money.textContent = `$${game.money.toLocaleString('en-US')}`;
    // Clock: game time advances from 09:00.
    const hours = (CLOCK.startHour + Math.floor(game.time / CLOCK.secondsPerHour)) % 24;
    const minutes = Math.floor(((game.time / CLOCK.secondsPerHour) % 1) * 60);
    this.clock.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}  ·  ${CITY_NAME.toUpperCase()}`;
    // Weather indicator next to the clock.
    const weatherName = game.weather.label();
    const icons = { CLEAR: '☀', CLOUDY: '☁', RAIN: '☂', STORM: '⚡', FOG: '≈' };
    this.weather.textContent = `${icons[weatherName] || ''} ${weatherName}`;
    // Radio.
    this.radio.textContent = `♪ ${game.audio.radioName()}`;
    // Dialogue auto-advance.
    if (this.dialogueLines.length > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) this.advanceDialogue();
    }
    // Flash fade.
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      this.flashEl.style.opacity = Math.max(0, this.flashTimer / 2.5);
    }
    this.drawMinimap();
  }

  setMission(name, objective, extra) {
    this.missionName.textContent = name;
    this.missionObjective.textContent = objective;
    this.missionExtra.textContent = extra || '';
    this.missionPanel.style.display = 'block';
  }

  clearMission() {
    this.missionPanel.style.display = 'none';
  }

  flash(text) {
    if (this.game.suppressFlash) return;
    this.flashEl.textContent = text;
    this.flashEl.style.opacity = 1;
    this.flashTimer = 2.5;
  }

  showDialogue(lines) {
    this.dialogueLines = [...lines];
    this.dialogueTimer = 5;
    this.showDialogueLine();
  }

  showDialogueLine() {
    const line = this.dialogueLines[0];
    if (!line) {
      this.dialogue.style.display = 'none';
      return;
    }
    const colon = line.indexOf(':');
    const speaker = colon > 0 ? line.slice(0, colon) : '';
    const text = colon > 0 ? line.slice(colon + 1).trim() : line;
    this.dialogueSpeaker.textContent = speaker;
    this.dialogueSpeaker.style.color = { Lena: '#7fe0a8', Dante: '#8ec8ff', Kane: '#ffd28e', Delgado: '#ff9d9d', Vex: '#ff7d7d' }[speaker] || '#fff';
    this.dialogueText.textContent = text;
    this.dialogue.style.display = 'flex';
  }

  advanceDialogue() {
    this.dialogueLines.shift();
    this.dialogueTimer = 5;
    this.showDialogueLine();
  }

  drawMinimap() {
    const ctx = this.minimap.getContext('2d');
    const size = 190;
    const scale = size / 520; // world spans -260..260
    const toMap = (x, z) => [size / 2 + x * scale, size / 2 + z * scale];
    ctx.clearRect(0, 0, size, size);
    // Round clip.
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    // Sea and sand on the west.
    ctx.fillStyle = '#2e7f8f';
    ctx.fillRect(0, 0, 26, size);
    ctx.fillStyle = '#d9c08a';
    ctx.fillRect(26, 0, 10, size);
    // Land.
    ctx.fillStyle = '#3f4a3a';
    ctx.fillRect(36, 0, size - 36, size);
    // Roads.
    ctx.strokeStyle = '#5a5f66';
    ctx.lineWidth = 4;
    for (const r of [-180, -120, -60, 0, 60, 120, 180]) {
      const [x1, y1] = toMap(r, -240);
      const [x2, y2] = toMap(r, 240);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const [hx1, hy1] = toMap(-240, r);
      const [hx2, hy2] = toMap(240, r);
      ctx.beginPath();
      ctx.moveTo(hx1, hy1);
      ctx.lineTo(hx2, hy2);
      ctx.stroke();
    }
    // Blocks.
    ctx.fillStyle = '#6b7a6b';
    for (let bx = 0; bx < 6; bx += 1) {
      for (let bz = 0; bz < 6; bz += 1) {
        const [x, y] = toMap(-150 + bx * 60 - 20, -150 + bz * 60 - 20);
        ctx.fillRect(x, y, 40 * scale, 40 * scale);
      }
    }
    // Traffic dots.
    ctx.fillStyle = '#c9c9c9';
    for (const car of this.game.vehicles.cars) {
      if (car.isPlayer || car.isPolice) continue;
      const [x, y] = toMap(car.x, car.z);
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // Police blips.
    for (const blip of this.game.police.minimapBlips()) {
      const [x, y] = toMap(blip.x, blip.z);
      if (blip.kind === 'heli') {
        ctx.fillStyle = '#ff3b30';
        ctx.beginPath();
        ctx.moveTo(x, y - 5);
        ctx.lineTo(x + 5, y);
        ctx.lineTo(x, y + 5);
        ctx.lineTo(x - 5, y);
        ctx.fill();
      } else {
        ctx.fillStyle = '#ff3b30';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Mission blip, pulsing.
    const mission = this.game.missions.objectiveBlip();
    if (mission) {
      const [x, y] = toMap(mission.x, mission.z);
      const pulse = 4 + Math.sin(this.game.time * 5) * 2;
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(x, y, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Player arrow.
    const [px, py] = toMap(this.game.player.x, this.game.player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-this.game.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    // Ring border.
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  showStart(hasSave, onNew, onContinue) {
    this.overlay.innerHTML = '';
    this.overlay.style.display = 'flex';
    const box = this.el('div', 'hud-panel', this.overlay);
    const title = this.el('h1', 'hud-title', box);
    title.textContent = 'COSTA ALBA';
    const sub = this.el('p', 'hud-subtitle', box);
    sub.textContent = 'An open-world crime story on the sunny coast. Drive, steal, run — and take the city back.';
    const btnNew = this.el('button', 'hud-button', box);
    btnNew.textContent = hasSave ? 'NEW GAME' : 'START GAME';
    btnNew.addEventListener('click', () => {
      this.overlay.style.display = 'none';
      onNew();
    });
    if (hasSave) {
      const btnContinue = this.el('button', 'hud-button', box);
      btnContinue.textContent = 'CONTINUE';
      btnContinue.addEventListener('click', () => {
        this.overlay.style.display = 'none';
        onContinue();
      });
    }
    const controls = this.el('p', 'hud-controls', box);
    controls.textContent = 'WASD move / drive · Shift run · E enter or leave a car · Click shoot · F punch · T radio · G weather · Esc pause';
    const note = this.el('p', 'hud-note', box);
    note.textContent = 'All original: a city, characters and story invented for this game.';
  }

  showPause(onResume, onRestart) {
    this.overlay.innerHTML = '';
    this.overlay.style.display = 'flex';
    const box = this.el('div', 'hud-panel', this.overlay);
    const title = this.el('h1', 'hud-title', box);
    title.textContent = 'PAUSED';
    const btnResume = this.el('button', 'hud-button', box);
    btnResume.textContent = 'RESUME';
    btnResume.addEventListener('click', () => {
      this.overlay.style.display = 'none';
      onResume();
    });
    const btnRestart = this.el('button', 'hud-button', box);
    btnRestart.textContent = 'RESTART CHAPTER';
    btnRestart.addEventListener('click', () => {
      this.overlay.style.display = 'none';
      onRestart();
    });
  }

  showWasted(onRespawn) {
    this.overlay.innerHTML = '';
    this.overlay.style.display = 'flex';
    const box = this.el('div', 'hud-panel', this.overlay);
    const title = this.el('h1', 'hud-title wasted', box);
    title.textContent = 'WASTED';
    const sub = this.el('p', 'hud-subtitle', box);
    sub.textContent = 'The city got you this time. The hospital patches you up — minus a little cash.';
    const btn = this.el('button', 'hud-button', box);
    btn.textContent = 'GET BACK OUT THERE';
    btn.addEventListener('click', () => {
      this.overlay.style.display = 'none';
      onRespawn();
    });
  }

  showVictory(money) {
    this.overlay.innerHTML = '';
    this.overlay.style.display = 'flex';
    const box = this.el('div', 'hud-panel', this.overlay);
    const title = this.el('h1', 'hud-title', box);
    title.textContent = 'COSTA ALBA IS YOURS';
    const sub = this.el('p', 'hud-subtitle', box);
    sub.textContent = `All eight chapters complete. Vex is finished, the city breathes again — and you are $${money.toLocaleString('en-US')} richer. Free roam continues: the streets are yours.`;
  }

  hideOverlay() {
    this.overlay.style.display = 'none';
  }
}
