// The autopilot: a competent house pilot that writes the same input struct the
// keyboard does. It flies a plan of legs — take off, climb, cruise to a point, line up
// on a runway, flare, roll out — by steering heading with bank, altitude with pitch
// and speed with throttle. The shot director flies whole sorties with it so the judged
// screenshots show a game being played, and the hangar's backdrop flight uses it too.

import { clamp, msToKnots } from './flightModel.js';
import { runwayPose, heightAt } from './data/islands.js';

const headingTo = (from, to) => Math.atan2(to.x - from.x, -(to.z - from.z));
const angDiff = (a, b) => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

// Build a plan: an array of legs {x, z, alt, speed, until} plus a final landing leg.
export function planFlight(fromIsland, toIsland, aircraft, cruiseAlt = 300) {
  const from = runwayPose(fromIsland), dest = runwayPose(toIsland);
  const legs = [];
  // climb-out: a point past the departure end, already turning toward the destination
  const depDir = { x: Math.sin(from.heading), z: -Math.cos(from.heading) };
  legs.push({ x: from.x + depDir.x * 1500, z: from.z + depDir.z * 1500, alt: from.y + 130, speed: aircraft.stallSpeed * 1.7, kind: 'climb' });
  // cruise: fly to the destination's approach fix, still at cruise altitude
  legs.push({ x: dest.x - Math.sin(dest.heading) * 1700, z: dest.z + Math.cos(dest.heading) * 1700, alt: cruiseAlt, speed: aircraft.stallSpeed * 2.6, kind: 'cruise' });
  // approach fix: aligned with the strip, 2.6 km out, 120 m above it
  legs.push({ x: dest.x - Math.sin(dest.heading) * 1700, z: dest.z + Math.cos(dest.heading) * 1700, alt: dest.y + 120, speed: aircraft.stallSpeed * 1.4, kind: 'approach' });
  // glide: aim at the threshold, not the centre — the strip is met at its near end
  const thX = dest.x - Math.sin(dest.heading) * (dest.length / 2 - 70);
  const thZ = dest.z + Math.cos(dest.heading) * (dest.length / 2 - 70);
  legs.push({ x: thX, z: thZ, alt: dest.y, speed: aircraft.stallSpeed * 1.3, kind: 'glide', runway: dest });
  legs.push({ x: dest.x, z: dest.z, alt: dest.y, speed: aircraft.stallSpeed * 1.25, kind: 'final', runway: dest });
  return { legs, dest };
}

// A ring-course plan: climb out, thread each ring in order as a waypoint at the
// ring's own altitude, then join the normal landing plan for the home strip.
export function planRingCourse(sortie, island, aircraft) {
  const landing = planFlight(island, island, aircraft);
  const legs = [landing.legs[0]];
  for (const ring of sortie.rings) {
    legs.push({ x: ring.x, z: ring.z, alt: ring.y, speed: aircraft.stallSpeed * 2.0, kind: 'ring' });
  }
  legs.push(...landing.legs.slice(2));
  return { legs, dest: landing.dest };
}

// A photo plan: climb out, cross the rim point in the survey band as many times as
// the contract demands (swinging out to a side point between passes so each entry
// counts), then join the landing plan for the destination strip.
export function planPhotoCourse(sortie, fromIsland, toIsland, aircraft) {
  const landing = planFlight(fromIsland, toIsland, aircraft);
  const t = sortie.target;
  const need = sortie.contract.id === 'volcano-watch' ? 3 : 1;
  const dx = t.x - fromIsland.x, dz = t.z - fromIsland.z;
  const len = Math.hypot(dx, dz) || 1;
  const px = -dz / len, pz = dx / len;
  const legs = [landing.legs[0]];
  for (let i = 0; i < need; i++) {
    if (i > 0) {
      const s = i % 2 ? 1 : -1;
      legs.push({ x: t.x + px * 700 * s, z: t.z + pz * 700 * s, alt: t.y, speed: aircraft.stallSpeed * 2.3, kind: 'photo' });
    }
    legs.push({ x: t.x, z: t.z, alt: t.y, speed: aircraft.stallSpeed * 2.3, kind: 'photo' });
  }
  legs.push(...landing.legs.slice(2));
  return { legs, dest: landing.dest };
}

// An intercept plan: climb out, then a chase leg whose target the conductor keeps
// moving onto the nearest live raider, then the normal landing plan once the sky
// is clear (the conductor calls skipTo('approach') when the last bandit falls).
export function planInterceptCourse(sortie, fromIsland, toIsland, aircraft) {
  const landing = planFlight(fromIsland, toIsland, aircraft);
  const legs = [landing.legs[0],
    { x: toIsland.x, z: toIsland.z, alt: 260, speed: aircraft.stallSpeed * 2.5, kind: 'chase' },
    ...landing.legs.slice(2)];
  return { legs, dest: landing.dest };
}

export function makeAutopilot(plan, aircraft) {
  let legIndex = 0;
  let hasAirborne = false;
  let legTime = 0;
  let bestDist = Infinity;
  let stuckTime = 0;
  return {
    get legIndex() { return legIndex; },
    get done() { return legIndex >= plan.legs.length; },
    // move the chase leg onto a live target (intercept flying)
    retarget(x, z, alt) {
      const leg = plan.legs[legIndex];
      if (leg && leg.kind === 'chase') { leg.x = x; leg.z = z; leg.alt = alt; }
    },
    // jump forward to the first leg of a kind (the sky just cleared — go land)
    skipTo(kind) {
      const i = plan.legs.findIndex((l, j) => j >= legIndex && l.kind === kind);
      if (i >= 0) { legIndex = i; legTime = 0; bestDist = Infinity; stuckTime = 0; }
    },
    input(state, dt) {
      const input = { pitch: 0, roll: 0, throttleDelta: 0 };
      const leg = plan.legs[legIndex];
      if (!leg) { input.throttleDelta = -1; if (state.onGround) input.brakes = true; return input; }
      if (!state.onGround) hasAirborne = true;
      legTime += dt;

      if (state.onGround) {
        // ground on a glide/final leg after having flown means roll-out and stop;
        // ground before the first liftoff means the take-off roll
        if (hasAirborne && (leg.kind === 'final' || leg.kind === 'glide')) {
          input.throttleDelta = state.speed > 2 ? -1 : 0;
          input.brakes = true;
          if (state.speed < 0.5) legIndex = plan.legs.length;
          return input;
        }
        input.throttleDelta = 1;
        if (state.speed > aircraft.stallSpeed * 1.12) input.pitch = 0.55;
        return input;
      }

      const dist = Math.hypot(leg.x - state.x, leg.z - state.z);
      // stuck detection: a waypoint inside the turn radius can be orbited forever,
      // but a long honest leg keeps closing — only abandon a leg that has stopped
      // closing (or one that has run five minutes, as a backstop)
      if (dist < bestDist - 2) { bestDist = dist; stuckTime = 0; } else stuckTime += dt;
      // glide and final resolve on the ground or not at all — never abandoned.
      // Approach keeps the stuck escape (its fix can be orbited like any waypoint)
      // but not the clock: a long honest approach is still an approach. A chase
      // leg is never abandoned either: a stern chase can run minutes without the
      // range closing, and the conductor ends it when the sky clears.
      const abandonable = leg.kind !== 'glide' && leg.kind !== 'final' && leg.kind !== 'chase';
      if (abandonable && (stuckTime > 12 || (legTime > 300 && leg.kind !== 'approach'))) {
        legIndex++; legTime = 0; bestDist = Infinity; stuckTime = 0;
        return input;
      }
      // on glide and final, steer to a carrot on the runway centreline ahead of
      // the plane, not at the strip centre: point-pursuit lets a crosswind drift
      // stand all the way to the ground, a centreline carrot kills it continuously
      let aim = leg;
      if (leg.runway && (leg.kind === 'glide' || leg.kind === 'final')) {
        const rw = leg.runway;
        const dx = state.x - rw.x, dz = state.z - rw.z;
        const along = dx * Math.sin(rw.heading) - dz * Math.cos(rw.heading);
        const ahead = along + (leg.kind === 'glide' ? 260 : 130);
        aim = { x: rw.x + Math.sin(rw.heading) * ahead, z: rw.z - Math.cos(rw.heading) * ahead };
      }
      const desired = headingTo(state, aim);
      const err = angDiff(desired, state.heading);
      input.roll = clamp(err * (leg.kind === 'glide' || leg.kind === 'final' ? 2.2 : 1.5), -0.72, 0.72);
      // pitch toward the leg altitude: aim at a climb/descent rate proportional to
      // error. On the glide the target altitude rides a 3.5-degree slope above the
      // threshold, so the plane descends along a line instead of levelling early and
      // dragging through the terrain shoulder before the strip. On approach and
      // glide the target also respects a terrain floor — a pure-pursuit line to
      // the threshold can cut across a volcano flank below its surface.
      let targetAlt = leg.kind === 'glide' ? leg.alt + dist * 0.11 : leg.alt;
      if ((leg.kind === 'glide' || leg.kind === 'approach') && dist > 400) {
        targetAlt = Math.max(targetAlt, heightAt(state.x, state.z) + 55);
      }
      // a climb-out that points at a hillside rides over it, not into it
      if (leg.kind === 'climb') targetAlt = Math.max(targetAlt, heightAt(state.x, state.z) + 55);
      const altErr = targetAlt - state.y;
      let targetVs = leg.kind === 'glide' ? clamp(altErr * 0.14, -4.2, 3) : clamp(altErr * 0.14, -5.2, 6.5);
      // energy management: drag alone will not slow a descending plane, so an
      // overspeed is traded for altitude — pitch up and let the speed bleed off
      // instead of arriving on final at cruise speed
      if (state.speed > leg.speed + 3) {
        targetVs = Math.max(targetVs, Math.min(4, (state.speed - leg.speed) * 0.3));
      }
      input.pitch = clamp((targetVs - state.verticalSpeed) * 0.16, -0.75, 0.8);
      // throttle toward the leg speed — the flare cut comes late and short, so the
      // plane crosses the threshold still flying, not mushing in on ground effect
      const spdErr = leg.speed - state.speed;
      input.throttleDelta = (leg.kind === 'final' && dist < 150) ? -1 : clamp(spdErr * 0.05, -0.7, 0.7);

      let reached = false;
      if (leg.kind === 'chase') reached = false; // flown until the conductor says the sky is clear
      else if (leg.kind === 'ring') reached = dist < 60;
      else if (leg.kind === 'approach') reached = dist < 170 && Math.abs(altErr) < 70;
      else if (leg.kind === 'glide') reached = dist < 60;
      // the final leg is flown to the ground, never abandoned on proximity:
      // it ends in the roll-out branch once the wheels are down
      else if (leg.kind === 'final') reached = dist < 90 && state.y - leg.alt < 3;
      else if (leg.kind === 'photo') reached = dist < 120;
      else reached = dist < 430;
      if (reached) { legIndex++; legTime = 0; bestDist = Infinity; stuckTime = 0; }
      return input;
    },
  };
}

export { headingTo, angDiff };
