// The hangar and the results screen, rendered as DOM over the 3D backdrop. The hangar
// is the game's front door and its shop window: career standing, the three aircraft
// with their upgrades, the contract board filtered by rank, the medal wall and the
// pilot's record — the whole career readable in one screen. The results screen is the
// pay slip: every line the mission engine wrote, the landing grade, and what it bought.

import { AIRCRAFT, UPGRADES } from './data/aircraft.js';
import { CONTRACTS, CONTRACT_TYPES } from './data/contracts.js';
import { MEDALS } from './data/medals.js';
import { rankFor } from './career.js';
import { WEATHER } from './weather.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function renderHangar(el, career, handlers) {
  const rank = rankFor(career.rep);
  const rankIdx = { 'Deckhand': 0, 'Post Rider': 1, 'Reach Pilot': 2, 'Captain of the Reach': 3, 'Sky Post Legend': 4 }[rank.name];
  const chips = [
    ['CREDITS', career.credits], ['RANK', rank.name], ['REPUTATION', career.rep],
    ['FLIGHTS', career.stats.flights], ['CONTRACTS DONE', career.stats.contractsDone],
    ['BEST LANDING', career.stats.bestLandingFpm ? `${career.stats.bestLandingFpm} fpm` : '—'],
  ].map(([k, v]) => `<div class="chip">${k}<br><b>${esc(v)}</b></div>`).join('');

  const planes = AIRCRAFT.map((a) => {
    const owned = career.owned.includes(a.id);
    const active = career.activeAircraft === a.id;
    const ups = UPGRADES.map((u) => {
      const has = career.upgrades[a.id].includes(u.id);
      return `<p>${has ? '✓' : '·'} ${esc(u.name)} — ${esc(u.desc)} ${has ? '' : `<button data-up="${a.id}:${u.id}" ${!owned || career.credits < u.price ? 'disabled' : ''}>Buy ${u.price} cr</button>`}</p>`;
    }).join('');
    return `<div class="card ${owned ? '' : 'locked'} ${active ? 'sel' : ''}">
      <h3>${esc(a.name)}</h3><div class="sub">${esc(a.kind)} · cruise ${a.cruiseKt} kt · cargo ${a.cargoKg} kg${a.floats ? ' · floats' : ''}</div>
      <p>${esc(a.blurb)}</p>${ups}
      ${owned
        ? `<button class="alt" data-fly-plane="${a.id}" ${active ? 'disabled' : ''}>${active ? 'On the line' : 'Bring to the line'}</button>`
        : `<button data-buy-plane="${a.id}" ${career.credits < a.price ? 'disabled' : ''}>Buy — ${a.price} cr</button>`}
    </div>`;
  }).join('');

  const contracts = CONTRACTS.map((c) => {
    const locked = rankIdx < c.minRank;
    return `<div class="card ${locked ? 'locked' : ''}">
      <h3>${esc(c.name)}</h3>
      <div class="sub">${esc(CONTRACT_TYPES[c.type])} · ${esc(c.from.toUpperCase())} → ${esc(c.to.toUpperCase())} · ${esc(WEATHER[c.weather].name)} · ${esc(c.timeOfDay)}${c.timed ? ` · ⏱ ${Math.round(c.timed / 60)} min` : ''}${c.tide ? ' · tide rising' : ''}</div>
      <p>${esc(c.brief)}</p>
      <p class="pay">Pays ${c.pay} cr · +${c.rep} rep</p>
      <button data-contract="${c.id}" ${locked ? 'disabled' : ''}>${locked ? `Locked — needs rank ${c.minRank + 1}` : 'Fly this contract'}</button>
    </div>`;
  }).join('');

  const medals = MEDALS.map((m) => career.medals.includes(m.id)
    ? `<span class="medal earned" title="${esc(m.hint)}">★ ${esc(m.name)}</span>`
    : `<span class="medal" title="${esc(m.hint)}">${esc(m.name)}</span>`).join('');

  el.innerHTML = `<div class="wrap">
    <h1 class="title">SKY POST: <span class="post">TRADEWINDS</span></h1>
    <p class="tagline">Small planes. Big water. Every delivery matters. The Kaldera Reach — eight islands, one courier, no roads.</p>
    <div class="strip">${chips}</div>
    <h2 class="sec">The Line — Aircraft & Upgrades</h2><div class="cards">${planes}</div>
    <h2 class="sec">Contract Board — Mags Has Work</h2><div class="cards">${contracts}</div>
    <h2 class="sec">Medal Wall</h2><div class="medals">${medals}</div>
    <p class="fineprint">Fly with <kbd>↑</kbd><kbd>↓</kbd> pitch, <kbd>←</kbd><kbd>→</kbd> bank, <kbd>Shift</kbd>/<kbd>Ctrl</kbd> throttle,
    <kbd>G</kbd> gear, <kbd>F</kbd> flaps, <kbd>B</kbd> brakes, <kbd>X</kbd> drop cargo, <kbd>C</kbd> cockpit camera, <kbd>P</kbd> pause.
    Refuel and repair happen on the ground at any strip — rolling to a stop with damage or an empty tank opens the ground crew.
    Career saves in this browser. <button class="alt bigbtn" data-wipe="1" style="font-size:12px;padding:6px 10px">Start a new career</button></p>
  </div>`;

  el.querySelectorAll('[data-contract]').forEach((b) => b.addEventListener('click', () => handlers.fly(b.dataset.contract)));
  el.querySelectorAll('[data-buy-plane]').forEach((b) => b.addEventListener('click', () => handlers.buyPlane(b.dataset.buyPlane)));
  el.querySelectorAll('[data-fly-plane]').forEach((b) => b.addEventListener('click', () => handlers.selectPlane(b.dataset.flyPlane)));
  el.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => handlers.buyUpgrade(b.dataset.up)));
  el.querySelectorAll('[data-wipe]').forEach((b) => b.addEventListener('click', () => handlers.wipe()));
}

export function renderResults(el, career, contract, result, facts, newMedals, handlers) {
  const lines = result.lines.map((l) => `<tr><td>${esc(l.label)}</td><td>${l.amount > 0 ? '+' : ''}${l.amount} cr</td></tr>`).join('');
  el.innerHTML = `<div class="wrap">
    <h1 class="title">${result.ok ? 'DELIVERED' : 'SORTIE OVER'}</h1>
    <p class="tagline">${esc(contract.name)} — ${esc(contract.cargo)}</p>
    <div class="strip">
      <div class="chip">LANDING<br><b>${esc(facts.landingGrade ?? '—')}</b></div>
      <div class="chip">SINK AT TOUCHDOWN<br><b>${facts.landingFpm ? `${facts.landingFpm} fpm` : '—'}</b></div>
      <div class="chip">AIRFRAME<br><b>${Math.round(100 - facts.damage)}%</b></div>
      <div class="chip">FUEL LEFT<br><b>${Math.round(facts.fuel)} L</b></div>
      <div class="chip">TIME<br><b>${Math.floor(facts.elapsed / 60)}:${String(Math.floor(facts.elapsed % 60)).padStart(2, '0')}</b></div>
    </div>
    ${result.ok ? `<h2 class="sec">Pay Slip</h2><table class="stats">${lines}<tr><td>Total</td><td>${result.total} cr · +${result.rep} rep</td></tr></table>`
      : `<p style="font-size:17px">${esc(result.reason)}</p>`}
    ${facts.groundBill > 0 ? `<p>Ground crew: refuel + repairs came to <b>${facts.groundBill} cr</b> (already settled).</p>` : ''}
    ${newMedals.length ? `<h2 class="sec">New Medals</h2><div class="medals">${newMedals.map((m) => `<span class="medal earned">★ ${esc(m.name)}</span>`).join('')}</div>` : ''}
    <p style="margin-top:26px"><button class="bigbtn" data-back="1">Back to the hangar</button></p>
  </div>`;
  el.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => handlers.back()));
}
