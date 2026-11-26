// Mags, the Sky Post dispatcher, on the radio. Lines are picked by situation — a launch,
// a warning, a homecoming — so the voice the pilot hears always matches the sky outside.

export const RADIO = {
  launch: [
    'Sky Post, Mags on the desk — wind\'s friendly, mostly.',
    'Karak light is on. Short strip, big heart.',
    'Ice melts, tips don\'t. Smooth hands.',
  ],
  ash: [
    'Vatu\'s coughing again. Mind the grey column.',
    'Ash eats engines, pilot. Cross it fast or not at all.',
  ],
  tide: [
    'Tide\'s coming in at the Folly. No dawdling.',
    'Folly Field is getting its feet wet. Window\'s shrinking.',
  ],
  squall: [
    'That squall\'s got teeth today. Your call, pilot.',
    'Storm\'s sitting heavy. Low and slow, or not at all.',
  ],
  fuel: [
    'Needle\'s thirsty — watch your fuel over the Reach.',
    'Fuel gauge is telling stories again. Check it.',
  ],
  landed: [
    'Beautiful flying. Don\'t tell the others I said so.',
    'Welcome home. Kettle\'s on, paperwork\'s waiting.',
  ],
  warning: [
    'Talk to me, pilot — that descent is getting steep.',
    'Ground\'s closer than it looks over water. Eyes up.',
  ],
};

export function radioLine(kind, rng) {
  const pool = RADIO[kind] ?? RADIO.launch;
  return pool[Math.floor(rng.next() * pool.length)];
}
