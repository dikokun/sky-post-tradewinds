// The wing gun: a .50-cal pod the hangar sells as an upgrade. Firing spawns tracer
// rounds that fly the player's own ballistics — plane velocity plus muzzle velocity
// along the nose, a whisper of drop — and a round that passes within a plane's
// length of a raider costs it one of its three hit points. Pure logic over plain
// states, like the flight model: the renderer draws the tracers this file moves.

import { forwardVector } from './flightModel.js';
import { heightAt } from './data/islands.js';

const FIRE_INTERVAL = 0.11;   // ~9 rounds a second
const MUZZLE_SPEED = 235;
const TRACER_LIFE = 1.15;
const HIT_RADIUS = 15;

export function createGun() {
  return { tracers: [], cooldown: 0, side: 1, shotsFired: 0 };
}

// Step the gun. `firing` is the trigger (held key, or the autopilot's decision).
// Events: {type:'shot'} per round (sound), {type:'hit', raider} per connection,
// {type:'kill', raider} when a hit takes the raider's last point.
export function stepGun(gun, plane, firing, dt, raiders) {
  const events = [];
  gun.cooldown -= dt;
  if (firing && gun.cooldown <= 0 && !plane.onGround) {
    gun.cooldown = FIRE_INTERVAL;
    gun.side = -gun.side;
    const fwd = forwardVector(plane.heading, plane.pitch);
    const lat = { x: Math.cos(plane.heading), z: Math.sin(plane.heading) };
    gun.tracers.push({
      x: plane.x + fwd.x * 6 + lat.x * 1.4 * gun.side,
      y: plane.y + 1.6 + fwd.y * 6,
      z: plane.z + fwd.z * 6 + lat.z * 1.4 * gun.side,
      vx: plane.vx + fwd.x * MUZZLE_SPEED,
      vy: plane.vy + fwd.y * MUZZLE_SPEED,
      vz: plane.vz + fwd.z * MUZZLE_SPEED,
      life: TRACER_LIFE,
    });
    gun.shotsFired++;
    events.push({ type: 'shot' });
  }
  const kept = [];
  for (const tr of gun.tracers) {
    tr.life -= dt;
    if (tr.life <= 0) continue;
    tr.vy -= 2.6 * dt;
    tr.x += tr.vx * dt; tr.y += tr.vy * dt; tr.z += tr.vz * dt;
    if (tr.y < Math.max(heightAt(tr.x, tr.z), 0)) continue; // into the island or the sea
    let spent = false;
    for (const r of raiders) {
      if (r.state === 'gone' || r.state === 'falling') continue;
      const d = Math.hypot(r.x - tr.x, (r.y + 1.6) - tr.y, r.z - tr.z);
      if (d < HIT_RADIUS) {
        r.hp -= 1;
        events.push({ type: r.hp <= 0 ? 'kill' : 'hit', raider: r });
        spent = true;
        break;
      }
    }
    if (!spent) kept.push(tr);
  }
  gun.tracers = kept;
  return events;
}

// The autopilot's trigger discipline, shared by the staging harness and the sims:
// fire only with a live raider close and inside a tight cone off the nose.
export function autopilotFire(plane, target) {
  if (!target || plane.onGround) return false;
  const dx = target.x - plane.x, dz = target.z - plane.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 300 || dist < 18) return false;
  const bearing = Math.atan2(dx, -dz);
  let err = bearing - plane.heading;
  while (err > Math.PI) err -= Math.PI * 2;
  while (err < -Math.PI) err += Math.PI * 2;
  return Math.abs(err) < 0.17 && Math.abs(target.y - plane.y) < 55;
}
