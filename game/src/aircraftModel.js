// The three aircraft as procedural meshes: fuselage, wing, tail, floats or gear, and a
// spinning propeller, built from primitives in each plane's own silhouette — high-wing
// Minnow on floats, twin-boom Packhorse with a cargo box, low-wing Needle with a pointed
// spinner. No model files; the shapes are the game's own. Control surfaces move with
// the pilot's inputs so the plane reads flown, not parked.

import * as THREE from 'three';

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}
function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, axis = 'y') {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 10), mat);
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}

export function buildAircraftMesh(aircraft) {
  const paint = new THREE.MeshLambertMaterial({ color: aircraft.colour });
  const accent = new THREE.MeshLambertMaterial({ color: aircraft.accent });
  const dark = new THREE.MeshLambertMaterial({ color: 0x22282c });
  const glass = new THREE.MeshPhongMaterial({ color: 0x9fd4e8, shininess: 160, specular: 0xffffff });
  const g = new THREE.Group();
  const parts = {};

  if (aircraft.id === 'minnow') {
    g.add(cyl(0.85, 1.05, 7.6, paint, 0, 0, 0, 'z'));                       // fuselage
    g.add(cyl(0.2, 0.85, 2.6, paint, 0, 0.15, -4.9, 'z'));                  // tail cone
    const wing = box(10.6, 0.28, 1.7, accent, 0, 1.15, 0.4); g.add(wing);  // high wing
    g.add(box(3.4, 0.2, 1.1, accent, 0, 0.55, -6.1));                       // tailplane
    g.add(box(0.2, 1.6, 1.2, accent, 0, 1.2, -6.1));                        // fin
    const canopy = box(1.5, 0.8, 2.2, glass, 0, 0.95, 1.15); g.add(canopy);
    for (const s of [-1, 1]) {                                             // floats
      const float = cyl(0.42, 0.42, 5.6, accent, s * 1.5, -1.85, 0.2, 'z');
      float.geometry = new THREE.CylinderGeometry(0.42, 0.3, 5.6, 8);
      g.add(float);
      g.add(box(0.14, 1.1, 0.14, dark, s * 1.5, -1.05, 1.1));
      g.add(box(0.14, 1.1, 0.14, dark, s * 1.5, -1.05, -0.9));
    }
    parts.prop = propGroup(dark, 3.4); parts.prop.position.set(0, 0, 3.95); g.add(parts.prop);
    parts.elevator = wing; // wing stands in for surface animation on the trainer
  } else if (aircraft.id === 'packhorse') {
    g.add(box(2.9, 2.7, 9.6, paint, 0, 0.2, 0));                           // cargo box body
    g.add(cyl(1.35, 1.35, 1.8, paint, 0, 0.35, 5.4, 'z'));                 // nose
    const wing = box(13.4, 0.34, 2.0, accent, 0, 1.75, 0.8); g.add(wing);
    for (const s of [-1, 1]) {
      g.add(cyl(0.62, 0.62, 3.4, dark, s * 2.6, 1.55, 1.6, 'z'));          // engine nacelles
      const p = propGroup(dark, 3.1); p.position.set(s * 2.6, 1.55, 3.5); g.add(p);
      (parts.props ??= []).push(p);
      g.add(box(0.24, 0.24, 6.4, paint, s * 2.4, 0.9, -7.4));              // tail booms
      const wheel = cyl(0.62, 0.62, 0.4, dark, s * 1.7, -1.8, 1.4, 'x'); g.add(wheel);
    }
    g.add(box(5.6, 0.24, 1.4, accent, 0, 1.5, -10.4));                      // tailplane
    g.add(box(1.6, 0.9, 1.8, glass, 0, 1.15, 4.6));                        // cockpit glass
    const noseWheel = cyl(0.5, 0.5, 0.35, dark, 0, -1.9, 4.4, 'x'); g.add(noseWheel);
    parts.prop = parts.props[0];
  } else { // needle
    g.add(cyl(0.62, 0.95, 8.4, paint, 0, 0, 0, 'z'));
    g.add(cyl(0.12, 0.6, 2.8, paint, 0, 0.1, -5.4, 'z'));
    const wing = box(9.2, 0.22, 1.5, accent, 0, -0.55, -0.4); g.add(wing); // low wing
    g.add(box(3.0, 0.18, 1.0, accent, 0, 0.4, -6.6));
    g.add(box(0.18, 1.5, 1.1, accent, 0, 1.05, -6.6));
    const canopy = cyl(0.55, 0.62, 2.4, glass, 0, 0.62, 0.9, 'z'); g.add(canopy);
    parts.prop = propGroup(dark, 3.0); parts.prop.position.set(0, 0, 4.35); g.add(parts.prop);
    parts.gear = new THREE.Group();
    for (const s of [-1, 1]) parts.gear.add(cyl(0.4, 0.4, 0.3, dark, s * 1.4, -1.25, 0.4, 'x'));
    parts.gear.add(cyl(0.32, 0.32, 0.26, dark, 0, -1.15, 3.1, 'x'));
    g.add(parts.gear);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return { group: g, parts };
}

function propGroup(mat, diameter) {
  const p = new THREE.Group();
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x565e63 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, diameter, 0.04), bladeMat);
  const blade2 = blade.clone(); blade2.rotation.z = Math.PI / 2;
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), mat);
  // a faint disc so a spinning prop reads as a blur, not a pair of planks
  const disc = new THREE.Mesh(new THREE.CircleGeometry(diameter / 2, 24),
    new THREE.MeshBasicMaterial({ color: 0x2a3136, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
  p.add(blade, blade2, hub, disc);
  return p;
}

// Pose the mesh from the flight state each frame; spin the prop with throttle and speed.
// The meshes are built nose-toward +z; the world forward is (sin h, -cos h), so the
// yaw that puts the nose on the flight direction is PI - heading.
export function poseAircraft(mesh, parts, state, t) {
  mesh.position.set(state.x, state.y + 1.9, state.z);
  mesh.rotation.order = 'YXZ';
  mesh.rotation.y = Math.PI - state.heading;
  mesh.rotation.x = -state.pitch;
  mesh.rotation.z = state.roll;
  if (state.buffet > 0) {
    mesh.position.y += Math.sin(t * 61) * 0.09 * state.buffet;
    mesh.rotation.z += Math.sin(t * 53) * 0.012 * state.buffet;
  }
  const spin = 4 + state.throttle * 46 + state.speed * 0.22;
  if (parts.prop) parts.prop.rotation.z += spin * 0.016;
  if (parts.props) for (const p of parts.props) p.rotation.z += spin * 0.016;
  if (parts.gear) parts.gear.visible = state.gearDown;
}
