// Save and load through localStorage: cash, mission progress, the player's
// position and best cash. A save is written on every mission payout and on
// Save & Quit; Continue on the title screen picks it back up.
import { SAVE_KEY, BEST_KEY } from './config.js';

export function saveGame(game) {
  try {
    const data = {
      cash: game.player.cash,
      health: game.player.health,
      missionIndex: game.missions.index,
      missionStep: game.missions.step,
      completed: game.missions.completed,
      allDone: game.missions.allDone,
      x: game.player.x,
      z: game.player.z,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || !Array.isArray(data.completed)) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* storage off */ }
}

export function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best cash then lasts this visit only.
  }
}
