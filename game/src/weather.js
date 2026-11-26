// Weather over the Reach: five named conditions. Each preset is numbers the flight
// model and the renderer both read — wind and gusts push the plane, fog closes the
// world in, downdrafts press on it under cloud, and ash near Vatu Peak chews engines.

export const WEATHER = {
  calm:   { name: 'Tradewind Calm', windDir: 0.8, windSpeed: 3, gust: 0.4, fog: 6800, down: 0, ash: false,
            line: 'Tradewind Calm — the Reach at its kindest.' },
  haze:   { name: 'Salt Haze', windDir: 0.6, windSpeed: 4, gust: 0.8, fog: 3400, down: 0, ash: false,
            line: 'Salt Haze — islands appear late. Trust the compass.' },
  squall: { name: 'The White Squall', windDir: 2.4, windSpeed: 13, gust: 3.4, fog: 1500, down: 1.6, ash: false,
            line: 'The White Squall — crosswind gusts, slick strips, downdrafts.' },
  monsoon:{ name: 'Monsoon Breath', windDir: 1.9, windSpeed: 9, gust: 2.0, fog: 1200, down: 2.2, ash: false,
            line: 'Monsoon Breath — heavy air that pushes back.' },
  ash:    { name: 'Volcano Breath', windDir: 1.2, windSpeed: 6, gust: 1.2, fog: 3400, down: 0, ash: true,
            line: 'Volcano Breath — ash in the air near Vatu. Engines suffer.' },
};

export const TIMES = {
  dawn:  { name: 'Dawn', sunAngle: 0.16, sunColour: 0xffd9a0, sky: 0x9fc6d8, fogColour: 0xc4d6da, ambient: 0.75 },
  day:   { name: 'Midday', sunAngle: 0.85, sunColour: 0xfff3dd, sky: 0x6fb6d9, fogColour: 0xaed4e2, ambient: 1.0 },
  dusk:  { name: 'Golden hour', sunAngle: 0.10, sunColour: 0xff9c4a, sky: 0xe8a56b, fogColour: 0xe0b490, ambient: 0.7 },
  night: { name: 'Night', sunAngle: -0.25, sunColour: 0x8fb4ff, sky: 0x0d2438, fogColour: 0x10293e, ambient: 0.32 },
};

// Live weather state for one sortie: steady wind plus a wandering gust, sampled per step.
export function makeWeather(presetId, rng) {
  const preset = WEATHER[presetId] ?? WEATHER.calm;
  let gustPhase = rng.range(0, 100);
  return {
    preset,
    sample(dt, x, z, t) {
      gustPhase += dt * 0.7;
      const gustNow = Math.sin(gustPhase) * Math.sin(gustPhase * 0.37 + 1.7) * preset.gust;
      const windX = Math.sin(preset.windDir) * (preset.windSpeed + gustNow);
      const windZ = -Math.cos(preset.windDir) * (preset.windSpeed + gustNow);
      // downdrafts live under the squall's cloud streets: bands across the wind
      const band = Math.sin((x * 0.0016) + t * 0.05) * Math.cos(z * 0.0013);
      const down = preset.down * Math.max(0, band) * -1;
      return { windX, windZ, gust: down, crosswind: Math.abs(Math.sin(preset.windDir)) * preset.windSpeed };
    },
  };
}

// Ash exposure: inside the plume cone downwind of Vatu Peak, engines take damage.
export function ashExposure(x, y, z) {
  const dx = x - (-2650), dz = z - (-2350);
  const d = Math.hypot(dx, dz);
  if (d > 1500 || y < 380 || y > 950) return 0;
  return Math.max(0, 1 - d / 1500) * 0.9;
}
