// Keyboard and mouse controls. Keys are tracked as a held-set and read once per frame
// into the input struct the flight model consumes, so the model never knows a keyboard
// exists — the autopilot writes the same struct. Discrete presses (gear, flaps, camera,
// drop, pause) are latched and consumed by the game loop.

export function makeControls() {
  const held = new Set();
  const pressed = new Set();
  const onKey = (down) => (e) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (down && !held.has(k)) pressed.add(k);
    if (down) held.add(k); else held.delete(k);
  };
  addEventListener('keydown', onKey(true));
  addEventListener('keyup', onKey(false));

  return {
    read() {
      return {
        pitch: (held.has('arrowdown') ? 1 : 0) - (held.has('arrowup') ? 1 : 0)
          + (held.has('s') ? 1 : 0) - (held.has('w') ? 1 : 0),
        roll: (held.has('arrowright') ? 1 : 0) - (held.has('arrowleft') ? 1 : 0)
          + (held.has('d') ? 1 : 0) - (held.has('a') ? 1 : 0),
        throttleDelta: (held.has('shift') ? 0.55 : 0) - (held.has('control') ? 0.55 : 0)
          + (held.has('e') ? 0.55 : 0) - (held.has('q') ? 0.55 : 0),
      };
    },
    take(key) { const hit = pressed.has(key); pressed.delete(key); return hit; },
    held: (key) => held.has(key),
    anyPressed: () => pressed.size > 0,
  };
}
