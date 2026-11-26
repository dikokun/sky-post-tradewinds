// Two cameras, one job each. The chase camera sits behind and above the tail, eased so
// it never fights the pilot: it follows the heading with lag, banks a fraction of the
// plane's roll, and looks through the turn. The cockpit camera sits at the pilot's head
// and pairs with the instrument panel overlay. A third, cinematic camera serves the
// shot director and the hangar backdrop.

import * as THREE from 'three';
import { clamp } from './flightModel.js';

export function makeCameras(camera) {
  const chasePos = new THREE.Vector3(0, 300, 900);
  let cockpit = false;
  return {
    get cockpit() { return cockpit; },
    toggle() { cockpit = !cockpit; return cockpit; },
    setCockpit(v) { cockpit = v; },
    update(state, dt) {
      if (cockpit) {
        const fx = Math.sin(state.heading), fz = -Math.cos(state.heading);
        camera.position.set(state.x + fx * 1.2, state.y + 3.85, state.z + fz * 1.2);
        camera.rotation.order = 'YXZ';
        // a touch of down-tilt so the cowling and the horizon share the frame
        camera.rotation.set(state.pitch * 0.85 - 0.07, -state.heading, -state.roll * 0.85);
        camera.fov = 62;
      } else {
        const back = 26, up = 8.5;
        const fx = Math.sin(state.heading), fz = -Math.cos(state.heading);
        const target = new THREE.Vector3(state.x - fx * back, state.y + 2 + up, state.z - fz * back);
        const k = Math.min(1, dt * (state.onGround ? 9 : 3.6));
        chasePos.lerp(target, k);
        camera.position.copy(chasePos);
        camera.rotation.order = 'YXZ';
        const look = new THREE.Vector3(state.x + fx * 30, state.y + 2.5, state.z + fz * 30);
        camera.lookAt(look);
        camera.rotation.z += -state.roll * 0.34;
        camera.fov = 58 + clamp(state.speed * 0.06, 0, 7);
      }
      camera.updateProjectionMatrix();
    },
    // fixed cinematic pose for staged frames: position, look target
    pose(px, py, pz, lx, ly, lz) {
      camera.position.set(px, py, pz);
      camera.lookAt(lx, ly, lz);
      camera.fov = 55;
      camera.updateProjectionMatrix();
    },
  };
}
