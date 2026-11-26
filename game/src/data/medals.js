// Medals: ten earned names on the hangar wall. Each checks the career record — a plain
// object of counters the game keeps — so a medal is a fact about what the pilot did,
// never a gift. `test` receives the career stats; `hint` is what the hangar shows.

export const MEDALS = [
  { id: 'first-wings', name: 'First Wings', hint: 'Complete your first contract.',
    test: (s) => s.contractsDone >= 1 },
  { id: 'salt-tanks', name: 'Salt in the Tanks', hint: 'Make a water landing in the Minnow.',
    test: (s) => s.waterLandings >= 1 },
  { id: 'ashwalker', name: 'Ashwalker', hint: 'Fly a photo pass through the ash over Vatu.',
    test: (s) => s.ashPasses >= 1 },
  { id: 'night-owl', name: 'Night Owl', hint: 'Complete a contract flown at night.',
    test: (s) => s.nightFlights >= 1 },
  { id: 'feather-touch', name: 'Feather Touch', hint: 'Land under 100 feet per minute of sink.',
    test: (s) => s.bestLandingFpm > 0 && s.bestLandingFpm <= 100 },
  { id: 'squall-rider', name: 'Squall Rider', hint: 'Complete a contract in a White Squall.',
    test: (s) => s.squallFlights >= 1 },
  { id: 'ringmaster', name: 'Ringmaster', hint: 'Thread every ring of a lagoon course.',
    test: (s) => s.ringCourses >= 1 },
  { id: 'saint', name: 'Saint of the Reach', hint: 'Complete three med-evacs.',
    test: (s) => s.medEvacs >= 3 },
  { id: 'full-circuit', name: 'Full Circuit', hint: 'Land at all eight islands in one tour.',
    test: (s) => s.fullCircuits >= 1 },
  { id: 'old-salt', name: 'Old Salt', hint: 'Log one hundred flights.',
    test: (s) => s.flights >= 100 },
];
