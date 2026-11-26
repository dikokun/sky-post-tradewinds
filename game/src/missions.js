// The mission engine: one state machine that flies every contract in the book. It
// watches the plane state the flight model produces — take-off, position, touchdown
// grades, the drop key — and turns a contract's data into objectives, a progress line
// for the HUD, and a pay slip with reasons. Rings, drop zones and photo points are
// placed from the sortie's seed, so a contract flies the same course every attempt.

import { islandById, runwayPose, heightAt } from './data/islands.js';
import { makeRng } from './random.js';

export function createSortie(contract, seed) {
  const rng = makeRng(seed);
  const from = islandById(contract.from), to = islandById(contract.to);
  const sortie = {
    contract, from, to, rng,
    phase: 'brief',            // brief -> airborne -> objective -> complete | failed
    tookOff: false, elapsed: 0,
    rings: [], ringIndex: 0,
    photoPasses: 0, photoInside: false,
    dropped: false, dropScore: 0,
    raidersDown: 0,
    visited: new Set([contract.from]),
    landingGrade: null, worstSinkFpm: 0, comfortViolations: 0,
    ashTime: 0, failed: null, result: null,
    target: null,              // {x,y,z} the HUD and autopilot steer toward
  };

  if (contract.type === 'rings') {
    const c = { x: to.x, z: to.z };
    for (let i = 0; i < (contract.rings ?? 8); i++) {
      const a = (i / (contract.rings ?? 8)) * Math.PI * 2;
      sortie.rings.push({
        x: c.x + Math.cos(a) * 620, z: c.z + Math.sin(a) * 620,
        y: 90 + Math.sin(i * 1.7) * 26, passed: false,
      });
    }
    sortie.target = sortie.rings[0];
  } else if (contract.type === 'photo') {
    // the survey band is 549-792 m; Vatu's cone peaks at 690, so the crossing
    // altitude rides at 730 — inside the band, above the rock
    sortie.target = { x: to.x, y: 730, z: to.z };
  } else if (contract.type === 'drop') {
    const a = rng.range(0, Math.PI * 2);
    sortie.target = { x: to.x + Math.cos(a) * 480, z: to.z + Math.sin(a) * 480, y: 0 };
    sortie.target.y = heightAt(sortie.target.x, sortie.target.z);
  } else {
    const pose = runwayPose(to);
    sortie.target = { x: pose.x, y: pose.y, z: pose.z };
  }
  return sortie;
}

// Per-frame update. `input` carries discrete actions ({ dropPressed }). Returns events
// for sound and radio. The pay slip is computed once, at completion.
export function updateSortie(sortie, plane, dt, input, env) {
  const events = [];
  const c = sortie.contract;
  if (sortie.phase === 'complete' || sortie.phase === 'failed') return events;
  sortie.elapsed += dt;

  if (!sortie.tookOff && !plane.onGround) {
    sortie.tookOff = true; sortie.phase = 'airborne';
    events.push({ type: 'took-off' });
  }
  if (c.timed && sortie.tookOff && sortie.elapsed > c.timed) {
    sortie.failed = 'Out of time — the clock ran the sortie, not you.';
    sortie.phase = 'failed'; events.push({ type: 'failed' });
    return events;
  }
  // passenger comfort: steep banks and hard pulls cost the tip
  if (c.gentle && !plane.onGround && (Math.abs(plane.roll) > 0.62 || plane.gForce > 1.75)) {
    sortie.comfortViolations += dt;
  }

  const distTo = (t) => Math.hypot(plane.x - t.x, plane.z - t.z);

  if (c.type === 'rings') {
    const ring = sortie.rings[sortie.ringIndex];
    if (ring) {
      if (ring.mesh) {
        ring.mesh.material.color.set(0xf2a541);
        ring.mesh.lookAt(plane.x, ring.y, plane.z);
      }
      if (distTo(ring) < 34 && Math.abs(plane.y - ring.y) < 30) {
        ring.passed = true; if (ring.mesh) ring.mesh.material.color.set(0x2e933c);
        sortie.ringIndex++; events.push({ type: 'ring', count: sortie.ringIndex });
        const next = sortie.rings[sortie.ringIndex];
        sortie.target = next ?? (() => { const p = runwayPose(sortie.to); return { x: p.x, y: p.y, z: p.z }; })();
      }
    }
  }

  if (c.type === 'photo') {
    const d = distTo(sortie.target);
    const inBand = plane.y > 549 && plane.y < 792;
    const inside = d < 300 && inBand;
    if (inside && !sortie.photoInside) {
      sortie.photoPasses++;
      events.push({ type: 'photo', count: sortie.photoPasses });
      const need = c.id === 'volcano-watch' ? 3 : 1;
      if (sortie.photoPasses >= need) {
        const p = runwayPose(sortie.to);
        sortie.target = { x: p.x, y: p.y, z: p.z };
        sortie.phase = 'objective-done';
      }
    }
    sortie.photoInside = inside;
  }

  if (c.type === 'intercept') {
    const need = c.raiders ?? 0;
    if (sortie.raidersDown >= need && sortie.phase !== 'objective-done') {
      sortie.phase = 'objective-done';
      events.push({ type: 'skies-clear' });
      const p = runwayPose(sortie.to);
      sortie.target = { x: p.x, y: p.y, z: p.z };
    } else if (input.nearestRaider) {
      const r = input.nearestRaider;
      sortie.target = { x: r.x, y: r.y, z: r.z };
    }
  }

  if (c.type === 'drop' && !sortie.dropped && input.dropPressed) {
    const d = distTo(sortie.target);
    if (plane.y - sortie.target.y < 130 && plane.speed < 42) {
      sortie.dropped = true;
      sortie.dropScore = Math.max(0, 1 - d / 220);
      events.push({ type: 'dropped', score: sortie.dropScore });
      const p = runwayPose(sortie.to);
      sortie.target = { x: p.x, y: p.y, z: p.z };
      sortie.phase = 'objective-done';
    } else {
      events.push({ type: 'drop-denied' });
    }
  }

  return events;
}

// Called by the game loop when the plane comes to a stop; decides the sortie.
export function settleSortie(sortie, plane, surface) {
  const c = sortie.contract;
  if (sortie.phase === 'complete' || sortie.phase === 'failed') return null;
  if (!sortie.tookOff) return null;
  const onRunway = surface.onRunway && surface.island;
  const atDest = onRunway && surface.island.id === c.to;
  const atOrigin = onRunway && surface.island.id === c.from;

  if (c.type === 'tour') {
    if (onRunway) sortie.visited.add(surface.island.id);
    if (atDest && sortie.visited.size >= 8) return finish(sortie, plane);
    return null; // keep touring
  }
  if (c.type === 'rings' && sortie.ringIndex < sortie.rings.length) {
    if (atOrigin || atDest) return fail(sortie, `Down with ${sortie.rings.length - sortie.ringIndex} rings unthreaded.`);
    return null;
  }
  if (c.type === 'photo' && sortie.phase !== 'objective-done') {
    if (atDest || atOrigin) return fail(sortie, 'Landed without the photographs. The observatory sends its regards.');
    return null;
  }
  if (c.type === 'drop' && !sortie.dropped) {
    if (atDest || atOrigin) return fail(sortie, 'Landed with the supplies still aboard.');
    return null;
  }
  if (c.type === 'intercept' && sortie.phase !== 'objective-done') {
    if (atDest || atOrigin) return fail(sortie, 'Down with raiders still taxing the Reach. The divers keep paying.');
    return null;
  }
  if (atDest) return finish(sortie, plane);
  if (surface.onWater && c.to === 'motu') return finish(sortie, plane); // the dock accepts a seaplane
  return null;
}

export function failSortie(sortie, reason) { return fail(sortie, reason); }
function fail(sortie, reason) {
  sortie.phase = 'failed'; sortie.failed = reason;
  sortie.result = { ok: false, reason, lines: [], total: 0, rep: 0 };
  return sortie.result;
}

function finish(sortie, plane) {
  const c = sortie.contract;
  const lines = [{ label: `Contract — ${c.name}`, amount: c.pay }];
  let total = c.pay;
  const sinkFpm = Math.round(sortie.worstSinkFpm);
  if (sortie.landingGrade === 'smooth') { lines.push({ label: 'Feather landing bonus', amount: 60 }); total += 60; }
  if (c.gentle && sortie.comfortViolations > 1.2) {
    const lost = Math.round(c.pay * 0.3);
    lines.push({ label: 'Rough handling — tip lost', amount: -lost }); total -= lost;
  }
  if (c.fragile && (sortie.landingGrade === 'hard' || sortie.landingGrade === 'crash')) {
    const lost = Math.round(c.pay * 0.75);
    lines.push({ label: 'Glass bells, delivered as gravel', amount: -lost }); total -= lost;
  }
  if (c.timed && sortie.elapsed < c.timed * 0.75) {
    lines.push({ label: 'Ahead of the clock', amount: 120 }); total += 120;
  }
  if (c.type === 'drop') {
    const bonus = Math.round(240 * sortie.dropScore);
    lines.push({ label: `Drop accuracy ${Math.round(sortie.dropScore * 100)}%`, amount: bonus }); total += bonus;
  }
  if (c.type === 'rings') { lines.push({ label: 'Full course threaded', amount: 140 }); total += 140; }
  if (sortie.raidersDown > 0) {
    const bonus = 150 * sortie.raidersDown;
    lines.push({ label: `Raider${sortie.raidersDown > 1 ? 's' : ''} splashed ×${sortie.raidersDown}`, amount: bonus });
    total += bonus;
  }
  if (plane.damage > 25) {
    lines.push({ label: 'Airframe came home bent (repair is on you)', amount: 0 });
  }
  sortie.phase = 'complete';
  sortie.result = { ok: true, lines, total: Math.max(40, total), rep: c.rep, sinkFpm };
  return sortie.result;
}

// The one line the HUD shows: where to go and how it is going.
export function sortieStatusLine(sortie, plane) {
  const c = sortie.contract;
  if (sortie.phase === 'failed') return { name: c.name, line: sortie.failed, frac: 0 };
  if (sortie.phase === 'complete') return { name: c.name, line: 'Contract complete.', frac: 1 };
  const d = sortie.target ? Math.hypot(plane.x - sortie.target.x, plane.z - sortie.target.z) : 0;
  const km = (d / 1000).toFixed(1);
  let line;
  if (!sortie.tookOff) line = `Take off from ${sortie.from.runway?.name ?? sortie.from.name} — ${c.cargo}`;
  else if (c.type === 'rings') line = sortie.ringIndex < sortie.rings.length
    ? `Ring ${sortie.ringIndex + 1} of ${sortie.rings.length} — ${km} km` : `All rings threaded — land at ${sortie.to.name}`;
  else if (c.type === 'photo') line = sortie.phase === 'objective-done'
    ? `Photographs in the can — land at ${sortie.to.name}` : `Photo pass over ${sortie.to.name} rim, 1,800–2,600 ft — ${km} km`;
  else if (c.type === 'drop') line = sortie.dropped
    ? `Supplies away — land at ${sortie.to.name}` : `Drop zone ${km} km — low, slow, press X`;
  else if (c.type === 'tour') line = `Circuit: ${sortie.visited.size} of 8 islands — next landing anywhere new`;
  else if (c.type === 'intercept') line = sortie.phase === 'objective-done'
    ? `Skies clear — land at ${sortie.to.name}` : `Bandits down: ${sortie.raidersDown} of ${c.raiders ?? 0} — nearest ${km} km`;
  else line = `${c.cargo} → ${sortie.to.name}, ${km} km`;
  if (c.timed && sortie.tookOff) {
    const left = Math.max(0, Math.round(c.timed - sortie.elapsed));
    line += ` · ⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  }
  const frac = c.type === 'rings' ? sortie.ringIndex / (sortie.rings.length + 1)
    : sortie.phase === 'objective-done' ? 0.8 : sortie.tookOff ? 0.45 : 0.08;
  return { name: `${c.name} — ${c.type.toUpperCase()}`, line, frac };
}
