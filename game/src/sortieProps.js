// The visible furniture of a sortie: the ring course as golden torus gates, the drop
// zone as a signal-red disc on the ground, the photo point as a soft beacon column over
// the volcano rim. Built from the sortie the mission engine created, removed when the
// sortie ends. The engine itself stays logic-only; this file is only its paint.

import * as THREE from 'three';

export function buildSortieProps(sortie, scene) {
  const group = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xf2a541, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
  const ringGeo = new THREE.TorusGeometry(26, 2.2, 8, 28);
  for (const ring of sortie.rings) {
    const m = new THREE.Mesh(ringGeo, ringMat.clone());
    m.position.set(ring.x, ring.y, ring.z);
    group.add(m); ring.mesh = m;
  }
  if (sortie.contract.type === 'drop') {
    const zone = new THREE.Mesh(new THREE.CircleGeometry(55, 24),
      new THREE.MeshBasicMaterial({ color: 0xe4572e, transparent: true, opacity: 0.55 }));
    zone.rotation.x = -Math.PI / 2;
    zone.position.set(sortie.target.x, sortie.target.y + 1.2, sortie.target.z);
    group.add(zone);
  }
  if (sortie.contract.type === 'photo') {
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(30, 46, 320, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xf2a541, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
    beacon.position.set(sortie.target.x, sortie.target.y - 120, sortie.target.z);
    group.add(beacon);
  }
  scene.add(group);
  return group;
}
