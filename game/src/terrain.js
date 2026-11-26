// The world mesh: one heightfield for the whole Reach, coloured by height and slope,
// an ocean that catches the light, airstrips with markings and edge lights, trees and
// harbour buildings for scale, the volcano's ash plume, and drifting cloud. Everything
// is procedural — no image or model files — and the heights come from the same
// heightAt() the flight model lands on.

import * as THREE from 'three';
import { ISLANDS, heightAt, runwayPose } from './data/islands.js';
import { TIMES } from './weather.js';
import { makeRng } from './random.js';

export function buildWorld(scene, seed) {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  scene.add(group);

  // --- lights and sky ---
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x3a5f4a, 0.9);
  const sun = new THREE.DirectionalLight(0xfff3dd, 1.6);
  sun.position.set(3000, 4200, -1800);
  group.add(hemi, sun);

  // --- ocean ---
  const oceanMat = new THREE.MeshPhongMaterial({ color: 0x14607a, shininess: 140, specular: 0x99d4e8 });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(15000, 15000), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -0.4;
  group.add(ocean);

  // --- terrain heightfield ---
  const SEG = 190, SIZE = 9800;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = [];
  const cSand = new THREE.Color(0xe6d29a), cGrass = new THREE.Color(0x5d9c59),
    cJungle = new THREE.Color(0x2e6b46), cRock = new THREE.Color(0x8a7f72),
    cAsh = new THREE.Color(0x5c564e), cSea = new THREE.Color(0x1a6a86);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    let c;
    if (h < 0.5) c = cSea.clone().lerp(cSand, Math.max(0, (h + 6) / 7));
    else if (h < 1.4) c = cSand;
    else if (h < 60) c = cGrass.clone().lerp(cJungle, Math.min(1, h / 60));
    else if (h < 300) c = cJungle.clone().lerp(cRock, (h - 60) / 240);
    else c = cRock.clone().lerp(cAsh, Math.min(1, (h - 300) / 380));
    colours.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  group.add(terrain);

  // --- airstrips ---
  const stripMats = { paved: 0x4a4d52, gravel: 0x9a8a76, grass: 0x679c4e, sand: 0xe0cd96, rock: 0x7d7468 };
  const edgeLights = [];
  for (const isl of ISLANDS) {
    const pose = runwayPose(isl);
    const strip = new THREE.Group();
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(isl.runway.width, 0.6, isl.runway.length),
      new THREE.MeshLambertMaterial({ color: stripMats[isl.runway.surface] }));
    deck.position.y = 0.3;
    strip.add(deck);
    // centreline dashes and threshold bars, drawn as thin white boxes
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf6ecd7 });
    for (let d = -isl.runway.length / 2 + 30; d < isl.runway.length / 2 - 20; d += 44) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.15, 16), dashMat);
      dash.position.set(0, 0.68, d);
      strip.add(dash);
    }
    for (const end of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(isl.runway.width * 0.7, 0.15, 3), dashMat);
      bar.position.set(0, 0.68, end * (isl.runway.length / 2 - 8));
      strip.add(bar);
    }
    // edge lights: small warm spheres, lit at dusk and night
    const lightGeo = new THREE.SphereGeometry(0.9, 6, 6);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffca7a });
    for (let d = -isl.runway.length / 2; d <= isl.runway.length / 2; d += 60) {
      for (const side of [-1, 1]) {
        const bulb = new THREE.Mesh(lightGeo, lightMat);
        bulb.position.set(side * (isl.runway.width / 2 + 2.4), 1.1, d);
        strip.add(bulb); edgeLights.push(bulb);
      }
    }
    strip.position.set(pose.x, pose.y, pose.z);
    strip.rotation.y = -pose.heading;
    group.add(strip);
  }

  // --- trees: instanced cones on the low slopes ---
  const treeGeo = new THREE.ConeGeometry(7, 22, 6);
  const treeMat = new THREE.MeshLambertMaterial({ color: 0x2c6e3f });
  const trunkGeo = new THREE.CylinderGeometry(1.2, 1.6, 7, 5);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const spots = [];
  for (const isl of ISLANDS) {
    for (let i = 0; i < 260 && spots.length < 1500; i++) {
      const a = rng.range(0, Math.PI * 2), r = rng.range(60, isl.radius * 0.92);
      const x = isl.x + Math.cos(a) * r, z = isl.z + Math.sin(a) * r;
      const h = heightAt(x, z);
      if (h > 4 && h < 190) spots.push({ x, z, h, s: rng.range(0.7, 1.5) });
    }
  }
  const trees = new THREE.InstancedMesh(treeGeo, treeMat, spots.length);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
  spots.forEach((s, i) => {
    sc.set(s.s, s.s, s.s); pv.set(s.x, s.h + 13 * s.s, s.z);
    m4.compose(pv, q, sc); trees.setMatrixAt(i, m4);
    pv.set(s.x, s.h + 3, s.z); m4.compose(pv, q, sc); trunks.setMatrixAt(i, m4);
  });
  group.add(trees, trunks);

  // --- harbour buildings near each strip: lit boxes for scale and place ---
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xe8dcc0 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xb4502e });
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffca7a });
  for (const isl of ISLANDS) {
    const pose = runwayPose(isl);
    const n = isl.id === 'nalu' ? 14 : 5;
    for (let i = 0; i < n; i++) {
      const bx = pose.x + rng.range(-260, 260), bz = pose.z + rng.range(70, 300) * (rng.chance(0.5) ? 1 : -1);
      const bh = heightAt(bx, bz);
      if (bh < 1) continue;
      const w = rng.range(14, 30), dpt = rng.range(12, 22), hgt = rng.range(7, 15);
      const house = new THREE.Group();
      const walls = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, dpt), wallMat);
      walls.position.y = hgt / 2;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, dpt) * 0.75, hgt * 0.5, 4), roofMat);
      roof.position.y = hgt + hgt * 0.25; roof.rotation.y = Math.PI / 4;
      const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 2, 0.4), winMat);
      win.position.set(0, hgt * 0.55, dpt / 2 + 0.2);
      house.add(walls, roof, win);
      house.position.set(bx, bh, bz);
      house.rotation.y = rng.range(0, Math.PI);
      group.add(house);
    }
  }

  // --- Karak lighthouse ---
  const karak = ISLANDS.find((i) => i.id === 'karak');
  const tower = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 42, 10),
    new THREE.MeshLambertMaterial({ color: 0xf2ead6 }));
  shaft.position.y = 21;
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 7, 10),
    new THREE.MeshBasicMaterial({ color: 0xffca7a }));
  lampRoom.position.y = 45;
  tower.add(shaft, lampRoom);
  tower.position.set(karak.x - 90, heightAt(karak.x - 90, karak.z - 120), karak.z - 120);
  group.add(tower);

  // --- Vatu's ash plume: a slow column of grey puffs above the crater ---
  const plume = new THREE.Group();
  const plumeMat = new THREE.MeshBasicMaterial({ color: 0x8d8578, transparent: true, opacity: 0.34, depthWrite: false });
  const vatu = ISLANDS.find((i) => i.id === 'vatu');
  const puffs = [];
  for (let i = 0; i < 22; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(60 + i * 9, 8, 8), plumeMat);
    puff.position.set(vatu.x + i * 26, 660 + i * 34, vatu.z - i * 10);
    plume.add(puff); puffs.push(puff);
  }
  group.add(plume);

  // --- clouds: flattened white clusters drifting on the wind ---
  const cloudGroup = new THREE.Group();
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xf7fafc, transparent: true, opacity: 0.8 });
  const clouds = [];
  for (let i = 0; i < 26; i++) {
    const cl = new THREE.Group();
    const n = Math.floor(rng.range(3, 6));
    for (let j = 0; j < n; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(rng.range(50, 110), 8, 6), cloudMat);
      s.scale.y = 0.36;
      s.position.set(rng.range(-110, 110), rng.range(-12, 12), rng.range(-60, 60));
      cl.add(s);
    }
    cl.position.set(rng.range(-5200, 5200), rng.range(560, 840), rng.range(-5200, 5200));
    cloudGroup.add(cl); clouds.push(cl);
  }
  group.add(cloudGroup);

  return {
    group, sun, hemi, oceanMat, edgeLights, lampRoom,
    setTimeOfDay(id) {
      const t = TIMES[id] ?? TIMES.day;
      scene.background = new THREE.Color(t.sky);
      scene.fog = new THREE.Fog(t.fogColour, 900, 6000);
      hemi.intensity = 0.35 + t.ambient * 0.6;
      sun.intensity = Math.max(0.12, t.ambient * 1.7);
      sun.color.set(t.sunColour);
      sun.position.set(3200 * Math.cos(t.sunAngle * 2), 4300 * Math.max(0.06, Math.sin(t.sunAngle * Math.PI)), -1900);
      oceanMat.color.set(id === 'night' ? 0x0d3247 : id === 'dusk' ? 0x175d72 : 0x14607a);
      const lit = id === 'night' || id === 'dusk';
      for (const b of edgeLights) b.material = lit ? b.material : b.material;
      lampRoom.material.color.set(lit ? 0xffe9a8 : 0xd8cfb4);
    },
    setFogDistance(d) { if (scene.fog) { scene.fog.far = d; scene.fog.near = d * 0.42; } },
    update(dt, t) {
      for (const cl of clouds) {
        cl.position.x += dt * 7;
        if (cl.position.x > 5600) cl.position.x = -5600;
      }
      puffs.forEach((p, i) => {
        p.position.y = 660 + ((i * 34 + t * 9) % 760);
        p.material.opacity = 0.3;
      });
      oceanMat.shininess = 120 + Math.sin(t * 0.7) * 30;
    },
  };
}
