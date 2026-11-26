// The sky raiders: bandit Kestrels that tax the Reach. Each raider is a plain state
// object flown by a small pursuit pilot — it loiters over its island until the mail
// plane comes close, then hunts: it steers an intercept course with a limited turn
// rate, weaves so it is not a turkey, and fires short bursts when it sits in range
// behind the player's nose line. Hit three times it falls, spinning, and the sea or
// the island collects it. Pure logic over plain states (no rendering imports), so
// the node sims can fight the same bandits the player does.

import { clamp } from './flightModel.js';
import { islandById } from './data/islands.js';

const angDiff = (a, b) => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};
const headingTo = (from, to) => Math.atan2(to.x - from.x, -(to.z - from.z));

export const RAIDER_HP = 3;
export const SPLASH_BONUS = 150;

export function createRaiders(contract, rng) {
  const list = [];
  const n = contract.raiders ?? 0;
  if (!n) return list;
  const anchor = islandById(contract.to);
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(420, 780);
    list.push({
      id: i,
      x: anchor.x + Math.cos(a) * r, z: anchor.z + Math.sin(a) * r, y: rng.range(210, 300),
      heading: a + Math.PI / 2, pitch: 0, roll: 0,
      speed: 40, hp: RAIDER_HP,
      state: 'loiter',           // loiter -> hunt -> falling -> gone
      anchor: { x: anchor.x, z: anchor.z },
      phase: rng.range(0, Math.PI * 2),
      burstAt: 0, burstUntil: 0, nextBurst: rng.range(1.5, 3.5),
      vx: 0, vy: 0, vz: 0,
    });
  }
  return list;
}

export function nearestRaider(list, plane) {
  let best = null, bestD = Infinity;
  for (const r of list) {
    if (r.state === 'gone' || r.state === 'falling') continue;
    const d = Math.hypot(r.x - plane.x, r.z - plane.z);
    if (d < bestD) { bestD = d; best = r; }
  }
  return best ? { raider: best, dist: bestD } : null;
}

export function liveRaiders(list) {
  return list.filter((r) => r.state === 'loiter' || r.state === 'hunt').length;
}

// Step every raider. `surfaceYAt(x, z)` gives the ground/sea height under a point.
// Events: {type:'down', raider} when a raider is fatally hit and starts to fall,
// {type:'splash', raider} when the fall ends, {type:'player-hit', amount} when a
// burst connects, {type:'raider-fire', raider} when a burst opens (for sound).
export function stepRaiders(list, player, dt, surfaceYAt, t) {
  const events = [];
  for (const r of list) {
    if (r.state === 'gone') continue;
    if (r.hp <= 0 && r.state !== 'falling') {
      r.state = 'falling';
      events.push({ type: 'down', raider: r });
    }
    if (r.state === 'falling') {
      r.pitch += (-0.95 - r.pitch) * Math.min(1, dt * 1.6);
      r.roll += dt * 5.2;
      r.vy = Math.max(r.vy - 26 * dt, -34);
      r.speed = Math.max(r.speed - 9 * dt, 9);
      const fx = Math.sin(r.heading) * Math.cos(r.pitch), fz = -Math.cos(r.heading) * Math.cos(r.pitch);
      r.x += fx * r.speed * dt; r.z += fz * r.speed * dt; r.y += r.vy * dt;
      if (r.y <= surfaceYAt(r.x, r.z) + 1) { r.state = 'gone'; events.push({ type: 'splash', raider: r }); }
      continue;
    }

    const distP = Math.hypot(player.x - r.x, player.z - r.z);
    if (r.state === 'loiter' && !player.onGround && distP < 1500) r.state = 'hunt';

    let aim;
    if (r.state === 'loiter') {
      // circle the anchor island, patient as weather
      const ca = Math.atan2(r.z - r.anchor.z, r.x - r.anchor.x) + dt * 0.12;
      const cr = Math.hypot(r.x - r.anchor.x, r.z - r.anchor.z) || 300;
      aim = { x: r.anchor.x + Math.cos(ca) * cr, z: r.anchor.z + Math.sin(ca) * cr, y: r.y };
    } else {
      // intercept: lead the player by the time a crossing takes
      const lead = clamp(distP / 130, 0, 2.6);
      aim = {
        x: player.x + player.vx * lead, z: player.z + player.vz * lead,
        y: player.y + player.vy * lead * 0.5,
      };
      // weave so a steady hand is still required — and jink hard when the player
      // has the raider in their own sights
      const weaveAmp = distP > 130 ? 46 : 16;
      const px = Math.cos(r.heading), pz = Math.sin(r.heading);
      const w = Math.sin(t * 1.7 + r.phase) * weaveAmp;
      aim.x += px * w; aim.z += pz * w;
    }

    const desired = headingTo(r, aim);
    const err = angDiff(desired, r.heading);
    const turn = clamp(err, -0.52 * dt, 0.52 * dt);
    r.heading += turn;
    r.roll += (clamp(err * 1.4, -0.85, 0.85) - r.roll) * Math.min(1, dt * 3.2);
    // ride toward the aim altitude, never below a safe floor over the surface
    const targetY = Math.max(aim.y, surfaceYAt(r.x, r.z) + 42);
    const climb = clamp((targetY - r.y) * 0.02, -7.5, 7.5);
    r.y += climb * dt;
    r.pitch = clamp(climb / 26, -0.32, 0.32);
    const fx = Math.sin(r.heading) * Math.cos(r.pitch), fz = -Math.cos(r.heading) * Math.cos(r.pitch);
    r.vx = fx * r.speed; r.vz = fz * r.speed; r.vy = climb;
    r.x += r.vx * dt; r.z += r.vz * dt;

    // fire control: bursts only from a firing position — close, and with the
    // player inside the raider's nose cone
    if (r.state === 'hunt' && !player.onGround) {
      r.nextBurst -= dt;
      const toPlayer = headingTo(r, player);
      const cone = Math.abs(angDiff(toPlayer, r.heading));
      if (r.nextBurst <= 0 && distP < 330 && cone < 0.42) {
        r.burstUntil = t + 0.38;
        r.nextBurst = 1.15 + Math.abs(Math.sin(r.phase)) * 0.5;
        events.push({ type: 'raider-fire', raider: r });
        const p = clamp(0.78 - distP / 520, 0.18, 0.62);
        if (Math.sin(t * 12.9898 + r.phase * 78.233) > 1 - p * 2) {
          events.push({ type: 'player-hit', amount: 5 });
        }
      }
    }
  }
  return events;
}
