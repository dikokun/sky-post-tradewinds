// The flight HUD: DOM tapes over the 3D view — airspeed and throttle on the left,
// heading on top, altitude on the right, fuel and airframe meters, the contract card
// with its progress bar, Mags on the radio, and the warning line. It reads the plane
// state and the sortie status each frame and writes only what changed.

import { msToKnots, mToFeet } from './flightModel.js';
import { sortieStatusLine } from './missions.js';

const $ = (id) => document.getElementById(id);

export function makeHud() {
  const els = {
    root: $('hud'), spd: document.querySelector('#tape-spd .val'), spdSub: $('spd-sub'),
    hdg: document.querySelector('#tape-hdg .val'), hdgSub: $('hdg-sub'),
    alt: document.querySelector('#tape-alt .val'), altSub: $('alt-sub'),
    missionName: document.querySelector('#mission .name'), missionLine: document.querySelector('#mission .line'),
    missionBar: document.querySelector('#mission .bar i'),
    fuelFill: $('fuel-fill'), fuelNum: $('fuel-num'), dmgFill: $('dmg-fill'), dmgNum: $('dmg-num'),
    wx: $('wx-line'), radio: $('radio'), warn: $('warn'),
  };
  let radioUntil = 0;
  return {
    show() { els.root.classList.remove('hidden'); },
    hide() { els.root.classList.add('hidden'); },
    say(html, seconds = 6) {
      els.radio.innerHTML = html;
      radioUntil = performance.now() + seconds * 1000;
    },
    update(state, aircraft, sortie, weather, now) {
      els.spd.textContent = String(Math.round(msToKnots(state.speed)));
      els.spdSub.textContent = `THR ${Math.round(state.throttle * 100)}%${state.flaps ? ' · FLAPS' : ''}${state.gearDown ? '' : ' · GEAR UP'}`;
      const hdg = ((Math.round(state.heading * 180 / Math.PI) % 360) + 360) % 360;
      els.hdg.textContent = `${String(hdg).padStart(3, '0')}°`;
      els.hdgSub.textContent = sortie?.target
        ? `TARGET ${String(((Math.round(Math.atan2(sortie.target.x - state.x, -(sortie.target.z - state.z)) * 180 / Math.PI) % 360) + 360) % 360).padStart(3, '0')}°`
        : '—';
      els.alt.textContent = String(Math.round(mToFeet(Math.max(0, state.y))));
      const fpm = Math.round(state.verticalSpeed * 196.85);
      els.altSub.textContent = `VS ${fpm > 0 ? '+' : ''}${fpm} fpm`;
      const fuelFrac = state.fuel / aircraft.fuelCapacity;
      els.fuelFill.style.width = `${Math.round(fuelFrac * 100)}%`;
      els.fuelFill.style.background = fuelFrac < 0.18 ? '#c62f3b' : '#f2a541';
      els.fuelNum.textContent = `${Math.round(state.fuel)}L`;
      const health = Math.max(0, 100 - state.damage);
      els.dmgFill.style.width = `${health}%`;
      els.dmgFill.style.background = health < 40 ? '#c62f3b' : health < 75 ? '#f2a541' : '#2e933c';
      els.dmgNum.textContent = `${Math.round(health)}%`;
      els.wx.textContent = `${weather.preset.name}${weather.preset.windSpeed >= 9 ? ` · wind ${Math.round(weather.preset.windSpeed * 1.94)}kt` : ''}`;
      if (sortie) {
        const s = sortieStatusLine(sortie, state);
        els.missionName.textContent = s.name;
        els.missionLine.textContent = s.line;
        els.missionBar.style.width = `${Math.round(s.frac * 100)}%`;
      }
      const warnings = [];
      if (state.stalled) warnings.push('STALL');
      if (fuelFrac < 0.15 && state.fuel > 0) warnings.push('FUEL LOW');
      if (state.fuel <= 0) warnings.push('ENGINE STARVED — GLIDE');
      if (!state.onGround && state.verticalSpeed < -7 && state.y < 130) warnings.push('SINK RATE');
      if (state.damage > 70) warnings.push('AIRFRAME CRITICAL');
      els.warn.textContent = warnings.join(' · ');
      if (now > radioUntil && els.radio.innerHTML) els.radio.innerHTML = '';
    },
  };
}
