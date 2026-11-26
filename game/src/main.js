// Sky Post: Tradewinds — the conductor. It owns the renderer, the mode the game is in
// (hangar, flying, results), the frame loop, and the wiring between the flight model,
// the mission engine, the career and the screens. Everything it wires together lives
// in its own file with its own job; this file only conducts.

import * as THREE from 'three';
import { buildWorld } from './terrain.js';
import { buildAircraftMesh, poseAircraft } from './aircraftModel.js';
import { createPlaneState, stepPlane, clamp } from './flightModel.js';
import { makeControls } from './controls.js';
import { makeCameras } from './camera.js';
import { makePanel } from './instruments.js';
import { makeHud } from './hud.js';
import { makeAudio } from './audio.js';
import { makeWeather, ashExposure, WEATHER } from './weather.js';
import { surfaceAt, runwayPose, islandById, heightAt } from './data/islands.js';
import { aircraftById, fitAircraft, UPGRADES } from './data/aircraft.js';
import { contractById } from './data/contracts.js';
import { createSortie, updateSortie, settleSortie, failSortie } from './missions.js';
import { buildSortieProps } from './sortieProps.js';
import { loadCareer, saveCareer, wipeCareer } from './saveGame.js';
import { recordSortie, buyAircraft, buyUpgrade } from './career.js';
import { renderHangar, renderResults } from './screens.js';
import { radioLine } from './data/radioLines.js';
import { makeRng } from './random.js';
import { planFlight, planRingCourse, planPhotoCourse, makeAutopilot } from './autopilot.js';
import { stageShot } from './shotDirector.js';
import { ECONOMY } from './config.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.5, 12000);
const cameras = makeCameras(camera);
const world = buildWorld(scene, 7);
world.setTimeOfDay('dusk');

const controls = makeControls();
function setPanel(v) {
  document.getElementById('panel').classList.toggle('hidden', !v);
  document.body.classList.toggle('cockpit', v);
}
const audio = makeAudio();
const hud = makeHud();
const panel = makePanel(document.getElementById('panel'));
const menuEl = document.getElementById('menu');
const resultsEl = document.getElementById('results');

let career = loadCareer();
let mode = 'menu';
let plane = null, fitted = null, aircraftView = null, sortie = null, props = null;
let weatherLive = null, autopilot = null, frozen = false, paused = false;
let groundBill = 0, lastTouchWater = false, elapsed = 0, menuAngle = 0;
const shotRng = makeRng(1740);

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- hangar ----------
function showHangar() {
  mode = 'menu';
  menuEl.classList.remove('hidden');
  resultsEl.classList.add('hidden');
  hud.hide();
  setPanel(false);
  renderHangar(menuEl, career, {
    fly: (id) => { audio.start(); startSortie(id); },
    buyPlane: (id) => { const a = aircraftById(id); if (buyAircraft(career, a)) { saveCareer(career); showHangar(); } },
    selectPlane: (id) => { career.activeAircraft = id; saveCareer(career); showHangar(); },
    buyUpgrade: (pair) => {
      const [planeId, upId] = pair.split(':');
      const up = UPGRADES.find((u) => u.id === upId);
      if (up && buyUpgrade(career, planeId, up)) { saveCareer(career); showHangar(); }
    },
    wipe: () => { wipeCareer(); career = loadCareer(); showHangar(); },
  });
  parkBackdropPlane();
}

function parkBackdropPlane() {
  clearAircraft();
  const base = aircraftById('minnow');
  fitted = base;
  aircraftView = buildAircraftMesh(base);
  scene.add(aircraftView.group);
  const pose = runwayPose(islandById('nalu'));
  plane = createPlaneState(base, pose.x, pose.z, pose.heading, pose.y);
  plane.throttle = 0;
  poseAircraft(aircraftView.group, aircraftView.parts, plane, 0);
}

function clearAircraft() {
  if (aircraftView) { scene.remove(aircraftView.group); aircraftView = null; }
  if (props) { scene.remove(props); props = null; }
}

// ---------- sorties ----------
function startSortie(contractId, opts = {}) {
  const contract = contractById(contractId);
  const base = aircraftById(career.activeAircraft);
  fitted = fitAircraft(base, career.upgrades[base.id]);
  clearAircraft();
  aircraftView = buildAircraftMesh(base);
  scene.add(aircraftView.group);

  const from = islandById(contract.from);
  const pose = runwayPose(from);
  const fx = Math.sin(pose.heading), fz = -Math.cos(pose.heading);
  const startBack = pose.length / 2 - 46;
  plane = createPlaneState(fitted, pose.x - fx * startBack, pose.z - fz * startBack, pose.heading, pose.y);
  sortie = createSortie(contract, 1000 + career.stats.flights * 7 + (opts.seed ?? 0));
  props = buildSortieProps(sortie, scene);
  weatherLive = makeWeather(contract.weather, shotRng);
  world.setTimeOfDay(contract.timeOfDay);
  world.setFogDistance(WEATHER[contract.weather].fog);
  groundBill = 0; lastTouchWater = false; elapsed = 0;
  autopilot = opts.autopilot
    ? makeAutopilot(contract.type === 'rings' ? planRingCourse(sortie, from, fitted)
      : contract.type === 'photo' ? planPhotoCourse(sortie, from, islandById(contract.to), fitted)
      : planFlight(from, islandById(contract.to), fitted), fitted)
    : null;
  frozen = false; paused = false;
  cameras.setCockpit(false);
  setPanel(false);
  menuEl.classList.add('hidden');
  resultsEl.classList.add('hidden');
  hud.show();
  const kind = contract.weather === 'ash' ? 'ash' : contract.tide ? 'tide' : contract.weather === 'squall' ? 'squall' : 'launch';
  hud.say(`<b>Mags:</b> “${radioLine(kind, shotRng)}”`, 7);
  document.getElementById('status').textContent = `${contract.name}: ${contract.brief}`;
  mode = 'fly';
}

function envFor() {
  const surf = surfaceAt(plane.x, plane.z);
  let onWater = surf.onWater, surfaceY;
  if (surf.onRunway) {
    surfaceY = runwayPose(surf.island).y;
    // Fenwick's tide: late in a tide sortie the strip goes under
    if (surf.island.id === 'fenwick' && sortie?.contract.tide && elapsed > 300) onWater = true;
  } else {
    surfaceY = Math.max(heightAt(plane.x, plane.z), 0);
  }
  const w = weatherLive ? weatherLive.sample(1 / 60, plane.x, plane.z, elapsed)
    : { windX: 0, windZ: 0, gust: 0 };
  return { surfaceY, onRunway: surf.onRunway && !onWater, onWater, windX: w.windX, windZ: w.windZ, gust: w.gust, surf };
}

function step(dt, dropPressed = false) {
  if (!plane || !sortie) return;
  elapsed += dt;
  const input = autopilot ? autopilot.input(plane, dt) : controls.read();
  if (!autopilot) {
    input.brakes = controls.held('b');
    if (controls.take('g')) plane.gearDown = !plane.gearDown;
    if (controls.take('f')) plane.flaps = plane.flaps ? 0 : 1;
  }
  if (input.brakes) plane.brakes = true; else if (!autopilot) plane.brakes = controls.held('b');
  const env = envFor();
  const events = stepPlane(plane, fitted, input, dt, env);
  let crashed = null;
  for (const ev of events) {
    if (ev.type === 'touchdown') {
      sortie.landingGrade = ev.grade;
      const fpm = Math.round(ev.sink * 196.85);
      if (fpm > (sortie.worstSinkFpm ?? 0)) sortie.worstSinkFpm = fpm;
      lastTouchWater = !!ev.onWater;
      audio.touchdown(ev.grade === 'hard');
    }
    if (ev.type === 'crashed') crashed = ev.reason;
    if (ev.type === 'fuel-empty') { audio.alarm(); hud.say('<b>Mags:</b> “Tank\'s dry. Glide her somewhere kind.”', 6); }
    if (ev.type === 'stopped') settle();
  }
  if (weatherLive?.preset.ash || sortie.contract.weather === 'ash') {
    const exposure = ashExposure(plane.x, plane.y, plane.z);
    if (exposure > 0 && !plane.onGround) plane.damage = Math.min(100, plane.damage + exposure * dt * 1.1);
  }
  const mEvents = updateSortie(sortie, plane, dt, { dropPressed }, env);
  for (const ev of mEvents) {
    if (ev.type === 'ring') { audio.ring(); hud.say(`Ring ${ev.count} threaded.`, 3); }
    if (ev.type === 'photo') { audio.ring(); hud.say(`Photograph ${ev.count} in the can.`, 3); }
    if (ev.type === 'dropped') { audio.cash(); hud.say(`Supplies away — accuracy ${Math.round(ev.score * 100)}%.`, 4); }
    if (ev.type === 'drop-denied') hud.say('Too high, too fast, or off the zone — set up again.', 3);
    if (ev.type === 'failed') endSortie(sortie.result);
  }
  if (crashed) {
    const reason = crashed === 'water' ? 'She went into the sea. The Reach keeps what it catches.'
      : crashed === 'terrain' ? 'Terrain, met at speed. The Reach is not sorry, but Mags is.'
      : 'The landing broke her. A bent airframe and a long walk home.';
    endSortie(failSortie(sortie, reason), true);
  }
  poseAircraft(aircraftView.group, aircraftView.parts, plane, elapsed);
}

function settle() {
  if (!sortie || sortie.phase === 'complete' || sortie.phase === 'failed') return;
  const surf = surfaceAt(plane.x, plane.z);
  const result = settleSortie(sortie, plane, { ...surf, island: surf.island });
  if (result) { endSortie(result); return; }
  groundService();
}

function groundService() {
  if (!plane || plane.onGround !== true) return;
  const fuelNeeded = Math.max(0, fitted.fuelCapacity - plane.fuel);
  const repairNeeded = Math.max(0, plane.damage);
  const cost = Math.round(fuelNeeded * ECONOMY.fuelPricePerLitre + repairNeeded * ECONOMY.repairPricePerPoint);
  if (cost <= 0) return;
  if (career.credits >= cost) {
    career.credits -= cost; groundBill += cost;
    plane.fuel = fitted.fuelCapacity; plane.damage = 0;
    hud.say(`Ground crew: refuelled and patched — ${cost} cr.`, 4);
  } else {
    hud.say('Ground crew wants paying and the purse is light — fly careful.', 5);
  }
  saveCareer(career);
}

function endSortie(result, crashed = false) {
  if (mode !== 'fly') return;
  mode = 'results';
  const facts = {
    landingGrade: sortie.landingGrade ?? (crashed ? 'crash' : null),
    landingFpm: sortie.worstSinkFpm ?? 0,
    damage: plane.damage, fuel: plane.fuel, elapsed, groundBill,
    onWater: lastTouchWater, crashed,
  };
  const newMedals = recordSortie(career, sortie.contract, result, facts);
  saveCareer(career);
  hud.hide();
  setPanel(false);
  if (crashed) audio.crash(); else if (result.ok) audio.cash();
  renderResults(resultsEl, career, sortie.contract, result, facts, newMedals, { back: showHangar });
  resultsEl.classList.remove('hidden');
}

// ---------- frame loop ----------
let prev = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - prev) / 1000, 0, 0.05);
  prev = now;
  world.update(dt, now / 1000);
  if (mode === 'menu' && plane) {
    menuAngle += dt * 0.07;
    const pose = runwayPose(islandById('nalu'));
    cameras.pose(
      pose.x + Math.cos(menuAngle) * 34, pose.y + 9, pose.z + Math.sin(menuAngle) * 34,
      pose.x, pose.y + 3, pose.z);
    poseAircraft(aircraftView.group, aircraftView.parts, plane, now / 1000);
  } else if (mode === 'fly' && plane) {
    if (!paused && !frozen) {
      const drop = !autopilot && controls.take('x');
      const sub = 2, sdt = dt / sub;
      for (let i = 0; i < sub; i++) step(sdt, drop && i === 0);
      if (!autopilot) {
        if (controls.take('c')) {
          const inCockpit = cameras.toggle();
          setPanel(inCockpit);
        }
        if (controls.take('p')) paused = !paused;
      }
    }
    if (mode === 'fly') {
      cameras.update(plane, dt);
      // the pilot does not stare at a frozen prop blade: it fades in cockpit view
      const propVisible = !cameras.cockpit;
      if (aircraftView.parts.prop) aircraftView.parts.prop.visible = propVisible;
      if (aircraftView.parts.props) for (const p of aircraftView.parts.props) p.visible = propVisible;
      hud.update(plane, fitted, sortie, weatherLive, now);
      if (cameras.cockpit) panel.draw(plane, fitted);
      audio.update(plane);
    }
  }
  renderer.render(scene, camera);
}

// ---------- entry ----------
if (params.get('shot')) {
  showHangar(); // builds career + backdrop; the director replaces it as needed
  menuEl.classList.add('hidden');
  mode = 'fly';
  stageShot(params.get('shot'), {
    startSortie: (id, opts) => startSortie(id, { ...opts, autopilot: true, seed: Number(params.get('seed') ?? 1) }),
    step: (dt) => { step(dt); if (plane) cameras.update(plane, dt); },
    setCockpit: (v) => { cameras.setCockpit(v); setPanel(v); },
    plane: () => plane, sortie: () => sortie, legIndex: () => autopilot?.legIndex ?? 0,
    setFrozen: (v) => { frozen = v; },
    showHangar: () => { showHangar(); },
  });
  if (mode === 'fly' && plane) { cameras.update(plane, 0.1); hud.update(plane, fitted, sortie, weatherLive, performance.now()); if (cameras.cockpit) panel.draw(plane, fitted); }
} else {
  showHangar();
}
requestAnimationFrame(frame);
