// The pilot's career: credits, reputation and rank, owned aircraft and their upgrades,
// and the counters the medals read. Kept as one plain object that saveGame persists;
// every change to it happens through these functions so the hangar, the results screen
// and the medal checks never disagree.

import { ECONOMY } from './config.js';
import { MEDALS } from './data/medals.js';

export const RANKS = [
  { rep: 0, name: 'Deckhand' },
  { rep: 3, name: 'Post Rider' },
  { rep: 8, name: 'Reach Pilot' },
  { rep: 15, name: 'Captain of the Reach' },
  { rep: 24, name: 'Sky Post Legend' },
];

export function rankFor(rep) {
  let rank = RANKS[0];
  for (const r of RANKS) if (rep >= r.rep) rank = r;
  return rank;
}

export function freshCareer() {
  return {
    credits: ECONOMY.startCredits,
    rep: 0,
    owned: ['minnow'],
    upgrades: { minnow: [], packhorse: [], needle: [] },
    activeAircraft: 'minnow',
    medals: [],
    stats: {
      flights: 0, contractsDone: 0, crashes: 0, waterLandings: 0, ashPasses: 0,
      nightFlights: 0, squallFlights: 0, ringCourses: 0, medEvacs: 0, fullCircuits: 0,
      bestLandingFpm: 0, landings: 0, earned: 0,
    },
  };
}

// Apply a finished sortie's outcome. Returns the medals this outcome newly earned.
export function recordSortie(career, contract, result, facts) {
  const s = career.stats;
  s.flights++;
  if (facts.landingFpm > 0) {
    s.landings++;
    if (s.bestLandingFpm === 0 || facts.landingFpm < s.bestLandingFpm) s.bestLandingFpm = facts.landingFpm;
  }
  if (facts.onWater) s.waterLandings++;
  if (facts.crashed) s.crashes++;
  if (result?.ok) {
    s.contractsDone++;
    career.credits += result.total;
    career.rep += result.rep;
    s.earned += result.total;
    if (contract.type === 'medical') s.medEvacs++;
    if (contract.type === 'rings') s.ringCourses++;
    if (contract.type === 'tour') s.fullCircuits++;
    if (contract.weather === 'squall') s.squallFlights++;
    if (contract.timeOfDay === 'night') s.nightFlights++;
    if (contract.type === 'photo') s.ashPasses++;
  }
  const earned = [];
  for (const medal of MEDALS) {
    if (!career.medals.includes(medal.id) && medal.test(s)) {
      career.medals.push(medal.id);
      earned.push(medal);
    }
  }
  return earned;
}

export function buyAircraft(career, aircraft) {
  if (career.owned.includes(aircraft.id) || career.credits < aircraft.price) return false;
  career.credits -= aircraft.price;
  career.owned.push(aircraft.id);
  return true;
}

export function buyUpgrade(career, aircraftId, upgrade) {
  if (career.upgrades[aircraftId].includes(upgrade.id) || career.credits < upgrade.price) return false;
  career.credits -= upgrade.price;
  career.upgrades[aircraftId].push(upgrade.id);
  return true;
}
