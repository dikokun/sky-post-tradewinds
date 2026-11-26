// The flight model: an arcade-true simulation. Airspeed, lift, stall, coordinated turns,
// ground effect, fuel burn and airframe damage all live here, so the renderer only ever
// draws what this file decides. Pure functions over a plain state object (no rendering
// imports), which is what lets the autopilot and the shot director fly the same plane
// the player does.

import { FLIGHT, WORLD } from './config.js';

export function createPlaneState(aircraft, x, z, heading, groundY) {
  return {
    x, y: groundY, z,
    heading, pitch: 0, roll: 0,
    speed: 0,            // airspeed, m/s along the velocity vector
    vx: 0, vy: 0, vz: 0, // velocity vector, world axes
    throttle: 0,
    groundSpeed: 0,      // scalar roll speed while on a surface (see the contact block)
    gearDown: true, flaps: 0, brakes: false,
    onGround: true, inWater: false,
    fuel: aircraft.fuelCapacity,
    damage: 0,           // 0 sound .. 100 wrecked
    stalled: false, buffet: 0,
    verticalSpeed: 0,
    gForce: 1,
  };
}

// input: { pitch: -1..1 (positive = pull, nose up), roll: -1..1, throttleDelta, rudder }
export function stepPlane(state, aircraft, input, dt, env) {
  const events = [];
  const thrustFactor = 1 - state.damage / 260;         // a bent airframe still flies, worse
  const controlFactor = Math.max(0.45, 1 - state.damage / 160);

  state.throttle = clamp(state.throttle + (input.throttleDelta ?? 0) * dt, 0, 1);

  // --- control response: authority grows with airspeed but never fully vanishes ---
  const authority = clamp(state.speed / aircraft.stallSpeed, 0.25, 1.4) * controlFactor;
  const targetRoll = (input.roll ?? 0) * 1.05;
  state.roll += (targetRoll - state.roll) * Math.min(1, dt * (2.2 + authority * 2.4));
  state.pitch += (input.pitch ?? 0) * dt * 0.85 * authority;
  state.pitch = clamp(state.pitch, -0.42, 0.38);
  // a parked plane settles level, but a pilot rotating at speed wins against it
  if (state.onGround) { state.pitch *= Math.pow(0.08, dt); state.roll *= Math.pow(0.02, dt); }

  // --- coordinated turn: bank bends the heading, more bank at low speed turns tighter ---
  // (heading runs compass-wise — 0 north, +east — so a right bank increases it)
  if (!state.onGround) {
    const turnRate = (FLIGHT.gravity * Math.tan(clamp(state.roll, -1.2, 1.2))) / Math.max(state.speed, 12);
    state.heading += turnRate * dt;
    // banking costs lift: the nose drops unless the pilot holds back-pressure
    state.pitch -= Math.abs(state.roll) * 0.055 * dt;
  }

  // --- forces ---
  const fwd = forwardVector(state.heading, state.pitch);
  const thrust = aircraft.maxThrust * state.throttle * thrustFactor * (state.fuel > 0 ? 1 : 0);
  const speedSq = state.speed * state.speed;
  // (braking itself is applied in the contact block, where it can only slow the
  // roll — as a force here it would push a parked plane backwards)
  const drag = aircraft.dragCoef * speedSq * (state.flaps ? 1.55 : 1) * (state.gearDown ? 1.3 : 1);
  const accel = (thrust - drag) / aircraft.mass;

  // velocity chases the nose direction as lift allows; a stall lets gravity win
  const liftAuthority = state.speed >= aircraft.stallSpeed
    ? clamp(0.9 + (state.speed - aircraft.stallSpeed) / 40, 0.9, 2.6)
    : clamp(state.speed / aircraft.stallSpeed, 0.06, 0.5);
  state.stalled = !state.onGround && state.speed < aircraft.stallSpeed * FLIGHT.stallMargin;
  state.buffet = state.stalled ? clamp(1 - state.speed / (aircraft.stallSpeed * FLIGHT.stallMargin), 0.2, 1) : 0;

  let vx = state.vx, vy = state.vy, vz = state.vz;
  const targetVx = fwd.x * state.speed, targetVy = fwd.y * state.speed, targetVz = fwd.z * state.speed;
  const chase = Math.min(1, liftAuthority * dt * 2.1);
  vx += (targetVx - vx) * chase; vy += (targetVy - vy) * chase; vz += (targetVz - vz) * chase;
  // lift carries the weight as speed builds: gravity bites in full only near a stall,
  // and banking spills lift, so a steep turn sinks unless the pilot holds it up
  const liftFrac = clamp(state.speed / (aircraft.stallSpeed * 1.6), 0, 1) * Math.cos(clamp(state.roll, -1.2, 1.2));
  vy -= FLIGHT.gravity * dt * (state.onGround ? 0 : 1 - liftFrac * 0.92);
  vx += fwd.x * accel * dt; vy += fwd.y * accel * dt; vz += fwd.z * accel * dt;

  // wind: gusts push the whole vector; a headwind is free airspeed. On the ground
  // the airframe is parked and braked — the wind does not drag it across the field.
  if (!state.onGround) {
    vx += (env.windX ?? 0) * dt * 0.35; vz += (env.windZ ?? 0) * dt * 0.35;
    vy += (env.gust ?? 0) * dt;
  }

  // ground effect: a cushion of lift in the last metres over a surface
  const surfaceY = env.surfaceY;
  const heightAboveSurface = state.y - surfaceY;
  if (!state.onGround && heightAboveSurface < FLIGHT.groundEffectHeight && vy < 0) {
    vy *= Math.pow(0.35, dt * (1 - heightAboveSurface / FLIGHT.groundEffectHeight));
  }
  if (state.y > WORLD.ceiling) vy -= (state.y - WORLD.ceiling) * dt * 0.4;

  state.vx = vx; state.vy = vy; state.vz = vz;
  state.speed = Math.hypot(vx, vy, vz);
  state.verticalSpeed = vy;
  state.gForce = 1 + Math.abs(state.roll) * (state.stalled ? 0 : 0.55);

  state.x += vx * dt; state.y += vy * dt; state.z += vz * dt;
  state.x = clamp(state.x, -WORLD.size / 2, WORLD.size / 2);
  state.z = clamp(state.z, -WORLD.size / 2, WORLD.size / 2);

  // --- fuel ---
  if (state.fuel > 0) {
    const burn = aircraft.fuelBurnPerSec * (0.25 + state.throttle * 1.15) * dt;
    state.fuel = Math.max(0, state.fuel - burn);
    if (state.fuel === 0) events.push({ type: 'fuel-empty' });
  }

  // --- contact ---
  const wasAirborne = !state.onGround;
  if (state.y <= surfaceY + 0.02) {
    const sink = -vy;
    if (vy <= 0.05) state.y = surfaceY; // a rotating plane is allowed to float free
    if (env.onRunway || env.onWater) {
      if (wasAirborne) {
        const grade = gradeTouchdown(state, aircraft, sink, env);
        events.push({ type: 'touchdown', grade, sink, onWater: !!env.onWater });
        if (grade === 'crash') { state.damage = 100; events.push({ type: 'crashed', reason: env.onWater ? 'water' : 'ground' }); }
        else if (grade === 'hard') state.damage = Math.min(100, state.damage + 16 + sink * 2);
        else if (grade === 'firm') state.damage = Math.min(100, state.damage + 4);
      }
      state.onGround = true; state.inWater = !!env.onWater;
      state.vy = 0;
      // rolling: ground speed is a scalar integrated from the same thrust and drag —
      // projecting the 3D velocity onto the heading every frame would bleed speed
      // whenever the nose is up, and a taking-off plane would never rotate away.
      // Only the touchdown frame itself takes the velocity's forward component.
      const wasMoving = state.speed > 0.5;
      let rollSpeed = wasAirborne
        ? Math.max(0, vx * fwd.x + vz * fwd.z)
        : Math.max(0, state.groundSpeed + accel * dt);
      if (state.brakes) rollSpeed = Math.max(0, rollSpeed - 26 * dt);
      state.groundSpeed = rollSpeed;
      state.speed = rollSpeed;
      state.vx = fwd.x * rollSpeed; state.vz = fwd.z * rollSpeed;
      if (state.speed < 0.4 && state.throttle < 0.05) {
        state.speed = 0; state.vx = state.vz = 0;
        if (wasMoving) events.push({ type: 'stopped' });
      }
    } else if (wasAirborne || state.speed > FLIGHT.crashSpeed * 0.5) {
      state.damage = 100;
      events.push({ type: 'crashed', reason: 'terrain' });
      state.onGround = true;
    }
  } else if (state.y > surfaceY + 0.4) {
    if (state.onGround && state.speed > 0) events.push({ type: 'liftoff' });
    state.onGround = false; state.inWater = false;
  }

  return events;
}

function gradeTouchdown(state, aircraft, sink, env) {
  if (env.onWater && !aircraft.floats) return 'crash';
  if (sink > FLIGHT.crashSink) return 'crash';
  if (!env.onWater && !state.gearDown && !aircraft.floats) return 'crash'; // belly landing on land
  if (sink > FLIGHT.hardLandingSink) return 'hard';
  if (sink > 2.1) return 'firm';
  return 'smooth';
}

export function forwardVector(heading, pitch) {
  const cp = Math.cos(pitch);
  return { x: Math.sin(heading) * cp, y: Math.sin(pitch), z: -Math.cos(heading) * cp };
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const msToKnots = (ms) => ms * 1.94384;
export const mToFeet = (m) => m * 3.28084;
