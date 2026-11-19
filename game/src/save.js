// Saving and loading: money, chapter progress, the player's position, the
// in-game clock and the weather. Everything lives in localStorage, so a
// player can close the tab and pick up the story where they left it.

import { SAVE_KEY } from './config.js';

export function saveGame(game) {
  try {
    const data = {
      version: 1,
      money: game.money,
      chapterIndex: game.missions.chapterIndex,
      playerX: game.player.x,
      playerZ: game.player.z,
      time: game.time,
      weather: game.weather.target,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function applySave(game, data) {
  game.money = data.money || 0;
  game.time = data.time || 0;
  game.player.setPosition(data.playerX || 0, data.playerZ || 30, 0);
  if (data.weather) game.weather.force(data.weather);
  game.missions.chapterIndex = data.chapterIndex || 0;
}
