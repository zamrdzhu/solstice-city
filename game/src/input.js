// Keyboard + mouse input, read once a frame. Keys are held state; actions are
// edge-triggered (pressed this frame) so menus and car entry do not double-fire.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_SHOOT = 8;
export const ACTION_RESTART_MISSION = 16;
export const ACTION_MUTE = 32;

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseDown = false;
  let mousePressed = false;
  let mouseDX = 0;
  let mouseDY = 0;
  let locked = false;

  const KEY_ACTIONS = {
    Enter: ACTION_CONFIRM,
    Space: ACTION_CONFIRM,
    KeyP: ACTION_PAUSE,
    Escape: ACTION_PAUSE,
    KeyE: ACTION_ENTER_CAR,
    KeyR: ACTION_RESTART_MISSION,
    KeyM: ACTION_MUTE,
  };

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (KEY_ACTIONS[event.code]) pressed.add(KEY_ACTIONS[event.code]);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseDown(event) {
    if (event.button === 0) {
      mouseDown = true;
      mousePressed = true;
      if (!locked && document.pointerLockElement !== canvas) {
        try { canvas.requestPointerLock(); } catch { /* pointer lock is a nicety */ }
      }
    }
  }
  function onMouseUp(event) {
    if (event.button === 0) mouseDown = false;
  }
  function onMouseMove(event) {
    if (document.pointerLockElement === canvas) {
      mouseDX += event.movementX;
      mouseDY += event.movementY;
    }
  }
  function onLockChange() {
    locked = document.pointerLockElement === canvas;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('pointerlockchange', onLockChange);

  function axis() {
    let x = 0;
    let y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
    return { x, y };
  }

  return {
    // -1/0/1 strafe and forward axes, plus brake and sprint held state.
    move() {
      const a = axis();
      return {
        x: a.x,
        y: a.y,
        brake: keys.has('Space'),
        sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
      };
    },
    takeActions() {
      let actions = 0;
      for (const a of pressed) actions |= a;
      pressed.clear();
      if (mousePressed) actions |= ACTION_SHOOT;
      mousePressed = false;
      return actions;
    },
    takeMouse() {
      const dx = mouseDX;
      const dy = mouseDY;
      mouseDX = 0;
      mouseDY = 0;
      return { dx, dy };
    },
    mouseHeld() {
      return mouseDown;
    },
    isLocked() {
      return locked;
    },
    releasePointer() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
  };
}
