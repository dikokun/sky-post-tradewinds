// The Kaldera Reach: eight islands, their shapes and their airstrips. Pure data plus the
// height function the terrain mesh and the flight model share, so the ground the pilot
// sees is exactly the ground the physics feels. Heights are sums of smooth cones, one
// per hill, over a shallow seabed; each island carries one flattened strip plateau.

export const ISLANDS = [
  { id: 'nalu', name: 'Nalu', role: 'The Hub — Port Sera, fuel depot, main hangar',
    x: 0, z: 1500, radius: 1250, peak: 130,
    hills: [{ dx: -350, dz: -250, r: 700, h: 130 }, { dx: 420, dz: 300, r: 620, h: 84 }],
    runway: { name: 'Sera International', dx: 60, dz: 420, heading: Math.PI / 2, length: 1150, width: 46, surface: 'paved' } },
  { id: 'vatu', name: 'Vatu Peak', role: 'Active volcano — observatory above the ash column',
    x: -2650, z: -2350, radius: 1150, peak: 690,
    hills: [{ dx: 0, dz: 0, r: 980, h: 690 }, { dx: 480, dz: 420, r: 520, h: 180 }],
    runway: { name: 'Ashfall Strip', dx: -560, dz: 520, heading: Math.PI * 0.72, length: 640, width: 30, surface: 'gravel' } },
  { id: 'motu', name: 'Motu', role: 'Fishing village and cannery — the strip ends at the water',
    x: 2550, z: 650, radius: 820, peak: 64,
    hills: [{ dx: -150, dz: -180, r: 560, h: 64 }, { dx: 260, dz: 240, r: 430, h: 40 }],
    runway: { name: 'Cannery Dock Strip', dx: 40, dz: 60, heading: -Math.PI / 5, length: 520, width: 26, surface: 'paved' } },
  { id: 'seralune', name: 'Seralune', role: 'Resort crescent — pristine strip, noise-sensitive guests',
    x: 2950, z: -1950, radius: 980, peak: 96,
    hills: [{ dx: -260, dz: 160, r: 640, h: 96 }, { dx: 380, dz: -260, r: 520, h: 58 }],
    runway: { name: 'Lune Bay Airstrip', dx: 90, dz: -60, heading: Math.PI / 1.7, length: 880, width: 38, surface: 'paved' } },
  { id: 'karak', name: 'Karak Rock', role: 'Lighthouse rock — 400 metres of flat stone, then the sea',
    x: -3350, z: 350, radius: 380, peak: 88,
    hills: [{ dx: -60, dz: -40, r: 330, h: 88 }],
    runway: { name: 'Beacon Perch', dx: 30, dz: 30, heading: Math.PI / 2.4, length: 400, width: 22, surface: 'rock' } },
  { id: 'temara', name: 'Temara', role: 'Mangrove research station — approach under the canopy ceiling',
    x: 1250, z: 3250, radius: 900, peak: 52,
    hills: [{ dx: -220, dz: -120, r: 600, h: 52 }, { dx: 300, dz: 260, r: 480, h: 34 }],
    runway: { name: 'Canopy Clearing', dx: 0, dz: 40, heading: Math.PI / 6, length: 600, width: 28, surface: 'grass' } },
  { id: 'oru', name: 'Oru Atoll', role: 'Pearl divers on a ring of sand — crosswinds off the lagoon',
    x: -2250, z: 2650, radius: 880, peak: 26,
    hills: [{ dx: -420, dz: -300, r: 420, h: 22 }, { dx: 430, dz: 320, r: 420, h: 26 }, { dx: 460, dz: -330, r: 380, h: 18 }, { dx: -450, dz: 330, r: 380, h: 15 }],
    runway: { name: 'Oru Lagoon Strip', dx: -40, dz: -420, heading: Math.PI / 2, length: 700, width: 30, surface: 'sand' } },
  { id: 'fenwick', name: "Fenwick's Folly", role: 'A half-sunk runway that floods at high tide',
    x: -450, z: -3050, radius: 760, peak: 30,
    hills: [{ dx: -200, dz: -160, r: 520, h: 30 }, { dx: 260, dz: 200, r: 430, h: 18 }],
    runway: { name: 'Folly Field', dx: 20, dz: 30, heading: Math.PI / 3.6, length: 560, width: 28, surface: 'paved' } },
];

export const islandById = (id) => ISLANDS.find((i) => i.id === id);

// World position and elevation of an island's runway centre.
export function runwayPose(island) {
  const r = island.runway;
  const x = island.x + r.dx, z = island.z + r.dz;
  return { x, z, heading: r.heading, length: r.length, width: r.width, surface: r.surface, name: r.name, y: heightAt(x, z, true) };
}

// Terrain height at a world point. On a runway plateau the strip is levelled flat.
export function heightAt(x, z, forRunway = false) {
  let h = -14; // seabed
  for (const isl of ISLANDS) {
    const dx = x - isl.x, dz = z - isl.z;
    const d = Math.hypot(dx, dz);
    if (d > isl.radius * 1.7) continue;
    // island base shelf rising out of the sea
    h = Math.max(h, shelf(d, isl.radius) * 6 - 4);
    for (const hill of isl.hills) {
      const hd = Math.hypot(dx - hill.dx, dz - hill.dz);
      if (hd < hill.r) {
        const t = 1 - hd / hill.r;
        h = Math.max(h, hill.h * t * t * (3 - 2 * t));
      }
    }
  }
  if (forRunway) return h;
  // level any point inside a runway rectangle to the strip's plateau height
  for (const isl of ISLANDS) {
    const r = isl.runway;
    const cx = isl.x + r.dx, cz = isl.z + r.dz;
    const dx = x - cx, dz = z - cz;
    const along = dx * Math.sin(r.heading) - dz * Math.cos(r.heading);
    const across = dx * Math.cos(r.heading) + dz * Math.sin(r.heading);
    if (Math.abs(along) < r.length / 2 + 30 && Math.abs(across) < r.width / 2 + 26) {
      return heightAt(cx, cz, true);
    }
  }
  return h;
}

function shelf(d, radius) {
  if (d >= radius) return Math.max(0, 1 - (d - radius) / (radius * 0.7));
  return 1;
}

// Is the point on a runway (and which), or on water?
export function surfaceAt(x, z) {
  for (const isl of ISLANDS) {
    const r = isl.runway;
    const cx = isl.x + r.dx, cz = isl.z + r.dz;
    const dx = x - cx, dz = z - cz;
    const along = dx * Math.sin(r.heading) - dz * Math.cos(r.heading);
    const across = dx * Math.cos(r.heading) + dz * Math.sin(r.heading);
    if (Math.abs(along) <= r.length / 2 && Math.abs(across) <= r.width / 2) {
      return { onRunway: true, island: isl, runway: r };
    }
  }
  const h = heightAt(x, z);
  return { onRunway: false, onWater: h < 0.4, groundY: Math.max(h, 0) };
}
