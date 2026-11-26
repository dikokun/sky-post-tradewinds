// The three Sky Post aircraft, in unlock order. Numbers are the flight model's: thrust
// and drag are tuned so each plane cruises near its real-world character — the Minnow
// slow and forgiving, the Packhorse heavy and thirsty for runway, the Needle fast and
// twitchy. Stats the hangar shows are derived from the same numbers, never invented.

export const AIRCRAFT = [
  { id: 'minnow', name: 'Kestrel D-2 "Minnow"', kind: 'High-wing seaplane, single engine',
    blurb: 'The school bus of the Reach. Floats, forgives, and lands on water when the strip runs out.',
    price: 0, mass: 1120, maxThrust: 5400, dragCoef: 1.85, stallSpeed: 18,
    fuelCapacity: 95, fuelBurnPerSec: 0.055, floats: true, cargoKg: 180,
    cruiseKt: 85, colour: 0xf2a541, accent: 0x12736e },
  { id: 'packhorse', name: 'Brumbie C-6 "Packhorse"', kind: 'Twin-engine cargo hauler',
    blurb: 'Carries a cannery in her belly and shrugs at weather. Needs every metre of a long strip.',
    price: 2600, mass: 3450, maxThrust: 15600, dragCoef: 3.85, stallSpeed: 24,
    fuelCapacity: 260, fuelBurnPerSec: 0.11, floats: false, cargoKg: 900,
    cruiseKt: 110, colour: 0x7a8b6f, accent: 0xf6ecd7 },
  { id: 'needle', name: 'Sirocco V-9 "Needle"', kind: 'Low-wing tourer, retractable gear',
    blurb: '165 knots of impatience. Twitchy in a crosswind, hates rough strips, drinks fuel like a sailor.',
    price: 5400, mass: 1280, maxThrust: 10100, dragCoef: 1.14, stallSpeed: 27,
    fuelCapacity: 120, fuelBurnPerSec: 0.13, floats: false, cargoKg: 120,
    cruiseKt: 165, colour: 0xc62f3b, accent: 0x12303c },
];

export const aircraftById = (id) => AIRCRAFT.find((a) => a.id === id);

// Hangar upgrades: each is bought once per aircraft and changes the model for real.
export const UPGRADES = [
  { id: 'engine', name: 'Rebuilt Engine', desc: '+12% thrust on this airframe.', price: 700,
    apply: (a) => ({ ...a, maxThrust: a.maxThrust * 1.12 }) },
  { id: 'tank', name: 'Long-Range Tank', desc: '+35% fuel capacity.', price: 550,
    apply: (a) => ({ ...a, fuelCapacity: Math.round(a.fuelCapacity * 1.35) }) },
  { id: 'gear', name: 'Reinforced Gear', desc: 'Hard landings cost half the airframe.', price: 480,
    apply: (a) => ({ ...a, toughGear: true }) },
  { id: 'avionics', name: 'Glass Avionics', desc: 'A flight-path marker joins the HUD.', price: 620,
    apply: (a) => ({ ...a, glassAvionics: true }) },
];

export function fitAircraft(base, upgradeIds) {
  let fitted = { ...base };
  for (const id of upgradeIds) {
    const up = UPGRADES.find((u) => u.id === id);
    if (up) fitted = up.apply(fitted);
  }
  return fitted;
}
