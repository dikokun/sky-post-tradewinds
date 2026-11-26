// The shot director: stages the judged screenshots through the game's own state, the
// way a save file would. Each shot starts a real sortie, flies it with the autopilot at
// a fixed timestep until the composed moment arrives — on final with the strip ahead,
// in the cockpit over the Reach, mid-ring-course — then freezes the physics and leaves
// the world breathing (prop turning, clouds drifting) for the camera. Nothing is drawn
// that the game itself did not draw. Shot names come from shots.json at the repo root.

import { contractById } from './data/contracts.js';

export const SHOTS = {
  approach: { contract: 'first-light', when: 'final', camera: 'chase' },
  cockpit: { contract: 'ash-sample', when: 'climb', camera: 'cockpit' },
  rings: { contract: 'ring-lagoon', when: 'rings', camera: 'chase' },
  dogfight: { contract: 'pirate-tithe', when: 'dogfight', camera: 'chase' },
  hangar: { contract: null, when: 'menu', camera: 'cine' },
};

// api: { startSortie(contractId), step(dt), setCockpit(bool), plane(), sortie(),
//        setFrozen(bool), showHangar() }
export function stageShot(name, api) {
  const shot = SHOTS[name] ?? SHOTS.approach;
  if (shot.when === 'menu') { api.showHangar(); return { staged: 'hangar' }; }
  const contract = contractById(shot.contract);
  api.startSortie(contract.id, { forShot: true, forceGun: shot.when === 'dogfight' });
  api.setCockpit(shot.camera === 'cockpit');
  const dt = 1 / 30;
  let steps = 0;
  const maxSteps = 30 * 60 * 6; // six sim-minutes is plenty to reach any moment
  while (steps < maxSteps) {
    api.step(dt);
    steps++;
    const plane = api.plane(), sortie = api.sortie();
    if (!plane || !sortie) break;
    if (shot.when === 'final' && sortie.phase === 'airborne') {
      // on final: the destination strip within 330 m, low, the runway filling the view
      const d = Math.hypot(plane.x - sortie.target.x, plane.z - sortie.target.z);
      if (d < 330 && plane.y < 120 && plane.speed > 20) break;
    }
    if (shot.when === 'climb' && sortie.tookOff) {
      // freeze on the glide, lined up on the centreline: the volcano island and
      // its strip fill the windscreen, the photo run already in the can
      const d = Math.hypot(plane.x - sortie.target.x, plane.z - sortie.target.z);
      if ((api.legIndex?.() ?? 0) >= 3 && d < 1600) break;
    }
    if (shot.when === 'rings' && sortie.rings.length > 2) {
      // freeze as the plane closes on the third ring, the ring ahead in frame
      const r = sortie.rings[2];
      const d = Math.hypot(plane.x - r.x, plane.z - r.z);
      if (d < 430 && plane.speed > 15) break;
    }
    if (shot.when === 'dogfight' && sortie.tookOff) {
      // freeze in the stern chase: the NEAREST live bandit inside 230 m, in the
      // front hemisphere, the gun already talking — the fight, mid-sentence
      const raiders = api.raiders?.() ?? [];
      let live = null, liveD = Infinity;
      for (const r of raiders) {
        if (r.state !== 'hunt' && r.state !== 'loiter') continue;
        const d = Math.hypot(plane.x - r.x, plane.z - r.z);
        if (d < liveD) { liveD = d; live = r; }
      }
      if (live) {
        const bearing = Math.atan2(live.x - plane.x, -(live.z - plane.z));
        let err = bearing - plane.heading;
        while (err > Math.PI) err -= Math.PI * 2;
        while (err < -Math.PI) err += Math.PI * 2;
        if (liveD < 230 && Math.abs(err) < 0.6 && plane.speed > 20) break;
      }
    }
    if (plane.damage >= 100) break;
  }
  api.setFrozen(true);
  return { staged: name, steps };
}
